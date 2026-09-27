window.LESSONS.push({
  id: "07",
  phase: "0", phaseName: "Swift cho dev Java",
  title: "Closure: capture theo tham chiếu, @escaping, trailing closure",
  subtitle: "Khác lambda Java ở chỗ nào · capture list [x] · map/filter/reduce · non-escaping mặc định",

  theory: `
    <p>Closure Swift ≈ lambda Java, cú pháp <code>{ (x: Int) -&gt; Int in x * 2 }</code>. Có nhiều cách viết tắt: suy kiểu, return ngầm, tham số <code>$0</code>, <code>$1</code>, và <strong>trailing closure</strong> — closure cuối cùng được đặt ngoài ngoặc: <code>items.filter { $0.price &gt; 100 }</code>. SwiftUI dùng trailing closure ở khắp nơi (<code>VStack { ... }</code>).</p>

    <p><strong>Khác biệt cơ chế quan trọng nhất: capture</strong></p>
    <table>
      <tr><th></th><th>Lambda Java</th><th>Closure Swift</th></tr>
      <tr><td>Biến local bên ngoài</td><td>Phải <em>effectively final</em>; lambda nhận <strong>bản sao giá trị</strong></td><td>Capture <strong>chính biến đó</strong> (theo tham chiếu), đọc/ghi được</td></tr>
      <tr><td>Biến bị sửa sau khi tạo closure</td><td>Không xảy ra (bị cấm)</td><td>Closure thấy giá trị mới</td></tr>
      <tr><td>Muốn chụp giá trị tại thời điểm tạo</td><td>Mặc định</td><td>Dùng <strong>capture list</strong>: <code>{ [count] in ... }</code></td></tr>
    </table>
    <p>Khi closure capture một <code>var</code> local và sống lâu hơn hàm, Swift chuyển biến đó lên heap (boxing) để cả hai phía cùng thấy. Closure là <strong>reference type</strong> — nên có thể tạo retain cycle (bài 09).</p>

    <p><strong>@escaping</strong></p>
    <ul>
      <li>Tham số closure mặc định là <strong>non-escaping</strong>: chỉ được gọi trong lúc hàm đang chạy, không được lưu lại. Compiler nhờ đó tối ưu (có thể không cần cấp phát heap) và bạn không cần lo retain cycle.</li>
      <li>Nếu hàm lưu closure vào property hoặc gọi sau khi hàm return (callback, completion handler) → phải đánh dấu <code>@escaping</code>. Khi đó trong class, compiler bắt viết <code>self.</code> rõ ràng để bạn ý thức việc capture self.</li>
    </ul>

    <p><strong>Hàm bậc cao</strong>: <code>map</code>, <code>filter</code>, <code>reduce</code>, <code>compactMap</code> (map rồi bỏ nil), <code>flatMap</code>, <code>sorted(by:)</code>, <code>first(where:)</code>, <code>contains(where:)</code>. Trên <code>Array</code> chúng chạy ngay (eager) và trả mảng mới — khác Java Stream là lazy tới khi terminal op. Muốn lazy: <code>xs.lazy.map { ... }</code>.</p>

    <p>Hàm cũng là giá trị: truyền thẳng tên hàm <code>xs.map(String.init)</code>, key path làm hàm <code>products.map(&#92;.name)</code>.</p>

    <div class="callout"><p>💡 Trong JS/React Native, closure cũng capture theo tham chiếu — "stale closure" trong <code>useEffect</code> là cùng một hiện tượng. Swift giống JS ở điểm này, khác Java.</p></div>
  `,

  codeTabs: [
    { id: "syntax", label: "Cú pháp", lines: [
      "let prices: [Decimal] = [120, 45, 300]",
      "",
      "let a = prices.filter({ (p: Decimal) -> Bool in return p > 100 })",
      "let b = prices.filter { p in p > 100 }     // trailing, suy kiểu",
      "let c = prices.filter { $0 > 100 }         // tham số viết tắt",
      "",
      "let names = products",
      "    .filter { $0.inStock }",
      "    .sorted { $0.price < $1.price }",
      "    .map(\\.name)                            // key path làm hàm",
      "let ids = rawIds.compactMap { Int($0) }    // bỏ phần tử parse lỗi"
    ]},
    { id: "capture", label: "Capture", lines: [
      "var count = 0",
      "let increment = { count += 1 }     // capture chính biến count",
      "increment(); increment()",
      "print(count)                       // 2 — Java không cho sửa biến ngoài",
      "",
      "var discount = 10",
      "let byRef = { print(discount) }",
      "let byValue = { [discount] in print(discount) }  // chụp giá trị lúc tạo",
      "discount = 50",
      "byRef()     // 50",
      "byValue()   // 10"
    ]},
    { id: "escaping", label: "@escaping", lines: [
      "final class Downloader {",
      "    private var handlers: [(Data) -> Void] = []",
      "",
      "    func onDone(_ handler: @escaping (Data) -> Void) {",
      "        handlers.append(handler)          // lưu lại → phải @escaping",
      "    }",
      "",
      "    func each(_ body: (Data) -> Void) {",
      "        for d in cache { body(d) }         // gọi xong trong hàm → non-escaping",
      "    }",
      "}"
    ]},
    { id: "java", label: "So với Java", lines: [
      "int count = 0;",
      "Runnable inc = () -> count++;   // ❌ lỗi: phải effectively final",
      "",
      "List<String> names = products.stream()",
      "    .filter(Product::inStock)",
      "    .sorted(Comparator.comparing(Product::price))",
      "    .map(Product::name)",
      "    .toList();                  // lazy tới terminal op"
    ]}
  ],

  stageHtml: `
    <div class="node" id="var"><div class="nl">var discount = 10</div><div class="ns">biến local</div></div>
    <div class="row">
      <div class="node" id="ref"><div class="nl">{ print(discount) }</div><div class="ns">capture biến (box trên heap)</div></div>
      <div class="node" id="val"><div class="nl">{ [discount] in ... }</div><div class="ns">chụp giá trị 10</div></div>
    </div>
    <div class="arrow" id="a1">↓ discount = 50</div>
    <div class="row">
      <div class="node" id="r50"><div class="nl">in 50</div><div class="ns">thấy thay đổi</div></div>
      <div class="node" id="r10"><div class="nl">in 10</div><div class="ns">giá trị cũ</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Từ dài tới ngắn", tab: "syntax", highlight: [3, 4, 5], on: ["var"],
      desc: "Ba cách viết cùng một closure. Trailing closure + <code>$0</code> là phong cách phổ biến." },
    { title: "2 · Chuỗi hàm bậc cao", tab: "syntax", highlight: [7, 8, 9, 10, 11], on: ["var"],
      desc: "Trên Array chạy eager, mỗi bước tạo mảng mới. <code>compactMap</code> bỏ nil — rất hay dùng khi parse." },
    { title: "3 · Capture chính biến", tab: "capture", highlight: [1, 2, 3, 4], on: ["ref"],
      desc: "Closure sửa được <code>count</code> bên ngoài. Java cấm điều này." },
    { title: "4 · Capture list chụp giá trị", tab: "capture", highlight: [6, 7, 8, 9, 10, 11], on: ["val", "a1", "r50", "r10"],
      desc: "<code>[discount]</code> sao chép giá trị lúc tạo closure — giống hành vi mặc định của Java." },
    { title: "5 · Escaping vs non-escaping", tab: "escaping", highlight: [4, 5, 8, 9], on: ["ref"],
      desc: "Lưu closure để gọi sau → <code>@escaping</code>. Gọi xong trong hàm → mặc định non-escaping, rẻ và an toàn hơn." },
    { title: "6 · Đối chiếu Java", tab: "java", highlight: [2, 8], on: ["var"],
      desc: "Java: lambda không sửa biến ngoài; Stream lazy. Swift: closure sửa được; Array.map eager (dùng <code>.lazy</code> nếu cần)." }
  ],

  quiz: [
    { q: "Closure Swift capture biến local var bên ngoài thế nào?", options: [
        "Sao chép giá trị như Java",
        "Capture chính biến (theo tham chiếu); đọc/ghi được và thấy thay đổi",
        "Không cho capture",
        "Chỉ capture let"
      ], correct: 1, explanation: "Muốn chụp giá trị thì dùng capture list." },
    { q: "var d = 10; let f = { [d] in print(d) }; d = 50; f() in ra?", options: [
        "50", "10", "Lỗi biên dịch", "nil"
      ], correct: 1, explanation: "Capture list sao chép giá trị tại thời điểm tạo closure." },
    { q: "Khi nào phải đánh dấu tham số closure là @escaping?", options: [
        "Luôn luôn",
        "Khi closure được lưu lại hoặc gọi sau khi hàm đã return",
        "Khi closure có tham số",
        "Khi closure throws"
      ], correct: 1, explanation: "Mặc định tham số closure là non-escaping." },
    { q: "Lợi ích của non-escaping mặc định?", options: [
        "Closure chạy song song",
        "Compiler tối ưu được (có thể tránh cấp phát heap) và không lo retain cycle",
        "Cho phép throws",
        "Tự động async"
      ], correct: 1, explanation: "Closure không thoát khỏi hàm nên vòng đời rõ ràng." },
    { q: "rawIds.compactMap { Int($0) } với [\"1\", \"x\", \"3\"] cho?", options: [
        "[1, nil, 3]", "[1, 3]", "Crash", "[1, 0, 3]"
      ], correct: 1, explanation: "compactMap bỏ các kết quả nil." },
    { q: "products.map(\\.name) nghĩa là gì?", options: [
        "Lỗi cú pháp", "Key path \\.name được dùng như hàm Product -> String", "Lấy name của mảng", "Regex"
      ], correct: 1, explanation: "Key path expression tự chuyển thành closure (Swift 5.2+)." },
    { q: "Array.map trong Swift khác Stream.map của Java ở điểm nào?", options: [
        "Không khác",
        "Array.map chạy ngay (eager) và trả mảng mới; Stream lazy tới terminal op",
        "Array.map chạy song song",
        "Array.map chỉ dùng với Int"
      ], correct: 1, explanation: "Dùng .lazy để có hành vi lazy." },
    { q: "Closure trong Swift là value type hay reference type?", options: [
        "Value type", "Reference type — nên có thể gây retain cycle khi capture self", "Không phải kiểu", "Tuỳ nội dung"
      ], correct: 1, explanation: "Vì vậy có [weak self] (bài 09)." },
    { q: "Viết items.filter { $0.price > 100 } — $0 là gì?", options: [
        "Biến toàn cục", "Tham số thứ nhất của closure (viết tắt)", "Index", "self"
      ], correct: 1, explanation: "$0, $1... là shorthand argument names." }
  ]
});
