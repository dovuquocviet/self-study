window.LESSONS.push({
  id: "14",
  phase: "5", phaseName: "Bảo vệ dữ liệu",
  title: "Mã hoá mức field/ứng dụng",
  subtitle: "Envelope encryption với KMS · AEAD & associated data · blind index để tìm kiếm · tokenization · Mongo CSFLE/Queryable Encryption · pgcrypto và giới hạn của nó",

  theory: `
    <p>Bài 13 cho thấy at-rest không che được dữ liệu trước những ai truy vấn được DB. Mã hoá <strong>mức field</strong> (hay mức ứng dụng) đi xa hơn:
    ứng dụng mã hoá giá trị <em>trước khi</em> gửi xuống DB. DB, backup, replica, log truy vấn, người quản trị DB, CDC sang Kafka/ClickHouse — tất cả chỉ thấy bản mã.
    Chỉ đoạn code có quyền dùng khoá mới giải mã được.</p>

    <p><strong>1. Khi nào nên dùng?</strong> Cho một số ít cột thật sự nhạy cảm: số CMND/CCCD, số tài khoản, token của bên thứ ba, dữ liệu sức khoẻ, ghi chú riêng tư.
    Không mã hoá mọi thứ: cột mã hoá không lọc, sắp xếp, join, tổng hợp được như bình thường.</p>

    <p><strong>2. Envelope encryption — cách dùng KMS đúng</strong></p>
    <ol>
      <li><strong>KEK</strong> (key encryption key) nằm trong KMS/HSM, không bao giờ rời khỏi đó.</li>
      <li>Ứng dụng xin KMS một <strong>DEK</strong> (data encryption key): nhận về DEK dạng rõ + DEK đã được KEK mã hoá.</li>
      <li>Dùng DEK dạng rõ để mã hoá dữ liệu bằng thuật toán AEAD (AES-256-GCM, ChaCha20-Poly1305), rồi xoá DEK rõ khỏi bộ nhớ khi xong.</li>
      <li>Lưu cùng dòng: bản mã + nonce + DEK đã mã hoá + id của KEK/phiên bản khoá.</li>
      <li>Giải mã: gửi DEK đã mã hoá cho KMS → nhận DEK rõ → giải mã dữ liệu. Có thể cache DEK ngắn hạn để giảm số lần gọi KMS.</li>
    </ol>
    <p>Lợi ích: KMS chỉ xử lý khoá nhỏ (nhanh, rẻ); đổi KEK chỉ cần mã hoá lại các DEK; mỗi tenant/người dùng có thể có DEK riêng — cơ sở cho crypto-shredding (bài 15).</p>

    <p><strong>3. Những chi tiết hay sai</strong></p>
    <ul>
      <li><strong>Nonce/IV không được lặp</strong> với cùng một khoá GCM — lặp là mất cả tính bí mật lẫn toàn vẹn. Dùng nonce ngẫu nhiên 96-bit và giới hạn số lần dùng mỗi DEK, hoặc thư viện lo việc này.</li>
      <li><strong>Associated data (AAD)</strong>: gắn bản mã với ngữ cảnh (ví dụ <code>table.column</code> + <code>row id</code> + <code>tenant_id</code>). Không có AAD, kẻ có quyền ghi DB có thể
        <em>chép</em> bản mã từ dòng của người A sang dòng của mình và ứng dụng sẽ giải mã giúp.</li>
      <li><strong>Không tự chế</strong> thuật toán/định dạng. Dùng thư viện cấp cao: Google Tink, AWS Encryption SDK, libsodium (secretbox/AEAD), Mongo CSFLE…</li>
      <li><strong>Khoá không nằm trong DB</strong> và không nằm trong repo. <code>pgcrypto</code> (<code>pgp_sym_encrypt(data, key)</code>) mã hoá <em>bên trong</em> DB: khoá được gửi kèm câu truy vấn
        → có thể xuất hiện trong log truy vấn, <code>pg_stat_activity</code>, audit log. Nếu dùng, phải tắt log tham số cho phiên đó; tốt hơn là mã hoá ở ứng dụng.</li>
    </ul>

    <p><strong>4. Tìm kiếm trên cột đã mã hoá: blind index</strong></p>
    <p>AEAD với nonce ngẫu nhiên cho bản mã khác nhau mỗi lần → không thể <code>WHERE email_enc = ...</code>. Giải pháp: lưu thêm cột
    <code>email_bidx = HMAC-SHA256(khoá_index, chuẩn_hoá(email))</code> (dùng khoá khác với khoá mã hoá). Tìm kiếm bằng cách tính HMAC của giá trị cần tìm rồi so sánh bằng.
    Đánh đổi: blind index cho phép so sánh <em>bằng</em> và lộ việc hai dòng có cùng giá trị (tần suất) → có thể cắt ngắn HMAC để tăng va chạm có chủ đích nếu giá trị ít biến thể.</p>

    <p><strong>5. Tokenization</strong></p>
    <p>Thay giá trị nhạy cảm bằng một <strong>token</strong> không mang thông tin (ví dụ <code>tok_8f2c...</code>); giá trị thật nằm trong một dịch vụ "vault" riêng, quyền hẹp, audit chặt.
    Các DB khác (analytics, Kafka, ClickHouse) chỉ chứa token. Hay dùng cho số thẻ (phạm vi PCI thu nhỏ lại chỉ còn vault).</p>

    <p><strong>6. Công cụ theo engine</strong></p>
    <table>
      <tr><th>Engine</th><th>Lựa chọn</th></tr>
      <tr><td>PostgreSQL</td><td>Mã hoá ở ứng dụng (Tink/SDK) lưu <code>bytea</code>; <code>pgcrypto</code> với các lưu ý về log khoá</td></tr>
      <tr><td>MongoDB</td><td><strong>CSFLE</strong> (Client-Side Field Level Encryption) và <strong>Queryable Encryption</strong>: driver tự mã hoá field theo schema, khoá quản lý bằng KMS; QE cho phép truy vấn bằng/khoảng trên field mã hoá</td></tr>
      <tr><td>Redis / Cloudflare KV</td><td>Mã hoá giá trị trước khi <code>SET</code>/<code>put</code> (WebCrypto <code>AES-GCM</code> trong Worker), khoá trong secret</td></tr>
      <tr><td>Kafka</td><td>Mã hoá payload (hoặc field nhạy cảm) ở producer — end-to-end, broker và Connect chỉ thấy bản mã</td></tr>
      <tr><td>ClickHouse</td><td>Tốt nhất: không đưa PII rõ vào kho phân tích; dùng token/hash. Hàm <code>encrypt()</code>/<code>decrypt()</code> có sẵn nhưng khoá đi qua câu truy vấn — cùng lưu ý như pgcrypto</td></tr>
    </table>

    <div class="callout"><p>💡 Mã hoá field chuyển vấn đề từ "bảo vệ dữ liệu" sang "bảo vệ quyền dùng khoá". Thiết kế luôn: service nào được gọi <code>kms:Decrypt</code> cho khoá nào,
    và log mọi lần gọi. Service báo cáo không cần giải mã thì không được cấp quyền đó.</p></div>
  `,

  codeTabs: [
    { id: "envelope", label: "✉️ Envelope (pseudo)", lines: [
      "// Mã hoá",
      "dek_plain, dek_wrapped = kms.generate_data_key(key_id='alias/pii-kek', spec='AES_256')",
      "nonce = random_bytes(12)",
      "aad   = 'customers.national_id|' + tenant_id + '|' + customer_id",
      "ct    = aes_256_gcm_encrypt(dek_plain, nonce, national_id, aad)",
      "wipe(dek_plain)",
      "db.execute('UPDATE customers SET national_id_ct = $1, nid_nonce = $2, nid_dek = $3, nid_kid = $4 WHERE id = $5',",
      "           [ct, nonce, dek_wrapped, 'pii-kek-v3', customer_id])",
      "",
      "// Giải mã (chỉ service có quyền kms:Decrypt)",
      "dek_plain = kms.decrypt(row.nid_dek)",
      "national_id = aes_256_gcm_decrypt(dek_plain, row.nid_nonce, row.national_id_ct, aad)",
      "// sai aad (bản mã bị chép sang dòng khác) -> giải mã thất bại"
    ]},
    { id: "bidx", label: "🔎 Blind index", lines: [
      "-- Postgres: bản mã + blind index",
      "ALTER TABLE customers",
      "  ADD COLUMN email_ct   bytea,",
      "  ADD COLUMN email_bidx bytea;",
      "CREATE INDEX ON customers (tenant_id, email_bidx);",
      "",
      "// Ghi: khoá index KHÁC khoá mã hoá",
      "norm = lower(trim(email))",
      "bidx = hmac_sha256(index_key, norm)",
      "db.execute('INSERT INTO customers (tenant_id, email_ct, email_bidx) VALUES ($1, $2, $3)',",
      "           [tenant, encrypt(email), bidx])",
      "",
      "// Tìm kiếm bằng",
      "db.query('SELECT id, email_ct FROM customers WHERE tenant_id = $1 AND email_bidx = $2',",
      "         [tenant, hmac_sha256(index_key, lower(trim(input_email)))])"
    ]},
    { id: "mongo", label: "🍃 Mongo CSFLE / QE", lines: [
      "// Driver tự mã hoá field theo cấu hình; khoá dữ liệu nằm trong key vault, KEK trong KMS",
      "const client = new MongoClient(uri, {",
      "  autoEncryption: {",
      "    keyVaultNamespace: 'encryption.__keyVault',",
      "    kmsProviders: { aws: {} },                    // lấy credential từ môi trường",
      "    encryptedFieldsMap: {",
      "      'hr.employees': { fields: [",
      "        { path: 'ssn', bsonType: 'string', keyId: ssnKeyId, queries: { queryType: 'equality' } },",
      "        { path: 'salary', bsonType: 'int', keyId: salaryKeyId }",
      "      ] }",
      "    }",
      "  }",
      "})",
      "// DB, backup, log chỉ thấy BinData đã mã hoá; truy vấn bằng trên 'ssn' vẫn được (Queryable Encryption)"
    ]},
    { id: "worker", label: "☁️ Worker + KV/D1", lines: [
      "// Mã hoá giá trị trước khi lưu vào KV/D1 bằng WebCrypto",
      "async function seal(env, plaintext, aad) {",
      "  const key = await crypto.subtle.importKey('raw', b64(env.PII_KEY), 'AES-GCM', false, ['encrypt'])",
      "  const iv = crypto.getRandomValues(new Uint8Array(12))",
      "  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc(aad) }, key, enc(plaintext))",
      "  return { v: 1, iv: toB64(iv), ct: toB64(ct) }",
      "}",
      "",
      "// PII_KEY đặt bằng: wrangler secret put PII_KEY  (không nằm trong wrangler.toml)",
      "const box = await seal(env, phone, 'users.phone|' + tenantId + '|' + userId)",
      "await env.DB.prepare('UPDATE users SET phone_box = ?1 WHERE id = ?2 AND tenant_id = ?3')",
      "  .bind(JSON.stringify(box), userId, tenantId).run()"
    ]},
    { id: "pgcrypto", label: "⚠️ pgcrypto & token", lines: [
      "-- pgcrypto: mã hoá TRONG DB -> khoá đi kèm câu truy vấn",
      "UPDATE customers SET note_ct = pgp_sym_encrypt($1, $2) WHERE id = $3;",
      "-- rủi ro: khoá ($2) có thể lộ qua log_statement, pgaudit, pg_stat_activity",
      "-- nếu buộc dùng: SET LOCAL log_statement = 'none' (cần quyền), tắt log tham số,",
      "--                không để khoá trong hàm/SQL lưu trong DB",
      "",
      "// Tokenization: DB nghiệp vụ chỉ lưu token",
      "token = vault.tokenize(card_number)          // 'tok_8f2c...' không mang thông tin",
      "db.execute('INSERT INTO payments (order_id, card_token) VALUES ($1, $2)', [order_id, token])",
      "// chỉ payment-service có quyền vault.detokenize(), mọi lần gọi đều được audit"
    ]}
  ],

  stageHtml: `
    <div class="node" id="appn"><div class="nl">🧾 Ứng dụng</div><div class="ns">mã hoá trước khi ghi</div></div>
    <div class="row">
      <div class="node" id="kmsn"><div class="nl">🔐 KMS (KEK)</div><div class="ns">cấp/giải DEK · audit</div></div>
      <div class="node" id="dek"><div class="nl">🗝️ DEK</div><div class="ns">AES-GCM · nonce · AAD</div></div>
    </div>
    <div class="arrow" id="a1">↓ chỉ gửi bản mã</div>
    <div class="node" id="dbn"><div class="nl">🗄️ DB / backup / replica / log</div><div class="ns">ct · nonce · DEK đã bọc · kid</div></div>
    <div class="row">
      <div class="node" id="bidxn"><div class="nl">🔎 Blind index</div><div class="ns">HMAC để tìm bằng</div></div>
      <div class="node" id="down"><div class="nl">📊 Kafka / ClickHouse</div><div class="ns">chỉ bản mã hoặc token</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Envelope: KEK trong KMS, DEK cho dữ liệu", tab: "envelope", highlight: [2, 3, 5, 6], on: ["appn", "kmsn", "dek"],
      desc: "KMS sinh DEK và trả về cả bản rõ lẫn bản đã bọc. Dữ liệu mã hoá bằng DEK rõ, rồi xoá DEK rõ khỏi bộ nhớ." },
    { title: "2 · Lưu bản mã kèm metadata", tab: "envelope", highlight: [7, 8], on: ["a1", "dbn"],
      desc: "Mỗi dòng lưu: bản mã, nonce, DEK đã bọc, id khoá. DB và mọi bản sao chỉ thấy những thứ vô nghĩa nếu không có KMS." },
    { title: "3 · AAD gắn bản mã với ngữ cảnh", tab: "envelope", highlight: [4, 11, 12, 13], on: ["dek", "dbn"],
      desc: "AAD chứa bảng/cột/tenant/id dòng. Bản mã bị chép sang dòng khác sẽ giải mã thất bại thay vì bị ứng dụng giải mã hộ." },
    { title: "4 · Blind index để tìm kiếm", tab: "bidx", highlight: [3, 4, 5, 8, 9, 14, 15], on: ["bidxn", "dbn"],
      desc: "HMAC (khoá riêng) của giá trị đã chuẩn hoá cho phép <code>WHERE email_bidx = ...</code>. Đánh đổi: lộ việc hai dòng trùng giá trị." },
    { title: "5 · Mongo CSFLE / Queryable Encryption", tab: "mongo", highlight: [3, 4, 5, 8, 9, 14], on: ["appn", "dbn"],
      desc: "Driver tự mã hoá theo cấu hình field. Queryable Encryption vẫn cho truy vấn bằng trên field đã mã hoá." },
    { title: "6 · Worker: WebCrypto + secret", tab: "worker", highlight: [3, 4, 5, 9, 10, 11], on: ["appn", "dbn"],
      desc: "AES-GCM với IV ngẫu nhiên và additionalData; khoá đặt bằng <code>wrangler secret put</code>. D1/KV chỉ chứa hộp đã niêm phong." },
    { title: "7 · pgcrypto & tokenization", tab: "pgcrypto", highlight: [2, 3, 8, 9, 10], on: ["down", "dbn"],
      desc: "Mã hoá trong DB khiến khoá đi qua câu truy vấn và có thể nằm trong log. Tokenization giữ giá trị thật trong một vault riêng; hệ thống khác chỉ có token." }
  ],

  quiz: [
    { q: "Ưu điểm chính của mã hoá mức field so với at-rest?", options: [
        "DB, backup, log, người quản trị DB và hệ thống downstream chỉ thấy bản mã; chỉ code có quyền dùng khoá mới giải mã được",
        "Nhanh hơn",
        "Không cần quản lý khoá",
        "Cho phép truy vấn mọi kiểu trên cột mã hoá"
      ], correct: 0,
      explanation: "Đổi lại, cột mã hoá khó lọc/sắp xếp/tổng hợp — chỉ dùng cho cột thật sự nhạy cảm." },
    { q: "Trong envelope encryption, KEK nằm ở đâu?", options: [
        "Trong cùng bảng với dữ liệu",
        "Trong repo",
        "Trong biến môi trường của mọi service",
        "Trong KMS/HSM, không rời khỏi đó; dữ liệu được mã hoá bằng DEK, DEK được KEK bọc lại"
      ], correct: 3,
      explanation: "KMS chỉ xử lý khoá nhỏ; đổi KEK chỉ cần bọc lại DEK." },
    { q: "Điều gì xảy ra nếu dùng lại nonce với cùng một khoá AES-GCM?", options: [
        "Không sao",
        "Mất cả tính bí mật và toàn vẹn — kẻ tấn công có thể suy ra dữ liệu và giả mạo bản mã",
        "Chỉ chậm hơn",
        "Bản mã dài hơn"
      ], correct: 1,
      explanation: "Dùng nonce ngẫu nhiên 96-bit, giới hạn số lần dùng mỗi khoá, hoặc để thư viện cấp cao lo." },
    { q: "Associated data (AAD) chứa id dòng + tenant giúp chống điều gì?", options: [
        "Kẻ có quyền ghi DB chép bản mã của người khác sang dòng của mình để ứng dụng giải mã hộ",
        "Brute force khoá",
        "Tràn bộ nhớ",
        "Mất khoá"
      ], correct: 0,
      explanation: "AAD sai → xác thực GCM thất bại → không giải mã." },
    { q: "Blind index là gì?", options: [
        "Index ẩn trong Postgres",
        "Index không dùng được",
        "Cột HMAC (bằng khoá riêng) của giá trị đã chuẩn hoá, cho phép tìm kiếm bằng trên dữ liệu đã mã hoá",
        "Bản sao không mã hoá của cột"
      ], correct: 2,
      explanation: "Đánh đổi: lộ tần suất/giá trị trùng; không hỗ trợ tìm khoảng hay LIKE." },
    { q: "Rủi ro đặc thù khi dùng pgp_sym_encrypt(data, key) của pgcrypto?", options: [
        "Thuật toán yếu",
        "Khoá được gửi kèm câu truy vấn và có thể xuất hiện trong log truy vấn, audit log, pg_stat_activity",
        "Không giải mã được",
        "Chỉ chạy trên Windows"
      ], correct: 1,
      explanation: "Mã hoá ở ứng dụng giữ khoá ngoài DB." },
    { q: "Tokenization khác mã hoá field ở điểm nào?", options: [
        "Token là bản mã có thể giải bằng khoá công khai",
        "Không khác gì",
        "Tokenization không cần bảo vệ vault",
        "Token không mang thông tin; giá trị thật nằm trong một vault riêng, các hệ thống khác chỉ lưu token"
      ], correct: 3,
      explanation: "Thu nhỏ phạm vi dữ liệu nhạy cảm (ví dụ PCI) về một dịch vụ duy nhất." },
    { q: "MongoDB Queryable Encryption cho phép điều gì?", options: [
        "Tắt xác thực",
        "Mã hoá đĩa",
        "Driver tự mã hoá field; server chỉ thấy bản mã nhưng vẫn hỗ trợ một số truy vấn (bằng, khoảng) trên field mã hoá",
        "Nén dữ liệu"
      ], correct: 2,
      explanation: "Khoá dữ liệu nằm trong key vault, KEK trong KMS; server không có khoá." },
    { q: "Trong Worker, khoá AES để mã hoá dữ liệu trước khi lưu KV nên đặt ở đâu?", options: [
        "Secret của Worker (wrangler secret put) hoặc Secrets Store",
        "Hard-code trong code",
        "Trong [vars] của wrangler.toml",
        "Trong chính KV cùng namespace"
      ], correct: 0,
      explanation: "Khoá không nằm trong repo và không nằm cạnh dữ liệu." }
  ]
});
