window.LESSONS.push({
  id: "01",
  phase: "0", phaseName: "Tổng quan",
  title: "Hệ điều hành là gì? Kernel vs user space",
  subtitle: "Người quản lý tài nguyên và ranh giới đặc quyền",

  theory: `
    <p>Một <strong>hệ điều hành (HĐH)</strong> là phần mềm đứng giữa <em>phần cứng</em> (CPU, RAM, ổ đĩa,
    bàn phím…) và <em>các chương trình của bạn</em> (trình duyệt, game, editor). Nó là <strong>người quản lý
    tài nguyên</strong>: quyết định chương trình nào được chạy trên CPU, được cấp bao nhiêu bộ nhớ, được đọc
    ghi file nào — sao cho hàng chục chương trình chạy cùng lúc mà không giẫm chân nhau.</p>
    <p>Hãy hình dung một <strong>toà nhà văn phòng</strong>: nhân viên (chương trình) không tự ý bật máy phát
    điện hay mở kho. Họ gọi cho <em>ban quản lý</em> (HĐH) để xin. Ban quản lý có chìa khoá vạn năng; nhân
    viên thì không. Đó chính là ý tưởng <strong>hai chế độ đặc quyền</strong>.</p>
    <ul>
      <li><strong>Kernel (nhân)</strong>: phần lõi của HĐH, chạy ở <em>chế độ đặc quyền (kernel mode)</em> —
          được đụng thẳng vào phần cứng, cấu hình bộ nhớ, điều khiển thiết bị.</li>
      <li><strong>User space</strong>: nơi các chương trình thường chạy, ở <em>chế độ hạn chế (user mode)</em>
          — <strong>không</strong> được đụng thẳng phần cứng, phải nhờ kernel.</li>
      <li>CPU có một <strong>bit chế độ</strong> phân biệt hai vùng này. Lệnh "nguy hiểm" (truy cập đĩa, đổi
          bảng bộ nhớ) chỉ chạy được ở kernel mode; ở user mode sẽ bị CPU chặn ngay.</li>
    </ul>
    <div class="callout"><p>💡 Ranh giới kernel/user là <em>lá chắn bảo vệ</em>: một chương trình lỗi hay
    độc hại cũng không thể làm sập cả máy, vì nó bị nhốt trong user space và mọi thao tác nhạy cảm đều phải
    xin phép kernel.</p></div>
  `,

  codeTabs: [
    { id: "layers", label: "🏗️ Các tầng", lines: [
      "# Từ dưới lên trên: ai đứng ở đâu",
      "Phần cứng      : CPU, RAM, ổ đĩa, card mạng",
      "  Kernel        : chạy KERNEL MODE — chìa khoá vạn năng",
      "    Thư viện     : libc, cung cấp hàm bọc system call",
      "      Ứng dụng   : chạy USER MODE — phải xin phép",
      "# Ứng dụng KHÔNG nói chuyện thẳng với phần cứng"
    ]},
    { id: "check", label: "🔒 Chế độ đặc quyền", lines: [
      "$ id                    # xem quyền của tiến trình hiện tại",
      "uid=1000(an) gid=1000",
      "",
      "$ cat /proc/cpuinfo     # đọc thông tin CPU do kernel trình bày",
      "# → 'cat' chạy ở user mode, nhờ kernel đọc hộ thông tin phần cứng",
      "",
      "# Thử đụng thẳng phần cứng ở user mode → CPU chặn:",
      "# Segmentation fault (bị kernel bắt lỗi và dừng)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">🧩 Ứng dụng (user space)</div><div class="ns">trình duyệt, game, editor — user mode</div></div>
    <div class="arrow" id="a1">↓ muốn đọc file / vẽ màn hình → phải nhờ</div>
    <div class="node" id="lib"><div class="nl">📚 Thư viện (libc)</div><div class="ns">hàm bọc, chuyển yêu cầu xuống kernel</div></div>
    <div class="arrow" id="a2">↓ vượt ranh giới đặc quyền</div>
    <div class="node" id="kernel"><div class="nl">🛡️ Kernel</div><div class="ns">kernel mode — được đụng phần cứng</div></div>
    <div class="arrow" id="a3">↓ điều khiển trực tiếp</div>
    <div class="node" id="hw"><div class="nl">⚙️ Phần cứng</div><div class="ns">CPU, RAM, ổ đĩa, thiết bị</div></div>
  `,
  steps: [
    { title: "1 · Ứng dụng ở user space", tab: "layers", highlight: [5, 6], on: ["app"],
      desc: "Chương trình của bạn chạy ở <strong>user mode</strong> — vùng bị hạn chế. Nó không được tự tay đọc ổ đĩa hay đổi bảng bộ nhớ; CPU sẽ chặn nếu cố." },
    { title: "2 · Nhờ thư viện chuyển tiếp", tab: "layers", highlight: [4], on: ["app", "a1", "lib"],
      desc: "Ứng dụng gọi một hàm trong <strong>thư viện</strong> (ví dụ <code>read()</code> trong libc). Thư viện đóng vai người phiên dịch, chuẩn bị yêu cầu để gửi xuống kernel." },
    { title: "3 · Vượt ranh giới vào kernel", tab: "layers", highlight: [3], on: ["lib", "a2", "kernel"],
      desc: "Yêu cầu vượt <strong>ranh giới đặc quyền</strong> từ user mode sang <strong>kernel mode</strong>. CPU bật bit chế độ, giờ kernel mới có quyền làm việc nhạy cảm." },
    { title: "4 · Kernel điều khiển phần cứng", tab: "layers", highlight: [2, 3], on: ["kernel", "a3", "hw"],
      desc: "Chỉ <strong>kernel</strong> mới được ra lệnh thẳng cho <strong>phần cứng</strong> — đọc đĩa, gửi gói mạng. Nó là lớp duy nhất cầm 'chìa khoá vạn năng'." },
    { title: "5 · Vì sao cần ranh giới này", tab: "check", highlight: [7, 8], on: ["app", "kernel"],
      desc: "Nếu app cố đụng thẳng phần cứng, CPU chặn và kernel dừng nó (<code>Segmentation fault</code>). Nhờ vậy một app lỗi không kéo sập cả máy." }
  ],

  quiz: [
    { q: "Vai trò cốt lõi của một hệ điều hành là gì?", options: [
        "Vẽ giao diện đẹp cho người dùng",
        "Quản lý và phân phối tài nguyên phần cứng cho các chương trình chạy cùng lúc",
        "Biên dịch mã nguồn thành mã máy",
        "Kết nối máy tính với Internet"
      ], correct: 1,
      explanation: "HĐH là người quản lý tài nguyên: chia CPU, bộ nhớ, thiết bị cho nhiều chương trình sao cho chúng không giẫm chân nhau." },
    { q: "Sự khác nhau then chốt giữa kernel mode và user mode là gì?", options: [
        "Kernel mode chạy nhanh hơn user mode nhờ nhiều RAM hơn",
        "User mode dành cho lập trình viên, kernel mode dành cho người dùng thường",
        "Kernel mode được đụng thẳng phần cứng; user mode bị hạn chế và phải nhờ kernel",
        "Không có khác biệt, chỉ là hai tên gọi"
      ], correct: 2,
      explanation: "CPU có bit chế độ: lệnh nhạy cảm (truy cập đĩa, đổi bảng bộ nhớ) chỉ chạy được ở kernel mode; user mode bị chặn." },
    { q: "Vì sao đặt ứng dụng vào user space lại giúp máy an toàn hơn?", options: [
        "Một app lỗi hay độc hại bị nhốt trong user mode, không thể tự đụng phần cứng để làm sập cả máy",
        "User space có phần mềm diệt virus tích hợp sẵn",
        "Ứng dụng trong user space chạy chậm nên ít gây hại",
        "Kernel sao chép mọi app để dự phòng"
      ], correct: 0,
      explanation: "Ranh giới đặc quyền là lá chắn: mọi thao tác nhạy cảm phải xin kernel, nên lỗi của một app bị cô lập." },
    { q: "Khi một chương trình user-space muốn đọc một file trên đĩa, nó phải làm gì?", options: [
        "Tự gửi lệnh trực tiếp tới ổ đĩa",
        "Khởi động lại máy để vào kernel mode",
        "Nhờ kernel thực hiện thay, qua cửa được kiểm soát (system call)",
        "Không thể đọc file, đó là việc riêng của kernel"
      ], correct: 2,
      explanation: "Ứng dụng không đụng thẳng phần cứng; nó yêu cầu kernel làm hộ thông qua cửa được kiểm soát — chính là system call (bài sau)." }
  ]
});
