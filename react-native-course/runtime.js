/* ============================================================================
 * runtime.js — "Expo Snack" thu nhỏ cho React Native chạy thẳng trong trình duyệt
 * ----------------------------------------------------------------------------
 * Ý tưởng:
 *   1. Người học sửa code JSX trong <textarea>.
 *   2. Bấm "Run": Babel (vendor/babel.min.js) transpile JSX -> JS ngay tại trang.
 *   3. Code đã transpile được nhét vào 1 <iframe> sandbox. Trong iframe có
 *      "importmap" trỏ 'react-native' -> react-native-web (esm.sh) nên
 *      <View>/<Text>/StyleSheet... chạy được như app thật.
 *   4. console.log và lỗi trong iframe được postMessage về khung "Console" bên dưới.
 *
 * KHÔNG cần build tool. Chỉ cần internet để tải react-native-web lần đầu (esm.sh).
 * ==========================================================================*/
(function () {
  "use strict";

  var RN_WEB = "https://esm.sh/react-native-web@0.19.13?external=react,react-dom";
  var REACT = "https://esm.sh/react@18.3.1";
  var REACT_DOM = "https://esm.sh/react-dom@18.3.1";

  // HTML cho iframe preview. __CODE_URL__ được thay bằng blob URL của code người dùng.
  function iframeDoc() {
    return [
      "<!DOCTYPE html><html><head><meta charset='utf-8'>",
      "<meta name='viewport' content='width=device-width,initial-scale=1'>",
      "<style>",
      "  html,body,#root{height:100%;margin:0;padding:0;}",
      "  body{background:#fff;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;overflow:hidden;}",
      "  #root{display:flex;flex-direction:column;}",
      "  .__boot{padding:16px;color:#8a94a6;font-size:13px;}",
      "</style>",
      "<script type='importmap'>",
      JSON.stringify({
        imports: {
          "react": REACT,
          "react/jsx-runtime": REACT + "/jsx-runtime",
          "react-dom": REACT_DOM,
          "react-dom/client": REACT_DOM + "/client",
          "react-native": RN_WEB,
          "react-native-web": RN_WEB
        }
      }),
      "</scr" + "ipt>",
      "</head><body><div id='root'><div class='__boot'>Đang tải React Native…</div></div>",
      "<script type='module'>",
      bootScript(),
      "</scr" + "ipt>",
      "</body></html>"
    ].join("\n");
  }

  // Script khởi động bên trong iframe (chạy như module).
  function bootScript() {
    return [
      "const send=(t,p)=>{try{parent.postMessage({__snack:1,type:t,payload:p},'*')}catch(e){}};",
      // Chuyển console.* của iframe về khung Console của trang cha
      "function fmt(v){try{if(typeof v==='string')return v;if(v instanceof Error)return v.message;return JSON.stringify(v)}catch(e){return String(v)}}",
      "['log','info','warn','error'].forEach(function(k){var o=console[k].bind(console);console[k]=function(){var a=[].slice.call(arguments);o.apply(null,a);send('log',{level:k,text:a.map(fmt).join(' ')})}});",
      "window.addEventListener('error',function(e){send('err',{text:(e.error&&e.error.stack)||e.message})});",
      "window.addEventListener('unhandledrejection',function(e){send('err',{text:String((e.reason&&e.reason.stack)||e.reason)})});",
      // Nạp code người dùng + render
      "(async function(){try{",
      "  const mod=await import('__CODE_URL__');",
      "  const App=mod.default;",
      "  if(typeof App!=='function'){send('err',{text:'Code cần `export default` một component (một function trả về JSX).'});return;}",
      "  const React=(await import('react')).default;",
      "  const {createRoot}=await import('react-dom/client');",
      "  const {AppRegistry}=await import('react-native');",
      "  createRoot(document.getElementById('root')).render(React.createElement(App));",
      "  send('ready',{});",
      "}catch(err){send('err',{text:(err&&err.stack)||String(err)});}})();"
    ].join("\n");
  }

  // ---- 1 instance editor ----
  function mount(container, initialCode, opts) {
    opts = opts || {};
    container.innerHTML = "";
    container.classList.add("snack");

    // Thanh công cụ
    var bar = el("div", "snack-bar");
    var runBtn = el("button", "snack-run", "▶ Run");
    var resetBtn = el("button", "snack-reset", "↺ Reset");
    var title = el("span", "snack-title", opts.title || "App.js");
    bar.appendChild(title);
    var spacer = el("span", "snack-spacer");
    bar.appendChild(spacer);
    bar.appendChild(resetBtn);
    bar.appendChild(runBtn);

    // Khu vực code + preview (2 cột)
    var body = el("div", "snack-body");

    var editorWrap = el("div", "snack-editor-wrap");
    var lines = el("div", "snack-lines");
    var ta = document.createElement("textarea");
    ta.className = "snack-editor";
    ta.spellcheck = false;
    ta.value = initialCode;
    editorWrap.appendChild(lines);
    editorWrap.appendChild(ta);

    var previewWrap = el("div", "snack-preview-wrap");
    var phone = el("div", "snack-phone");
    var notch = el("div", "snack-notch");
    var iframe = document.createElement("iframe");
    iframe.className = "snack-iframe";
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
    phone.appendChild(notch);
    phone.appendChild(iframe);
    previewWrap.appendChild(phone);

    body.appendChild(editorWrap);
    body.appendChild(previewWrap);

    // Console
    var consoleBox = el("div", "snack-console");
    var consoleHead = el("div", "snack-console-head", "Console");
    var clearBtn = el("button", "snack-clear", "Xoá");
    consoleHead.appendChild(clearBtn);
    var consoleBody = el("div", "snack-console-body");
    consoleBox.appendChild(consoleHead);
    consoleBox.appendChild(consoleBody);

    container.appendChild(bar);
    container.appendChild(body);
    container.appendChild(consoleBox);

    // ---- hành vi editor ----
    function syncLines() {
      var n = ta.value.split("\n").length;
      var html = "";
      for (var i = 1; i <= n; i++) html += i + "<br>";
      lines.innerHTML = html;
      lines.scrollTop = ta.scrollTop;
    }
    ta.addEventListener("input", syncLines);
    ta.addEventListener("scroll", function () { lines.scrollTop = ta.scrollTop; });
    ta.addEventListener("keydown", function (e) {
      if (e.key === "Tab") {
        e.preventDefault();
        var s = ta.selectionStart, en = ta.selectionEnd;
        ta.value = ta.value.slice(0, s) + "  " + ta.value.slice(en);
        ta.selectionStart = ta.selectionEnd = s + 2;
        syncLines();
      }
      // Ctrl/Cmd + Enter = Run
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); run(); }
    });
    syncLines();

    // ---- console ----
    function logLine(level, text) {
      var line = el("div", "snack-log " + level);
      line.textContent = (level === "err" ? "⛔ " : level === "warn" ? "⚠️ " : "› ") + text;
      consoleBody.appendChild(line);
      consoleBody.scrollTop = consoleBody.scrollHeight;
    }
    clearBtn.onclick = function () { consoleBody.innerHTML = ""; };

    // ---- chạy code ----
    var currentUrl = null;
    function run() {
      consoleBody.innerHTML = "";
      var code = ta.value;
      var transpiled;
      try {
        transpiled = window.Babel.transform(code, {
          presets: [["react", { runtime: "automatic" }]],
          filename: "App.js"
        }).code;
      } catch (err) {
        logLine("err", "Lỗi cú pháp: " + (err.message || err));
        return;
      }
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      var blob = new Blob([transpiled], { type: "text/javascript" });
      currentUrl = URL.createObjectURL(blob);
      var doc = iframeDoc().replace("__CODE_URL__", currentUrl);
      iframe.srcdoc = doc;
    }
    runBtn.onclick = run;
    resetBtn.onclick = function () {
      ta.value = initialCode; syncLines(); run();
    };

    // nhận message từ iframe
    var handler = function (ev) {
      var d = ev.data;
      if (!d || d.__snack !== 1) return;
      if (d.type === "log") logLine(d.payload.level === "error" ? "err" : d.payload.level, d.payload.text);
      else if (d.type === "err") logLine("err", d.payload.text);
    };
    window.addEventListener("message", handler);

    // chạy lần đầu (khi phần tử đã hiển thị)
    var started = false;
    function boot() { if (started) return; started = true; run(); }
    if (opts.lazy) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { boot(); io.disconnect(); } });
      });
      io.observe(container);
    } else {
      boot();
    }

    return {
      run: run,
      getCode: function () { return ta.value; },
      destroy: function () { window.removeEventListener("message", handler); if (currentUrl) URL.revokeObjectURL(currentUrl); }
    };
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  window.Snack = { mount: mount };
})();
