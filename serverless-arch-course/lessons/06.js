window.LESSONS.push({
  id: "06",
  phase: "1", phaseName: "Durable Objects sâu",
  title: "Pattern DO: lock, counter, rate limiter và sharding",
  subtitle: "Thay Redis SETNX/INCR bằng object · lease có hạn · token bucket · chia object nóng",

  theory: `
    <p>Nhiều thứ trong Java bạn đang làm bằng Redis (<code>SETNX</code> làm lock, <code>INCR</code> làm counter, Bucket4j làm rate limit) đều là
    "<strong>cần một chỗ duy nhất quyết định tuần tự</strong>". DO chính là chỗ đó, không cần server Redis.</p>

    <table>
      <tr><th>Pattern</th><th>Tên object</th><th>Ý chính</th></tr>
      <tr><td>Counter / sequence</td><td><code>counter:invoice:2026</code></td><td>Đọc–cộng–ghi trong một lượt, không await ra ngoài → không mất lượt</td></tr>
      <tr><td>Lock / lease</td><td><code>lock:job:sync-erp</code></td><td>Lưu <code>{owner, expiresAt}</code>. Lease có hạn để holder chết thì lock tự nhả; dùng <em>fencing token</em> tăng dần</td></tr>
      <tr><td>Rate limiter chính xác</td><td><code>rl:apikey:abc</code></td><td>Token bucket: lưu <code>tokens</code>, <code>updatedAt</code>, nạp lại theo thời gian</td></tr>
      <tr><td>Idempotency key</td><td><code>idem:tenant-1</code> hoặc theo key</td><td>Lưu kết quả lần đầu, lần sau trả lại y nguyên</td></tr>
      <tr><td>Room / phiên cộng tác</td><td><code>room:42</code></td><td>Bài 05</td></tr>
    </table>

    <p><strong>Fencing token</strong>: lease có hạn nghĩa là holder chậm (GC pause, mạng) có thể tưởng mình vẫn giữ lock sau khi đã hết hạn.
    Mỗi lần cấp lock trả kèm số <code>fence</code> tăng dần; hệ thống đích từ chối ghi có <code>fence</code> nhỏ hơn số lớn nhất đã thấy.</p>

    <p><strong>Rate limiter: DO hay binding?</strong> Workers có binding <code>ratelimits</code> (<code>env.LIMITER.limit({ key })</code>, <code>period</code> 10 hoặc 60 giây)
    — rất nhanh nhưng đếm <em>theo từng location</em> và xấp xỉ, hợp để chặn lạm dụng. Cần quota chính xác toàn cầu (gói API trả tiền) → DO.</p>

    <p><strong>Sharding khi một object quá nóng</strong></p>
    <ul>
      <li><strong>Counter phân mảnh</strong>: ghi vào <code>like:post-1:shard-{random 0..N-1}</code>; đọc tổng = cộng N shard (hoặc mỗi shard định kỳ đẩy về object tổng).</li>
      <li><strong>Hash theo khoá con</strong>: tenant lớn → <code>tenant-9:shard-{hash(userId) % 16}</code>. Giữ được thứ tự trong mỗi user.</li>
      <li><strong>Phân cấp</strong>: object cha điều phối, object con làm việc (fan-out livestream, bài 05).</li>
    </ul>

    <div class="callout"><p>💡 Chọn tên object = chọn <strong>ranh giới nhất quán</strong>. Mọi thứ cần tuần tự với nhau phải chung object; thứ không liên quan nên tách object
    để song song. Tên quá thô (một object cho cả hệ) → nghẽn; quá mịn → phải phối hợp xuyên object (khó, cần saga).</p></div>
  `,

  codeTabs: [
    { id: "lock", label: "① Lock có lease + fence", lines: [
      "export class Lock extends DurableObject {",
      "  acquire(owner, ttlMs) {",
      "    const now = Date.now();",
      "    const cur = this.ctx.storage.sql.exec('SELECT * FROM l WHERE id = 1').toArray()[0];",
      "    if (cur && cur.expires_at > now && cur.owner !== owner) return { ok: false };",
      "    const fence = (cur?.fence ?? 0) + 1;",
      "    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO l VALUES (1, ?, ?, ?)', owner, now + ttlMs, fence);",
      "    return { ok: true, fence };                 // ghi xuống hệ đích kèm fence",
      "  }",
      "  release(owner) {",
      "    this.ctx.storage.sql.exec('DELETE FROM l WHERE owner = ?', owner);",
      "  }",
      "}"
    ]},
    { id: "rl", label: "② Token bucket", lines: [
      "export class Bucket extends DurableObject {",
      "  take(capacity, perSec) {",
      "    const now = Date.now();",
      "    const s = this.ctx.storage.sql.exec('SELECT tokens, ts FROM b').toArray()[0] ?? { tokens: capacity, ts: now };",
      "    const tokens = Math.min(capacity, s.tokens + (now - s.ts) / 1000 * perSec);",
      "    const ok = tokens >= 1;",
      "    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO b(id, tokens, ts) VALUES (1, ?, ?)', ok ? tokens - 1 : tokens, now);",
      "    return { ok, remaining: Math.floor(ok ? tokens - 1 : tokens) };",
      "  }",
      "}",
      "// Worker: const r = await env.BUCKET.getByName('apikey:' + key).take(100, 10);"
    ]},
    { id: "binding", label: "③ Binding ratelimits", lines: [
      "// wrangler.jsonc",
      "\"ratelimits\": [{",
      "  \"name\": \"LIMITER\",",
      "  \"namespace_id\": \"1001\",",
      "  \"simple\": { \"limit\": 100, \"period\": 60 }",
      "}]",
      "",
      "// Worker",
      "const { success } = await env.LIMITER.limit({ key: clientIp });",
      "if (!success) return new Response('Too Many Requests', { status: 429 });"
    ]},
    { id: "shard", label: "④ Sharding counter", lines: [
      "const SHARDS = 16;",
      "",
      "async function like(env, postId) {",
      "  const i = Math.floor(Math.random() * SHARDS);",
      "  await env.COUNTER.getByName('like:' + postId + ':' + i).add(1);",
      "}",
      "",
      "async function total(env, postId) {",
      "  const parts = await Promise.all(",
      "    Array.from({ length: SHARDS }, (_, i) => env.COUNTER.getByName('like:' + postId + ':' + i).get()));",
      "  return parts.reduce((a, b) => a + b, 0);",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="p1"><div class="nl">⚙️ Worker A</div><div class="ns">acquire('A')</div></div>
      <div class="node" id="p2"><div class="nl">⚙️ Worker B</div><div class="ns">acquire('B')</div></div>
    </div>
    <div class="arrow" id="a1">↓ cùng lock:job:sync-erp</div>
    <div class="node" id="lk"><div class="nl">🔒 DO Lock</div><div class="ns">A: ok, fence=7 · B: bị từ chối</div></div>
    <div class="arrow" id="a2">↓ hot key? chia shard</div>
    <div class="row">
      <div class="node" id="s0"><div class="nl">🧱 like:p1:0</div><div class="ns">+1</div></div>
      <div class="node" id="s1"><div class="nl">🧱 like:p1:1</div><div class="ns">+1</div></div>
      <div class="node" id="s2"><div class="nl">🧱 like:p1:15</div><div class="ns">+1</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Hai tiến trình tranh lock", tab: "lock", highlight: [2, 4, 5], on: ["p1", "p2", "a1"],
      desc: "Cùng tên object → tuần tự. Không cần Redis Redlock." },
    { title: "2 · Lease + fence", tab: "lock", highlight: [6, 7, 8], on: ["lk"],
      desc: "Lock có hạn để không kẹt vĩnh viễn; fence tăng dần giúp hệ đích từ chối holder đã hết hạn nhưng chưa biết." },
    { title: "3 · Rate limit chính xác", tab: "rl", highlight: [4, 5, 6, 7], on: ["lk"],
      desc: "Token bucket: nạp token theo thời gian đã trôi, mỗi request lấy 1. Mọi request của một API key qua đúng một object." },
    { title: "4 · Hay dùng binding cho nhanh", tab: "binding", highlight: [5, 9, 10], on: ["p1"],
      desc: "Binding ratelimits đếm theo location, xấp xỉ, period chỉ 10 hoặc 60 s — hợp chặn lạm dụng, không hợp tính quota tiền." },
    { title: "5 · Chia object nóng", tab: "shard", highlight: [4, 5, 9, 10, 11], on: ["a2", "s0", "s1", "s2"],
      desc: "Ghi rải ngẫu nhiên vào 16 shard, đọc thì cộng lại. Đổi lại: đọc tốn 16 lời gọi, nên hay kết hợp cache." }
  ],

  quiz: [
    { q: "Vì sao lock trong DO nên có thời hạn (lease)?", options: [
        "Để tiết kiệm storage",
        "Để holder bị chết/treo không giữ lock vĩnh viễn",
        "Vì DO bắt buộc",
        "Để tăng throughput"
      ], correct: 1, explanation: "Không có lease → một tiến trình crash có thể khoá hệ thống mãi mãi." },
    { q: "Fencing token giải quyết vấn đề gì?", options: [
        "Lock bị trùng tên",
        "Holder cũ (đã hết lease nhưng không biết) vẫn ghi vào hệ đích",
        "Giảm độ trễ",
        "Mã hoá dữ liệu"
      ], correct: 1, explanation: "Hệ đích từ chối ghi có fence nhỏ hơn số lớn nhất đã thấy." },
    { q: "Binding ratelimits của Workers có đặc điểm nào?", options: [
        "Chính xác tuyệt đối toàn cầu",
        "Nhanh, đếm theo từng location và xấp xỉ; period là 10 hoặc 60 giây",
        "Chỉ chạy trong DO",
        "Lưu vào D1"
      ], correct: 1, explanation: "Hợp để chặn lạm dụng; quota tính tiền nên dùng DO." },
    { q: "Counter lượt like của một bài viral bị nghẽn ở một object. Cách xử lý?", options: [
        "Chuyển counter sang biến global",
        "Chia thành N shard object, ghi ngẫu nhiên, đọc thì cộng",
        "Dùng KV put mỗi lượt like",
        "Tăng CPU limit"
      ], correct: 1, explanation: "KV giới hạn 1 write/giây/key nên càng không hợp." },
    { q: "Token bucket trong DO lưu tối thiểu những gì?", options: [
        "Danh sách mọi request",
        "Số token hiện tại và thời điểm cập nhật cuối",
        "Chỉ capacity",
        "IP người dùng"
      ], correct: 1, explanation: "Token được nạp lại tính theo thời gian trôi." },
    { q: "Nguyên tắc chọn tên object là gì?", options: [
        "Càng ít object càng tốt",
        "Những thứ cần nhất quán tuần tự với nhau thì chung object, thứ độc lập tách ra",
        "Mỗi request một object mới",
        "Tên ngẫu nhiên"
      ], correct: 1, explanation: "Tên object = ranh giới nhất quán." },
    { q: "Pattern DO nào thay cho Redis SETNX trong Java?", options: [
        "Counter", "Lock/lease", "Room", "Alarm"
      ], correct: 1, explanation: "SETNX thường dùng làm lock phân tán." },
    { q: "Trong acquire() của Lock, vì sao không nên await fetch() giữa lúc đọc và ghi?", options: [
        "Vì fetch bị cấm",
        "Vì await ra ngoài mở input gate, request khác có thể chen vào và cả hai cùng lấy được lock",
        "Vì tốn tiền",
        "Không sao cả"
      ], correct: 1, explanation: "Giữ đọc–kiểm tra–ghi trong một lượt đồng bộ." },
    { q: "Sharding theo hash(userId) % 16 trong tenant lớn giữ được điều gì mà sharding ngẫu nhiên không?", options: [
        "Tổng toàn tenant tính nhanh hơn",
        "Mọi thao tác của cùng một user vẫn tuần tự trong cùng shard",
        "Không tốn storage",
        "Không cần định tuyến"
      ], correct: 1, explanation: "Khoá con xác định shard nên thứ tự theo user được bảo toàn." }
  ]
});
