window.LESSONS.push({
  id: "16",
  phase: "4", phaseName: "Worker bằng Rust",
  title: "Rust (WASM) hay TypeScript trên Workers — chọn thế nào?",
  subtitle: "kích thước bundle & startup · chi phí vượt ranh giới WASM↔JS · độ phủ API · khi Rust đáng giá · mô hình lai",

  theory: `
    <p>Công ty đang chuyển backend sang Rust nên câu hỏi tự nhiên: "Worker cũng viết Rust cho đồng bộ?". Câu trả lời kỹ sư: <strong>tuỳ việc Worker làm</strong>.</p>

    <table>
      <tr><th>Tiêu chí</th><th>TypeScript</th><th>Rust (workers-rs)</th></tr>
      <tr><td>Chạy thế nào</td><td>Native trên V8, JIT</td><td>WASM + JS glue</td></tr>
      <tr><td>Kích thước</td><td>Thường vài chục–vài trăm KB</td><td>File .wasm thường từ vài trăm KB tới vài MB (tuỳ crate) — ảnh hưởng thời gian nạp và startup</td></tr>
      <tr><td>Gọi binding / fetch</td><td>Trực tiếp</td><td>Qua ranh giới WASM↔JS: string/JSON phải chép và chuyển mã giữa bộ nhớ WASM và heap JS</td></tr>
      <tr><td>Tính năng mới của Workers</td><td>Có ngay</td><td>Thường đến sau; vài binding sau feature flag, docs ghi còn "rough edges"</td></tr>
      <tr><td>Hệ sinh thái</td><td>npm (Hono, zod, pg...)</td><td>Crate phải biên dịch được sang wasm32; nhiều crate server (tokio full, sqlx, reqwest mặc định) không dùng được</td></tr>
      <tr><td>Tính toán CPU nặng</td><td>Ổn</td><td>Thường nhanh hơn và ổn định hơn (không GC, không deopt)</td></tr>
      <tr><td>Chia sẻ code với backend Rust</td><td>Không</td><td>Có: model, validate, logic tính giá, parser dùng chung crate</td></tr>
    </table>

    <p><strong>Nhận xét cơ chế</strong>: Worker điển hình (BFF, gateway, webhook) dành phần lớn thời gian <em>chờ I/O</em> và chỉ vài ms CPU. Ở đó Rust không làm nhanh hơn
    đáng kể, mà còn thêm chi phí chép dữ liệu qua ranh giới và bundle lớn hơn. Rust đáng giá khi phần CPU chiếm tỉ trọng lớn — ký/băm, nén, parse định dạng nhị phân,
    xử lý ảnh nhẹ, thuật toán tính giá phức tạp — hoặc khi <em>tái dùng logic nghiệp vụ</em> đã viết bằng Rust giúp tránh hai bản cài đặt lệch nhau.</p>

    <p><strong>Mô hình lai</strong> hay dùng: Worker viết TypeScript (routing, bindings, gọi API), còn phần tính toán nặng là một module Rust biên dịch sang WASM
    (qua <code>wasm-bindgen</code>/<code>wasm-pack</code>) rồi import vào TS. Hoặc tách thành hai Worker nối bằng service binding (bài 14).</p>

    <p><strong>Quy tắc thực dụng cho team</strong></p>
    <ol>
      <li>Mặc định: TypeScript + Hono cho Worker mới.</li>
      <li>Chọn Rust khi (a) profile thấy CPU là nút cổ chai, hoặc (b) có crate nghiệp vụ Rust dùng chung với backend và việc viết lại bằng TS gây rủi ro lệch logic.</li>
      <li>Đã chọn Rust: bật tối ưu kích thước (<code>lto</code>, <code>opt-level = "z"</code> hoặc <code>"s"</code>, <code>strip</code>), hạn chế crate nặng, đo <code>wrangler deploy --dry-run</code> để xem kích thước.</li>
    </ol>

    <div class="callout"><p>💡 Đừng quyết theo cảm giác "Rust nhanh hơn". Đo CPU time thật trong Workers Logs (bài 18): nếu Worker TS chỉ dùng 3 ms CPU/request,
    viết lại bằng Rust gần như không đổi được gì.</p></div>
  `,

  codeTabs: [
    { id: "size", label: "Tối ưu kích thước Rust", lines: [
      "# Cargo.toml",
      "[profile.release]",
      "opt-level = \"z\"          # ưu tiên kích thước (\"s\" là cân bằng)",
      "lto = true",
      "codegen-units = 1",
      "strip = true",
      "",
      "# xem kích thước sẽ upload mà không deploy",
      "npx wrangler deploy --dry-run --outdir dist"
    ]},
    { id: "hybrid", label: "Mô hình lai TS + WASM", lines: [
      "// pricing/src/lib.rs  — crate dùng chung với backend Rust",
      "// #[wasm_bindgen] pub fn quote(input_json: &str) -> String { ... }",
      "// build: wasm-pack build --target web pricing",
      "",
      "// Worker TypeScript",
      "import { quote } from '../pricing/pkg/pricing';",
      "",
      "app.post('/api/quote', async (c) => {",
      "  const body = await c.req.text();",
      "  const result = quote(body);             // CPU nặng chạy trong WASM",
      "  return new Response(result, { headers: { 'Content-Type': 'application/json' } });",
      "});"
    ]},
    { id: "cost", label: "Ranh giới WASM↔JS", lines: [
      "Request JSON 50 KB đi vào Worker Rust:",
      "  1. JS nhận body (heap JS)",
      "  2. chép + chuyển mã UTF-16 -> UTF-8 vào bộ nhớ tuyến tính của WASM",
      "  3. serde_json parse trong Rust",
      "  4. gọi D1: Rust -> JS glue -> binding -> kết quả JS -> chép ngược vào WASM",
      "  5. serialize response -> chép sang JS -> Response",
      "",
      "=> Với logic mỏng, bước 2/4/5 có thể tốn hơn phần tính toán thật."
    ]},
    { id: "decide", label: "Cây quyết định", lines: [
      "Worker chủ yếu gọi API/DB, CPU < vài ms?          -> TypeScript",
      "Cần tính năng Workers mới nhất (binding mới)?      -> TypeScript",
      "CPU là nút cổ chai (đã đo)?                         -> Rust (toàn bộ hoặc module WASM)",
      "Logic nghiệp vụ Rust phải khớp 100% với backend?    -> Rust crate dùng chung",
      "Team chưa quen Rust + WASM?                        -> TypeScript trước, Rust khi có số liệu"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="ts"><div class="nl">🟦 TypeScript</div><div class="ns">native V8 · bundle nhỏ · API đầy đủ</div></div>
      <div class="node" id="rs"><div class="nl">🦀 Rust → WASM</div><div class="ns">CPU mạnh · dùng chung crate</div></div>
    </div>
    <div class="arrow" id="a1">↕ ranh giới WASM↔JS: chép dữ liệu</div>
    <div class="node" id="io"><div class="nl">🔌 Bindings & fetch</div><div class="ns">đều là API JS</div></div>
    <div class="node" id="hy"><div class="nl">🧩 Lai: TS điều phối + module WASM</div><div class="ns">hoặc 2 Worker + service binding</div></div>
  `,
  steps: [
    { title: "1 · Hai cách chạy khác nhau", tab: "decide", highlight: [1, 3], on: ["ts", "rs"],
      desc: "TS chạy thẳng trên V8; Rust chạy trong WASM do JS glue điều khiển." },
    { title: "2 · Chi phí vượt ranh giới", tab: "cost", highlight: [2, 3, 5, 8], on: ["a1", "io"],
      desc: "Mọi binding là API JS. Dữ liệu đi qua lại phải chép — logic mỏng thì chi phí này chiếm phần lớn." },
    { title: "3 · Giữ WASM nhỏ", tab: "size", highlight: [3, 4, 6, 9], on: ["rs"],
      desc: "WASM lớn làm chậm nạp code và startup. Đo bằng <code>--dry-run</code>." },
    { title: "4 · Mô hình lai", tab: "hybrid", highlight: [1, 2, 6, 10], on: ["hy"],
      desc: "TS lo HTTP/binding; hàm Rust nặng (và dùng chung với backend) chạy trong WASM." },
    { title: "5 · Quyết định dựa trên số liệu", tab: "decide", highlight: [1, 2, 3, 4, 5], on: ["ts", "rs", "hy"],
      desc: "Mặc định TS; chuyển Rust khi đo được CPU là nút cổ chai hoặc cần chia sẻ logic." }
  ],

  quiz: [
    { q: "Worker BFF gọi 3 API, CPU ~3 ms/request. Viết lại bằng Rust có giúp nhiều không?", options: [
        "Có, nhanh gấp 10 lần",
        "Hầu như không — thời gian chủ yếu là chờ I/O; còn thêm chi phí ranh giới WASM↔JS và bundle lớn hơn",
        "Có vì Rust không có GC",
        "Không chạy được"
      ], correct: 1, explanation: "Tối ưu phần chiếm thời gian thật sự." },
    { q: "Vì sao gọi binding từ Rust có chi phí thêm?", options: [
        "Binding chỉ viết cho Rust",
        "Binding là API JS; dữ liệu phải chép/chuyển mã giữa bộ nhớ WASM và heap JS",
        "Rust phải mở kết nối TCP riêng",
        "Không có chi phí"
      ], correct: 1, explanation: "Đặc biệt với chuỗi/JSON lớn." },
    { q: "Trường hợp nào Rust đáng chọn nhất?", options: [
        "Redirect đơn giản",
        "Tính toán CPU nặng đã được đo là nút cổ chai, hoặc cần dùng chung crate nghiệp vụ với backend Rust",
        "Webhook chỉ forward",
        "Đọc KV trả về"
      ], correct: 1, explanation: "Có số liệu hoặc có lý do chia sẻ logic." },
    { q: "Bundle WASM lớn ảnh hưởng gì?", options: [
        "Không ảnh hưởng",
        "Nạp code và khởi tạo chậm hơn, có thể chạm giới hạn kích thước/startup",
        "Tăng bộ nhớ lưu trữ R2",
        "Giảm CPU time"
      ], correct: 1, explanation: "Tối ưu bằng opt-level z/s, lto, strip, bớt crate." },
    { q: "Mô hình lai TS + WASM nghĩa là gì?", options: [
        "Viết cả hai phiên bản song song",
        "Worker TS lo routing/binding, gọi hàm Rust biên dịch sang WASM cho phần tính toán",
        "Chạy Rust trong Docker",
        "Dùng Rust cho frontend"
      ], correct: 1, explanation: "Lấy điểm mạnh của cả hai." },
    { q: "Crate nào dưới đây thường KHÔNG dùng nguyên được trong Worker Rust?", options: [
        "serde", "serde_json", "tokio với runtime đa luồng / reqwest cấu hình mặc định", "thiserror"
      ], correct: 2, explanation: "Crate cần thread, socket OS không biên dịch/chạy được trên wasm32-unknown-unknown." },
    { q: "Tính năng Workers mới ra thường có ở đâu trước?", options: [
        "Rust", "JavaScript/TypeScript", "Python", "Cùng lúc mọi ngôn ngữ"
      ], correct: 1, explanation: "Runtime là JS-first; workers-rs bọc lại sau." },
    { q: "Cách đúng để quyết định chuyển sang Rust?", options: [
        "Theo cảm giác Rust nhanh",
        "Đo CPU time thực tế (Workers Logs/profiling) rồi quyết",
        "Theo số dòng code",
        "Luôn dùng Rust vì backend là Rust"
      ], correct: 1, explanation: "Quyết định kỹ thuật dựa trên số liệu." },
    { q: "Lợi ích 'phi hiệu năng' lớn nhất của Rust trên Workers với công ty này?", options: [
        "Không có",
        "Dùng chung crate model/validate/tính giá với backend Rust, tránh logic lệch nhau",
        "Rẻ hơn",
        "Không cần test"
      ], correct: 1, explanation: "Một nguồn sự thật cho logic nghiệp vụ." }
  ]
});
