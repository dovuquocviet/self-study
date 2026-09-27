window.LESSONS.push({
  id: "20",
  phase: "5", phaseName: "Thực chiến backend",
  title: "Test với cargo test — unit, integration, doc test, async test",
  subtitle: "#[test] · #[cfg(test)] mod tests · assert! · #[should_panic] · tests/ · doc test · #[tokio::test] · test handler axum",

  theory: `
    <p>Không cần JUnit hay Surefire: test framework nằm sẵn trong ngôn ngữ và cargo. <code>cargo test</code> biên dịch một binary test riêng, chạy các test <strong>song song</strong> (mỗi test một thread).</p>

    <table>
      <tr><th>Loại</th><th>Đặt ở đâu</th><th>Thấy được gì</th><th>Java tương tự</th></tr>
      <tr><td><strong>Unit test</strong></td><td>Cùng file code, trong <code>#[cfg(test)] mod tests</code></td><td>Cả hàm private (qua <code>use super::*</code>)</td><td>JUnit trong src/test cùng package</td></tr>
      <tr><td><strong>Integration test</strong></td><td>Thư mục <code>tests/*.rs</code>, mỗi file là một crate riêng</td><td>Chỉ API <code>pub</code> của lib crate</td><td>Test module riêng / *IT.java</td></tr>
      <tr><td><strong>Doc test</strong></td><td>Khối code trong comment <code>///</code></td><td>API pub</td><td>(không có) — tài liệu luôn chạy được</td></tr>
    </table>

    <p><code>#[cfg(test)]</code> = chỉ biên dịch khi chạy test, không vào binary release. Macro kiểm tra: <code>assert!(cond)</code>, <code>assert_eq!(left, right)</code>, <code>assert_ne!</code>,
    đều nhận thêm thông điệp định dạng. Kiểu so sánh cần <code>PartialEq + Debug</code> (để in khi lệch).</p>

    <p><strong>Test lỗi</strong>: <code>#[should_panic(expected = "...")]</code> cho hàm panic; tốt hơn là test trả <code>Result&lt;(), E&gt;</code> để dùng <code>?</code> bên trong,
    và <code>assert!(matches!(r, Err(OrderError::NotFound(_))))</code> để kiểm tra đúng loại lỗi.</p>

    <p><strong>Async test</strong>: <code>#[tokio::test]</code> dựng runtime riêng cho từng test (mặc định single-thread; <code>flavor = "multi_thread"</code> khi cần).
    <strong>Test handler axum không cần mở port</strong>: <code>Router</code> là một tower <code>Service</code>, gọi thẳng <code>app.oneshot(request)</code> (trait <code>tower::ServiceExt</code>) — giống MockMvc.
    Với sqlx có <code>#[sqlx::test]</code>: tạo database tạm cho mỗi test, chạy migration, xoá sau khi xong.</p>

    <p><strong>Lệnh hay dùng</strong>: <code>cargo test</code> (tất cả) · <code>cargo test total</code> (lọc theo tên chứa "total") · <code>cargo test -- --nocapture</code> (hiện println) ·
    <code>cargo test -- --test-threads=1</code> (chạy tuần tự khi test dùng chung tài nguyên) · <code>#[ignore]</code> + <code>cargo test -- --ignored</code> cho test chậm.</p>

    <div class="callout"><p>💡 Mock trong Rust: không có Mockito dựa reflection. Cách tự nhiên là thiết kế theo trait (bài 11–12): code nhận <code>impl OrderRepo</code> hoặc <code>Arc&lt;dyn OrderRepo&gt;</code>,
    test truyền implementation in-memory. Crate <code>mockall</code> sinh mock từ trait nếu cần.</p></div>
  `,

  codeTabs: [
    { id: "unit", label: "Unit test", lines: [
      "// src/pricing.rs",
      "pub fn total(items: &[(u64, u32)]) -> u64 {",
      "    items.iter().map(|(price, qty)| price * *qty as u64).sum()",
      "}",
      "fn vat(amount: u64) -> u64 { amount / 10 }       // private",
      "",
      "#[cfg(test)]                                     // chỉ biên dịch khi test",
      "mod tests {",
      "    use super::*;                                // thấy cả vat() private",
      "",
      "    #[test]",
      "    fn total_of_two_items() {",
      "        assert_eq!(total(&[(100, 2), (50, 1)]), 250);",
      "    }",
      "",
      "    #[test]",
      "    fn vat_is_ten_percent() {",
      "        assert_eq!(vat(1_000), 100, \"VAT phải là 10%\");",
      "    }",
      "}"
    ]},
    { id: "err", label: "Test lỗi", lines: [
      "#[test]",
      "#[should_panic(expected = \"quá tải\")]",
      "fn panics_when_overweight() {",
      "    shipping_fee(999);",
      "}",
      "",
      "#[test]",
      "fn parse_rejects_negative() -> Result<(), PriceError> {",
      "    assert_eq!(parse_price(\"100\")?, 100);        // ? dùng được trong test",
      "    let r = parse_price(\"-5\");",
      "    assert!(matches!(r, Err(PriceError::Negative(-5))));",
      "    Ok(())",
      "}",
      "",
      "#[test]",
      "#[ignore]                                        // chạy bằng: cargo test -- --ignored",
      "fn slow_report() { /* ... */ }"
    ]},
    { id: "integ", label: "Integration & doc", lines: [
      "// tests/pricing_it.rs  (crate riêng, chỉ thấy API pub)",
      "use order_svc::pricing::total;",
      "",
      "#[test]",
      "fn empty_cart_is_zero() {",
      "    assert_eq!(total(&[]), 0);",
      "}",
      "",
      "// src/pricing.rs — doc test: ví dụ trong tài liệu được chạy thật",
      "/// Tính tổng tiền giỏ hàng.",
      "///",
      "/// ```",
      "/// assert_eq!(order_svc::pricing::total(&[(10, 3)]), 30);",
      "/// ```",
      "pub fn total(items: &[(u64, u32)]) -> u64 { /* ... */ 0 }"
    ]},
    { id: "axum", label: "Async & axum", lines: [
      "// [dev-dependencies] tower = { version = \"0.5\", features = [\"util\"] }",
      "use axum::{body::Body, http::{Request, StatusCode}};",
      "use tower::ServiceExt;                           // cho .oneshot()",
      "",
      "#[tokio::test]",
      "async fn health_returns_200() {",
      "    let app = build_router(test_state());        // Router thật, state giả",
      "    let res = app",
      "        .oneshot(Request::get(\"/health\").body(Body::empty()).unwrap())",
      "        .await",
      "        .unwrap();",
      "    assert_eq!(res.status(), StatusCode::OK);     // không mở port nào",
      "}",
      "",
      "#[sqlx::test]                                    // DB tạm + migration cho mỗi test",
      "async fn insert_product(pool: sqlx::PgPool) {",
      "    let id = repo::insert(&pool, \"Áo\", 150_000).await.unwrap();",
      "    assert!(id > 0);",
      "}"
    ]},
    { id: "cmp", label: "Java ↔ Rust", lines: [
      "// Java (JUnit 5)                          // Rust",
      "// @Test void totalOfTwo() {...}           #[test] fn total_of_two() {...}",
      "// assertEquals(250, total(..));           assert_eq!(total(..), 250);",
      "// assertThrows(Ex.class, () -> ..)        #[should_panic] / assert!(matches!(r, Err(..)))",
      "// @Disabled                               #[ignore]",
      "// MockMvc.perform(get(\"/health\"))       app.oneshot(Request::get(\"/health\")...)",
      "// @DataJpaTest + Testcontainers           #[sqlx::test]",
      "// mvn test -Dtest=Pricing*                cargo test pricing"
    ]}
  ],

  stageHtml: `
    <div class="node" id="cmd"><div class="nl">▶️ cargo test</div><div class="ns">build binary test (cfg(test))</div></div>
    <div class="arrow" id="a1">↓ thu thập các #[test]</div>
    <div class="row">
      <div class="node" id="u"><div class="nl">🔬 Unit</div><div class="ns">mod tests, thấy private</div></div>
      <div class="node" id="i"><div class="nl">🧩 Integration</div><div class="ns">tests/*.rs, chỉ pub</div></div>
      <div class="node" id="d"><div class="nl">📖 Doc test</div><div class="ns">ví dụ trong ///</div></div>
    </div>
    <div class="arrow" id="a2">↓ chạy song song</div>
    <div class="node" id="res"><div class="nl">📊 test result: ok. N passed; 0 failed</div><div class="ns">lỗi → in left/right khác nhau</div></div>
  `,
  steps: [
    { title: "1 · Unit test cạnh code", tab: "unit", highlight: [7, 8, 9, 11, 12, 13], on: ["cmd", "a1", "u"],
      desc: "mod tests nằm cùng file, chỉ biên dịch khi test. use super::* cho phép test cả hàm private." },
    { title: "2 · assert_eq! kèm thông điệp", tab: "unit", highlight: [13, 18], on: ["res"],
      desc: "Khi lệch, in ra left và right (cần Debug). Tham số thứ ba là thông điệp tuỳ chọn." },
    { title: "3 · Test lỗi", tab: "err", highlight: [2, 8, 9, 11, 16], on: ["u"],
      desc: "should_panic cho panic; test trả Result để dùng ?; matches! để khẳng định đúng variant lỗi." },
    { title: "4 · Integration & doc test", tab: "integ", highlight: [1, 2, 12, 13, 14], on: ["i", "d"],
      desc: "tests/ là crate ngoài, chỉ dùng API pub. Ví dụ trong doc comment được biên dịch và chạy — tài liệu không bao giờ lỗi thời." },
    { title: "5 · Async & HTTP không cần port", tab: "axum", highlight: [3, 5, 9, 12, 15], on: ["a2", "res"],
      desc: "#[tokio::test] tạo runtime cho test. Router là tower Service → oneshot như MockMvc. #[sqlx::test] tạo DB tạm." }
  ],

  quiz: [
    { q: "<code>#[cfg(test)]</code> trên <code>mod tests</code> có tác dụng gì?", options: [
        "Chạy test khi build release",
        "Module chỉ được biên dịch khi chạy test, không vào binary thường",
        "Đánh dấu hàm test",
        "Tắt cảnh báo"
      ], correct: 1, explanation: "#[test] mới là đánh dấu từng hàm test." },
    { q: "Unit test trong <code>mod tests</code> có gọi được hàm private của module cha không?", options: [
        "Không", "Có, qua use super::*", "Chỉ khi pub(crate)", "Chỉ với unsafe"
      ], correct: 1, explanation: "Private theo module; tests là module con nên thấy được." },
    { q: "Integration test trong thư mục <code>tests/</code> thấy được gì?", options: [
        "Mọi hàm", "Chỉ API pub của lib crate", "Chỉ main.rs", "Không gì"
      ], correct: 1, explanation: "Mỗi file tests/*.rs là một crate riêng dùng lib như dependency." },
    { q: "Mặc định <code>cargo test</code> chạy các test thế nào?", options: [
        "Tuần tự", "Song song trên nhiều thread", "Mỗi test một process", "Ngẫu nhiên bỏ qua"
      ], correct: 1, explanation: "Dùng -- --test-threads=1 nếu test chia sẻ tài nguyên." },
    { q: "Doc test là gì?", options: [
        "Test cho file README",
        "Khối code trong comment /// được biên dịch và chạy như test",
        "Test sinh tài liệu",
        "Kiểm tra chính tả"
      ], correct: 1, explanation: "Đảm bảo ví dụ trong tài liệu luôn đúng." },
    { q: "Muốn thấy output println! khi test pass?", options: [
        "cargo test --verbose", "cargo test -- --nocapture", "cargo test --release", "Không thể"
      ], correct: 1, explanation: "Mặc định output của test pass bị ẩn." },
    { q: "Test hàm async dùng attribute nào?", options: [
        "#[test] async fn", "#[tokio::test]", "#[async_test]", "#[test(async)]"
      ], correct: 1, explanation: "#[test] thường không chạy được async fn." },
    { q: "Test handler axum không cần mở cổng mạng bằng cách?", options: [
        "Dùng curl",
        "Gọi router.oneshot(request) nhờ tower::ServiceExt",
        "Mock hyper",
        "Không thể"
      ], correct: 1, explanation: "Router là một tower Service." },
    { q: "Cách tự nhiên để mock repository trong Rust?", options: [
        "Reflection như Mockito",
        "Thiết kế theo trait; test truyền implementation in-memory (hoặc dùng mockall)",
        "Sửa bytecode",
        "Không mock được"
      ], correct: 1, explanation: "Rust không có reflection runtime." }
  ]
});
