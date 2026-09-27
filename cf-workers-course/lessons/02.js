window.LESSONS.push({
  id: "02",
  phase: "0", phaseName: "Nền tảng serverless",
  title: "V8 isolate vs container/VM — vì sao cold start chỉ vài ms",
  subtitle: "isolate là gì · cold start · CPU time vs wall time · 128 MB bộ nhớ · startup 1 giây",

  theory: `
    <p><strong>V8</strong> là engine JavaScript của Chrome. Một <strong>isolate</strong> là một "vùng nhớ JS" độc lập bên trong V8: heap riêng,
    biến global riêng, không nhìn thấy isolate khác. Một process workerd (runtime của Workers, mã nguồn mở) chứa <strong>hàng nghìn isolate</strong> của nhiều khách hàng.</p>

    <table>
      <tr><th></th><th>VM</th><th>Container</th><th>V8 isolate</th></tr>
      <tr><td>Cô lập bằng</td><td>Hypervisor, kernel riêng</td><td>Namespace/cgroup, chung kernel</td><td>Ranh giới bộ nhớ của V8 (+ sandbox nhiều lớp)</td></tr>
      <tr><td>Khởi động</td><td>Boot OS: giây–phút</td><td>Tạo process + nạp runtime (JVM): trăm ms–giây</td><td>Tạo heap + chạy module: vài ms</td></tr>
      <tr><td>Chi phí bộ nhớ</td><td>GB</td><td>Chục–trăm MB</td><td>Vài MB</td></tr>
      <tr><td>Bạn mang theo</td><td>Cả OS</td><td>Image (OS base + JVM + JAR)</td><td>Chỉ code JS/WASM của bạn</td></tr>
    </table>

    <p><strong>Cold start</strong> = thời gian từ lúc request tới đến lúc code của bạn bắt đầu chạy khi chưa có instance nóng. Với Spring Boot trên Lambda,
    đó là khởi động JVM + quét classpath + dựng ApplicationContext — thường vài giây. Với isolate: tải code (đã cache sẵn ở data center) + chạy global scope.
    Cloudflare còn <em>khởi tạo trước</em> isolate trong lúc bắt tay TLS (dựa vào SNI — tên miền client gửi đầu tiên), nên người dùng hầu như không thấy độ trễ.</p>

    <p><strong>Các con số cần thuộc (docs Cloudflare, 2026):</strong></p>
    <ul>
      <li><strong>CPU time</strong>: Free 10 ms/request; Paid mặc định 30 giây, tăng tới 5 phút bằng <code>limits.cpu_ms</code>.</li>
      <li><strong>Wall time</strong> (thời gian thực) của request HTTP: không giới hạn chừng nào client còn kết nối; <code>ctx.waitUntil()</code> kéo dài thêm tối đa 30 giây sau khi trả response.</li>
      <li><strong>Bộ nhớ</strong>: 128 MB mỗi isolate (gồm heap JS và bộ nhớ WebAssembly).</li>
      <li><strong>Startup</strong>: global scope phải chạy xong trong 1 giây. Kích thước Worker tối đa 64 MiB (chưa nén).</li>
    </ul>

    <p><strong>CPU time khác wall time thế nào?</strong> Request mất 400 ms, trong đó 380 ms là <code>await fetch()</code> tới API khác → CPU time chỉ ~20 ms.
    Khi await, isolate nhường CPU cho request khác. Đây là mô hình event loop — giống WebFlux/Netty chứ không phải một thread mỗi request như Tomcat mặc định.</p>

    <div class="callout"><p>💡 Một isolate có thể phục vụ <strong>nhiều request đồng thời</strong> (xen kẽ ở các điểm await). Biến global vì thế giống
    field của singleton bean dùng chung giữa các thread — đọc được, nhưng ghi vào là tự rước bug (bài 17).</p></div>
  `,

  codeTabs: [
    { id: "iso", label: "Global scope vs handler", lines: [
      "// Chạy MỘT LẦN khi isolate khởi tạo (tính vào giới hạn startup 1 giây)",
      "const routes = buildRouteTable();          // ok: dữ liệu chỉ đọc, tái dùng được",
      "let requestCount = 0;                      // nguy hiểm: dùng chung giữa request",
      "",
      "export default {",
      "  async fetch(request: Request, env: Env) {",
      "    requestCount++;                          // không đáng tin: isolate khác có biến khác",
      "    const res = await fetch('https://api.example.com/x');  // chờ I/O: KHÔNG tính CPU",
      "    const data = await res.json();",
      "    return Response.json({ data });",
      "  },",
      "};"
    ]},
    { id: "cfg", label: "wrangler.jsonc: limits", lines: [
      "{",
      "  \"name\": \"report-worker\",",
      "  \"main\": \"src/index.ts\",",
      "  \"compatibility_date\": \"2026-09-01\",",
      "  // chỉ có tác dụng trên gói Paid; tối đa 300000 (5 phút)",
      "  \"limits\": {",
      "    \"cpu_ms\": 60000",
      "  }",
      "}"
    ]},
    { id: "java", label: "So với JVM", lines: [
      "# Spring Boot trên Lambda (cold start)",
      "tạo micro-VM -> khởi động JVM -> nạp class -> quét @Component -> dựng context -> xử lý request",
      "=> thường 2–10 giây nếu không dùng SnapStart/GraalVM native",
      "",
      "# Worker (cold start)",
      "lấy code từ cache tại data center -> tạo isolate -> chạy global scope -> gọi fetch()",
      "=> vài ms, và thường đã làm trước trong lúc TLS handshake"
    ]},
    { id: "time", label: "CPU vs wall time", lines: [
      "t=0ms    fetch() bắt đầu          CPU chạy  (parse URL, check auth)   ~3 ms",
      "t=3ms    await fetch(API)         CPU nghỉ  (isolate phục vụ request khác)",
      "t=380ms  API trả về               CPU chạy  (json + ghép dữ liệu)     ~5 ms",
      "t=385ms  return Response",
      "",
      "wall time = 385 ms     CPU time = ~8 ms   -> vẫn lọt giới hạn 10 ms của gói Free"
    ]}
  ],

  stageHtml: `
    <div class="node" id="proc"><div class="nl">🖥️ Process workerd</div><div class="ns">một process, hàng nghìn isolate</div></div>
    <div class="row">
      <div class="node" id="isoA"><div class="nl">🟧 Isolate Worker A</div><div class="ns">heap riêng · ≤128 MB</div></div>
      <div class="node" id="isoB"><div class="nl">🟦 Isolate Worker B</div><div class="ns">không thấy A</div></div>
    </div>
    <div class="arrow" id="a1">↓ request tới</div>
    <div class="node" id="glob"><div class="nl">🔁 Global scope</div><div class="ns">chạy 1 lần / isolate · ≤ 1 giây</div></div>
    <div class="arrow" id="a2">↓ mỗi request</div>
    <div class="node" id="h"><div class="nl">⚡ fetch()</div><div class="ns">CPU time tính riêng, chờ I/O không tính</div></div>
  `,
  steps: [
    { title: "1 · Nhiều isolate trong một process", tab: "java", highlight: [5, 6, 7], on: ["proc", "isoA", "isoB"],
      desc: "Không có VM hay container cho từng Worker. Khởi tạo isolate rẻ hơn khởi động process nhiều bậc." },
    { title: "2 · Global scope chạy một lần", tab: "iso", highlight: [1, 2, 3], on: ["a1", "glob"],
      desc: "Code ngoài handler chạy khi isolate được tạo. Dùng để khởi tạo dữ liệu chỉ đọc; không được làm I/O ở đây." },
    { title: "3 · Biến global là bẫy", tab: "iso", highlight: [3, 7], on: ["glob", "h"],
      desc: "<code>requestCount</code> chỉ phản ánh isolate hiện tại, và bị nhiều request ghi chen nhau." },
    { title: "4 · CPU time vs wall time", tab: "time", highlight: [1, 2, 3, 6], on: ["a2", "h"],
      desc: "385 ms thực tế nhưng chỉ ~8 ms CPU. Workers giới hạn và tính tiền trên CPU." },
    { title: "5 · Nâng giới hạn khi cần", tab: "cfg", highlight: [5, 6, 7], on: ["h"],
      desc: "Gói Paid: <code>limits.cpu_ms</code> tối đa 300000. Tăng giới hạn không làm code nhanh hơn — chỉ cho phép chạy lâu hơn." }
  ],

  quiz: [
    { q: "V8 isolate là gì?", options: [
        "Một máy ảo có kernel riêng",
        "Một container Docker",
        "Một môi trường JS độc lập (heap, global riêng) bên trong engine V8; nhiều isolate chung một process",
        "Một thread của JVM"
      ], correct: 2, explanation: "Isolate cô lập bộ nhớ ở tầng engine, không cần process/OS riêng." },
    { q: "Vì sao cold start của Workers nhỏ hơn Spring Boot trên Lambda rất nhiều?", options: [
        "Vì JavaScript nhanh hơn Java",
        "Không phải boot VM/JVM và dựng framework; chỉ tạo isolate và chạy global scope của code đã cache sẵn",
        "Vì Workers không có cold start nào cả trong mọi trường hợp",
        "Vì Cloudflare dùng GraalVM"
      ], correct: 1, explanation: "Chi phí khởi tạo isolate là mili-giây; Cloudflare còn làm trước trong lúc TLS handshake." },
    { q: "Request mất 500 ms, trong đó 490 ms chờ Postgres. CPU time xấp xỉ bao nhiêu?", options: [
        "500 ms", "490 ms", "~10 ms", "0 ms"
      ], correct: 2, explanation: "Thời gian chờ I/O không tính vào CPU time." },
    { q: "Giới hạn bộ nhớ của một isolate Worker?", options: [
        "32 MB", "128 MB", "1 GB", "Không giới hạn"
      ], correct: 1, explanation: "128 MB, gồm cả heap JS và bộ nhớ WebAssembly." },
    { q: "Code đặt ở global scope (ngoài handler) chạy khi nào?", options: [
        "Mỗi request",
        "Một lần khi isolate được khởi tạo, phải xong trong giới hạn startup (1 giây)",
        "Chỉ khi deploy",
        "Không bao giờ chạy"
      ], correct: 1, explanation: "Đó là lý do không nên làm việc nặng hay I/O ở global scope." },
    { q: "Muốn cho phép một request được dùng tới 60 giây CPU trên gói Paid, cấu hình gì?", options: [
        "\"timeout\": 60",
        "\"limits\": { \"cpu_ms\": 60000 }",
        "\"memory\": \"1GB\"",
        "Không thể, cố định 10 ms"
      ], correct: 1, explanation: "limits.cpu_ms, tối đa 300000 ms (5 phút)." },
    { q: "Một isolate có thể xử lý nhiều request cùng lúc không?", options: [
        "Không, luôn 1 request/isolate",
        "Có — các request xen kẽ nhau tại những điểm await, nên biến global bị dùng chung",
        "Chỉ khi dùng Rust",
        "Chỉ trên gói Free"
      ], correct: 1, explanation: "Giống singleton bean dùng chung giữa nhiều thread: đọc thì được, ghi thì nguy hiểm." },
    { q: "Mô hình xử lý của Worker giống cái nào trong thế giới Java nhất?", options: [
        "Tomcat một thread cho mỗi request, block khi gọi JDBC",
        "Event loop non-blocking kiểu WebFlux/Netty",
        "Batch job Spring Batch",
        "EJB stateful"
      ], correct: 1, explanation: "Một luồng thực thi, nhường CPU ở mỗi await." },
    { q: "ctx.waitUntil() cho phép tiếp tục chạy sau khi trả response tối đa bao lâu?", options: [
        "Không giới hạn", "30 giây", "10 ms", "15 phút"
      ], correct: 1, explanation: "Theo bảng giới hạn: waitUntil kéo dài thực thi tối đa 30 giây." }
  ]
});
