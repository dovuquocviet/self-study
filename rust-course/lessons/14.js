window.LESSONS.push({
  id: "14",
  phase: "3", phaseName: "Trừu tượng hoá",
  title: "Iterator & closure — Stream API không tốn phí",
  subtitle: "iter / iter_mut / into_iter · adapter lười · collect · closure bắt biến: Fn, FnMut, FnOnce · move",

  theory: `
    <p><strong>Iterator</strong> là trait chỉ có một method bắt buộc: <code>fn next(&amp;mut self) -&gt; Option&lt;Self::Item&gt;</code>. Trả <code>Some(x)</code> tới khi hết thì <code>None</code>.
    Mọi thứ khác (<code>map</code>, <code>filter</code>, <code>sum</code>...) là default method dựng trên <code>next</code>.</p>

    <table>
      <tr><th>Gọi</th><th>Item</th><th>Collection sau đó</th></tr>
      <tr><td><code>v.iter()</code> (hoặc <code>for x in &amp;v</code>)</td><td><code>&amp;T</code></td><td>Còn nguyên</td></tr>
      <tr><td><code>v.iter_mut()</code> (<code>for x in &amp;mut v</code>)</td><td><code>&amp;mut T</code></td><td>Còn, có thể đã bị sửa</td></tr>
      <tr><td><code>v.into_iter()</code> (<code>for x in v</code>)</td><td><code>T</code></td><td>Bị move — không dùng được nữa</td></tr>
    </table>

    <p><strong>Lười (lazy)</strong> như Java Stream: <code>map</code>, <code>filter</code>, <code>take</code>, <code>enumerate</code>, <code>zip</code>, <code>chain</code>, <code>flat_map</code>, <code>skip_while</code>… chỉ tạo adapter,
    không làm gì cho tới khi có <em>consumer</em>: <code>collect</code>, <code>sum</code>, <code>count</code>, <code>fold</code>, <code>for_each</code>, <code>find</code>, <code>any/all</code>, <code>min_by_key</code>…
    Compiler cảnh báo nếu tạo iterator mà không dùng. Khác Stream: không có overhead ảo (mỗi adapter là struct cụ thể, được inline), và tái sử dụng được nếu <code>clone()</code>.</p>

    <p><strong><code>collect()</code></strong> linh hoạt theo kiểu đích: <code>Vec&lt;_&gt;</code>, <code>HashMap&lt;_,_&gt;</code> (từ cặp tuple), <code>String</code>, <code>HashSet</code>…
    Đặc biệt: iterator của <code>Result&lt;T,E&gt;</code> collect thành <code>Result&lt;Vec&lt;T&gt;, E&gt;</code> — dừng ở lỗi đầu tiên. Rất hay dùng khi parse danh sách.</p>

    <p><strong>Closure</strong> <code>|x| x * 2</code> như lambda Java, nhưng <em>bắt biến</em> (capture) theo ownership, và compiler tự chọn trait:</p>
    <ul>
      <li><strong><code>Fn</code></strong>: chỉ đọc biến bắt được (<code>&amp;</code>). Gọi nhiều lần, song song được.</li>
      <li><strong><code>FnMut</code></strong>: sửa biến bắt được (<code>&amp;mut</code>). Gọi nhiều lần nhưng tuần tự. (Java cấm lambda sửa biến cục bộ — "effectively final"; Rust cho phép vì kiểm soát được bằng &amp;mut.)</li>
      <li><strong><code>FnOnce</code></strong>: move giá trị bắt được ra ngoài (tiêu thụ). Chỉ gọi được một lần.</li>
    </ul>
    <p>Từ khoá <strong><code>move</code></strong> trước closure (<code>move || ...</code>) buộc closure <em>sở hữu</em> biến bắt được thay vì mượn — bắt buộc khi closure sống lâu hơn scope hiện tại
    (gửi sang thread, tokio::spawn). Hàm nhận closure khai báo bằng trait bound: <code>fn retry&lt;F: FnMut() -&gt; Result&lt;T, E&gt;&gt;(f: F)</code>.</p>

    <div class="callout"><p>💡 Chuỗi iterator thường nhanh bằng hoặc hơn vòng for viết tay (bỏ được kiểm tra biên). Viết iterator khi nó làm code rõ hơn;
    khi logic có nhiều <code>break</code>/<code>?</code> phức tạp, vòng <code>for</code> vẫn hoàn toàn ổn.</p></div>
  `,

  codeTabs: [
    { id: "iter", label: "Chuỗi adapter", lines: [
      "struct Order { user_id: u64, amount: u64, paid: bool }",
      "",
      "let revenue: u64 = orders.iter()          // Iterator<Item = &Order>",
      "    .filter(|o| o.paid)                  // lười: chưa chạy",
      "    .map(|o| o.amount)                   // lười",
      "    .sum();                              // consumer: bây giờ mới chạy",
      "",
      "let top3: Vec<&Order> = {",
      "    let mut v: Vec<&Order> = orders.iter().filter(|o| o.paid).collect();",
      "    v.sort_by(|a, b| b.amount.cmp(&a.amount));",
      "    v.into_iter().take(3).collect()",
      "};",
      "",
      "let has_big = orders.iter().any(|o| o.amount > 10_000_000);",
      "for (i, o) in orders.iter().enumerate() { println!(\"{i}: {}\", o.amount); }"
    ]},
    { id: "collect", label: "collect", lines: [
      "use std::collections::HashMap;",
      "",
      "let ids: Vec<u64> = orders.iter().map(|o| o.user_id).collect();",
      "let by_id: HashMap<u64, &Order> = orders.iter().map(|o| (o.user_id, o)).collect();",
      "let csv: String = ids.iter().map(|id| id.to_string()).collect::<Vec<_>>().join(\",\");",
      "",
      "// Parse cả danh sách: lỗi đầu tiên -> Err, còn lại -> Ok(Vec)",
      "let inputs = [\"10\", \"20\", \"x\"];",
      "let parsed: Result<Vec<u32>, _> = inputs.iter().map(|s| s.parse::<u32>()).collect();",
      "assert!(parsed.is_err());",
      "",
      "let total: u64 = orders.iter().fold(0, |acc, o| acc + o.amount);"
    ]},
    { id: "clo", label: "Closure: Fn/FnMut/FnOnce", lines: [
      "let vat = 10;",
      "let with_vat = |p: u64| p * (100 + vat) / 100;   // Fn: chỉ đọc vat",
      "",
      "let mut calls = 0;",
      "let mut counter = || { calls += 1; };              // FnMut: sửa calls",
      "counter(); counter();",
      "println!(\"{calls}\");                              // 2",
      "",
      "let report = String::from(\"báo cáo\");",
      "let send = move || report;                         // FnOnce: trả report ra ngoài",
      "let r = send();",
      "// send();                                         -> lỗi: đã bị gọi (moved)",
      "",
      "fn retry<T, E, F: FnMut() -> Result<T, E>>(mut f: F, times: u32) -> Result<T, E> {",
      "    let mut last = f();",
      "    for _ in 1..times { if last.is_ok() { break; } last = f(); }",
      "    last",
      "}"
    ]},
    { id: "custom", label: "Tự viết Iterator", lines: [
      "struct Pages { page: u32, last: u32 }",
      "",
      "impl Iterator for Pages {",
      "    type Item = u32;                        // associated type",
      "    fn next(&mut self) -> Option<u32> {",
      "        if self.page > self.last { return None; }",
      "        self.page += 1;",
      "        Some(self.page - 1)",
      "    }",
      "}",
      "",
      "let pages: Vec<u32> = Pages { page: 1, last: 3 }.collect();   // [1, 2, 3]",
      "let evens = Pages { page: 1, last: 10 }.filter(|p| p % 2 == 0).count();  // 5"
    ]},
    { id: "cmp", label: "Java ↔ Rust", lines: [
      "// Java Stream                                   // Rust Iterator",
      "// orders.stream()                               orders.iter()",
      "//   .filter(Order::isPaid)                        .filter(|o| o.paid)",
      "//   .mapToLong(Order::getAmount).sum();           .map(|o| o.amount).sum::<u64>()",
      "// .collect(Collectors.toList())                 .collect::<Vec<_>>()",
      "// .collect(toMap(Order::getId, o -> o))         .map(|o| (o.id, o)).collect::<HashMap<_,_>>()",
      "// stream dùng 1 lần, có overhead ảo             adapter là struct cụ thể, inline được",
      "// lambda: biến phải effectively final           closure FnMut sửa được biến bắt"
    ]}
  ],

  stageHtml: `
    <div class="node" id="src"><div class="nl">📚 orders.iter()</div><div class="ns">Item = &amp;Order</div></div>
    <div class="arrow" id="a1">↓ adapter lười (chưa chạy)</div>
    <div class="row">
      <div class="node" id="f"><div class="nl">filter(|o| o.paid)</div><div class="ns">closure Fn</div></div>
      <div class="node" id="m"><div class="nl">map(|o| o.amount)</div><div class="ns">&amp;Order → u64</div></div>
    </div>
    <div class="arrow" id="a2">↓ consumer kéo từng phần tử qua next()</div>
    <div class="node" id="c"><div class="nl">∑ sum() / collect()</div><div class="ns">vòng lặp thật chạy ở đây</div></div>
  `,
  steps: [
    { title: "1 · Nguồn iterator", tab: "iter", highlight: [3], on: ["src"],
      desc: "iter() mượn: Item là &amp;Order, orders còn nguyên sau đó. into_iter() sẽ tiêu thụ." },
    { title: "2 · Adapter lười", tab: "iter", highlight: [4, 5], on: ["a1", "f", "m"],
      desc: "filter/map chỉ bọc iterator lại. Chưa có phần tử nào được xử lý." },
    { title: "3 · Consumer kéo dữ liệu", tab: "iter", highlight: [6, 14], on: ["a2", "c"],
      desc: "sum gọi next() liên tục; mỗi phần tử đi qua filter rồi map trong cùng một vòng — không có Vec trung gian." },
    { title: "4 · collect theo kiểu đích", tab: "collect", highlight: [3, 4, 9, 10], on: ["c"],
      desc: "Cùng collect nhưng ra Vec, HashMap, hoặc Result&lt;Vec, E&gt; — dừng ở lỗi đầu tiên." },
    { title: "5 · Closure bắt biến", tab: "clo", highlight: [2, 5, 10, 12], on: ["f"],
      desc: "Đọc → Fn, sửa → FnMut, move ra ngoài → FnOnce. move buộc closure sở hữu biến bắt được." },
    { title: "6 · Tự viết Iterator", tab: "custom", highlight: [3, 4, 5, 12, 13], on: ["src"],
      desc: "Chỉ cần impl next(); được miễn phí mọi adapter (filter, count, collect…)." }
  ],

  quiz: [
    { q: "Method bắt buộc duy nhất của trait Iterator?", options: [
        "iter()", "next(&mut self) -> Option&lt;Self::Item&gt;", "map()", "collect()"
      ], correct: 1, explanation: "Mọi adapter khác là default method." },
    { q: "<code>orders.iter().filter(...).map(...);</code> (không có consumer) chạy bao nhiêu lần closure?", options: [
        "Mỗi phần tử một lần", "0 lần — iterator lười", "Một lần", "Lỗi biên dịch"
      ], correct: 1, explanation: "Compiler còn cảnh báo 'iterators are lazy and do nothing unless consumed'." },
    { q: "Sau <code>for o in orders</code> (orders: Vec&lt;Order&gt;), orders còn dùng được không?", options: [
        "Có", "Không — into_iter đã move orders", "Chỉ đọc được", "Có nếu Order: Debug"
      ], correct: 1, explanation: "Dùng &orders để mượn." },
    { q: "Collect <code>Iterator&lt;Item = Result&lt;u32, E&gt;&gt;</code> thành <code>Result&lt;Vec&lt;u32&gt;, E&gt;</code> thì?", options: [
        "Bỏ qua lỗi",
        "Ok(Vec) nếu tất cả Ok; gặp Err đầu tiên thì dừng và trả Err đó",
        "Panic khi gặp lỗi",
        "Không hợp lệ"
      ], correct: 1, explanation: "Mẫu parse danh sách rất hay dùng." },
    { q: "Closure <code>|| { calls += 1; }</code> implement trait nào (mạnh nhất có thể)?", options: [
        "Fn", "FnMut", "FnOnce only", "Không trait nào"
      ], correct: 1, explanation: "Sửa biến bắt được → FnMut (cũng là FnOnce)." },
    { q: "Closure chỉ gọi được một lần thuộc loại?", options: [
        "Fn", "FnMut", "FnOnce", "Send"
      ], correct: 2, explanation: "Nó move giá trị bắt được ra ngoài khi gọi." },
    { q: "Từ khoá <code>move</code> trước closure làm gì?", options: [
        "Chuyển closure sang thread khác",
        "Buộc closure lấy quyền sở hữu các biến bắt được thay vì mượn",
        "Làm closure thành FnOnce",
        "Tối ưu tốc độ"
      ], correct: 1, explanation: "move closure vẫn có thể là Fn nếu chỉ đọc dữ liệu nó sở hữu." },
    { q: "Iterator Rust khác Java Stream về hiệu năng thế nào?", options: [
        "Chậm hơn nhiều",
        "Mỗi adapter là kiểu cụ thể, được monomorphize và inline — thường ngang vòng for tay",
        "Luôn chạy song song",
        "Tạo collection trung gian mỗi bước"
      ], correct: 1, explanation: "Zero-cost abstraction." },
    { q: "<code>(1..=4).fold(0, |acc, x| acc + x)</code> bằng?", options: [
        "6", "10", "4", "24"
      ], correct: 1, explanation: "1+2+3+4 = 10." }
  ]
});
