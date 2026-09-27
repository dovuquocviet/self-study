/* ---- Favicon emoji: hiện logo trên tab trình duyệt (như Zalo có logo riêng) ---- */
(function () {
  try {
    var e = "🎓";
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<text x="50" y="54" font-size="80" text-anchor="middle" dominant-baseline="central">' + e + '</text></svg>';
    var link = document.querySelector('link[rel~="icon"]');
    if (!link) { link = document.createElement("link"); link.setAttribute("rel", "icon"); (document.head || document.documentElement).appendChild(link); }
    link.setAttribute("type", "image/svg+xml");
    link.setAttribute("href", "data:image/svg+xml," + encodeURIComponent(svg));
  } catch (_) {}
})();

/* =========================================================
   Parent page — tổng hợp mọi khoá học + tiến độ từng khoá.
   Đọc localStorage của từng course (cùng origin file://) để
   dựng progress bar. Sở hữu light/dark theme (key: study-theme).
   ========================================================= */
(function () {
  "use strict";

  // Cấu hình các khoá. `key` = key tiến độ localStorage của course đó,
  // `total` = tổng số bài/pattern. Tiến độ lưu dạng { [id]: { done: bool } }.
  var COURSES = [
    { emoji: "🌱", title: "Spring Internals",
      sub: "Mổ xẻ cơ chế bên trong Spring: ai tạo bean, tạo thế nào, thứ tự gì.",
      accent: "#6db33f", href: "spring-internals/index.html",
      key: "spring-internals-progress-v1", total: 13 },
    { emoji: "🎨", title: "Design Patterns",
      sub: "23 pattern GoF kinh điển + 16 pattern hiện đại, minh hoạ động.",
      accent: "#ffb454", href: "design-pattern/index.html",
      key: "dp_progress_v1", total: 39 },
    { emoji: "⚛️", title: "React Native cho dân Java backend",
      sub: "JSX · hooks · state — code chạy & sửa được như Expo Snack.",
      accent: "#61dafb", href: "react-native-course/index.html",
      key: "rn_course_progress", total: 20 },
    { emoji: "🛠️", title: "React Native — Thực hành",
      sub: "Tìm lỗi trong code, viết bổ sung code — chạy & chấm ngay trong trình duyệt.",
      accent: "#818cf8", href: "react-native-practice/index.html",
      key: "rn_practice_progress", total: 18 },
    { emoji: "🖥️", title: "Nhập môn Hệ điều hành",
      sub: "Ai quản lý CPU, bộ nhớ, tiến trình và file — và quản lý thế nào.",
      accent: "#a855f7", href: "os-course/index.html",
      key: "os-progress-v1", total: 12 },
    { emoji: "🌐", title: "Nhập môn Mạng máy tính",
      sub: "Gói tin đi từ máy bạn tới server thế nào — từ sợi cáp tới HTTPS.",
      accent: "#3b82f6", href: "networking-course/index.html",
      key: "networking-progress-v1", total: 12 },
    { emoji: "🐚", title: "Shell / Dòng lệnh",
      sub: "Nói chuyện trực tiếp với máy tính bằng dòng lệnh.",
      accent: "#10b981", href: "shell-course/index.html",
      key: "shell-progress-v1", total: 12 },
    { emoji: "🦊", title: "Nhập môn GitLab CI/CD",
      sub: "Mỗi lần git push, để máy tự build – test – deploy thay bạn.",
      accent: "#fc6d26", href: "gitlabci-course/index.html",
      key: "gitlabci-progress-v1", total: 12 },
    { emoji: "🔐", title: "Nhập môn Auth: Authentication & Authorization",
      sub: "Session · Bearer token · OAuth 2 · PKCE · SSO · Login with code.",
      accent: "#f43f5e", href: "auth-course/index.html",
      key: "auth-progress-v1", total: 12 },
    { emoji: "🗝️", title: "Auth nâng cao: OAuth 1.0a, OAuth 2.x & chuẩn hiện đại",
      sub: "4 chuỗi của OAuth 1 · PKCE · OIDC · JWT/JWKS · DPoP · PAR · FAPI · Passkeys.",
      accent: "#db2777", href: "auth-advanced-course/index.html",
      key: "authadv-progress-v1", total: 16 },
    // `logo` (tuỳ chọn): dùng file ảnh thay emoji — ở đây là logo GraphQL chính chủ
    { emoji: "💠", logo: "graphql-course/logo.svg", title: "Nhập môn GraphQL",
      sub: "Client tự gọi món: schema · resolver · DataLoader · cache.",
      accent: "#e10098", href: "graphql-course/index.html",
      key: "graphql-progress-v1", total: 14 },
    { emoji: "🛡️", title: "An toàn bảo mật khi code Backend",
      sub: "Injection · phân quyền · SSRF · secret · mật mã — không phụ thuộc ngôn ngữ.",
      accent: "#ef4444", href: "secure-backend-course/index.html",
      key: "secbackend-progress-v1", total: 27 },
    { emoji: "📱", title: "An toàn bảo mật khi code Mobile",
      sub: "Lưu trữ · mạng · token · deep link · WebView — Android, iOS, RN, Flutter.",
      accent: "#06b6d4", href: "secure-mobile-course/index.html",
      key: "secmobile-progress-v1", total: 23 },
    { emoji: "🗄️", title: "An toàn bảo mật cho Database",
      sub: "PostgreSQL · Redis · Kafka · ClickHouse · MongoDB · Cloudflare D1/KV/R2.",
      accent: "#f59e0b", href: "secure-db-course/index.html",
      key: "secdb-progress-v1", total: 24 },
    { emoji: "🦀", title: "Nhập môn Rust cho dev Java",
      sub: "Ownership, borrow, trait, async, axum + sqlx — đối chiếu Java/Spring",
      accent: "#dea584", href: "rust-course/index.html",
      key: "rust-progress-v1", total: 21 },
    { emoji: "⚙️", title: "Rust nâng cao cho backend",
      sub: "Lifetime · trait · async sâu · Tokio · concurrency · axum/sqlx · tracing · UniFFI · WASM",
      accent: "#ea580c", href: "rust-advanced-course/index.html",
      key: "rustadv-progress-v1", total: 21 },
    { emoji: "☁️", title: "Nhập môn Cloudflare Workers",
      sub: "Serverless ở edge: isolate, wrangler, bindings, Rust/WASM",
      accent: "#f38020", href: "cf-workers-course/index.html",
      key: "cfworkers-progress-v1", total: 20 },
    { emoji: "🌩️", title: "Kiến trúc serverless trên Cloudflare",
      sub: "Durable Objects, Queues, Workflows, D1/KV/R2/Hyperdrive, chi phí & pattern",
      accent: "#eab308", href: "serverless-arch-course/index.html",
      key: "serverless-progress-v1", total: 20 },
    { emoji: "🏗️", title: "System design cho microservice & serverless",
      sub: "Thiết kế hệ thống: Rust service, Kafka, Workers, read model",
      accent: "#6366f1", href: "system-design-course/index.html",
      key: "sysdesign-progress-v1", total: 24 },
    { emoji: "🧬", title: "Database internals đa mô hình",
      sub: "Page, WAL, B-tree/LSM, MVCC, cột, inverted index, log — cơ chế dưới 6 DB",
      accent: "#84cc16", href: "db-internals-course/index.html",
      key: "dbinternals-progress-v1", total: 21 },
    { emoji: "🐘", title: "PostgreSQL chuyên sâu",
      sub: "Cơ chế bên trong & vận hành production: MVCC, index, planner, lock, replication",
      accent: "#336791", href: "postgres-deep-course/index.html",
      key: "pgdeep-progress-v1", total: 24 },
    { emoji: "📨", title: "Kafka chuyên sâu",
      sub: "Log phân tán, replication, producer/consumer, exactly-once, vận hành & Kafka→ClickHouse",
      accent: "#8b5cf6", href: "kafka-deep-course/index.html",
      key: "kafkadeep-progress-v1", total: 23 },
    { emoji: "🟨", title: "ClickHouse chuyên sâu",
      sub: "MergeTree, họ engine, ingest Kafka, MV, cluster & tối ưu",
      accent: "#facc15", href: "clickhouse-deep-course/index.html",
      key: "chdeep-progress-v1", total: 23 },
    { emoji: "🟥", title: "Redis chuyên sâu",
      sub: "Event loop, encoding, persistence, Cluster và pattern thực chiến",
      accent: "#dc382d", href: "redis-deep-course/index.html",
      key: "redisdeep-progress-v1", total: 25 },
    { emoji: "🔎", title: "Elasticsearch chuyên sâu",
      sub: "Kiến trúc, mapping, analyzer tiếng Việt, relevance, đồng bộ từ DB & vận hành",
      accent: "#00bfb3", href: "elastic-deep-course/index.html",
      key: "esdeep-progress-v1", total: 23 },
    { emoji: "📲", title: "Nền tảng Mobile native: app chạy thế nào bên dưới",
      sub: "OS, vòng đời, main thread, rendering, bộ nhớ, RN vs native, push, build & phát hành",
      accent: "#22c55e", href: "mobile-native-course/index.html",
      key: "mobilenative-progress-v1", total: 22 },
    { emoji: "🚀", title: "Mobile performance: đo, tìm và sửa",
      sub: "Đo trước khi sửa · startup · jank · memory · mạng · size · RN vs native",
      accent: "#14b8a6", href: "mobile-perf-course/index.html",
      key: "mobileperf-progress-v1", total: 21 },
    { emoji: "🟣", title: "Nhập môn Kotlin & Jetpack Compose (cho dev Java)",
      sub: "Kotlin, coroutines & Compose cho dev Java/Spring",
      accent: "#7f52ff", href: "kotlin-compose-course/index.html",
      key: "kotlin-progress-v1", total: 26 }
  ];

  // Đếm số bài đã hoàn thành từ object tiến độ của course.
  function doneCount(key) {
    try {
      var obj = JSON.parse(localStorage.getItem(key)) || {};
      var n = 0;
      Object.keys(obj).forEach(function (k) {
        if (obj[k] && obj[k].done) n++;
      });
      return n;
    } catch (e) { return 0; }
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function render() {
    var grid = document.getElementById("courseGrid");
    if (!grid) return;
    grid.innerHTML = COURSES.map(function (c) {
      var done = Math.min(doneCount(c.key), c.total);
      var pct = c.total ? Math.round(done / c.total * 100) : 0;
      var state = done >= c.total && c.total > 0 ? "done"
                : done > 0 ? "started" : "";
      var statusLabel = state === "done" ? "✓ Hoàn thành"
                      : state === "started" ? "Đang học" : "Chưa bắt đầu";
      // course nào khai `logo` thì hiện ảnh thật, còn lại vẫn dùng emoji
      var icon = c.logo ? '<img src="' + c.logo + '" alt="" />' : c.emoji;
      return '' +
        '<a class="course-card ' + state + '" href="' + c.href + '" style="--c:' + c.accent + '">' +
          '<div class="cc-top">' +
            '<span class="cc-emoji">' + icon + '</span>' +
            '<span class="cc-status">' + statusLabel + '</span>' +
          '</div>' +
          '<h2 class="cc-title">' + esc(c.title) + '</h2>' +
          '<p class="cc-sub">' + esc(c.sub) + '</p>' +
          '<div class="cc-foot">' +
            '<div class="cc-prog"><div class="cc-fill" style="width:' + pct + '%"></div></div>' +
            '<div class="cc-meta">' +
              '<span class="cc-count">' + done + '/' + c.total + ' bài · ' + pct + '%</span>' +
              '<span class="cc-cta">Vào học →</span>' +
            '</div>' +
          '</div>' +
        '</a>';
    }).join("");
  }

  /* ---------- theme (dùng chung: study-theme) ---------- */
  var TKEY = "study-theme";
  function currentTheme() {
    try { return localStorage.getItem(TKEY) || "dark"; } catch (e) { return "dark"; }
  }
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem(TKEY, t); } catch (e) {}
    var btn = document.getElementById("themeToggle");
    if (btn) btn.textContent = t === "dark" ? "☀️" : "🌙";
  }
  function setupTheme() {
    applyTheme(currentTheme());
    var btn = document.getElementById("themeToggle");
    if (btn) btn.addEventListener("click", function () {
      applyTheme(currentTheme() === "dark" ? "light" : "dark");
    });
  }

  // Cập nhật lại tiến độ khi quay lại tab (vừa học xong 1 course rồi back về).
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) render();
  });
  window.addEventListener("pageshow", render);

  render();
  setupTheme();
})();

/* --- Đồng bộ tiến độ đa thiết bị (Supabase) — nạp sync.js một lần --- */
(function(){try{if(!window.__studySyncLoad){window.__studySyncLoad=1;var s=document.createElement("script");s.src="/sync.js";document.head.appendChild(s);}}catch(e){}})();
