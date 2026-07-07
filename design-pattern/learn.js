/* ============================================================
   learn.js — Theme (light/dark) + Progress + Quiz
   Dùng chung cho index.html và mọi trang pattern.
   Không backend: tiến độ lưu localStorage.
   ============================================================ */
(function () {
  "use strict";

  var PROGRESS_KEY = "dp_progress_v1";
  var THEME_KEY = "study-theme";
  var LETTERS = ["A", "B", "C", "D", "E", "F"];
  var QUIZ = window.QUIZ || {};

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveProgress(p) {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch (e) {}
  }
  // id của trang = tên file bỏ .html
  function pageId() {
    var f = (location.pathname.split("/").pop() || "").replace(/\.html?$/, "");
    return f || "index";
  }
  function idFromHref(href) {
    var f = (href || "").split("/").pop().split("?")[0].replace(/\.html?$/, "");
    return f;
  }
  function stateOf(p, id) {
    var quiz = QUIZ[id] || [];
    var rec = p[id] || {};
    var ans = rec.answers || {};
    var answered = Object.keys(ans).length;
    var correct = 0;
    quiz.forEach(function (q, i) { if (ans[i] === q.correct) correct++; });
    return {
      rec: rec, answers: ans, total: quiz.length,
      answered: answered, correct: correct,
      done: !!rec.done, started: answered > 0 || !!rec.done
    };
  }
  function toast(msg) {
    var t = document.getElementById("dpToast");
    if (!t) { t = document.createElement("div"); t.id = "dpToast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    setTimeout(function () { t.classList.remove("show"); }, 2200);
  }

  /* ---------- THEME ---------- */
  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  }
  function applyTheme(t) {
    if (t === "light") document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");
    var b = document.getElementById("themeToggle");
    if (b) b.textContent = t === "light" ? "🌙" : "☀️";
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  }
  function initTheme() {
    var saved;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
    if (saved) applyTheme(saved); // mặc định (không saved) = dark như thiết kế gốc

    // Dựng thanh header (.hbar) giống các course khác: [← Trang chủ] [← Tất cả pattern]? [spacer] [toggle]
    var header = document.querySelector(".site-header");
    var hbar = document.createElement("div");
    hbar.className = "hbar";

    var home = document.createElement("a");
    home.className = "back";
    home.href = "../index.html";
    home.textContent = "← Trang chủ";
    home.title = "Về trang chủ Tự học";
    hbar.appendChild(home);

    // link "← Tất cả pattern" có sẵn trong header (trang pattern) → chuyển vào hbar
    var existingBack = header ? header.querySelector("a.back") : null;
    if (existingBack) hbar.appendChild(existingBack);

    var spacer = document.createElement("span");
    spacer.className = "spacer";
    hbar.appendChild(spacer);

    var btn = document.createElement("button");
    btn.className = "theme-toggle";
    btn.id = "themeToggle";
    btn.type = "button";
    btn.textContent = currentTheme() === "light" ? "🌙" : "☀️";
    btn.addEventListener("click", function () {
      applyTheme(currentTheme() === "light" ? "dark" : "light");
    });
    hbar.appendChild(btn);

    if (header) header.insertBefore(hbar, header.firstChild);
    else document.body.insertBefore(hbar, document.body.firstChild);
  }

  /* ============================================================
     TRANG CHỦ — progress bar + badge trạng thái từng thẻ
     ============================================================ */
  function initHome() {
    var cards = Array.prototype.slice.call(document.querySelectorAll(".pattern-card"));
    if (!cards.length) return;
    var p = loadProgress();
    var total = cards.length, done = 0, started = 0;

    cards.forEach(function (card) {
      var id = idFromHref(card.getAttribute("href"));
      var st = stateOf(p, id);
      var label, cls;
      if (st.done) { done++; cls = "done"; label = "✓ Đã học"; }
      else if (st.started) { started++; cls = "started"; label = "● Đang học"; }
      else { cls = "todo"; label = "Chưa học"; }
      card.classList.add(cls);
      var b = document.createElement("span");
      b.className = "card-status " + cls;
      b.textContent = label;
      card.appendChild(b);
    });

    // chèn thanh tiến độ ngay dưới header
    var pct = total ? Math.round(done / total * 100) : 0;
    var wrap = document.createElement("div");
    wrap.className = "learn-progress";
    wrap.innerHTML =
      '<div class="lp-bar"><div class="lp-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="lp-meta">' +
        '<span class="lp-label">' + done + '/' + total + ' đã học xong · ' + started + ' đang học · ' + pct + '%</span>' +
        '<button class="lp-reset" id="lpReset">↺ Xoá tiến độ</button>' +
      '</div>';
    var header = document.querySelector(".site-header");
    if (header && header.parentNode) header.parentNode.insertBefore(wrap, header.nextSibling);
    else document.body.insertBefore(wrap, document.body.firstChild);

    var rb = document.getElementById("lpReset");
    if (rb) rb.addEventListener("click", function () {
      if (!confirm("Xoá toàn bộ tiến độ học đã lưu?")) return;
      try { localStorage.removeItem(PROGRESS_KEY); } catch (e) {}
      location.reload();
    });
  }

  /* ============================================================
     TRANG PATTERN — render quiz + đánh dấu hoàn thành
     ============================================================ */
  function initLesson() {
    var id = pageId();
    var quiz = QUIZ[id];
    if (!quiz || !quiz.length) return; // trang chưa có bộ câu hỏi
    var main = document.querySelector("main");
    if (!main) return;

    var sec = document.createElement("section");
    sec.className = "quiz-section panel";
    sec.innerHTML =
      '<h3>📝 Kiểm tra nhanh</h3>' +
      '<p class="quiz-intro">Trả lời hết các câu để đánh dấu bài đã học. Đáp án sẽ hiện giải thích ngay.</p>' +
      '<div class="quiz-status" id="quizStatus"></div>' +
      '<div class="quiz-list" id="quizList"></div>' +
      '<div class="quiz-actions">' +
        '<button type="button" id="btnRetry">↺ Làm lại</button>' +
        '<button type="button" id="btnDone">✓ Đánh dấu đã học</button>' +
      '</div>' +
      '<div class="done-hint" id="doneHint"></div>';
    // chèn sau <main>
    main.parentNode.insertBefore(sec, main.nextSibling);

    renderQuiz(id);
  }

  function renderQuiz(id) {
    var quiz = QUIZ[id];
    var p = loadProgress();
    var rec = p[id] || (p[id] = {});
    var ans = rec.answers || (rec.answers = {});
    var list = document.getElementById("quizList");
    list.innerHTML = "";

    quiz.forEach(function (q, qi) {
      var qEl = document.createElement("div");
      qEl.className = "q";
      var opts = q.options.map(function (opt, oi) {
        return '<button type="button" class="opt" data-q="' + qi + '" data-o="' + oi + '">' +
               '<span class="letter">' + LETTERS[oi] + '.</span>' + esc(opt) + '</button>';
      }).join("");
      qEl.innerHTML =
        '<div class="qtext"><span class="qnum">Câu ' + (qi + 1) + '.</span>' + esc(q.q) + '</div>' +
        opts + '<div class="explain"></div>';
      list.appendChild(qEl);
    });

    Array.prototype.forEach.call(list.querySelectorAll(".opt"), function (btn) {
      btn.addEventListener("click", function () {
        var qi = +btn.getAttribute("data-q");
        if (ans[qi] !== undefined) return; // đã trả lời -> khoá
        ans[qi] = +btn.getAttribute("data-o");
        saveProgress(p);
        applyAnswer(id, qi);
        updateStatus(id);
      });
    });
    // khôi phục câu đã trả lời
    quiz.forEach(function (q, qi) { if (ans[qi] !== undefined) applyAnswer(id, qi); });
    updateStatus(id);

    document.getElementById("btnRetry").onclick = function () {
      if (!confirm("Làm lại trắc nghiệm bài này? Đáp án đã chọn sẽ bị xoá.")) return;
      var pp = loadProgress();
      (pp[id] = pp[id] || {}).answers = {};
      saveProgress(pp);
      renderQuiz(id);
    };
    document.getElementById("btnDone").onclick = function () {
      var st = stateOf(loadProgress(), id);
      if (st.total && st.answered < st.total) return;
      var pp = loadProgress();
      (pp[id] = pp[id] || {}).done = true;
      saveProgress(pp);
      toast("✓ Đã đánh dấu hoàn thành bài này");
      document.getElementById("doneHint").textContent =
        "Đã hoàn thành. Quay lại trang chủ để xem tiến độ tổng.";
    };
  }

  function applyAnswer(id, qi) {
    var q = QUIZ[id][qi];
    var ans = (loadProgress()[id] || {}).answers || {};
    var chosen = ans[qi];
    var qEl = document.getElementById("quizList").children[qi];
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
    ex.innerHTML = (ok ? "<b>✓ Chính xác.</b> " :
      "<b>✗ Chưa đúng.</b> Đáp án đúng: <b>" + LETTERS[q.correct] + "</b>. ") +
      esc(q.explanation || "");
  }

  function updateStatus(id) {
    var st = stateOf(loadProgress(), id);
    var statusEl = document.getElementById("quizStatus");
    if (statusEl) statusEl.textContent = "Đã trả lời " + st.answered + "/" + st.total +
      " câu" + (st.answered ? " · đúng " + st.correct + "/" + st.answered : "");
    var done = document.getElementById("btnDone");
    var hint = document.getElementById("doneHint");
    if (!done) return;
    if (st.total === 0 || st.answered >= st.total) {
      done.disabled = false;
      hint.textContent = st.done ? "Bài này đã được đánh dấu hoàn thành." :
        "Bạn đã trả lời hết — có thể đánh dấu hoàn thành.";
    } else {
      done.disabled = true;
      hint.textContent = "Trả lời hết " + st.total + " câu để mở khoá nút đánh dấu.";
    }
  }

  /* ---------- boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    initTheme();
    if (pageId() === "index") initHome();
    else initLesson();
  });
})();

/* --- Đồng bộ tiến độ đa thiết bị (Supabase) — nạp sync.js một lần --- */
(function(){try{if(!window.__studySyncLoad){window.__studySyncLoad=1;var s=document.createElement("script");s.src="/sync.js";document.head.appendChild(s);}}catch(e){}})();
