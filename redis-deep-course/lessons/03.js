window.LESSONS.push({
  id: "03",
  phase: "1", phaseName: "Cấu trúc dữ liệu & encoding",
  title: "List và Hash: listpack, quicklist, hashtable",
  subtitle: "Mảng nén liên tục khi nhỏ · tự chuyển encoding khi lớn · ngưỡng cấu hình",

  theory: `
    <p><strong>listpack</strong> (thay ziplist từ Redis 7.0) là nền của hầu hết kiểu nhỏ: một khối byte <em>liên tục</em> chứa các phần tử nối tiếp,
    mỗi phần tử tự mã hoá độ dài và có thể lưu số nguyên gọn trong 1–9 byte. Không có con trỏ 8 byte giữa các phần tử → tiết kiệm RAM và thân thiện cache CPU.
    Cái giá: chèn/xoá ở giữa phải <code>memmove</code>, tìm theo field phải duyệt tuần tự O(n). Với n nhỏ (≤ 128) thì điều đó rẻ hơn cả tra hash table.</p>

    <p><strong>List</strong></p>
    <ul>
      <li>Nhỏ: một listpack duy nhất (Redis 7.2+; <code>OBJECT ENCODING</code> trả <code>listpack</code>).</li>
      <li>Lớn: <strong>quicklist</strong> — danh sách liên kết đôi mà <em>mỗi node là một listpack</em>. Kích thước mỗi node do <code>list-max-listpack-size</code> quyết định
        (mặc định <code>-2</code> = tối đa 8 KB/node).</li>
      <li><code>list-compress-depth</code> có thể nén LZF các node ở giữa (giữ đầu/cuối không nén vì hay truy cập).</li>
      <li>Độ phức tạp: <code>LPUSH/RPUSH/LPOP/RPOP</code> O(1); <code>LINDEX/LSET/LINSERT</code> O(n); <code>LRANGE</code> O(S+N) với S là độ lệch từ đầu gần nhất.</li>
    </ul>

    <p><strong>Hash</strong></p>
    <ul>
      <li>Nhỏ: listpack chứa field, value, field, value... Điều kiện: số field ≤ <code>hash-max-listpack-entries</code> (mặc định 128) <em>và</em> mọi value ≤ <code>hash-max-listpack-value</code> (64 byte).</li>
      <li>Vượt một trong hai ngưỡng → chuyển sang <code>hashtable</code> (dict như keyspace). Chuyển <strong>một chiều</strong>: xoá bớt field cũng không quay lại listpack.</li>
      <li>Redis 7.4 thêm TTL <em>theo field</em> (<code>HEXPIRE</code>, <code>HTTL</code>, <code>HPERSIST</code>).</li>
    </ul>

    <table>
      <tr><th>Tình huống</th><th>Encoding</th><th>Chi phí HGET</th></tr>
      <tr><td>Hồ sơ user 20 field ngắn</td><td>listpack</td><td>O(20) duyệt, nhưng trong 1 khối nhớ nhỏ → rất nhanh</td></tr>
      <tr><td>Giỏ hàng 5 000 sản phẩm</td><td>hashtable</td><td>O(1)</td></tr>
      <tr><td>Hash 10 field nhưng 1 value là JSON 2 KB</td><td>hashtable</td><td>O(1) — một value lớn là đủ phá listpack</td></tr>
    </table>

    <div class="callout"><p>💡 Hash nhỏ dạng listpack tốn ít RAM hơn nhiều so với tách thành từng key String riêng. Đây là nền của kỹ thuật "gom key vào hash"
    (bài 23). Nhưng đừng nâng ngưỡng lên hàng chục nghìn: HGET khi đó là duyệt tuần tự dài trên main thread.</p></div>
  `,

  codeTabs: [
    { id: "list", label: "① List", lines: [
      "127.0.0.1:6379> RPUSH jobs a b c",
      "(integer) 3",
      "127.0.0.1:6379> OBJECT ENCODING jobs",
      "\"listpack\"           # Redis 7.2+; bản cũ trả \"quicklist\"",
      "127.0.0.1:6379> RPUSH jobs <thêm 200 phần tử>",
      "127.0.0.1:6379> OBJECT ENCODING jobs",
      "\"quicklist\"",
      "",
      "# O(1): LPUSH RPUSH LPOP RPOP LLEN",
      "# O(n): LINDEX 5000, LINSERT, LREM, LRANGE 0 -1 trên list lớn"
    ]},
    { id: "hash", label: "② Hash", lines: [
      "127.0.0.1:6379> HSET user:42 name alice city hanoi tier gold",
      "127.0.0.1:6379> OBJECT ENCODING user:42",
      "\"listpack\"",
      "127.0.0.1:6379> HSET user:42 bio <chuỗi 80 byte>",
      "127.0.0.1:6379> OBJECT ENCODING user:42",
      "\"hashtable\"          # 1 value > 64 byte là đủ",
      "127.0.0.1:6379> HDEL user:42 bio",
      "127.0.0.1:6379> OBJECT ENCODING user:42",
      "\"hashtable\"          # không quay về listpack",
      "",
      "127.0.0.1:6379> HEXPIRE user:42 60 FIELDS 1 tier   # 7.4+: TTL cho 1 field"
    ]},
    { id: "conf", label: "③ Ngưỡng", lines: [
      "hash-max-listpack-entries 128",
      "hash-max-listpack-value 64",
      "list-max-listpack-size -2      # -1=4KB -2=8KB -3=16KB -4=32KB -5=64KB; số dương = số phần tử",
      "list-compress-depth 0          # 1 = không nén node đầu/cuối, nén phần giữa",
      "",
      "# Tên cũ *-ziplist-* vẫn được chấp nhận như alias",
      "CONFIG GET hash-max-listpack-*"
    ]},
    { id: "layout", label: "④ Bố cục listpack", lines: [
      "<total-bytes 4B><num-elements 2B> <entry> <entry> ... <end 0xFF>",
      "",
      "entry = <encoding+data> <backlen>",
      "  số nhỏ 0..127      -> 1 byte",
      "  chuỗi ≤ 63 byte    -> 1 byte header + dữ liệu",
      "  backlen            -> cho phép duyệt ngược từ cuối",
      "",
      "// quicklist:  [listpack 8KB] <-> [listpack 8KB] <-> [listpack 8KB]",
      "//             node đầu/cuối       (có thể nén LZF)       "
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="lpl"><div class="nl">📃 List nhỏ</div><div class="ns">1 listpack</div></div>
      <div class="node" id="lph"><div class="nl">📇 Hash nhỏ</div><div class="ns">listpack f,v,f,v</div></div>
    </div>
    <div class="arrow" id="a1">↓ vượt ngưỡng số phần tử hoặc kích thước value</div>
    <div class="row">
      <div class="node" id="ql"><div class="nl">🔗 quicklist</div><div class="ns">linked list các listpack 8KB</div></div>
      <div class="node" id="ht"><div class="nl">#️⃣ hashtable</div><div class="ns">dict O(1), rehash tiến dần</div></div>
    </div>
    <div class="arrow" id="a2">↓ xoá bớt phần tử</div>
    <div class="node" id="one"><div class="nl">↪️ Không quay lại</div><div class="ns">chuyển encoding là một chiều (hash, set, zset)</div></div>
  `,
  steps: [
    { title: "1 · Khởi đầu gọn: listpack", tab: "layout", highlight: [1, 3, 4, 5], on: ["lpl", "lph"],
      desc: "Một khối nhớ liên tục, phần tử tự mã hoá độ dài. Không con trỏ, RAM ít, duyệt nhanh nhờ cache CPU." },
    { title: "2 · List lớn lên thành quicklist", tab: "list", highlight: [3, 4, 5, 7], on: ["a1", "ql"],
      desc: "Chia thành nhiều listpack 8KB nối với nhau: push/pop hai đầu vẫn O(1), chèn giữa chỉ memmove trong một node." },
    { title: "3 · Hash vượt ngưỡng → hashtable", tab: "hash", highlight: [1, 3, 4, 6], on: ["ht"],
      desc: "Chỉ cần một value dài hơn 64 byte hoặc quá 128 field là chuyển sang dict." },
    { title: "4 · Ngưỡng có thể chỉnh", tab: "conf", highlight: [1, 2, 3], on: ["a1"],
      desc: "Nâng ngưỡng tiết kiệm RAM hơn nhưng làm HGET/HSET chậm dần (duyệt tuần tự trên main thread)." },
    { title: "5 · Một chiều", tab: "hash", highlight: [7, 8, 9], on: ["a2", "one"],
      desc: "HDEL không làm hash quay về listpack. Muốn gọn lại phải tạo lại key (vd DUMP/RESTORE hoặc ghi lại)." }
  ],

  quiz: [
    { q: "listpack tiết kiệm RAM chủ yếu nhờ điều gì?", options: [
        "Nén gzip", "Lưu phần tử liên tục trong một khối, không có con trỏ giữa các phần tử", "Lưu trên đĩa", "Dùng chung giá trị giữa các key"
      ], correct: 1, explanation: "Mỗi con trỏ 8 byte + header node của linked list/dict là thứ listpack loại bỏ." },
    { q: "Encoding của một List lớn (Redis 7.x) là gì?", options: [
        "linkedlist", "quicklist — danh sách liên kết các node listpack", "skiplist", "hashtable"
      ], correct: 1, explanation: "linkedlist thuần đã bị bỏ từ 3.2." },
    { q: "Hash có 10 field, trong đó 1 value dài 200 byte, cấu hình mặc định. Encoding?", options: [
        "listpack", "hashtable", "intset", "quicklist"
      ], correct: 1, explanation: "Vượt hash-max-listpack-value (64) là đủ để chuyển." },
    { q: "Sau khi hash chuyển sang hashtable, HDEL bớt còn 3 field nhỏ. Encoding?", options: [
        "Tự quay về listpack", "Vẫn là hashtable", "Chuyển sang intset", "Tuỳ vào hz"
      ], correct: 1, explanation: "Chuyển encoding là một chiều." },
    { q: "Lệnh nào O(1) trên List bất kể độ dài?", options: [
        "LINDEX list 50000", "LPUSH / RPOP", "LREM", "LRANGE 0 -1"
      ], correct: 1, explanation: "Thao tác ở hai đầu là O(1); truy cập giữa là O(n)." },
    { q: "list-max-listpack-size -2 nghĩa là gì?", options: [
        "Tối đa 2 phần tử mỗi node", "Mỗi node quicklist tối đa 8 KB", "Tắt quicklist", "Nén 2 node đầu"
      ], correct: 1, explanation: "Giá trị âm là giới hạn theo byte: -1=4KB, -2=8KB, ..., -5=64KB." },
    { q: "Vì sao không nên đặt hash-max-listpack-entries = 100000?", options: [
        "Redis sẽ không khởi động", "HGET/HSET trên listpack là duyệt tuần tự; hash lớn sẽ chậm và chặn main thread",
        "Tốn nhiều RAM hơn hashtable", "Làm hỏng RDB"
      ], correct: 1, explanation: "listpack chỉ đáng khi n nhỏ." },
    { q: "Tính năng nào có từ Redis 7.4 cho Hash?", options: [
        "HSCAN", "TTL riêng cho từng field (HEXPIRE, HTTL)", "HINCRBYFLOAT", "Lồng hash trong hash"
      ], correct: 1, explanation: "Trước 7.4 chỉ có TTL cho cả key." },
    { q: "list-compress-depth 1 làm gì?", options: [
        "Nén toàn bộ list", "Giữ 1 node ở mỗi đầu không nén, nén LZF các node ở giữa", "Chỉ nén node đầu", "Giới hạn list 1 phần tử"
      ], correct: 1, explanation: "Hai đầu hay được push/pop nên để nguyên; phần giữa ít truy cập được nén." }
  ]
});
