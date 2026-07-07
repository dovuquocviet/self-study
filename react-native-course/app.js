/* ========================================================================
 * app.js — điều phối trang chủ + trang bài học.
 * Dữ liệu bài học nằm ở window.LESSONS (data.js).
 * ======================================================================== */
(function () {
  "use strict";
  var LESSONS = window.LESSONS || [];
  var LETTERS = ["A", "B", "C", "D", "E"];
  var PKEY = "rn_course_progress";
  var TKEY = "study-theme";
  var _currentLesson = null;

  /* ---------- theme (light/dark) ---------- */
  function isLight() { return document.documentElement.getAttribute("data-theme") === "light"; }
  function applyTheme(t) {
    if (t === "light") document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");
    try { localStorage.setItem(TKEY, t); } catch (e) {}
    var btn = byId("themeToggle");
    if (btn) btn.textContent = (t === "light") ? "☀️" : "🌙";
    // vẽ lại sơ đồ Mermaid của bài hiện tại theo theme mới
    if (_currentLesson && _currentLesson.diagram && _currentLesson.diagram.type === "mermaid") renderDiagram(_currentLesson);
  }
  function initTheme() {
    var t = "dark";
    try { t = localStorage.getItem(TKEY) || "dark"; } catch (e) {}
    applyTheme(t);
    var btn = byId("themeToggle");
    if (btn) btn.onclick = function () { applyTheme(isLight() ? "dark" : "light"); };
  }

  /* ---------- progress (localStorage) ---------- */
  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(PKEY)) || {}; } catch (e) { return {}; }
  }
  function saveProgress(p) { try { localStorage.setItem(PKEY, JSON.stringify(p)); } catch (e) {} }
  function lessonState(p, ls) {
    var rec = p[ls.id] || {};
    var ans = rec.answers || {};
    var totalQ = (ls.quiz || []).length;
    var answered = 0, correct = 0;
    (ls.quiz || []).forEach(function (q, i) {
      if (ans[i] !== undefined) { answered++; if (ans[i] === q.correct) correct++; }
    });
    return { rec: rec, totalQ: totalQ, answered: answered, correct: correct, done: !!rec.done };
  }

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function byId(id) { return document.getElementById(id); }
  function lessonById(id) { for (var i = 0; i < LESSONS.length; i++) if (LESSONS[i].id === id) return LESSONS[i]; return null; }

  /* ==================================================================
   *  TRANG CHỦ
   * ================================================================== */
  function renderHome() {
    var listEl = byId("lessonList");
    if (!listEl) return;
    var p = loadProgress();
    var doneCount = 0;

    var phases = [];
    var byPhase = {};
    LESSONS.forEach(function (ls) {
      if (!byPhase[ls.phase]) { byPhase[ls.phase] = []; phases.push(ls.phase); }
      byPhase[ls.phase].push(ls);
      if (lessonState(p, ls).done) doneCount++;
    });

    var html = "";
    var n = 0;
    phases.forEach(function (ph) {
      var first = byPhase[ph][0];
      html += '<div class="phase-title">' + esc(first.phaseName || ("Phase " + ph)) + "</div>";
      byPhase[ph].forEach(function (ls) {
        n++;
        var st = lessonState(p, ls);
        var cls = st.done ? "done" : (st.answered > 0 ? "started" : "");
        var mk = st.done ? "✓" : n;
        html += '<a class="card ' + cls + '" href="lesson.html?id=' + ls.id + '">' +
          '<div class="mark">' + mk + "</div>" +
          '<div class="c-body"><div class="c-title">' + esc(ls.title) + "</div>" +
          '<div class="c-obj">' + esc(ls.objective || "") + "</div></div>" +
          '<div class="c-num">Bài ' + n + "</div></a>";
      });
    });
    listEl.innerHTML = html;

    var pct = LESSONS.length ? Math.round((doneCount / LESSONS.length) * 100) : 0;
    var barFill = byId("barFill");
    if (barFill) barFill.style.width = pct + "%";
    var pt = byId("progressText");
    if (pt) pt.textContent = "Hoàn thành " + doneCount + "/" + LESSONS.length + " bài (" + pct + "%)";
  }

  /* ==================================================================
   *  TRANG BÀI HỌC
   * ================================================================== */
  function renderLesson() {
    var wrap = byId("lessonRoot");
    if (!wrap) return;
    var id = new URLSearchParams(location.search).get("id") || (LESSONS[0] && LESSONS[0].id);
    var ls = lessonById(id);
    if (!ls) { wrap.innerHTML = "<p>Không tìm thấy bài học.</p>"; return; }
    var idx = LESSONS.indexOf(ls);
    _currentLesson = ls;
    updateCourseProgress();

    document.title = "Bài " + (idx + 1) + " · " + ls.title;
    byId("lessonTitle").textContent = "Bài " + (idx + 1) + " — " + ls.title;
    byId("lessonPhase").textContent = ls.phaseName || "";

    // --- 1. Lý thuyết ---
    var theoryEl = byId("theory");
    try { theoryEl.innerHTML = window.marked ? window.marked.parse(ls.theory || "") : esc(ls.theory || ""); }
    catch (e) { theoryEl.innerHTML = "<pre>" + esc(ls.theory || "") + "</pre>"; }
    if (window.hljs) {
      theoryEl.querySelectorAll("pre code").forEach(function (b) { try { window.hljs.highlightElement(b); } catch (e) {} });
    }

    // --- 2. Code demo (Snack) ---
    var snackEl = byId("snack");
    if (ls.code && window.Snack) {
      window.Snack.mount(snackEl, ls.code.trim(), { title: ls.codeTitle || "App.js", lazy: true });
    } else {
      snackEl.innerHTML = '<p class="dg-caption">Bài này không có demo code.</p>';
    }

    // --- 3. Sơ đồ ---
    renderDiagram(ls);

    // --- 4. Quiz ---
    renderQuiz(ls);

    // --- điều hướng ---
    renderNav(ls, idx);
  }

  function renderDiagram(ls) {
    var el = byId("diagram");
    var d = ls.diagram;
    if (!d) { el.closest(".section").style.display = "none"; return; }
    if (d.type === "custom" && window.Diagrams && window.Diagrams[d.id]) {
      window.Diagrams[d.id](el);
    } else if (d.type === "mermaid") {
      el.innerHTML = "";
      if (d.caption) { var cap = document.createElement("div"); cap.className = "dg-caption"; cap.innerHTML = d.caption; el.appendChild(cap); }
      var pre = document.createElement("div");
      pre.className = "mermaid";
      pre.textContent = d.src;
      var wrap = document.createElement("div"); wrap.className = "mermaid-wrap"; wrap.appendChild(pre);
      el.appendChild(wrap);
      if (window.mermaid) {
        try {
          window.mermaid.initialize({ startOnLoad: false, theme: isLight() ? "default" : "dark", securityLevel: "loose", fontFamily: "ui-monospace, monospace" });
          window.mermaid.run({ nodes: [pre] });
        } catch (e) { console.warn("mermaid", e); }
      }
    } else {
      el.innerHTML = '<p class="dg-caption">Sơ đồ không khả dụng.</p>';
    }
  }

  /* ---------- Quiz (mượn pattern từ project study) ---------- */
  function renderQuiz(ls) {
    var p = loadProgress();
    var rec = p[ls.id] || (p[ls.id] = {});
    var ans = rec.answers || (rec.answers = {});
    var list = byId("quizList");
    var quiz = ls.quiz || [];
    list.innerHTML = "";

    quiz.forEach(function (q, qi) {
      var qEl = document.createElement("div");
      qEl.className = "q";
      var opts = q.options.map(function (opt, oi) {
        return '<button class="opt" data-q="' + qi + '" data-o="' + oi + '">' +
          '<span class="letter">' + LETTERS[oi] + ".</span>" + esc(opt) + "</button>";
      }).join("");
      qEl.innerHTML =
        '<div class="qtext"><span class="qnum">Câu ' + (qi + 1) + ".</span>" + esc(q.q) + "</div>" +
        opts + '<div class="explain" id="ex-' + qi + '"></div>';
      list.appendChild(qEl);
    });

    Array.prototype.forEach.call(list.querySelectorAll(".opt"), function (btn) {
      btn.addEventListener("click", function () {
        var qi = +btn.getAttribute("data-q");
        if (ans[qi] !== undefined) return;
        ans[qi] = +btn.getAttribute("data-o");
        saveProgress(p);
        applyAnswer(ls, qi);
        updateQuizStatus(ls);
      });
    });
    quiz.forEach(function (q, qi) { if (ans[qi] !== undefined) applyAnswer(ls, qi); });
    updateQuizStatus(ls);

    byId("btnRetry").onclick = function () {
      if (!confirm("Làm lại trắc nghiệm bài này?")) return;
      var pp = loadProgress(); (pp[ls.id] = pp[ls.id] || {}).answers = {}; saveProgress(pp);
      renderQuiz(ls);
    };
    byId("btnDone").onclick = function () {
      var st = lessonState(loadProgress(), ls);
      if (st.answered < st.totalQ) return;
      var pp = loadProgress(); (pp[ls.id] = pp[ls.id] || {}).done = true; saveProgress(pp);
      toast("✓ Đã hoàn thành bài này");
      var idx = LESSONS.indexOf(ls), next = LESSONS[idx + 1];
      setTimeout(function () { location.href = next ? ("lesson.html?id=" + next.id) : "index.html"; }, 800);
    };
  }

  function applyAnswer(ls, qi) {
    var p = loadProgress();
    var ans = (p[ls.id] || {}).answers || {};
    var q = ls.quiz[qi];
    var chosen = ans[qi];
    var qEl = byId("quizList").children[qi];
    if (!qEl) return;
    Array.prototype.forEach.call(qEl.querySelectorAll(".opt"), function (btn) {
      var oi = +btn.getAttribute("data-o");
      btn.classList.add("locked");
      if (oi === q.correct) btn.classList.add("correct");
      if (oi === chosen && chosen !== q.correct) btn.classList.add("wrong");
    });
    var ex = qEl.querySelector(".explain");
    var ok = chosen === q.correct;
    ex.className = "explain show " + (ok ? "ok" : "no");
    ex.innerHTML = (ok ? "<b>✓ Chính xác.</b> " : "<b>✗ Chưa đúng.</b> Đáp án đúng: <b>" + LETTERS[q.correct] + "</b>. ") + esc(q.explanation || "");
  }

  function updateQuizStatus(ls) {
    var st = lessonState(loadProgress(), ls);
    byId("quizStatus").textContent = "Đã trả lời " + st.answered + "/" + st.totalQ + " câu" + (st.answered ? " · đúng " + st.correct + "/" + st.answered : "");
    var done = byId("btnDone"), hint = byId("doneHint");
    if (st.totalQ === 0 || st.answered >= st.totalQ) {
      done.disabled = false;
      hint.textContent = st.done ? "Bài này đã hoàn thành." : "Đã làm hết trắc nghiệm — bấm để đánh dấu hoàn thành & sang bài sau.";
    } else {
      done.disabled = true;
      hint.textContent = "Trả lời hết " + st.totalQ + " câu để mở nút hoàn thành.";
    }
  }

  function renderNav(ls, idx) {
    var prev = LESSONS[idx - 1], next = LESSONS[idx + 1];
    byId("prevLink").innerHTML = prev ? '<a href="lesson.html?id=' + prev.id + '">← Bài ' + idx + "</a>" : "";
    byId("nextLink").innerHTML = next ? '<a href="lesson.html?id=' + next.id + '">Bài ' + (idx + 2) + " →</a>" : '<a href="index.html">Về lộ trình →</a>';
  }

  function toast(msg) {
    var t = document.createElement("div"); t.className = "toast"; t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 1600);
  }

  function updateCourseProgress() {
    var p = loadProgress(), done = 0;
    LESSONS.forEach(function (ls) { if (lessonState(p, ls).done) done++; });
    var pct = LESSONS.length ? Math.round((done / LESSONS.length) * 100) : 0;
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
