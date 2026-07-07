/* ============================================================
   sync.js — Đồng bộ tiến độ học lên Supabase (đa thiết bị, đa người dùng)
   ------------------------------------------------------------
   - Đăng nhập bằng magic-link (email, không mật khẩu).
   - Tiến độ vẫn lưu localStorage như cũ (cache offline); file này
     mirror mọi thay đổi lên Supabase và kéo về khi mở máy khác.
   - KHÔNG backend riêng: gọi thẳng Supabase, bảo mật bằng RLS.
   - Nạp 1 lần trên mọi trang qua loader trong app.js/common.js/learn.js.
   ============================================================ */
(function () {
  "use strict";
  if (window.__studySync) return;            // chống nạp trùng
  window.__studySync = true;

  var SUPABASE_URL = "https://icvdxitywtkzbqcxnvdc.supabase.co";
  var SUPABASE_KEY = "sb_publishable_bxcZGquuPk51GQJyafBmKg_CjJmyVK3";
  var SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

  // Bắt buộc đăng nhập mới vào được app: che toàn trang bằng lớp phủ (gate)
  // cho tới khi có phiên đăng nhập. Đặt false để quay lại chế độ tuỳ chọn.
  var REQUIRE_LOGIN = true;

  // localStorage key  ->  course_slug (khoá trong bảng progress)
  var PROGRESS_KEYS = {
    "spring-internals-progress-v1": "spring-internals",
    "dp_progress_v1":               "design-pattern",
    "rn_course_progress":           "react-native",
    "os-progress-v1":               "os",
    "networking-progress-v1":       "networking",
    "shell-progress-v1":            "shell"
  };

  // Bản gốc của localStorage (dùng khi ghi từ đám mây để không kích lại push)
  var origSet = localStorage.setItem.bind(localStorage);
  var origRemove = localStorage.removeItem.bind(localStorage);

  var client = null;
  var session = null;
  var suppressPush = false;                    // true khi đang hydrate từ cloud
  var pushTimers = {};                         // debounce push theo từng key

  /* ---------- tiện ích ---------- */
  function readLS(k) {
    try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; }
  }
  function writeLS(k, obj) { try { origSet(k, JSON.stringify(obj)); } catch (e) {} }

  // So sánh 2 object không phụ thuộc thứ tự key
  function canon(o) {
    if (o && typeof o === "object" && !Array.isArray(o)) {
      return Object.keys(o).sort().reduce(function (a, k) { a[k] = canon(o[k]); return a; }, {});
    }
    return o;
  }
  function same(a, b) { return JSON.stringify(canon(a)) === JSON.stringify(canon(b)); }

  // Gộp tiến độ: không bao giờ làm mất dữ liệu (done = OR, answers = hợp).
  function mergeProgress(a, b) {
    a = a || {}; b = b || {};
    var out = {}, ids = {};
    Object.keys(a).forEach(function (k) { ids[k] = 1; });
    Object.keys(b).forEach(function (k) { ids[k] = 1; });
    Object.keys(ids).forEach(function (id) {
      var ra = a[id] || {}, rb = b[id] || {}, rec = {};
      if (ra.done || rb.done) rec.done = true;
      var ans = {}, aa = ra.answers || {}, ab = rb.answers || {};
      Object.keys(ab).forEach(function (q) { ans[q] = ab[q]; });
      Object.keys(aa).forEach(function (q) { ans[q] = aa[q]; }); // local thắng khi trùng
      if (Object.keys(ans).length) rec.answers = ans;
      // giữ mọi field khác (vd cột tự thêm sau này)
      Object.keys(rb).forEach(function (f) { if (f !== "done" && f !== "answers" && rec[f] === undefined) rec[f] = rb[f]; });
      Object.keys(ra).forEach(function (f) { if (f !== "done" && f !== "answers") rec[f] = ra[f]; });
      out[id] = rec;
    });
    return out;
  }

  /* ---------- ghi lên đám mây ---------- */
  function schedulePush(lsKey) {
    if (!session) return;
    clearTimeout(pushTimers[lsKey]);
    pushTimers[lsKey] = setTimeout(function () { pushKey(lsKey); }, 600);
  }
  function pushKey(lsKey) {
    if (!session || !client) return;
    var slug = PROGRESS_KEYS[lsKey];
    client.from("progress").upsert({
      user_id: session.user.id,
      course_slug: slug,
      data: readLS(lsKey),
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,course_slug" }).then(function (r) {
      if (r.error) console.warn("[sync] push lỗi", slug, r.error.message);
    });
  }
  function deleteKey(lsKey) {
    if (!session || !client) return;
    var slug = PROGRESS_KEYS[lsKey];
    client.from("progress").delete()
      .eq("user_id", session.user.id).eq("course_slug", slug)
      .then(function (r) { if (r.error) console.warn("[sync] xoá lỗi", slug, r.error.message); });
  }

  // Chặn ghi localStorage -> tự mirror lên cloud
  localStorage.setItem = function (k, v) {
    origSet(k, v);
    if (!suppressPush && PROGRESS_KEYS.hasOwnProperty(k)) schedulePush(k);
  };
  localStorage.removeItem = function (k) {
    origRemove(k);
    if (!suppressPush && PROGRESS_KEYS.hasOwnProperty(k)) deleteKey(k);
  };

  /* ---------- kéo về + gộp ---------- */
  function syncNow() {
    if (!session || !client) return;
    setStatus("syncing");
    client.from("progress").select("course_slug,data").then(function (res) {
      if (res.error) { setStatus("error", res.error.message); return; }
      var cloud = {};
      (res.data || []).forEach(function (r) { cloud[r.course_slug] = r.data || {}; });

      var changedLocal = false, toPush = [];
      Object.keys(PROGRESS_KEYS).forEach(function (lsKey) {
        var slug = PROGRESS_KEYS[lsKey];
        var hasLocal = localStorage.getItem(lsKey) !== null;
        var hasCloud = cloud.hasOwnProperty(slug);
        if (!hasLocal && !hasCloud) return;
        var local = readLS(lsKey), remote = cloud[slug] || {};
        var merged = mergeProgress(local, remote);
        if (!same(merged, local)) {
          suppressPush = true; writeLS(lsKey, merged); suppressPush = false;
          changedLocal = true;
        }
        if (!same(merged, remote)) {
          toPush.push({ user_id: session.user.id, course_slug: slug,
                        data: merged, updated_at: new Date().toISOString() });
        }
      });

      var done = function () {
        setStatus("synced");
        // Trang render lúc load từ localStorage cũ -> nếu vừa kéo dữ liệu mới,
        // reload 1 lần để hiển thị. same() + cờ chống lặp đảm bảo không loop.
        if (changedLocal && sessionStorage.getItem("ssync-reloaded") !== "1") {
          try { sessionStorage.setItem("ssync-reloaded", "1"); } catch (e) {}
          location.reload();
        } else {
          try { sessionStorage.removeItem("ssync-reloaded"); } catch (e) {}
        }
      };
      if (toPush.length) {
        client.from("progress").upsert(toPush, { onConflict: "user_id,course_slug" }).then(done);
      } else { done(); }
    });
  }

  /* ============================================================
     GIAO DIỆN TÀI KHOẢN (widget nổi góc dưới-phải)
     ============================================================ */
  var ui = {};
  var stylesDone = false;
  function ensureStyles() {
    if (stylesDone) return;
    stylesDone = true;
    var css = "" +
      ".ssync{position:fixed;right:14px;bottom:14px;z-index:99999;font:13px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}" +
      ".ssync-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:999px;border:1px solid rgba(128,128,128,.35);background:rgba(30,30,35,.92);color:#e7e7ea;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25);backdrop-filter:blur(6px)}" +
      "html[data-theme=light] .ssync-btn{background:rgba(255,255,255,.95);color:#222}" +
      ".ssync-btn:hover{border-color:rgba(128,128,128,.6)}" +
      ".ssync-dot{width:8px;height:8px;border-radius:50%;background:#888;flex:0 0 auto}" +
      ".ssync-dot.on{background:#22c55e}.ssync-dot.sync{background:#f59e0b}.ssync-dot.err{background:#ef4444}" +
      ".ssync-pop{position:absolute;right:0;bottom:46px;width:260px;padding:14px;border-radius:14px;border:1px solid rgba(128,128,128,.3);background:rgba(24,24,28,.98);color:#e7e7ea;box-shadow:0 10px 30px rgba(0,0,0,.4);display:none}" +
      "html[data-theme=light] .ssync-pop{background:#fff;color:#222}" +
      ".ssync-pop.open{display:block}" +
      ".ssync-pop h4{margin:0 0 8px;font-size:14px}" +
      ".ssync-pop p{margin:0 0 10px;color:#9a9aa2;font-size:12px}" +
      ".ssync-pop input{width:100%;box-sizing:border-box;padding:9px 10px;margin:0 0 10px;border-radius:9px;border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit;font-size:13px}" +
      ".ssync-pop button.act{width:100%;padding:9px;border:0;border-radius:9px;background:#3b82f6;color:#fff;cursor:pointer;font-size:13px}" +
      ".ssync-pop button.act:disabled{opacity:.6;cursor:default}" +
      ".ssync-pop button.link{background:none;border:0;color:#3b82f6;cursor:pointer;padding:0;font-size:12px}" +
      ".ssync-email{font-size:12px;color:#9a9aa2;margin:0 0 8px;word-break:break-all}" +
      // ----- lớp phủ chặn app khi chưa đăng nhập -----
      ".ssync-gate{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;background:#0e0e12;font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}" +
      "html[data-theme=light] .ssync-gate{background:#f4f5f7}" +
      ".ssync-gate-card{width:100%;max-width:360px;padding:28px 24px;border-radius:18px;border:1px solid rgba(128,128,128,.25);background:rgba(24,24,28,.98);color:#e7e7ea;box-shadow:0 20px 60px rgba(0,0,0,.4);text-align:center}" +
      "html[data-theme=light] .ssync-gate-card{background:#fff;color:#222}" +
      ".ssync-gate-card .logo{font-size:34px;margin-bottom:6px}" +
      ".ssync-gate-card h2{margin:0 0 6px;font-size:19px}" +
      ".ssync-gate-card p{margin:0 0 16px;color:#9a9aa2;font-size:13px}" +
      ".ssync-gate-card input{width:100%;box-sizing:border-box;padding:11px 12px;margin:0 0 12px;border-radius:11px;border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit;font-size:14px;text-align:center}" +
      ".ssync-gate-card button.act{width:100%;padding:11px;border:0;border-radius:11px;background:#3b82f6;color:#fff;cursor:pointer;font-size:14px;font-weight:600}" +
      ".ssync-gate-card button.act:disabled{opacity:.6;cursor:default}" +
      ".ssync-gate-card .spin{width:26px;height:26px;margin:8px auto;border-radius:50%;border:3px solid rgba(128,128,128,.3);border-top-color:#3b82f6;animation:ssyncspin .8s linear infinite}" +
      "@keyframes ssyncspin{to{transform:rotate(360deg)}}";
    var s = document.createElement("style");
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ---------- gửi magic-link (dùng chung gate + widget) ---------- */
  function sendMagicLink(email) {
    return client.auth.signInWithOtp({
      email: email,
      options: { emailRedirectTo: location.origin + location.pathname + location.search }
    });
  }

  /* ---------- GATE: lớp phủ bắt đăng nhập ---------- */
  function gateShow(state) {
    ensureStyles();
    var g = document.getElementById("ssyncGate");
    if (!g) {
      g = document.createElement("div");
      g.className = "ssync-gate";
      g.id = "ssyncGate";
      g.innerHTML = '<div class="ssync-gate-card" id="ssyncGateCard"></div>';
      (document.body || document.documentElement).appendChild(g);
    }
    g.style.display = "flex";
    gateRender(state || "loading");
  }
  function gateHide() {
    var g = document.getElementById("ssyncGate");
    if (g) g.style.display = "none";
  }
  function gateRender(state) {
    var card = document.getElementById("ssyncGateCard");
    if (!card) return;
    if (state === "loading") {
      card.innerHTML = '<div class="logo">🎓</div><h2>Tự học</h2>' +
        '<div class="spin"></div><p>Đang kiểm tra đăng nhập…</p>';
      return;
    }
    if (state === "error") {
      card.innerHTML = '<div class="logo">⚠️</div><h2>Không kết nối được</h2>' +
        '<p>Không tải được dịch vụ đăng nhập. Kiểm tra mạng rồi thử lại.</p>' +
        '<button class="act" onclick="location.reload()">Thử lại</button>';
      return;
    }
    // state === "login"
    card.innerHTML =
      '<div class="logo">🎓</div><h2>Đăng nhập để học</h2>' +
      '<p>Nhập email để nhận link đăng nhập. Không cần mật khẩu.</p>' +
      '<input type="email" id="ssyncGateEmail" placeholder="ban@email.com" autocomplete="email" />' +
      '<button class="act" id="ssyncGateSend">Gửi link đăng nhập</button>';
    var send = document.getElementById("ssyncGateSend");
    var inp = document.getElementById("ssyncGateEmail");
    inp.focus();
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") send.click(); });
    send.onclick = function () {
      var email = (inp.value || "").trim();
      if (!email || email.indexOf("@") < 0) { inp.focus(); return; }
      send.disabled = true; send.textContent = "Đang gửi…";
      sendMagicLink(email).then(function (r) {
        if (r.error) {
          card.innerHTML = '<div class="logo">⚠️</div><h2>Không gửi được</h2><p>' +
            esc(r.error.message) + '</p><button class="act" id="ssyncGateBack">Thử lại</button>';
          document.getElementById("ssyncGateBack").onclick = function () { gateRender("login"); };
        } else {
          card.innerHTML = '<div class="logo">📬</div><h2>Kiểm tra email</h2>' +
            '<p>Đã gửi link đăng nhập tới <b>' + esc(email) + '</b>.<br>Mở email và bấm vào link để vào học.</p>';
        }
      });
    };
  }

  function buildUI() {
    ensureStyles();
    var wrap = document.createElement("div");
    wrap.className = "ssync";
    wrap.innerHTML =
      '<div class="ssync-pop" id="ssyncPop"></div>' +
      '<button class="ssync-btn" id="ssyncBtn"><span class="ssync-dot" id="ssyncDot"></span><span id="ssyncLabel">Đồng bộ</span></button>';
    document.body.appendChild(wrap);
    ui.btn = document.getElementById("ssyncBtn");
    ui.dot = document.getElementById("ssyncDot");
    ui.label = document.getElementById("ssyncLabel");
    ui.pop = document.getElementById("ssyncPop");
    ui.btn.addEventListener("click", function (e) {
      e.stopPropagation();
      ui.pop.classList.toggle("open");
      renderPop();
    });
    document.addEventListener("click", function (e) {
      if (ui.pop.classList.contains("open") && !ui.pop.contains(e.target) && e.target !== ui.btn)
        ui.pop.classList.remove("open");
    });
  }

  var statusText = "signedout", statusMsg = "";
  function setStatus(s, msg) {
    statusText = s; statusMsg = msg || "";
    if (!ui.dot) return;
    ui.dot.className = "ssync-dot" +
      (s === "synced" ? " on" : s === "syncing" ? " sync" : s === "error" ? " err" : "");
    ui.label.textContent =
      s === "syncing" ? "Đang đồng bộ…" :
      s === "synced"  ? "Đã đồng bộ" :
      s === "error"   ? "Lỗi đồng bộ" :
      session ? "Đã đăng nhập" : "Đăng nhập";
    if (ui.pop.classList.contains("open")) renderPop();
  }

  function renderPop() {
    if (!ui.pop) return;
    if (session) {
      ui.pop.innerHTML =
        '<h4>Đã đăng nhập</h4>' +
        '<div class="ssync-email">' + (session.user.email || "") + '</div>' +
        '<p>Tiến độ của bạn được đồng bộ tự động trên mọi thiết bị.</p>' +
        '<button class="link" id="ssyncOut">Đăng xuất</button>';
      document.getElementById("ssyncOut").onclick = signOut;
    } else {
      ui.pop.innerHTML =
        '<h4>Đồng bộ tiến độ</h4>' +
        '<p>Nhập email để nhận link đăng nhập. Không cần mật khẩu.</p>' +
        '<input type="email" id="ssyncEmail" placeholder="ban@email.com" autocomplete="email" />' +
        '<button class="act" id="ssyncSend">Gửi link đăng nhập</button>';
      var send = document.getElementById("ssyncSend");
      var inp = document.getElementById("ssyncEmail");
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") send.click(); });
      send.onclick = function () {
        var email = (inp.value || "").trim();
        if (!email || email.indexOf("@") < 0) { inp.focus(); return; }
        send.disabled = true; send.textContent = "Đang gửi…";
        sendMagicLink(email).then(function (r) {
          if (r.error) {
            ui.pop.innerHTML = '<h4>Không gửi được</h4><p>' + esc(r.error.message) + '</p>';
          } else {
            ui.pop.innerHTML = '<h4>Kiểm tra email 📬</h4><p>Đã gửi link đăng nhập tới <b>' +
              esc(email) + '</b>. Mở email và bấm vào link để đăng nhập.</p>';
          }
        });
      };
    }
  }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function signOut() {
    if (!client) return;
    client.auth.signOut().then(function () {
      session = null;
      setStatus("signedout");
      if (ui.pop) ui.pop.classList.remove("open");
      if (REQUIRE_LOGIN) gateShow("login");
    });
  }

  /* ---------- khởi động ---------- */
  function boot() {
    buildUI();
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    client.auth.getSession().then(function (r) {
      session = (r.data && r.data.session) || null;
      if (session) { gateHide(); setStatus("synced"); syncNow(); }
      else { setStatus("signedout"); if (REQUIRE_LOGIN) gateShow("login"); }
    });
    client.auth.onAuthStateChange(function (event, s) {
      session = s || null;
      if (session) { gateHide(); setStatus("synced"); syncNow(); }
      else if (event === "SIGNED_OUT") { setStatus("signedout"); if (REQUIRE_LOGIN) gateShow("login"); }
    });
    window.StudySync = { syncNow: syncNow, signOut: signOut, client: function () { return client; } };
  }

  // Nạp SDK Supabase rồi khởi động
  function loadSDK(cb) {
    if (window.supabase && window.supabase.createClient) return cb();
    var s = document.createElement("script");
    s.src = SDK_URL;
    s.onload = cb;
    s.onerror = function () { if (REQUIRE_LOGIN) gateShow("error"); console.warn("[sync] không tải được Supabase SDK"); };
    document.head.appendChild(s);
  }

  function start() {
    if (REQUIRE_LOGIN) gateShow("loading");   // che nội dung ngay, trước khi biết trạng thái
    loadSDK(boot);
  }
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})();
