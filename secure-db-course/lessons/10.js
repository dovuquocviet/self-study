window.LESSONS.push({
  id: "10",
  phase: "4", phaseName: "Truy vấn an toàn",
  title: "Truy vấn có tham số trên mọi engine",
  subtitle: "Tách code khỏi dữ liệu · Postgres $1 · ClickHouse {name:Type} · D1 prepare().bind() · Mongo filter có kiểu · allowlist cho tên bảng/cột/sort",

  theory: `
    <p>Injection xảy ra khi <strong>dữ liệu</strong> từ người dùng bị ghép vào <strong>câu lệnh</strong> và DB hiểu nhầm một phần dữ liệu đó thành cú pháp.
    Ví dụ vô hại nhất: người tên <code>O'Brien</code> — dấu <code>'</code> trong tên kết thúc chuỗi SQL sớm và câu lệnh bị lỗi. Nếu một ký tự "vô tình" đã phá được câu lệnh,
    thì kẻ cố ý có thể <em>thay đổi ý nghĩa</em> của nó: đọc bảng khác, bỏ qua điều kiện đăng nhập, sửa dữ liệu. Nguyên nhân gốc chỉ có một: <strong>ghép chuỗi</strong>.</p>

    <p><strong>1. Giải pháp gốc: truy vấn có tham số (parameterized / prepared statement)</strong></p>
    <p>Câu lệnh và dữ liệu được gửi tới DB <em>tách riêng</em>. DB phân tích cú pháp câu lệnh (với các chỗ trống <code>$1</code>, <code>?</code>, <code>{name:Type}</code>) trước,
    rồi mới gắn dữ liệu vào như <em>giá trị</em>. Dữ liệu chứa ký tự gì đi nữa cũng không thể trở thành cú pháp. Đây không phải "escape tốt hơn" — đây là loại bỏ hẳn cơ chế gây lỗi.</p>

    <table>
      <tr><th>Engine</th><th>Cú pháp tham số</th><th>Ví dụ</th></tr>
      <tr><td>PostgreSQL</td><td><code>$1, $2</code> (driver Python/Java dùng <code>%s</code> / <code>?</code> rồi chuyển)</td><td><code>query('... WHERE email = $1', [email])</code></td></tr>
      <tr><td>ClickHouse</td><td><code>{ten:KieuDuLieu}</code> — tham số có kiểu</td><td><code>WHERE user_id = {uid:UInt64}</code>, truyền <code>param_uid=42</code> hoặc <code>query_params</code></td></tr>
      <tr><td>Cloudflare D1</td><td><code>?</code> hoặc <code>?1, ?2</code> + <code>.bind()</code></td><td><code>env.DB.prepare('... WHERE id = ?').bind(id).first()</code></td></tr>
      <tr><td>Durable Objects SQLite</td><td><code>?</code> + tham số của <code>sql.exec</code></td><td><code>this.ctx.storage.sql.exec('... WHERE id = ?', id)</code></td></tr>
      <tr><td>MongoDB</td><td>Filter là object, không phải chuỗi — nhưng phải đảm bảo <em>giá trị</em> có đúng kiểu</td><td><code>find({ email: String(email) })</code> (bài 11)</td></tr>
    </table>

    <p><strong>2. Những thứ KHÔNG tham số hoá được → dùng allowlist</strong></p>
    <p>Tham số chỉ thay được <em>giá trị</em>. Tên bảng, tên cột, chiều sắp xếp (<code>ASC</code>/<code>DESC</code>), từ khoá SQL không truyền qua tham số được. Khi chúng phụ thuộc input:</p>
    <ul>
      <li>Ánh xạ từ giá trị client gửi sang hằng số trong code: <code>{ "newest": "created_at DESC", "price": "price ASC" }</code>. Không có trong map → dùng mặc định hoặc trả 400.</li>
      <li>Hàm quote định danh (<code>format('%I')</code> của Postgres, <code>sql.Identifier</code> của psycopg, kiểu <code>Identifier</code> của ClickHouse) là lớp phụ — vẫn nên allowlist trước,
        vì quote đúng cú pháp không có nghĩa là người dùng được phép đọc cột đó.</li>
      <li><code>LIMIT</code>/<code>OFFSET</code>: parse thành số nguyên, kẹp trong khoảng (ví dụ 1–100), rồi truyền như tham số.</li>
    </ul>

    <p><strong>3. Các bẫy thường gặp dù đã "dùng tham số"</strong></p>
    <ul>
      <li><strong>Ghép chuỗi bên trong ORM</strong>: <code>raw()</code>, <code>whereRaw()</code>, <code>$queryRawUnsafe</code>, <code>text()</code> với f-string… ORM an toàn chỉ khi bạn dùng API có tham số của nó.</li>
      <li><strong>Danh sách IN</strong>: đừng ghép <code>'1,2,3'</code>. Postgres dùng <code>= ANY($1)</code> với mảng; D1 sinh đủ số dấu <code>?</code> theo độ dài mảng (đã giới hạn) rồi bind từng phần tử.</li>
      <li><strong>LIKE</strong>: giá trị vẫn là tham số, nhưng <code>%</code> và <code>_</code> trong input là ký tự đại diện → escape chúng nếu muốn tìm đúng chữ, và giới hạn độ dài.</li>
      <li><strong>SQL động trong stored procedure</strong>: <code>EXECUTE 'SELECT ... ' || input</code> trong PL/pgSQL cũng là ghép chuỗi → dùng <code>EXECUTE ... USING</code> và <code>format('%I')</code>.</li>
      <li><strong>Second-order</strong>: dữ liệu đã lưu trong DB (do người dùng nhập trước đó) được lấy ra rồi ghép vào câu khác. "Dữ liệu từ DB của mình" vẫn là dữ liệu không tin cậy.</li>
    </ul>

    <p><strong>4. Phòng thủ nhiều lớp quanh truy vấn</strong>: validate kiểu/khoảng ở ranh giới (lớp 1) → truy vấn có tham số (lớp chính) → tài khoản DB quyền tối thiểu (bài 07) →
    RLS/row policy (bài 08) → không trả lỗi DB chi tiết cho client (log phía server thay vì hiện stack trace).</p>

    <div class="callout"><p>💡 Quy tắc review đơn giản: tìm mọi chỗ có <em>dấu cộng chuỗi</em>, template string hoặc f-string nằm cạnh từ khoá <code>SELECT</code>/<code>WHERE</code>/<code>ORDER BY</code>/<code>prepare(</code>.
    Mỗi chỗ phải là hằng số hoặc giá trị đến từ allowlist. Có thể tự động hoá bằng Semgrep/CodeQL trong CI.</p></div>
  `,

  codeTabs: [
    { id: "concat", label: "❌ Ghép chuỗi", lines: [
      "// Dữ liệu trở thành một phần cú pháp",
      "sql = \"SELECT * FROM users WHERE email = '\" + input.email + \"'\"",
      "",
      "// input.email = \"o'brien@example.com\"",
      "// -> SELECT * FROM users WHERE email = 'o'brien@example.com'",
      "//                                       ^ chuỗi kết thúc sớm -> lỗi cú pháp",
      "// Nếu một ký tự vô tình đã phá được câu lệnh, input cố ý",
      "// (<user_input_payload>) có thể đổi ý nghĩa câu lệnh.",
      "",
      "// Escape thủ công (thay ' bằng '') -> dễ sót: encoding, backslash, số, tên cột...",
      "// => KHÔNG sửa bằng escape. Sửa bằng cách tách code khỏi dữ liệu."
    ]},
    { id: "pg", label: "🐘 Postgres (đa ngôn ngữ)", lines: [
      "// Node (pg)",
      "await pool.query('SELECT id, name FROM users WHERE email = $1', [email])",
      "await pool.query('SELECT * FROM orders WHERE id = ANY($1)', [ids])   // danh sách IN",
      "",
      "# Python (psycopg 3)",
      "cur.execute('SELECT id, name FROM users WHERE email = %s', (email,))",
      "",
      "// Java (JDBC)",
      "ps = conn.prepareStatement(\"SELECT id, name FROM users WHERE email = ?\"); ps.setString(1, email);",
      "",
      "// Go (pgx)",
      "row := pool.QueryRow(ctx, \"SELECT id, name FROM users WHERE email = $1\", email)",
      "",
      "-- PL/pgSQL: SQL động an toàn",
      "EXECUTE format('SELECT count(*) FROM %I WHERE owner = $1', tbl) INTO n USING owner_id;"
    ]},
    { id: "ch", label: "🟨 ClickHouse", lines: [
      "-- Tham số có kiểu: server parse theo kiểu khai báo",
      "SELECT event_type, count() FROM analytics.events",
      "WHERE user_id = {uid:UInt64} AND event_date >= {from:Date}",
      "GROUP BY event_type;",
      "",
      "# clickhouse-client",
      "clickhouse-client --secure --param_uid=42 --param_from=2026-09-01 --query \"...\"",
      "",
      "# HTTP interface: tham số đi riêng qua param_<ten>",
      "curl 'https://ch.internal:8443/?param_uid=42&param_from=2026-09-01' --data-binary @query.sql",
      "",
      "// Node (@clickhouse/client)",
      "await client.query({ query: 'SELECT * FROM analytics.events WHERE user_id = {uid:UInt64}',",
      "                     query_params: { uid: 42 }, format: 'JSONEachRow' })",
      "",
      "# Python (clickhouse-connect)",
      "client.query('SELECT * FROM analytics.events WHERE user_id = {uid:UInt64}', parameters={'uid': 42})"
    ]},
    { id: "d1", label: "☁️ D1 & Durable Objects", lines: [
      "// D1: prepare + bind",
      "const user = await env.DB",
      "  .prepare('SELECT id, name FROM users WHERE email = ?1 AND tenant_id = ?2')",
      "  .bind(email, session.tenantId)",
      "  .first()",
      "",
      "// Danh sách IN: sinh đủ '?' theo độ dài mảng đã giới hạn",
      "if (ids.length === 0 || ids.length > 100) throw badRequest()",
      "const marks = ids.map(() => '?').join(',')      // chỉ là dấu ?, không có dữ liệu",
      "await env.DB.prepare('SELECT * FROM orders WHERE id IN (' + marks + ')').bind(...ids).all()",
      "",
      "// Durable Object SQLite",
      "this.ctx.storage.sql.exec('INSERT INTO notes (id, body) VALUES (?, ?)', id, body)",
      "",
      "// SAI: template string chứa input",
      "env.DB.prepare('SELECT * FROM users WHERE email = \\'' + email + '\\'')   // ❌"
    ]},
    { id: "allow", label: "✅ Allowlist định danh", lines: [
      "// Tên cột / chiều sort không tham số hoá được -> map sang hằng số",
      "SORTS = {",
      "    'newest':     'created_at DESC',",
      "    'oldest':     'created_at ASC',",
      "    'price_asc':  'price ASC',",
      "    'price_desc': 'price DESC'",
      "}",
      "order = SORTS.get(req.query.sort, 'created_at DESC')   // không có -> mặc định",
      "limit = clamp(parseInt(req.query.limit) or 20, 1, 100)",
      "",
      "sql = 'SELECT id, name, price FROM products WHERE tenant_id = $1 ORDER BY ' + order + ' LIMIT $2'",
      "db.query(sql, [session.tenantId, limit])",
      "// 'order' chỉ có thể là 1 trong 4 hằng số viết trong code"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="node" id="code"><div class="nl">📜 Câu lệnh (hằng số)</div><div class="ns">... WHERE email = $1</div></div>
      <div class="node" id="data"><div class="nl">📦 Dữ liệu</div><div class="ns">o'brien@example.com</div></div>
    </div>
    <div class="arrow" id="a1">↓ gửi tách riêng</div>
    <div class="node" id="parse"><div class="nl">🧠 DB parse câu lệnh trước</div><div class="ns">cấu trúc đã cố định</div></div>
    <div class="arrow" id="a2">↓ gắn dữ liệu như giá trị</div>
    <div class="node" id="exec"><div class="nl">✅ Thực thi</div><div class="ns">ký tự đặc biệt chỉ là ký tự</div></div>
    <div class="row">
      <div class="node" id="ident"><div class="nl">🗂️ Tên cột / sort</div><div class="ns">allowlist → hằng số</div></div>
      <div class="node" id="concat"><div class="nl">❌ Ghép chuỗi</div><div class="ns">dữ liệu lẫn vào cú pháp</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Ghép chuỗi = trộn code với dữ liệu", tab: "concat", highlight: [2, 4, 5, 6, 7, 8], on: ["concat"],
      desc: "Một dấu <code>'</code> vô hại đã phá được câu lệnh. Đó là bằng chứng dữ liệu đang được hiểu như cú pháp — và input cố ý có thể đổi ý nghĩa truy vấn." },
    { title: "2 · Escape thủ công không phải lời giải", tab: "concat", highlight: [10, 11], on: ["concat"],
      desc: "Escape phụ thuộc encoding, ngữ cảnh (chuỗi, số, định danh), phiên bản DB. Chỉ cần sót một chỗ. Lời giải là tách hẳn dữ liệu khỏi câu lệnh." },
    { title: "3 · Postgres: tham số ở mọi ngôn ngữ", tab: "pg", highlight: [2, 3, 6, 9, 12, 15], on: ["code", "data", "a1", "parse"],
      desc: "Node <code>$1</code>, Python <code>%s</code>, Java <code>?</code>, Go <code>$1</code> — cú pháp khác, cơ chế giống nhau. Mảng cho IN dùng <code>= ANY($1)</code>; SQL động dùng <code>USING</code> + <code>%I</code>." },
    { title: "4 · ClickHouse: tham số có kiểu", tab: "ch", highlight: [3, 7, 10, 13, 14, 17], on: ["parse", "a2", "exec"],
      desc: "<code>{uid:UInt64}</code> vừa là chỗ trống vừa là kiểu: giá trị không parse được thành UInt64 bị từ chối ngay. Qua HTTP truyền bằng <code>param_uid</code>." },
    { title: "5 · D1 & Durable Objects: prepare().bind()", tab: "d1", highlight: [3, 4, 8, 9, 10, 13, 16], on: ["code", "data", "exec", "concat"],
      desc: "Câu lệnh là hằng số, dữ liệu đi qua <code>bind()</code>. Danh sách IN: chỉ sinh dấu <code>?</code>, dữ liệu vẫn bind. Template string chứa input là lỗi." },
    { title: "6 · Allowlist cho tên cột, sort, limit", tab: "allow", highlight: [2, 3, 4, 5, 6, 8, 9, 11, 13], on: ["ident", "exec"],
      desc: "Phần không tham số hoá được lấy từ một map hằng số trong code. Limit parse thành số và kẹp khoảng. Không có đường nào để input chen vào cú pháp." }
  ],

  quiz: [
    { q: "Nguyên nhân gốc của injection trong truy vấn DB là gì?", options: [
        "Không bật TLS",
        "Mật khẩu DB yếu",
        "Dữ liệu người dùng bị ghép vào câu lệnh và được DB hiểu như cú pháp",
        "DB quá chậm"
      ], correct: 2,
      explanation: "Truy vấn có tham số loại bỏ cơ chế này bằng cách gửi câu lệnh và dữ liệu tách riêng." },
    { q: "Vì sao truy vấn có tham số an toàn hơn escape thủ công?", options: [
        "Vì nhanh hơn",
        "Vì DB parse cấu trúc câu lệnh trước, dữ liệu gắn vào sau chỉ như giá trị — không phụ thuộc việc escape đúng hay sai",
        "Vì escape không tồn tại trong SQL",
        "Hai cách như nhau"
      ], correct: 1,
      explanation: "Escape phải đúng cho mọi ngữ cảnh và encoding; tham số loại bỏ hẳn vấn đề." },
    { q: "Cú pháp tham số của ClickHouse là gì?", options: [
        "$1",
        ":name",
        "@name",
        "{name:Type}, ví dụ {uid:UInt64}"
      ], correct: 3,
      explanation: "Giá trị truyền qua param_<name> (HTTP/CLI) hoặc query_params/parameters trong client, và được parse theo kiểu khai báo." },
    { q: "Cách đúng để truy vấn D1 theo email người dùng nhập?", options: [
        "env.DB.exec('SELECT ... WHERE email = \\'' + email + '\\'')",
        "Escape email bằng replace rồi ghép",
        "env.DB.prepare('SELECT ... WHERE email = ?').bind(email).first()",
        "Mã hoá base64 email rồi ghép"
      ], correct: 2,
      explanation: "prepare() với chỗ trống + bind() giá trị." },
    { q: "Client gửi ?sort=price_desc. Cách xử lý an toàn cho ORDER BY?", options: [
        "Ánh xạ sort sang một hằng số trong allowlist; không có trong map thì dùng mặc định/400",
        "Truyền sort như tham số $1",
        "Ghép thẳng giá trị sort vào câu SQL",
        "Chỉ cần kiểm tra không chứa dấu ;"
      ], correct: 0,
      explanation: "Tên cột và ASC/DESC không tham số hoá được. Allowlist đảm bảo chỉ hằng số viết trong code lọt vào câu lệnh." },
    { q: "Dùng ORM nhưng gọi whereRaw('email = \\'' + email + '\\''). Có an toàn không?", options: [
        "Có, vì ORM tự bảo vệ",
        "Có, nếu email đã viết thường",
        "Có, nếu DB là Postgres",
        "Không — hàm raw ghép chuỗi vẫn là ghép chuỗi; dùng dạng có tham số của ORM"
      ], correct: 3,
      explanation: "ORM chỉ an toàn khi dùng API tham số của nó." },
    { q: "'Second-order injection' là gì?", options: [
        "Injection xảy ra hai lần liên tiếp",
        "Dữ liệu độc được lưu vào DB trước, sau đó bị lấy ra và ghép chuỗi vào một truy vấn khác",
        "Injection qua cổng thứ hai",
        "Injection chỉ ở DB replica"
      ], correct: 1,
      explanation: "Dữ liệu lấy từ DB của chính mình vẫn không tin cậy nếu nguồn gốc là người dùng." },
    { q: "Truy vấn danh sách ID (IN) trên Postgres, cách an toàn?", options: [
        "WHERE id = ANY($1) và truyền mảng làm tham số",
        "Ghép 'WHERE id IN (' + ids.join(',') + ')'",
        "Chạy nhiều truy vấn và ghép chuỗi",
        "Không làm được an toàn"
      ], correct: 0,
      explanation: "Mảng là một giá trị; giới hạn độ dài mảng ở bước validate." },
    { q: "Trong PL/pgSQL, SQL động an toàn nên viết thế nào?", options: [
        "EXECUTE 'SELECT ... ' || input",
        "Không dùng được SQL động",
        "EXECUTE format('... %I ... $1', tbl) USING value — định danh qua %I (sau allowlist), giá trị qua USING",
        "Dùng quote_literal cho mọi thứ rồi ghép"
      ], correct: 2,
      explanation: "USING truyền giá trị như tham số; %I quote định danh. Vẫn nên allowlist tên bảng." }
  ]
});
