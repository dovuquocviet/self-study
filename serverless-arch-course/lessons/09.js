window.LESSONS.push({
  id: "09",
  phase: "2", phaseName: "Bất đồng bộ: Queues & Workflows",
  title: "Workflows: durable execution cho quy trình nhiều bước",
  subtitle: "WorkflowEntrypoint · step.do · step.sleep · waitForEvent · retry theo step · NonRetryableError",

  theory: `
    <p>Quy trình "đặt hàng → trừ kho → thu tiền → chờ giao → sau 7 ngày xin review" trong Spring thường thành: bảng trạng thái + <code>@Scheduled</code> quét + vài Kafka topic.
    Logic bị xé ra nhiều nơi. <strong>Workflows</strong> cho bạn viết cả quy trình như <em>một hàm async bình thường</em>, còn nền tảng lo việc
    lưu tiến độ, retry, ngủ nhiều ngày, và tiếp tục sau khi máy chết.</p>

    <p><strong>Cơ chế durable execution</strong></p>
    <ul>
      <li>Mỗi <code>step.do(name, fn)</code> chạy xong thì <strong>kết quả được lưu</strong> (≤ 1 MiB, phải serialize được).</li>
      <li>Khi instance bị gián đoạn/ngủ dậy, hàm <code>run()</code> được <strong>chạy lại từ đầu</strong>; các step đã xong không chạy lại mà trả ngay kết quả đã lưu (replay).</li>
      <li>Vì thế: <strong>mọi tác dụng phụ và mọi thứ không tất định</strong> (gọi API, <code>Date.now()</code>, <code>Math.random()</code>, <code>crypto.randomUUID()</code>) phải nằm <em>trong</em> step.
      Code ngoài step phải tất định. Tên step phải ổn định (dùng như khoá cache).</li>
    </ul>

    <table>
      <tr><th>API</th><th>Ghi chú</th></tr>
      <tr><td><code>step.do(name, config?, fn)</code></td><td>Mặc định retry 5 lần, delay 10 s, backoff exponential, timeout 10 phút mỗi lần thử</td></tr>
      <tr><td><code>step.sleep(name, '3 days')</code> / <code>step.sleepUntil(name, date)</code></td><td>Ngủ tối đa 365 ngày, không tốn CPU, không tính vào số step</td></tr>
      <tr><td><code>step.waitForEvent(name, { type, timeout })</code></td><td>Chờ sự kiện ngoài (webhook thanh toán, người duyệt)</td></tr>
      <tr><td><code>throw new NonRetryableError(msg)</code></td><td>Từ <code>cloudflare:workflows</code>: dừng retry, fail ngay</td></tr>
      <tr><td><code>env.WF.create({ id, params })</code>, <code>env.WF.get(id)</code>, <code>instance.status()</code>, <code>instance.sendEvent({ type, payload })</code></td><td>Điều khiển instance từ Worker</td></tr>
    </table>
    <p>Giới hạn (Paid): 10.000 step/workflow (cấu hình tới 25.000), CPU mỗi step như Worker (30 s → 5 phút), 1 MiB kết quả mỗi step, trạng thái instance đã xong giữ 30 ngày.</p>

    <div class="callout"><p>💡 Step có thể chạy lại (retry, hoặc chạy xong nhưng chưa kịp lưu kết quả) → mỗi step vẫn phải <strong>idempotent</strong>, truyền idempotency key xuống hệ đích.
    Dùng <code>id</code> nghiệp vụ khi <code>create</code> (vd <code>order-9</code>) để không tạo hai quy trình cho cùng đơn hàng.</p></div>

    <p><strong>Khi nào chọn gì</strong>: một việc đơn lẻ, chạy nhanh → Queues. Chuỗi nhiều bước có trạng thái, cần chờ lâu/chờ sự kiện, cần bù trừ khi lỗi → Workflows.
    Trạng thái sống, nhiều người cùng tương tác realtime → Durable Object.</p>
  `,

  codeTabs: [
    { id: "wf", label: "① Định nghĩa workflow", lines: [
      "import { WorkflowEntrypoint } from 'cloudflare:workers';",
      "import { NonRetryableError } from 'cloudflare:workflows';",
      "",
      "export class OrderFlow extends WorkflowEntrypoint {",
      "  async run(event, step) {",
      "    const { orderId } = event.payload;",
      "    const hold = await step.do('reserve stock', async () => {",
      "      return callInventory(this.env, orderId);          // trả về JSON nhỏ",
      "    });",
      "    const pay = await step.do('charge',",
      "      { retries: { limit: 3, delay: '30 seconds', backoff: 'exponential' }, timeout: '2 minutes' },",
      "      async () => {",
      "        const r = await chargeCard(this.env, orderId, { idempotencyKey: orderId + ':charge' });",
      "        if (r.declined) throw new NonRetryableError('card declined');",
      "        return { chargeId: r.id };",
      "      });",
      "    const shipped = await step.waitForEvent('wait shipped', { type: 'shipped', timeout: '14 days' });",
      "    await step.sleep('after delivery', '7 days');",
      "    await step.do('ask review', async () => sendReviewMail(this.env, orderId));",
      "  }",
      "}"
    ]},
    { id: "ctl", label: "② Khởi chạy & gửi sự kiện", lines: [
      "export default {",
      "  async fetch(req, env) {",
      "    const url = new URL(req.url);",
      "    if (url.pathname === '/orders') {",
      "      const { orderId } = await req.json();",
      "      const inst = await env.ORDER_FLOW.create({ id: 'order-' + orderId, params: { orderId } });",
      "      return Response.json({ id: inst.id, status: await inst.status() });",
      "    }",
      "    if (url.pathname === '/webhook/shipped') {",
      "      const { orderId, tracking } = await req.json();",
      "      const inst = await env.ORDER_FLOW.get('order-' + orderId);",
      "      await inst.sendEvent({ type: 'shipped', payload: { tracking } });",
      "      return new Response('ok');",
      "    }",
      "  }",
      "};"
    ]},
    { id: "cfg", label: "③ wrangler.jsonc", lines: [
      "\"workflows\": [{",
      "  \"name\": \"order-flow\",",
      "  \"binding\": \"ORDER_FLOW\",",
      "  \"class_name\": \"OrderFlow\"",
      "}]",
      "",
      "# npx wrangler workflows instances describe order-flow order-9"
    ]},
    { id: "trap", label: "④ Bẫy replay", lines: [
      "async run(event, step) {",
      "  const id = crypto.randomUUID();                  // SAI: mỗi lần replay ra id khác",
      "  const now = Date.now();                          // SAI: không tất định",
      "  await step.do('create invoice', () => createInvoice(id, now));",
      "",
      "  // ĐÚNG: sinh giá trị bên trong step để được lưu lại",
      "  const inv = await step.do('new id', async () => ({ id: crypto.randomUUID(), at: Date.now() }));",
      "  await step.do('create invoice v2', () => createInvoice(inv.id, inv.at));",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="s1"><div class="nl">① reserve stock</div><div class="ns">xong → lưu kết quả</div></div>
    <div class="arrow" id="a1">↓</div>
    <div class="node" id="s2"><div class="nl">② charge</div><div class="ns">lỗi 5xx → retry backoff · declined → dừng</div></div>
    <div class="arrow" id="a2">↓</div>
    <div class="node" id="s3"><div class="nl">③ waitForEvent('shipped')</div><div class="ns">ngủ tới khi webhook gửi sự kiện</div></div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="s4"><div class="nl">④ sleep 7 days → ask review</div><div class="ns">không tốn CPU khi ngủ</div></div>
    <div class="node" id="rp"><div class="nl">♻️ Replay sau gián đoạn</div><div class="ns">run() chạy lại, step đã xong trả kết quả đã lưu</div></div>
  `,
  steps: [
    { title: "1 · Step đầu", tab: "wf", highlight: [7, 8, 9], on: ["s1"],
      desc: "Kết quả step được lưu bền. Instance chết sau đó thì step này không chạy lại." },
    { title: "2 · Retry theo step", tab: "wf", highlight: [10, 11, 13, 14], on: ["a1", "s2"],
      desc: "Cấu hình retry riêng. Idempotency key cho cổng thanh toán. Thẻ bị từ chối là lỗi vĩnh viễn → NonRetryableError." },
    { title: "3 · Chờ sự kiện ngoài", tab: "ctl", highlight: [11, 12], on: ["a2", "s3"],
      desc: "Webhook của hãng vận chuyển gọi sendEvent vào đúng instance nhờ id nghiệp vụ 'order-…'." },
    { title: "4 · Ngủ nhiều ngày", tab: "wf", highlight: [17, 18, 19], on: ["a3", "s4"],
      desc: "Không cần bảng trạng thái + cron quét. Ngủ tới 365 ngày." },
    { title: "5 · Replay", tab: "trap", highlight: [2, 3, 7, 8], on: ["rp"],
      desc: "run() chạy lại từ đầu mỗi lần tiếp tục. Giá trị ngẫu nhiên/thời gian phải sinh trong step thì mới ổn định." },
    { title: "6 · Khởi chạy có id nghiệp vụ", tab: "ctl", highlight: [6, 7], on: ["s1"],
      desc: "create với id = 'order-9': gửi trùng request không tạo hai quy trình cho một đơn." }
  ],

  quiz: [
    { q: "Khi một workflow instance tiếp tục sau gián đoạn, hàm run() làm gì?", options: [
        "Tiếp tục từ đúng dòng code đang dừng",
        "Chạy lại từ đầu; step đã hoàn thành trả ngay kết quả đã lưu",
        "Bắt đầu instance mới",
        "Chạy lại mọi step"
      ], correct: 1, explanation: "Đây là replay — lý do code ngoài step phải tất định." },
    { q: "Vì sao không được gọi crypto.randomUUID() ngoài step?", options: [
        "Vì bị cấm trong Workers",
        "Vì mỗi lần replay sẽ sinh giá trị khác, làm các step sau nhận dữ liệu không nhất quán",
        "Vì tốn CPU",
        "Vì UUID quá dài"
      ], correct: 1, explanation: "Sinh trong step để giá trị được lưu." },
    { q: "Cấu hình retry mặc định của step.do?", options: [
        "Không retry",
        "5 lần, delay 10 s, backoff exponential, timeout 10 phút",
        "3 lần, 1 s, constant",
        "Vô hạn"
      ], correct: 1, explanation: "Theo tài liệu Workflows." },
    { q: "Muốn một step thất bại ngay, không retry (vd thẻ bị từ chối)?", options: [
        "return null",
        "throw new NonRetryableError(...)",
        "step.sleep(0)",
        "process.exit()"
      ], correct: 1, explanation: "Import từ 'cloudflare:workflows'." },
    { q: "Workflow chờ webhook 'đã giao hàng' từ hãng vận chuyển. Dùng API nào?", options: [
        "step.sleep", "step.waitForEvent + instance.sendEvent", "Queues", "setTimeout"
      ], correct: 1, explanation: "Worker nhận webhook gọi sendEvent vào instance theo id." },
    { q: "Kết quả trả về từ một step bị giới hạn thế nào?", options: [
        "Không giới hạn",
        "Phải serialize được và ≤ 1 MiB",
        "Chỉ được là string",
        "≤ 128 KB"
      ], correct: 1, explanation: "Dữ liệu lớn → lưu R2, step trả về khoá." },
    { q: "Vì sao nên create instance với id nghiệp vụ (vd 'order-9')?", options: [
        "Để đẹp log",
        "Để request trùng không tạo hai quy trình và để sendEvent/get tìm đúng instance",
        "Bắt buộc bởi API",
        "Để giảm giá"
      ], correct: 1, explanation: "Id là khoá tự nhiên của quy trình." },
    { q: "step.sleep có tính vào giới hạn số step không?", options: [
        "Có", "Không", "Chỉ khi ngủ > 1 ngày", "Chỉ trên Free"
      ], correct: 1, explanation: "Tài liệu: step.sleep không tính vào max steps." },
    { q: "Quy trình 'trừ kho → thu tiền → chờ giao 14 ngày → xin review' nên dùng gì?", options: [
        "Một Worker request dài",
        "Workflows",
        "KV",
        "Cron chạy mỗi phút"
      ], correct: 1, explanation: "Nhiều bước, có chờ, cần retry theo bước → durable execution." },
    { q: "Step có còn cần idempotent khi đã có durable execution?", options: [
        "Không, nền tảng đảm bảo exactly-once",
        "Có — step có thể chạy lại khi retry hoặc khi đã xong nhưng chưa kịp lưu kết quả",
        "Chỉ step cuối",
        "Chỉ khi dùng Queues"
      ], correct: 1, explanation: "Truyền idempotency key xuống hệ đích." }
  ]
});
