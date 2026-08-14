/* ============================================================================
 * code-editor.js — Editor code có TÔ MÀU CÚ PHÁP (JS/JSX), dùng chung cho mọi khoá.
 * ----------------------------------------------------------------------------
 * Vì sao không dùng <textarea> trần: textarea chỉ hiển thị được MỘT màu.
 * Kỹ thuật ở đây (giống CodeMirror/CodeJar/w3schools thu nhỏ):
 *   1. Một <pre><code> nằm dưới, chứa HTML đã tô màu (chỉ để NHÌN).
 *   2. Một <textarea> trong suốt nằm CHỒNG chính xác lên trên (để GÕ).
 *      - chữ trong suốt (-webkit-text-fill-color: transparent)
 *      - con trỏ vẫn thấy (caret-color)
 *      - vùng bôi đen dùng màu bán trong suốt để nhìn xuyên xuống lớp màu
 *   3. Mỗi lần gõ: tô màu lại + cập nhật số dòng; mỗi lần cuộn: đồng bộ scroll.
 *
 * Tự chèn CSS của chính nó (không cần sửa styles.css từng khoá).
 * Màu token lấy từ biến CSS của khoá (--kw, --str, --num, --fn, --cm...),
 * có giá trị dự phòng nếu khoá đó chưa khai báo.
 *
 * API:
 *   var ed = CodeEditor.mount(container, code, { onRun, onChange, minHeight });
 *   ed.getValue() / ed.setValue(s) / ed.focus() / ed.lineText(n) / ed.destroy()
 *   CodeEditor.highlight(src) -> HTML đã tô màu (dùng để hiện code tĩnh)
 * ==========================================================================*/
