window.LESSONS.push({
  id: "01",
  phase: "0", phaseName: "Tư duy serverless",
  title: "Tư duy serverless: isolate, stateless, edge và giới hạn",
  subtitle: "Vì sao code Spring 'chạy được' nhưng thiết kế Spring thì không bê nguyên lên Workers",

  theory: `
    <p>Trong Spring Boot, bạn có một JVM sống hàng tuần: bean singleton, <code>HashMap</code> cache trong RAM, pool HikariCP 10 kết nối, <code>@Scheduled</code> chạy nền.
    Trên Cloudflare Workers <strong>không có tiến trình nào của bạn sống lâu</strong>. Mỗi request được chạy trong một <em>V8 isolate</em>
    ở data center gần người dùng nhất (hơn 300 thành phố). Isolate có thể bị dựng lên, tái sử dụng cho vài request, rồi bị huỷ bất kỳ lúc nào.</p>

    <p><strong>Ba hệ quả thiết kế</strong></p>
    <ol>
      <li><strong>Stateless thật sự</strong>: biến global có thể còn giữa 2 request (cùng isolate) nhưng <em>không đảm bảo</em>, và mỗi thành phố có isolate riêng.
      Dùng global làm cache "may mắn thì trúng" là được; làm nguồn sự thật (đếm, khoá, session) là sai.</li>
      <li><strong>State phải nằm ở dịch vụ có tên</strong>: KV, D1, Durable Objects, R2, Queues, Hyperdrive→Postgres. Chọn đúng dịch vụ = chọn đúng mô hình nhất quán (bài 11).</li>
      <li><strong>Edge ≠ gần database</strong>: code chạy ở Hà Nội nhưng Postgres ở Frankfurt thì mỗi query vẫn đi vòng trái đất. Thiết kế phải tính "code đi tới dữ liệu" (DO, Smart Placement, Hyperdrive).</li>
    </ol>

    <p><strong>Giới hạn chính (Workers Paid, tại thời điểm viết — luôn kiểm tra lại trang Limits)</strong></p>
    <table>
      <tr><th>Giới hạn</th><th>Giá trị</th><th>Ý nghĩa với thiết kế</th></tr>
      <tr><td>CPU time / invocation</td><td>mặc định 30 s, cấu hình tới 5 phút (<code>limits.cpu_ms</code>)</td><td>Chỉ tính thời gian CPU; chờ I/O (fetch, DB) không tính</td></tr>
      <tr><td>Bộ nhớ / isolate</td><td>128 MB</td><td>Không đọc cả file 1 GB vào RAM — dùng stream</td></tr>
      <tr><td>Subrequest / invocation</td><td>10.000 mặc định (Free: 50)</td><td>Fan-out lớn → chia qua Queues</td></tr>
      <tr><td>Kết nối đồng thời ra ngoài</td><td>6 / request</td><td>Pool của driver DB đặt <code>max</code> nhỏ</td></tr>
      <tr><td>Thời gian khởi động (global scope)</td><td>1 giây</td><td>Không làm việc nặng ở top-level</td></tr>
    </table>

    <div class="callout"><p>💡 Câu hỏi đầu tiên khi thiết kế trên Workers không phải "controller nào?", mà là
    "<strong>state này sống ở đâu, ai là người ghi duy nhất, đọc cần mới tới mức nào?</strong>". Trả lời được thì mọi quyết định sau dễ.</p></div>

    <p><strong>So với Spring</strong>: <code>@Service</code> singleton giữ state → trên Workers phải thành Durable Object; <code>@Scheduled</code> → Cron Trigger hoặc DO alarm;
    <code>@Async</code>/Kafka listener → Queues; <code>@Transactional</code> dài nhiều bước → Workflows hoặc saga.</p>
  `,

  codeTabs: [
    { id: "spring", label: "① Thói quen Spring", lines: [
      "@Service",
      "public class ViewCounter {",
      "    private final Map<String, Long> counts = new ConcurrentHashMap<>();",
      "",
      "    public long hit(String page) {",
      "        return counts.merge(page, 1L, Long::sum);   // đúng vì chỉ có 1 JVM",
      "    }",
      "}"
    ]},
    { id: "wrong", label: "② Bê nguyên sang Worker (SAI)", lines: [
      "const counts = new Map();          // global của isolate",
      "",
      "export default {",
      "  async fetch(req, env, ctx) {",
      "    const page = new URL(req.url).pathname;",
      "    const n = (counts.get(page) ?? 0) + 1;",
      "    counts.set(page, n);",
      "    return new Response(String(n));  // mỗi isolate/thành phố một số khác nhau",
      "  }",
      "};"
    ]},
    { id: "right", label: "③ Đưa state ra dịch vụ", lines: [
      "import { DurableObject } from 'cloudflare:workers';",
      "",
      "export class Counter extends DurableObject {",
      "  async hit() {",
      "    const n = ((await this.ctx.storage.get('n')) ?? 0) + 1;",
      "    await this.ctx.storage.put('n', n);   // input/output gate giữ an toàn",
      "    return n;                        // 1 object = 1 nguồn sự thật",
      "  }",
      "}",
      "",
      "export default {",
      "  async fetch(req, env) {",
      "    const page = new URL(req.url).pathname;",
      "    const n = await env.COUNTER.getByName(page).hit();",
      "    return new Response(String(n));",
      "  }",
      "};"
    ]},
    { id: "cfg", label: "④ wrangler.jsonc", lines: [
      "{",
      "  \"name\": \"views\",",
      "  \"main\": \"src/index.ts\",",
      "  \"compatibility_date\": \"2025-09-01\",",
      "  \"limits\": { \"cpu_ms\": 30000 },",
      "  \"durable_objects\": {",
      "    \"bindings\": [{ \"name\": \"COUNTER\", \"class_name\": \"Counter\" }]",
      "  },",
      "  \"migrations\": [{ \"tag\": \"v1\", \"new_sqlite_classes\": [\"Counter\"] }]",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="u1"><div class="nl">👤 User Hà Nội</div><div class="ns">→ PoP HAN</div></div>
      <div class="node" id="u2"><div class="nl">👤 User Paris</div><div class="ns">→ PoP CDG</div></div>
    </div>
    <div class="arrow" id="a1">↓ mỗi PoP có isolate riêng</div>
    <div class="row">
      <div class="node" id="i1"><div class="nl">⚙️ Isolate HAN</div><div class="ns">counts = {/:3}</div></div>
      <div class="node" id="i2"><div class="nl">⚙️ Isolate CDG</div><div class="ns">counts = {/:7}</div></div>
    </div>
    <div class="arrow" id="a2">↓ đúng: cùng gọi một nơi giữ state</div>
    <div class="node" id="do"><div class="nl">🧱 Durable Object "/"</div><div class="ns">một bản duy nhất trên toàn cầu</div></div>
  `,
  steps: [
    { title: "1 · Thói quen JVM", tab: "spring", highlight: [3, 6], on: [],
      desc: "Map trong bean singleton đúng vì chỉ có một tiến trình và nó sống lâu. Cả hai giả định đó biến mất trên Workers." },
    { title: "2 · Global của isolate", tab: "wrong", highlight: [1, 6, 7], on: ["u1", "u2", "a1"],
      desc: "Request ở Hà Nội và Paris rơi vào hai isolate khác nhau, thậm chí trong cùng thành phố cũng có nhiều isolate." },
    { title: "3 · Kết quả sai", tab: "wrong", highlight: [8], on: ["i1", "i2"],
      desc: "Mỗi isolate đếm riêng, và bị reset khi isolate bị huỷ. Không có lỗi nào báo — chỉ có số liệu sai." },
    { title: "4 · Đưa state vào Durable Object", tab: "right", highlight: [3, 5, 6, 14], on: ["a2", "do"],
      desc: "getByName(page) luôn trỏ tới cùng một object; object xử lý tuần tự nên không mất lượt đếm." },
    { title: "5 · Khai báo binding + giới hạn", tab: "cfg", highlight: [5, 7, 9], on: ["do"],
      desc: "limits.cpu_ms đặt trần CPU; new_sqlite_classes tạo DO dùng SQLite storage (kiểu được khuyến nghị cho mọi DO mới)." }
  ],

  quiz: [
    { q: "Biến global trong Worker có đặc điểm nào?", options: [
        "Được chia sẻ giữa mọi request trên toàn cầu",
        "Có thể còn giữa vài request trong cùng isolate nhưng không đảm bảo, và mỗi isolate một bản",
        "Được lưu xuống đĩa tự động",
        "Luôn bị xoá sau mỗi request"
      ], correct: 1, explanation: "Isolate có thể được tái sử dụng, nên global đôi khi còn — chỉ dùng làm cache tuỳ cơ, không làm nguồn sự thật." },
    { q: "CPU time limit của Worker trên gói Paid tính thế nào?", options: [
        "Tính cả thời gian chờ fetch/DB",
        "Chỉ tính thời gian CPU thực sự chạy; mặc định 30 s, cấu hình được tới 5 phút",
        "Cố định 10 ms",
        "Không có giới hạn"
      ], correct: 1, explanation: "Chờ I/O không tính CPU. Free plan là 10 ms." },
    { q: "Một Worker cần gọi 50.000 API con cho một job. Hướng thiết kế hợp lý?", options: [
        "Gọi hết trong một request",
        "Chia việc qua Queues (fan-out) vì mỗi invocation có giới hạn subrequest",
        "Tăng RAM lên 1 GB",
        "Dùng biến global để nhớ tiến độ"
      ], correct: 1, explanation: "Subrequest mặc định 10.000/invocation; chia nhỏ qua Queues còn cho retry từng phần." },
    { q: "Trong Spring, @Scheduled chạy job định kỳ. Trên Cloudflare tương đương là?", options: [
        "setInterval ở global scope",
        "Cron Trigger (theo Worker) hoặc alarm của Durable Object (theo từng object)",
        "Không có cách nào",
        "Service binding"
      ], correct: 1, explanation: "Không có tiến trình nền sống lâu, nên lịch phải do nền tảng gọi vào." },
    { q: "Vì sao 'chạy ở edge' không tự động làm app nhanh hơn?", options: [
        "Edge có CPU chậm",
        "Nếu dữ liệu nằm ở một region xa, mỗi query vẫn phải đi xa; phải tính vị trí dữ liệu",
        "Edge không hỗ trợ HTTPS",
        "Vì cold start luôn vài giây"
      ], correct: 1, explanation: "Độ trễ = khoảng cách tới dữ liệu × số round-trip. Giảm round-trip hoặc đưa code tới gần dữ liệu." },
    { q: "Giới hạn 6 kết nối ra ngoài đồng thời / request ảnh hưởng gì?", options: [
        "Không ảnh hưởng",
        "Driver DB nên đặt pool max nhỏ (vd 5), các fetch song song vượt 6 sẽ phải xếp hàng",
        "Chỉ được gọi 6 API mỗi ngày",
        "Không dùng được WebSocket"
      ], correct: 1, explanation: "Tài liệu Hyperdrive khuyên postgres.js đặt max: 5 vì lý do này." },
    { q: "Worker khởi động chậm vì parse file JSON 20 MB ở top-level. Rủi ro gì?", options: [
        "Không sao",
        "Vượt giới hạn startup time (1 s) → deploy lỗi hoặc cold start chậm",
        "Tốn phí lưu trữ",
        "Bị chặn bởi WAF"
      ], correct: 1, explanation: "Global scope phải nhẹ; dữ liệu lớn để trong KV/R2 và đọc lười." },
    { q: "Bean @Service giữ state dùng chung (ví dụ bộ đếm) nên chuyển thành gì trên Cloudflare?", options: [
        "Một biến global",
        "Một Durable Object — một thực thể duy nhất, xử lý tuần tự, có storage",
        "Một KV key ghi mỗi request",
        "Một Cron Trigger"
      ], correct: 1, explanation: "KV giới hạn 1 write/giây/key và nhất quán cuối — không hợp để đếm." },
    { q: "Câu hỏi thiết kế quan trọng nhất khi đưa một tính năng lên Workers?", options: [
        "Dùng framework nào",
        "State sống ở đâu, ai ghi, đọc cần nhất quán tới mức nào",
        "Đặt tên route",
        "Dùng TypeScript hay JavaScript"
      ], correct: 1, explanation: "Mọi lựa chọn KV/D1/DO/Queues đều bắt nguồn từ câu hỏi này." }
  ]
});
