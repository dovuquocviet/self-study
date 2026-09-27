window.LESSONS.push({
  id: "11",
  phase: "3", phaseName: "Bindings: lưu trữ & kết nối",
  title: "R2 — object storage tương thích S3, không phí egress",
  subtitle: "put/get/head/list/delete · stream thay vì nạp RAM · httpMetadata · presigned URL · giới hạn body request",

  theory: `
    <p><strong>R2</strong> là object storage (như S3/MinIO): lưu file theo <em>key</em> trong <em>bucket</em>. Hai điểm khác biệt đáng nhớ:</p>
    <ul>
      <li><strong>Không tính phí egress</strong> (băng thông tải ra). Với S3, ảnh sản phẩm tải xuống app mobile hàng triệu lần là khoản tiền lớn; với R2 bạn trả lưu trữ + số thao tác.</li>
      <li><strong>Hai cách truy cập</strong>: binding từ Worker (<code>env.BUCKET</code>, không cần access key) và <strong>API tương thích S3</strong> (dùng AWS SDK/aws-cli, có access key) cho service Rust/Java hiện có.</li>
    </ul>
    <p>R2 <strong>nhất quán mạnh</strong>: put xong, get ở bất kỳ đâu thấy bản mới — khác KV.</p>

    <p><strong>API binding chính</strong></p>
    <table>
      <tr><th>Gọi</th><th>Ý nghĩa</th></tr>
      <tr><td><code>put(key, body, { httpMetadata, customMetadata })</code></td><td>Ghi; body có thể là ReadableStream (stream thẳng từ request)</td></tr>
      <tr><td><code>get(key)</code></td><td>Trả <code>R2ObjectBody</code> (có <code>.body</code> stream) hoặc <code>null</code>; hỗ trợ <code>range</code>, <code>onlyIf</code> (ETag)</td></tr>
      <tr><td><code>head(key)</code></td><td>Chỉ metadata, không body</td></tr>
      <tr><td><code>list({ prefix, cursor, limit })</code></td><td>Liệt kê theo tiền tố — "thư mục" chỉ là quy ước trong key</td></tr>
      <tr><td><code>delete(key | keys[])</code></td><td>Xoá</td></tr>
      <tr><td><code>createMultipartUpload(key)</code></td><td>Upload file lớn theo từng phần</td></tr>
    </table>

    <p><strong>Upload từ app mobile — hai mẫu</strong></p>
    <ol>
      <li><em>Qua Worker</em>: app POST file tới Worker, Worker kiểm tra quyền rồi <code>put(key, request.body)</code>. Đơn giản, nhưng body request bị giới hạn theo gói
      Cloudflare của zone (Free/Pro 100 MB, Business 200 MB).</li>
      <li><em>Presigned URL</em>: Worker ký một URL S3 có hạn (vd 10 phút) cho đúng một key; app PUT thẳng lên R2. Worker không phải chuyển dữ liệu — hợp file lớn.</li>
    </ol>

    <div class="callout"><p>💡 Đừng <code>await request.arrayBuffer()</code> rồi mới put: bạn vừa nạp cả file vào bộ nhớ 128 MB của isolate. Truyền thẳng
    <code>request.body</code> (stream). Khi đọc cũng trả thẳng <code>object.body</code> vào <code>new Response()</code>.</p></div>
  `,

  codeTabs: [
    { id: "cfg", label: "Khai báo", lines: [
      "npx wrangler r2 bucket create shop-media",
      "",
      "// wrangler.jsonc",
      "\"r2_buckets\": [",
      "  { \"binding\": \"MEDIA\", \"bucket_name\": \"shop-media\" }",
      "]",
      "",
      "// Env: MEDIA: R2Bucket"
    ]},
    { id: "up", label: "Upload qua Worker", lines: [
      "app.put('/api/avatars/:userId', async (c) => {",
      "  const userId = c.req.param('userId');",
      "  if (userId !== c.get('userId')) return c.json({ error: 'forbidden' }, 403);",
      "  const type = c.req.header('Content-Type') ?? '';",
      "  if (!type.startsWith('image/')) return c.json({ error: 'not_image' }, 415);",
      "  const key = 'avatars/' + userId + '.jpg';",
      "  const obj = await c.env.MEDIA.put(key, c.req.raw.body, {   // stream, không nạp RAM",
      "    httpMetadata: { contentType: type, cacheControl: 'public, max-age=86400' },",
      "    customMetadata: { uploadedBy: userId },",
      "  });",
      "  return c.json({ key, etag: obj?.etag }, 201);",
      "});"
    ]},
    { id: "down", label: "Phục vụ file", lines: [
      "app.get('/media/*', async (c) => {",
      "  const key = c.req.path.slice('/media/'.length);",
      "  const obj = await c.env.MEDIA.get(key);",
      "  if (!obj) return c.notFound();",
      "  const headers = new Headers();",
      "  obj.writeHttpMetadata(headers);          // Content-Type, Cache-Control đã lưu lúc put",
      "  headers.set('ETag', obj.httpEtag);",
      "  return new Response(obj.body, { headers }); // stream ra client",
      "});"
    ]},
    { id: "s3", label: "API S3 (Rust/Java)", lines: [
      "# Endpoint S3 của R2 (region luôn là 'auto')",
      "https://<ACCOUNT_ID>.r2.cloudflarestorage.com",
      "",
      "aws s3 cp ./banner.jpg s3://shop-media/banners/home.jpg \\",
      "  --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com",
      "",
      "# Java: AWS SDK v2 S3Client.builder().endpointOverride(URI.create(...)).region(Region.of(\"auto\"))",
      "# Rust: aws-sdk-s3 với endpoint_url tương tự",
      "# Presigned PUT URL: ký bằng access key R2 (vd thư viện aws4fetch trong Worker)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">📱 App mobile</div><div class="ns">PUT ảnh đại diện</div></div>
    <div class="arrow" id="a1">↓ body = stream</div>
    <div class="node" id="w"><div class="nl">⚡ Worker</div><div class="ns">kiểm tra quyền, loại file</div></div>
    <div class="arrow" id="a2">↓ env.MEDIA.put(key, stream)</div>
    <div class="node" id="r2"><div class="nl">🪣 R2 bucket</div><div class="ns">nhất quán mạnh · không phí egress</div></div>
    <div class="node" id="svc"><div class="nl">🦀 Service Rust/Java</div><div class="ns">truy cập qua API S3</div></div>
  `,
  steps: [
    { title: "1 · Khai báo bucket", tab: "cfg", highlight: [1, 4, 5], on: ["r2"],
      desc: "Binding không cần access key. Chỉ Worker có binding mới truy cập được." },
    { title: "2 · Kiểm tra trước khi nhận file", tab: "up", highlight: [2, 3, 4, 5], on: ["app", "a1", "w"],
      desc: "Chặn sai quyền, sai loại file sớm — trước khi tốn băng thông ghi." },
    { title: "3 · Stream thẳng vào R2", tab: "up", highlight: [6, 7, 8, 9], on: ["a2", "r2"],
      desc: "<code>c.req.raw.body</code> là ReadableStream gốc. httpMetadata được lưu kèm để phục vụ lại sau." },
    { title: "4 · Phục vụ file ra ngoài", tab: "down", highlight: [3, 4, 6, 7, 8], on: ["w", "r2"],
      desc: "<code>writeHttpMetadata</code> chép lại Content-Type/Cache-Control. Body stream, không tốn RAM." },
    { title: "5 · Service khác dùng API S3", tab: "s3", highlight: [2, 4, 5, 7], on: ["svc"],
      desc: "Code S3 có sẵn chỉ cần đổi endpoint và region <code>auto</code>." }
  ],

  quiz: [
    { q: "Điểm khác biệt lớn về chi phí của R2 so với S3?", options: [
        "Lưu trữ miễn phí",
        "Không tính phí egress (băng thông tải ra)",
        "Không tính phí thao tác",
        "Rẻ hơn 100 lần mọi mặt"
      ], correct: 1, explanation: "Vẫn trả lưu trữ và số thao tác đọc/ghi." },
    { q: "R2 có nhất quán cuối cùng như KV không?", options: [
        "Có, 60 giây",
        "Không — R2 nhất quán mạnh: put xong get thấy ngay",
        "Chỉ nhất quán trong một region",
        "Tuỳ bucket"
      ], correct: 1, explanation: "Khác biệt quan trọng khi chọn giữa KV và R2." },
    { q: "Vì sao nên truyền request.body vào put() thay vì await request.arrayBuffer()?", options: [
        "arrayBuffer không tồn tại",
        "Stream không nạp cả file vào bộ nhớ 128 MB của isolate",
        "put() không nhận ArrayBuffer",
        "Không khác nhau"
      ], correct: 1, explanation: "File lớn có thể vượt bộ nhớ nếu nạp hết." },
    { q: "Service Java có sẵn muốn đọc/ghi R2 dùng gì?", options: [
        "Binding",
        "API tương thích S3 (AWS SDK) với endpoint R2 và access key",
        "JDBC",
        "Không được"
      ], correct: 1, explanation: "Binding chỉ dành cho Worker." },
    { q: "Upload video 1 GB từ app, mẫu nào hợp lý hơn?", options: [
        "POST qua Worker rồi put",
        "Worker cấp presigned URL, app upload thẳng lên R2 (multipart nếu cần)",
        "Lưu vào KV",
        "Gửi qua Queue"
      ], correct: 1, explanation: "Tránh giới hạn body request và không bắt Worker chuyển dữ liệu." },
    { q: "obj.writeHttpMetadata(headers) làm gì?", options: [
        "Ghi file",
        "Chép httpMetadata đã lưu (Content-Type, Cache-Control...) vào Headers của response",
        "Xoá metadata",
        "Tạo ETag mới"
      ], correct: 1, explanation: "Giúp phục vụ file đúng kiểu mà không tự đoán." },
    { q: "'Thư mục' trong R2 thực chất là gì?", options: [
        "Thư mục thật trên đĩa",
        "Chỉ là tiền tố trong key (vd avatars/), liệt kê bằng list({ prefix })",
        "Một bucket con",
        "Một binding khác"
      ], correct: 1, explanation: "Object storage phẳng; dấu / chỉ là ký tự trong key." },
    { q: "get(key) trả về gì khi key không tồn tại?", options: [
        "Ném lỗi 404", "null", "Object rỗng", "undefined kèm cảnh báo"
      ], correct: 1, explanation: "Tự trả 404 cho client." },
    { q: "Region khi cấu hình AWS SDK trỏ vào R2 là gì?", options: [
        "us-east-1 bắt buộc", "auto", "ap-southeast-1", "global"
      ], correct: 1, explanation: "R2 dùng region 'auto'." }
  ]
});
