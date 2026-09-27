window.LESSONS.push({
  id: "02",
  phase: "0", phaseName: "Lifetime & trait nâng cao",
  title: "Trait nâng cao: associated type, blanket impl, orphan rule",
  subtitle: "associated type vs generic param · supertrait · blanket impl · orphan rule & newtype · extension trait",

  theory: `
    <p>Nhập môn đã dạy trait = interface + generic không xoá kiểu. Để đọc được code của tokio, tower, axum, serde bạn cần thêm 4 công cụ mà Java không có hoặc có rất khác.</p>

    <p><strong>1. Associated type vs tham số generic</strong></p>
    <table>
      <tr><th></th><th>Generic param <code>trait From&lt;T&gt;</code></th><th>Associated type <code>trait Iterator { type Item; }</code></th></tr>
      <tr><td>Một kiểu impl được bao nhiêu lần?</td><td>Nhiều: <code>impl From&lt;u8&gt;</code>, <code>impl From&lt;&amp;str&gt;</code>...</td><td><strong>Một</strong>: mỗi iterator chỉ có đúng một Item</td></tr>
      <tr><td>Ai chọn kiểu?</td><td>Người gọi (hoặc suy luận)</td><td>Người viết impl</td></tr>
      <tr><td>Bound khi dùng</td><td><code>T: From&lt;X&gt;</code></td><td><code>I: Iterator&lt;Item = u32&gt;</code></td></tr>
    </table>
    <p>Quy tắc chọn: "với một kiểu cài đặt, có nhiều hơn một lựa chọn hợp lý không?" Có → generic. Không → associated type (API gọn hơn, suy luận tốt hơn).
    <code>tower::Service&lt;Request&gt;</code> dùng cả hai: Request là generic (một service có thể nhận nhiều loại request), còn <code>Response</code>, <code>Error</code>, <code>Future</code> là associated type.</p>

    <p><strong>2. Supertrait & default method</strong>: <code>trait Repo: Send + Sync</code> nghĩa là ai impl Repo cũng phải Send + Sync — giống <code>interface A extends B</code>.
    Default method gọi được method khác của trait, cho phép "template method" không cần abstract class.</p>

    <p><strong>3. Blanket impl — impl cho mọi T thoả điều kiện</strong></p>
    <p><code>impl&lt;T: Display&gt; ToString for T</code> trong std: mọi kiểu Display tự có <code>.to_string()</code>. <code>impl&lt;T, U: From&lt;T&gt;&gt; Into&lt;U&gt; for T</code>: bạn impl From là có Into miễn phí.
    Java không làm được điều này (không thể bắt mọi class implement Comparable tự có thêm interface khác). Cái giá: blanket impl "chiếm chỗ" — sau khi có
    <code>impl&lt;T: Display&gt; Summary for T</code>, bạn không thể impl Summary riêng cho một kiểu Display nữa (trùng lặp, lỗi <em>conflicting implementations</em>).</p>

    <p><strong>4. Orphan rule & newtype</strong></p>
    <ul>
      <li>Bạn chỉ được viết <code>impl Trait for Type</code> nếu <strong>trait hoặc type</strong> thuộc crate của bạn. Không được <code>impl Display for Vec&lt;User&gt;</code> (cả hai đều của std).</li>
      <li>Lý do: nếu hai crate cùng impl một cặp như vậy, compiler không biết chọn cái nào (coherence).</li>
      <li>Cách vượt: <strong>newtype</strong> <code>struct Users(Vec&lt;User&gt;);</code> — zero-cost, và là nơi tốt để gắn invariant (vd <code>struct Email(String)</code> chỉ tạo được qua hàm validate).</li>
    </ul>

    <p><strong>5. Extension trait</strong> — thêm method cho kiểu người khác (giống Kotlin extension function):
    định nghĩa <code>trait ResultExt</code> của bạn rồi impl cho <code>Result&lt;T, E&gt;</code>. Hợp lệ vì trait là của bạn. <code>futures::StreamExt</code>, <code>tower::ServiceExt</code>,
    <code>anyhow::Context</code> đều là extension trait — đó là lý do phải <code>use</code> chúng thì method mới hiện ra.</p>

    <div class="callout"><p>💡 "Method không tồn tại" dù docs có ghi → gần như luôn là quên <code>use</code> extension trait (vd <code>use futures::StreamExt;</code>, <code>use tower::ServiceExt;</code>).
    Trong Java method nằm trong class; trong Rust method nằm trong trait và chỉ nhìn thấy khi trait ở trong scope.</p></div>
  `,

  codeTabs: [
    { id: "assoc", label: "① Associated type", lines: [
      "pub trait Repository: Send + Sync {        // supertrait",
      "    type Entity;",
      "    type Id;",
      "    async fn find(&self, id: Self::Id) -> Option<Self::Entity>;",
      "}",
      "",
      "struct PgUserRepo { pool: sqlx::PgPool }",
      "impl Repository for PgUserRepo {",
      "    type Entity = User;",
      "    type Id = i64;",
      "    async fn find(&self, id: i64) -> Option<User> { todo!() }",
      "}",
      "",
      "fn ids<R: Repository<Id = i64>>(r: &R) { /* ràng buộc theo associated type */ }"
    ]},
    { id: "blanket", label: "② Blanket impl", lines: [
      "// std (rút gọn):",
      "impl<T: fmt::Display + ?Sized> ToString for T { /* ... */ }",
      "impl<T, U: From<T>> Into<U> for T { fn into(self) -> U { U::from(self) } }",
      "",
      "// của bạn:",
      "pub trait Describe { fn describe(&self) -> String; }",
      "impl<T: fmt::Debug> Describe for T {",
      "    fn describe(&self) -> String { format!(\"<{:?}>\", self) }",
      "}",
      "// impl Describe for User {}   // LỖI: conflicting implementations",
      "//                              // (User: Debug đã được phủ bởi blanket impl)"
    ]},
    { id: "orphan", label: "③ Orphan & newtype", lines: [
      "// impl fmt::Display for Vec<User> {}   // LỖI E0117: only traits defined in",
      "//                                        // the current crate can be implemented",
      "//                                        // for types defined outside of the crate",
      "pub struct Users(pub Vec<User>);          // newtype: zero-cost",
      "impl fmt::Display for Users {",
      "    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {",
      "        write!(f, \"{} users\", self.0.len())",
      "    }",
      "}",
      "",
      "pub struct Email(String);                 // invariant: luôn hợp lệ",
      "impl Email {",
      "    pub fn parse(s: &str) -> Result<Self, String> {",
      "        if s.contains('@') { Ok(Email(s.to_lowercase())) } else { Err(s.into()) }",
      "    }",
      "}"
    ]},
    { id: "ext", label: "④ Extension trait", lines: [
      "pub trait ResultExt<T> {",
      "    fn log_err(self, what: &str) -> Option<T>;",
      "}",
      "impl<T, E: fmt::Display> ResultExt<T> for Result<T, E> {",
      "    fn log_err(self, what: &str) -> Option<T> {",
      "        self.map_err(|e| tracing::warn!(%e, \"{what} failed\")).ok()",
      "    }",
      "}",
      "",
      "use crate::ResultExt;                      // phải use mới thấy method",
      "let cfg = std::fs::read_to_string(\"a.toml\").log_err(\"read config\");"
    ]},
    { id: "java", label: "⑤ Java đối chiếu", lines: [
      "// Java: interface Iterator<E> — E là generic, class có thể",
      "//   implements Iterator<String>, nhưng KHÔNG implements thêm Iterator<Integer>",
      "//   (type erasure) -> thực chất Java 'mô phỏng' associated type bằng generic",
      "",
      "// Java không có blanket impl: không viết được",
      "//   'mọi class implements Comparable thì tự implements Sortable'",
      "",
      "// Kotlin extension fun ~ Rust extension trait",
      "fun String.slug() = lowercase().replace(' ', '-')"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="tr"><div class="nl">📜 Trait của bạn</div><div class="ns">Describe, ResultExt</div></div>
      <div class="node" id="ty"><div class="nl">🧱 Type của bạn</div><div class="ns">User, Email, Users</div></div>
    </div>
    <div class="arrow" id="a1">↓ impl hợp lệ nếu ít nhất một bên là của bạn</div>
    <div class="node" id="ok"><div class="nl">✅ impl Trait for Type</div><div class="ns">coherence đảm bảo chỉ có một impl</div></div>
    <div class="arrow" id="a2">↓ cả hai đều từ crate ngoài?</div>
    <div class="row">
      <div class="node" id="bad"><div class="nl">⛔ Orphan rule</div><div class="ns">Display for Vec&lt;User&gt;</div></div>
      <div class="node" id="nt"><div class="nl">🎁 Newtype</div><div class="ns">struct Users(Vec&lt;User&gt;)</div></div>
    </div>
    <div class="node" id="bl"><div class="nl">🌐 Blanket impl</div><div class="ns">impl&lt;T: Debug&gt; Describe for T</div></div>
  `,
  steps: [
    { title: "1 · Associated type: một impl, một kiểu", tab: "assoc", highlight: [2, 3, 9, 10, 14], on: ["tr", "ty"],
      desc: "Mỗi repo chỉ có một Entity, một Id → associated type. Người dùng ràng buộc bằng <code>Repository&lt;Id = i64&gt;</code>." },
    { title: "2 · Supertrait", tab: "assoc", highlight: [1], on: ["tr"],
      desc: "<code>Repository: Send + Sync</code> bắt mọi impl phải an toàn đa luồng — cần khi đặt repo vào state của axum." },
    { title: "3 · Blanket impl phủ cả một họ kiểu", tab: "blanket", highlight: [2, 3, 7, 8, 10], on: ["bl"],
      desc: "Impl From là có Into; Debug là có Describe. Đổi lại, không impl riêng được cho kiểu đã bị phủ." },
    { title: "4 · Orphan rule", tab: "orphan", highlight: [1, 2, 3], on: ["a2", "bad"],
      desc: "Display và Vec đều của std → không được impl. Nếu cho phép, hai crate có thể impl khác nhau và compiler không biết chọn." },
    { title: "5 · Newtype vượt orphan + giữ invariant", tab: "orphan", highlight: [4, 5, 11, 13, 14], on: ["nt", "a1", "ok"],
      desc: "<code>Users</code> là type của bạn nên impl được. <code>Email</code> chỉ tạo qua <code>parse</code> → mọi chỗ nhận Email khỏi phải validate lại." },
    { title: "6 · Extension trait", tab: "ext", highlight: [1, 4, 10, 11], on: ["tr", "ok"],
      desc: "Trait của bạn impl cho Result của std → hợp lệ. Phải <code>use</code> trait thì method mới xuất hiện." }
  ],

  quiz: [
    { q: "Khi nào nên dùng associated type thay vì tham số generic của trait?", options: [
        "Khi mỗi kiểu cài đặt chỉ có đúng một lựa chọn hợp lý cho kiểu đó",
        "Khi muốn một kiểu impl trait nhiều lần với các kiểu khác nhau",
        "Luôn luôn",
        "Chỉ khi trait có async fn"
      ], correct: 0, explanation: "Iterator::Item: một iterator chỉ sinh một loại phần tử. From<T>: một kiểu có thể được tạo từ nhiều nguồn." },
    { q: "tower::Service<Request> để Request là generic vì?", options: [
        "Cho vui",
        "Một service có thể impl Service cho nhiều loại request khác nhau",
        "Associated type không hỗ trợ async",
        "Để tương thích Java"
      ], correct: 1, explanation: "Response/Error/Future là associated type vì phụ thuộc vào từng impl cụ thể." },
    { q: "impl<T: Display> ToString for T là ví dụ của?", options: [
        "Orphan rule", "Blanket impl", "Newtype", "Trait object"
      ], correct: 1, explanation: "Impl cho mọi T thoả bound." },
    { q: "Vì sao không viết được impl Display for Vec<User> trong crate của bạn?", options: [
        "Vec không impl Display được",
        "Orphan rule: trait và type đều thuộc crate khác",
        "User chưa derive Debug",
        "Thiếu lifetime"
      ], correct: 1, explanation: "Ít nhất một trong trait hoặc type phải là local." },
    { q: "Cách chuẩn để vượt orphan rule?", options: [
        "Dùng unsafe impl",
        "Bọc kiểu ngoài trong newtype của bạn",
        "Fork thư viện std",
        "Dùng macro"
      ], correct: 1, explanation: "struct Users(Vec<User>) là type local, zero-cost." },
    { q: "Sau khi có impl<T: Debug> Describe for T, viết thêm impl Describe for User (User: Debug) sẽ?", options: [
        "Ghi đè blanket impl",
        "Lỗi conflicting implementations",
        "Được chọn ưu tiên",
        "Cảnh báo nhưng vẫn chạy"
      ], correct: 1, explanation: "Rust stable không có specialization; hai impl chồng nhau bị từ chối." },
    { q: "Gọi stream.next().await báo 'no method named next'. Nguyên nhân thường gặp?", options: [
        "Stream không hỗ trợ next",
        "Chưa use futures::StreamExt (extension trait)",
        "Thiếu #[tokio::main]",
        "Phải dùng .poll()"
      ], correct: 1, explanation: "Method của extension trait chỉ hiện khi trait nằm trong scope." },
    { q: "trait Repository: Send + Sync có ý nghĩa gì?", options: [
        "Repository tự động thread-safe",
        "Mọi kiểu impl Repository bắt buộc cũng phải Send + Sync",
        "Repository chỉ dùng trong một thread",
        "Không có ý nghĩa"
      ], correct: 1, explanation: "Supertrait là điều kiện bắt buộc với người impl, giống interface extends." },
    { q: "Lợi ích ngoài orphan rule của newtype struct Email(String) với constructor parse?", options: [
        "Tốn thêm bộ nhớ nhưng đẹp",
        "Mã hoá invariant vào kiểu: có Email là chắc chắn đã validate",
        "Tự động serialize",
        "Nhanh hơn String"
      ], correct: 1, explanation: "Parse, don't validate — kiểu mang theo bằng chứng." },
    { q: "Ràng buộc 'iterator sinh ra u32' viết thế nào?", options: [
        "I: Iterator<u32>",
        "I: Iterator<Item = u32>",
        "I: Iterator + u32",
        "I::Item: u32"
      ], correct: 1, explanation: "Cú pháp associated type binding." }
  ]
});
