window.LESSONS.push({
  id: "04",
  phase: "1", phaseName: "Tiến trình & Luồng",
  title: "Luồng (thread) & đa luồng",
  subtitle: "Nhiều đầu bếp cùng một gian bếp",

  theory: `
    <p>Một <strong>tiến trình</strong> giống một <strong>gian bếp riêng</strong>: có nguyên liệu, tủ lạnh,
    bàn bếp của riêng nó (không gian bộ nhớ riêng). Bên trong gian bếp đó, một <strong>luồng (thread)</strong>
    là <em>một đầu bếp</em> đang làm việc — có tay riêng, đang đứng ở một công đoạn riêng.</p>
    <p>Mặc định mỗi tiến trình có <strong>một luồng</strong>. Nhưng ta có thể tạo <strong>nhiều luồng</strong>
    trong cùng tiến trình — nhiều đầu bếp cùng làm trong một gian bếp. Điểm mấu chốt:</p>
    <ul>
      <li>Các luồng trong cùng tiến trình <strong>chia sẻ chung bộ nhớ</strong> (heap, biến toàn cục, file
          đang mở) — như các đầu bếp dùng chung tủ lạnh và bàn bếp.</li>
      <li>Nhưng mỗi luồng có <strong>stack riêng</strong> và <strong>con trỏ lệnh riêng</strong> — mỗi đầu bếp
          có đôi tay và đang ở công đoạn của riêng mình.</li>
    </ul>
    <p>Lợi ích của đa luồng:</p>
    <ul>
      <li><strong>Song song</strong>: trên CPU nhiều nhân, nhiều luồng chạy thật sự cùng lúc → nhanh hơn.</li>
      <li><strong>Phản hồi tốt</strong>: một luồng lo giao diện, luồng khác lo việc nặng → app không "đơ".</li>
      <li><strong>Chia sẻ dễ</strong>: đổi dữ liệu giữa các luồng rẻ vì cùng bộ nhớ (không phải copy).</li>
    </ul>
    <div class="callout"><p>💡 Tạo luồng <em>nhẹ</em> hơn tạo tiến trình (không phải cấp gian bếp mới). Nhưng
    vì dùng chung tủ lạnh, hai đầu bếp có thể với cùng một quả trứng cùng lúc — đó là mầm mống của
    <strong>race condition</strong> mà Phase 2 sẽ mổ xẻ.</p></div>
  `,

  codeTabs: [
    { id: "pthread", label: "🧵 Tạo luồng (C)", lines: [
      "#include <pthread.h>",
      "int counter = 0;              // biến DÙNG CHUNG giữa các luồng",
      "",
      "void *work(void *arg) {",
      "    counter++;                // mọi luồng thấy cùng 'counter'",
      "    return NULL;",
      "}",
      "int main() {",
      "    pthread_t t1, t2;",
      "    pthread_create(&t1, NULL, work, NULL);  // đầu bếp 1",
      "    pthread_create(&t2, NULL, work, NULL);  // đầu bếp 2",
      "    pthread_join(t1, NULL);   // chờ luồng 1 xong",
      "    pthread_join(t2, NULL);   // chờ luồng 2 xong",
      "}"
    ]},
    { id: "vs", label: "⚖️ Thread vs Process", lines: [
      "# THREAD (cùng tiến trình)   | PROCESS (riêng)",
      "chung heap + biến toàn cục   | bộ nhớ riêng biệt",
      "stack riêng mỗi luồng        | mọi thứ riêng",
      "tạo NHANH, nhẹ               | tạo chậm, nặng hơn",
      "chia dữ liệu = truy cập chung| phải qua IPC (bài 06)",
      "một luồng sập có thể kéo cả  | tiến trình cách ly, an toàn hơn",
      "tiến trình sập theo          |"
    ]}
  ],

  stageHtml: `
    <div class="node" id="proc"><div class="nl">🏠 Tiến trình (gian bếp)</div><div class="ns">một không gian bộ nhớ riêng, PID riêng</div></div>
    <div class="arrow" id="a1">↓ chứa vùng dùng chung + nhiều luồng</div>
    <div class="node" id="shared"><div class="nl">🧊 Bộ nhớ dùng chung</div><div class="ns">heap, biến toàn cục, file đang mở — mọi luồng thấy</div></div>
    <div class="row" id="threads">
      <div class="node" id="t1"><div class="nl">🧵 Luồng 1</div><div class="ns">stack + con trỏ lệnh riêng</div></div>
      <div class="node" id="t2"><div class="nl">🧵 Luồng 2</div><div class="ns">stack + con trỏ lệnh riêng</div></div>
    </div>
    <div class="arrow" id="a2">↓ hai luồng cùng đụng 'counter'</div>
    <div class="node" id="risk"><div class="nl">⚠️ Nguy cơ tranh chấp</div><div class="ns">với cùng dữ liệu → cần đồng bộ (Phase 2)</div></div>
  `,
  steps: [
    { title: "1 · Tiến trình là gian bếp", tab: "vs", highlight: [2, 3], on: ["proc", "a1", "shared"],
      desc: "Mỗi <strong>tiến trình</strong> có không gian bộ nhớ riêng. Bên trong chứa vùng <strong>dùng chung</strong> (heap, biến toàn cục) mà mọi luồng của nó đều thấy." },
    { title: "2 · Nhiều luồng cùng bếp", tab: "pthread", highlight: [9, 10, 11], on: ["shared", "t1", "t2"],
      desc: "<code>pthread_create</code> tạo thêm <strong>luồng</strong>. Hai luồng cùng chạy hàm <code>work</code>, cùng thấy biến <code>counter</code> — như hai đầu bếp dùng chung tủ lạnh." },
    { title: "3 · Mỗi luồng có stack riêng", tab: "vs", highlight: [3], on: ["t1", "t2"],
      desc: "Dù chung heap, mỗi luồng vẫn có <strong>stack riêng</strong> và <strong>con trỏ lệnh riêng</strong> — mỗi đầu bếp có đôi tay và đang ở công đoạn của mình." },
    { title: "4 · Vì sao nhẹ và nhanh", tab: "vs", highlight: [4, 5], on: ["proc", "shared"],
      desc: "Tạo luồng <strong>nhẹ</strong> hơn tạo tiến trình (không cấp gian bếp mới), và chia dữ liệu <strong>rẻ</strong> vì dùng chung bộ nhớ — không phải copy qua IPC." },
    { title: "5 · Mầm mống tranh chấp", tab: "pthread", highlight: [5], on: ["shared", "a2", "risk"],
      desc: "Chính vì dùng chung, hai luồng có thể sửa <code>counter</code> cùng lúc và giẫm lên nhau. Đó là <strong>race condition</strong> — Phase 2 sẽ giải quyết." }
  ],

  quiz: [
    { q: "Các luồng trong cùng một tiến trình chia sẻ điều gì?", options: [
        "Không chia sẻ gì, mỗi luồng hoàn toàn độc lập",
        "Chung không gian bộ nhớ tiến trình (heap, biến toàn cục, file mở), nhưng mỗi luồng có stack riêng",
        "Chung stack nhưng heap riêng",
        "Chung cả PID lẫn stack, không có gì riêng"
      ], correct: 1,
      explanation: "Luồng dùng chung heap/biến toàn cục/file của tiến trình, nhưng mỗi luồng giữ stack và con trỏ lệnh riêng." },
    { q: "Vì sao tạo một luồng thường nhẹ hơn tạo một tiến trình mới?", options: [
        "Vì tiến trình phải được cấp không gian bộ nhớ mới, còn luồng dùng lại bộ nhớ của tiến trình sẵn có",
        "Vì luồng không cần chạy trên CPU",
        "Vì luồng luôn chạy trong kernel mode",
        "Vì luồng không có stack"
      ], correct: 0,
      explanation: "Tạo tiến trình phải dựng cả 'gian bếp' bộ nhớ mới; tạo luồng chỉ thêm một stack trong bếp đã có." },
    { q: "Đâu là một lợi ích của đa luồng cho ứng dụng có giao diện?", options: [
        "Giao diện tự đẹp hơn",
        "Ứng dụng tốn ít RAM hơn hẳn",
        "Một luồng lo giao diện, luồng khác lo việc nặng, nên app không bị 'đơ' khi xử lý",
        "Tự động chống được virus"
      ], correct: 2,
      explanation: "Tách việc nặng sang luồng khác giúp luồng giao diện luôn phản hồi mượt." },
    { q: "Điểm khác biệt về an toàn giữa luồng và tiến trình là gì?", options: [
        "Luồng luôn an toàn hơn tiến trình",
        "Cả hai không bao giờ ảnh hưởng lẫn nhau",
        "Tiến trình dùng chung bộ nhớ, luồng thì không",
        "Các tiến trình cách ly bộ nhớ nên một tiến trình sập ít ảnh hưởng tiến trình khác; luồng dùng chung bộ nhớ nên một luồng lỗi có thể kéo cả tiến trình sập"
      ], correct: 3,
      explanation: "Tiến trình cách ly nhau; các luồng cùng tiến trình chia bộ nhớ nên lỗi lan dễ hơn — đổi lại chia dữ liệu rẻ." }
  ]
});
