window.LESSONS.push({
  id: "18",
  phase: "5", phaseName: "Vận hành",
  title: "Mutation, lightweight DELETE/UPDATE — và vì sao nên tránh",
  subtitle: "ALTER UPDATE/DELETE viết lại part · _row_exists · patch part · thay thế bằng thiết kế",

  theory: `
    <p>Part là bất biến. Vậy "sửa" dữ liệu nghĩa là <strong>viết lại</strong>. Có ba cơ chế, từ nặng tới nhẹ:</p>

    <p><strong>1. Mutation cổ điển</strong> — <code>ALTER TABLE t UPDATE col = ... WHERE ...</code> / <code>ALTER TABLE t DELETE WHERE ...</code></p>
    <ul>
      <li><strong>Bất đồng bộ</strong>: lệnh trả về ngay, việc chạy nền (<code>mutations_sync = 1/2</code> để chờ).</li>
      <li>Viết lại <strong>mọi part có hàng khớp</strong> (UPDATE chỉ viết lại cột bị đổi, DELETE viết lại cả part). Sửa 1 hàng trong part 10 GB = ghi lại cả phần đó.</li>
      <li>Không nguyên tử: query đọc giữa chừng thấy part đã sửa lẫn part chưa sửa.</li>
      <li>Xếp hàng tuần tự, cạnh tranh I/O với merge. Mutation lỗi kẹt lại, chặn mutation sau. Xem <code>system.mutations</code>, huỷ bằng <code>KILL MUTATION</code>.</li>
    </ul>

    <p><strong>2. Lightweight DELETE</strong> — <code>DELETE FROM t WHERE ...</code></p>
    <ul>
      <li>Chỉ ghi cột ẩn <code>_row_exists</code> = 0 cho hàng bị xoá (các cột khác được hardlink). Query tự lọc hàng đó ngay.</li>
      <li>Dữ liệu thật bị dọn khi merge. Nhanh hơn nhiều so với ALTER DELETE, nhưng vẫn là mutation bên dưới và làm query chậm hơn một chút (phải lọc mask).</li>
    </ul>

    <p><strong>3. Lightweight UPDATE</strong> (bản mới) — <code>UPDATE t SET ... WHERE ...</code></p>
    <ul>
      <li>Ghi <em>patch part</em> chỉ chứa giá trị mới của hàng bị đổi; SELECT áp patch khi đọc, merge áp vĩnh viễn.</li>
      <li>Cần bật setting bảng <code>enable_block_number_column</code> và <code>enable_block_offset_column</code>; không sửa được cột trong primary/partition key.</li>
      <li>Hợp với sửa lẻ tẻ, không phải thay cho mô hình ghi chính.</li>
    </ul>

    <p><strong>Thay thế bằng thiết kế</strong></p>
    <table>
      <tr><th>Nhu cầu</th><th>Cách "ClickHouse"</th></tr>
      <tr><td>Trạng thái đổi thường xuyên</td><td>ReplacingMergeTree + insert phiên bản mới (bài 08)</td></tr>
      <tr><td>Xoá dữ liệu cũ theo thời gian</td><td>TTL hoặc DROP PARTITION (bài 04, 19)</td></tr>
      <tr><td>Xoá theo yêu cầu (GDPR) thỉnh thoảng</td><td>Lightweight DELETE theo lô, gom nhiều user một lần</td></tr>
      <tr><td>Sửa dữ liệu sai hàng loạt một tháng</td><td>Nạp lại vào staging + REPLACE PARTITION</td></tr>
    </table>

    <div class="callout"><p>💡 Nếu code Java của bạn có <code>@Modifying @Query("UPDATE ...")</code> chạy mỗi request nhắm vào ClickHouse — đó là tín hiệu thiết kế sai, không phải chỗ để tối ưu.</p></div>
  `,

  codeTabs: [
    { id: "mut", label: "① Mutation", lines: [
      "ALTER TABLE orders UPDATE status = 'CANCELLED' WHERE order_id = 1001;",
      "-- trả về ngay; chạy nền, viết lại cột status của MỌI part có hàng khớp",
      "",
      "ALTER TABLE orders DELETE WHERE tenant_id = 99",
      "SETTINGS mutations_sync = 2;        -- chờ xong trên mọi replica",
      "",
      "SELECT mutation_id, command, parts_to_do, is_done, latest_fail_reason",
      "FROM system.mutations WHERE table = 'orders' AND NOT is_done;",
      "",
      "KILL MUTATION WHERE mutation_id = '0000000042';"
    ]},
    { id: "lwd", label: "② Lightweight DELETE", lines: [
      "DELETE FROM app_events WHERE user_id IN (1001, 1002, 1003);",
      "-- ghi _row_exists = 0 cho các hàng khớp; SELECT không còn thấy ngay",
      "",
      "-- gom yêu cầu xoá theo lô thay vì 1 lệnh / user",
      "DELETE FROM app_events",
      "WHERE user_id IN (SELECT user_id FROM gdpr_requests WHERE day = today());"
    ]},
    { id: "lwu", label: "③ Lightweight UPDATE", lines: [
      "ALTER TABLE orders MODIFY SETTING",
      "    enable_block_number_column = 1,",
      "    enable_block_offset_column = 1;",
      "",
      "UPDATE orders SET status = 'REFUNDED' WHERE order_id = 1001;",
      "-- ghi patch part nhỏ; SELECT áp patch khi đọc; merge áp vĩnh viễn"
    ]},
    { id: "alt", label: "④ Thay bằng thiết kế", lines: [
      "-- thay vì UPDATE: insert phiên bản mới (ReplacingMergeTree)",
      "INSERT INTO orders (order_id, tenant_id, status, created_at, updated_at)",
      "VALUES (1001, 7, 'CANCELLED', '2024-09-01 10:00:00', now64(3));",
      "",
      "-- thay vì DELETE dữ liệu cũ: TTL / DROP PARTITION",
      "ALTER TABLE app_events DROP PARTITION 202301;"
    ]}
  ],

  stageHtml: `
    <div class="node" id="cmd"><div class="nl">✏️ Sửa 1 hàng</div></div>
    <div class="row">
      <div class="node" id="m1"><div class="nl">🏋️ ALTER UPDATE/DELETE</div><div class="ns">viết lại cột/part có hàng khớp</div></div>
      <div class="node" id="m2"><div class="nl">🪶 DELETE FROM</div><div class="ns">chỉ ghi mask _row_exists</div></div>
      <div class="node" id="m3"><div class="nl">🩹 UPDATE (patch)</div><div class="ns">patch part nhỏ, áp khi đọc</div></div>
    </div>
    <div class="arrow" id="a1">↓ đều tốn merge/I-O về sau</div>
    <div class="node" id="design"><div class="nl">🧱 Thiết kế thay thế</div><div class="ns">Replacing · TTL · DROP/REPLACE PARTITION</div></div>
  `,
  steps: [
    { title: "1 · Mutation cổ điển", tab: "mut", highlight: [1, 2, 4, 5], on: ["cmd", "m1"],
      desc: "Bất đồng bộ, viết lại dữ liệu. Sửa một hàng có thể viết lại hàng GB." },
    { title: "2 · Theo dõi & huỷ", tab: "mut", highlight: [7, 8, 10], on: ["m1"],
      desc: "Mutation kẹt (latest_fail_reason) chặn các mutation sau; KILL MUTATION để gỡ." },
    { title: "3 · Lightweight DELETE", tab: "lwd", highlight: [1, 2, 5, 6], on: ["m2"],
      desc: "Đánh dấu thay vì viết lại. Gom nhiều yêu cầu vào một lệnh." },
    { title: "4 · Lightweight UPDATE", tab: "lwu", highlight: [2, 3, 5, 6], on: ["m3"],
      desc: "Patch part chứa giá trị mới; cần bật cột _block_number/_block_offset." },
    { title: "5 · Tránh bằng thiết kế", tab: "alt", highlight: [2, 3, 6], on: ["a1", "design"],
      desc: "Insert phiên bản mới, TTL và thao tác partition rẻ hơn mọi loại mutation." }
  ],

  quiz: [
    { q: "ALTER TABLE ... UPDATE trong ClickHouse chạy thế nào?", options: [
        "Đồng bộ, sửa tại chỗ như Postgres",
        "Bất đồng bộ, viết lại dữ liệu các part có hàng khớp",
        "Chỉ sửa trong RAM",
        "Tạo bảng mới"
      ], correct: 1, explanation: "Đó là mutation." },
    { q: "Mutation có nguyên tử với người đọc không?", options: [
        "Có",
        "Không; query giữa chừng có thể thấy part đã sửa và part chưa sửa",
        "Chỉ trên replica",
        "Chỉ với DELETE"
      ], correct: 1, explanation: "Mỗi part được thay thế lần lượt." },
    { q: "Lightweight DELETE làm gì?", options: [
        "Xoá file part ngay",
        "Ghi mask _row_exists = 0 cho hàng bị xoá; dữ liệu dọn khi merge",
        "Chuyển hàng sang bảng khác",
        "Đặt mọi cột thành NULL"
      ], correct: 1, explanation: "Nhanh hơn ALTER DELETE nhiều." },
    { q: "Lightweight UPDATE yêu cầu gì?", options: [
        "Bảng phải là Log engine",
        "Bật enable_block_number_column và enable_block_offset_column; không sửa cột khoá",
        "Không yêu cầu gì",
        "Phải có Keeper"
      ], correct: 1, explanation: "Patch part dựa trên vị trí block/offset của hàng." },
    { q: "Xem mutation đang chờ/lỗi ở đâu?", options: [
        "system.mutations", "system.parts", "system.query_log", "system.tables"
      ], correct: 0, explanation: "Có parts_to_do, is_done, latest_fail_reason." },
    { q: "Cách đúng để đổi trạng thái đơn hàng liên tục trong ClickHouse?", options: [
        "ALTER UPDATE mỗi lần đổi",
        "Insert phiên bản mới vào ReplacingMergeTree",
        "DELETE rồi INSERT",
        "Lightweight UPDATE mỗi request"
      ], correct: 1, explanation: "Mutation không dành cho luồng ghi chính." },
    { q: "mutations_sync = 2 nghĩa là?", options: [
        "Chạy 2 mutation song song",
        "Lệnh chờ mutation hoàn tất trên mọi replica mới trả về",
        "Retry 2 lần",
        "Bỏ qua lỗi"
      ], correct: 1, explanation: "1 = chờ replica hiện tại, 2 = chờ mọi replica." },
    { q: "Xoá dữ liệu quá 1 năm định kỳ nên dùng gì?", options: [
        "ALTER DELETE hằng đêm",
        "TTL hoặc DROP PARTITION",
        "Lightweight UPDATE",
        "OPTIMIZE FINAL"
      ], correct: 1, explanation: "Xoá theo đơn vị part/partition là rẻ nhất." },
    { q: "Yêu cầu xoá dữ liệu người dùng (GDPR) vài lần mỗi ngày?", options: [
        "Một ALTER DELETE mỗi user",
        "Gom yêu cầu và chạy lightweight DELETE theo lô",
        "DROP bảng",
        "Không thể xoá"
      ], correct: 1, explanation: "Giảm số lần viết lại và số mutation xếp hàng." }
  ]
});
