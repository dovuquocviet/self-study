/* ---- Favicon emoji ---- */
(function () {
  try {
    var e = "🛠️";
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<text x="50" y="54" font-size="80" text-anchor="middle" dominant-baseline="central">' + e + '</text></svg>';
    var link = document.querySelector('link[rel~="icon"]');
    if (!link) { link = document.createElement("link"); link.setAttribute("rel", "icon"); (document.head || document.documentElement).appendChild(link); }
    link.setAttribute("type", "image/svg+xml");
    link.setAttribute("href", "data:image/svg+xml," + encodeURIComponent(svg));
  } catch (_) {}
})();

/* ========================================================================
 * app.js — khoá THỰC HÀNH React Native.
 * Khác khoá lý thuyết: không có quiz. Điều kiện hoàn thành = qua hết `checks`
 * do runtime.js chấm sau khi chạy code.
 * Dữ liệu bài nằm ở window.EXERCISES (data.js).
 * ======================================================================== */
(function () {
  "use strict";
  var LESSONS = window.EXERCISES || [];
  var PKEY = "rn_practice_progress";        // tiến độ (được sync.js đồng bộ)
  var CKEY = "rn_practice_code_";           // code người học tự lưu (chỉ ở máy này)
  var TKEY = "study-theme";

  /* ---------- theme ---------- */
  function isLight() { return document.documentElement.getAttribute("data-theme") === "light"; }
  function applyTheme(t) {
    if (t === "light") document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");
    try { localStorage.setItem(TKEY, t); } catch (e) {}
    var btn = byId("themeToggle");
    if (btn) btn.textContent = (t === "light") ? "☀️" : "🌙";
  }
  function initTheme() {
    var t = "dark";
    try { t = localStorage.getItem(TKEY) || "dark"; } catch (e) {}
    applyTheme(t);
    var btn = byId("themeToggle");
    if (btn) btn.onclick = function () { applyTheme(isLight() ? "dark" : "light"); };
  }

  /* ---------- tiến độ ---------- */
  function loadProgress() { try { return JSON.parse(localStorage.getItem(PKEY)) || {}; } catch (e) { return {}; } }
  function saveProgress(p) { try { localStorage.setItem(PKEY, JSON.stringify(p)); } catch (e) {} }
  function isDone(p, ls) { return !!(p[ls.id] && p[ls.id].done); }
  function loadCode(id) { try { return localStorage.getItem(CKEY + id); } catch (e) { return null; } }
  function saveCode(id, code) { try { localStorage.setItem(CKEY + id, code); } catch (e) {} }

  /* ---------- helper ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function byId(id) { return document.getElementById(id); }
  function lessonById(id) { for (var i = 0; i < LESSONS.length; i++) if (LESSONS[i].id === id) return LESSONS[i]; return null; }
  function kindLabel(k) { return k === "fill" ? "Viết bổ sung" : "Tìm & sửa lỗi"; }

  /* ==================================================================
   *  TRANG DANH SÁCH BÀI
   * ================================================================== */
  function renderHome() {
    var listEl = byId("lessonList");
    if (!listEl) return;
    var p = loadProgress(), done = 0;

    var phases = [], byPhase = {};
    LESSONS.forEach(function (ls) {
      if (!byPhase[ls.phase]) { byPhase[ls.phase] = []; phases.push(ls.phase); }
      byPhase[ls.phase].push(ls);
      if (isDone(p, ls)) done++;
    });

    var html = "", n = 0;
    phases.forEach(function (ph) {
      html += '<div class="phase-title">' + esc(byPhase[ph][0].phaseName || ("Phase " + ph)) + "</div>";
      byPhase[ph].forEach(function (ls) {
        n++;
        var d = isDone(p, ls);
        html += '<a class="card ' + (d ? "done" : "") + '" href="lesson.html?id=' + ls.id + '">' +
          '<div class="mark">' + (d ? "✓" : n) + "</div>" +
          '<div class="c-body">' +
            '<div class="c-title">' + esc(ls.title) + "</div>" +
            '<div class="c-obj">' + esc(ls.objective || "") + "</div>" +
            '<div class="c-kind"><span class="kind ' + ls.kind + '">' + kindLabel(ls.kind) + "</span></div>" +
          "</div>" +
          '<div class="c-num">Bài ' + n + "</div></a>";
      });
    });
    listEl.innerHTML = html;

    var pct = LESSONS.length ? Math.round(done / LESSONS.length * 100) : 0;
    var f = byId("barFill"); if (f) f.style.width = pct + "%";
    var t = byId("progressText"); if (t) t.textContent = "Hoàn thành " + done + "/" + LESSONS.length + " bài (" + pct + "%)";
  }

  /* ==================================================================
   *  TRANG MỘT BÀI THỰC HÀNH
   * ================================================================== */
  function renderLesson() {
    var wrap = byId("lessonRoot");
    if (!wrap) return;
    var id = new URLSearchParams(location.search).get("id") || (LESSONS[0] && LESSONS[0].id);
    var ls = lessonById(id);
    if (!ls) { wrap.innerHTML = "<p>Không tìm thấy bài.</p>"; return; }
    var idx = LESSONS.indexOf(ls);
    updateCourseProgress();

    document.title = "Bài " + (idx + 1) + " · " + ls.title;
    byId("lessonTitle").textContent = "Bài " + (idx + 1) + " — " + ls.title;
    byId("lessonPhase").textContent = ls.phaseName || "";

    /* --- 1. Đề bài --- */
    byId("task").innerHTML =
      '<div><span class="kind ' + ls.kind + '">' + kindLabel(ls.kind) + "</span>" +
      '<b>' + esc(ls.objective || "") + "</b></div>" +
      (ls.brief || "") +
      (ls.goal ? '<div class="goal"><div class="goal-h">Kết quả mong đợi</div>' + ls.goal + "</div>" : "");

    /* --- 2. Code + chấm --- */
    var saved = loadCode(ls.id);
    var snack = window.Snack.mount(byId("snack"), (saved != null ? saved : ls.code.trim()), {
      title: ls.codeTitle || "App.js",
      checks: ls.checks || [],
      onChecks: function (st) { onChecks(ls, st); }
    });
    // lưu lại code sau mỗi lần chạy để lần sau quay lại không mất
    var origRun = snack.run;
    snack.run = function () { saveCode(ls.id, snack.getCode()); origRun(); };
    document.querySelector(".snack-run").onclick = snack.run;
    window.addEventListener("beforeunload", function () { saveCode(ls.id, snack.getCode()); });

    /* --- 3. nút hoàn thành --- */
    byId("btnDone").onclick = function () {
      var p = loadProgress();
      (p[ls.id] = p[ls.id] || {}).done = true;
      saveProgress(p);
      toast("✓ Đã hoàn thành bài này");
      var next = LESSONS[idx + 1];
      setTimeout(function () { location.href = next ? ("lesson.html?id=" + next.id) : "index.html"; }, 800);
    };
    if (isDone(loadProgress(), ls)) {
      byId("btnDone").disabled = false;
      byId("doneHint").textContent = "Bài này bạn đã hoàn thành trước đó.";
    }

    /* --- 4. gợi ý + đáp án --- */
    setupHelp(ls, snack);

    /* --- điều hướng --- */
    var prev = LESSONS[idx - 1], next = LESSONS[idx + 1];
    byId("prevLink").innerHTML = prev ? '<a href="lesson.html?id=' + prev.id + '">← Bài ' + idx + "</a>" : "";
    byId("nextLink").innerHTML = next ? '<a href="lesson.html?id=' + next.id + '">Bài ' + (idx + 2) + " →</a>" : '<a href="index.html">Về danh sách →</a>';
  }

  /* ---------- hiển thị kết quả chấm ---------- */
  function onChecks(ls, st) {
    var statusEl = byId("checksStatus"), listEl = byId("checkList");
    var checks = ls.checks || [];

    if (st.state === "running") {
      statusEl.className = "checks-status";
      statusEl.textContent = "Đang chạy code và kiểm tra…";
      listEl.innerHTML = checks.map(function (c) {
        return '<div class="check wait"><span class="ico">○</span><span>' + esc(c.label) + "</span></div>";
      }).join("");
      return;
    }
    if (st.state === "error") {
      statusEl.className = "checks-status fail";
      statusEl.textContent = "✗ " + st.message + " (mở phần Console & Stack trace ở trên để xem chi tiết)";
      listEl.innerHTML = checks.map(function (c) {
        return '<div class="check no"><span class="ico">✗</span><span>' + esc(c.label) + "</span></div>";
      }).join("");
      return;
    }

    var res = st.results || [];
    var passed = res.filter(function (r) { return r.ok; }).length;
    var all = res.length > 0 && passed === res.length;

    listEl.innerHTML = res.map(function (r) {
      return '<div class="check ' + (r.ok ? "ok" : "no") + '">' +
        '<span class="ico">' + (r.ok ? "✓" : "✗") + "</span>" +
        "<span>" + esc(r.label) +
        (!r.ok && r.detail ? '<span class="detail">' + esc(r.detail) + "</span>" : "") +
        "</span></div>";
    }).join("");

    statusEl.className = "checks-status " + (all ? "pass" : "fail");
    statusEl.textContent = all
      ? "✓ Qua hết " + passed + "/" + res.length + " mục kiểm tra — bài này xong!"
      : "Qua " + passed + "/" + res.length + " mục kiểm tra. Xem mục ✗ ở dưới rồi sửa tiếp.";

    var btn = byId("btnDone"), hint = byId("doneHint");
    if (all) {
      btn.disabled = false;
      hint.textContent = "Bấm để đánh dấu hoàn thành và sang bài sau.";
      // tự lưu là đã qua (kể cả khi không bấm nút)
      var p = loadProgress();
      (p[ls.id] = p[ls.id] || {}).done = true;
      saveProgress(p);
      updateCourseProgress();
    } else if (!isDone(loadProgress(), ls)) {
      btn.disabled = true;
      hint.textContent = "Qua hết các mục kiểm tra thì nút này mở.";
    }
  }

  /* ---------- gợi ý & đáp án ---------- */
  function setupHelp(ls, snack) {
    var shown = 0;
    var hints = ls.hints || [];
    var hintList = byId("hintList"), solBox = byId("solutionBox");
    var btnHint = byId("btnHint"), btnSol = byId("btnSolution");

    if (!hints.length) { btnHint.disabled = true; btnHint.textContent = "💡 Bài này không có gợi ý"; }
    btnHint.onclick = function () {
      if (shown >= hints.length) return;
      var d = document.createElement("div");
      d.className = "hint";
      d.innerHTML = '<span class="hint-n">Gợi ý ' + (shown + 1) + ":</span>" + hints[shown];
      hintList.appendChild(d);
      shown++;
      btnHint.textContent = shown >= hints.length ? "💡 Hết gợi ý" : "💡 Gợi ý tiếp (" + (hints.length - shown) + ")";
      if (shown >= hints.length) btnHint.disabled = true;
    };

    btnSol.onclick = function () {
      if (solBox.childNodes.length) { solBox.innerHTML = ""; btnSol.textContent = "👁 Xem đáp án"; return; }
      if (!confirm("Xem đáp án luôn? Thử bấm Gợi ý trước đã nhé.")) return;
      btnSol.textContent = "🙈 Ẩn đáp án";
      var box = document.createElement("div");
      box.className = "solution";
      var note = document.createElement("div");
      note.className = "sol-note";
      note.textContent = "Đáp án tham khảo (cách khác vẫn qua bài nếu chạy đúng):";
      box.appendChild(note);
      box.appendChild(window.CodeEditor.staticBlock(ls.solution.trim()));
      var apply = document.createElement("button");
      apply.className = "btn";
      apply.style.marginTop = "10px";
      apply.textContent = "⤵ Nạp đáp án vào editor";
      apply.onclick = function () {
        if (!confirm("Ghi đè code bạn đang viết bằng đáp án?")) return;
        snack.setCode(ls.solution.trim());
        snack.run();
      };
      box.appendChild(apply);
      if (ls.explain) {
        var ex = document.createElement("div");
        ex.className = "explainbox";
        ex.innerHTML = ls.explain;
        box.appendChild(ex);
      }
      solBox.appendChild(box);
    };
  }

  function toast(msg) {
    var t = document.createElement("div");
    t.className = "toast"; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 1600);
  }

  function updateCourseProgress() {
    var p = loadProgress(), done = 0;
    LESSONS.forEach(function (ls) { if (isDone(p, ls)) done++; });
    var pct = LESSONS.length ? Math.round(done / LESSONS.length * 100) : 0;
    var f = byId("courseBarFill"); if (f) f.style.width = pct + "%";
    var t = byId("courseProgressText"); if (t) t.textContent = done + "/" + LESSONS.length + " bài (" + pct + "%)";
  }

  document.addEventListener("DOMContentLoaded", function () {
    renderHome();
    renderLesson();
    initTheme();
  });
})();

/* --- Đồng bộ tiến độ đa thiết bị (Supabase) — nạp sync.js một lần --- */
(function(){try{if(!window.__studySyncLoad){window.__studySyncLoad=1;var s=document.createElement("script");s.src="/sync.js";document.head.appendChild(s);}}catch(e){}})();
