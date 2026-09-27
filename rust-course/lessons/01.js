window.LESSONS.push({
  id: "01",
  phase: "0", phaseName: "Khởi động",
  title: "Vì sao Rust? Nhìn từ góc một dev Java",
  subtitle: "không GC · ownership thay GC · zero-cost abstraction · an toàn bộ nhớ lúc biên dịch",

  theory: `
    <p>Java giải bài toán bộ nhớ bằng <strong>Garbage Collector</strong>: bạn cứ <code>new</code>, JVM lo dọn. Đổi lại: heap lớn, pause GC, JVM khởi động chậm,
    RAM nền vài trăm MB cho một service nhỏ. C/C++ không có GC — nhanh, gọn — nhưng lập trình viên tự <code>free</code>, và sai là
    use-after-free, double free, data race: nguồn gốc của khoảng 70% lỗ hổng bảo mật nghiêm trọng mà Microsoft và Chrome từng thống kê.</p>

    <p>Rust chọn con đường thứ ba: <strong>trình biên dịch tự tính ra lúc nào giải phóng bộ nhớ</strong> nhờ quy tắc <em>ownership</em>.
    Không GC chạy nền, cũng không phải tự <code>free</code>. Nếu code có thể gây lỗi bộ nhớ hoặc data race, nó <strong>không biên dịch được</strong>.</p>

    <table>
      <tr><th>Tiêu chí</th><th>Java (JVM)</th><th>Rust</th></tr>
      <tr><td>Quản lý bộ nhớ</td><td>GC lúc chạy</td><td>Ownership, kiểm tra lúc biên dịch; giải phóng khi biến ra khỏi scope</td></tr>
      <tr><td>Chạy trên</td><td>Bytecode + JIT trên JVM</td><td>Mã máy native, một file binary</td></tr>
      <tr><td>Khởi động</td><td>Hàng trăm ms – vài giây (Spring Boot)</td><td>Vài ms</td></tr>
      <tr><td>RAM nền service nhỏ</td><td>~150–500 MB</td><td>~5–30 MB</td></tr>
      <tr><td><code>null</code></td><td>Có, NPE lúc chạy</td><td>Không có; dùng <code>Option&lt;T&gt;</code></td></tr>
      <tr><td>Lỗi</td><td>Exception (checked/unchecked)</td><td><code>Result&lt;T, E&gt;</code> là giá trị trả về</td></tr>
      <tr><td>Data race</td><td>Có thể xảy ra, phát hiện lúc chạy (nếu may)</td><td>Bị chặn lúc biên dịch (Send/Sync)</td></tr>
      <tr><td>Kế thừa</td><td>class + extends</td><td>Không có kế thừa class; dùng trait + composition</td></tr>
    </table>

    <p><strong>Zero-cost abstraction</strong>: viết code trừu tượng (iterator, generic, closure) nhưng sau biên dịch nhanh ngang vòng lặp viết tay.
    Generic được <em>monomorphize</em> — sinh bản code riêng cho từng kiểu cụ thể — nên không có boxing như <code>List&lt;Integer&gt;</code> của Java,
    không có virtual call nếu bạn không yêu cầu.</p>

    <p><strong>Vì sao công ty chuyển sang Rust?</strong> Service nhỏ, RAM thấp → rẻ hơn khi chạy nhiều instance; khởi động nhanh → hợp container/serverless
    (Cloudflare Workers hỗ trợ Rust qua WebAssembly); ít lỗi runtime vì compiler bắt trước. Cái giá: <strong>đường cong học dốc</strong> — tuần đầu bạn sẽ
    "cãi nhau" với borrow checker. Khoá này giúp bạn hiểu <em>vì sao</em> compiler từ chối, thay vì mò <code>.clone()</code> cho qua.</p>

    <div class="callout"><p>💡 Tư duy chuyển đổi quan trọng nhất: trong Java, mọi object là tham chiếu chia sẻ tự do, GC gánh hậu quả.
    Trong Rust, mỗi giá trị có <strong>đúng một chủ sở hữu</strong>; muốn cho người khác dùng thì <em>chuyển</em> (move) hoặc <em>cho mượn</em> (borrow) — và compiler kiểm tra từng lần mượn.</p></div>
  `,

  codeTabs: [
    { id: "java", label: "Java: GC lo hết", lines: [
      "public class Main {",
      "    public static void main(String[] args) {",
      "        List<String> names = new ArrayList<>();   // object trên heap",
      "        names.add(\"An\");",
      "        List<String> alias = names;                 // 2 tham chiếu, 1 object",
      "        alias.add(\"Binh\");                          // sửa qua alias",
      "        System.out.println(names);                  // [An, Binh]",
      "    }   // GC dọn 'sau này', không biết lúc nào",
      "}"
    ]},
    { id: "rust", label: "Rust: ownership", lines: [
      "fn main() {",
      "    let mut names: Vec<String> = Vec::new();  // names sở hữu Vec",
      "    names.push(String::from(\"An\"));",
      "    let alias = names;                         // MOVE: quyền sở hữu chuyển sang alias",
      "    // names.push(...)  -> lỗi biên dịch E0382: borrow of moved value",
      "    println!(\"{:?}\", alias);                  // [\"An\"]",
      "}   // alias ra khỏi scope -> Vec và các String được giải phóng NGAY tại đây"
    ]},
    { id: "zero", label: "Zero-cost", lines: [
      "// Viết kiểu trừu tượng (iterator + closure)",
      "let total: u64 = orders.iter()",
      "    .filter(|o| o.paid)",
      "    .map(|o| o.amount)",
      "    .sum();",
      "",
      "// Sau tối ưu, compiler sinh mã tương đương vòng lặp viết tay:",
      "let mut total: u64 = 0;",
      "for o in &orders { if o.paid { total += o.amount; } }",
      "// Không tạo List trung gian, không boxing, không virtual call"
    ]},
    { id: "cmp", label: "Java ↔ Rust", lines: [
      "// Java                          // Rust",
      "// String s = null;             let s: Option<String> = None;",
      "// throw new IOException();     return Err(io_error);",
      "// interface Shape {}           trait Shape {}",
      "// class A extends B            (không có) -> struct + trait + composition",
      "// synchronized / Lock          Mutex<T> (dữ liệu nằm TRONG khoá)",
      "// mvn package -> .jar          cargo build --release -> binary native",
      "// JVM + GC                     không runtime GC"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="j"><div class="nl">☕ Java</div><div class="ns">new → heap, GC dọn lúc chạy</div></div>
      <div class="node" id="c"><div class="nl">⚙️ C/C++</div><div class="ns">tự free → nhanh nhưng dễ lỗi</div></div>
    </div>
    <div class="arrow" id="a1">↓ con đường thứ ba</div>
    <div class="node" id="r"><div class="nl">🦀 Rust: ownership</div><div class="ns">compiler tính lúc free, không GC</div></div>
    <div class="arrow" id="a2">↓ kết quả</div>
    <div class="row">
      <div class="node" id="safe"><div class="nl">🛡️ An toàn bộ nhớ</div><div class="ns">lỗi bị chặn khi biên dịch</div></div>
      <div class="node" id="fast"><div class="nl">⚡ Nhanh, nhẹ</div><div class="ns">binary native, zero-cost</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Java: chia sẻ tham chiếu tự do", tab: "java", highlight: [3, 5, 6, 8], on: ["j"],
      desc: "names và alias trỏ cùng một object. Ai cũng sửa được. GC dọn khi không còn tham chiếu — bạn không biết lúc nào." },
    { title: "2 · C/C++: nhanh nhưng tự chịu", tab: "cmp", highlight: [7, 8], on: ["c"],
      desc: "C/C++ cũng ra binary native, không JVM, không GC — nhưng bạn tự giải phóng. Quên free → leak; free hai lần hoặc dùng sau khi free → lỗi bộ nhớ, lỗ hổng bảo mật." },
    { title: "3 · Rust: mỗi giá trị một chủ", tab: "rust", highlight: [2, 4, 5], on: ["a1", "r"],
      desc: "<code>let alias = names;</code> là <strong>move</strong>: names mất quyền. Dùng lại names → lỗi biên dịch, không phải lỗi runtime." },
    { title: "4 · Giải phóng xác định", tab: "rust", highlight: [7], on: ["a2", "safe"],
      desc: "Khi chủ sở hữu ra khỏi scope, Rust gọi <code>drop</code> ngay tại đó. Không pause GC, không leak nếu không cố ý." },
    { title: "5 · Trừu tượng không tốn phí", tab: "zero", highlight: [2, 3, 4, 5, 8, 9], on: ["fast"],
      desc: "Chuỗi iterator được tối ưu thành vòng lặp thường. Đó là lý do Rust vừa viết gọn như Java Stream vừa chạy nhanh như C." }
  ],

  quiz: [
    { q: "Rust quản lý bộ nhớ heap chủ yếu bằng cơ chế nào?", options: [
        "Garbage collector chạy nền như JVM",
        "Reference counting tự động cho mọi object",
        "Quy tắc ownership được compiler kiểm tra; giải phóng khi chủ sở hữu ra khỏi scope",
        "Lập trình viên gọi free() thủ công"
      ], correct: 2, explanation: "Ownership + drop khi ra khỏi scope. Rc/Arc chỉ dùng khi bạn chủ động chọn." },
    { q: "Sau <code>let alias = names;</code> (names là Vec&lt;String&gt;), dùng lại <code>names</code> thì sao?", options: [
        "Chạy bình thường, cả hai cùng trỏ một Vec",
        "Lỗi biên dịch: value đã bị move",
        "Panic lúc chạy",
        "names tự động được clone"
      ], correct: 1, explanation: "Vec không phải Copy, nên gán là move. Compiler báo E0382." },
    { q: "\"Zero-cost abstraction\" nghĩa là gì?", options: [
        "Thư viện Rust miễn phí",
        "Dùng trừu tượng (iterator, generic) không tốn chi phí runtime so với viết tay",
        "Không cần cấp phát bộ nhớ",
        "Code biên dịch mất 0 giây"
      ], correct: 1, explanation: "Bạn không trả giá runtime cho thứ mình không dùng, và thứ bạn dùng không thể viết tay nhanh hơn." },
    { q: "Generic trong Rust khác Java ở điểm nào về runtime?", options: [
        "Giống hệt: type erasure",
        "Rust monomorphize: sinh code riêng cho từng kiểu cụ thể, không boxing",
        "Rust không có generic",
        "Rust dùng reflection để xử lý generic"
      ], correct: 1, explanation: "Java xoá kiểu (List<Integer> lưu Integer boxed). Rust sinh bản chuyên biệt, ví dụ Vec<i32> lưu i32 liền nhau." },
    { q: "Rust thay <code>null</code> của Java bằng gì?", options: [
        "nil", "Option&lt;T&gt; với Some(v) / None", "undefined", "Con trỏ 0"
      ], correct: 1, explanation: "Không có null reference; trường hợp 'không có giá trị' phải khai báo trong kiểu." },
    { q: "Vì sao Rust hợp với container nhỏ / serverless hơn Spring Boot?", options: [
        "Vì Rust có nhiều annotation hơn",
        "Binary native, khởi động vài ms, RAM nền thấp, không JVM",
        "Vì Rust chỉ chạy trên Linux",
        "Vì Rust không cần mạng"
      ], correct: 1, explanation: "Cold start và memory footprint là chi phí chính của serverless/nhiều instance." },
    { q: "Data race trong Rust (safe code) bị phát hiện khi nào?", options: [
        "Lúc chạy, bằng ThreadSanitizer",
        "Không bao giờ",
        "Lúc biên dịch, nhờ ownership + trait Send/Sync",
        "Khi GC chạy"
      ], correct: 2, explanation: "Safe Rust đảm bảo không có data race; code vi phạm không biên dịch được." },
    { q: "Rust có kế thừa class (extends) như Java không?", options: [
        "Có, giống hệt",
        "Không; dùng struct + trait + composition",
        "Có nhưng chỉ đơn kế thừa",
        "Chỉ trong unsafe"
      ], correct: 1, explanation: "Trait giống interface (có default method), còn tái sử dụng dữ liệu bằng composition." },
    { q: "Cái giá chính khi chuyển từ Java sang Rust là gì?", options: [
        "Chạy chậm hơn",
        "Không có thư viện web",
        "Đường cong học dốc (ownership, borrow checker) và thời gian biên dịch lâu hơn",
        "Không chạy được trên server"
      ], correct: 2, explanation: "Compiler khắt khe là đánh đổi cho an toàn; biên dịch Rust cũng chậm hơn javac." }
  ]
});
