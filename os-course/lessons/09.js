window.LESSONS.push({
  id: "09",
  phase: "3", phaseName: "Bộ nhớ",
  title: "Quản lý bộ nhớ & cấp phát",
  subtitle: "Không gian địa chỉ, stack, heap và phân mảnh",

  theory: `
    <p>Mỗi tiến trình được HĐH trao một <strong>không gian địa chỉ (address space)</strong> — như một
    <strong>bàn làm việc dài</strong> đánh số từ 0 tới hết, nơi tiến trình bày mã lệnh và dữ liệu. Bàn này
    chia thành các vùng có vai trò riêng:</p>
    <ul>
      <li><strong>Code (text)</strong>: mã máy của chương trình, chỉ đọc.</li>
      <li><strong>Data</strong>: biến toàn cục, hằng số — có sẵn từ đầu.</li>
      <li><strong>Heap</strong>: vùng cấp phát <em>động</em> khi chạy (<code>malloc</code>). Nó
          <strong>lớn dần lên</strong> khi bạn xin thêm bộ nhớ.</li>
      <li><strong>Stack</strong>: vùng cho lời gọi hàm — mỗi hàm được gọi đẩy một "khung" (biến cục bộ, địa
          chỉ trả về) lên; hàm trả về thì bóc ra. Nó <strong>lớn dần xuống</strong> phía heap.</li>
    </ul>
    <p>Heap và stack mọc về phía nhau; khoảng trống ở giữa là chỗ để cả hai co giãn.</p>
    <p>Khi cấp phát rồi giải phóng nhiều lần với đủ kích cỡ, bộ nhớ trống bị <strong>xé lẻ</strong> thành
    nhiều mảnh nhỏ rời rạc — gọi là <strong>phân mảnh (fragmentation)</strong>. Như một kệ sách còn tổng cộng
    nhiều chỗ trống nhưng rải rác, không đủ một khoảng liền để nhét cuốn sách dày. Tổng bộ nhớ trống thì đủ,
    nhưng không có <em>khối liền</em> đủ lớn.</p>
    <div class="callout"><p>💡 Xin bộ nhớ mà quên trả (không <code>free</code>) → <strong>rò rỉ bộ nhớ (memory
    leak)</strong>: heap phình mãi tới khi cạn. Trả rồi còn dùng, hoặc trả hai lần → hỏng dữ liệu, sập chương
    trình. Cấp phát đi đôi với giải phóng đúng lúc là kỷ luật sống còn.</p></div>
  `,

  codeTabs: [
    { id: "map", label: "🗺️ Bản đồ bộ nhớ", lines: [
      "# Không gian địa chỉ một tiến trình (địa chỉ thấp -> cao)",
      "0x0000  [ Code ]   mã máy, chỉ đọc",
      "        [ Data ]   biến toàn cục, hằng",
      "        [ Heap ]   malloc cấp phát động  ↓ lớn dần xuống... ↓",
      "        (  trống  )  khoảng đệm cho hai bên co giãn",
      "        [ Stack]   khung lời gọi hàm     ↑ lớn dần lên... ↑",
      "0xFFFF  (đỉnh không gian địa chỉ)"
    ]},
    { id: "alloc", label: "🧱 Cấp phát (C)", lines: [
      "void demo() {",
      "    int local = 5;                 // trên STACK, tự thu hồi khi hàm xong",
      "    int *arr = malloc(100 * 4);    // 100 số int trên HEAP",
      "    if (!arr) return;              // hết bộ nhớ -> malloc trả NULL",
      "    arr[0] = 42;",
      "    free(arr);                     // TRẢ lại heap — nếu quên = rò rỉ",
      "}                                  // 'local' biến mất, 'arr' đã free"
    ]},
    { id: "frag", label: "🧩 Phân mảnh", lines: [
      "# Heap sau nhiều lần cấp phát/giải phóng xen kẽ:",
      "[####][ 8KB ][##][ 6KB ][####][ 10KB trống ]",
      "#  = đang dùng   ;  khoảng = trống",
      "",
      "# Cần 1 khối 20KB liền -> KHÔNG có, dù tổng trống > 20KB",
      "# Đó là phân mảnh: đủ chỗ, nhưng bị xé lẻ rời rạc"
    ]}
  ],

  stageHtml: `
    <div class="node" id="space"><div class="nl">🗺️ Không gian địa chỉ</div><div class="ns">bàn làm việc riêng của tiến trình, đánh số 0..max</div></div>
    <div class="arrow" id="a1">↓ chia thành các vùng</div>
    <div class="row" id="regions">
      <div class="node" id="heap"><div class="nl">📈 Heap</div><div class="ns">malloc/free — lớn dần lên</div></div>
      <div class="node" id="stack"><div class="nl">📚 Stack</div><div class="ns">khung lời gọi hàm — lớn dần xuống</div></div>
    </div>
    <div class="arrow" id="a2">↓ cấp phát rồi giải phóng nhiều lần</div>
    <div class="node" id="frag"><div class="nl">🧩 Phân mảnh</div><div class="ns">trống tổng đủ, nhưng không có khối liền đủ lớn</div></div>
    <div class="arrow" id="a3">↓ quên free</div>
    <div class="node" id="leak"><div class="nl">💧 Rò rỉ bộ nhớ</div><div class="ns">heap phình mãi tới khi cạn</div></div>
  `,
  steps: [
    { title: "1 · Mỗi tiến trình một bàn riêng", tab: "map", highlight: [1, 2, 3], on: ["space", "a1"],
      desc: "HĐH trao mỗi tiến trình một <strong>không gian địa chỉ</strong> riêng, đánh số từ 0. Đầu bàn là <strong>Code</strong> và <strong>Data</strong> — mã lệnh và biến toàn cục." },
    { title: "2 · Heap lớn dần lên", tab: "alloc", highlight: [3, 4, 5], on: ["a1", "heap"],
      desc: "<code>malloc</code> xin bộ nhớ <em>động</em> trên <strong>heap</strong> — dùng khi chưa biết trước cần bao nhiêu. Heap phình to khi bạn xin thêm." },
    { title: "3 · Stack cho lời gọi hàm", tab: "alloc", highlight: [1, 2, 7], on: ["heap", "stack"],
      desc: "Biến cục bộ (<code>local</code>) sống trên <strong>stack</strong>: mỗi lời gọi hàm đẩy một khung lên, hàm trả về thì bóc ra tự động. Heap và stack mọc về phía nhau." },
    { title: "4 · Trả lại đúng lúc", tab: "alloc", highlight: [6], on: ["heap", "a3", "leak"],
      desc: "Heap không tự dọn: xin bằng <code>malloc</code> thì phải trả bằng <code>free</code>. Quên trả → <strong>rò rỉ bộ nhớ</strong>, heap phình mãi tới khi cạn." },
    { title: "5 · Phân mảnh bộ nhớ", tab: "frag", highlight: [2, 5, 6], on: ["stack", "a2", "frag"],
      desc: "Cấp phát/giải phóng nhiều lần xé bộ nhớ trống thành các mảnh nhỏ rời rạc. Tổng trống có thể đủ, nhưng không có <strong>khối liền</strong> đủ lớn — đó là <strong>phân mảnh</strong>." }
  ],

  quiz: [
    { q: "Không gian địa chỉ (address space) của một tiến trình là gì?", options: [
        "Địa chỉ IP mà tiến trình dùng để lên mạng",
        "Dải địa chỉ bộ nhớ riêng, đánh số từ 0, nơi tiến trình bày mã lệnh và dữ liệu",
        "Vị trí file thực thi trên ổ đĩa",
        "Số hiệu PID của tiến trình"
      ], correct: 1,
      explanation: "Mỗi tiến trình có một không gian địa chỉ riêng — như bàn làm việc đánh số — chia thành code, data, heap, stack." },
    { q: "Khác biệt giữa stack và heap là gì?", options: [
        "Stack chứa khung lời gọi hàm và tự thu hồi khi hàm trả về; heap là vùng cấp phát động (malloc) phải tự giải phóng",
        "Stack lưu file, heap lưu biến",
        "Heap chỉ đọc, stack ghi được",
        "Chúng là hai tên gọi của cùng một vùng"
      ], correct: 0,
      explanation: "Stack tự quản theo lời gọi hàm; heap cần bạn xin (malloc) và trả (free) thủ công." },
    { q: "Phân mảnh (fragmentation) bộ nhớ nghĩa là gì?", options: [
        "Bộ nhớ bị nhiễm virus chia nhỏ",
        "RAM bị hỏng vật lý thành nhiều mảnh",
        "Chương trình chạy chậm vì thiếu CPU",
        "Tổng bộ nhớ trống còn đủ, nhưng bị xé thành nhiều mảnh nhỏ rời rạc nên không có khối liền đủ lớn cho một yêu cầu"
      ], correct: 3,
      explanation: "Cấp phát/giải phóng xen kẽ để lại các lỗ trống rải rác; dù tổng đủ, không có khoảng liền đủ lớn — như kệ sách trống rải rác." },
    { q: "Điều gì xảy ra nếu chương trình liên tục malloc mà quên free?", options: [
        "Chương trình tự động nhanh hơn",
        "Heap được nén lại gọn gàng",
        "Rò rỉ bộ nhớ: heap phình dần cho tới khi cạn bộ nhớ",
        "Kernel tự trả bộ nhớ ngay lập tức nên không sao"
      ], correct: 2,
      explanation: "Heap không tự dọn khi bạn còn giữ con trỏ; quên free khiến bộ nhớ đã xin không bao giờ được trả — memory leak." }
  ]
});
