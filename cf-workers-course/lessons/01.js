window.LESSONS.push({
  id: "01",
  phase: "0", phaseName: "Nền tảng serverless",
  title: "Serverless là gì — từ Spring Boot chạy 24/7 đến code chạy theo request",
  subtitle: "FaaS vs server truyền thống · trả tiền theo dùng · stateless · Workers nằm ở đâu",

  theory: `
    <p>Với Spring Boot, bạn đóng gói JAR, chạy trên VM/container, process sống 24/7, giữ connection pool, cache trong RAM, và bạn (hoặc team ops) lo
    scale, patch OS, health check. Bạn trả tiền cho <strong>máy đang chạy</strong>, kể cả lúc không có request nào.</p>

    <p><strong>Serverless</strong> (chính xác hơn: <em>Function as a Service</em>) đảo ngược mô hình đó:</p>
    <ul>
      <li>Bạn chỉ đưa <strong>code xử lý 1 sự kiện</strong> (1 HTTP request, 1 tin nhắn queue, 1 lần cron). Không có <code>main()</code> chạy mãi.</li>
      <li>Nền tảng tự quyết định chạy code ở đâu, bao nhiêu bản, khi nào dừng. Không có "server" để bạn SSH vào.</li>
      <li>Trả tiền theo <strong>số request + thời gian tính toán</strong>. Không có request → gần như không tốn tiền.</li>
      <li>Hệ quả quan trọng nhất: code phải <strong>stateless</strong>. Không được tin rằng biến trong RAM còn đó ở request sau — state phải nằm ở DB/KV/Durable Object.</li>
    </ul>

    <table>
      <tr><th></th><th>Spring Boot trên VM/K8s</th><th>AWS Lambda</th><th>Cloudflare Workers</th></tr>
      <tr><td>Đơn vị chạy</td><td>Process JVM</td><td>Container micro-VM (Firecracker)</td><td><strong>V8 isolate</strong></td></tr>
      <tr><td>Cold start</td><td>Giây–chục giây (khởi động JVM + Spring context)</td><td>Trăm ms – vài giây</td><td>Vài ms</td></tr>
      <tr><td>Chạy ở đâu</td><td>1–vài region bạn chọn</td><td>1 region bạn chọn</td><td>Mọi data center của Cloudflare (edge)</td></tr>
      <tr><td>Tính tiền</td><td>Theo giờ máy</td><td>Theo request + GB-giây (tính cả lúc chờ I/O)</td><td>Theo request + <strong>CPU time</strong> (chờ I/O không tính)</td></tr>
      <tr><td>Ngôn ngữ</td><td>Bất kỳ</td><td>Nhiều runtime</td><td>JS/TS gốc; Rust/Python... qua WASM hoặc runtime riêng</td></tr>
    </table>

    <p><strong>Workers hợp với gì ở công ty?</strong> Service nhỏ, nhiều I/O, ít tính toán nặng: API gateway, BFF cho mobile, webhook receiver,
    auth/token check, redirect, resize ảnh nhẹ, job cron gọi API. Service lớn, giữ kết nối lâu, cần thư viện JVM nặng → vẫn là Rust/Java trên server (bài 20).</p>

    <p><strong>Gói cước (tham khảo khi viết bài):</strong> Free: 100.000 request/ngày, 10 ms CPU/request. Workers Paid: từ 5 USD/tháng, CPU mặc định 30 giây/request,
    nâng được tới 5 phút. Số liệu cụ thể xem bài 02 và bài 17.</p>

    <div class="callout"><p>💡 Tư duy chuyển đổi: trong Spring bạn hỏi "server của tôi chịu được bao nhiêu request?". Trong serverless bạn hỏi
    "<em>mỗi request</em> tốn bao nhiêu CPU, gọi bao nhiêu dịch vụ, và state nằm ở đâu?".</p></div>
  `,

  codeTabs: [
    { id: "spring", label: "Spring Boot", lines: [
      "@SpringBootApplication",
      "public class App {",
      "  public static void main(String[] args) {",
      "    SpringApplication.run(App.class, args);   // process sống mãi",
      "  }",
      "}",
      "",
      "@RestController",
      "class HelloController {",
      "  private int counter = 0;                     // state trong RAM: sống cùng process",
      "  @GetMapping(\"/hello\")",
      "  String hello() { return \"Hello #\" + (++counter); }",
      "}"
    ]},
    { id: "worker", label: "Cloudflare Worker", lines: [
      "// src/index.ts — không có main(), chỉ export handler",
      "export default {",
      "  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {",
      "    const url = new URL(request.url);",
      "    if (url.pathname === '/hello') {",
      "      return new Response('Hello from the edge');",
      "    }",
      "    return new Response('Not found', { status: 404 });",
      "  },",
      "} satisfies ExportedHandler<Env>;"
    ]},
    { id: "life", label: "Vòng đời", lines: [
      "# Spring Boot",
      "deploy JAR -> JVM khởi động (vài giây) -> chờ request -> xử lý -> chờ tiếp ... (24/7)",
      "",
      "# Worker",
      "wrangler deploy -> code được đẩy tới mọi data center",
      "request tới -> (nếu chưa có) tạo isolate vài ms -> gọi fetch() -> trả Response",
      "không có request một lúc -> isolate có thể bị thu hồi, không tốn tiền",
      "request tiếp theo -> có thể dùng lại isolate cũ, cũng có thể là isolate MỚI"
    ]},
    { id: "cost", label: "Ví dụ chi phí", lines: [
      "# Webhook nhận 3 triệu request/tháng, mỗi request 2 ms CPU, chờ API ngoài 300 ms",
      "",
      "VM nhỏ chạy 24/7            -> trả đủ 720 giờ máy dù phần lớn thời gian rảnh",
      "Workers Paid (5 USD/tháng)  -> đã gồm 10 triệu request + 30 triệu CPU-ms",
      "                              3 triệu x 2 ms = 6 triệu CPU-ms  -> nằm trong gói",
      "                              300 ms chờ API KHÔNG tính vì là thời gian chờ I/O"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="jvm"><div class="nl">☕ JVM chạy 24/7</div><div class="ns">bạn lo scale, patch, pool</div></div>
      <div class="node" id="plat"><div class="nl">☁️ Nền tảng Workers</div><div class="ns">tự chạy code ở mọi nơi</div></div>
    </div>
    <div class="arrow" id="a1">↓ 1 request = 1 lần gọi handler</div>
    <div class="node" id="fn"><div class="nl">⚡ fetch(request, env, ctx)</div><div class="ns">stateless, sống ngắn</div></div>
    <div class="arrow" id="a2">↓ state ở ngoài</div>
    <div class="node" id="store"><div class="nl">🗄️ KV / D1 / DO / Postgres</div><div class="ns">nơi dữ liệu thật sự sống</div></div>
    <div class="node" id="bill"><div class="nl">💵 Hoá đơn</div><div class="ns">request + CPU time</div></div>
  `,
  steps: [
    { title: "1 · Mô hình quen thuộc", tab: "spring", highlight: [3, 4, 10, 12], on: ["jvm"],
      desc: "Process sống mãi, <code>counter</code> nằm trong RAM và tăng dần — vì mọi request đi vào cùng một process." },
    { title: "2 · Worker chỉ là một handler", tab: "worker", highlight: [2, 3, 9, 10], on: ["plat", "a1", "fn"],
      desc: "Không có main(). Nền tảng gọi <code>fetch()</code> mỗi khi có request. Chữ ký dùng <code>Request</code>/<code>Response</code> chuẩn Web." },
    { title: "3 · Vòng đời không do bạn quyết", tab: "life", highlight: [5, 6, 7, 8], on: ["fn"],
      desc: "Isolate có thể được tái dùng hoặc tạo mới bất kỳ lúc nào, ở data center khác nhau. Vì vậy đừng giữ state quan trọng trong biến." },
    { title: "4 · State nằm ngoài code", tab: "life", highlight: [8], on: ["a2", "store"],
      desc: "Muốn đếm như <code>counter</code> ở tab Spring → phải ghi vào KV, D1 hay Durable Object (Pha 3)." },
    { title: "5 · Trả tiền theo dùng", tab: "cost", highlight: [3, 4, 5, 6], on: ["bill"],
      desc: "Workers tính CPU time, không tính thời gian chờ I/O — rất hợp với service chủ yếu gọi API/DB." }
  ],

  quiz: [
    { q: "Đặc điểm cốt lõi nào khiến code serverless phải stateless?", options: [
        "Không được dùng biến",
        "Nền tảng có thể chạy request kế tiếp trên instance khác hoặc instance mới, nên RAM không đảm bảo còn giữ dữ liệu",
        "Serverless không có RAM",
        "Vì JavaScript không có class"
      ], correct: 1, explanation: "Bạn không kiểm soát vòng đời instance, nên state quan trọng phải nằm ở kho lưu trữ bên ngoài." },
    { q: "Trong một Worker, 'entry point' là gì?", options: [
        "public static void main",
        "Object export default có hàm fetch(request, env, ctx)",
        "File wrangler.jsonc",
        "Một Dockerfile"
      ], correct: 1, explanation: "Nền tảng gọi các handler (fetch, scheduled, queue...) được export từ module chính." },
    { q: "Workers tính tiền CPU theo cách nào?", options: [
        "Theo giờ máy chạy",
        "Theo GB-giây kể cả thời gian chờ I/O",
        "Theo CPU time thực sự dùng; thời gian chờ fetch/DB không tính",
        "Miễn phí hoàn toàn"
      ], correct: 2, explanation: "Đây là khác biệt lớn với nhiều FaaS khác vốn tính theo thời lượng (duration)." },
    { q: "Workers chạy ở đâu khi bạn deploy?", options: [
        "Một region duy nhất bạn chọn",
        "Máy local của bạn",
        "Trên mạng lưới data center toàn cầu của Cloudflare, gần người dùng",
        "Chỉ ở Mỹ"
      ], correct: 2, explanation: "Code được phân phối tới edge; request được xử lý ở data center gần client (trừ khi bật Smart Placement — bài 13)." },
    { q: "Loại service nào HỢP với Workers nhất?", options: [
        "Batch xử lý video 2 giờ",
        "BFF/API gateway nhẹ cho app mobile, chủ yếu gọi API/DB rồi ghép kết quả",
        "Kafka consumer giữ kết nối liên tục",
        "Ứng dụng cần ghi file lên ổ đĩa local"
      ], correct: 1, explanation: "Workers mạnh ở request ngắn, nhiều I/O, ít CPU." },
    { q: "Biến private int counter trong @RestController của Spring hoạt động được vì...", options: [
        "Spring đồng bộ nó vào DB",
        "Controller là singleton trong một process sống liên tục",
        "Java tự lưu biến ra đĩa",
        "Mỗi request có counter riêng"
      ], correct: 1, explanation: "Cùng process, cùng bean singleton. Trong Worker, không có đảm bảo đó." },
    { q: "Gói Free của Workers giới hạn CPU mỗi request HTTP là bao nhiêu?", options: [
        "10 ms", "50 ms", "30 giây", "5 phút"
      ], correct: 0, explanation: "Free: 10 ms. Paid: mặc định 30 giây, cấu hình tới 5 phút." },
    { q: "Câu hỏi nào đúng 'tư duy serverless' khi thiết kế?", options: [
        "Cần bao nhiêu CPU core cho server?",
        "Mỗi request tốn bao nhiêu CPU, gọi bao nhiêu dịch vụ ngoài, và state lưu ở đâu?",
        "Heap JVM nên đặt bao nhiêu?",
        "Nên dùng bao nhiêu thread pool?"
      ], correct: 1, explanation: "Đơn vị suy nghĩ là một lần gọi handler, không phải một máy chủ." },
    { q: "Lambda và Workers khác nhau cơ bản ở đơn vị cô lập nào?", options: [
        "Lambda dùng V8 isolate, Workers dùng VM",
        "Lambda dùng micro-VM/container, Workers dùng V8 isolate",
        "Cả hai đều dùng JVM",
        "Không khác gì"
      ], correct: 1, explanation: "Chi tiết ở bài 02 — đây là lý do cold start của Workers rất nhỏ." }
  ]
});
