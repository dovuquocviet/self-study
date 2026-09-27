window.LESSONS.push({
  id: "22",
  phase: "6", phaseName: "Rust & tổng kết",
  title: "Client Rust: crate elasticsearch (và opensearch)",
  subtitle: "Transport + auth · một client dùng chung · search có kiểu với serde · bulk & đọc lỗi từng item · 4xx không phải Err",

  theory: `
    <p>Crate chính thức <code>elasticsearch</code> (elastic/elasticsearch-rs) là client <strong>async</strong> (tokio + reqwest), sinh tự động từ đặc tả REST API. Hai điều cần biết trước:</p>
    <ul>
      <li>Phiên bản crate đi theo phiên bản ES (<code>8.x.y-alpha.N</code>, <code>9.x.y-alpha.N</code>) và <strong>vẫn gắn nhãn alpha</strong>: API có thể đổi giữa các bản. Ghim version chính xác trong <code>Cargo.toml</code>.</li>
      <li>Body request/response là <code>serde_json::Value</code> hoặc struct serde của bạn — crate <em>không</em> có kiểu cho Query DSL. Bạn viết JSON bằng macro <code>json!</code>. Nghĩa là mọi kiến thức Query DSL trong khoá này dùng nguyên văn.</li>
    </ul>

    <p><strong>Cấu trúc API</strong>: mỗi endpoint là một method trả builder; đường dẫn chọn bằng enum <code>*Parts</code> (<code>SearchParts::Index(&amp;["products"])</code>, <code>IndexParts::IndexId("products", "42")</code>, <code>BulkParts::Index("products")</code>); query string là method của builder (<code>.refresh(Refresh::WaitFor)</code>, <code>.size(20)</code>); cuối cùng <code>.send().await</code>. Namespace: <code>client.indices()</code>, <code>client.cat()</code>, <code>client.cluster()</code>…</p>

    <p><strong>Bẫy lớn nhất</strong>: <code>send()</code> chỉ trả <code>Err</code> khi lỗi <em>transport</em> (không kết nối được, timeout). HTTP 404/409/400/429 vẫn là <code>Ok(Response)</code>. Luôn kiểm tra <code>response.status_code()</code> hoặc gọi <code>response.error_for_status_code()?</code>. Với bulk, 200 cũng chưa đủ — phải đọc <code>errors</code> và <code>items</code> (bài 14).</p>

    <p><strong>Một client dùng chung</strong>: <code>Elasticsearch</code> có thể clone rẻ (bên trong là connection pool dùng chung). Tạo một lần lúc khởi động, đưa vào state của axum/actix — giống bean singleton <code>RestClient</code> trong Spring. Không tạo client mỗi request.</p>

    <p><strong>Transport</strong>: <code>SingleNodeConnectionPool</code> (một URL — thường là load balancer/service nội bộ), <code>Transport::cloud(cloud_id, credentials)</code> cho Elastic Cloud. <code>TransportBuilder</code> đặt <code>.auth(Credentials::EncodedApiKey(...))</code> / <code>Basic</code> / <code>ApiKey(id, key)</code>, <code>.timeout(...)</code>, <code>.cert_validation(...)</code> (chỉ tắt validation ở máy dev).</p>

    <p><strong>OpenSearch</strong>: dùng crate <code>opensearch</code> (fork cùng thiết kế): <code>opensearch::OpenSearch</code>, cùng mô hình <code>*Parts</code>/builder, có thêm feature <code>aws-auth</code> ký SigV4 cho Amazon OpenSearch Service. Đổi hãng = đổi crate, còn JSON query gần như giữ nguyên (trừ các API khác biệt: PIT, ILM/ISM, security).</p>

    <div class="callout"><p>💡 Bên Java bạn có Spring Data (repository sinh query) hoặc Java API Client (có kiểu cho từng query). Rust client nằm ở mức thấp hơn cả hai — gần với việc gửi JSON bằng RestTemplate. Bù lại, bạn thấy chính xác mọi byte gửi đi, và kết hợp serde để parse kết quả có kiểu.</p></div>
  `,

  codeTabs: [
    { id: "setup", label: "① Cargo & client", lines: [
      "# Cargo.toml",
      "[dependencies]",
      "elasticsearch = \"=8.15.0-alpha.1\"      # ghim chính xác, khớp major với cụm",
      "tokio = { version = \"1\", features = [\"full\"] }",
      "serde = { version = \"1\", features = [\"derive\"] }",
      "serde_json = \"1\"",
      "url = \"2\"",
      "",
      "use elasticsearch::{Elasticsearch, auth::Credentials,",
      "    http::transport::{SingleNodeConnectionPool, TransportBuilder}};",
      "",
      "pub fn build_client(url: &str, api_key: &str) -> Result<Elasticsearch, Box<dyn std::error::Error>> {",
      "    let pool = SingleNodeConnectionPool::new(url::Url::parse(url)?);",
      "    let transport = TransportBuilder::new(pool)",
      "        .auth(Credentials::EncodedApiKey(api_key.to_string()))",
      "        .timeout(std::time::Duration::from_secs(5))",
      "        .build()?;",
      "    Ok(Elasticsearch::new(transport))       // clone rẻ, dùng chung toàn app",
      "}"
    ]},
    { id: "search", label: "② Search có kiểu", lines: [
      "#[derive(serde::Deserialize)] struct Product { sku: String, name: String, price: i64 }",
      "#[derive(serde::Deserialize)] struct Hit<T> { _id: String, _score: Option<f64>, _source: T }",
      "#[derive(serde::Deserialize)] struct Hits<T> { hits: Vec<Hit<T>> }",
      "#[derive(serde::Deserialize)] struct SearchResp<T> { took: u64, hits: Hits<T> }",
      "",
      "let resp = client",
      "    .search(SearchParts::Index(&[\"products\"]))     // alias, không phải products_v4",
      "    .body(json!({",
      "        \"size\": 20,",
      "        \"_source\": [\"sku\", \"name\", \"price\"],",
      "        \"query\": { \"bool\": {",
      "            \"must\":   [ { \"multi_match\": { \"query\": q, \"fields\": [\"name^3\", \"name.folded\"] } } ],",
      "            \"filter\": [ { \"term\": { \"status\": \"ACTIVE\" } } ] } }",
      "    }))",
      "    .send().await?",
      "    .error_for_status_code()?;                     // 4xx/5xx → Err",
      "let body: SearchResp<Product> = resp.json().await?;"
    ]},
    { id: "bulk", label: "③ Bulk & lỗi item", lines: [
      "use elasticsearch::{BulkOperation, BulkParts, params::VersionType};",
      "",
      "let ops: Vec<BulkOperation<Product>> = products.into_iter().map(|p| {",
      "    let (id, ver) = (p.sku.clone(), p.row_version);",
      "    BulkOperation::index(p).id(id).version(ver).version_type(VersionType::External).into()",
      "}).collect();",
      "",
      "let resp = client.bulk(BulkParts::Index(\"products\")).body(ops).send().await?;",
      "let status = resp.status_code();                 // 429 → retry cả lô có backoff",
      "let v: serde_json::Value = resp.json().await?;",
      "if v[\"errors\"].as_bool() == Some(true) {",
      "    for item in v[\"items\"].as_array().unwrap() {",
      "        let r = &item[\"index\"];",
      "        match r[\"status\"].as_u64() {",
      "            Some(409) => {}                              // bản cũ hơn, bỏ qua",
      "            Some(429) => retry_later(r[\"_id\"].as_str()),",
      "            _ if r.get(\"error\").is_some() => dead_letter(r),",
      "            _ => {}",
      "        }",
      "    }",
      "}"
    ]},
    { id: "os", label: "④ Admin & OpenSearch", lines: [
      "// tạo index từ file mapping trong repo",
      "let mapping: Value = serde_json::from_str(include_str!(\"../mappings/products_v5.json\"))?;",
      "client.indices().create(IndicesCreateParts::Index(\"products_v5\"))",
      "    .body(mapping).send().await?.error_for_status_code()?;",
      "",
      "// swap alias nguyên tử",
      "client.indices().update_aliases().body(json!({ \"actions\": [",
      "    { \"remove\": { \"index\": \"products_v4\", \"alias\": \"products\" } },",
      "    { \"add\":    { \"index\": \"products_v5\", \"alias\": \"products\" } } ] }))",
      "    .send().await?.error_for_status_code()?;",
      "",
      "// OpenSearch: crate opensearch, API gần như y hệt",
      "use opensearch::{OpenSearch, SearchParts};"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">🦀 axum handler</div><div class="ns">State(client: Elasticsearch)</div></div>
    <div class="arrow" id="a1">↓ builder: SearchParts + body(json!) + send()</div>
    <div class="node" id="tr"><div class="nl">🚚 Transport</div><div class="ns">pool · ApiKey · timeout 5s · TLS</div></div>
    <div class="arrow" id="a2">↓ HTTP</div>
    <div class="node" id="es"><div class="nl">🔎 Elasticsearch</div><div class="ns">200 / 4xx / 5xx</div></div>
    <div class="arrow" id="a3">↓ Ok(Response) kể cả khi 4xx!</div>
    <div class="node" id="chk"><div class="nl">✅ error_for_status_code + serde</div><div class="ns">bulk: đọc errors & items</div></div>
  `,
  steps: [
    { title: "1 · Ghim phiên bản crate", tab: "setup", highlight: [3], on: ["app"],
      desc: "Crate vẫn gắn nhãn alpha; major phải khớp với cụm." },
    { title: "2 · Một client, cấu hình đủ", tab: "setup", highlight: [13, 14, 15, 16, 18], on: ["tr", "a2"],
      desc: "API key, timeout. Tạo một lần, đưa vào state của app." },
    { title: "3 · Query DSL là JSON", tab: "search", highlight: [7, 8, 11, 12, 13], on: ["a1", "es"],
      desc: "Không có builder có kiểu cho query; dùng json! với đúng kiến thức các bài trước." },
    { title: "4 · 4xx không phải Err", tab: "search", highlight: [15, 16, 17], on: ["a3", "chk"],
      desc: "error_for_status_code biến 4xx/5xx thành Err; serde parse hits thành struct." },
    { title: "5 · Bulk với external version", tab: "bulk", highlight: [5, 8, 11, 15, 16, 17], on: ["chk"],
      desc: "Phân loại lỗi từng item: 409 bỏ qua, 429 retry, còn lại dead-letter." },
    { title: "6 · Admin & đổi sang OpenSearch", tab: "os", highlight: [2, 3, 7, 13], on: ["es"],
      desc: "Mapping từ file trong repo, swap alias bằng code. OpenSearch: đổi crate." }
  ],

  quiz: [
    { q: "client.search(...).send().await trả Ok khi ES trả 404. Đúng không?", options: [
        "Sai, 404 là Err",
        "Đúng — Err chỉ cho lỗi transport; phải kiểm tra status_code hoặc error_for_status_code",
        "Chỉ đúng với bulk",
        "Tuỳ cấu hình"
      ], correct: 1, explanation: "Bẫy phổ biến nhất khi mới dùng crate." },
    { q: "Crate elasticsearch có kiểu Rust cho Query DSL không?", options: [
        "Có, đầy đủ",
        "Không — body là serde_json::Value hoặc struct serde; viết query bằng json!",
        "Chỉ cho match",
        "Chỉ cho aggregation"
      ], correct: 1, explanation: "Kiến thức Query DSL dùng nguyên văn." },
    { q: "Nên tạo Elasticsearch client thế nào trong service axum?", options: [
        "Mỗi request một client",
        "Một lần lúc khởi động, clone/chia sẻ qua state",
        "Mỗi thread một client",
        "Tạo trong mỗi handler"
      ], correct: 1, explanation: "Client giữ connection pool; clone rẻ." },
    { q: "SearchParts::Index(&[\"products\"]) quyết định gì?", options: [
        "Query string", "Đường dẫn URL: /products/_search", "Body", "Header"
      ], correct: 1, explanation: "*Parts enum chọn biến thể đường dẫn của endpoint." },
    { q: "Credentials nào hợp cho service production?", options: [
        "Basic với user elastic",
        "EncodedApiKey/ApiKey với role tối thiểu",
        "Không auth",
        "Bearer token người dùng cuối"
      ], correct: 1, explanation: "Bài 21." },
    { q: "Vì sao phải ghim chính xác phiên bản crate?", options: [
        "Cargo bắt buộc",
        "Crate vẫn alpha, API có thể đổi giữa các bản; major phải khớp cụm",
        "Để build nhanh",
        "Không cần"
      ], correct: 1, explanation: "Dùng '=' trong Cargo.toml." },
    { q: "Dùng cụm Amazon OpenSearch Service từ Rust?", options: [
        "Crate elasticsearch",
        "Crate opensearch (có feature ký SigV4 cho AWS)",
        "Không có client",
        "Chỉ qua curl"
      ], correct: 1, explanation: "Hai client tách riêng theo hãng." },
    { q: "Bulk response 200, errors: true, một item status 409 khi dùng external version. Xử lý?", options: [
        "Retry mãi",
        "Bỏ qua: ES đã có bản mới hơn",
        "Dừng indexer",
        "Xoá document"
      ], correct: 1, explanation: "Đúng thiết kế idempotent của bài 17." },
    { q: "Trong code, search nên nhắm vào tên nào?", options: [
        "products_v4", "Alias products", "_all", ".ds-products"
      ], correct: 1, explanation: "Để reindex/swap không cần deploy lại." }
  ]
});
