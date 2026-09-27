window.LESSONS.push({
  id: "03",
  phase: "0", phaseName: "Lifetime & trait nâng cao",
  title: "dyn vs impl, dyn-compatible & async fn trong trait",
  subtitle: "impl Trait ở tham số/giá trị trả về · Arc<dyn Trait> cho DI · điều kiện dyn-compatible (object safety) · async fn in trait & Send",

  theory: `
    <p>Nhập môn đã so sánh static dispatch (generic, monomorphization) với dynamic dispatch (<code>dyn Trait</code>, vtable). Bài này trả lời câu hỏi thiết kế ở service:
    <strong>khi nào dùng cái nào</strong>, vì sao có trait không biến thành <code>dyn</code> được, và bẫy lớn nhất của <code>async fn</code> trong trait.</p>

    <p><strong>1. Ba chỗ đặt trait</strong></p>
    <table>
      <tr><th>Cú pháp</th><th>Ý nghĩa</th><th>Chi phí</th></tr>
      <tr><td><code>fn f(x: impl Trait)</code> ≈ <code>fn f&lt;T: Trait&gt;(x: T)</code></td><td>Người gọi chọn kiểu</td><td>Mỗi kiểu một bản code, gọi trực tiếp, inline được</td></tr>
      <tr><td><code>fn f() -&gt; impl Trait</code></td><td>Hàm chọn một kiểu cụ thể, <em>giấu</em> tên kiểu</td><td>Như trên; bắt buộc cho closure/iterator/future phức tạp</td></tr>
      <tr><td><code>Box/Arc/&amp;dyn Trait</code></td><td>Kiểu thật chỉ biết lúc chạy</td><td>Gọi qua vtable, thường có allocation, không inline</td></tr>
    </table>
    <p><code>-&gt; impl Trait</code> chỉ trả về được <em>một</em> kiểu cụ thể: nhánh if trả <code>PgRepo</code>, nhánh else trả <code>MockRepo</code> → lỗi; khi đó cần <code>Box&lt;dyn Trait&gt;</code> hoặc enum.</p>

    <p><strong>2. DI kiểu Spring trong Rust</strong>: <code>@Autowired UserRepository repo</code> tương ứng <code>Arc&lt;dyn UserRepository&gt;</code> trong state. Chi phí vtable (~1 lần gọi gián tiếp)
    không đáng kể so với một query DB. Generic <code>AppState&lt;R: UserRepository&gt;</code> nhanh hơn chút nhưng lan tham số kiểu khắp handler. Thực tế: repository/client ngoài → <code>Arc&lt;dyn&gt;</code>;
    hot path tính toán → generic. Nhiều biến thể biết trước (Pg/Mock) → <code>enum</code> cũng là lựa chọn tốt, không cần trait object.</p>

    <p><strong>3. dyn-compatible (tên cũ: object safe)</strong> — trait muốn dùng làm <code>dyn Trait</code> phải thoả (rút gọn):</p>
    <ul>
      <li>Không có method generic theo kiểu (<code>fn get&lt;T&gt;(&amp;self)</code>) — vtable không thể chứa vô số bản.</li>
      <li>Method không trả về <code>Self</code> theo giá trị và không nhận <code>Self</code> theo giá trị (trừ khi gắn <code>where Self: Sized</code> để loại method đó khỏi vtable).</li>
      <li>Trait không đòi <code>Self: Sized</code>; không có associated const.</li>
      <li>Không có <code>async fn</code> / <code>-&gt; impl Trait</code> (mỗi impl trả future khác kiểu, khác kích thước).</li>
    </ul>
    <p>Ví dụ: <code>Clone</code> không dyn-compatible (<code>clone()</code> trả Self). Muốn clone <code>Box&lt;dyn Trait&gt;</code> phải tự thêm method <code>fn box_clone(&amp;self) -&gt; Box&lt;dyn Trait&gt;</code> (crate <code>dyn-clone</code> làm sẵn).</p>

    <p><strong>4. async fn trong trait (ổn định từ Rust 1.75)</strong></p>
    <ul>
      <li>Viết được <code>trait Repo { async fn find(&amp;self, id: i64) -&gt; Option&lt;User&gt;; }</code> — ổn cho generic.</li>
      <li>Hai hạn chế: (a) trait đó <strong>không dyn-compatible</strong>; (b) người gọi generic không biết future trả về có <code>Send</code> không → khi <code>tokio::spawn</code> sẽ lỗi.</li>
      <li>Cách xử lý phổ biến: viết tay <code>fn find(&amp;self, id: i64) -&gt; impl Future&lt;Output = ...&gt; + Send;</code>; hoặc macro <code>#[trait_variant::make(Send)]</code>;
        hoặc crate <code>async-trait</code> (biến thành <code>Pin&lt;Box&lt;dyn Future + Send&gt;&gt;</code>, dyn-compatible, tốn một allocation mỗi lần gọi — chấp nhận được cho repository).</li>
    </ul>
    <div class="callout"><p>💡 Cần <code>Arc&lt;dyn Repo&gt;</code> với method async → dùng <code>#[async_trait]</code> (đơn giản nhất hiện nay). Chỉ dùng generic → <code>async fn</code> native + <code>impl Future + Send</code>.
    Lỗi "future cannot be sent between threads safely" gần như luôn quy về Send của future trong trait.</p></div>
  `,

  codeTabs: [
    { id: "impl", label: "① impl Trait", lines: [
      "fn log_all(items: impl IntoIterator<Item = String>) { /* static dispatch */ }",
      "",
      "fn evens(limit: u32) -> impl Iterator<Item = u32> {   // giấu kiểu Filter<Range<..>, {closure}>",
      "    (0..limit).filter(|n| n % 2 == 0)",
      "}",
      "",
      "fn repo(test: bool) -> impl UserRepo {",
      "    if test { MockRepo::new() } else { PgRepo::new() }  // LỖI: `if` and `else` have incompatible types",
      "}",
      "fn repo_dyn(test: bool) -> Box<dyn UserRepo> {",
      "    if test { Box::new(MockRepo::new()) } else { Box::new(PgRepo::new()) }  // OK",
      "}"
    ]},
    { id: "di", label: "② DI với Arc<dyn>", lines: [
      "#[async_trait::async_trait]",
      "pub trait UserRepo: Send + Sync {",
      "    async fn find(&self, id: i64) -> anyhow::Result<Option<User>>;",
      "}",
      "",
      "#[derive(Clone)]",
      "pub struct AppState { pub users: Arc<dyn UserRepo> }   // ~ @Autowired",
      "",
      "let state = AppState { users: Arc::new(PgRepo { pool }) };",
      "// test: AppState { users: Arc::new(MockRepo::default()) }",
      "",
      "async fn get_user(State(s): State<AppState>, Path(id): Path<i64>) -> ... {",
      "    s.users.find(id).await   // gọi qua vtable, future là Pin<Box<dyn Future + Send>>",
      "}"
    ]},
    { id: "objsafe", label: "③ dyn-compatible", lines: [
      "trait Cache {",
      "    fn get(&self, k: &str) -> Option<Vec<u8>>;          // OK",
      "    fn get_as<T: DeserializeOwned>(&self, k: &str) -> Option<T>   // generic method",
      "        where Self: Sized;                               // -> loại khỏi vtable",
      "    fn boxed(self) -> Box<Self> where Self: Sized { Box::new(self) }",
      "}",
      "let c: Arc<dyn Cache> = Arc::new(RedisCache::new());   // OK nhờ where Self: Sized",
      "c.get(\"k\");            // gọi được",
      "// c.get_as::<User>(\"k\");  // không gọi được qua dyn",
      "",
      "// let x: Box<dyn Clone>;   // LỖI: Clone không dyn-compatible (clone() -> Self)"
    ]},
    { id: "afit", label: "④ async fn & Send", lines: [
      "trait Notifier { async fn send(&self, msg: String); }   // Rust >= 1.75",
      "",
      "fn fire<N: Notifier + Send + Sync + 'static>(n: Arc<N>) {",
      "    tokio::spawn(async move { n.send(\"hi\".into()).await });",
      "    // LỖI: future cannot be sent between threads safely",
      "}",
      "",
      "// Sửa 1: khai báo rõ future là Send",
      "trait Notifier2 {",
      "    fn send(&self, msg: String) -> impl Future<Output = ()> + Send;",
      "}",
      "// impl vẫn viết được: async fn send(&self, msg: String) { ... }",
      "",
      "// Sửa 2: #[trait_variant::make(SendNotifier: Send)] sinh ra bản Send"
    ]},
    { id: "enum", label: "⑤ Enum thay dyn", lines: [
      "pub enum Storage { S3(S3Client), Local(PathBuf) }",
      "",
      "impl Storage {",
      "    pub async fn put(&self, key: &str, data: Bytes) -> anyhow::Result<()> {",
      "        match self {",
      "            Storage::S3(c) => c.put(key, data).await,",
      "            Storage::Local(dir) => tokio::fs::write(dir.join(key), data).await.map_err(Into::into),",
      "        }",
      "    }",
      "}",
      "// Biết trước tập biến thể -> enum: không vtable, không Box, match vét cạn"
    ]}
  ],

  stageHtml: `
    <div class="node" id="q"><div class="nl">❓ Kiểu cụ thể biết lúc nào?</div><div class="ns">quyết định cách đặt trait</div></div>
    <div class="row">
      <div class="node" id="st"><div class="nl">⚡ Lúc biên dịch</div><div class="ns">impl Trait / generic</div></div>
      <div class="node" id="en"><div class="nl">🧩 Tập đóng biết trước</div><div class="ns">enum + match</div></div>
      <div class="node" id="dy"><div class="nl">🔀 Lúc chạy / plugin / mock</div><div class="ns">Arc&lt;dyn Trait&gt;</div></div>
    </div>
    <div class="arrow" id="a1">↓ muốn dyn?</div>
    <div class="node" id="oc"><div class="nl">🔍 Kiểm tra dyn-compatible</div><div class="ns">không generic method, không -&gt; Self, không async fn native</div></div>
    <div class="arrow" id="a2">↓ có async?</div>
    <div class="node" id="at"><div class="nl">📦 #[async_trait]</div><div class="ns">Pin&lt;Box&lt;dyn Future + Send&gt;&gt;</div></div>
  `,
  steps: [
    { title: "1 · impl Trait = static dispatch", tab: "impl", highlight: [1, 3, 4], on: ["q", "st"],
      desc: "Ở tham số: người gọi chọn kiểu. Ở giá trị trả về: hàm giấu một kiểu cụ thể (thường là iterator/closure không đặt tên được)." },
    { title: "2 · impl Trait chỉ một kiểu", tab: "impl", highlight: [7, 8, 10, 11], on: ["dy"],
      desc: "Hai nhánh trả hai kiểu khác nhau → phải dùng <code>Box&lt;dyn&gt;</code> (hoặc enum)." },
    { title: "3 · DI bằng Arc<dyn>", tab: "di", highlight: [1, 2, 7, 9, 13], on: ["dy", "a2", "at"],
      desc: "Tương đương bean Spring: state chứa <code>Arc&lt;dyn UserRepo&gt;</code>, test thay bằng mock. async_trait làm trait dyn-compatible." },
    { title: "4 · Điều kiện dyn-compatible", tab: "objsafe", highlight: [3, 4, 5, 7, 9, 11], on: ["a1", "oc"],
      desc: "Method generic hoặc trả Self phải gắn <code>where Self: Sized</code> để rời vtable. Clone không thể là dyn." },
    { title: "5 · async fn native & Send", tab: "afit", highlight: [1, 4, 5, 10], on: ["oc"],
      desc: "Người gọi generic không biết future có Send → spawn lỗi. Khai báo <code>impl Future + Send</code> để hứa trước." },
    { title: "6 · Enum khi tập biến thể đóng", tab: "enum", highlight: [1, 5, 6, 7, 11], on: ["en"],
      desc: "S3 hoặc Local, không có plugin lạ → enum đơn giản và nhanh hơn trait object." }
  ],

  quiz: [
    { q: "fn f() -> impl Trait có thể trả về hai kiểu khác nhau ở hai nhánh if/else không?", options: [
        "Có", "Không — impl Trait đại diện đúng một kiểu cụ thể", "Có nếu cả hai impl Trait", "Chỉ trong async fn"
      ], correct: 1, explanation: "Cần Box<dyn Trait> hoặc enum." },
    { q: "Tương đương gần nhất của @Autowired UserRepository trong axum là?", options: [
        "static mut REPO", "Arc<dyn UserRepo> nằm trong state", "thread_local!", "Box<UserRepo> global"
      ], correct: 1, explanation: "State được clone cho mỗi request; Arc chia sẻ một instance." },
    { q: "Vì sao Clone không dyn-compatible?", options: [
        "Vì Clone chậm",
        "clone() trả về Self theo giá trị, kích thước không biết được qua dyn",
        "Vì Clone là marker trait",
        "Vì Clone là unsafe"
      ], correct: 1, explanation: "Dùng dyn-clone hoặc method box_clone trả Box<dyn Trait>." },
    { q: "Method generic fn get<T>(&self) trong trait muốn dùng dyn thì sao?", options: [
        "Không thể có trong trait",
        "Gắn where Self: Sized để loại khỏi vtable; không gọi được qua dyn",
        "Tự động được box",
        "Phải thêm 'static"
      ], correct: 1, explanation: "Vtable không thể chứa vô hạn bản của method generic." },
    { q: "async fn trong trait (native, Rust ≥ 1.75) có dùng được qua Arc<dyn Trait> không?", options: [
        "Có",
        "Không — trait có async fn native không dyn-compatible",
        "Có nếu thêm Send",
        "Chỉ với tokio"
      ], correct: 1, explanation: "Mỗi impl trả một future khác kiểu; cần async-trait hoặc tự box future." },
    { q: "Lỗi 'future cannot be sent between threads safely' khi spawn future từ trait generic, sửa thế nào?", options: [
        "Dùng current_thread runtime cho mọi thứ",
        "Khai báo method -> impl Future<Output = T> + Send (hoặc trait_variant/async-trait)",
        "Thêm unsafe impl Send",
        "Bỏ .await"
      ], correct: 1, explanation: "Hứa rõ future là Send ở chữ ký trait." },
    { q: "#[async_trait] biến async fn thành gì?", options: [
        "Một thread mới",
        "fn trả Pin<Box<dyn Future<Output = T> + Send + 'a>>",
        "Một macro rỗng",
        "Callback"
      ], correct: 1, explanation: "Đổi lại dyn-compatible và Send mặc định, tốn một allocation mỗi lần gọi." },
    { q: "Khi tập hiện thực biết trước và đóng (S3/Local), lựa chọn gọn nhất?", options: [
        "Box<dyn Storage>", "enum + match", "Reflection", "Generic lan khắp app"
      ], correct: 1, explanation: "Không vtable, không allocation, match vét cạn giúp không sót nhánh." },
    { q: "Chi phí chính của dyn Trait so với generic?", options: [
        "Không có chi phí",
        "Gọi gián tiếp qua vtable, không inline được, thường cần Box/Arc",
        "Tốn thêm một thread",
        "Luôn chậm hơn 10 lần"
      ], correct: 1, explanation: "Nhỏ so với I/O; đáng kể trong vòng lặp tính toán nóng." }
  ]
});
