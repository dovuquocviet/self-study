window.LESSONS.push({
  id: "04",
  phase: "1", phaseName: "Durable Objects sâu",
  title: "Alarm: hẹn giờ cho từng object",
  subtitle: "setAlarm · alarm(alarmInfo) · at-least-once · một alarm mỗi object · lịch nhiều việc",

  theory: `
    <p>Không có <code>@Scheduled</code> hay thread nền. Thay vào đó mỗi DO có thể đặt <strong>một alarm</strong>: "đánh thức tôi lúc T".
    Tới giờ, runtime gọi method <code>alarm()</code> của object — kể cả khi object đang ngủ hay đã bị gỡ khỏi bộ nhớ.</p>

    <p><strong>API</strong></p>
    <ul>
      <li><code>ctx.storage.setAlarm(epochMs)</code> — đặt (hoặc <em>ghi đè</em>) alarm. Mỗi object chỉ có <strong>một</strong> alarm tại một thời điểm.</li>
      <li><code>ctx.storage.getAlarm()</code> → epoch ms hoặc <code>null</code>; <code>ctx.storage.deleteAlarm()</code>.</li>
      <li><code>async alarm(alarmInfo)</code> — handler; <code>alarmInfo.retryCount</code>, <code>alarmInfo.isRetry</code>.</li>
    </ul>

    <p><strong>Ngữ nghĩa giao nhận</strong>: <em>at-least-once</em>. Nếu <code>alarm()</code> ném lỗi, runtime tự retry với backoff lũy thừa
    (bắt đầu 2 giây, tối đa 6 lần). Vì vậy handler phải <strong>idempotent</strong>: chạy 2 lần cho cùng một việc không gây hại.
    Mỗi object chỉ chạy một <code>alarm()</code> tại một thời điểm.</p>

    <p><strong>Nhiều việc hẹn giờ trong một object</strong>: vì chỉ có một alarm, lưu danh sách việc vào bảng SQLite
    (<code>due_at</code>, <code>payload</code>), luôn đặt alarm = <code>MIN(due_at)</code>. Trong <code>alarm()</code>: xử lý mọi việc đã tới hạn, xoá chúng, đặt alarm cho việc kế tiếp.</p>

    <table>
      <tr><th>Nhu cầu</th><th>Dùng</th></tr>
      <tr><td>Job định kỳ toàn hệ thống (mỗi đêm dọn dẹp)</td><td>Cron Trigger của Worker</td></tr>
      <tr><td>Hẹn giờ theo thực thể (giỏ hàng hết hạn sau 30 phút, phòng chat đóng khi trống)</td><td>DO alarm</td></tr>
      <tr><td>Chuỗi nhiều bước có chờ (gửi mail nhắc sau 3 ngày rồi huỷ đơn)</td><td>Workflows (bài 10)</td></tr>
      <tr><td>Trì hoãn một message ≤ 24h</td><td>Queues <code>delaySeconds</code></td></tr>
    </table>

    <div class="callout"><p>💡 Mẫu hay gặp: object "tự dọn": mỗi lần có hoạt động, đặt lại alarm = now + TTL; khi alarm chạy mà không có hoạt động mới thì <code>ctx.storage.deleteAll()</code>.
    Object không có dữ liệu thì không tốn phí lưu trữ.</p></div>
  `,

  codeTabs: [
    { id: "simple", label: "① Giỏ hàng tự hết hạn", lines: [
      "const TTL = 30 * 60 * 1000;",
      "",
      "export class Cart extends DurableObject {",
      "  async add(sku, qty) {",
      "    this.ctx.storage.sql.exec('INSERT INTO item VALUES (?, ?)', sku, qty);",
      "    await this.ctx.storage.setAlarm(Date.now() + TTL);   // ghi đè alarm cũ",
      "  }",
      "  async alarm(info) {",
      "    if (info?.isRetry) console.log('retry lần', info.retryCount);",
      "    await this.releaseStock();          // phải idempotent",
      "    await this.ctx.storage.deleteAlarm();   // date < 2026-02-24 thì deleteAll không xoá alarm",
      "    await this.ctx.storage.deleteAll();     // object rỗng → không tốn storage",
      "  }",
      "}"
    ]},
    { id: "multi", label: "② Nhiều việc, một alarm", lines: [
      "schedule(dueAt, job) {",
      "  const sql = this.ctx.storage.sql;",
      "  sql.exec('INSERT INTO job(due_at, payload) VALUES (?, ?)', dueAt, JSON.stringify(job));",
      "  const next = sql.exec('SELECT MIN(due_at) AS t FROM job').one().t;",
      "  return this.ctx.storage.setAlarm(next);",
      "}",
      "",
      "async alarm() {",
      "  const sql = this.ctx.storage.sql;",
      "  const due = sql.exec('SELECT id, payload FROM job WHERE due_at <= ?', Date.now()).toArray();",
      "  for (const j of due) {",
      "    await this.run(JSON.parse(j.payload));",
      "    sql.exec('DELETE FROM job WHERE id = ?', j.id);   // xoá từng việc xong",
      "  }",
      "  const next = sql.exec('SELECT MIN(due_at) AS t FROM job').one().t;",
      "  if (next) await this.ctx.storage.setAlarm(next);",
      "}"
    ]},
    { id: "cron", label: "③ Cron Trigger (so sánh)", lines: [
      "// wrangler.jsonc",
      "\"triggers\": { \"crons\": [\"0 2 * * *\"] }     // 02:00 UTC mỗi ngày",
      "",
      "export default {",
      "  async scheduled(controller, env, ctx) {",
      "    ctx.waitUntil(cleanupExpiredSessions(env));",
      "  }",
      "};"
    ]},
    { id: "java", label: "④ Spring tương đương", lines: [
      "@Scheduled(fixedDelay = 60_000)",
      "public void expireCarts() {",
      "    // quét cả bảng cart tìm cái hết hạn — tốn và chậm dần theo số cart",
      "    cartRepo.findByUpdatedAtBefore(now().minusMinutes(30)).forEach(this::release);",
      "}",
      "// DO: mỗi cart tự hẹn giờ cho chính nó, không cần quét"
    ]}
  ],

  stageHtml: `
    <div class="node" id="act"><div class="nl">🛒 add(sku) lúc 10:00</div><div class="ns">setAlarm(10:30)</div></div>
    <div class="arrow" id="a1">↓ object ngủ, không tốn CPU</div>
    <div class="node" id="sleep"><div class="nl">😴 Object bị gỡ khỏi bộ nhớ</div><div class="ns">alarm vẫn được nền tảng giữ</div></div>
    <div class="arrow" id="a2">↓ 10:30 runtime đánh thức</div>
    <div class="row">
      <div class="node" id="run"><div class="nl">⏰ alarm()</div><div class="ns">trả hàng về kho</div></div>
      <div class="node" id="retry"><div class="nl">🔁 Lỗi → retry</div><div class="ns">backoff từ 2 s, tối đa 6 lần</div></div>
    </div>
    <div class="arrow" id="a3">↓ xong</div>
    <div class="node" id="gone"><div class="nl">🧹 deleteAll()</div><div class="ns">không còn dữ liệu</div></div>
  `,
  steps: [
    { title: "1 · Đặt alarm khi có hoạt động", tab: "simple", highlight: [5, 6], on: ["act"],
      desc: "setAlarm ghi đè alarm trước — mỗi lần thêm hàng là gia hạn thêm 30 phút." },
    { title: "2 · Object được phép ngủ", tab: "simple", highlight: [6], on: ["a1", "sleep"],
      desc: "Không có thread chờ. Alarm được lưu bền vững cùng object." },
    { title: "3 · Runtime gọi alarm()", tab: "simple", highlight: [8, 10], on: ["a2", "run"],
      desc: "Đến giờ, object được nạp lại (constructor chạy) rồi alarm() được gọi." },
    { title: "4 · At-least-once", tab: "simple", highlight: [9, 10], on: ["retry"],
      desc: "Ném lỗi → retry tự động. Vì có thể chạy lặp, releaseStock phải idempotent (vd kiểm tra đã trả chưa)." },
    { title: "5 · Dọn sạch", tab: "simple", highlight: [11, 12], on: ["a3", "gone"],
      desc: "deleteAll xoá storage; alarm chỉ bị xoá kèm nếu compatibility_date ≥ 2026-02-24, nên gọi deleteAlarm() trước cho chắc. Object rỗng không tốn tiền lưu trữ." },
    { title: "6 · Nhiều lịch trong một object", tab: "multi", highlight: [3, 4, 5, 10, 13, 16], on: ["run"],
      desc: "Bảng job + alarm = MIN(due_at). So với Spring @Scheduled quét cả bảng, mỗi object chỉ lo việc của mình." }
  ],

  quiz: [
    { q: "Một Durable Object có thể có bao nhiêu alarm cùng lúc?", options: [
        "Không giới hạn", "Một — setAlarm mới sẽ ghi đè", "Mười", "Một mỗi request"
      ], correct: 1, explanation: "Nhiều lịch → tự quản lý bảng job và đặt alarm cho việc sớm nhất." },
    { q: "Nếu alarm() ném lỗi thì sao?", options: [
        "Alarm bị huỷ vĩnh viễn",
        "Runtime tự retry với backoff lũy thừa (từ 2 giây, tối đa 6 lần)",
        "Object bị xoá",
        "Lỗi được gửi tới Queues"
      ], correct: 1, explanation: "Theo tài liệu Alarms API." },
    { q: "Vì sao handler alarm phải idempotent?", options: [
        "Vì giao nhận là at-least-once, có thể chạy lại",
        "Vì alarm chạy song song trên nhiều máy",
        "Vì CPU bị giới hạn",
        "Không cần"
      ], correct: 0, explanation: "Retry sau lỗi có thể xử lý lại phần đã làm." },
    { q: "Object đang bị gỡ khỏi bộ nhớ khi tới giờ alarm. Điều gì xảy ra?", options: [
        "Alarm bị bỏ lỡ",
        "Runtime nạp lại object (chạy constructor) rồi gọi alarm()",
        "Alarm chạy trong Worker gốc",
        "Phải có request tới thì alarm mới chạy"
      ], correct: 1, explanation: "Alarm được lưu bền cùng object." },
    { q: "Job dọn dẹp toàn hệ thống 2h sáng mỗi ngày nên dùng gì?", options: [
        "DO alarm cho từng user",
        "Cron Trigger",
        "setTimeout trong global scope",
        "KV expiration"
      ], correct: 1, explanation: "Việc toàn cục theo lịch cố định → Cron. Việc theo từng thực thể → alarm." },
    { q: "Muốn giỏ hàng hết hạn 30 phút sau lần thao tác cuối, cách làm?", options: [
        "Mỗi lần thao tác gọi setAlarm(now + 30 phút) để ghi đè",
        "Cron chạy mỗi phút quét mọi giỏ",
        "Đặt alarm một lần khi tạo giỏ",
        "Dùng KV TTL"
      ], correct: 0, explanation: "Ghi đè alarm = gia hạn." },
    { q: "Worker có compatibility_date 2026-03-01. Sau khi gọi ctx.storage.deleteAll() thì alarm đang đặt thế nào?", options: [
        "Vẫn còn",
        "Cũng bị xoá cùng storage",
        "Chạy ngay lập tức",
        "Chuyển sang object khác"
      ], correct: 1, explanation: "Với compatibility_date từ 2026-02-24 (flag delete_all_deletes_alarm) thì có. Date cũ hơn phải gọi thêm deleteAlarm() — nên gọi cả hai cho chắc." },
    { q: "So với @Scheduled quét bảng cart, cách dùng alarm theo từng object có lợi gì?", options: [
        "Không có lợi gì",
        "Không phải quét toàn bảng; mỗi object tự hẹn giờ đúng lúc cần, chi phí tỉ lệ với số việc thật",
        "Chính xác tới nano giây",
        "Không cần storage"
      ], correct: 1, explanation: "Không có công việc thừa khi số cart lớn." },
    { q: "Trong alarm() có bao nhiêu lần chạy đồng thời cho cùng một object?", options: [
        "Không giới hạn", "Tối đa một", "Tối đa sáu", "Bằng số CPU"
      ], correct: 1, explanation: "Mỗi object chỉ chạy một alarm handler tại một thời điểm." }
  ]
});
