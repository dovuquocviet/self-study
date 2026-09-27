window.LESSONS.push({
  id: "08",
  phase: "0", phaseName: "Swift cho dev Java",
  title: "Error handling: throws, try, do-catch, Result, defer",
  subtitle: "Lỗi là giá trị Error, không có stack unwinding đắt · try? / try! · typed throws · rethrows",

  theory: `
    <p>Nhìn thì giống exception Java, nhưng cơ chế khác:</p>
    <ul>
      <li>Lỗi là giá trị của kiểu conform protocol <code>Error</code> — thường là <code>enum</code>. Không cần kế thừa <code>Exception</code>, không tự thu stack trace.</li>
      <li>Hàm có thể ném phải khai báo <code>throws</code>; người gọi <strong>bắt buộc</strong> viết <code>try</code> trước lời gọi. Nhìn code là biết dòng nào có thể thoát sớm — Java checked exception gần giống, nhưng không có dấu hiệu tại chỗ gọi.</li>
      <li>Về cơ chế, "ném lỗi" chỉ là một kiểu <strong>return đặc biệt</strong> (lỗi đi qua một thanh ghi riêng, caller kiểm tra ngay sau lời gọi) — không có stack unwinding tốn kém như exception C++/Java. Nên ném lỗi trong Swift rẻ.</li>
      <li>Crash như <code>!</code> trên nil, index ngoài mảng, tràn số <strong>không phải</strong> Error và <strong>không bắt được</strong>. Không có tương đương <code>catch (RuntimeException e)</code>.</li>
    </ul>

    <p><strong>Ba dạng try</strong></p>
    <table>
      <tr><th>Cú pháp</th><th>Khi lỗi</th><th>Dùng khi</th></tr>
      <tr><td><code>try f()</code></td><td>Ném tiếp lên (hàm hiện tại phải throws hoặc nằm trong do-catch)</td><td>Mặc định</td></tr>
      <tr><td><code>try? f()</code></td><td>Trả <code>nil</code>, nuốt lỗi</td><td>Chỉ cần biết thành công hay không</td></tr>
      <tr><td><code>try! f()</code></td><td>Crash</td><td>Chắc chắn không lỗi (hiếm)</td></tr>
    </table>

    <p><strong>do-catch</strong> có pattern matching: <code>catch CheckoutError.outOfStock(let sku)</code>, <code>catch let e as URLError</code>, và <code>catch</code> trơn (biến <code>error</code> có sẵn). Mặc định lỗi ném ra có kiểu <code>any Error</code>. Swift 6 thêm <strong>typed throws</strong>: <code>func pay() throws(PaymentError)</code> — catch nhận đúng <code>PaymentError</code>, switch vét hết được. Apple khuyên chỉ dùng typed throws khi thật cần (module nội bộ, code nhúng); API công khai vẫn nên dùng <code>throws</code> thường để dễ tiến hoá.</p>

    <p><strong>Result&lt;Success, Failure&gt;</strong> là enum <code>.success</code>/<code>.failure</code> — hữu ích khi cần lưu kết quả hoặc truyền qua callback. Với async/await (bài 10) thì <code>throws</code> thường đủ; chuyển đổi: <code>Result { try f() }</code> và <code>try result.get()</code>.</p>

    <p><strong>defer</strong> chạy khi rời phạm vi (return, throw, hết khối) — thay cho <code>finally</code>, đặt ngay cạnh lệnh mở tài nguyên. Nhiều defer chạy theo thứ tự ngược. <strong>rethrows</strong>: hàm chỉ ném nếu closure truyền vào ném (như <code>map</code>) — gọi với closure không ném thì không cần <code>try</code>.</p>

    <div class="callout"><p>💡 Khi sang Rust bạn sẽ gặp <code>Result&lt;T, E&gt;</code> + toán tử <code>?</code> — gần như cùng triết lý: lỗi là giá trị, đường lỗi hiện rõ trong code. Swift chỉ giấu bớt cú pháp bằng <code>throws</code>/<code>try</code>.</p></div>
  `,

  codeTabs: [
    { id: "define", label: "Khai báo & ném", lines: [
      "enum CheckoutError: Error {",
      "    case emptyCart",
      "    case outOfStock(sku: String)",
      "    case paymentDeclined(code: Int)",
      "}",
      "",
      "func placeOrder(_ cart: Cart) throws -> Order {",
      "    guard !cart.items.isEmpty else { throw CheckoutError.emptyCart }",
      "    for item in cart.items where item.stock == 0 {",
      "        throw CheckoutError.outOfStock(sku: item.sku)",
      "    }",
      "    return Order(items: cart.items)",
      "}"
    ]},
    { id: "catch", label: "do-catch", lines: [
      "do {",
      "    let order = try placeOrder(cart)",
      "    show(order)",
      "} catch CheckoutError.outOfStock(let sku) {",
      "    alert(\"Hết hàng: \\(sku)\")",
      "} catch let e as URLError where e.code == .notConnectedToInternet {",
      "    alert(\"Mất mạng\")",
      "} catch {",
      "    alert(\"Lỗi: \\(error)\")   // error: any Error",
      "}",
      "",
      "let maybe = try? placeOrder(cart)   // Order? — lỗi thành nil"
    ]},
    { id: "typed", label: "Typed throws & Result", lines: [
      "func charge(_ amount: Decimal) throws(CheckoutError) -> String {",
      "    guard amount > 0 else { throw CheckoutError.paymentDeclined(code: 400) }",
      "    return \"ch_1\"",
      "}",
      "",
      "do throws(CheckoutError) { _ = try charge(0) }",
      "catch { print(error) }          // error có kiểu CheckoutError",
      "",
      "let r: Result<Order, Error> = Result { try placeOrder(cart) }",
      "switch r { case .success(let o): show(o); case .failure(let e): log(e) }"
    ]},
    { id: "defer", label: "defer", lines: [
      "func importFile(_ url: URL) throws -> Int {",
      "    let handle = try FileHandle(forReadingFrom: url)",
      "    defer { try? handle.close() }        // luôn chạy khi rời hàm",
      "    guard let data = try handle.readToEnd() else { return 0 }",
      "    return try parse(data).count           // ném hay return đều đóng file",
      "}",
      "",
      "// Java: try (var in = Files.newInputStream(p)) { ... }  // try-with-resources"
    ]}
  ],

  stageHtml: `
    <div class="node" id="call"><div class="nl">try placeOrder(cart)</div><div class="ns">dấu try đánh dấu điểm có thể thoát</div></div>
    <div class="row">
      <div class="node" id="ok"><div class="nl">return Order</div><div class="ns">đường thường</div></div>
      <div class="node" id="err"><div class="nl">throw CheckoutError</div><div class="ns">return đặc biệt, không unwinding đắt</div></div>
    </div>
    <div class="arrow" id="a1">↓ caller kiểm tra ngay sau lời gọi</div>
    <div class="row">
      <div class="node" id="c1"><div class="nl">catch .outOfStock(let sku)</div><div class="ns">pattern matching</div></div>
      <div class="node" id="c2"><div class="nl">try? → nil</div><div class="ns">nuốt lỗi</div></div>
      <div class="node" id="c3"><div class="nl">defer</div><div class="ns">dọn dẹp luôn chạy</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Lỗi là enum", tab: "define", highlight: [1, 2, 3, 4], on: ["err"],
      desc: "Conform <code>Error</code> là đủ; associated value mang thông tin chi tiết." },
    { title: "2 · throws + throw", tab: "define", highlight: [7, 8, 10, 12], on: ["call", "ok", "err"],
      desc: "Chữ ký <code>throws</code> báo hàm có thể thất bại. <code>guard ... else { throw }</code> là mẫu phổ biến." },
    { title: "3 · do-catch có pattern", tab: "catch", highlight: [1, 2, 4, 6, 8, 9], on: ["a1", "c1"],
      desc: "Bắt theo case enum, theo kiểu (<code>as URLError</code>) kèm <code>where</code>. Catch cuối cùng bắt mọi thứ, biến <code>error</code> có sẵn." },
    { title: "4 · try? biến lỗi thành nil", tab: "catch", highlight: [12], on: ["c2"],
      desc: "Tiện nhưng mất thông tin lỗi — đừng dùng để che lỗi nghiệp vụ." },
    { title: "5 · Typed throws và Result", tab: "typed", highlight: [1, 2, 7, 9, 10], on: ["err"],
      desc: "<code>throws(CheckoutError)</code> (Swift 6) cho catch biết chính xác kiểu. <code>Result</code> lưu kết quả thành giá trị." },
    { title: "6 · defer thay finally", tab: "defer", highlight: [2, 3, 5, 8], on: ["c3"],
      desc: "Đặt dọn dẹp ngay cạnh chỗ mở tài nguyên; chạy dù return hay throw." }
  ],

  quiz: [
    { q: "Kiểu lỗi trong Swift cần gì?", options: [
        "Kế thừa class Exception", "Conform protocol Error (thường là enum)", "Có stack trace", "Là class"
      ], correct: 1, explanation: "Bất kỳ kiểu nào conform Error đều ném được." },
    { q: "Gọi một hàm throws mà không viết try thì?", options: [
        "Chạy bình thường", "Lỗi biên dịch", "Cảnh báo", "Crash nếu có lỗi"
      ], correct: 1, explanation: "try bắt buộc tại mỗi điểm gọi có thể ném." },
    { q: "try? placeOrder(cart) khi hàm ném lỗi trả về?", options: [
        "Crash", "nil", "Ném tiếp", "Order rỗng"
      ], correct: 1, explanation: "Kết quả có kiểu Order?." },
    { q: "Truy cập array[10] khi mảng có 3 phần tử, bọc trong do-catch thì?", options: [
        "catch bắt được", "Vẫn crash — lỗi runtime trap không phải Error", "Trả nil", "Ném IndexOutOfBounds"
      ], correct: 1, explanation: "Swift không có cơ chế bắt trap như RuntimeException." },
    { q: "Vì sao ném lỗi trong Swift rẻ hơn exception Java?", options: [
        "Không rẻ hơn",
        "Throw được cài như một kiểu return đặc biệt, caller kiểm tra ngay; không unwinding bảng và không thu stack trace",
        "Dùng goto",
        "Chạy trên thread khác"
      ], correct: 1, explanation: "Lỗi đi qua một thanh ghi riêng theo calling convention." },
    { q: "func charge() throws(CheckoutError) là tính năng gì?", options: [
        "Checked exception kiểu Java", "Typed throws (Swift 6)", "rethrows", "Macro"
      ], correct: 1, explanation: "catch nhận error có kiểu CheckoutError thay vì any Error." },
    { q: "defer tương đương gì trong Java?", options: [
        "catch", "finally / try-with-resources", "throw", "synchronized"
      ], correct: 1, explanation: "Khối defer chạy khi rời phạm vi dù bằng cách nào." },
    { q: "Nhiều khối defer trong cùng phạm vi chạy theo thứ tự?", options: [
        "Thứ tự khai báo", "Ngược thứ tự khai báo", "Ngẫu nhiên", "Chỉ chạy khối cuối"
      ], correct: 1, explanation: "Giống stack: khai báo sau chạy trước." },
    { q: "rethrows nghĩa là gì?", options: [
        "Luôn ném lại lỗi",
        "Hàm chỉ ném khi closure truyền vào ném; closure không ném thì gọi không cần try",
        "Bắt lỗi rồi bỏ qua",
        "Ném lỗi sang thread khác"
      ], correct: 1, explanation: "Ví dụ map, filter của thư viện chuẩn." }
  ]
});
