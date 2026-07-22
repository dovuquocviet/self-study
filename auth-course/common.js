/* ---- Favicon emoji: hiện logo trên tab trình duyệt (như Zalo có logo riêng) ---- */
(function () {
  try {
    var e = "🔐";
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<text x="50" y="54" font-size="80" text-anchor="middle" dominant-baseline="central">' + e + '</text></svg>';
    var link = document.querySelector('link[rel~="icon"]');
    if (!link) { link = document.createElement("link"); link.setAttribute("rel", "icon"); (document.head || document.documentElement).appendChild(link); }
    link.setAttribute("type", "image/svg+xml");
    link.setAttribute("href", "data:image/svg+xml," + encodeURIComponent(svg));
  } catch (_) {}
})();

/* ============================================================
   CS Foundations — engine dùng chung (vanilla, không backend)
   Kiến trúc port từ project "spring-internals":
   - esc/hl/renderCode/setupTabs  (highlighter đa ngôn ngữ: shell/C/JS/HTTP)
   - STEP ENGINE   : animation từng bước + tô sáng dòng code
   - QUIZ + PROGRESS: lưu localStorage theo window.COURSE.slug
   - THEME         : Sáng/Tối
   ============================================================ */
(function () {
  "use strict";
  var SLUG = (window.COURSE && window.COURSE.slug) || "course";
  var KEY = SLUG + "-progress-v1";
  var THEME_KEY = "study-theme";
  var LETTERS = ["A", "B", "C", "D", "E", "F"];
  window.LESSONS = window.LESSONS || [];

  /* ---------- tiện ích ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Highlighter đa ngôn ngữ. Bảo vệ string/comment bằng placeholder (ký tự
  // private-use +) để các lượt replace sau không phá cấu trúc span.
  var KW = new RegExp("\\b(" + [
    // shell / điều khiển
    "if", "then", "else", "elif", "fi", "for", "while", "until", "do", "done",
    "case", "esac", "in", "function", "return", "exit", "break", "continue",
    "local", "export", "source", "read", "echo", "printf", "set", "unset",
    // C / JS
    "int", "char", "void", "long", "short", "unsigned", "struct", "enum",
    "const", "static", "sizeof", "typedef", "union", "double", "float",
    "class", "new", "let", "var", "public", "private", "protected", "async",
    "await", "import", "from", "true", "false", "null", "nil", "None"
  ].join("|") + ")\\b", "g");

  function hl(line) {
    var stash = [];
    function keep(html) { stash.push(html); return String.fromCharCode(0xE000 + stash.length - 1); }

    // 1) tách comment ở chuỗi thô (bỏ qua nội dung nằm trong string)
    var n = line.length, i = 0, cIdx = -1;
    while (i < n) {
      var ch = line.charAt(i);
      if (ch === '"' || ch === "'") { var q = ch; i++; while (i < n && line.charAt(i) !== q) i++; i++; continue; }
      // '#' là comment shell khi đứng đầu/trước có khoảng trắng VÀ sau là space/#  → không bắt #include, #define
      if (ch === "#" && (i === 0 || /\s/.test(line.charAt(i - 1))) && (i + 1 >= n || /[\s#]/.test(line.charAt(i + 1)))) { cIdx = i; break; }
      if (ch === "/" && line.charAt(i + 1) === "/" && line.charAt(i - 1) !== ":") { cIdx = i; break; }
      i++;
    }
    var comment = cIdx !== -1 ? line.slice(cIdx) : "";
    var s = esc(cIdx !== -1 ? line.slice(0, cIdx) : line);

    // 2) prompt ở đầu dòng ($ hoặc leading #! shebang)
    s = s.replace(/^(\s*)(\$)\s/, function (_, sp) { return sp + keep('<span class="pr">$</span>') + " "; });
    s = s.replace(/^(#!\S*)/, function (m) { return keep('<span class="cm">' + m + "</span>"); });
    // preprocessor C
    s = s.replace(/^(\s*)(#(?:include|define|ifndef|ifdef|endif|pragma|if|else)\b)/, function (_, sp, d) { return sp + keep('<span class="an">' + d + "</span>"); });

    // 3) string
    s = s.replace(/&quot;[^&]*&quot;|&#39;[^&#39;]*&#39;|'[^']*'/g, function (m) { return keep('<span class="str">' + m + "</span>"); });
    // 4) biến $VAR / ${VAR}
    s = s.replace(/\$\{?\w+\}?/g, function (m) { return keep('<span class="var">' + m + "</span>"); });
    // 5) cờ -x / --long
    s = s.replace(/(^|\s)(--?[A-Za-z][\w-]*)/g, function (_, sp, f) { return sp + keep('<span class="fl">' + f + "</span>"); });
    // 6) từ khoá
    s = s.replace(KW, function (m) { return keep('<span class="kw">' + m + "</span>"); });
    // 7) gọi hàm .foo(
    s = s.replace(/\.(\w+)\(/g, function (_, f) { return "." + keep('<span class="fn">' + f + "</span>") + "("; });
    // 8) số
    s = s.replace(/\b(\d+\.\d+|0x[0-9a-fA-F]+|\d+)\b/g, function (m) { return keep('<span class="num">' + m + "</span>"); });

    // 9) khôi phục placeholder
    s = s.replace(/[\uE000-\uF8FF]/g, function (chr) { return stash[chr.charCodeAt(0) - 0xE000] || ""; });
    if (comment) s += '<span class="cm">' + esc(comment) + "</span>";
    return s;
  }

  // render mảng dòng, mỗi dòng là 1 <span class="cl" data-ln="i"> để tô sáng theo số dòng (1-based)
  function renderCode(el, lines) {
    el.innerHTML = lines.map(function (ln, i) {
      return '<span class="cl" data-ln="' + (i + 1) + '">' + (hl(ln) || " ") + "</span>";
    }).join("");
  }
  function setupTabs(root) {
    root = root || document;
    Array.prototype.forEach.call(root.querySelectorAll(".code-tab"), function (tab) {
      tab.addEventListener("click", function () { activateTab(root, tab.dataset.tab); });
    });
  }
  function activateTab(root, id) {
    root = root || document;
    Array.prototype.forEach.call(root.querySelectorAll(".code-tab"), function (t) {
      t.classList.toggle("active", t.dataset.tab === id);
    });
    Array.prototype.forEach.call(root.querySelectorAll(".code-view"), function (v) {
      v.classList.toggle("hidden", v.dataset.view !== id);
    });
  }

  /* ---------- progress ---------- */
  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveProgress(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }
  function lessonById(id) {
    for (var i = 0; i < window.LESSONS.length; i++) if (window.LESSONS[i].id === id) return window.LESSONS[i];
    return null;
  }
  function lessonState(p, ls) {
    var rec = p[ls.id] || {};
    var ans = rec.answers || {};
    var totalQ = (ls.quiz || []).length, correct = 0;
    (ls.quiz || []).forEach(function (q, i) { if (ans[i] === q.correct) correct++; });
    var answered = Object.keys(ans).length;
    return { rec: rec, answered: answered, totalQ: totalQ, correct: correct,
             done: !!rec.done, started: answered > 0 || !!rec.done };
  }
  function toast(msg) {
    var t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg; t.classList.add("show");
    setTimeout(function () { t.classList.remove("show"); }, 2200);
  }

  /* ============================================================
     TRANG CHỦ
     ============================================================ */
  function renderHome() {
    var host = document.getElementById("home");
    if (!host) return;
    var L = window.LESSONS, p = loadProgress();
    var doneCount = 0;
    L.forEach(function (ls) { if ((p[ls.id] || {}).done) doneCount++; });
    var fill = document.getElementById("progressFill");
    if (fill) fill.style.width = (L.length ? doneCount / L.length * 100 : 0) + "%";
    var lbl = document.getElementById("progressLabel");
    if (lbl) lbl.textContent = doneCount + "/" + L.length + " bài đã hoàn thành";

    var order = [], groups = {};
    L.forEach(function (ls) {
      var k = ls.phase + "|" + ls.phaseName;
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(ls);
    });
    var step = {}; L.forEach(function (l, i) { step[l.id] = i + 1; });

    var html = "";
    order.forEach(function (k) {
      html += '<div class="phase-title"><span class="pnum">Pha ' + esc(k.split("|")[0]) +
              "</span>" + esc(k.split("|")[1]) + "</div>";
      html += '<div class="lesson-grid">';
      groups[k].forEach(function (ls) {
        var st = lessonState(p, ls);
        var cls = "card" + (st.done ? " done" : (st.started ? " started" : ""));
        var mark = st.done ? "✓" : String(step[ls.id]);
        var badge = st.done
          ? '<span class="badge done">Đã xong · ' + st.correct + "/" + st.totalQ + "</span>"
          : (st.started ? '<span class="badge started">Đang học · ' + st.answered + "/" + st.totalQ + "</span>"
                        : '<span class="badge">Chưa học</span>');
        html += '<a class="' + cls + '" href="lesson.html?id=' + ls.id + '">' +
          '<div class="mark">' + mark + "</div>" +
          "<div><div class=\"ttl\">" + esc(ls.title) + "</div>" +
          '<div class="obj">' + esc(ls.subtitle || "") + "</div>" + badge + "</div></a>";
      });
      html += "</div>";
    });
    host.innerHTML = html;
  }

  /* ============================================================
     TRANG BÀI HỌC
     ============================================================ */
  var STAGE = { steps: [], i: 0, ls: null };

  function renderLesson() {
    var host = document.getElementById("lesson");
    if (!host) return;
    var id = new URLSearchParams(location.search).get("id");
    var L = window.LESSONS, ls = lessonById(id) || L[0];
    if (!ls) { host.innerHTML = "<p>Không tìm thấy bài học.</p>"; return; }
    var idx = L.indexOf(ls), step = idx + 1;

    var p0 = loadProgress(), doneCount = 0;
    L.forEach(function (x) { if ((p0[x.id] || {}).done) doneCount++; });
    var lf = document.getElementById("lessonProgFill");
    if (lf) lf.style.width = (L.length ? doneCount / L.length * 100 : 0) + "%";
    setText("lessonProgLabel", doneCount + "/" + L.length + " bài đã hoàn thành");

    document.title = "Bài " + step + " · " + ls.title;
    setText("lessonTitle", "Bài " + step + " — " + ls.title);
    setHTML("lessonKicker", '<span class="tag">Pha ' + esc(ls.phase) + " · " + esc(ls.phaseName) +
      "</span>  " + esc(ls.subtitle || ""));

    setHTML("theory", "<h3>📖 Lý thuyết</h3>" + (ls.theory || ""));
    buildCodePanel(ls);
    buildStage(ls);
    renderQuiz(ls);

    var prev = L[idx - 1], next = L[idx + 1];
    setHTML("prevLink", prev ? '<a href="lesson.html?id=' + prev.id + '">← Bài ' + idx + " · " + esc(prev.title) + "</a>" : "");
    setHTML("nextLink", next ? '<a href="lesson.html?id=' + next.id + '">Bài ' + (idx + 2) + " · " + esc(next.title) + " →</a>" : "");
  }

  function buildCodePanel(ls) {
    var tabs = ls.codeTabs || [];
    var tabsEl = document.getElementById("codeTabs");
    var viewsEl = document.getElementById("codeViews");
    tabsEl.innerHTML = tabs.map(function (t, i) {
      return '<button class="code-tab' + (i === 0 ? " active" : "") + '" data-tab="' + t.id + '">' + esc(t.label) + "</button>";
    }).join("");
    viewsEl.innerHTML = tabs.map(function (t, i) {
      return '<pre class="code-view' + (i === 0 ? "" : " hidden") + '" data-view="' + t.id + '"><code></code></pre>';
    }).join("");
    tabs.forEach(function (t) {
      var pre = viewsEl.querySelector('[data-view="' + t.id + '"] code');
      renderCode(pre, t.lines);
    });
    setupTabs(document);
  }

  function buildStage(ls) {
    var area = document.getElementById("stageArea");
    area.innerHTML = ls.stageHtml || "<p style='color:var(--muted)'>(bài này không có sơ đồ)</p>";
    STAGE.ls = ls;
    STAGE.steps = ls.steps || [];
    STAGE.i = 0;
    applyStep(0);
    document.getElementById("stepPrev").onclick = function () { gotoStep(STAGE.i - 1); };
    document.getElementById("stepNext").onclick = function () { gotoStep(STAGE.i + 1); };
    document.getElementById("stepReset").onclick = function () { gotoStep(0); };
  }
  function gotoStep(n) {
    if (n < 0 || n >= STAGE.steps.length) return;
    STAGE.i = n; applyStep(n);
  }
  function applyStep(n) {
    var s = STAGE.steps[n] || {};
    var area = document.getElementById("stageArea");
    Array.prototype.forEach.call(area.querySelectorAll(".node,.arrow"), function (el) {
      el.classList.remove("on"); el.classList.remove("dim");
    });
    (s.on || []).forEach(function (id) {
      var el = area.querySelector("#" + id);
      if (el) el.classList.add("on");
    });
    if (s.tab) activateTab(document, s.tab);
    highlightLines(s.tab, s.highlight || []);
    setHTML("stepDesc", '<div class="st-title">' + esc(s.title || "") + '</div><div class="st-body">' + (s.desc || "") + "</div>");
    setText("stepCounter", "Bước " + (n + 1) + " / " + STAGE.steps.length);
    document.getElementById("stepPrev").disabled = n === 0;
    document.getElementById("stepNext").disabled = n === STAGE.steps.length - 1;
  }
  function highlightLines(tabId, nums) {
    var view = tabId ? document.querySelector('.code-view[data-view="' + tabId + '"]')
                     : document.querySelector('.code-view:not(.hidden)');
    Array.prototype.forEach.call(document.querySelectorAll(".cl.hot"), function (el) { el.classList.remove("hot"); });
    if (!view) return;
    var set = {}; nums.forEach(function (nn) { set[nn] = 1; });
    Array.prototype.forEach.call(view.querySelectorAll(".cl"), function (el) {
      if (set[+el.dataset.ln]) el.classList.add("hot");
    });
    var first = view.querySelector(".cl.hot");
    if (first && first.scrollIntoView) first.scrollIntoView({ block: "nearest" });
  }

  /* ---------- quiz ---------- */
  function renderQuiz(ls) {
    var p = loadProgress();
    var rec = p[ls.id] || (p[ls.id] = {});
    var ans = rec.answers || (rec.answers = {});
    var list = document.getElementById("quizList");
    var quiz = ls.quiz || [];
    list.innerHTML = "";
    quiz.forEach(function (q, qi) {
      var qEl = document.createElement("div");
      qEl.className = "q";
      var opts = q.options.map(function (opt, oi) {
        return '<button class="opt" data-q="' + qi + '" data-o="' + oi + '"><span class="letter">' +
               LETTERS[oi] + ".</span>" + esc(opt) + "</button>";
      }).join("");
      qEl.innerHTML = '<div class="qtext"><span class="qnum">Câu ' + (qi + 1) + ".</span>" + esc(q.q) + "</div>" +
                      opts + '<div class="explain"></div>';
      list.appendChild(qEl);
    });
    Array.prototype.forEach.call(list.querySelectorAll(".opt"), function (btn) {
      btn.addEventListener("click", function () {
        var qi = +btn.dataset.q;
        if (ans[qi] !== undefined) return;
        ans[qi] = +btn.dataset.o;
        saveProgress(p);
        applyAnswer(ls, qi);
        updateQuizStatus(ls);
      });
    });
    quiz.forEach(function (q, qi) { if (ans[qi] !== undefined) applyAnswer(ls, qi); });
    updateQuizStatus(ls);

    document.getElementById("btnRetry").onclick = function () {
      var pp = loadProgress(); (pp[ls.id] = pp[ls.id] || {}).answers = {}; saveProgress(pp);
      renderQuiz(ls);
    };
    document.getElementById("btnDone").onclick = function () {
      var st = lessonState(loadProgress(), ls);
      if (st.totalQ && st.answered < st.totalQ) return;
      var pp = loadProgress(); (pp[ls.id] = pp[ls.id] || {}).done = true; saveProgress(pp);
      toast("✓ Đã hoàn thành bài này");
      setTimeout(function () { location.href = "index.html"; }, 900);
    };
  }
  function applyAnswer(ls, qi) {
    var ans = (loadProgress()[ls.id] || {}).answers || {};
    var q = ls.quiz[qi], chosen = ans[qi];
    var qEl = document.getElementById("quizList").children[qi];
    if (!qEl) return;
    Array.prototype.forEach.call(qEl.querySelectorAll(".opt"), function (btn) {
      var oi = +btn.dataset.o;
      btn.classList.add("locked");
      if (oi === q.correct) btn.classList.add("correct");
      if (oi === chosen && chosen !== q.correct) btn.classList.add("wrong");
    });
    var ex = qEl.querySelector(".explain"), ok = chosen === q.correct;
    ex.className = "explain show " + (ok ? "ok" : "no");
    ex.innerHTML = (ok ? "<b>✓ Chính xác.</b> " : "<b>✗ Chưa đúng.</b> Đáp án đúng: <b>" + LETTERS[q.correct] + "</b>. ") + esc(q.explanation || "");
  }
  function updateQuizStatus(ls) {
    var st = lessonState(loadProgress(), ls);
    setText("quizStatus", "Đã trả lời " + st.answered + "/" + st.totalQ + " câu" +
      (st.answered ? " · đúng " + st.correct + "/" + st.answered : ""));
    var done = document.getElementById("btnDone");
    var hint = document.getElementById("doneHint");
    if (st.totalQ === 0 || st.answered >= st.totalQ) {
      done.disabled = false;
      hint.textContent = st.rec.done ? "Bài này đã được đánh dấu hoàn thành." : "Đã làm hết trắc nghiệm — bấm để đánh dấu hoàn thành.";
    } else {
      done.disabled = true;
      hint.textContent = "Trả lời hết " + st.totalQ + " câu để mở khoá nút hoàn thành.";
    }
  }

  /* ---------- helpers DOM ---------- */
  function setText(id, t) { var e = document.getElementById(id); if (e) e.textContent = t; }
  function setHTML(id, h) { var e = document.getElementById(id); if (e) e.innerHTML = h; }

  /* ---------- theme ---------- */
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    var btn = document.getElementById("themeToggle");
    if (btn) { btn.textContent = t === "light" ? "🌙" : "☀️"; btn.title = t === "light" ? "Chuyển sang Tối" : "Chuyển sang Sáng"; }
  }
  function initTheme() {
    var saved = "dark";
    try { saved = localStorage.getItem(THEME_KEY) || "dark"; } catch (e) {}
    applyTheme(saved);
    var btn = document.getElementById("themeToggle");
    if (btn) btn.addEventListener("click", function () {
      var cur = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      try { localStorage.setItem(THEME_KEY, cur); } catch (e) {}
      applyTheme(cur);
    });
  }

  /* ---------- boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    initTheme();
    renderHome();
    renderLesson();
  });

  window.CSF = { esc: esc, hl: hl, renderCode: renderCode };
})();

/* --- Đồng bộ tiến độ đa thiết bị (Supabase) — nạp sync.js một lần --- */
(function(){try{if(!window.__studySyncLoad){window.__studySyncLoad=1;var s=document.createElement("script");s.src="/sync.js";document.head.appendChild(s);}}catch(e){}})();
