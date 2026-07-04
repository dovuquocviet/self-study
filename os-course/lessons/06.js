window.LESSONS.push({
  id: "06",
  phase: "1", phaseName: "Tiến trình & Luồng",
  title: "Giao tiếp liên tiến trình (IPC)",
  subtitle: "Các gian bếp riêng nói chuyện với nhau thế nào",

  theory: `
    <p>Ở bài 03 ta biết mỗi tiến trình có <strong>không gian bộ nhớ riêng</strong> — nhờ vậy chúng cách ly,
    an toàn. Nhưng cách ly cũng có giá: nếu hai tiến trình cần <em>hợp tác</em> (một cái tạo dữ liệu, cái kia
    xử lý), chúng <strong>không thấy bộ nhớ của nhau</strong>. Cần cơ chế để trao đổi — gọi chung là
    <strong>IPC (Inter-Process Communication)</strong>.</p>
    <p>Ba kiểu IPC hay gặp:</p>
    <ul>
      <li><strong>Pipe (ống dẫn)</strong>: một dòng byte một chiều — cái này ghi vào đầu ống, cái kia đọc ra
          đầu bên kia. Đúng như lệnh shell <code>ls | wc -l</code>: output của <code>ls</code> chảy qua ống
          làm input của <code>wc</code>. Đơn giản, hợp cho quan hệ cha–con.</li>
      <li><strong>Shared memory (bộ nhớ dùng chung)</strong>: kernel cho hai tiến trình cùng ánh xạ tới
          <em>một vùng RAM</em>. Ghi ở đây, tiến trình kia thấy ngay — <strong>nhanh nhất</strong> vì không
          phải copy. Đổi lại, phải tự đồng bộ để không giẫm nhau (Phase 2).</li>
      <li><strong>Message passing (truyền thông điệp)</strong>: gửi/nhận từng <em>gói thông điệp</em> qua
          kernel (hàng đợi thông điệp, socket). Rõ ràng, dễ đồng bộ, hoạt động được cả giữa hai máy khác nhau;
          đổi lại chậm hơn vì kernel phải sao chép dữ liệu.</li>
    </ul>
    <div class="callout"><p>💡 Nguyên tắc chọn: <em>shared memory</em> khi cần tốc độ và chấp nhận tự lo đồng
    bộ; <em>message passing</em> khi muốn rõ ràng, an toàn, hoặc giao tiếp qua mạng; <em>pipe</em> cho luồng
    dữ liệu tuần tự đơn giản kiểu producer → consumer.</p></div>
  `,

  codeTabs: [
    { id: "pipe", label: "🚰 Pipe", lines: [
      "# Output của lệnh trái chảy qua ống làm input lệnh phải",
      "$ ls -1 | wc -l          # đếm số dòng ls in ra",
      "42",
      "",
      "# Trong C: pipe() tạo 2 đầu — fd[0] đọc, fd[1] ghi",
      "int fd[2]; pipe(fd);",
      "write(fd[1], \"hello\", 5); // cha ghi vào ống",
      "read(fd[0], buf, 5);       // con đọc ra từ ống"
    ]},
    { id: "shm", label: "🧊 Shared memory", lines: [
      "# Hai tiến trình cùng ánh xạ MỘT vùng RAM",
      "int id = shmget(key, 4096, IPC_CREAT|0600);",
      "char *p = shmat(id, NULL, 0);  // gắn vùng chung vào",
      "",
      "strcpy(p, \"xin chao\");        // A ghi thẳng vào RAM chung",
      "// → B đọc p thấy ngay, KHÔNG cần copy qua kernel",
      "# Nhanh nhất, nhưng phải tự đồng bộ (mutex, bài 08)"
    ]},
    { id: "msg", label: "✉️ Message passing", lines: [
      "# Gửi/nhận từng gói thông điệp qua kernel",
      "msgsnd(q, &msg, len, 0);   // A gửi 1 thông điệp vào hàng đợi",
      "msgrcv(q, &msg, len, 0);   // B nhận thông điệp ra",
      "",
      "# Ưu: rõ ràng, dễ đồng bộ, chạy được cả qua mạng (socket)",
      "# Nhược: chậm hơn vì kernel phải sao chép dữ liệu"
    ]}
  ],

  stageHtml: `
    <div class="row" id="procs">
      <div class="node" id="pa"><div class="nl">🏠 Tiến trình A</div><div class="ns">tạo dữ liệu (producer)</div></div>
      <div class="node" id="pb"><div class="nl">🏠 Tiến trình B</div><div class="ns">xử lý dữ liệu (consumer)</div></div>
    </div>
    <div class="arrow" id="a1">↓ bộ nhớ riêng → không thấy nhau, cần IPC</div>
    <div class="node" id="pipe"><div class="nl">🚰 Pipe</div><div class="ns">dòng byte một chiều A → B</div></div>
    <div class="arrow" id="a2">↓ hoặc dùng vùng RAM chung</div>
    <div class="node" id="shm"><div class="nl">🧊 Shared memory</div><div class="ns">cùng ánh xạ 1 vùng RAM — nhanh nhất</div></div>
    <div class="arrow" id="a3">↓ hoặc trao thông điệp qua kernel</div>
    <div class="node" id="msg"><div class="nl">✉️ Message passing</div><div class="ns">gửi/nhận gói qua kernel; chạy được qua mạng</div></div>
  `,
  steps: [
    { title: "1 · Hai tiến trình cần hợp tác", tab: "pipe", highlight: [1, 2], on: ["pa", "pb", "a1"],
      desc: "A tạo dữ liệu, B xử lý. Nhưng mỗi tiến trình có <strong>bộ nhớ riêng</strong> — chúng không thấy biến của nhau, nên cần một cơ chế <strong>IPC</strong>." },
    { title: "2 · Pipe: dòng chảy một chiều", tab: "pipe", highlight: [2, 6, 7], on: ["a1", "pipe"],
      desc: "<strong>Pipe</strong> là ống một chiều: A ghi vào đầu ghi, B đọc ở đầu đọc. Lệnh <code>ls | wc -l</code> chính là output của <code>ls</code> chảy qua ống sang <code>wc</code>." },
    { title: "3 · Shared memory: cùng một RAM", tab: "shm", highlight: [2, 3, 5], on: ["a1", "a2", "shm"],
      desc: "<strong>Shared memory</strong> cho A và B cùng ánh xạ <em>một vùng RAM</em>. A ghi vào là B thấy ngay — <strong>nhanh nhất</strong> vì không phải copy." },
    { title: "4 · Cái giá của tốc độ", tab: "shm", highlight: [6, 7], on: ["shm"],
      desc: "Đổi lại, hai tiến trình có thể ghi cùng lúc vào vùng chung và giẫm nhau. Shared memory buộc bạn <strong>tự đồng bộ</strong> bằng khoá (Phase 2)." },
    { title: "5 · Message passing: trao gói", tab: "msg", highlight: [2, 3, 5], on: ["a2", "a3", "msg"],
      desc: "<strong>Message passing</strong> gửi/nhận từng <em>thông điệp</em> qua kernel. Rõ ràng, dễ đồng bộ, và dùng socket thì chạy được cả <strong>giữa hai máy</strong>." },
    { title: "6 · Chọn cơ chế phù hợp", tab: "msg", highlight: [6], on: ["shm", "msg", "pipe"],
      desc: "Cần tốc độ, chấp nhận tự đồng bộ → <strong>shared memory</strong>. Muốn rõ ràng/qua mạng → <strong>message passing</strong>. Luồng tuần tự đơn giản → <strong>pipe</strong>." }
  ],

  quiz: [
    { q: "Vì sao các tiến trình cần cơ chế IPC để trao đổi dữ liệu?", options: [
        "Vì chúng chạy quá nhanh nên cần đồng bộ tốc độ",
        "Vì mỗi tiến trình có không gian bộ nhớ riêng, không thấy biến của tiến trình khác",
        "Vì kernel cấm mọi hình thức chia sẻ dữ liệu",
        "Vì CPU không cho hai tiến trình chạy cùng lúc"
      ], correct: 1,
      explanation: "Bộ nhớ riêng giúp cách ly an toàn, nhưng cũng khiến hai tiến trình không thấy nhau; IPC là cầu nối để chúng hợp tác." },
    { q: "Lệnh shell 'ls | wc -l' minh hoạ cơ chế IPC nào?", options: [
        "Shared memory",
        "Message passing qua mạng",
        "Pipe — output của lệnh trái chảy làm input lệnh phải",
        "Không phải IPC, chỉ là một lệnh duy nhất"
      ], correct: 2,
      explanation: "Dấu '|' tạo một pipe: dòng byte từ ls chảy qua ống thành input cho wc — IPC kiểu producer → consumer." },
    { q: "Vì sao shared memory thường là cơ chế IPC nhanh nhất?", options: [
        "Vì hai tiến trình cùng ánh xạ một vùng RAM, ghi ở đó là bên kia thấy ngay, không phải sao chép qua kernel",
        "Vì nó nén dữ liệu trước khi gửi",
        "Vì kernel ưu tiên nó hơn mọi việc khác",
        "Vì nó bỏ qua CPU hoàn toàn"
      ], correct: 0,
      explanation: "Không phải copy dữ liệu qua kernel như pipe hay message passing, nên shared memory nhanh nhất — đổi lại phải tự đồng bộ." },
    { q: "Ưu điểm nổi bật của message passing so với shared memory là gì?", options: [
        "Luôn nhanh hơn shared memory",
        "Không cần CPU để chạy",
        "Rõ ràng, dễ đồng bộ, và có thể hoạt động cả giữa hai máy khác nhau qua socket",
        "Không cần kernel tham gia"
      ], correct: 2,
      explanation: "Message passing trao từng gói qua kernel nên dễ đồng bộ và, với socket, dùng được qua mạng; đổi lại chậm hơn vì phải sao chép." }
  ]
});
