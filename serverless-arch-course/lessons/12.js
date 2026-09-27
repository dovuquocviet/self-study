window.LESSONS.push({
  id: "12",
  phase: "3", phaseName: "Dữ liệu: nhất quán & lưu trữ",
  title: "R2 & presigned URL: upload/download không đi qua Worker",
  subtitle: "Binding vs S3 API · ký SigV4 bằng aws4fetch · CORS · event notification → Queues · egress 0 đồng",

  theory: `
    <p>R2 là object storage tương thích S3, <strong>không tính phí egress</strong> (khác S3 — nơi chi phí tải ra thường lớn hơn lưu trữ). Có hai cách chạm vào R2:</p>
    <table>
      <tr><th></th><th>Binding (<code>env.BUCKET</code>)</th><th>S3 API (<code>https://ACCOUNT_ID.r2.cloudflarestorage.com</code>)</th></tr>
      <tr><td>Dùng từ</td><td>Worker</td><td>Mọi nơi: service Java/Rust (AWS SDK), CLI, trình duyệt qua presigned URL</td></tr>
      <tr><td>Xác thực</td><td>Không cần key (binding là quyền)</td><td>Access Key ID + Secret (tạo R2 API token), region <code>auto</code></td></tr>
      <tr><td>Presigned URL</td><td><strong>Không</strong> tạo được</td><td>Có — ký SigV4, hạn tối đa 7 ngày</td></tr>
    </table>

    <p><strong>Vì sao cần presigned URL?</strong> Worker có giới hạn kích thước body request (tuỳ gói Cloudflare, vd 100 MB ở gói Free/Pro) và bạn trả tiền CPU cho việc chuyển tiếp bytes.
    Mobile upload video 300 MB qua Worker là thiết kế sai. Thay vào đó:</p>
    <ol>
      <li>App gọi API: "tôi muốn upload avatar.jpg" → Worker kiểm tra quyền, quyết định <em>key</em> (app không được tự chọn key), ký URL <code>PUT</code> hạn 5–15 phút.</li>
      <li>App <code>PUT</code> thẳng file lên R2 bằng URL đó (bytes không qua Worker).</li>
      <li>R2 phát <strong>event notification</strong> vào một Queue khi object được tạo → consumer tạo thumbnail, quét virus, cập nhật DB.</li>
    </ol>
    <p>Download file riêng tư cũng vậy: Worker kiểm tra quyền rồi ký URL <code>GET</code> ngắn hạn (hoặc stream qua binding nếu cần kiểm soát từng byte).</p>

    <p><strong>Lưu ý</strong>: presigned URL là <em>bearer</em> — ai có URL đều dùng được tới khi hết hạn; đặt hạn ngắn, ký kèm <code>Content-Type</code> nếu muốn khoá loại file.
    Upload từ trình duyệt cần cấu hình <strong>CORS</strong> cho bucket. File rất lớn → multipart upload.</p>

    <div class="callout"><p>💡 Giống hệt mẫu S3 presigned trong Spring (<code>S3Presigner</code>) — chỉ khác endpoint và region <code>auto</code>. Service Java/Rust hiện có dùng AWS SDK trỏ endpoint R2 là chạy.</p></div>
  `,

  codeTabs: [
    { id: "sign", label: "① Worker ký URL (aws4fetch)", lines: [
      "import { AwsClient } from 'aws4fetch';",
      "",
      "export default {",
      "  async fetch(req, env) {",
      "    const user = await auth(req, env);",
      "    const { contentType } = await req.json();",
      "    if (!['image/jpeg', 'image/png'].includes(contentType)) return new Response('bad type', { status: 400 });",
      "    const key = 'avatars/' + user.id + '/' + crypto.randomUUID();   // server chọn key",
      "    const r2 = new AwsClient({ accessKeyId: env.R2_KEY_ID, secretAccessKey: env.R2_SECRET, service: 's3', region: 'auto' });",
      "    const url = new URL('https://' + env.ACCOUNT_ID + '.r2.cloudflarestorage.com/media/' + key);",
      "    url.searchParams.set('X-Amz-Expires', '600');                    // 10 phút",
      "    const signed = await r2.sign(new Request(url, { method: 'PUT', headers: { 'Content-Type': contentType } }),",
      "      { aws: { signQuery: true } });",
      "    return Response.json({ uploadUrl: signed.url, key });",
      "  }",
      "};"
    ]},
    { id: "client", label: "② Mobile/web upload", lines: [
      "const { uploadUrl, key } = await api.post('/uploads', { contentType: 'image/jpeg' });",
      "await fetch(uploadUrl, {",
      "  method: 'PUT',",
      "  headers: { 'Content-Type': 'image/jpeg' },   // phải khớp lúc ký",
      "  body: file",
      "});",
      "await api.post('/me/avatar', { key });           // hoặc chờ event notification"
    ]},
    { id: "event", label: "③ Event notification → Queue", lines: [
      "# gửi sự kiện object-create của prefix avatars/ vào queue",
      "npx wrangler r2 bucket notification create media --event-type object-create --queue media-events --prefix avatars/",
      "",
      "// consumer",
      "async queue(batch, env) {",
      "  for (const m of batch.messages) {",
      "    const { object } = m.body;                    // { key, size, eTag }",
      "    const img = await env.MEDIA.get(object.key);  // binding",
      "    await makeThumbnail(env, object.key, img);",
      "    m.ack();",
      "  }",
      "}"
    ]},
    { id: "java", label: "④ Spring/Java dùng R2", lines: [
      "S3Presigner presigner = S3Presigner.builder()",
      "    .endpointOverride(URI.create(\"https://\" + accountId + \".r2.cloudflarestorage.com\"))",
      "    .region(Region.of(\"auto\"))",
      "    .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(keyId, secret)))",
      "    .build();",
      "PresignedPutObjectRequest p = presigner.presignPutObject(b -> b",
      "    .signatureDuration(Duration.ofMinutes(10))",
      "    .putObjectRequest(o -> o.bucket(\"media\").key(key).contentType(\"image/jpeg\")));"
    ]},
    { id: "cors", label: "⑤ CORS cho bucket", lines: [
      "// cors.json — định dạng của wrangler (Cloudflare API)",
      "{",
      "  \"rules\": [{",
      "    \"allowed\": {",
      "      \"origins\": [\"https://app.example.com\"],",
      "      \"methods\": [\"PUT\", \"GET\"],",
      "      \"headers\": [\"Content-Type\"]",
      "    },",
      "    \"maxAgeSeconds\": 3600",
      "  }]",
      "}",
      "# npx wrangler r2 bucket cors set media --file cors.json",
      "# (qua S3 API PutBucketCors thì dùng dạng AllowedOrigins/AllowedMethods như AWS)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">📱 App</div><div class="ns">POST /uploads {contentType}</div></div>
    <div class="arrow" id="a1">↓ kiểm quyền, chọn key, ký SigV4</div>
    <div class="node" id="w"><div class="nl">⚙️ Worker</div><div class="ns">trả uploadUrl hạn 10 phút</div></div>
    <div class="arrow" id="a2">↓ PUT thẳng, bytes không qua Worker</div>
    <div class="node" id="r2"><div class="nl">🪣 R2 bucket media</div><div class="ns">egress miễn phí</div></div>
    <div class="arrow" id="a3">↓ object-create</div>
    <div class="node" id="q"><div class="nl">📬 Queue media-events</div><div class="ns">thumbnail, cập nhật DB</div></div>
  `,
  steps: [
    { title: "1 · Xin quyền upload", tab: "sign", highlight: [5, 6, 7, 8], on: ["app", "a1"],
      desc: "Worker xác thực, kiểm loại file và tự sinh key — client không được chọn đường dẫn trong bucket." },
    { title: "2 · Ký URL", tab: "sign", highlight: [9, 10, 11, 12, 13], on: ["w"],
      desc: "S3 API của R2 với region 'auto'. signQuery đưa chữ ký vào query string; X-Amz-Expires là thời hạn." },
    { title: "3 · Upload thẳng", tab: "client", highlight: [2, 3, 4, 5], on: ["a2", "r2"],
      desc: "Content-Type phải khớp lúc ký. Worker không tốn CPU cho bytes, không dính giới hạn body." },
    { title: "4 · Xử lý sau upload", tab: "event", highlight: [2, 7, 8, 9], on: ["a3", "q"],
      desc: "Event notification đẩy sự kiện vào Queue; consumer đọc qua binding để xử lý tiếp." },
    { title: "5 · Service Java dùng chung", tab: "java", highlight: [2, 3, 7], on: ["r2"],
      desc: "AWS SDK trỏ endpoint R2 — code presign Spring hiện có gần như giữ nguyên." }
  ],

  quiz: [
    { q: "Có thể tạo presigned URL từ R2 binding (env.BUCKET) không?", options: [
        "Có, env.BUCKET.presign()",
        "Không — phải dùng S3 API với Access Key/Secret để ký SigV4",
        "Chỉ cho GET",
        "Chỉ trên gói Enterprise"
      ], correct: 1, explanation: "Binding cho quyền trực tiếp trong Worker, không phát URL." },
    { q: "Vì sao không nên cho mobile upload video 300 MB qua Worker?", options: [
        "Worker không đọc được video",
        "Giới hạn kích thước body request và tốn tài nguyên chuyển tiếp; nên PUT thẳng lên R2",
        "R2 không nhận video",
        "Vì CORS"
      ], correct: 1, explanation: "Presigned URL tách luồng bytes khỏi Worker." },
    { q: "Region khi dùng S3 SDK với R2?", options: [
        "us-east-1 bắt buộc", "auto", "global", "Không cần"
      ], correct: 1, explanation: "R2 dùng region 'auto'." },
    { q: "Ai nên chọn key (đường dẫn) cho object khi upload bằng presigned URL?", options: [
        "Client", "Server khi ký URL", "R2 tự sinh", "Người dùng cuối nhập"
      ], correct: 1, explanation: "Client tự chọn key có thể ghi đè file của người khác." },
    { q: "Presigned URL bị lộ thì sao?", options: [
        "Vô hại",
        "Ai có URL cũng dùng được tới khi hết hạn — đặt hạn ngắn",
        "Chỉ chủ tài khoản dùng được",
        "Tự vô hiệu sau 1 lần"
      ], correct: 1, explanation: "Nó là bearer credential." },
    { q: "Thời hạn tối đa của presigned URL SigV4?", options: [
        "1 giờ", "24 giờ", "7 ngày", "Không giới hạn"
      ], correct: 2, explanation: "604.800 giây." },
    { q: "Muốn tạo thumbnail ngay sau khi file được upload lên R2, cách hợp lý?", options: [
        "Client gọi thêm API và hy vọng",
        "R2 event notification → Queue → consumer",
        "Cron quét bucket mỗi phút",
        "KV watch"
      ], correct: 1, explanation: "Sự kiện object-create đẩy vào Queue." },
    { q: "Ưu điểm chi phí lớn nhất của R2 so với S3?", options: [
        "Lưu trữ miễn phí", "Không tính phí egress", "Không tính phí request", "Không giới hạn dung lượng miễn phí"
      ], correct: 1, explanation: "Vẫn tính phí lưu trữ và operation class A/B." },
    { q: "Upload từ trình duyệt bằng presigned URL bị lỗi CORS. Cần làm gì?", options: [
        "Tắt HTTPS",
        "Cấu hình CORS cho bucket (AllowedOrigins, AllowedMethods, AllowedHeaders)",
        "Đổi region",
        "Dùng KV"
      ], correct: 1, explanation: "wrangler r2 bucket cors set ... hoặc qua dashboard." }
  ]
});
