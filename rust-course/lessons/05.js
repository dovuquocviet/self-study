window.LESSONS.push({
  id: "05",
  phase: "1", phaseName: "Ownership — trái tim của Rust",
  title: "Borrowing: & và &mut — luật \"nhiều người đọc HOẶC một người ghi\"",
  subtitle: "tham chiếu chia sẻ vs độc quyền · borrow checker · NLL · vì sao chặn được ConcurrentModificationException",

  theory: `
    <p>Move mọi lúc thì bất tiện. <strong>Borrow</strong> = tạo tham chiếu tới giá trị mà không lấy quyền sở hữu. Owner vẫn là owner; khi tham chiếu hết dùng, mọi thứ như cũ.</p>

    <table>
      <tr><th></th><th><code>&amp;T</code> — shared reference</th><th><code>&amp;mut T</code> — mutable reference</th></tr>
      <tr><td>Quyền</td><td>Chỉ đọc</td><td>Đọc + ghi</td></tr>
      <tr><td>Số lượng cùng lúc</td><td>Bao nhiêu cũng được</td><td><strong>Đúng một</strong>, và không có &amp;T nào khác đang sống</td></tr>
      <tr><td>Là Copy?</td><td>Có</td><td>Không (chỉ reborrow)</td></tr>
    </table>

    <p><strong>Luật vàng</strong>: tại mỗi thời điểm, một giá trị có <em>hoặc</em> nhiều <code>&amp;T</code>, <em>hoặc</em> đúng một <code>&amp;mut T</code> — không bao giờ cả hai.
    Thêm nữa: tham chiếu không được sống lâu hơn giá trị nó trỏ tới (không có dangling pointer).</p>

    <p><strong>Vì sao luật này đáng giá?</strong> Hầu hết bug khó chịu đến từ "vừa đọc vừa sửa":</p>
    <ul>
      <li>Java: duyệt <code>for (x : list)</code> rồi <code>list.remove(x)</code> → <code>ConcurrentModificationException</code> lúc chạy. Rust: <strong>lỗi biên dịch</strong>, vì vòng lặp giữ &amp;v còn remove cần &amp;mut v.</li>
      <li>Giữ tham chiếu tới phần tử <code>&amp;v[0]</code> rồi <code>v.push()</code>: push có thể cấp phát lại mảng, tham chiếu cũ trỏ vào vùng nhớ đã free. Rust chặn.</li>
      <li>Hai thread cùng ghi: không thể có hai &amp;mut → không data race.</li>
    </ul>

    <p><strong>Borrow checker</strong> là phần compiler kiểm tra luật trên. Từ 2018 nó dùng <strong>NLL (non-lexical lifetimes)</strong>: một borrow kết thúc ở
    <em>lần dùng cuối cùng</em>, không phải cuối block. Nên đoạn "lấy &amp; → dùng xong → rồi mới &amp;mut" là hợp lệ.</p>

    <p><strong>Cú pháp</strong>: tạo tham chiếu bằng <code>&amp;x</code> / <code>&amp;mut x</code> (x phải khai báo <code>mut</code> mới mượn mut được). Gọi method thì Rust tự thêm
    &amp;/&amp;mut/* (auto-ref, auto-deref), nên <code>v.len()</code> chứ không phải <code>(&amp;v).len()</code>. Muốn ghi qua tham chiếu vào giá trị đơn: <code>*count += 1;</code></p>

    <div class="callout"><p>💡 Đọc tên cho đúng: <code>&amp;mut</code> nên hiểu là <strong>"tham chiếu độc quyền"</strong> (exclusive), <code>&amp;</code> là <strong>"tham chiếu chia sẻ"</strong> (shared).
    Vấn đề cốt lõi không phải mutable hay không, mà là có ai khác đang nhìn cùng lúc không.</p></div>
  `,

  codeTabs: [
    { id: "basic", label: "& và &mut", lines: [
      "fn total_len(items: &Vec<String>) -> usize {   // mượn đọc",
      "    items.iter().map(|s| s.len()).sum()",
      "}",
      "",
      "fn add_item(items: &mut Vec<String>, name: &str) {  // mượn ghi",
      "    items.push(name.to_string());",
      "}",
      "",
      "fn main() {",
      "    let mut cart = vec![String::from(\"ao\")];",
      "    add_item(&mut cart, \"quan\");          // mượn độc quyền, trả lại ngay",
      "    let n = total_len(&cart);              // mượn chia sẻ",
      "    println!(\"{n} {:?}\", cart);          // cart vẫn là owner",
      "}"
    ]},
    { id: "err", label: "Borrow checker chặn", lines: [
      "let mut v = vec![1, 2, 3];",
      "let first = &v[0];          // borrow chia sẻ bắt đầu",
      "v.push(4);                  // cần &mut v -> LỖI E0502",
      "println!(\"{first}\");       // first còn được dùng ở đây",
      "",
      "// error[E0502]: cannot borrow v as mutable because it is also",
      "//               borrowed as immutable",
      "",
      "// Vì sao? push có thể cấp phát lại -> first trỏ vào vùng nhớ đã free"
    ]},
    { id: "nll", label: "NLL: hợp lệ", lines: [
      "let mut v = vec![1, 2, 3];",
      "let first = &v[0];",
      "println!(\"{first}\");       // lần dùng CUỐI của first -> borrow kết thúc",
      "v.push(4);                  // OK: không còn &v nào sống",
      "",
      "let mut count = 0;",
      "let r = &mut count;",
      "*r += 1;                    // * để ghi vào giá trị được trỏ",
      "println!(\"{count}\");       // OK: r không còn dùng"
    ]},
    { id: "loop", label: "Sửa khi đang duyệt", lines: [
      "let mut orders = vec![10, 0, 25, 0];",
      "",
      "// for o in &orders { if *o == 0 { orders.retain(...) } }  // lỗi biên dịch",
      "",
      "// Cách 1: API chuyên dụng",
      "orders.retain(|&o| o != 0);",
      "",
      "// Cách 2: duyệt bằng &mut để sửa tại chỗ",
      "for o in orders.iter_mut() {",
      "    *o *= 2;",
      "}"
    ]},
    { id: "cmp", label: "Java ↔ Rust", lines: [
      "// Java: lỗi lúc CHẠY",
      "// for (Integer o : orders) {",
      "//     if (o == 0) orders.remove(o);   // ConcurrentModificationException",
      "// }",
      "",
      "// Rust: lỗi lúc BIÊN DỊCH",
      "// for o in &orders {                  // giữ &orders",
      "//     if *o == 0 { orders.remove(0); }   // cần &mut orders -> E0502",
      "// }",
      "// => dùng orders.retain(|&o| o != 0);"
    ]}
  ],

  stageHtml: `
    <div class="node" id="own"><div class="nl">👑 Owner: cart</div><div class="ns">giữ quyền sở hữu suốt</div></div>
    <div class="row">
      <div class="node" id="sh"><div class="nl">👀 &amp;cart × N</div><div class="ns">nhiều người đọc</div></div>
      <div class="node" id="ex"><div class="nl">✍️ &amp;mut cart × 1</div><div class="ns">một người ghi, không ai đọc</div></div>
    </div>
    <div class="arrow" id="a1">↓ trộn cả hai cùng lúc?</div>
    <div class="node" id="bc"><div class="nl">🛑 Borrow checker</div><div class="ns">E0502 — không biên dịch</div></div>
    <div class="arrow" id="a2">↓ NLL: borrow hết ở lần dùng cuối</div>
    <div class="node" id="ok"><div class="nl">✅ Tuần tự: đọc xong rồi ghi</div><div class="ns">hợp lệ</div></div>
  `,
  steps: [
    { title: "1 · Mượn thay vì move", tab: "basic", highlight: [1, 5, 11, 12, 13], on: ["own"],
      desc: "Hàm nhận &amp;Vec hoặc &amp;mut Vec. cart vẫn là owner, dùng tiếp được sau khi gọi hàm." },
    { title: "2 · Nhiều &, hoặc một &mut", tab: "basic", highlight: [1, 5], on: ["sh", "ex"],
      desc: "total_len chỉ đọc nên mượn chia sẻ. add_item cần push nên mượn độc quyền — trong lúc đó không ai khác được nhìn cart." },
    { title: "3 · Trộn lẫn bị chặn", tab: "err", highlight: [2, 3, 4, 6, 7], on: ["a1", "bc"],
      desc: "first (&amp;) còn dùng ở dòng 4 nên đang sống lúc push (&amp;mut). Compiler chặn một bug use-after-free thật sự." },
    { title: "4 · NLL cho phép tuần tự", tab: "nll", highlight: [2, 3, 4], on: ["a2", "ok"],
      desc: "Dùng first lần cuối trước push → borrow đã kết thúc → push hợp lệ. Sắp xếp lại thứ tự thường là cách sửa đơn giản nhất." },
    { title: "5 · Hết ConcurrentModificationException", tab: "cmp", highlight: [3, 8, 10], on: ["bc", "ok"],
      desc: "Lỗi mà Java chỉ phát hiện lúc chạy thì Rust bắt lúc biên dịch. Dùng retain / iter_mut thay cho sửa trong lúc duyệt." }
  ],

  quiz: [
    { q: "Luật borrow cốt lõi là gì?", options: [
        "Chỉ một &T tại một thời điểm",
        "Nhiều &T HOẶC đúng một &mut T, không đồng thời",
        "Không giới hạn &mut T",
        "&T và &mut T luôn dùng chung được"
      ], correct: 1, explanation: "Aliasing XOR mutation." },
    { q: "Đoạn: <code>let f = &v[0]; v.push(4); println!(\"{f}\");</code> lỗi vì sao?", options: [
        "v không phải mut",
        "push cần &mut v trong khi f (&v) vẫn còn dùng sau đó",
        "Index 0 không tồn tại",
        "println không in được tham chiếu"
      ], correct: 1, explanation: "push có thể cấp phát lại, làm f thành dangling." },
    { q: "NLL (non-lexical lifetimes) nghĩa là gì?", options: [
        "Borrow kéo dài tới cuối block",
        "Borrow kết thúc ở lần sử dụng cuối cùng của tham chiếu",
        "Không có lifetime",
        "Lifetime do runtime quản lý"
      ], correct: 1, explanation: "Nhờ đó nhiều đoạn code tuần tự hợp lệ mà trước 2018 bị từ chối." },
    { q: "Để gọi <code>add(&mut x)</code>, biến x phải khai báo thế nào?", options: [
        "let x", "let mut x", "const x", "static x"
      ], correct: 1, explanation: "Không thể mượn mutable một binding bất biến." },
    { q: "<code>let r = &mut count; ___ += 1;</code> — điền gì để tăng count?", options: [
        "r", "*r", "&r", "count"
      ], correct: 1, explanation: "Dereference bằng * để ghi vào giá trị. (Gọi method thì auto-deref nên không cần *)." },
    { q: "Cách Rust-idiomatic để xoá các phần tử bằng 0 trong Vec?", options: [
        "Duyệt for và gọi remove bên trong",
        "v.retain(|&x| x != 0)",
        "Dùng unsafe",
        "Chuyển sang LinkedList"
      ], correct: 1, explanation: "retain làm tại chỗ, không vi phạm luật borrow." },
    { q: "Hàm nào nên nhận <code>&mut Vec&lt;T&gt;</code>?", options: [
        "Hàm chỉ tính tổng",
        "Hàm cần thêm/xoá phần tử của Vec người gọi, nhưng không lấy quyền sở hữu",
        "Hàm lưu Vec vào struct lâu dài",
        "Hàm gửi Vec sang thread khác"
      ], correct: 1, explanation: "Lưu lâu dài hoặc gửi đi thì nhận sở hữu (Vec<T>)." },
    { q: "Tên gọi chính xác hơn về bản chất cho <code>&mut T</code> là gì?", options: [
        "Tham chiếu yếu", "Tham chiếu độc quyền (exclusive)", "Con trỏ thô", "Tham chiếu đếm"
      ], correct: 1, explanation: "Điểm mấu chốt là không ai khác truy cập cùng lúc." },
    { q: "Borrow checker ngăn được loại lỗi nào sau đây?", options: [
        "Sai logic nghiệp vụ",
        "Dangling reference, use-after-free, sửa collection khi đang duyệt, data race",
        "Deadlock",
        "Tràn stack do đệ quy"
      ], correct: 1, explanation: "Deadlock và lỗi logic vẫn có thể xảy ra trong Rust." }
  ]
});
