window.LESSONS.push({
  id: "11",
  phase: "4", phaseName: "Tầng ứng dụng",
  title: "HTTP: vòng đời một request",
  subtitle: "Method, status code, header và cặp request/response",

  theory: `
    <p><strong>HTTP</strong> là 'ngôn ngữ' mà trình duyệt và web server dùng để nói chuyện. Nó theo mẫu
    hỏi–đáp rất rõ ràng: client gửi một <strong>request</strong>, server trả một <strong>response</strong>.
    Mỗi lần bạn bấm một liên kết là một (hoặc nhiều) vòng như vậy.</p>
    <p>Một request gồm ba phần: <strong>method</strong> (muốn làm gì), <strong>đường dẫn</strong> (làm với
    tài nguyên nào), và các <strong>header</strong> (thông tin kèm theo), đôi khi cả <strong>body</strong>
    (dữ liệu gửi lên).</p>
    <ul>
      <li><strong>GET</strong>: lấy dữ liệu (đọc một trang). <strong>POST</strong>: gửi dữ liệu (đăng nhập,
          tạo mới). <strong>PUT</strong>: cập nhật. <strong>DELETE</strong>: xoá.</li>
      <li><strong>Header</strong>: cặp 'tên: giá trị' như <code>Host</code>, <code>Content-Type</code>,
          <code>Cookie</code> — mô tả yêu cầu/hồi đáp mà không nằm trong nội dung chính.</li>
    </ul>
    <p>Response mở đầu bằng một <strong>status code</strong> ba chữ số cho biết kết quả. Chữ số đầu chia
    thành nhóm: <strong>2xx</strong> thành công, <strong>3xx</strong> chuyển hướng, <strong>4xx</strong>
    lỗi phía client (yêu cầu sai), <strong>5xx</strong> lỗi phía server.</p>
    <div class="callout"><p>💡 HTTP là <em>phi trạng thái (stateless)</em>: mỗi request tự nó độc lập, server
    không tự nhớ bạn là ai giữa hai request. Để 'nhớ' (đăng nhập, giỏ hàng), người ta gửi kèm
    <strong>Cookie</strong> hoặc token trong header mỗi lần.</p></div>
  `,

  codeTabs: [
    { id: "req", label: "📤 Request", lines: [
      "# Client hỏi: cho tôi trang /products",
      "GET /products HTTP/1.1        # method + đường dẫn",
      "Host: shop.example.com        # hỏi host nào",
      "Accept: text/html",
      "Cookie: session=abc123        # 'nhớ' phiên đăng nhập",
      "# GET không có body — chỉ là yêu cầu đọc"
    ]},
    { id: "res", label: "📥 Response", lines: [
      "# Server trả kết quả kèm status code",
      "HTTP/1.1 200 OK               # 2xx = thành công",
      "Content-Type: text/html",
      "Content-Length: 3820",
      "",
      "<!doctype html> ... trang sản phẩm ...",
      "# 404 = client hỏi sai, 500 = server lỗi"
    ]}
  ],

  stageHtml: `
    <div class="node" id="cli"><div class="nl">💻 Trình duyệt</div><div class="ns">soạn request GET /products</div></div>
    <div class="arrow" id="a1">↓ gửi method + đường dẫn + header</div>
    <div class="node" id="srv"><div class="nl">🖥️ Web server</div><div class="ns">đọc request, tìm tài nguyên</div></div>
    <div class="arrow" id="a2">↑ trả status code + header + body</div>
    <div class="node" id="resp"><div class="nl">📄 Response 200 OK</div><div class="ns">HTML trang sản phẩm</div></div>
    <div class="arrow" id="a3">↓ trình duyệt dựng trang, tải tiếp ảnh/CSS</div>
    <div class="node" id="page"><div class="nl">✅ Trang hiển thị</div><div class="ns">mỗi tài nguyên = một vòng HTTP</div></div>
  `,
  steps: [
    { title: "1 · Soạn request", tab: "req", highlight: [2, 3], on: ["cli", "a1"],
      desc: "Trình duyệt tạo request với <strong>method</strong> (<code>GET</code>), <strong>đường dẫn</strong> (<code>/products</code>) và <strong>Host</strong> — cho server biết muốn gì và ở đâu." },
    { title: "2 · Header đi kèm", tab: "req", highlight: [4, 5], on: ["cli"],
      desc: "Các <strong>header</strong> mang thông tin phụ: <code>Accept</code> (định dạng mong muốn), <code>Cookie</code> (để server 'nhớ' phiên). HTTP phi trạng thái nên cần cookie để nhận ra bạn." },
    { title: "3 · Server xử lý", tab: "res", highlight: [2], on: ["cli", "srv", "a2"],
      desc: "Server đọc request, tìm tài nguyên, rồi mở đầu response bằng <strong>status code</strong>. <code>200 OK</code> nghĩa là thành công (nhóm 2xx)." },
    { title: "4 · Trả header & body", tab: "res", highlight: [3, 4, 6], on: ["srv", "resp"],
      desc: "Response gồm header (<code>Content-Type</code>, <code>Content-Length</code>) và <strong>body</strong> chứa nội dung thật — ở đây là HTML trang sản phẩm." },
    { title: "5 · Dựng trang, lặp lại", tab: "res", highlight: [7], on: ["resp", "a3", "page"],
      desc: "Trình duyệt đọc HTML, rồi phát <strong>thêm request</strong> cho mỗi ảnh, CSS, JS. Nhiều status khác nhau có thể xuất hiện: <code>404</code> nếu hỏi sai, <code>500</code> nếu server lỗi." }
  ],

  quiz: [
    { q: "Trong HTTP, method GET và POST khác nhau cơ bản ở điểm nào?", options: [
        "GET dùng để lấy dữ liệu, POST dùng để gửi dữ liệu lên server",
        "GET mã hoá còn POST thì không",
        "GET chỉ chạy trên HTTPS, POST chạy trên HTTP",
        "Không khác gì nhau"
      ], correct: 0,
      explanation: "GET để đọc/lấy tài nguyên; POST để gửi dữ liệu lên (đăng nhập, tạo mới), thường kèm body." },
    { q: "Status code nhóm 4xx (ví dụ 404) cho biết điều gì?", options: [
        "Yêu cầu thành công",
        "Trang đã chuyển hướng sang địa chỉ khác",
        "Lỗi phía client — yêu cầu sai (ví dụ tài nguyên không tồn tại)",
        "Lỗi phía server"
      ], correct: 2,
      explanation: "4xx là lỗi phía client: 404 nghĩa là tài nguyên không tìm thấy. 5xx mới là lỗi phía server." },
    { q: "HTTP là 'phi trạng thái (stateless)' nghĩa là gì?", options: [
        "Dữ liệu luôn được nén trước khi gửi",
        "Mỗi request độc lập; server không tự nhớ bạn giữa hai request",
        "Chỉ gửi được một request cho mỗi kết nối",
        "Server luôn giữ trạng thái đăng nhập vĩnh viễn"
      ], correct: 1,
      explanation: "Mỗi request tự đứng riêng; muốn server 'nhớ' (đăng nhập, giỏ hàng) phải gửi kèm Cookie/token mỗi lần." },
    { q: "Header HTTP dùng để làm gì?", options: [
        "Chứa toàn bộ nội dung chính của trang web",
        "Định tuyến gói tin qua router",
        "Đánh số thứ tự các gói TCP",
        "Mang thông tin phụ mô tả request/response (Host, Content-Type, Cookie...)"
      ], correct: 3,
      explanation: "Header là các cặp 'tên: giá trị' mô tả yêu cầu/hồi đáp, tách biệt với nội dung chính nằm trong body." }
  ]
});
