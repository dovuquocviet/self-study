window.LESSONS.push({
  id: "09",
  phase: "3", phaseName: "Bindings: lưu trữ & kết nối",
  title: "Binding là gì — và Workers KV (key-value phân tán, nhất quán cuối cùng)",
  subtitle: "binding = capability được runtime tiêm vào env · KV get/put/list · cacheTtl · ~60 giây lan toả · 1 ghi/giây/key",

  theory: `
    <p><strong>Binding</strong> là cách Worker "được cấp quyền" dùng một tài nguyên. Bạn khai báo trong wrangler.jsonc, runtime tạo sẵn một <em>đối tượng</em> trong <code>env</code>.
    Code không cầm URL, username, password hay API key của KV/D1/R2 — chỉ cầm <code>env.CACHE</code>. Giống Spring inject sẵn một <code>@Bean</code> đã cấu hình,
    nhưng ở đây ranh giới là bảo mật: Worker <em>không có</em> binding thì không có cách nào chạm vào tài nguyên đó (mô hình capability).</p>

    <p>Lợi ích thực tế: không có secret để lộ, không phải quản lý connection pool, đổi tài nguyên giữa staging/production chỉ bằng config (bài 05).</p>

    <p><strong>Workers KV</strong> — kho key-value toàn cầu, tối ưu cho <em>đọc nhiều, ghi ít</em>:</p>
    <ul>
      <li>Giá trị ghi vào kho trung tâm; khi đọc, data center cache lại bản sao. Đọc "nóng" (đã cache tại edge) rất nhanh.</li>
      <li><strong>Nhất quán cuối cùng</strong>: thay đổi có thể mất <strong>60 giây hoặc hơn</strong> mới thấy ở data center khác (vì bản cache cũ chưa hết hạn). Kể cả "key chưa tồn tại" cũng bị cache.
      Ngay tại nơi ghi thường thấy luôn, nhưng docs nói rõ <em>không được dựa vào</em>.</li>
      <li>Giới hạn: tối đa <strong>1 lần ghi/giây cho cùng một key</strong>; key ≤ 512 byte; value ≤ 25 MiB; metadata ≤ 1024 byte. Free: 100.000 đọc và 1.000 ghi/ngày.</li>
      <li><code>cacheTtl</code> (tối thiểu 30 giây) quyết định edge giữ bản cache bao lâu — dài hơn = nhanh hơn nhưng cũ lâu hơn. <code>expirationTtl</code> khi put (tối thiểu 60 giây) làm key tự hết hạn.</li>
    </ul>

    <table>
      <tr><th>Hợp với KV</th><th>KHÔNG hợp với KV</th></tr>
      <tr><td>Feature flag, cấu hình app mobile, bảng redirect, cache response API, session đọc nhiều</td><td>Bộ đếm, tồn kho, số dư ví, rate limit chính xác, bất cứ thứ gì cần đọc-sau-ghi đúng ngay → dùng D1 hoặc Durable Objects</td></tr>
    </table>

    <div class="callout"><p>💡 Với dân quen Redis: KV <em>không</em> phải Redis. Không có INCR nguyên tử, không có transaction, không nhất quán mạnh. Nó gần với
    "CDN cho dữ liệu key-value" hơn. Muốn ngữ nghĩa kiểu Redis (đếm, khoá) → Durable Objects (bài 12).</p></div>
  `,

  codeTabs: [
    { id: "cfg", label: "Khai báo", lines: [
      "npx wrangler kv namespace create CONFIG      # in ra id",
      "",
      "// wrangler.jsonc",
      "\"kv_namespaces\": [",
      "  { \"binding\": \"CONFIG\", \"id\": \"<NAMESPACE_ID>\" }",
      "]",
      "",
      "// worker-configuration.d.ts (wrangler types sinh)",
      "interface Env { CONFIG: KVNamespace }"
    ]},
    { id: "api", label: "API KV", lines: [
      "// đọc: chọn kiểu trả về; cacheTtl >= 30 giây",
      "const flags = await env.CONFIG.get<Flags>('app:flags', { type: 'json', cacheTtl: 300 });",
      "",
      "// ghi: value là string / ArrayBuffer / ReadableStream",
      "await env.CONFIG.put('app:flags', JSON.stringify(newFlags));",
      "await env.CONFIG.put('otp:0901234567', '482913', { expirationTtl: 300 });  // tự hết hạn",
      "",
      "// kèm metadata (<= 1024 byte)",
      "const { value, metadata } = await env.CONFIG.getWithMetadata('banner:home');",
      "",
      "// liệt kê theo prefix, phân trang bằng cursor",
      "const page = await env.CONFIG.list({ prefix: 'banner:', limit: 100 });",
      "await env.CONFIG.delete('banner:old');"
    ]},
    { id: "use", label: "Cache API response", lines: [
      "app.get('/api/home', async (c) => {",
      "  const cached = await c.env.CONFIG.get('cache:home', { type: 'json', cacheTtl: 60 });",
      "  if (cached) return c.json(cached);",
      "  const fresh = await fetchHomeFromBackend(c.env);         // gọi service Rust/Java",
      "  c.executionCtx.waitUntil(",
      "    c.env.CONFIG.put('cache:home', JSON.stringify(fresh), { expirationTtl: 120 })",
      "  );",
      "  return c.json(fresh);",
      "});"
    ]},
    { id: "bad", label: "Phản mẫu", lines: [
      "// SAI: bộ đếm lượt xem bằng KV",
      "const n = Number(await env.CONFIG.get('views:p42')) || 0;",
      "await env.CONFIG.put('views:p42', String(n + 1));",
      "// 1) hai request đồng thời đọc cùng n -> mất lượt đếm (không nguyên tử)",
      "// 2) > 1 ghi/giây cho cùng key -> bị giới hạn (429)",
      "// 3) data center khác thấy giá trị cũ tới ~60 giây",
      "// ĐÚNG: Durable Object (bài 12) hoặc UPDATE ... SET views = views + 1 trong D1"
    ]}
  ],

  stageHtml: `
    <div class="node" id="cfg"><div class="nl">📄 kv_namespaces</div><div class="ns">binding: CONFIG</div></div>
    <div class="arrow" id="a0">↓ runtime tiêm vào env</div>
    <div class="node" id="w"><div class="nl">⚡ Worker</div><div class="ns">env.CONFIG.get / put</div></div>
    <div class="row">
      <div class="node" id="edge"><div class="nl">🧊 Cache tại edge</div><div class="ns">đọc nóng · cacheTtl</div></div>
      <div class="node" id="central"><div class="nl">🏛️ Kho trung tâm</div><div class="ns">nguồn sự thật</div></div>
    </div>
    <div class="arrow" id="a1">⏱ ghi lan toả tới edge khác: ~60 s+</div>
  `,
  steps: [
    { title: "1 · Khai báo binding", tab: "cfg", highlight: [1, 4, 5, 9], on: ["cfg", "a0", "w"],
      desc: "Worker nhận <code>env.CONFIG</code> kiểu KVNamespace — không có URL hay mật khẩu nào trong code." },
    { title: "2 · Đọc: nóng hay lạnh", tab: "api", highlight: [2], on: ["w", "edge"],
      desc: "Nếu edge đã có bản cache → trả ngay. Không có → lên kho trung tâm (chậm hơn) rồi cache lại theo <code>cacheTtl</code>." },
    { title: "3 · Ghi và TTL", tab: "api", highlight: [5, 6], on: ["central"],
      desc: "<code>expirationTtl</code> hợp cho OTP, token tạm. Ghi đi thẳng về kho trung tâm." },
    { title: "4 · Nhất quán cuối cùng", tab: "api", highlight: [5], on: ["a1", "edge"],
      desc: "Edge khác vẫn phục vụ bản cũ cho tới khi cache hết hạn — có thể 60 giây hoặc hơn." },
    { title: "5 · Dùng đúng chỗ", tab: "use", highlight: [2, 3, 5, 6], on: ["w"],
      desc: "Cache response đọc nhiều: chấp nhận cũ vài chục giây để đổi lấy tốc độ." },
    { title: "6 · Tránh bộ đếm", tab: "bad", highlight: [2, 3, 4, 5, 6, 7], on: ["central"],
      desc: "Read-modify-write trên KV mất dữ liệu và dính giới hạn ghi. Cần nhất quán mạnh → DO/D1." }
  ],

  quiz: [
    { q: "Binding trong Workers khác việc cấu hình URL + mật khẩu DB ở chỗ nào?", options: [
        "Không khác",
        "Runtime tiêm sẵn một đối tượng có quyền truy cập; code không cầm credential, không có binding thì không truy cập được",
        "Binding chậm hơn",
        "Binding chỉ dùng được cho KV"
      ], correct: 1, explanation: "Mô hình capability: quyền = có object trong env." },
    { q: "Sau khi put một key KV ở Singapore, người dùng ở Frankfurt có thể thấy giá trị cũ trong bao lâu?", options: [
        "Không bao giờ thấy cũ",
        "Có thể tới 60 giây hoặc hơn",
        "Đúng 1 giây",
        "24 giờ"
      ], correct: 1, explanation: "Bản cache ở edge cần hết hạn mới lấy bản mới." },
    { q: "Giới hạn ghi cho CÙNG một key KV?", options: [
        "Không giới hạn", "1 lần/giây", "100 lần/giây", "1 lần/phút"
      ], correct: 1, explanation: "Ghi dồn dập một key sẽ bị từ chối." },
    { q: "Use case nào KHÔNG nên dùng KV?", options: [
        "Feature flag",
        "Bảng redirect",
        "Tồn kho sản phẩm trừ khi đặt hàng",
        "Cache trang chủ 60 giây"
      ], correct: 2, explanation: "Cần nhất quán mạnh và cập nhật nguyên tử." },
    { q: "Tham số cacheTtl khi get() quyết định gì?", options: [
        "Thời gian key tồn tại",
        "Edge giữ bản cache của giá trị bao lâu (tối thiểu 30 giây)",
        "Thời gian timeout",
        "Số lần retry"
      ], correct: 1, explanation: "Khác với expirationTtl của put() — thời gian sống của key." },
    { q: "Lưu OTP sống 5 phút trong KV, dùng gì?", options: [
        "put(key, v, { expirationTtl: 300 })",
        "get(key, { cacheTtl: 300 })",
        "setTimeout xoá",
        "Không làm được"
      ], correct: 0, explanation: "Lưu ý nhất quán cuối cùng: xác thực OTP cực nhạy nên cân nhắc DO/D1." },
    { q: "'Key chưa tồn tại' có được cache ở edge không?", options: [
        "Không",
        "Có — nên key vừa tạo cũng có thể chưa thấy ngay ở nơi khác",
        "Chỉ trên Free",
        "Chỉ khi dùng list()"
      ], correct: 1, explanation: "Negative lookup cũng bị cache." },
    { q: "So với Redis, KV thiếu điều gì quan trọng?", options: [
        "Không lưu được chuỗi",
        "Thao tác nguyên tử (INCR), transaction và nhất quán mạnh",
        "TTL",
        "Liệt kê key theo prefix"
      ], correct: 1, explanation: "KV có TTL và list prefix, nhưng không có INCR/transaction." },
    { q: "Kích thước value tối đa của KV?", options: [
        "512 byte", "128 KB", "25 MiB", "5 GB"
      ], correct: 2, explanation: "Key tối đa 512 byte, value 25 MiB." }
  ]
});
