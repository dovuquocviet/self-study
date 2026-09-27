window.LESSONS.push({
  id: "19",
  phase: "5", phaseName: "Vận hành",
  title: "TTL & tiered storage: vòng đời dữ liệu tự động",
  subtitle: "TTL DELETE / TO VOLUME / GROUP BY · TTL cột · storage policy nóng–lạnh–S3 · ttl_only_drop_parts",

  theory: `
    <p>Dữ liệu analytics có vòng đời: tuần đầu truy vấn liên tục, vài tháng sau thỉnh thoảng, sau một năm chỉ giữ tổng hợp hoặc xoá. <strong>TTL</strong> tự động hoá việc đó ngay trong DDL.</p>

    <p><strong>Các dạng TTL bảng</strong></p>
    <ul>
      <li><code>TTL ts + INTERVAL 1 YEAR DELETE</code>: xoá hàng quá hạn (DELETE là mặc định).</li>
      <li><code>TTL ts + INTERVAL 30 DAY TO VOLUME 'cold'</code>: chuyển part sang volume/disk khác (tiered storage).</li>
      <li><code>TTL ts + INTERVAL 90 DAY GROUP BY ... SET ...</code>: <em>rollup</em> — gộp hàng cũ thành hàng tổng hợp, giảm độ chi tiết thay vì xoá. Khoá GROUP BY phải là prefix của ORDER BY.</li>
      <li><code>... DELETE WHERE event = 'debug'</code>: chỉ xoá hàng thoả điều kiện.</li>
    </ul>
    <p><strong>TTL cột</strong>: <code>props String TTL ts + INTERVAL 30 DAY</code> — sau hạn cột bị đặt về giá trị mặc định (xoá dữ liệu nặng như payload nhưng giữ hàng).</p>

    <p><strong>TTL chạy khi nào?</strong> Trong merge — không phải đúng giờ. Merge riêng cho TTL chạy tối đa mỗi <code>merge_with_ttl_timeout</code> (mặc định 4 giờ) cho mỗi partition.
    Hàng quá hạn vẫn có thể thấy trong query một thời gian. Muốn chính xác thì thêm điều kiện thời gian vào query.</p>

    <p><strong>Mẹo quan trọng</strong>: nếu partition theo thời gian khớp với TTL, bật <code>ttl_only_drop_parts = 1</code> để ClickHouse <em>xoá nguyên part</em> khi mọi hàng đã hết hạn
    thay vì viết lại part để lọc từng hàng — rẻ hơn rất nhiều.</p>

    <p><strong>Tiered storage</strong>: cấu hình trong server (XML/YAML) các <em>disk</em> (NVMe, HDD, S3) và <em>storage policy</em> gồm nhiều volume theo thứ tự. Bảng gán
    <code>SETTINGS storage_policy = 'hot_cold'</code>. Part mới ghi vào volume đầu; TTL TO VOLUME hoặc <code>move_factor</code> (khi disk gần đầy) chuyển part xuống volume sau.</p>

    <div class="callout"><p>💡 Nhớ lại bài 04: partition theo tháng + TTL + ttl_only_drop_parts = xoá dữ liệu cũ gần như miễn phí. Đây là lý do chính để partition theo thời gian.</p></div>
  `,

  codeTabs: [
    { id: "ttl", label: "① TTL bảng", lines: [
      "CREATE TABLE app_events",
      "(",
      "    ts       DateTime,",
      "    user_id  UInt64,",
      "    event    LowCardinality(String),",
      "    props    String TTL ts + INTERVAL 30 DAY    -- TTL cột",
      ")",
      "ENGINE = MergeTree",
      "PARTITION BY toYYYYMM(ts)",
      "ORDER BY (event, user_id, ts)",
      "TTL ts + INTERVAL 7 DAY TO VOLUME 'warm',",
      "    ts + INTERVAL 90 DAY TO VOLUME 'cold',",
      "    ts + INTERVAL 1 YEAR DELETE",
      "SETTINGS storage_policy = 'hot_warm_cold',",
      "         ttl_only_drop_parts = 1;"
    ]},
    { id: "policy", label: "② Storage policy", lines: [
      "<!-- /etc/clickhouse-server/config.d/storage.xml -->",
      "<clickhouse><storage_configuration>",
      "  <disks>",
      "    <nvme><path>/mnt/nvme/ch/</path></nvme>",
      "    <hdd><path>/mnt/hdd/ch/</path></hdd>",
      "    <s3><type>s3</type><endpoint>https://s3.amazonaws.com/bucket/ch/</endpoint></s3>",
      "  </disks>",
      "  <policies><hot_warm_cold><volumes>",
      "    <hot><disk>nvme</disk></hot>",
      "    <warm><disk>hdd</disk></warm>",
      "    <cold><disk>s3</disk></cold>",
      "  </volumes><move_factor>0.1</move_factor></hot_warm_cold></policies>",
      "</storage_configuration></clickhouse>"
    ]},
    { id: "rollup", label: "③ Rollup", lines: [
      "CREATE TABLE metrics",
      "(",
      "    host String, ts DateTime, cpu Float64, hits UInt64",
      ")",
      "ENGINE = MergeTree",
      "ORDER BY (host, toStartOfHour(ts), ts)",
      "TTL ts + INTERVAL 30 DAY",
      "    GROUP BY host, toStartOfHour(ts)",
      "    SET cpu = avg(cpu), hits = sum(hits);",
      "-- sau 30 ngày: mỗi host còn 1 hàng/giờ thay vì 1 hàng/giây"
    ]},
    { id: "ops", label: "④ Kiểm tra", lines: [
      "SELECT partition, disk_name, count() AS parts,",
      "       formatReadableSize(sum(bytes_on_disk)) AS size",
      "FROM system.parts WHERE table = 'app_events' AND active",
      "GROUP BY partition, disk_name ORDER BY partition;",
      "",
      "ALTER TABLE app_events MATERIALIZE TTL;     -- áp TTL mới cho dữ liệu cũ",
      "ALTER TABLE app_events MODIFY TTL ts + INTERVAL 180 DAY;"
    ]}
  ],

  stageHtml: `
    <div class="node" id="new"><div class="nl">📥 Part mới</div><div class="ns">ghi vào volume hot (NVMe)</div></div>
    <div class="arrow" id="a1">↓ 7 ngày: TTL TO VOLUME 'warm'</div>
    <div class="node" id="warm"><div class="nl">💽 HDD</div><div class="ns">ít truy vấn</div></div>
    <div class="arrow" id="a2">↓ 90 ngày: TO VOLUME 'cold'</div>
    <div class="node" id="cold"><div class="nl">☁️ S3</div><div class="ns">rẻ, chậm hơn</div></div>
    <div class="arrow" id="a3">↓ 1 năm: DELETE (drop cả part)</div>
    <div class="node" id="gone"><div class="nl">🗑️ Xoá</div><div class="ns">ttl_only_drop_parts = 1</div></div>
  `,
  steps: [
    { title: "1 · Khai báo TTL", tab: "ttl", highlight: [11, 12, 13], on: ["new"],
      desc: "Một biểu thức TTL cho mỗi giai đoạn vòng đời: chuyển warm, chuyển cold, xoá." },
    { title: "2 · Storage policy", tab: "policy", highlight: [4, 5, 6, 9, 10, 11, 12], on: ["a1", "warm"],
      desc: "Disk và volume định nghĩa ở cấu hình server; volume đầu nhận part mới." },
    { title: "3 · Chuyển sang S3", tab: "ttl", highlight: [12, 14], on: ["a2", "cold"],
      desc: "Part cũ chuyển sang S3: rẻ, vẫn truy vấn được, chậm hơn." },
    { title: "4 · Xoá nguyên part", tab: "ttl", highlight: [13, 15], on: ["a3", "gone"],
      desc: "Partition theo tháng + ttl_only_drop_parts: part hết hạn toàn bộ bị bỏ, không viết lại." },
    { title: "5 · Rollup thay vì xoá", tab: "rollup", highlight: [7, 8, 9, 10], on: ["gone"],
      desc: "Giữ lịch sử ở độ phân giải thấp. Khoá GROUP BY phải là prefix của ORDER BY." },
    { title: "6 · Kiểm tra & đổi TTL", tab: "ops", highlight: [1, 6, 7], on: ["warm", "cold"],
      desc: "system.parts cho biết part nằm trên disk nào. Đổi TTL rồi MATERIALIZE TTL để áp cho dữ liệu cũ (tốn I/O)." }
  ],

  quiz: [
    { q: "TTL xoá dữ liệu vào lúc nào?", options: [
        "Chính xác khi hết hạn",
        "Trong merge (có merge riêng cho TTL, mặc định tối đa mỗi 4 giờ mỗi partition)",
        "Khi restart server",
        "Mỗi đêm 0h"
      ], correct: 1, explanation: "Hàng quá hạn có thể còn thấy một thời gian." },
    { q: "ttl_only_drop_parts = 1 có lợi gì?", options: [
        "Xoá từng hàng nhanh hơn",
        "Chỉ bỏ nguyên part khi mọi hàng hết hạn, không viết lại part — rẻ hơn nhiều",
        "Tắt TTL",
        "Chuyển part sang S3"
      ], correct: 1, explanation: "Hiệu quả nhất khi partition theo thời gian khớp với TTL." },
    { q: "TTL ... TO VOLUME 'cold' làm gì?", options: [
        "Xoá dữ liệu",
        "Chuyển part quá hạn sang volume khác trong storage policy",
        "Nén lại dữ liệu",
        "Sao lưu"
      ], correct: 1, explanation: "Nền tảng của tiered storage." },
    { q: "TTL cột (props String TTL ts + INTERVAL 30 DAY) có tác dụng?", options: [
        "Xoá cả hàng",
        "Đặt giá trị cột về mặc định sau hạn, giữ lại hàng",
        "Đổi kiểu cột",
        "Không có tác dụng"
      ], correct: 1, explanation: "Hữu ích để bỏ payload nặng mà vẫn giữ số liệu." },
    { q: "TTL ... GROUP BY ... SET dùng để?", options: [
        "Tạo projection",
        "Rollup: gộp hàng cũ thành hàng tổng hợp",
        "Tạo MV",
        "Chia shard"
      ], correct: 1, explanation: "Giảm độ chi tiết dữ liệu cũ thay vì xoá hẳn." },
    { q: "Storage policy được định nghĩa ở đâu?", options: [
        "Trong câu CREATE TABLE",
        "Trong cấu hình server (disks, policies/volumes), bảng tham chiếu qua storage_policy",
        "Trong Keeper",
        "Trong system.parts"
      ], correct: 1, explanation: "Bảng chỉ chọn policy theo tên." },
    { q: "Sau ALTER ... MODIFY TTL, dữ liệu cũ thì sao?", options: [
        "Áp dụng ngay lập tức, miễn phí",
        "Áp dụng dần qua merge hoặc chạy MATERIALIZE TTL (tốn I/O)",
        "Không bao giờ áp dụng",
        "Bị xoá hết"
      ], correct: 1, explanation: "MATERIALIZE TTL là một mutation." },
    { q: "move_factor trong storage policy nghĩa là?", options: [
        "Tốc độ di chuyển",
        "Khi dung lượng trống của volume dưới tỷ lệ này, part được đẩy sang volume tiếp theo",
        "Số part tối đa",
        "Hệ số nén"
      ], correct: 1, explanation: "0.1 = còn dưới 10% trống thì bắt đầu chuyển." },
    { q: "Muốn query không trả hàng quá hạn dù TTL chưa chạy?", options: [
        "Không có cách",
        "Thêm điều kiện thời gian trong WHERE",
        "Dùng FINAL",
        "Đặt TTL ngắn hơn"
      ], correct: 1, explanation: "TTL là cơ chế dọn dẹp, không phải bộ lọc tức thời." }
  ]
});