(function () {
  "use strict";

  /* ---------------------------------------------------------------- 1. CSS */
  var CSS = [
    ".ed-wrap{position:relative;display:flex;flex:1;min-width:0;background:var(--ed-bg,#0f141a);font-family:ui-monospace,'JetBrains Mono','SF Mono',Menlo,Consolas,monospace;font-size:13px;line-height:1.55;}",
    ".ed-gutter{flex:none;padding:12px 8px 12px 12px;text-align:right;color:var(--ed-gutter,#46525f);user-select:none;overflow:hidden;min-width:38px;white-space:pre;}",
    ".ed-area{position:relative;flex:1;min-width:0;overflow:hidden;}",
    /* lớp tô màu + lớp gõ phải TRÙNG KHỚP từng pixel => cùng font/padding/tab-size */
    ".ed-hl,.ed-input{margin:0;padding:12px 14px 12px 4px;border:0;font:inherit;line-height:inherit;tab-size:2;-moz-tab-size:2;white-space:pre;overflow-wrap:normal;word-break:normal;}",
    ".ed-hl{position:absolute;inset:0;overflow:hidden;pointer-events:none;color:var(--ed-fg,#d7dee8);background:transparent;}",
    ".ed-hl code{font:inherit;background:none;padding:0;color:inherit;white-space:pre;}",
    ".ed-input{position:absolute;inset:0;width:100%;height:100%;resize:none;outline:0;display:block;",
    "  background:transparent;color:transparent;-webkit-text-fill-color:transparent;caret-color:var(--accent,#61dafb);overflow:auto;}",
    ".ed-input::selection{background:rgba(97,218,251,.30);-webkit-text-fill-color:transparent;}",
    ".ed-input::-moz-selection{background:rgba(97,218,251,.30);}",
    ".ed-wrap.readonly .ed-input{display:none;}",
    ".ed-wrap.readonly .ed-hl{position:relative;inset:auto;overflow:auto;}",
    /* ------- màu token ------- */
    ".tk-cm{color:var(--cm,#5c6773);font-style:italic;}",
    ".tk-str{color:var(--str,#9ece6a);}",
    ".tk-num{color:var(--num,#7dcfff);}",
    ".tk-kw{color:var(--kw,#ff9e64);}",
    ".tk-fn{color:var(--fn,#e0af68);}",
    ".tk-tag{color:var(--ed-tag,#7ee0d0);}",
    ".tk-attr{color:var(--ed-attr,#c3a6ff);}",
    ".tk-brace{color:var(--ed-brace,#ffd479);}",
    ".tk-punc{color:var(--ed-punc,#8b98a8);}",
    ".tk-txt{color:var(--ed-fg,#d7dee8);}",
    /* code tĩnh (không gõ được) dùng lại cùng bảng màu */
    ".ed-static{margin:0;padding:12px 14px;background:var(--ed-bg,#0f141a);border-radius:10px;overflow:auto;",
    "  font-family:ui-monospace,'JetBrains Mono',Menlo,Consolas,monospace;font-size:12.5px;line-height:1.55;color:var(--ed-fg,#d7dee8);white-space:pre;}"
  ].join("\n");

  function injectCss() {
    if (document.getElementById("code-editor-css")) return;
    var st = document.createElement("style");
    st.id = "code-editor-css";
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  /* ------------------------------------------------------- 2. Tô màu cú pháp */
  var KEYWORDS = ("import export default from as function return const let var if else for while do " +
    "switch case break continue new class extends super typeof instanceof in of await async try catch " +
    "finally throw delete void yield this null undefined true false").split(" ");
  var KWSET = {};
  KEYWORDS.forEach(function (k) { KWSET[k] = 1; });

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /**
   * Máy quét token viết tay (~100 dòng) — đủ dùng cho JS/JSX của khoá học,
   * không kéo thêm thư viện. Trả về chuỗi HTML.
   *
   * `inTag`  = đang ở giữa <Tag ... > nên identifier là TÊN THUỘC TÍNH.
   * `depth`  = độ sâu { } bên trong tag, để dấu > của mũi tên () => x
   *            không bị hiểu nhầm là kết thúc tag.
   */
  function highlight(src) {
    var out = [], i = 0, n = src.length, inTag = false, depth = 0, prev = "";
    function push(cls, text) {
      out.push(cls ? '<span class="tk-' + cls + '">' + esc(text) + "</span>" : esc(text));
      if (/\S/.test(text)) prev = text;
    }
    while (i < n) {
      var c = src[i], c2 = src[i + 1] || "", rest;

      // -- chú thích --
      if (c === "/" && c2 === "/") {
        var e1 = src.indexOf("\n", i); if (e1 < 0) e1 = n;
        push("cm", src.slice(i, e1)); i = e1; continue;
      }
      if (c === "/" && c2 === "*") {
        var e2 = src.indexOf("*/", i + 2); e2 = e2 < 0 ? n : e2 + 2;
        push("cm", src.slice(i, e2)); i = e2; continue;
      }

      // -- chuỗi ' " ` --
      if (c === '"' || c === "'" || c === "`") {
        var j = i + 1;
        while (j < n) {
          if (src[j] === "\\") { j += 2; continue; }
          if (src[j] === c) { j++; break; }
          if (c !== "`" && src[j] === "\n") break;
          j++;
        }
        push("str", src.slice(i, j)); i = j; continue;
      }

      // -- thẻ JSX mở/đóng: <View  </View  (không nhầm với phép so sánh a < b) --
      if (c === "<" && /[A-Za-z\/>]/.test(c2) && !/[\w$)\]]$/.test(prev)) {
        rest = src.slice(i);
        var m = /^<\/?\s*([A-Za-z][\w.$]*)/.exec(rest);
        if (m) {
          push("punc", m[0].slice(0, m[0].length - m[1].length));
          push("tag", m[1]);
          i += m[0].length; inTag = true; depth = 0; continue;
        }
        if (/^<\/?>/.test(rest)) {           // Fragment <> </>
          var frag = /^<\/?>/.exec(rest)[0];
          push("tag", frag); i += frag.length; continue;
        }
      }
      if (inTag && c === "/" && c2 === ">") { push("punc", "/>"); i += 2; inTag = false; continue; }
      if (inTag && c === ">" && depth === 0) { push("punc", ">"); i++; inTag = false; continue; }

      // -- số --
      if (/[0-9]/.test(c)) {
        var mn = /^[0-9][\w.]*/.exec(src.slice(i));
        push("num", mn[0]); i += mn[0].length; continue;
      }

      // -- định danh / từ khoá --
      if (/[A-Za-z_$]/.test(c)) {
        var mi = /^[A-Za-z_$][\w$]*/.exec(src.slice(i));
        var w = mi[0], after = src.slice(i + w.length), cls;
        if (KWSET[w]) cls = "kw";
        else if (inTag && depth === 0) cls = "attr";
        else if (/^\s*\(/.test(after)) cls = "fn";
        else if (/^[A-Z]/.test(w)) cls = "tag";
        else cls = "txt";
        push(cls, w); i += w.length; continue;
      }

      // -- ngoặc nhọn (biểu thức JS trong JSX) --
      if (c === "{") { if (inTag) depth++; push("brace", c); i++; continue; }
      if (c === "}") { if (inTag && depth > 0) depth--; push("brace", c); i++; continue; }

      // -- toán tử / dấu câu --
      if ("()[];,.:?!=+-*/%&|^~<>".indexOf(c) >= 0) { push("punc", c); i++; continue; }

      push("", c); i++;
    }
    return out.join("");
  }

  /* ------------------------------------------------------------ 3. Editor */
  function mount(container, initial, opts) {
    injectCss();
    opts = opts || {};
    var value = initial == null ? "" : String(initial);

    var wrap = document.createElement("div");
    wrap.className = "ed-wrap";
    var gutter = document.createElement("div");
    gutter.className = "ed-gutter";
    var area = document.createElement("div");
    area.className = "ed-area";
    var pre = document.createElement("pre");
    pre.className = "ed-hl";
    pre.setAttribute("aria-hidden", "true");
    var codeEl = document.createElement("code");
    pre.appendChild(codeEl);

    var ta = document.createElement("textarea");
    ta.className = "ed-input";
    ta.spellcheck = false;
    ta.value = value;
    ta.setAttribute("autocapitalize", "off");
    ta.setAttribute("autocorrect", "off");
    ta.setAttribute("autocomplete", "off");
    ta.setAttribute("aria-label", opts.label || "Trình soạn code");

    area.appendChild(pre);
    area.appendChild(ta);
    wrap.appendChild(gutter);
    wrap.appendChild(area);
    if (opts.minHeight) wrap.style.minHeight = opts.minHeight;
    container.appendChild(wrap);

    /* --- vẽ lại lớp màu + số dòng --- */
    function paint() {
      var v = ta.value;
      // thêm "\n" cuối để trình duyệt không nuốt dòng trống cuối cùng của <pre>
      codeEl.innerHTML = highlight(v) + "\n";
      var lines = v.split("\n").length;
      var g = "";
      for (var k = 1; k <= lines; k++) g += k + "\n";
      gutter.textContent = g;
      syncScroll();
      if (opts.onChange) opts.onChange(v);
    }
    function syncScroll() {
      pre.scrollTop = ta.scrollTop;
      pre.scrollLeft = ta.scrollLeft;
      gutter.scrollTop = ta.scrollTop;
    }

    /* --- chèn text nhưng vẫn giữ được Ctrl+Z của trình duyệt --- */
    function insert(text) {
      ta.focus();
      var ok = false;
      try { ok = document.execCommand("insertText", false, text); } catch (e) { ok = false; }
      if (!ok) {
        var s = ta.selectionStart, e2 = ta.selectionEnd;
        ta.value = ta.value.slice(0, s) + text + ta.value.slice(e2);
        ta.selectionStart = ta.selectionEnd = s + text.length;
      }
      paint();
    }

    ta.addEventListener("input", paint);
    ta.addEventListener("scroll", syncScroll);
    ta.addEventListener("keydown", function (e) {
      // Ctrl/Cmd + Enter = chạy
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (opts.onRun) opts.onRun();
        return;
      }
      // Tab = thụt 2 dấu cách (không nhảy khỏi ô)
      if (e.key === "Tab") {
        e.preventDefault();
        var s = ta.selectionStart, en = ta.selectionEnd;
        if (s !== en && ta.value.slice(s, en).indexOf("\n") >= 0) {
          // thụt/lùi cả khối đang bôi đen
          var from = ta.value.lastIndexOf("\n", s - 1) + 1;
          var block = ta.value.slice(from, en);
          var next = e.shiftKey
            ? block.replace(/^ {1,2}/gm, "")
            : block.replace(/^/gm, "  ");
          ta.setSelectionRange(from, en);
          insert(next);
          ta.setSelectionRange(from, from + next.length);
        } else if (e.shiftKey) {
          var ls = ta.value.lastIndexOf("\n", s - 1) + 1;
          if (ta.value.slice(ls, ls + 2) === "  ") {
            ta.setSelectionRange(ls, ls + 2); insert("");
            ta.setSelectionRange(s - 2, s - 2);
          }
        } else insert("  ");
        return;
      }
      // Enter = xuống dòng và giữ nguyên mức thụt lề (thêm 1 mức sau { ( [)
      if (e.key === "Enter" && !e.shiftKey) {
        var p = ta.selectionStart;
        if (p !== ta.selectionEnd) return;
        var lineStart = ta.value.lastIndexOf("\n", p - 1) + 1;
        var line = ta.value.slice(lineStart, p);
        var indent = (/^[ \t]*/.exec(line) || [""])[0];
        var extra = /[{([]\s*$/.test(line) ? "  " : "";
        var closing = /^\s*[}\])]/.test(ta.value.slice(p));
        e.preventDefault();
        if (extra && closing) insert("\n" + indent + extra + "\n" + indent);
        else insert("\n" + indent + extra);
        if (extra && closing) ta.setSelectionRange(p + 1 + indent.length + 2, p + 1 + indent.length + 2);
      }
    });

    paint();

    return {
      el: wrap,
      textarea: ta,
      getValue: function () { return ta.value; },
      setValue: function (v) { ta.value = v == null ? "" : String(v); paint(); },
      focus: function () { ta.focus(); },
      lineText: function (n) { return (ta.value.split("\n")[n - 1] || ""); },
      destroy: function () { wrap.remove(); }
    };
  }

  /** Hiện một khối code TĨNH (không sửa được) nhưng vẫn tô màu — dùng cho đáp án. */
  function staticBlock(code) {
    injectCss();
    var pre = document.createElement("pre");
    pre.className = "ed-static";
    var c = document.createElement("code");
    c.innerHTML = highlight(String(code));
    pre.appendChild(c);
    return pre;
  }

  window.CodeEditor = { mount: mount, highlight: highlight, staticBlock: staticBlock };
})();
