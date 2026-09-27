window.LESSONS.push({
  id: "02",
  phase: "1", phaseName: "Durable Objects sâu",
  title: "Durable Object là gì: actor đơn luồng có địa chỉ toàn cầu",
  subtitle: "idFromName · getByName · newUniqueId · RPC · input/output gate · locationHint",

  theory: `
    <p>Durable Object (DO) = <strong>một instance của class JS</strong>, có <strong>tên duy nhất trên toàn cầu</strong>, kèm <strong>ổ lưu trữ riêng</strong>.
    Mọi request gửi tới cùng một tên đều tới <em>đúng một</em> instance đang chạy ở <em>một</em> data center. Đây là mô hình <strong>actor</strong>
    (như Akka/Orleans): mỗi actor xử lý message của mình một cách tuần tự, không chia sẻ bộ nhớ với actor khác.</p>

    <p><strong>Lấy stub (địa chỉ) của object</strong></p>
    <table>
      <tr><th>Cách</th><th>Khi nào dùng</th></tr>
      <tr><td><code>env.NS.getByName("room-42")</code></td><td>Có khoá nghiệp vụ tự nhiên (roomId, userId, tenantId). Gọn nhất, tương đương <code>get(idFromName(name))</code></td></tr>
      <tr><td><code>env.NS.idFromName(name)</code> → <code>env.NS.get(id)</code></td><td>Như trên, cần giữ đối tượng id</td></tr>
      <tr><td><code>env.NS.newUniqueId()</code></td><td>Tạo object mới không có tên nghiệp vụ; lưu <code>id.toString()</code> lại rồi dùng <code>idFromString</code> để quay lại. Lần tạo đầu nhanh hơn vì không cần tra cứu toàn cầu</td></tr>
    </table>
    <p>Tạo stub <strong>không</strong> đánh thức object; chỉ khi gọi method thì runtime mới tìm/khởi tạo nó.
    Lần đầu, object được đặt gần nơi request đầu tiên xuất hiện (hoặc theo <code>locationHint</code> như <code>"apac"</code>, <code>"weur"</code>);
    <code>env.NS.jurisdiction("eu")</code> bắt dữ liệu nằm trong EU.</p>

    <p><strong>Đơn luồng nhưng vẫn có await</strong>: JS trong object chạy trên một luồng, nhưng khi bạn <code>await fetch()</code> thì request khác có thể chen vào.
    Runtime có 2 cơ chế giúp bạn:</p>
    <ul>
      <li><strong>Input gate</strong>: khi đang chờ thao tác storage, không có event mới nào được giao vào → chuỗi <code>get</code> rồi <code>put</code> không bị xen ngang.</li>
      <li><strong>Output gate</strong>: response/message gửi ra ngoài bị giữ lại cho tới khi mọi write trước đó đã bền vững → client không bao giờ thấy "đã lưu" khi chưa lưu.</li>
    </ul>
    <p>Nhưng <code>await fetch(api bên ngoài)</code> thì <em>mở</em> input gate. Đọc state → gọi API → ghi state có thể bị request khác xen giữa. Khi đó cần tự khoá bằng cờ trong storage hoặc <code>blockConcurrencyWhile</code> (dùng tiết kiệm).</p>

    <div class="callout"><p>💡 Throughput của <em>một</em> object có trần (tài liệu gợi ý khoảng 1.000 request/giây cho thao tác đơn giản). Scale bằng cách có <strong>nhiều object</strong>
    (mỗi room/user/tenant một object), không phải làm một object "to" hơn. So với Spring: đừng nghĩ DO là một <code>@Service</code> dùng chung; hãy nghĩ nó là <em>một entity sống</em>.</p></div>

    <p><strong>RPC</strong>: class kế thừa <code>DurableObject</code> từ <code>cloudflare:workers</code>; method public gọi thẳng qua stub (<code>await stub.join(user)</code>), tham số/giá trị trả về đi qua structured clone. Cách cũ là <code>stub.fetch(request)</code> vẫn dùng được.</p>
  `,

  codeTabs: [
    { id: "do", label: "① Class DO", lines: [
      "import { DurableObject } from 'cloudflare:workers';",
      "",
      "export class Seat extends DurableObject {",
      "  async reserve(userId) {",
      "    const holder = await this.ctx.storage.get('holder');",
      "    if (holder && holder !== userId) return { ok: false, holder };",
      "    await this.ctx.storage.put('holder', userId);",
      "    return { ok: true };",
      "  }",
      "}"
    ]},
    { id: "worker", label: "② Worker gọi DO", lines: [
      "export default {",
      "  async fetch(req, env) {",
      "    const { showId, seat, userId } = await req.json();",
      "    const stub = env.SEAT.getByName(showId + ':' + seat);  // chưa đánh thức",
      "    const r = await stub.reserve(userId);                   // RPC",
      "    return Response.json(r, { status: r.ok ? 200 : 409 });",
      "  }",
      "};"
    ]},
    { id: "ids", label: "③ Các kiểu id", lines: [
      "// 1) theo tên nghiệp vụ",
      "const a = env.SEAT.getByName('show-9:A12');",
      "",
      "// 2) id ngẫu nhiên, lưu lại để dùng sau",
      "const id = env.DOC.newUniqueId();",
      "await db.saveDocId(id.toString());",
      "const b = env.DOC.get(env.DOC.idFromString(saved));",
      "",
      "// 3) gợi ý vị trí & ràng buộc pháp lý",
      "const c = env.SEAT.get(env.SEAT.idFromName('x'), { locationHint: 'apac' });",
      "const d = env.SEAT.jurisdiction('eu').getByName('user-7');"
    ]},
    { id: "race", label: "④ Chỗ bị chen ngang", lines: [
      "async reserveWithPayment(userId) {",
      "  const holder = await this.ctx.storage.get('holder');  // input gate: an toàn",
      "  if (holder) return { ok: false };",
      "  const paid = await fetch('https://pay.internal/hold'); // gate MỞ: request khác chen vào",
      "  await this.ctx.storage.put('holder', userId);          // có thể ghi đè người khác!",
      "  return { ok: paid.ok };",
      "}",
      "// Sửa: ghi 'pending' TRƯỚC khi gọi ra ngoài, hoặc bọc bằng blockConcurrencyWhile"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="w1"><div class="nl">⚙️ Worker Tokyo</div><div class="ns">user A giữ ghế A12</div></div>
      <div class="node" id="w2"><div class="nl">⚙️ Worker Sydney</div><div class="ns">user B giữ ghế A12</div></div>
    </div>
    <div class="arrow" id="a1">↓ getByName('show-9:A12') → cùng một địa chỉ</div>
    <div class="node" id="do"><div class="nl">🧱 DO show-9:A12 (Singapore)</div><div class="ns">hàng đợi: A → B, xử lý tuần tự</div></div>
    <div class="arrow" id="a2">↓ storage riêng của object</div>
    <div class="node" id="st"><div class="nl">💾 holder = A</div><div class="ns">B nhận 409</div></div>
  `,
  steps: [
    { title: "1 · Hai người cùng giữ một ghế", tab: "worker", highlight: [3, 4], on: ["w1", "w2"],
      desc: "Hai Worker ở hai châu lục, cùng tính ra tên 'show-9:A12'. Tạo stub chưa tốn gì." },
    { title: "2 · Cùng một object", tab: "worker", highlight: [5], on: ["a1", "do"],
      desc: "Runtime định tuyến cả hai RPC tới đúng một instance. Không cần lock phân tán như Redis SETNX." },
    { title: "3 · Xử lý tuần tự", tab: "do", highlight: [5, 6, 7], on: ["do", "a2", "st"],
      desc: "Input gate đảm bảo get → put của A không bị B chen giữa. B đến sau thấy holder = A." },
    { title: "4 · Chọn kiểu id", tab: "ids", highlight: [2, 5, 7, 10, 11], on: ["do"],
      desc: "Có khoá tự nhiên → getByName. Không có → newUniqueId và tự lưu chuỗi id. locationHint/jurisdiction chỉ có tác dụng lúc object được tạo lần đầu." },
    { title: "5 · Cạm bẫy await fetch", tab: "race", highlight: [4, 5, 8], on: ["do"],
      desc: "fetch ra ngoài mở input gate. Đây là chỗ race condition hay gặp nhất khi mới dùng DO." }
  ],

  quiz: [
    { q: "Hai request từ hai châu lục gọi getByName('room-1') trên cùng namespace. Chúng tới đâu?", options: [
        "Hai instance khác nhau gần mỗi user",
        "Cùng một instance duy nhất trên toàn cầu",
        "Ngẫu nhiên",
        "Instance gần database nhất"
      ], correct: 1, explanation: "Tên → id cố định → đúng một object." },
    { q: "Tạo stub bằng getByName có đánh thức object không?", options: [
        "Có, luôn luôn",
        "Không — chỉ khi gọi method/fetch thì object mới được khởi tạo",
        "Chỉ khi object đã tồn tại",
        "Chỉ trong môi trường dev"
      ], correct: 1, explanation: "Stub chỉ là địa chỉ." },
    { q: "Input gate đảm bảo điều gì?", options: [
        "Mọi fetch ra ngoài đều tuần tự",
        "Trong lúc chờ thao tác storage, không có event mới được giao vào object",
        "Response được mã hoá",
        "Object không bao giờ bị huỷ"
      ], correct: 1, explanation: "Nhờ vậy read-modify-write thuần storage không bị xen ngang." },
    { q: "Output gate đảm bảo điều gì?", options: [
        "Response chỉ được gửi ra khi các write trước đó đã bền vững",
        "Chỉ một request được xử lý mỗi giây",
        "Không có write nào bị lỗi",
        "Write được sao chép sang mọi region"
      ], correct: 0, explanation: "Client không bao giờ nhận xác nhận cho dữ liệu chưa lưu." },
    { q: "Trong method DO: get state → await fetch(API ngoài) → put state. Rủi ro?", options: [
        "Không có rủi ro vì DO đơn luồng",
        "Request khác có thể chen vào trong lúc chờ fetch và làm state cũ đi",
        "fetch bị cấm trong DO",
        "put sẽ bị bỏ qua"
      ], correct: 1, explanation: "fetch ra ngoài mở input gate. Ghi trạng thái 'pending' trước, hoặc dùng blockConcurrencyWhile có cân nhắc." },
    { q: "Một object nhận 20.000 request/giây và bị quá tải. Cách scale đúng?", options: [
        "Tăng CPU cho object",
        "Chia thành nhiều object (sharding theo khoá) để mỗi object gánh ít hơn",
        "Chuyển sang biến global",
        "Bật cache KV cho write"
      ], correct: 1, explanation: "Một object có trần throughput; mô hình DO scale theo số lượng object." },
    { q: "Khi nào nên dùng newUniqueId() thay vì idFromName?", options: [
        "Khi có khoá nghiệp vụ như userId",
        "Khi tạo object mới không có tên tự nhiên (vd tài liệu mới) và sẽ lưu lại chuỗi id",
        "Không bao giờ",
        "Khi cần đọc từ KV"
      ], correct: 1, explanation: "Lần tạo đầu nhanh hơn vì không phải phối hợp toàn cầu để kiểm tra trùng tên." },
    { q: "env.NS.jurisdiction('eu') dùng để làm gì?", options: [
        "Dịch thông báo sang tiếng châu Âu",
        "Đảm bảo object được tạo và lưu dữ liệu trong EU",
        "Giảm giá",
        "Tăng throughput"
      ], correct: 1, explanation: "Phục vụ yêu cầu lưu trú dữ liệu (như GDPR)." },
    { q: "So với Spring, cách nghĩ đúng về một Durable Object là?", options: [
        "Một bean singleton cho cả app",
        "Một entity sống (một room, một user, một đơn hàng) có state và xử lý tuần tự",
        "Một bảng database",
        "Một thread pool"
      ], correct: 1, explanation: "Thiết kế theo 'một object cho mỗi thực thể cần phối hợp'." }
  ]
});
