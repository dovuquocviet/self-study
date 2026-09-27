window.LESSONS.push({
  id: "10",
  phase: "3", phaseName: "Dữ liệu: nhất quán & lưu trữ",
  title: "Nhất quán: KV (cuối cùng) vs D1 vs Durable Objects vs R2",
  subtitle: "Đọc được gì ngay sau khi ghi? Bảng chọn nơi lưu state theo mô hình nhất quán",

  theory: `
    <p>Trong Spring + một Postgres, bạn hiếm khi nghĩ về nhất quán: ghi xong đọc lại là thấy. Trên hệ phân tán toàn cầu, mỗi dịch vụ đổi một phần nhất quán lấy tốc độ đọc.
    Chọn sai → bug "lúc có lúc không" rất khó tái hiện.</p>

    <table>
      <tr><th></th><th>KV</th><th>D1</th><th>Durable Object</th><th>R2</th></tr>
      <tr><td>Mô hình</td><td><strong>Nhất quán cuối cùng</strong></td><td>Một primary ghi; replica đọc + Sessions API cho nhất quán tuần tự trong phiên</td><td><strong>Nhất quán mạnh</strong>, tuần tự trong một object</td><td>Nhất quán mạnh read-after-write (object & list)</td></tr>
      <tr><td>Ghi xong đọc ở châu lục khác</td><td>Có thể thấy giá trị cũ tới ~60 s (hoặc theo <code>cacheTtl</code>)</td><td>Thấy mới nếu đọc primary hoặc dùng bookmark</td><td>Luôn thấy mới (chỉ có một bản)</td><td>Thấy mới</td></tr>
      <tr><td>Ghi đồng thời</td><td>Last-write-wins; ≤ 1 write/giây/key</td><td>Transaction SQL trên primary</td><td>Tuần tự, không xung đột</td><td>Last-write-wins; có điều kiện qua <code>onlyIf</code> (etag)</td></tr>
      <tr><td>Đọc nhanh ở mọi nơi</td><td>Rất nhanh (cache ở PoP)</td><td>Nhanh nếu gần replica</td><td>Nhanh gần object, xa thì phải đi tới object</td><td>Tuỳ, có thể trước cache</td></tr>
      <tr><td>Hợp với</td><td>Cấu hình, feature flag, cache trang, bảng tra ít đổi</td><td>Dữ liệu quan hệ, query SQL, dữ liệu theo tenant</td><td>Điều phối, đếm, lock, phiên, state realtime</td><td>File, blob, payload lớn</td></tr>
    </table>

    <p><strong>KV hoạt động thế nào</strong>: dữ liệu gốc nằm ở kho trung tâm; mỗi PoP cache giá trị khi được đọc. Ghi hiện ngay ở PoP nơi ghi nhưng các PoP khác
    vẫn phục vụ bản cache cũ tới khi hết hạn. <code>cacheTtl</code> (tối thiểu 30 s) cho cache lâu hơn → đọc nhanh hơn, cũ lâu hơn.</p>

    <p><strong>Anti-pattern hay gặp</strong></p>
    <ul>
      <li>Lưu session/giỏ hàng/tồn kho trong KV rồi ghi mỗi request → dính giới hạn 1 write/s/key và đọc cũ.</li>
      <li>Dùng KV làm "khoá" chống double-submit → hai PoP đều đọc thấy "chưa có" cùng lúc.</li>
      <li>Ghi D1 rồi đọc qua replica trong request kế tiếp mà không mang bookmark → user không thấy thứ mình vừa lưu.</li>
    </ul>

    <div class="callout"><p>💡 Mẫu kết hợp phổ biến: <strong>DO hoặc D1 là nguồn sự thật</strong>, KV là <strong>bản sao để đọc nhanh</strong> (ghi vào KV sau khi ghi nguồn chính, chấp nhận trễ).
    Giống Spring dùng Postgres làm nguồn và Redis làm cache — chỉ khác là "cache" này tự phân phối ra toàn cầu.</p></div>
  `,

  codeTabs: [
    { id: "kv", label: "① KV: đọc cũ là bình thường", lines: [
      "// Admin cập nhật feature flag (ở Frankfurt)",
      "await env.FLAGS.put('checkout-v2', JSON.stringify({ on: true }));",
      "",
      "// User ở Sài Gòn vài giây sau",
      "const f = await env.FLAGS.get('checkout-v2', { type: 'json', cacheTtl: 60 });",
      "// → có thể vẫn { on: false } tới khi cache ở PoP SGN hết hạn",
      "",
      "// Giới hạn: > 1 write/giây vào cùng key → lỗi 429"
    ]},
    { id: "wrong", label: "② Anti-pattern: khoá bằng KV", lines: [
      "// Chống thanh toán hai lần — SAI",
      "const done = await env.KV.get('paid:' + orderId);",
      "if (!done) {",
      "  await charge(orderId);                    // 2 request ở 2 PoP đều tới được đây",
      "  await env.KV.put('paid:' + orderId, '1');",
      "}",
      "// ĐÚNG: hỏi Durable Object của đơn hàng (tuần tự, nhất quán mạnh)",
      "const r = await env.ORDER.getByName(orderId).payOnce();"
    ]},
    { id: "combo", label: "③ Nguồn chính + bản sao KV", lines: [
      "// Ghi: nguồn sự thật là D1",
      "await env.DB.prepare('UPDATE product SET price = ? WHERE id = ?').bind(price, id).run();",
      "// rồi làm mới bản đọc nhanh (chấp nhận trễ vài chục giây ở PoP khác)",
      "ctx.waitUntil(env.CATALOG_KV.put('product:' + id, JSON.stringify(await loadProduct(env, id))));",
      "",
      "// Đọc trang sản phẩm: KV trước, trượt thì D1",
      "const cached = await env.CATALOG_KV.get('product:' + id, { type: 'json' });",
      "return cached ?? await loadProduct(env, id);"
    ]},
    { id: "r2", label: "④ R2: ghi có điều kiện", lines: [
      "const cur = await env.BUCKET.head('config.json');",
      "const put = await env.BUCKET.put('config.json', body, {",
      "  onlyIf: { etagMatches: cur.etag }        // chỉ ghi nếu chưa ai sửa",
      "});",
      "if (put === null) return new Response('Conflict', { status: 409 });"
    ]}
  ],

  stageHtml: `
    <div class="node" id="w"><div class="nl">✍️ Ghi ở Frankfurt</div><div class="ns">put('checkout-v2', on)</div></div>
    <div class="arrow" id="a1">↓ lưu vào kho trung tâm</div>
    <div class="row">
      <div class="node" id="fra"><div class="nl">🟢 PoP FRA</div><div class="ns">thấy ngay</div></div>
      <div class="node" id="sgn"><div class="nl">🟡 PoP SGN</div><div class="ns">còn cache cũ ≤ ~60 s</div></div>
    </div>
    <div class="arrow" id="a2">↓ cần nhất quán mạnh?</div>
    <div class="node" id="do"><div class="nl">🧱 Durable Object / D1 primary</div><div class="ns">một nơi quyết định, đọc luôn mới</div></div>
  `,
  steps: [
    { title: "1 · Ghi vào KV", tab: "kv", highlight: [2], on: ["w", "a1"],
      desc: "Ghi thành công và hiện ngay ở PoP nơi ghi." },
    { title: "2 · Đọc ở nơi khác", tab: "kv", highlight: [5, 6], on: ["fra", "sgn"],
      desc: "PoP khác có thể trả bản cũ tới khi cache hết hạn — đây là thiết kế, không phải bug." },
    { title: "3 · Không làm khoá bằng KV", tab: "wrong", highlight: [2, 3, 4, 8], on: ["sgn", "a2", "do"],
      desc: "Kiểm tra rồi ghi trên KV không nguyên tử và đọc có thể cũ. Việc 'chỉ một lần' giao cho DO." },
    { title: "4 · Kết hợp", tab: "combo", highlight: [2, 4, 7, 8], on: ["do", "fra"],
      desc: "D1 là nguồn sự thật, KV là bản sao đọc nhanh. Giống Postgres + Redis nhưng phân phối toàn cầu." },
    { title: "5 · R2 và ghi có điều kiện", tab: "r2", highlight: [3, 5], on: ["do"],
      desc: "R2 nhất quán mạnh; etag giúp tránh ghi đè mất cập nhật của người khác (optimistic lock)." }
  ],

  quiz: [
    { q: "Mô hình nhất quán của Workers KV?", options: [
        "Nhất quán mạnh", "Nhất quán cuối cùng", "Serializable", "Linearizable theo key"
      ], correct: 1, explanation: "Ghi có thể mất tới ~60 s (hoặc theo cacheTtl) mới thấy ở nơi khác." },
    { q: "Giới hạn ghi vào cùng một key KV?", options: [
        "Không giới hạn", "1 write/giây", "100 write/giây", "1 write/phút"
      ], correct: 1, explanation: "Vượt sẽ bị 429." },
    { q: "Dùng KV để chống thanh toán hai lần có vấn đề gì?", options: [
        "Không có vấn đề",
        "Kiểm tra–rồi–ghi không nguyên tử và đọc có thể cũ, nên hai request đồng thời đều qua",
        "KV không lưu được chuỗi",
        "KV quá chậm"
      ], correct: 1, explanation: "Dùng DO của đơn hàng." },
    { q: "Thứ nào đảm bảo nhất quán mạnh và tuần tự cho mọi thao tác trên cùng khoá?", options: [
        "KV", "Cache API", "Durable Object", "Biến global"
      ], correct: 2, explanation: "Một object duy nhất xử lý tuần tự." },
    { q: "cacheTtl khi đọc KV có tác dụng gì?", options: [
        "Xoá key sau TTL",
        "Cho PoP giữ bản cache lâu hơn → đọc nhanh hơn nhưng có thể cũ lâu hơn (tối thiểu 30 s)",
        "Đảm bảo nhất quán mạnh",
        "Giới hạn số lần đọc"
      ], correct: 1, explanation: "Khác với expirationTtl khi put (xoá key)." },
    { q: "Dữ liệu nào hợp để lưu trong KV?", options: [
        "Tồn kho thay đổi mỗi giây",
        "Feature flag, cấu hình, bản sao catalog ít đổi",
        "Số dư tài khoản",
        "Session ghi mỗi request"
      ], correct: 1, explanation: "Đọc nhiều, ghi ít, chấp nhận trễ." },
    { q: "R2 có nhất quán read-after-write không?", options: [
        "Không", "Có, nhất quán mạnh", "Chỉ trong cùng region", "Chỉ khi bật cache"
      ], correct: 1, explanation: "Cả đọc object và list." },
    { q: "Ghi có điều kiện onlyIf: { etagMatches } trên R2 giúp gì?", options: [
        "Nén dữ liệu",
        "Chỉ ghi nếu object chưa bị ai sửa — tránh mất cập nhật (optimistic locking)",
        "Tăng tốc upload",
        "Mã hoá"
      ], correct: 1, explanation: "put trả null khi điều kiện không thoả." },
    { q: "Hai concurrent write vào cùng key KV từ hai nơi. Kết quả?", options: [
        "Merge hai giá trị", "Lỗi xung đột", "Last-write-wins", "Cả hai bị huỷ"
      ], correct: 2, explanation: "Nên ghi KV từ một nguồn duy nhất (vd DO hoặc job)." }
  ]
});
