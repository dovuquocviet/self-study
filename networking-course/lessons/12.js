window.LESSONS.push({
  id: "12",
  phase: "4", phaseName: "Tầng ứng dụng",
  title: "HTTPS & TLS: mã hoá và tin cậy",
  subtitle: "TLS handshake, chứng chỉ, và khoá đối xứng / bất đối xứng",

  theory: `
    <p>HTTP thường gửi dữ liệu <em>trần</em>: ai chặn được đường truyền đều đọc được mật khẩu, số thẻ.
    <strong>HTTPS</strong> chính là HTTP chạy bên trong một lớp bảo vệ tên là <strong>TLS</strong>. Ổ khoá
    nhỏ trên thanh địa chỉ trình duyệt chính là dấu hiệu của lớp này.</p>
    <p>TLS giải quyết hai câu hỏi: <strong>(1) Bí mật</strong> — không ai giữa đường đọc được; và
    <strong>(2) Tin cậy</strong> — bạn có chắc đang nói chuyện với đúng ngân hàng, không phải kẻ giả mạo?</p>
    <p>Để hiểu, cần phân biệt hai loại khoá:</p>
    <ul>
      <li><strong>Bất đối xứng</strong>: một cặp khoá <em>công khai</em> + <em>riêng tư</em>. Cái gì khoá
          công khai mã hoá thì chỉ khoá riêng tư mở được. Rất tiện để trao đổi bí mật ban đầu, nhưng chậm.</li>
      <li><strong>Đối xứng</strong>: <em>một</em> khoá chung dùng cả mã hoá lẫn giải mã. Rất nhanh, hợp để
          mã hoá cả phiên — nhưng làm sao hai bên có chung khoá mà không bị lộ?</li>
    </ul>
    <p>TLS kết hợp cả hai: dùng <strong>bất đối xứng</strong> để hai bên bí mật thống nhất một
    <strong>khoá đối xứng</strong> tạm thời, rồi dùng khoá đối xứng đó mã hoá toàn bộ dữ liệu (nhanh). Về
    tin cậy, server xuất trình một <strong>chứng chỉ (certificate)</strong> do một tổ chức uy tín (CA) ký,
    xác nhận 'khoá công khai này đúng là của example.com'.</p>
    <div class="callout"><p>💡 Ví như gửi một chiếc <em>hộp khoá mở</em> (khoá công khai) cho người kia để họ
    bỏ bí mật vào và bấm lại — chỉ bạn có chìa (khoá riêng tư) mở được. Chứng chỉ do CA ký giống con dấu
    công chứng bảo đảm chiếc hộp đúng là của bạn, không phải hàng giả.</p></div>
  `,

  codeTabs: [
    { id: "hs", label: "🤝 TLS handshake", lines: [
      "# Bắt tay bảo mật trước khi gửi HTTP",
      "client -> server : ClientHello   # 'chào, tôi hỗ trợ các bộ mã này'",
      "server -> client : ServerHello + chứng chỉ  # kèm khoá công khai",
      "client           : kiểm tra chứng chỉ do CA tin cậy ký?",
      "client <-> server: thống nhất khoá đối xứng phiên (bí mật)",
      "cả hai           : từ đây mã hoá bằng khoá đối xứng (nhanh)",
      "# → sau đó mới gửi GET / HTTP/1.1 an toàn"
    ]},
    { id: "cert", label: "📜 Kiểm chứng chỉ", lines: [
      "# Xem chứng chỉ mà server xuất trình",
      "$ openssl s_client -connect example.com:443",
      "  subject: CN = example.com        # cấp cho ai",
      "  issuer:  CN = R3, O = Let's Encrypt  # CA ký",
      "  verify return: 0 (ok)            # chuỗi tin cậy hợp lệ",
      "# ổ khoá trên trình duyệt = xác thực này đã pass"
    ]}
  ],

  stageHtml: `
    <div class="node" id="cli"><div class="nl">💻 Trình duyệt</div><div class="ns">mở https://example.com</div></div>
    <div class="arrow" id="a1">↓ ClientHello (các bộ mã hỗ trợ)</div>
    <div class="node" id="srv"><div class="nl">🖥️ Server</div><div class="ns">ServerHello + chứng chỉ (khoá công khai)</div></div>
    <div class="arrow" id="a2">↓ kiểm chứng chỉ do CA tin cậy ký?</div>
    <div class="node" id="key"><div class="nl">🔑 Thống nhất khoá phiên</div><div class="ns">bất đối xứng → chốt khoá đối xứng</div></div>
    <div class="arrow" id="a3">↓ từ đây mọi dữ liệu được mã hoá</div>
    <div class="node" id="safe"><div class="nl">🔒 Kênh an toàn</div><div class="ns">HTTP chạy bên trong, không ai đọc lén</div></div>
  `,
  steps: [
    { title: "1 · Trình duyệt chào", tab: "hs", highlight: [2], on: ["cli", "a1"],
      desc: "Vào <code>https://</code>, trình duyệt gửi <strong>ClientHello</strong> liệt kê các bộ mã hoá nó hỗ trợ. Đây là bước mở màn của TLS, trước khi bất kỳ dữ liệu HTTP nào đi." },
    { title: "2 · Server trình chứng chỉ", tab: "hs", highlight: [3], on: ["cli", "srv"],
      desc: "Server đáp <strong>ServerHello</strong> kèm <strong>chứng chỉ</strong> chứa khoá công khai. Chứng chỉ như tấm căn cước có công chứng, chứng minh danh tính server." },
    { title: "3 · Kiểm tra tin cậy", tab: "cert", highlight: [3, 4, 5], on: ["srv", "a2", "key"],
      desc: "Trình duyệt kiểm chứng chỉ có do một <strong>CA uy tín ký</strong> và đúng tên miền không. Nếu chuỗi tin cậy hợp lệ, ổ khoá hiện lên; nếu không, hiện cảnh báo nguy hiểm." },
    { title: "4 · Thống nhất khoá phiên", tab: "hs", highlight: [4, 5], on: ["key", "a3"],
      desc: "Dùng mã hoá <strong>bất đối xứng</strong>, hai bên bí mật thống nhất một <strong>khoá đối xứng</strong> tạm thời cho phiên này — kết hợp cái an toàn của loại này với cái nhanh của loại kia." },
    { title: "5 · Kênh an toàn", tab: "hs", highlight: [6], on: ["key", "safe"],
      desc: "Từ đây, mọi request/response HTTP được <strong>mã hoá bằng khoá đối xứng</strong> (nhanh). Kẻ nghe lén chỉ thấy dữ liệu vô nghĩa — mật khẩu, số thẻ được bảo vệ." }
  ],

  quiz: [
    { q: "HTTPS về bản chất là gì?", options: [
        "Một giao thức hoàn toàn khác, thay thế HTTP",
        "HTTP chạy bên trong một lớp bảo mật TLS (mã hoá + xác thực)",
        "HTTP nhưng nén dữ liệu lại cho nhỏ",
        "HTTP chỉ dùng cho ngân hàng"
      ], correct: 1,
      explanation: "HTTPS là HTTP đặt bên trong TLS; TLS lo mã hoá (bí mật) và xác thực danh tính server (tin cậy)." },
    { q: "Vì sao TLS dùng cả mã hoá bất đối xứng LẪN đối xứng?", options: [
        "Để mã hoá hai lần cho chắc",
        "Vì luật yêu cầu như vậy",
        "Dùng bất đối xứng để thống nhất bí mật một khoá đối xứng, rồi dùng khoá đối xứng mã hoá cả phiên cho nhanh",
        "Vì đối xứng không thể mã hoá dữ liệu lớn"
      ], correct: 2,
      explanation: "Bất đối xứng an toàn nhưng chậm nên chỉ dùng để trao khoá; đối xứng nhanh nên dùng mã hoá toàn bộ dữ liệu phiên." },
    { q: "Chứng chỉ (certificate) do CA ký giúp giải quyết vấn đề gì?", options: [
        "Bảo đảm bạn đang nói chuyện đúng server, không phải kẻ giả mạo",
        "Tăng tốc độ tải trang",
        "Nén dữ liệu trước khi gửi",
        "Định tuyến gói tin nhanh hơn"
      ], correct: 0,
      explanation: "Chứng chỉ do CA uy tín ký xác nhận khoá công khai đúng là của tên miền đó — giải quyết bài toán tin cậy/danh tính." },
    { q: "Đặc điểm của mã hoá đối xứng là gì?", options: [
        "Dùng một cặp khoá công khai và riêng tư",
        "Không cần khoá nào cả",
        "Chỉ mã hoá được, không giải mã được",
        "Dùng chung một khoá cho cả mã hoá lẫn giải mã, tốc độ nhanh"
      ], correct: 3,
      explanation: "Đối xứng dùng một khoá chung cho cả hai chiều nên rất nhanh; thách thức là làm sao hai bên có chung khoá đó an toàn — TLS giải bằng bất đối xứng." }
  ]
});
