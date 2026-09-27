window.LESSONS.push({
  id: "17",
  phase: "5", phaseName: "Vận hành: giới hạn, log, test",
  title: "Giới hạn & bẫy — những thứ Spring cho phép mà Workers thì không",
  subtitle: "filesystem ảo · TCP chỉ qua connect() · subrequest limit · 6 kết nối · waitUntil · state global · I/O xuyên request · Date.now đứng yên",

  theory: `
    <p>Phần lớn lỗi khi chuyển từ Spring sang Workers không phải do cú pháp mà do <strong>giả định sai về môi trường</strong>. Đây là danh sách cần thuộc.</p>

    <p><strong>1. Không có ổ đĩa thật.</strong> Với <code>nodejs_compat</code>, <code>node:fs</code> là <em>hệ thống file ảo trong bộ nhớ</em>: <code>/bundle</code> (chỉ đọc, các module trong bundle),
    <code>/tmp</code> (ghi được nhưng <strong>riêng từng request</strong>, mất khi request xong). Không có chỗ nào để ghi log file, lưu upload, hay cache ra đĩa → dùng R2/KV/D1.</p>

    <p><strong>2. Mạng ra ngoài có luật.</strong> HTTP(S) qua <code>fetch()</code>. TCP thô qua <code>connect()</code> từ <code>cloudflare:sockets</code> — chỉ chiều <em>đi ra</em>,
    không mở cổng lắng nghe, chặn cổng 25 (SMTP) và dải IP của chính Cloudflare. Driver cũ gọi thẳng <code>net.Socket</code> kiểu Node có thể không chạy — kiểm tra driver có hỗ trợ Workers không.</p>

    <p><strong>3. Subrequest có trần.</strong> Mỗi <code>fetch()</code>, mỗi lời gọi KV/R2/D1… là một subrequest. Free: 50 tới Internet + 1.000 tới dịch vụ Cloudflare mỗi lần gọi;
    Paid: mặc định 10.000, chỉnh bằng <code>limits.subrequests</code>. Redirect cũng tính từng bước. Vòng lặp gọi API cho từng item trong danh sách 500 phần tử là hỏng ngay trên Free.</p>

    <p><strong>4. Tối đa 6 kết nối đồng thời</strong> đang chờ header. <code>Promise.all</code> 100 fetch không lỗi nhưng chỉ chạy 6 cái một lúc.</p>

    <p><strong>5. Hết request là hết việc.</strong> Client ngắt hoặc response trả xong → việc chưa xong có thể bị huỷ, trừ khi nằm trong <code>ctx.waitUntil</code> (thêm tối đa 30 giây).
    Không có <code>@Async</code> chạy nền vô hạn, không có <code>setInterval</code> sống mãi.</p>

    <p><strong>6. State global và I/O object.</strong> Biến global dùng chung giữa request đồng thời và mất bất cứ lúc nào (bài 02). Hơn nữa, object I/O (stream, client DB, socket)
    tạo trong request A <em>không được dùng</em> trong request B — runtime ném lỗi kiểu "Cannot perform I/O on behalf of a different request". Đây là lý do client pg phải tạo mới mỗi request (bài 13).</p>

    <p><strong>7. Thời gian "đứng yên" khi tính toán.</strong> Để chống tấn công timing (Spectre), <code>Date.now()</code>/<code>performance.now()</code> chỉ tiến lên khi có I/O.
    Đo <code>Date.now()</code> trước và sau một vòng lặp CPU sẽ ra ~0 ms. Muốn đo CPU → xem CPU time trong Workers Logs.</p>

    <p><strong>8. Không sinh code từ chuỗi</strong>: <code>eval()</code> và <code>new Function()</code> bị chặn. Một số thư viện template/validator dựa vào chúng sẽ không chạy.</p>

    <p><strong>9. Các trần khác</strong>: 128 MB bộ nhớ, startup 1 giây, CPU 10 ms (Free) / 30 giây mặc định (Paid), body request 100 MB (zone Free/Pro).</p>

    <div class="callout"><p>💡 Cách nghĩ: Worker là một <em>hàm</em> được mượn tài nguyên trong thời gian ngắn, không phải một <em>máy</em>. Cái gì cần tồn tại lâu hơn một request
    (file, kết nối, job nền, bộ đếm) phải thuộc về một dịch vụ khác: R2, Hyperdrive, Queues, Durable Objects.</p></div>
  `,

  codeTabs: [
    { id: "sub", label: "Bẫy subrequest", lines: [
      "// SAI: 1 fetch cho mỗi sản phẩm -> 500 subrequest, vượt 50 của gói Free",
      "const details = await Promise.all(",
      "  ids.map((id) => fetch('https://catalog.internal/products/' + id).then((r) => r.json()))",
      ");                                             // và chỉ 6 kết nối chạy cùng lúc",
      "",
      "// ĐÚNG: API gộp (batch endpoint) — 1 subrequest",
      "const res = await fetch('https://catalog.internal/products:batchGet', {",
      "  method: 'POST', body: JSON.stringify({ ids }),",
      "});",
      "",
      "// wrangler.jsonc (Paid): nâng trần nếu thật sự cần",
      "// \"limits\": { \"subrequests\": 20000, \"cpu_ms\": 60000 }"
    ]},
    { id: "glob", label: "Bẫy global & I/O", lines: [
      "import { Client } from 'pg';",
      "",
      "let client: Client | null = null;            // SAI: dùng lại giữa các request",
      "",
      "export default {",
      "  async fetch(req: Request, env: Env) {",
      "    if (!client) {",
      "      client = new Client({ connectionString: env.HYPERDRIVE.connectionString });",
      "      await client.connect();",
      "    }",
      "    // request thứ 2: lỗi 'Cannot perform I/O on behalf of a different request'",
      "    const { rows } = await client.query('SELECT 1');",
      "    return Response.json(rows);",
      "  },",
      "};"
    ]},
    { id: "tcp", label: "TCP & filesystem", lines: [
      "import { connect } from 'cloudflare:sockets';",
      "import { writeFileSync, readFileSync } from 'node:fs';",
      "",
      "// TCP ra ngoài: được (trừ cổng 25, IP của Cloudflare, mạng private)",
      "const socket = connect({ hostname: 'redis.shop.vn', port: 6380 }, { secureTransport: 'on' });",
      "",
      "// /tmp: ghi được nhưng chỉ sống trong request này",
      "writeFileSync('/tmp/report.csv', csv);",
      "const again = readFileSync('/tmp/report.csv', 'utf8');",
      "await env.MEDIA.put('reports/today.csv', again);   // muốn giữ lại -> R2"
    ]},
    { id: "time", label: "Date.now đứng yên", lines: [
      "const t0 = Date.now();",
      "heavyLoop();                          // 20 ms CPU",
      "console.log(Date.now() - t0);         // ~0 — thời gian chỉ tiến khi có I/O",
      "",
      "const t1 = Date.now();",
      "await fetch('https://api.example.com');",
      "console.log(Date.now() - t1);         // ra số thật: có I/O xảy ra"
    ]}
  ],

  stageHtml: `
    <div class="node" id="w"><div class="nl">⚡ Một lần gọi Worker</div><div class="ns">mượn tài nguyên trong thời gian ngắn</div></div>
    <div class="row">
      <div class="node" id="fs"><div class="nl">📁 FS ảo</div><div class="ns">/tmp theo request</div></div>
      <div class="node" id="net"><div class="nl">🌐 fetch / connect()</div><div class="ns">≤ 6 đồng thời · có trần subrequest</div></div>
    </div>
    <div class="row">
      <div class="node" id="glob"><div class="nl">🧨 Global & I/O object</div><div class="ns">không dùng xuyên request</div></div>
      <div class="node" id="clock"><div class="nl">⏱ Đồng hồ</div><div class="ns">chỉ tiến khi có I/O</div></div>
    </div>
    <div class="arrow" id="a1">↓ cần tồn tại lâu hơn request?</div>
    <div class="node" id="svc"><div class="nl">🏛️ R2 · Hyperdrive · Queues · DO</div><div class="ns">đưa việc cho dịch vụ bền</div></div>
  `,
  steps: [
    { title: "1 · Subrequest là tài nguyên có hạn", tab: "sub", highlight: [1, 2, 3, 4], on: ["w", "net"],
      desc: "Mỗi fetch/binding call đều tính. N+1 HTTP là phản mẫu tệ hơn N+1 SQL." },
    { title: "2 · Gộp lời gọi", tab: "sub", highlight: [6, 7, 8, 12], on: ["net"],
      desc: "Thiết kế API batch ở backend. Nâng <code>limits.subrequests</code> chỉ là giải pháp cuối (Paid)." },
    { title: "3 · Đừng dùng lại I/O object", tab: "glob", highlight: [3, 7, 8, 9, 11, 12], on: ["glob"],
      desc: "Client, stream, socket gắn với request tạo ra nó. Tạo mới mỗi request." },
    { title: "4 · Mạng & file", tab: "tcp", highlight: [1, 5, 8, 10], on: ["fs", "net"],
      desc: "TCP ra ngoài qua <code>connect()</code>; /tmp chỉ để xử lý tạm. Muốn giữ → R2." },
    { title: "5 · Đồng hồ không tiến khi tính toán", tab: "time", highlight: [1, 2, 3, 6, 7], on: ["clock"],
      desc: "Biện pháp chống Spectre. Đừng tự đo hiệu năng CPU bằng Date.now() trong Worker." },
    { title: "6 · Tư duy: mượn, không sở hữu", tab: "tcp", highlight: [10], on: ["a1", "svc"],
      desc: "Mọi thứ cần sống lâu hơn một request thuộc về một dịch vụ bền." }
  ],

  quiz: [
    { q: "Ghi file vào /tmp bằng node:fs trong Worker. File tồn tại bao lâu?", options: [
        "Mãi mãi",
        "Chỉ trong request hiện tại — request khác không thấy",
        "24 giờ",
        "Tới lần deploy sau"
      ], correct: 1, explanation: "VFS trong bộ nhớ, /tmp riêng từng request." },
    { q: "Trần subrequest tới Internet mỗi lần gọi trên gói Free?", options: [
        "6", "50", "1.000", "10.000"
      ], correct: 1, explanation: "Free: 50 ra ngoài, 1.000 tới dịch vụ Cloudflare; Paid mặc định 10.000." },
    { q: "Promise.all 100 fetch trong một request. Điều gì xảy ra (gói Paid)?", options: [
        "Lỗi ngay",
        "Chạy được nhưng chỉ 6 kết nối đồng thời chờ header, phần còn lại xếp hàng",
        "Chạy 100 song song",
        "Chỉ chạy 50"
      ], correct: 1, explanation: "Giới hạn 6 kết nối đồng thời." },
    { q: "Lưu client DB vào biến global rồi dùng ở request sau. Kết quả?", options: [
        "Nhanh hơn, khuyến khích",
        "Lỗi 'Cannot perform I/O on behalf of a different request' — I/O object gắn với request tạo ra nó",
        "Không ảnh hưởng",
        "Chỉ lỗi trên Free"
      ], correct: 1, explanation: "Tạo mới mỗi request; pool thật nằm ở Hyperdrive." },
    { q: "Worker mở TCP tới cổng 25 để gửi email được không?", options: [
        "Được", "Không — cổng 25 bị chặn", "Chỉ trên Paid", "Chỉ bằng Rust"
      ], correct: 1, explanation: "Dùng dịch vụ email qua HTTP API hoặc Email Service của Cloudflare." },
    { q: "Đo Date.now() trước và sau một vòng lặp CPU 20 ms (không có I/O) thu được?", options: [
        "20 ms", "~0 ms — đồng hồ chỉ tiến khi có I/O", "Lỗi", "Số ngẫu nhiên"
      ], correct: 1, explanation: "Biện pháp giảm thiểu tấn công timing." },
    { q: "Thư viện dùng new Function() để biên dịch template. Trên Workers?", options: [
        "Chạy bình thường",
        "Bị chặn — sinh code từ chuỗi (eval/new Function) không được phép",
        "Chạy chậm hơn",
        "Chỉ chạy local"
      ], correct: 1, explanation: "Chọn thư viện biên dịch trước (precompile) hoặc không dùng eval." },
    { q: "Worker có thể mở cổng lắng nghe TCP để làm server không?", options: [
        "Có qua connect()",
        "Không — connect() chỉ tạo kết nối đi ra",
        "Có trên Paid",
        "Có với nodejs_compat"
      ], correct: 1, explanation: "Inbound TCP chưa được hỗ trợ theo docs TCP sockets." },
    { q: "Response đã trả xong, promise gửi analytics chưa xong và không nằm trong waitUntil. Điều gì có thể xảy ra?", options: [
        "Chắc chắn chạy xong",
        "Có thể bị huỷ",
        "Tự vào Queue",
        "Được retry"
      ], correct: 1, explanation: "Công việc sau response phải đăng ký bằng ctx.waitUntil." },
    { q: "Nâng trần subrequest cho một Worker Paid bằng cách nào?", options: [
        "Không thể",
        "\"limits\": { \"subrequests\": N } trong wrangler.jsonc",
        "Gọi support",
        "Dùng nhiều isolate"
      ], correct: 1, explanation: "Paid tối đa 10 triệu; nhưng nên gộp lời gọi trước." }
  ]
});
