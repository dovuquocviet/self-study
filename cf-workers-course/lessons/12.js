window.LESSONS.push({
  id: "12",
  phase: "3", phaseName: "Bindings: lưu trữ & kết nối",
  title: "Durable Objects nhập môn — một 'actor' duy nhất cho mỗi ID",
  subtitle: "đúng một instance/ID trên toàn cầu · đơn luồng · SQLite riêng · RPC qua stub · alarm · khi nào cần",

  theory: `
    <p>Worker thường là stateless và có hàng nghìn bản chạy song song. Vậy làm sao đếm chính xác, giữ phòng chat, hay rate-limit theo user?
    <strong>Durable Object (DO)</strong> giải quyết đúng bài toán này:</p>
    <ul>
      <li>Bạn viết một <strong>class</strong>. Mỗi <strong>ID</strong> (vd <code>"cart:user-42"</code>) ứng với <strong>đúng một instance trên toàn thế giới</strong> tại một thời điểm.</li>
      <li>Mọi request cho ID đó đi tới cùng instance, được xử lý <strong>tuần tự</strong> (đơn luồng) → không race condition, không cần lock.</li>
      <li>Mỗi instance có <strong>kho lưu trữ riêng</strong>, bền: SQLite (<code>this.ctx.storage.sql</code>) hoặc API key-value (<code>this.ctx.storage.get/put</code>). Tối đa 10 GB/object.</li>
      <li>Instance được tạo gần nơi request đầu tiên tới, ngủ khi rảnh, tự thức khi có request. Biến trong RAM có thể mất khi ngủ — dữ liệu thật phải ở storage.</li>
    </ul>
    <p>Nếu bạn biết mô hình <strong>actor</strong> (Akka): mỗi DO là một actor có hộp thư và state riêng, định danh bằng ID. Khác Akka ở chỗ bạn không phải vận hành cluster.</p>

    <p><strong>Gọi DO từ Worker</strong>: <code>env.CART.getByName("user-42")</code> trả về một <em>stub</em>; gọi method public của class qua stub như gọi hàm (RPC) — đó là một lượt mạng, nhớ <code>await</code>.</p>

    <p><strong>Cấu hình</strong>: binding trong <code>durable_objects.bindings</code> và khai báo class dùng SQLite. Cách cũ là mảng <code>migrations</code> với
    <code>new_sqlite_classes</code>; docs 2026 giới thiệu khối <code>exports</code> mới (<code>"type": "durable-object", "storage": "sqlite"</code>). Một Worker chỉ dùng một trong hai cách,
    và đã chuyển sang <code>exports</code> thì không quay lại được. Bài này dùng <code>migrations</code> vì còn phổ biến trong tài liệu/ví dụ.</p>

    <p><strong>Alarm</strong>: <code>this.ctx.storage.setAlarm(thời_điểm)</code> — DO tự thức dậy gọi <code>alarm()</code>, kể cả khi không có request. Mỗi object một alarm.
    Dùng cho "huỷ giỏ hàng sau 30 phút không thanh toán", "gom batch rồi flush".</p>

    <div class="callout"><p>💡 DO mạnh vì <em>tuần tự</em>, và yếu cũng vì tuần tự: một object là một điểm nghẽn. Chia theo đơn vị tự nhiên (mỗi user, mỗi giỏ, mỗi phòng),
    đừng làm một DO "global" cho cả hệ thống.</p></div>
  `,

  codeTabs: [
    { id: "cls", label: "Class DO", lines: [
      "import { DurableObject } from 'cloudflare:workers';",
      "",
      "export class Cart extends DurableObject<Env> {",
      "  constructor(ctx: DurableObjectState, env: Env) {",
      "    super(ctx, env);",
      "    this.ctx.storage.sql.exec(",
      "      'CREATE TABLE IF NOT EXISTS items (sku TEXT PRIMARY KEY, qty INTEGER NOT NULL)'",
      "    );",
      "  }",
      "",
      "  async add(sku: string, qty: number) {",
      "    this.ctx.storage.sql.exec(",
      "      'INSERT INTO items (sku, qty) VALUES (?, ?) ON CONFLICT(sku) DO UPDATE SET qty = qty + excluded.qty',",
      "      sku, qty",
      "    );",
      "    await this.ctx.storage.setAlarm(Date.now() + 30 * 60_000);   // 30 phút không động -> dọn",
      "    return this.list();",
      "  }",
      "",
      "  list() {",
      "    return this.ctx.storage.sql.exec('SELECT sku, qty FROM items').toArray();",
      "  }",
      "",
      "  async alarm() {",
      "    this.ctx.storage.sql.exec('DELETE FROM items');",
      "  }",
      "}"
    ]},
    { id: "cfg", label: "wrangler.jsonc", lines: [
      "{",
      "  \"name\": \"cart-worker\",",
      "  \"main\": \"src/index.ts\",",
      "  \"compatibility_date\": \"2026-09-01\",",
      "  \"durable_objects\": {",
      "    \"bindings\": [{ \"name\": \"CART\", \"class_name\": \"Cart\" }]",
      "  },",
      "  \"migrations\": [",
      "    { \"tag\": \"v1\", \"new_sqlite_classes\": [\"Cart\"] }",
      "  ]",
      "}"
    ]},
    { id: "call", label: "Worker gọi DO", lines: [
      "export { Cart } from './cart';          // class DO phải được export từ module chính",
      "",
      "app.post('/api/cart/items', async (c) => {",
      "  const userId = c.get('userId');",
      "  const { sku, qty } = await c.req.json<{ sku: string; qty: number }>();",
      "  const stub = c.env.CART.getByName('cart:' + userId);   // cùng tên -> cùng instance",
      "  const items = await stub.add(sku, qty);                  // RPC, xử lý tuần tự trong DO",
      "  return c.json({ items });",
      "});",
      "",
      "export default app;"
    ]},
    { id: "vs", label: "Chọn kho nào?", lines: [
      "KV     : đọc cực nhiều, ghi ít, chấp nhận cũ ~60 s        (config, cache)",
      "D1     : SQL quan hệ cho cả service, một DB tuần tự         (sản phẩm, đơn hàng)",
      "R2     : file/blob lớn                                       (ảnh, export CSV)",
      "DO     : state nhất quán mạnh THEO TỪNG thực thể, đơn luồng  (giỏ hàng, rate limit, chat room)",
      "Postgres qua Hyperdrive : DB sẵn có của công ty             (bài 13)"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="w1"><div class="nl">⚡ Worker @ SIN</div><div class="ns">user-42 thêm SKU A</div></div>
      <div class="node" id="w2"><div class="nl">⚡ Worker @ HKG</div><div class="ns">user-42 thêm SKU B</div></div>
    </div>
    <div class="arrow" id="a1">↓ getByName('cart:user-42') — cùng một đích</div>
    <div class="node" id="do"><div class="nl">🧱 DO Cart (user-42)</div><div class="ns">duy nhất · xử lý tuần tự</div></div>
    <div class="row">
      <div class="node" id="sql"><div class="nl">🗃️ SQLite riêng</div><div class="ns">ctx.storage.sql</div></div>
      <div class="node" id="alarm"><div class="nl">⏰ alarm()</div><div class="ns">tự thức dậy</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Khai báo class & binding", tab: "cfg", highlight: [5, 6, 8, 9], on: ["do"],
      desc: "Binding <code>CART</code> trỏ tới class <code>Cart</code>; migration v1 tạo class dùng SQLite." },
    { title: "2 · Hai request, một đích", tab: "call", highlight: [6, 7], on: ["w1", "w2", "a1", "do"],
      desc: "Worker ở hai data center khác nhau, nhưng cùng tên → cùng instance duy nhất. Không race." },
    { title: "3 · State bền trong SQLite riêng", tab: "cls", highlight: [3, 6, 7, 11, 12, 13, 14], on: ["sql"],
      desc: "Mỗi DO có DB SQLite của riêng nó. Truy vấn là đồng bộ (cùng máy) nên không cần await." },
    { title: "4 · Alarm thay cron theo từng đối tượng", tab: "cls", highlight: [16, 24, 25], on: ["alarm"],
      desc: "Mỗi lần thêm hàng đặt lại alarm 30 phút; hết hạn thì <code>alarm()</code> dọn giỏ." },
    { title: "5 · Chọn kho phù hợp", tab: "vs", highlight: [4], on: ["do"],
      desc: "DO không thay D1/Postgres; nó dành cho state cần nhất quán mạnh trên từng thực thể." }
  ],

  quiz: [
    { q: "Đảm bảo cốt lõi của Durable Object là gì?", options: [
        "Chạy ở mọi data center cùng lúc",
        "Mỗi ID có đúng một instance trên toàn cầu tại một thời điểm, xử lý request tuần tự",
        "Không bao giờ ngủ",
        "Miễn phí vô hạn"
      ], correct: 1, explanation: "Đó là nền tảng để nhất quán mạnh không cần lock." },
    { q: "Mô hình lập trình nào gần DO nhất?", options: [
        "Thread pool", "Actor (kiểu Akka): định danh + hộp thư + state riêng", "MapReduce", "Stored procedure"
      ], correct: 1, explanation: "Mỗi DO là một actor được Cloudflare vận hành." },
    { q: "Hai Worker ở hai data center gọi getByName('cart:user-42') cùng lúc. Kết quả?", options: [
        "Tạo hai instance, dữ liệu xung đột",
        "Cả hai tới cùng một instance, được xử lý lần lượt",
        "Một cái bị lỗi",
        "Mỗi cái đọc bản sao riêng"
      ], correct: 1, explanation: "Cùng tên → cùng ID → cùng instance." },
    { q: "Dữ liệu giỏ hàng nên lưu ở đâu trong DO?", options: [
        "Field của class",
        "ctx.storage (SQLite hoặc KV API) — field trong RAM có thể mất khi DO ngủ/bị chuyển",
        "Biến global của Worker",
        "Cookie"
      ], correct: 1, explanation: "Field chỉ nên dùng làm cache tạm." },
    { q: "alarm() dùng để làm gì?", options: [
        "Báo lỗi",
        "Cho DO tự thức dậy chạy việc tại thời điểm đã hẹn, kể cả không có request",
        "Gửi push notification",
        "Tăng CPU limit"
      ], correct: 1, explanation: "Mỗi object có một alarm; đặt lại bằng setAlarm." },
    { q: "Phản mẫu khi dùng DO?", options: [
        "Một DO cho mỗi user",
        "Một DO 'global' duy nhất xử lý mọi request của hệ thống",
        "Dùng SQLite trong DO",
        "Dùng alarm"
      ], correct: 1, explanation: "Đơn luồng → một object global thành điểm nghẽn." },
    { q: "Class DO cần được làm gì để runtime tìm thấy?", options: [
        "Đặt trong thư mục do/",
        "Export từ module chính của Worker và khai báo trong durable_objects + migrations (hoặc exports)",
        "Đăng ký trên dashboard",
        "Không cần gì"
      ], correct: 1, explanation: "class_name phải khớp tên export." },
    { q: "Gọi stub.add(sku, qty) từ Worker thực chất là gì?", options: [
        "Gọi hàm cục bộ trong cùng isolate",
        "Một lời gọi RPC tới instance DO (có thể ở máy khác), phải await",
        "Ghi vào KV",
        "Gửi vào Queue"
      ], correct: 1, explanation: "Trông như gọi hàm nhưng có độ trễ mạng." },
    { q: "Rate limit chính xác theo user (vd 10 request/phút) nên dùng gì?", options: [
        "KV", "Durable Object mỗi user một instance", "R2", "Cache API"
      ], correct: 1, explanation: "Cần đếm nguyên tử, nhất quán — đúng thế mạnh của DO (Cloudflare cũng có binding Rate Limiting riêng cho trường hợp đơn giản)." }
  ]
});
