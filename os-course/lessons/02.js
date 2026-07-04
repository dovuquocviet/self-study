window.LESSONS.push({
  id: "02",
  phase: "0", phaseName: "Tổng quan",
  title: "Từ nút nguồn tới shell: boot & system call",
  subtitle: "Máy khởi động thế nào, và cửa vào kernel ở đâu",

  theory: `
    <p>Bấm nút nguồn, vài giây sau bạn có màn hình đăng nhập. Ở giữa là một chuỗi bàn giao gọn gàng, mỗi
    bước "đánh thức" bước kế rồi trao quyền lại: <strong>firmware → bootloader → kernel → tiến trình đầu tiên
    → shell/giao diện</strong>.</p>
    <ul>
      <li><strong>Firmware (BIOS/UEFI)</strong>: mã nằm sẵn trên bo mạch chủ. Khi bật máy, CPU chạy nó đầu
          tiên; nó kiểm tra phần cứng cơ bản rồi tìm thiết bị để khởi động.</li>
      <li><strong>Bootloader</strong> (GRUB, systemd-boot…): chương trình nhỏ trên ổ đĩa. Việc duy nhất của
          nó là <em>nạp kernel</em> vào bộ nhớ và trao quyền cho kernel.</li>
      <li><strong>Kernel</strong>: nạp driver, dựng bộ nhớ, khởi động tiến trình đầu tiên (<code>init</code>
          / <code>systemd</code>, luôn mang PID 1). Từ đó các dịch vụ và cuối cùng là <em>shell</em> hay màn
          hình đăng nhập xuất hiện.</li>
    </ul>
    <p>Sau khi máy chạy, chương trình user-space cần nhờ kernel làm việc nhạy cảm (đọc file, tạo tiến trình,
    gửi mạng). Nó làm điều đó qua <strong>system call (lời gọi hệ thống)</strong> — <em>cửa chính thức duy
    nhất</em> để đi từ user mode vào kernel mode. Ví dụ: <code>read</code>, <code>write</code>,
    <code>open</code>, <code>fork</code>, <code>exit</code>.</p>
    <div class="callout"><p>💡 System call không phải "gọi hàm bình thường". Nó là một <em>cú chuyển chế độ</em>
    có kiểm soát: CPU nhảy vào một điểm vào cố định của kernel, kernel kiểm tra tham số rồi mới làm — như đưa
    phiếu yêu cầu qua ô cửa kính của ban quản lý.</p></div>
  `,

  codeTabs: [
    { id: "boot", label: "🚀 Chuỗi khởi động", lines: [
      "# Bật nguồn → CPU chạy firmware trên bo mạch",
      "1. UEFI/BIOS : tự kiểm tra phần cứng (POST)",
      "2. Bootloader: nạp kernel từ đĩa vào RAM",
      "3. Kernel    : dựng bộ nhớ, nạp driver",
      "4. init/PID 1: tiến trình gốc, sinh các dịch vụ",
      "5. Shell/GUI : màn hình đăng nhập xuất hiện"
    ]},
    { id: "trace", label: "🔎 Soi system call", lines: [
      "$ strace -e trace=open,read,write ls",
      "openat(AT_FDCWD, \".\", O_RDONLY)   = 3   # xin mở thư mục",
      "read(3, ...)                          = 512 # nhờ kernel đọc",
      "write(1, \"file1  file2\\n\", 12)     = 12  # in ra màn hình",
      "# Mỗi dòng = một lần vượt cửa user → kernel",
      "# 'ls' tự nó không đụng đĩa; nó XIN kernel làm hộ"
    ]}
  ],

  stageHtml: `
    <div class="node" id="power"><div class="nl">🔌 Nút nguồn</div><div class="ns">CPU bắt đầu chạy firmware</div></div>
    <div class="arrow" id="a1">↓ POST xong, tìm thiết bị boot</div>
    <div class="node" id="boot"><div class="nl">📀 Bootloader</div><div class="ns">nạp kernel vào RAM</div></div>
    <div class="arrow" id="a2">↓ trao quyền cho kernel</div>
    <div class="node" id="kernel"><div class="nl">🛡️ Kernel + init (PID 1)</div><div class="ns">dựng hệ thống, mở cửa system call</div></div>
    <div class="arrow" id="a3">↓ sinh shell; app bắt đầu gọi hệ thống</div>
    <div class="node" id="shell"><div class="nl">⌨️ Shell / ứng dụng</div><div class="ns">gọi read/write/fork qua system call</div></div>
  `,
  steps: [
    { title: "1 · Firmware chạy đầu tiên", tab: "boot", highlight: [1, 2], on: ["power"],
      desc: "Bật nguồn, CPU chạy <strong>firmware (UEFI/BIOS)</strong> nằm sẵn trên bo mạch. Nó tự kiểm tra phần cứng (POST) rồi tìm ổ đĩa nào để khởi động." },
    { title: "2 · Bootloader nạp kernel", tab: "boot", highlight: [3], on: ["power", "a1", "boot"],
      desc: "<strong>Bootloader</strong> trên đĩa có một việc: đọc <strong>kernel</strong> vào RAM và trao quyền cho nó. Xong nhiệm vụ, nó rút lui." },
    { title: "3 · Kernel dựng hệ thống", tab: "boot", highlight: [4, 5], on: ["boot", "a2", "kernel"],
      desc: "<strong>Kernel</strong> nạp driver, dựng bộ nhớ, rồi khởi động <strong>init/systemd (PID 1)</strong> — tiến trình gốc sinh ra mọi tiến trình khác." },
    { title: "4 · Shell xuất hiện", tab: "boot", highlight: [6], on: ["kernel", "a3", "shell"],
      desc: "Các dịch vụ khởi động xong, bạn thấy <strong>shell</strong> hoặc màn hình đăng nhập. Máy giờ sẵn sàng chạy ứng dụng của bạn." },
    { title: "5 · Ứng dụng gọi system call", tab: "trace", highlight: [2, 3, 4], on: ["shell", "kernel"],
      desc: "Chạy <code>ls</code>: mỗi <code>openat</code>/<code>read</code>/<code>write</code> là một <strong>system call</strong> — cú vượt cửa từ user mode vào kernel. App tự nó không đụng đĩa, nó nhờ kernel." },
    { title: "6 · Cửa vào được kiểm soát", tab: "trace", highlight: [5, 6], on: ["shell", "kernel"],
      desc: "System call là <em>cửa chính thức duy nhất</em> vào kernel. Kernel kiểm tra tham số trước khi làm, nên user space không thể ra lệnh bậy cho phần cứng." }
  ],

  quiz: [
    { q: "Thứ tự đúng của chuỗi khởi động là gì?", options: [
        "Kernel → firmware → bootloader → shell",
        "Firmware (BIOS/UEFI) → bootloader → kernel → init → shell",
        "Bootloader → shell → kernel → firmware",
        "Shell → kernel → bootloader → firmware"
      ], correct: 1,
      explanation: "Bật nguồn: firmware chạy trước, nạp bootloader, bootloader nạp kernel, kernel khởi động init (PID 1), cuối cùng là shell/GUI." },
    { q: "Nhiệm vụ chính của bootloader là gì?", options: [
        "Kiểm tra toàn bộ phần cứng và sửa lỗi",
        "Chạy các ứng dụng của người dùng",
        "Nạp kernel vào bộ nhớ rồi trao quyền cho nó",
        "Đăng nhập tài khoản người dùng"
      ], correct: 2,
      explanation: "Bootloader là chương trình nhỏ, việc duy nhất là đưa kernel vào RAM và chuyển quyền điều khiển cho kernel." },
    { q: "System call là gì?", options: [
        "Cửa được kiểm soát để chương trình user-space nhờ kernel làm việc nhạy cảm",
        "Một cuộc gọi điện thoại tới nhà cung cấp hệ điều hành",
        "Cách kernel gọi vào ứng dụng người dùng",
        "Một loại virus tấn công nhân hệ thống"
      ], correct: 0,
      explanation: "System call (open, read, write, fork…) là cửa chính thức duy nhất để đi từ user mode vào kernel mode, có kiểm tra tham số." },
    { q: "Khi lệnh 'ls' liệt kê file, thực chất nó đọc đĩa như thế nào?", options: [
        "Nó gửi tín hiệu điện trực tiếp tới ổ cứng",
        "Nó xin kernel đọc hộ thông qua các system call như openat/read",
        "Nó nạp lại bootloader để truy cập đĩa",
        "Nó không đọc đĩa mà đoán tên file"
      ], correct: 1,
      explanation: "'ls' chạy ở user mode nên không đụng đĩa; nó phát các system call để kernel — vốn có quyền — đọc thư mục hộ." }
  ]
});
