window.LESSONS.push({
  id: "21",
  phase: "5", phaseName: "Vận hành",
  title: "Bảo mật cơ bản: xác thực, TLS, role, API key",
  subtitle: "ES 8 bật security mặc định · TLS transport & HTTP · least privilege cho từng service · API key · DLS/FLS · OpenSearch Security",

  theory: `
    <p>ES từng nổi tiếng vì hàng nghìn cụm mở cổng 9200 ra Internet không mật khẩu và bị xoá sạch/đòi tiền chuộc. Từ <strong>8.0</strong>, lần khởi động đầu tiên ES tự bật security: sinh chứng chỉ TLS cho cả <em>transport</em> (node ↔ node, cổng 9300) và <em>HTTP</em> (client ↔ node, 9200), in mật khẩu user <code>elastic</code> và enrollment token.</p>

    <p><strong>Các lớp bảo vệ</strong></p>
    <ol>
      <li><strong>Mạng</strong>: ES chỉ nằm trong mạng nội bộ/VPC. Mobile/web <em>không bao giờ</em> gọi ES trực tiếp — luôn qua search-api của ta (nơi kiểm tra auth người dùng, giới hạn query, chống query đắt).</li>
      <li><strong>TLS</strong>: transport TLS là bắt buộc khi bật security trên cụm nhiều node; HTTP TLS để mật khẩu/API key không đi dạng rõ.</li>
      <li><strong>Xác thực</strong> (authentication): native realm (user/mật khẩu), API key, service account (cho Kibana, Fleet), token, và LDAP/AD/SAML/OIDC (một số realm cần license trả phí).</li>
      <li><strong>Phân quyền</strong> (authorization, RBAC): role gồm <em>cluster privileges</em> (<code>monitor</code>, <code>manage_ilm</code>, <code>manage_index_templates</code>…) và <em>indices privileges</em> theo pattern tên index (<code>read</code>, <code>write</code>, <code>create_doc</code>, <code>create_index</code>, <code>manage</code>, <code>view_index_metadata</code>…).</li>
    </ol>

    <p><strong>Least privilege cho hệ thống của ta</strong></p>
    <table>
      <tr><th>Danh tính</th><th>Quyền</th></tr>
      <tr><td>search-api</td><td><code>read</code> trên <code>products*</code></td></tr>
      <tr><td>es-indexer</td><td><code>write</code>, <code>create_index</code>, <code>manage</code> (để swap alias/reindex) trên <code>products*</code></td></tr>
      <tr><td>log shipper</td><td><code>create_doc</code>, <code>auto_configure</code> trên <code>logs-*</code></td></tr>
      <tr><td>Grafana/monitoring</td><td>cluster <code>monitor</code> + <code>read</code>/<code>view_index_metadata</code> trên index cần xem</td></tr>
      <tr><td><code>elastic</code> (superuser)</td><td>Chỉ để cứu hộ; không nhét vào config service nào</td></tr>
    </table>

    <p><strong>API key</strong> — cách xác thực khuyên dùng cho service: tạo bằng <code>POST /_security/api_key</code>, có <code>role_descriptors</code> (quyền là <em>giao</em> của quyền người tạo và quyền mô tả), <code>expiration</code>, huỷ được riêng lẻ (<code>DELETE /_security/api_key</code>). Header: <code>Authorization: ApiKey &lt;base64(id:api_key)&gt;</code> — response có sẵn trường <code>encoded</code>. Lưu trong secret manager, xoay định kỳ (tạo key mới → deploy → huỷ key cũ).</p>

    <p><strong>DLS/FLS</strong> (document/field level security): role chỉ thấy document khớp query (vd <code>tenant_id = X</code>) hoặc chỉ một số field. Ở Elastic là tính năng trả phí (Platinum trở lên), cũng như audit log. Với multi-tenant, nhiều đội vẫn chọn lọc tenant ở search-api — nhưng phải có test chứng minh mọi query đều thêm filter đó.</p>

    <p><strong>OpenSearch</strong>: Security plugin (miễn phí, gồm cả DLS/FLS và audit log) — cấu hình qua <code>_plugins/_security/api/...</code> hoặc file YAML + <code>securityadmin.sh</code>; có <em>roles mapping</em> tách biệt khỏi role. Amazon OpenSearch Service còn hỗ trợ IAM (ký request SigV4).</p>

    <div class="callout"><p>💡 Giống Spring Security: authentication (bạn là ai) tách khỏi authorization (bạn được làm gì). Khác: ở ES "tài nguyên" là pattern tên index — nên đặt tên index có quy ước (<code>products_v*</code>, <code>logs-&lt;service&gt;-*</code>) để viết role gọn và chặt.</p></div>
  `,

  codeTabs: [
    { id: "role", label: "① Role", lines: [
      "POST /_security/role/search_api_reader",
      "{ \"cluster\": [],",
      "  \"indices\": [ { \"names\": [ \"products*\" ], \"privileges\": [ \"read\" ] } ] }",
      "",
      "POST /_security/role/es_indexer",
      "{ \"cluster\": [ \"monitor\" ],",
      "  \"indices\": [ { \"names\": [ \"products*\" ],",
      "                 \"privileges\": [ \"write\", \"create_index\", \"manage\", \"view_index_metadata\" ] } ] }"
    ]},
    { id: "key", label: "② API key", lines: [
      "POST /_security/api_key",
      "{ \"name\": \"search-api-prod-2024-05\",",
      "  \"expiration\": \"90d\",",
      "  \"role_descriptors\": { \"reader\": {",
      "      \"indices\": [ { \"names\": [ \"products*\" ], \"privileges\": [ \"read\" ] } ] } } }",
      "",
      "# → { \"id\": \"VuaCfGcBCdbkQm-e5aOx\", \"api_key\": \"ui2lp2axTNmsyakw9tvNnw\",",
      "#     \"encoded\": \"VnVhQ2ZHY0JDZGJrUW0tZTVhT3g6dWkybHAyYXhUTm1zeWFrdzl0dk5udw==\" }",
      "",
      "curl -H \"Authorization: ApiKey VnVhQ2ZHY0JDZGJr...\" https://es.internal:9200/products/_search"
    ]},
    { id: "tls", label: "③ TLS & kiểm tra", lines: [
      "# elasticsearch.yml (8.x tự sinh khi cài lần đầu)",
      "xpack.security.enabled: true",
      "xpack.security.transport.ssl.enabled: true",
      "xpack.security.http.ssl.enabled: true",
      "xpack.security.http.ssl.keystore.path: certs/http.p12",
      "",
      "GET /_security/_authenticate          // tôi đang là ai?",
      "GET /_security/user/_has_privileges    // có quyền này không?",
      "{ \"index\": [ { \"names\": [ \"products\" ], \"privileges\": [ \"write\" ] } ] }"
    ]},
    { id: "os", label: "④ DLS & OpenSearch", lines: [
      "# Elastic (Platinum+): chỉ thấy document của tenant 17, ẩn field cost_price",
      "\"indices\": [ { \"names\": [ \"orders*\" ], \"privileges\": [ \"read\" ],",
      "  \"query\": { \"term\": { \"tenant_id\": \"17\" } },",
      "  \"field_security\": { \"grant\": [ \"*\" ], \"except\": [ \"cost_price\" ] } } ]",
      "",
      "# OpenSearch Security plugin",
      "PUT /_plugins/_security/api/roles/search_api_reader",
      "{ \"index_permissions\": [ { \"index_patterns\": [ \"products*\" ],",
      "    \"allowed_actions\": [ \"read\" ], \"fls\": [ \"~cost_price\" ] } ] }",
      "PUT /_plugins/_security/api/rolesmapping/search_api_reader  { \"users\": [ \"search-api\" ] }"
    ]}
  ],

  stageHtml: `
    <div class="node" id="mob"><div class="nl">📱 Mobile / Web</div><div class="ns">không bao giờ gọi ES trực tiếp</div></div>
    <div class="arrow" id="a1">↓ HTTPS + auth người dùng</div>
    <div class="node" id="api"><div class="nl">🦀 search-api</div><div class="ns">API key role: read products*</div></div>
    <div class="arrow" id="a2">↓ TLS (9200) · Authorization: ApiKey</div>
    <div class="node" id="es"><div class="nl">🔎 Elasticsearch (VPC nội bộ)</div><div class="ns">authn → role → privileges theo pattern index</div></div>
    <div class="arrow" id="a3">↔ transport TLS (9300)</div>
    <div class="node" id="nodes"><div class="nl">🖥️ Các node khác</div><div class="ns">chứng chỉ chung CA</div></div>
  `,
  steps: [
    { title: "1 · ES không ra Internet", tab: "tls", highlight: [2], on: ["mob", "a1", "api"],
      desc: "Client cuối đi qua search-api; ES nằm trong mạng nội bộ." },
    { title: "2 · Mỗi service một role tối thiểu", tab: "role", highlight: [3, 7, 8], on: ["api", "es"],
      desc: "search-api chỉ đọc; indexer mới được ghi và quản lý alias." },
    { title: "3 · Cấp API key có hạn", tab: "key", highlight: [2, 3, 5, 8, 10], on: ["a2", "es"],
      desc: "Quyền của key là giao giữa quyền người tạo và role_descriptors. Huỷ riêng lẻ được." },
    { title: "4 · TLS hai lớp", tab: "tls", highlight: [3, 4, 5], on: ["a3", "nodes"],
      desc: "Transport TLS giữa các node, HTTP TLS cho client." },
    { title: "5 · Kiểm tra quyền", tab: "tls", highlight: [7, 8, 9], on: ["es"],
      desc: "_authenticate và _has_privileges để test cấu hình, không phải đoán." },
    { title: "6 · DLS/FLS và OpenSearch", tab: "os", highlight: [3, 4, 7, 9, 10], on: ["es"],
      desc: "Elastic: trả phí. OpenSearch Security plugin: miễn phí, có roles mapping riêng." }
  ],

  quiz: [
    { q: "Từ ES 8.0, lần khởi động đầu security thế nào?", options: [
        "Tắt mặc định",
        "Tự bật: sinh chứng chỉ TLS, mật khẩu elastic, enrollment token",
        "Chỉ bật HTTP basic",
        "Yêu cầu license"
      ], correct: 1, explanation: "Khác hẳn thời 6.x/7.x mặc định mở." },
    { q: "App mobile có nên gọi thẳng ES bằng API key read-only?", options: [
        "Có, nhanh hơn",
        "Không — key lộ trong app, người dùng gửi được query tuỳ ý/đắt; luôn qua search-api",
        "Có nếu bật TLS",
        "Có nếu dùng DLS"
      ], correct: 1, explanation: "Mọi thứ trong app mobile coi như công khai." },
    { q: "Quyền nào đủ cho search-api?", options: [
        "superuser", "read trên products*", "manage trên *", "all"
      ], correct: 1, explanation: "Least privilege." },
    { q: "Header gửi API key đúng?", options: [
        "Authorization: Bearer <api_key>",
        "Authorization: ApiKey <base64(id:api_key)>",
        "X-API-Key: <api_key>",
        "Authorization: Basic <api_key>"
      ], correct: 1, explanation: "Response tạo key có sẵn trường encoded." },
    { q: "Quyền thực tế của API key tạo với role_descriptors là?", options: [
        "Đúng như role_descriptors",
        "Giao của quyền người tạo và role_descriptors",
        "Hợp của hai",
        "Superuser"
      ], correct: 1, explanation: "Không thể tạo key mạnh hơn chính mình." },
    { q: "DLS/FLS ở Elastic thuộc gói nào?", options: [
        "Basic miễn phí", "Trả phí (Platinum trở lên)", "Chỉ Cloud", "Không có"
      ], correct: 1, explanation: "OpenSearch Security plugin có miễn phí." },
    { q: "Vì sao TLS transport quan trọng?", options: [
        "Tăng tốc",
        "Node lạ không tham gia được cụm và dữ liệu replicate giữa node được mã hoá",
        "Để Kibana chạy",
        "Không quan trọng"
      ], correct: 1, explanation: "Bắt buộc khi bật security trên cụm nhiều node." },
    { q: "Cách xoay API key không downtime?", options: [
        "Huỷ key cũ trước rồi tạo key mới",
        "Tạo key mới → deploy service dùng key mới → huỷ key cũ",
        "Đổi mật khẩu elastic",
        "Restart cụm"
      ], correct: 1, explanation: "Hai key cùng hợp lệ trong thời gian chuyển." },
    { q: "Ở OpenSearch Security, gán role cho user qua?", options: [
        "Trong role luôn", "Roles mapping (_plugins/_security/api/rolesmapping)", "ILM", "Kibana spaces"
      ], correct: 1, explanation: "Role và mapping tách biệt." }
  ]
});
