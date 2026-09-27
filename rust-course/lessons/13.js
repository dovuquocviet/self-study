window.LESSONS.push({
  id: "13",
  phase: "3", phaseName: "Trừu tượng hoá",
  title: "Collection: Vec, HashMap, String và entry API",
  subtitle: "Vec ≈ ArrayList · get vs [] · HashMap ownership của key/value · entry().or_insert() · String UTF-8",

  theory: `
    <table>
      <tr><th>Java</th><th>Rust (std::collections)</th><th>Ghi chú</th></tr>
      <tr><td><code>ArrayList</code></td><td><code>Vec&lt;T&gt;</code></td><td>Dùng nhiều nhất. Phần tử nằm liền nhau trên heap, không box</td></tr>
      <tr><td><code>HashMap</code></td><td><code>HashMap&lt;K, V&gt;</code></td><td>Key cần <code>Eq + Hash</code>. Hash mặc định SipHash (chống HashDoS), chậm hơn một chút</td></tr>
      <tr><td><code>HashSet</code></td><td><code>HashSet&lt;T&gt;</code></td><td></td></tr>
      <tr><td><code>TreeMap</code></td><td><code>BTreeMap&lt;K, V&gt;</code></td><td>Có thứ tự; key cần <code>Ord</code></td></tr>
      <tr><td><code>ArrayDeque</code></td><td><code>VecDeque&lt;T&gt;</code></td><td>Hàng đợi hai đầu</td></tr>
      <tr><td><code>PriorityQueue</code></td><td><code>BinaryHeap&lt;T&gt;</code></td><td>Max-heap</td></tr>
    </table>

    <p><strong>Vec</strong> có (con trỏ, len, capacity) như String. <code>push</code> khi đầy sẽ cấp phát vùng lớn hơn (thường gấp đôi) và chuyển dữ liệu —
    lý do borrow checker cấm giữ <code>&amp;v[0]</code> khi push (bài 05). Biết trước số lượng thì <code>Vec::with_capacity(n)</code>.
    Truy cập: <code>v[i]</code> panic nếu vượt; <code>v.get(i)</code> trả <code>Option&lt;&amp;T&gt;</code>.</p>

    <p><strong>HashMap và ownership</strong>: <code>insert(k, v)</code> <em>move</em> k và v vào map (với String). <code>get(&amp;k)</code> trả <code>Option&lt;&amp;V&gt;</code> — tham chiếu mượn từ map.
    Có thể tra <code>HashMap&lt;String, _&gt;</code> bằng <code>&amp;str</code> nhờ trait <code>Borrow</code>, không cần tạo String.</p>

    <p><strong>Entry API</strong> — giải bài toán "có thì cập nhật, chưa có thì thêm" với một lần tra hash, thay cho <code>containsKey</code> + <code>get</code> + <code>put</code>
    (Java có <code>merge</code>/<code>computeIfAbsent</code> tương tự):</p>
    <ul>
      <li><code>*map.entry(k).or_insert(0) += 1;</code> — đếm.</li>
      <li><code>map.entry(k).or_default().push(x);</code> — group by.</li>
      <li><code>.or_insert_with(|| tính_đắt())</code> — chỉ tính khi thiếu.</li>
    </ul>

    <p><strong>String là Vec&lt;u8&gt; UTF-8 hợp lệ.</strong> Không index được <code>s[0]</code> (vì 1 ký tự có thể 1–4 byte, và "ký tự" có nhiều nghĩa).
    <code>s.len()</code> là số <em>byte</em>: <code>"Việt".len() == 6</code> ("ệ" chiếm 3 byte); đếm ký tự dùng <code>s.chars().count()</code> == 4. Nối: <code>push_str</code>, <code>format!</code>, <code>+</code> (lấy quyền sở hữu vế trái).</p>

    <div class="callout"><p>💡 Duyệt collection có 3 dạng — liên hệ ownership: <code>for x in &amp;v</code> (mượn đọc), <code>for x in &amp;mut v</code> (mượn sửa),
    <code>for x in v</code> (tiêu thụ: v bị move, từng phần tử được chuyển ra). Chi tiết ở bài iterator.</p></div>
  `,

  codeTabs: [
    { id: "vec", label: "Vec", lines: [
      "let mut ids: Vec<u64> = Vec::with_capacity(100);  // cấp sẵn chỗ",
      "ids.push(10);",
      "ids.extend([20, 30, 40]);",
      "let v2 = vec![1, 2, 3];                   // macro khởi tạo",
      "",
      "let third = ids[2];                       // 30; ids[99] -> panic",
      "let maybe = ids.get(99);                  // None, an toàn",
      "ids.retain(|&id| id != 20);               // xoá theo điều kiện",
      "ids.sort_unstable();                      // nhanh hơn sort() nếu không cần ổn định",
      "let last = ids.pop();                     // Option<u64>",
      "println!(\"{} {}\", ids.len(), ids.contains(&30));",
      "",
      "for id in &ids { println!(\"{id}\"); }    // mượn",
      "for id in &mut ids { *id += 1; }         // sửa tại chỗ",
      "for id in ids { drop(id); }              // tiêu thụ: ids bị move"
    ]},
    { id: "map", label: "HashMap", lines: [
      "use std::collections::HashMap;",
      "",
      "let mut stock: HashMap<String, u32> = HashMap::new();",
      "let sku = String::from(\"AO-01\");",
      "stock.insert(sku, 12);                    // sku bị move vào map",
      "// println!(\"{sku}\");                   -> lỗi: value moved",
      "",
      "if let Some(qty) = stock.get(\"AO-01\") {  // tra bằng &str được",
      "    println!(\"còn {qty}\");",
      "}",
      "if let Some(q) = stock.get_mut(\"AO-01\") { *q -= 1; }",
      "stock.remove(\"AO-01\");",
      "",
      "for (k, v) in &stock { println!(\"{k}: {v}\"); }  // thứ tự không xác định"
    ]},
    { id: "entry", label: "Entry API", lines: [
      "// Đếm số đơn theo trạng thái",
      "let mut count: HashMap<&str, usize> = HashMap::new();",
      "for o in &orders {",
      "    *count.entry(o.status.as_str()).or_insert(0) += 1;",
      "}",
      "",
      "// Group by khách hàng",
      "let mut by_user: HashMap<u64, Vec<&Order>> = HashMap::new();",
      "for o in &orders {",
      "    by_user.entry(o.user_id).or_default().push(o);",
      "}",
      "",
      "// Cache: chỉ tính khi thiếu",
      "let price = cache.entry(sku.clone()).or_insert_with(|| load_price(&sku));"
    ]},
    { id: "str", label: "String", lines: [
      "let mut s = String::from(\"Việt\");",
      "println!(\"{}\", s.len());             // 6 (byte, không phải ký tự)",
      "println!(\"{}\", s.chars().count());   // 4 ký tự",
      "// let c = s[0];                      -> lỗi: String không index bằng số",
      "let first = s.chars().next();          // Some('V')",
      "s.push_str(\" Nam\");",
      "let full = format!(\"{s} - {}\", 2025); // không move s",
      "let a = String::from(\"ab\");",
      "let b = a + \"cd\";                      // + lấy quyền sở hữu a",
      "let parts: Vec<&str> = \"a,b,c\".split(',').collect();",
      "let upper = s.to_uppercase();"
    ]},
    { id: "cmp", label: "Java ↔ Rust", lines: [
      "// Java                                       // Rust",
      "// new ArrayList<>(100)                       Vec::with_capacity(100)",
      "// list.get(i)  // ném IndexOutOfBounds       v[i] (panic)  /  v.get(i) (Option)",
      "// list.removeIf(x -> x == 20)                v.retain(|&x| x != 20)",
      "// map.merge(k, 1, Integer::sum)              *map.entry(k).or_insert(0) += 1",
      "// map.computeIfAbsent(k, x -> new ArrayList<>()).add(o)",
      "//                                            map.entry(k).or_default().push(o)",
      "// s.length()  // số UTF-16 code unit         s.len() (byte) / s.chars().count()"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="v"><div class="nl">📚 Vec&lt;T&gt;</div><div class="ns">ptr · len · cap → heap liền nhau</div></div>
      <div class="node" id="m"><div class="nl">🗂️ HashMap&lt;K,V&gt;</div><div class="ns">sở hữu key + value</div></div>
    </div>
    <div class="arrow" id="a1">↓ đầy thì cấp phát lại</div>
    <div class="node" id="grow"><div class="nl">📈 push khi len == cap</div><div class="ns">vùng mới ×2, tham chiếu cũ vô hiệu</div></div>
    <div class="arrow" id="a2">↓ cập nhật map một lần tra</div>
    <div class="node" id="en"><div class="nl">🔑 entry(k).or_insert(..)</div><div class="ns">có thì lấy, chưa có thì thêm</div></div>
  `,
  steps: [
    { title: "1 · Vec cơ bản", tab: "vec", highlight: [1, 2, 3, 4], on: ["v"],
      desc: "with_capacity tránh cấp phát lại nhiều lần. vec! là macro khởi tạo nhanh." },
    { title: "2 · [] vs get", tab: "vec", highlight: [6, 7, 10], on: ["v"],
      desc: "[] panic khi vượt; get/pop trả Option. Input từ bên ngoài → luôn dùng get." },
    { title: "3 · Vì sao cấm giữ tham chiếu khi push", tab: "vec", highlight: [2, 3], on: ["a1", "grow"],
      desc: "Khi len chạm capacity, Vec chuyển sang vùng nhớ mới; tham chiếu cũ sẽ trỏ vào vùng đã free. Borrow checker chặn trước." },
    { title: "4 · HashMap sở hữu dữ liệu", tab: "map", highlight: [3, 5, 6, 8, 11], on: ["m"],
      desc: "insert move String vào map. get trả &amp;V, get_mut trả &amp;mut V. Tra được bằng &amp;str." },
    { title: "5 · Entry API", tab: "entry", highlight: [4, 10, 14], on: ["a2", "en"],
      desc: "Một lần tính hash cho cả kiểm tra và thêm. Mẫu đếm, group by, cache." },
    { title: "6 · String là byte UTF-8", tab: "str", highlight: [2, 3, 4, 5, 9], on: ["v"],
      desc: "len là byte. Không index s[0]. + lấy quyền sở hữu vế trái; format! thì không." }
  ],

  quiz: [
    { q: "<code>v.get(10)</code> trên Vec 3 phần tử trả về?", options: [
        "Panic", "None", "0", "Lỗi biên dịch"
      ], correct: 1, explanation: "get trả Option<&T>; còn v[10] mới panic." },
    { q: "Vì sao <code>Vec::with_capacity(n)</code> hữu ích?", options: [
        "Giới hạn tối đa n phần tử",
        "Cấp phát trước để tránh cấp phát lại khi push nhiều lần",
        "Khởi tạo n phần tử 0",
        "Bắt buộc với Vec"
      ], correct: 1, explanation: "len vẫn là 0; chỉ capacity là n." },
    { q: "Sau <code>map.insert(sku, 1)</code> với sku: String, dùng lại sku được không?", options: [
        "Được", "Không, sku đã bị move vào map", "Được nếu map là mut", "Chỉ đọc"
      ], correct: 1, explanation: "Clone trước nếu cần giữ, hoặc dùng key &str khi phù hợp." },
    { q: "Đếm tần suất gọn nhất bằng?", options: [
        "if map.contains_key(k) {...} else {...}",
        "*map.entry(k).or_insert(0) += 1",
        "map.put(k, map.get(k) + 1)",
        "map[k]++"
      ], correct: 1, explanation: "Một lần tra hash." },
    { q: "<code>\"Việt\".len()</code> bằng bao nhiêu?", options: [
        "4", "5", "6", "8"
      ], correct: 2, explanation: "V(1) + i(1) + ệ(3) + t(1) = 6 byte; chars().count() mới là 4." },
    { q: "Tương đương TreeMap (có thứ tự key) của Java?", options: [
        "HashMap", "BTreeMap", "IndexMap", "VecDeque"
      ], correct: 1, explanation: "Key cần Ord." },
    { q: "<code>for x in v</code> (không có &) với v: Vec&lt;String&gt; thì?", options: [
        "Mượn từng phần tử",
        "Tiêu thụ v: từng String được move ra, v không dùng được sau vòng lặp",
        "Copy từng phần tử",
        "Lỗi biên dịch"
      ], correct: 1, explanation: "Dùng &v để chỉ mượn." },
    { q: "Vì sao String không cho <code>s[0]</code>?", options: [
        "Vì String bất biến",
        "Vì UTF-8: một ký tự có thể nhiều byte, index theo byte dễ gây hiểu nhầm",
        "Vì chậm",
        "Được, trả char"
      ], correct: 1, explanation: "Dùng chars(), bytes(), hoặc slice theo byte &s[a..b]." },
    { q: "Hash mặc định của HashMap Rust được chọn vì?", options: [
        "Nhanh nhất có thể",
        "Chống tấn công HashDoS (SipHash), đổi lại chậm hơn chút",
        "Có thứ tự",
        "Dùng chung với Java"
      ], correct: 1, explanation: "Có thể thay hasher (vd ahash, FxHash) khi key không đến từ người dùng." }
  ]
});
