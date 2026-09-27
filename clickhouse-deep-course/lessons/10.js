window.LESSONS.push({
  id: "10",
  phase: "2", phaseName: "Họ MergeTree & chống trùng",
  title: "CollapsingMergeTree & VersionedCollapsing: huỷ hàng bằng sign = -1",
  subtitle: "cặp +1/-1 triệt tiêu · sum(x * sign) · thứ tự insert · khi nào chọn thay cho Replacing",

  theory: `
    <p>Replacing giữ bản mới nhất nhưng không cho phép <em>cộng dồn đúng</em> trước khi merge. Collapsing giải bài toán khác: trạng thái thay đổi
    <strong>và</strong> muốn tổng hợp (sum/count) chính xác mà không cần FINAL.</p>

    <p><strong>Ý tưởng</strong>: thêm cột <code>sign Int8</code>. Hàng trạng thái có sign = 1. Muốn đổi trạng thái, insert một hàng <em>huỷ</em> (sign = -1)
    với <strong>đúng các giá trị cũ</strong>, rồi insert hàng mới (sign = 1). Khi merge, cặp +1/-1 cùng ORDER BY triệt tiêu nhau.</p>

    <p><strong>Đọc đúng trước khi merge</strong>: nhân với sign — <code>sum(amount * sign)</code>, <code>sum(sign)</code> thay cho <code>count()</code>, kèm <code>HAVING sum(sign) &gt; 0</code> để bỏ đối tượng đã huỷ hết.
    Không dùng được với min/max/uniq trực tiếp.</p>

    <p><strong>Cái giá</strong></p>
    <ul>
      <li>Người ghi phải <strong>nhớ trạng thái cũ</strong> để tạo hàng huỷ — tức là producer (service Java/Rust) phải có state, hoặc lấy từ CDC có "before image" (Debezium có <code>before</code>).</li>
      <li><strong>CollapsingMergeTree</strong> yêu cầu hàng -1 đến sau hàng +1 tương ứng (theo thứ tự trong part). Insert song song/đến lệch thứ tự ⇒ triệt tiêu sai.</li>
      <li><strong>VersionedCollapsingMergeTree(sign, version)</strong> gỡ ràng buộc thứ tự: ghép cặp theo (khoá, version), hàng huỷ mang version của hàng bị huỷ. Chọn cái này khi dữ liệu đến từ nhiều luồng/Kafka.</li>
    </ul>

    <table>
      <tr><th>Nhu cầu</th><th>Engine</th></tr>
      <tr><td>Bản mới nhất của entity, đọc từng đối tượng</td><td>ReplacingMergeTree + FINAL/argMax</td></tr>
      <tr><td>Tổng hợp chính xác trên dữ liệu hay đổi, không muốn FINAL</td><td>VersionedCollapsingMergeTree</td></tr>
      <tr><td>Chỉ cộng dồn số liệu append-only</td><td>SummingMergeTree</td></tr>
      <tr><td>uniq, quantile, avg gộp được</td><td>AggregatingMergeTree</td></tr>
    </table>

    <div class="callout"><p>💡 Cách nghĩ giống bút toán kế toán: không sửa bút toán cũ, ghi bút toán đảo (-1) rồi ghi bút toán mới. Số dư = tổng mọi bút toán có dấu.</p></div>
  `,

  codeTabs: [
    { id: "ddl", label: "① DDL", lines: [
      "CREATE TABLE cart_state",
      "(",
      "    cart_id   UInt64,",
      "    items     UInt32,",
      "    total     Decimal(18, 2),",
      "    version   UInt64,",
      "    sign      Int8",
      ")",
      "ENGINE = VersionedCollapsingMergeTree(sign, version)",
      "ORDER BY cart_id;"
    ]},
    { id: "ins", label: "② Đổi trạng thái", lines: [
      "-- v1: giỏ có 2 món, 30.00",
      "INSERT INTO cart_state VALUES (55, 2, 30.00, 1, 1);",
      "",
      "-- v2: thêm 1 món -> huỷ v1 (đúng giá trị cũ, version cũ) + ghi v2",
      "INSERT INTO cart_state VALUES",
      "    (55, 2, 30.00, 1, -1),",
      "    (55, 3, 42.50, 2,  1);"
    ]},
    { id: "read", label: "③ Đọc đúng", lines: [
      "SELECT cart_id,",
      "       sum(items * sign)  AS items,",
      "       sum(total * sign)  AS total",
      "FROM cart_state",
      "GROUP BY cart_id",
      "HAVING sum(sign) > 0;",
      "-- 55   3   42.50    (đúng dù chưa merge)",
      "",
      "SELECT sum(sign) AS so_gio_dang_mo FROM cart_state;   -- thay count()"
    ]},
    { id: "java", label: "④ Phía producer", lines: [
      "// producer phải biết trạng thái cũ",
      "void onCartChanged(Cart before, Cart after) {",
      "    List<Row> rows = new ArrayList<>();",
      "    if (before != null)",
      "        rows.add(Row.of(before.id(), before.items(), before.total(), before.version(), -1));",
      "    rows.add(Row.of(after.id(), after.items(), after.total(), after.version(), 1));",
      "    kafka.send(\"cart-state\", after.id(), rows);   // cùng key -> cùng partition",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="r1"><div class="nl">(55, 2, 30.00, v1, +1)</div></div>
    <div class="arrow" id="a1">↓ thay đổi</div>
    <div class="row">
      <div class="node" id="r2"><div class="nl">(55, 2, 30.00, v1, −1)</div><div class="ns">hàng huỷ</div></div>
      <div class="node" id="r3"><div class="nl">(55, 3, 42.50, v2, +1)</div><div class="ns">trạng thái mới</div></div>
    </div>
    <div class="arrow" id="a2">↓ đọc: sum(x * sign)</div>
    <div class="node" id="q"><div class="nl">📊 items 3, total 42.50</div><div class="ns">đúng trước khi merge</div></div>
    <div class="arrow" id="a3">↓ merge: cặp v1 +1/−1 triệt tiêu</div>
    <div class="node" id="m"><div class="nl">📦 chỉ còn (55, 3, 42.50, v2, +1)</div></div>
  `,
  steps: [
    { title: "1 · Cột sign và version", tab: "ddl", highlight: [6, 7, 9], on: ["r1"],
      desc: "VersionedCollapsing ghép cặp theo (ORDER BY, version), không phụ thuộc thứ tự insert." },
    { title: "2 · Huỷ rồi ghi mới", tab: "ins", highlight: [2, 6, 7], on: ["a1", "r2", "r3"],
      desc: "Hàng huỷ phải lặp lại đúng giá trị và version của hàng cũ, sign = -1." },
    { title: "3 · Đọc bằng cách nhân sign", tab: "read", highlight: [2, 3, 6, 7], on: ["a2", "q"],
      desc: "+30 − 30 + 42.50 = 42.50. HAVING sum(sign) > 0 loại giỏ đã bị huỷ hoàn toàn." },
    { title: "4 · Merge dọn cặp triệt tiêu", tab: "read", highlight: [9], on: ["a3", "m"],
      desc: "Sau merge chỉ còn hàng v2. Query vẫn viết như bước 3 vì không biết đã merge chưa." },
    { title: "5 · Producer phải có state", tab: "java", highlight: [2, 4, 5, 6, 7], on: ["r2"],
      desc: "Đây là cái giá: phải biết 'before'. Nguồn CDC có before image hoặc service tự giữ state." }
  ],

  quiz: [
    { q: "Trong CollapsingMergeTree, hàng huỷ phải thế nào?", options: [
        "Chỉ cần khoá và sign = -1",
        "Lặp lại đúng giá trị các cột của hàng cũ, sign = -1",
        "Có sign = 0",
        "Có giá trị mới"
      ], correct: 1, explanation: "Nếu giá trị khác thì sum(x * sign) sẽ sai." },
    { q: "Cách đếm số đối tượng còn hiệu lực trên bảng Collapsing?", options: [
        "count()", "sum(sign)", "uniq(id)", "max(sign)"
      ], correct: 1, explanation: "Mỗi cặp +1/-1 triệt tiêu, còn lại đúng số đối tượng đang có." },
    { q: "Điểm khác chính của VersionedCollapsingMergeTree so với CollapsingMergeTree?", options: [
        "Không cần sign",
        "Ghép cặp theo version nên không đòi hỏi hàng -1 đến sau hàng +1",
        "Tự tính hàng huỷ",
        "Chỉ chạy trên cluster"
      ], correct: 1, explanation: "Hợp với dữ liệu insert song song/đến lệch thứ tự." },
    { q: "Nhược điểm lớn nhất của họ Collapsing?", options: [
        "Không tổng hợp được",
        "Producer phải biết trạng thái cũ để tạo hàng huỷ",
        "Không nén được",
        "Không dùng được GROUP BY"
      ], correct: 1, explanation: "Cần state hoặc CDC có before image." },
    { q: "Vì sao dùng HAVING sum(sign) > 0?", options: [
        "Để dùng index",
        "Để loại đối tượng đã bị huỷ hoàn toàn (tổng sign = 0)",
        "Để tránh lỗi chia 0",
        "Không cần thiết"
      ], correct: 1, explanation: "Đối tượng bị xoá có sum(sign) = 0." },
    { q: "Hàm nào KHÔNG dùng trực tiếp đúng được trên bảng Collapsing chưa merge?", options: [
        "sum(x * sign)", "sum(sign)", "max(x)", "sum(sign * 1)"
      ], correct: 2, explanation: "max/min/uniq vẫn thấy cả hàng đã bị huỷ." },
    { q: "Khi nào ReplacingMergeTree hợp hơn VersionedCollapsing?", options: [
        "Khi cần tổng chính xác không dùng FINAL",
        "Khi chủ yếu đọc bản mới nhất của entity và producer không có trạng thái cũ",
        "Khi cần uniq",
        "Không bao giờ"
      ], correct: 1, explanation: "Replacing đơn giản hơn: chỉ cần insert phiên bản mới." },
    { q: "Với VersionedCollapsing, hàng huỷ mang version nào?", options: [
        "Version mới", "Version của hàng bị huỷ", "0", "Bất kỳ"
      ], correct: 1, explanation: "Ghép cặp dựa trên (khoá, version)." }
  ]
});
