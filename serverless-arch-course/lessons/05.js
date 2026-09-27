window.LESSONS.push({
  id: "05",
  phase: "1", phaseName: "Durable Objects sâu",
  title: "WebSocket Hibernation: phòng chat, realtime mà không trả tiền lúc im lặng",
  subtitle: "acceptWebSocket · webSocketMessage/Close · tags · serializeAttachment · auto-response ping/pong",

  theory: `
    <p>Realtime (chat, trạng thái đơn hàng, bảng giá) cần một nơi <strong>giữ mọi kết nối của cùng một "phòng"</strong> để broadcast.
    Trong Spring bạn dùng STOMP + message broker (Redis/RabbitMQ) để các node chia sẻ subscriber. Với DO, <strong>mỗi phòng là một object</strong>:
    mọi client của phòng đều nối vào đúng object đó, broadcast chỉ là vòng <code>for</code>.</p>

    <p><strong>Vấn đề tiền</strong>: WebSocket có thể mở hàng giờ mà gần như không có message. Nếu object phải "thức" suốt thời gian đó thì tính phí duration liên tục.
    <strong>Hibernation API</strong> giải quyết: runtime (không phải code của bạn) giữ socket; object được phép bị gỡ khỏi bộ nhớ khi rảnh và
    chỉ được nạp lại khi có message. Lúc ngủ không tính phí duration.</p>

    <table>
      <tr><th>API</th><th>Vai trò</th></tr>
      <tr><td><code>ctx.acceptWebSocket(ws, tags?)</code></td><td>Giao socket cho runtime quản lý (thay cho <code>ws.accept()</code> — cách đó KHÔNG hibernate được)</td></tr>
      <tr><td><code>webSocketMessage(ws, msg)</code>, <code>webSocketClose(ws, code, reason, wasClean)</code>, <code>webSocketError(ws, err)</code></td><td>Handler là method của class, không phải <code>addEventListener</code></td></tr>
      <tr><td><code>ctx.getWebSockets(tag?)</code></td><td>Lấy lại mọi socket (hoặc theo tag) — kể cả sau khi thức dậy</td></tr>
      <tr><td><code>ws.serializeAttachment(obj)</code> / <code>deserializeAttachment()</code></td><td>Gắn dữ liệu nhỏ (userId, tên) vào socket, sống qua hibernation</td></tr>
      <tr><td><code>ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'))</code></td><td>Runtime tự trả lời ping mà không đánh thức object</td></tr>
    </table>

    <p><strong>Hệ quả khi thức dậy</strong>: constructor chạy lại, mọi biến instance (Map người dùng...) <em>mất</em>. Vì vậy state gắn socket phải nằm trong attachment,
    state phòng phải nằm trong storage. Worker chuyển tiếp upgrade bằng <code>stub.fetch(request)</code> (WebSocket đi qua fetch, không qua RPC).</p>

    <div class="callout"><p>💡 Một phòng = một object có trần throughput. Phòng 100 người thoải mái; livestream 200.000 người xem thì cần <strong>fan-out nhiều tầng</strong>
    (object gốc đẩy tới N object "relay", mỗi relay giữ một phần kết nối) — xem bài 06 về sharding.</p></div>
  `,

  codeTabs: [
    { id: "worker", label: "① Worker: định tuyến", lines: [
      "export default {",
      "  async fetch(req, env) {",
      "    const url = new URL(req.url);",
      "    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected WS', { status: 426 });",
      "    const user = await verifyJwt(req);            // xác thực TRƯỚC khi vào room",
      "    const room = url.searchParams.get('room');",
      "    const fwd = new Request(req, { headers: new Headers(req.headers) });",
      "    fwd.headers.set('X-User', user.sub);",
      "    return env.ROOM.getByName(room).fetch(fwd);   // upgrade đi qua fetch",
      "  }",
      "};"
    ]},
    { id: "accept", label: "② DO: nhận kết nối", lines: [
      "export class Room extends DurableObject {",
      "  constructor(ctx, env) {",
      "    super(ctx, env);",
      "    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));",
      "  }",
      "  async fetch(req) {",
      "    const [client, server] = Object.values(new WebSocketPair());",
      "    const userId = req.headers.get('X-User');",
      "    this.ctx.acceptWebSocket(server, ['user:' + userId]);   // tag để tìm lại",
      "    server.serializeAttachment({ userId, joinedAt: Date.now() });",
      "    return new Response(null, { status: 101, webSocket: client });",
      "  }"
    ]},
    { id: "msg", label: "③ DO: message & close", lines: [
      "  async webSocketMessage(ws, message) {",
      "    const { userId } = ws.deserializeAttachment();     // còn nguyên sau hibernation",
      "    const out = JSON.stringify({ from: userId, text: String(message) });",
      "    this.ctx.storage.sql.exec('INSERT INTO msg(uid, body) VALUES (?, ?)', userId, out);",
      "    for (const s of this.ctx.getWebSockets()) s.send(out);",
      "  }",
      "  async webSocketClose(ws, code, reason, wasClean) {",
      "    ws.close(code, reason);",
      "  }",
      "  kick(userId) {                                     // gọi qua RPC từ admin",
      "    for (const s of this.ctx.getWebSockets('user:' + userId)) s.close(4001, 'kicked');",
      "  }",
      "}"
    ]},
    { id: "wrong", label: "④ Cách KHÔNG hibernate", lines: [
      "// ws.accept() + addEventListener: object phải thức suốt thời gian socket mở",
      "server.accept();",
      "server.addEventListener('message', (e) => this.broadcast(e.data));",
      "this.sessions.set(server, { userId });   // Map trong RAM — mất nếu object bị gỡ",
      "// → tính phí duration kể cả khi phòng im lặng hàng giờ"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="c1"><div class="nl">📱 Client A</div><div class="ns">wss://.../chat?room=42</div></div>
      <div class="node" id="c2"><div class="nl">💻 Client B</div><div class="ns">cùng room 42</div></div>
    </div>
    <div class="arrow" id="a1">↓ Worker xác thực → getByName('42').fetch()</div>
    <div class="node" id="room"><div class="nl">🧱 DO Room 42</div><div class="ns">acceptWebSocket(server, tags)</div></div>
    <div class="arrow" id="a2">↓ im lặng → hibernate (runtime giữ socket)</div>
    <div class="row">
      <div class="node" id="zz"><div class="nl">😴 Ngủ</div><div class="ns">không tính duration · ping tự trả pong</div></div>
      <div class="node" id="wake"><div class="nl">⚡ Message tới</div><div class="ns">constructor → webSocketMessage</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Xác thực ở Worker", tab: "worker", highlight: [4, 5, 8], on: ["c1", "c2"],
      desc: "Kiểm tra JWT trước, truyền danh tính đã xác thực qua header nội bộ. DO không nên tin query string của client." },
    { title: "2 · Mọi client về một object", tab: "worker", highlight: [6, 9], on: ["a1", "room"],
      desc: "Tên room → cùng object. Upgrade WebSocket đi qua stub.fetch()." },
    { title: "3 · Giao socket cho runtime", tab: "accept", highlight: [4, 9, 10, 11], on: ["room"],
      desc: "acceptWebSocket (không phải accept) + attachment + tag. Auto-response xử lý ping mà không đánh thức object." },
    { title: "4 · Ngủ đông", tab: "wrong", highlight: [2, 4, 5], on: ["a2", "zz"],
      desc: "Đối chiếu: với accept() + Map trong RAM, object phải thức và trả tiền. Hibernation thì runtime giữ socket, object được gỡ." },
    { title: "5 · Thức dậy khi có message", tab: "msg", highlight: [1, 2, 4, 5], on: ["wake"],
      desc: "Constructor chạy lại, rồi webSocketMessage. Danh tính lấy từ attachment, danh sách socket lấy từ getWebSockets()." },
    { title: "6 · Tag để thao tác theo nhóm", tab: "msg", highlight: [10, 11], on: ["room"],
      desc: "getWebSockets('user:7') trả mọi tab/thiết bị của user 7 — dùng để kick hoặc gửi riêng." }
  ],

  quiz: [
    { q: "Muốn DO được hibernate khi giữ WebSocket, phải nhận socket bằng gì?", options: [
        "ws.accept()", "this.ctx.acceptWebSocket(ws)", "new WebSocket(url)", "ctx.waitUntil(ws)"
      ], correct: 1, explanation: "ws.accept() buộc object thức suốt thời gian socket mở." },
    { q: "Sau khi object thức dậy từ hibernation, cái gì bị mất?", options: [
        "Các socket đang mở",
        "Biến instance trong RAM (Map, mảng...) — constructor chạy lại",
        "Dữ liệu SQLite",
        "Attachment của socket"
      ], correct: 1, explanation: "Socket do runtime giữ; attachment và storage còn nguyên." },
    { q: "Lưu userId gắn với một socket sao cho sống qua hibernation?", options: [
        "Biến global", "ws.serializeAttachment({ userId })", "Cookie", "KV"
      ], correct: 1, explanation: "Đọc lại bằng deserializeAttachment() trong handler." },
    { q: "setWebSocketAutoResponse('ping' → 'pong') có lợi gì?", options: [
        "Mã hoá message",
        "Runtime tự trả lời heartbeat mà không đánh thức object → không tốn duration",
        "Tăng số kết nối tối đa",
        "Bắt buộc để WebSocket hoạt động"
      ], correct: 1, explanation: "Heartbeat là nguyên nhân phổ biến khiến object thức liên tục." },
    { q: "Worker chuyển kết nối WebSocket vào DO bằng cách nào?", options: [
        "Gọi RPC stub.connect(ws)",
        "return stub.fetch(request) với request Upgrade: websocket",
        "Gửi socket qua Queues",
        "Không thể, client phải nối thẳng tới DO"
      ], correct: 1, explanation: "Upgrade WebSocket đi qua fetch." },
    { q: "Lấy mọi socket của user 7 trong phòng (đã accept với tag 'user:7')?", options: [
        "this.sessions.get(7)", "this.ctx.getWebSockets('user:7')", "env.ROOM.get('user:7')", "ws.tags"
      ], correct: 1, explanation: "Tag truyền ở tham số thứ hai của acceptWebSocket." },
    { q: "Spring cần message broker để broadcast chat giữa nhiều node. Với DO vì sao không cần?", options: [
        "Vì DO dùng Redis ngầm",
        "Vì mọi client của cùng phòng nối vào cùng một object, broadcast là vòng lặp trong bộ nhớ",
        "Vì chỉ có một node",
        "Vì WebSocket tự broadcast"
      ], correct: 1, explanation: "Định tuyến theo tên thay cho pub/sub giữa node." },
    { q: "Nên xác thực người dùng ở đâu?", options: [
        "Tin vào ?userId= trong URL ở DO",
        "Ở Worker trước khi forward, rồi truyền danh tính đã xác thực vào DO",
        "Không cần vì WebSocket đã an toàn",
        "Trong webSocketClose"
      ], correct: 1, explanation: "DO chỉ nên nhận danh tính đã được kiểm tra." },
    { q: "Một livestream 200.000 người xem, một object room không chịu nổi. Hướng xử lý?", options: [
        "Tăng memory",
        "Fan-out nhiều tầng: object gốc gửi tới nhiều object relay, mỗi relay giữ một phần kết nối",
        "Chuyển sang KV",
        "Dùng ws.accept()"
      ], correct: 1, explanation: "Scale DO bằng số lượng object." }
  ]
});
