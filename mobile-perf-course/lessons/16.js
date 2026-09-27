window.LESSONS.push({
  id: "16",
  phase: "4", phaseName: "Tài nguyên: bộ nhớ, mạng, pin, dung lượng",
  title: "Mạng: ít request hơn, nhỏ hơn, sớm hơn",
  subtitle: "Waterfall · batch/BFF · HTTP cache & ETag · prefetch · nén · HTTP/2-3 · cache phía client · mạng yếu",

  theory: `
    <p>Trên mobile, <strong>độ trễ (latency) quan trọng hơn băng thông</strong>. Mạng 4G có thể có RTT 50–150 ms, mạng yếu vài trăm ms; mỗi request tuần tự cộng thêm ít nhất một RTT
    (chưa kể DNS, TCP/TLS handshake nếu chưa có kết nối). Màn hình gọi 6 API <em>nối tiếp nhau</em> có thể mất hơn 1 giây chỉ vì chờ.</p>

    <p><strong>Bốn hướng tối ưu</strong></p>
    <ol>
      <li><strong>Ít request hơn</strong>
        <ul>
          <li>Phá <em>waterfall</em>: request không phụ thuộc nhau thì gọi song song (<code>async/await</code> song song, <code>Promise.all</code>).</li>
          <li><strong>BFF / endpoint theo màn hình</strong>: một request trả đủ dữ liệu cho màn (backend Rust/Worker gom từ nhiều service). GraphQL cũng giải quyết việc này.</li>
          <li>Gom sự kiện analytics/log thành lô thay vì gửi từng cái.</li>
        </ul>
      </li>
      <li><strong>Nhỏ hơn</strong>: nén <code>gzip</code>/<code>br</code> (OkHttp và URLSession tự gửi <code>Accept-Encoding</code> và giải nén), chỉ trả trường cần, phân trang, ảnh đúng cỡ (bài 13).</li>
      <li><strong>Không tải lại cái đã có</strong>: HTTP cache (<code>Cache-Control: max-age</code>), request có điều kiện (<code>ETag</code> → <code>If-None-Match</code> → <code>304 Not Modified</code> không có body).
      OkHttp cần cấu hình <code>Cache</code>; URLSession có <code>URLCache</code> mặc định. Cache ở tầng dữ liệu: TanStack Query/Apollo (RN), Room/SwiftData (native) — hiện dữ liệu cũ ngay, làm mới sau (<em>stale-while-revalidate</em>).</li>
      <li><strong>Sớm hơn</strong>: <strong>prefetch</strong> — khi người dùng chạm vào sản phẩm, bắt đầu gọi API chi tiết <em>trước</em> khi màn mới được dựng xong; tải trang kế tiếp khi còn cách cuối danh sách vài item.
      Đừng prefetch bừa khi đang dùng mạng di động — tốn dữ liệu và pin.</li>
    </ol>

    <p><strong>Tầng kết nối</strong>: giữ kết nối sống và dùng lại (một <code>OkHttpClient</code>/<code>URLSession</code> dùng chung cho cả app — đừng tạo mới mỗi request),
    HTTP/2 ghép nhiều request trên một kết nối, HTTP/3 (QUIC) chịu mất gói và đổi mạng Wi-Fi ↔ 4G tốt hơn.</p>

    <p><strong>Pin và radio</strong>: mỗi lần bật radio di động, nó ở trạng thái năng lượng cao thêm một lúc sau request (<em>tail time</em>). 10 request rải rác tốn pin hơn 10 request gom một lần.</p>

    <div class="callout"><p>💡 Luôn thử trên <strong>mạng chậm giả lập</strong>: Network Link Conditioner (iOS/macOS), emulator network throttling, hoặc Charles/Proxyman.
    App "nhanh" trên Wi-Fi văn phòng có thể rất tệ với 3G có độ trễ 300 ms.</p></div>
  `,

  codeTabs: [
    { id: "waterfall", label: "① Phá waterfall", lines: [
      "// ✗ Tuần tự: 4 RTT",
      "const product = await api.product(id);",
      "const reviews = await api.reviews(id);",
      "const stock   = await api.stock(id);",
      "const related = await api.related(id);",
      "",
      "// ✓ Song song: ~1 RTT (request nào cũng chỉ cần id)",
      "const [product, reviews, stock, related] = await Promise.all([",
      "  api.product(id), api.reviews(id), api.stock(id), api.related(id),",
      "]);",
      "",
      "// ✓✓ Tốt hơn: 1 endpoint BFF trả đủ cho màn: GET /screens/product/:id"
    ]},
    { id: "http", label: "② HTTP cache & ETag", lines: [
      "# Lần 1",
      "GET /api/categories",
      "200 OK",
      "Cache-Control: max-age=300",
      "ETag: \"v42\"",
      "",
      "# Trong 5 phút: dùng cache, không gọi mạng",
      "# Sau 5 phút: hỏi lại có điều kiện",
      "GET /api/categories",
      "If-None-Match: \"v42\"",
      "304 Not Modified          # không có body → rất nhẹ"
    ]},
    { id: "okhttp", label: "③ OkHttp / URLSession", lines: [
      "// Android: MỘT client dùng chung (connection pool, HTTP/2)",
      "val client = OkHttpClient.Builder()",
      "    .cache(Cache(File(context.cacheDir, \"http\"), 20L * 1024 * 1024))   // 20 MB",
      "    .build()",
      "",
      "// iOS: URLSession có URLCache; tăng dung lượng nếu cần",
      "let config = URLSessionConfiguration.default",
      "config.urlCache = URLCache(memoryCapacity: 10_000_000, diskCapacity: 50_000_000)",
      "config.requestCachePolicy = .useProtocolCachePolicy",
      "let session = URLSession(configuration: config)"
    ]},
    { id: "prefetch", label: "④ Prefetch (RN)", lines: [
      "// TanStack Query: cache + prefetch",
      "const queryClient = useQueryClient();",
      "",
      "function ProductCard({ id }) {",
      "  const onPressIn = () =>                         // bắt đầu tải ngay khi chạm",
      "    queryClient.prefetchQuery({ queryKey: ['product', id], queryFn: () => api.product(id) });",
      "  return <Pressable onPressIn={onPressIn} onPress={() => navigate('Detail', { id })} />;",
      "}",
      "",
      "// Màn Detail: useQuery cùng key → thường đã có dữ liệu khi màn hiện ra",
      "const { data } = useQuery({ queryKey: ['product', id], queryFn: () => api.product(id), staleTime: 60_000 });"
    ]}
  ],

  stageHtml: `
    <div class="node" id="many"><div class="nl">🐌 6 request tuần tự</div><div class="ns">6 × RTT 150 ms = 900 ms chờ</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="row">
      <div class="node" id="fewer"><div class="nl">1️⃣ Ít hơn</div><div class="ns">song song · BFF · batch</div></div>
      <div class="node" id="smaller"><div class="nl">📉 Nhỏ hơn</div><div class="ns">gzip/br · field cần · phân trang</div></div>
    </div>
    <div class="row">
      <div class="node" id="cache"><div class="nl">🗄️ Không tải lại</div><div class="ns">max-age · ETag/304 · query cache</div></div>
      <div class="node" id="early"><div class="nl">⏩ Sớm hơn</div><div class="ns">prefetch khi chạm / gần cuối list</div></div>
    </div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="fast"><div class="nl">⚡ Màn hiện gần như ngay</div><div class="ns">ít RTT, ít bytes, ít pin</div></div>
  `,
  steps: [
    { title: "1 · Latency cộng dồn", tab: "waterfall", highlight: [1, 2, 3, 4, 5], on: ["many"],
      desc: "Mỗi await tuần tự cộng thêm một RTT. Trên 4G yếu, 4 RTT đã là nửa giây." },
    { title: "2 · Song song hoặc BFF", tab: "waterfall", highlight: [8, 9, 12], on: ["a1", "fewer"],
      desc: "Request độc lập gọi song song. Tốt nhất là backend gom sẵn một response cho màn hình." },
    { title: "3 · Cache HTTP & 304", tab: "http", highlight: [4, 5, 10, 11], on: ["cache"],
      desc: "max-age bỏ hẳn request trong thời hạn; ETag biến lần hỏi lại thành 304 không có body." },
    { title: "4 · Một client dùng chung", tab: "okhttp", highlight: [2, 3, 8], on: ["cache", "smaller"],
      desc: "Client dùng chung giữ connection pool (không bắt tay TLS lại) và cache đĩa." },
    { title: "5 · Prefetch khi chạm", tab: "prefetch", highlight: [5, 6, 7, 11], on: ["early", "a2", "fast"],
      desc: "onPressIn xảy ra trước onPress và trước khi chuyển màn — tiết kiệm được vài trăm ms." }
  ],

  quiz: [
    { q: "Trên mạng di động, yếu tố nào thường chi phối thời gian tải màn có nhiều request nhỏ?", options: [
        "Băng thông", "Độ trễ (RTT) cộng dồn qua các request tuần tự", "Kích thước màn hình", "Số core CPU"
      ], correct: 1, explanation: "Request nhỏ bị giới hạn bởi RTT, không phải băng thông." },
    { q: "'Waterfall' request là gì?", options: [
        "Request song song",
        "Chuỗi request tuần tự, request sau chờ request trước xong dù không cần dữ liệu của nó",
        "Request bị lỗi",
        "Request tải ảnh"
      ], correct: 1, explanation: "Phá bằng gọi song song hoặc gom endpoint." },
    { q: "Response 304 Not Modified có đặc điểm gì?", options: [
        "Chứa toàn bộ dữ liệu mới",
        "Không có body — client dùng lại bản cache đã có",
        "Báo lỗi server",
        "Chuyển hướng"
      ], correct: 1, explanation: "Trả lời cho request có If-None-Match khớp ETag." },
    { q: "Vì sao nên dùng MỘT OkHttpClient/URLSession cho cả app?", options: [
        "Vì bắt buộc",
        "Để dùng lại connection pool (tránh bắt tay TCP/TLS lại), chia sẻ cache và cấu hình",
        "Vì tạo mới bị lỗi biên dịch",
        "Không có lợi gì"
      ], correct: 1, explanation: "Mỗi client có pool và cache riêng." },
    { q: "BFF (backend for frontend) giúp app mobile thế nào?", options: [
        "Tăng số request",
        "Một request trả đủ dữ liệu cho màn hình, backend gom từ nhiều service",
        "Thay thế cache",
        "Giảm app size"
      ], correct: 1, explanation: "Chuyển việc gom dữ liệu về phía server có mạng nhanh." },
    { q: "Prefetch trong onPressIn có lợi gì?", options: [
        "Không có lợi",
        "Bắt đầu tải dữ liệu trước khi chuyển màn xong, dữ liệu thường sẵn sàng khi màn hiện",
        "Giảm bundle",
        "Tránh memory leak"
      ], correct: 1, explanation: "Tận dụng khoảng thời gian chuyển màn." },
    { q: "'Tail time' của radio di động ảnh hưởng gì?", options: [
        "Không ảnh hưởng",
        "Radio còn ở trạng thái tốn năng lượng một lúc sau mỗi request — request rải rác hao pin hơn gom lô",
        "Làm tăng RAM",
        "Làm chậm GPU"
      ], correct: 1, explanation: "Gom request tiết kiệm pin." },
    { q: "Cách kiểm tra app trên mạng yếu?", options: [
        "Chỉ test trên Wi-Fi văn phòng",
        "Network Link Conditioner, throttling của emulator, proxy như Charles/Proxyman",
        "Tắt mạng hoàn toàn",
        "Dùng máy mới hơn"
      ], correct: 1, explanation: "Giả lập độ trễ và mất gói." },
    { q: "Nén response (gzip/br) trên Android/iOS cần làm gì ở client?", options: [
        "Tự viết giải nén",
        "Thường không cần — OkHttp và URLSession tự gửi Accept-Encoding và giải nén; server cần bật nén",
        "Không hỗ trợ",
        "Chỉ hỗ trợ trên iOS"
      ], correct: 1, explanation: "Việc chính nằm ở cấu hình server/CDN." }
  ]
});
