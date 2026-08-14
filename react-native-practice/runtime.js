/* ============================================================================
 * runtime.js — "Expo Snack + bộ chấm bài" cho khoá THỰC HÀNH React Native.
 * ----------------------------------------------------------------------------
 * Khác với khoá lý thuyết ở 3 điểm:
 *   1. CHẤM BÀI: mỗi bài kèm danh sách `checks`. Sau khi render xong, các check
 *      được chạy NGAY TRONG iframe (được thao tác thật với DOM đã render:
 *      bấm nút, gõ chữ, đọc text) rồi gửi kết quả về trang cha.
 *   2. STACK TRACE: Babel transpile với retainLines nên số dòng sau khi biên dịch
 *      trùng số dòng bạn viết. Lỗi lúc chạy được in NGUYÊN stack + trích 5 dòng
 *      code quanh chỗ lỗi (code frame) để debug.
 *   3. ErrorBoundary: lỗi khi render component không làm trắng màn hình mà hiện
 *      thông báo + componentStack.
 *
 * Luồng: sửa code -> Babel (vendor) -> blob URL -> <iframe srcdoc> có importmap
 *        trỏ 'react-native' -> react-native-web (esm.sh) -> render -> chạy check.
 * ==========================================================================*/
(function () {
  "use strict";

  var RN_WEB = "https://esm.sh/react-native-web@0.19.13?external=react,react-dom";
  var REACT = "https://esm.sh/react@18.3.1";
  var REACT_DOM = "https://esm.sh/react-dom@18.3.1";

  /* --------------------------------------------------------------------------
   * Script chạy BÊN TRONG iframe. Tự nó là một chuỗi nên viết bằng nối mảng.
   * __CODE_URL__ / __CHECKS__ / __SRC__ được thay trước khi nhúng.
   * ------------------------------------------------------------------------*/
  function bootScript() {
    return [
      "const CHECKS = __CHECKS__;",
      "const SRC = __SRC__;",
      "const LOGS = [];",
      "const send=(t,p)=>{try{parent.postMessage({__snack:1,type:t,payload:p},'*')}catch(e){}};",
      "function fmt(v){try{if(typeof v==='string')return v;if(v instanceof Error)return (v.stack||v.message);return JSON.stringify(v)}catch(e){return String(v)}}",
      "['log','info','warn','error'].forEach(function(k){var o=console[k].bind(console);console[k]=function(){var a=[].slice.call(arguments);o.apply(null,a);var line=a.map(fmt).join(' ');LOGS.push({level:k,text:line});send('log',{level:k,text:line})}});",
      "window.addEventListener('error',function(e){send('err',{text:(e.error&&e.error.stack)||e.message})});",
      "window.addEventListener('unhandledrejection',function(e){send('err',{text:String((e.reason&&e.reason.stack)||e.reason)})});",

      /* ---------------- helper dùng trong check ---------------- */
      "const ROOT=()=>document.getElementById('root')||document.body;",
      "function text(){var r=ROOT();return (r.innerText||r.textContent||'').replace(/\\u00a0/g,' ');}",
      "function q(s){return ROOT().querySelector(s);}",
      "function qa(s){return Array.prototype.slice.call(ROOT().querySelectorAll(s));}",
      "function count(s){return qa(s).length;}",
      "function wait(ms){return new Promise(function(r){setTimeout(r,ms||60)});}",
      "async function until(fn,timeout){var t=timeout||2000,step=50,waited=0;while(waited<t){try{if(await fn())return true}catch(e){}await wait(step);waited+=step;}return false;}",
      "function expect(cond,msg){if(!cond)throw new Error(msg||'Điều kiện không thoả');return true;}",
      // Tìm phần tử SÂU NHẤT mang đoạn chữ t.
      // Ưu tiên khớp CHÍNH XÁC trước: nếu tìm 'Rau' mà trên màn hình có cả nút 'Rau'
      // lẫn dòng 'Rau muống' thì phải chọn đúng cái nút.
      // (querySelectorAll trả về theo thứ tự tài liệu nên con luôn đứng sau cha
      //  => phần tử cuối cùng là phần tử sâu nhất.)
      "function findByText(t){var all=qa('*');",
      "  var exact=all.filter(function(e){return (e.textContent||'').trim()===t});",
      "  var pool=exact.length?exact:all.filter(function(e){return (e.textContent||'').indexOf(t)>=0});",
      "  return pool.length?pool[pool.length-1]:null;}",
      "function center(el){var r=el.getBoundingClientRect();return {x:Math.round(r.left+Math.min(r.width/2,4)),y:Math.round(r.top+Math.min(r.height/2,4))};}",
      // react-native-web: mousedown/mouseup lo phần onPressIn/onPressOut, còn onPress
      // thực sự bắn ra từ sự kiện 'click'. Thiếu 'click' là bấm giả lập không ăn.
      // Cả cụm 3 sự kiện này chỉ tạo ĐÚNG MỘT lần onPress (đã đo bằng thực nghiệm).
      "function fire(el,type,c,btns){var ev=new MouseEvent(type,{bubbles:true,cancelable:true,composed:true,view:window,button:0,buttons:btns,detail:1,clientX:c.x,clientY:c.y});el.dispatchEvent(ev);}",
      "async function press(target){var el=typeof target==='string'?findByText(target):target;",
      "  if(!el)throw new Error('Không tìm thấy chỗ để bấm: '+target);",
      "  var c=center(el);fire(el,'mousedown',c,1);await wait(16);fire(el,'mouseup',c,0);fire(el,'click',c,0);",
      "  await wait(140);return true;}",
      // gõ vào TextInput: React ghi đè setter của .value nên phải gọi setter gốc
      // rồi tự phát sự kiện 'input' thì React mới nhận được onChangeText.
      "function findInput(target){if(!target)return q('input,textarea');",
      "  if(typeof target!=='string')return target;",
      "  var byPh=qa('input,textarea').filter(function(e){return (e.placeholder||'').indexOf(target)>=0});",
      "  if(byPh.length)return byPh[0];",
      "  try{var s=q(target);if(s)return s}catch(e){}",
      "  return q('input,textarea');}",
      "async function type(target,value){var el=findInput(target);",
      "  if(!el)throw new Error('Không tìm thấy ô nhập (TextInput) nào trên màn hình');",
      "  var proto=el.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype;",
      "  var setter=Object.getOwnPropertyDescriptor(proto,'value').set;",
      "  el.focus();setter.call(el,value);",
      "  el.dispatchEvent(new Event('input',{bubbles:true}));",
      "  await wait(120);return true;}",

      /* ---------------- nạp code người học + render ---------------- */
      "(async function(){",
      "  let App;",
      "  try{",
      "    const mod=await import('__CODE_URL__');",
      "    App=mod.default;",
      "  }catch(err){send('err',{text:(err&&err.stack)||String(err)});send('checks',{fatal:'Code không chạy được — xem Console.'});return;}",
      "  if(typeof App!=='function'){send('err',{text:'Code phải `export default` một component (function trả về JSX).'});send('checks',{fatal:'Thiếu export default'});return;}",
      "  const React=(await import('react')).default;",
      "  const {createRoot}=await import('react-dom/client');",
      "  await import('react-native');",
      // ErrorBoundary: lỗi khi render -> hiện thông báo + componentStack thay vì màn hình trắng
      "  class Boundary extends React.Component{",
      "    constructor(p){super(p);this.state={err:null}}",
      "    static getDerivedStateFromError(err){return {err:err}}",
      "    componentDidCatch(err,info){send('err',{text:(err&&err.stack||String(err))+'\\n\\nComponent stack:'+(info&&info.componentStack||'')});}",
      "    render(){if(this.state.err){return React.createElement('div',{className:'__crash'},'⛔ Lỗi khi render: '+(this.state.err.message||this.state.err));}return this.props.children}",
      "  }",
      "  try{",
      "    createRoot(document.getElementById('root')).render(React.createElement(Boundary,null,React.createElement(App)));",
      "  }catch(err){send('err',{text:(err&&err.stack)||String(err)});send('checks',{fatal:'Không render được'});return;}",
      "  send('ready',{});",
      "  await wait(260);",   // chờ effect / setState lần đầu chạy xong
      "  if(!CHECKS.length){send('checks',{results:[]});return;}",
      "  const AsyncFn=Object.getPrototypeOf(async function(){}).constructor;",
      "  const results=[];",
      "  for(const c of CHECKS){",
      "    let ok=false,detail='';",
      "    try{",
      "      const fn=new AsyncFn('text','q','qa','count','press','type','wait','until','expect','logs','src','findByText',c.test);",
      "      const r=await fn(text,q,qa,count,press,type,wait,until,expect,LOGS,SRC,findByText);",
      "      if(typeof r==='string'){ok=false;detail=r;}else{ok=r!==false;}",
      "    }catch(e){ok=false;detail=(e&&e.message)?e.message:String(e);}",
      "    results.push({label:c.label,ok:ok,detail:detail});",
      "  }",
      "  send('checks',{results:results});",
      "})();"
    ].join("\n");
  }

  function iframeDoc(codeUrl, checks, src) {
    var boot = bootScript()
      .replace("__CODE_URL__", codeUrl)
      .replace("__CHECKS__", safeJson(checks))
      .replace("__SRC__", safeJson(src));
    return [
      "<!DOCTYPE html><html><head><meta charset='utf-8'>",
      "<meta name='viewport' content='width=device-width,initial-scale=1'>",
      "<style>",
      "  html,body,#root{height:100%;margin:0;padding:0;}",
      "  body{background:#fff;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;overflow:hidden;}",
      "  #root{display:flex;flex-direction:column;}",
      "  .__boot{padding:16px;color:#8a94a6;font-size:13px;}",
      "  .__crash{padding:16px;color:#b42318;background:#fff4f2;font-size:13px;line-height:1.5;}",
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
      boot,
      "</scr" + "ipt>",
      "</body></html>"
    ].join("\n");
  }

  // JSON nhúng được vào <script> mà không bị "</script>" cắt ngang
  function safeJson(v) {
    var s = JSON.stringify(v == null ? null : v).replace(/<\//g, "<\\/");
    // U+2028/U+2029 là ký tự xuống dòng với JS -> phải escape khi nhúng vào <script>
    return s.split(String.fromCharCode(8232)).join("\\u2028").split(String.fromCharCode(8233)).join("\\u2029");
  }

  /* ======================================================================
   *  Mount một bài thực hành
   *  opts: { title, checks:[{label,test}], onChecks(state), lazy }
   * ==================================================================== */
  function mount(container, initialCode, opts) {
    opts = opts || {};
    var checks = opts.checks || [];
    container.innerHTML = "";
    container.classList.add("snack");

    /* ---- thanh công cụ ---- */
    var bar = el("div", "snack-bar");
    bar.appendChild(el("span", "snack-title", opts.title || "App.js"));
    bar.appendChild(el("span", "snack-spacer"));
    var resetBtn = el("button", "snack-btn", "↺ Code gốc");
    var runBtn = el("button", "snack-run", "▶ Chạy & Chấm");
    bar.appendChild(resetBtn);
    bar.appendChild(runBtn);

    /* ---- editor + preview ---- */
    var body = el("div", "snack-body");
    var editorWrap = el("div", "snack-editor-wrap");
    var ed = window.CodeEditor.mount(editorWrap, initialCode, { onRun: function () { run(); } });

    var previewWrap = el("div", "snack-preview-wrap");
    var phone = el("div", "snack-phone");
    var notch = el("div", "snack-notch");
    var iframe = document.createElement("iframe");
    iframe.className = "snack-iframe";
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
    phone.appendChild(notch);
    phone.appendChild(iframe);
    previewWrap.appendChild(phone);
    var runHint = el("div", "snack-hintbar", "⌘/Ctrl + Enter để chạy nhanh");
    previewWrap.appendChild(runHint);

    body.appendChild(editorWrap);
    body.appendChild(previewWrap);

    /* ---- console ---- */
    var consoleBox = el("div", "snack-console");
    var consoleHead = el("div", "snack-console-head", "Console & Stack trace");
    var clearBtn = el("button", "snack-clear", "Xoá");
    consoleHead.appendChild(clearBtn);
    var consoleBody = el("div", "snack-console-body");
    consoleBox.appendChild(consoleHead);
    consoleBox.appendChild(consoleBody);

    container.appendChild(bar);
    container.appendChild(body);
    container.appendChild(consoleBox);

    /* ---------------- console + stack trace ---------------- */
    function logLine(level, text) {
      var line = el("div", "snack-log " + level);
      line.textContent = (level === "warn" ? "⚠️ " : "› ") + text;
      consoleBody.appendChild(line);
      trim();
    }

    /**
     * In lỗi kèm STACK TRACE đầy đủ + code frame.
     * Stack trong iframe trỏ tới blob:...:DÒNG:CỘT — nhờ retainLines nên DÒNG
     * chính là dòng trong code bạn đang viết, ta đổi tên blob thành App.js và
     * trích 2 dòng trên/dưới để nhìn thấy ngay chỗ sai.
     */
    var lastErr = { text: "", at: 0 };
    function logError(raw) {
      // blob:http://host/uuid:7:19  ->  App.js:7:19  (giữ lại số dòng:cột ở cuối)
      var t = String(raw == null ? "" : raw).replace(/blob:[^\s)'"]*/g, function (m) {
        var pos = /(:\d+:\d+)$/.exec(m);
        return "App.js" + (pos ? pos[1] : "");
      });
      // React bắn cùng một lỗi ra nhiều đường (window.onerror + ErrorBoundary)
      // -> chỉ in một lần cho đỡ rối.
      var key = t.split("\n")[0];
      var now = Date.now();
      if (key === lastErr.text && now - lastErr.at < 3000) return;
      lastErr = { text: key, at: now };

      var box = el("div", "snack-log err");
      var head = el("div", "snack-err-head", "⛔ " + firstLine(t));
      box.appendChild(head);

      var m = /App\.js:(\d+)(?::(\d+))?/.exec(t);
      if (m) {
        var ln = +m[1];
        var src = ed.getValue().split("\n");
        var frame = document.createElement("pre");
        frame.className = "snack-frame";
        var buf = "";
        for (var i = Math.max(1, ln - 2); i <= Math.min(src.length, ln + 2); i++) {
          // chỉ đánh dấu DÒNG, không đánh dấu cột: retainLines giữ được số dòng
          // nhưng cột thì đã lệch sau khi Babel biên dịch JSX.
          buf += (i === ln ? " > " : "   ") + pad(i, 3) + " | " + src[i - 1] + "\n";
        }
        frame.textContent = buf;
        box.appendChild(frame);
      }

      var det = document.createElement("details");
      det.className = "snack-stack";
      var sum = document.createElement("summary");
      sum.textContent = "Stack trace đầy đủ";
      var pre = document.createElement("pre");
      pre.textContent = t;
      det.appendChild(sum); det.appendChild(pre);
      box.appendChild(det);

      consoleBody.appendChild(box);
      trim();
    }
    function firstLine(s) { return (s.split("\n")[0] || s).slice(0, 300); }
    function pad(n, w) { var s = String(n); while (s.length < w) s = " " + s; return s; }
    function trim() { consoleBody.scrollTop = consoleBody.scrollHeight; }
    clearBtn.onclick = function () { consoleBody.innerHTML = ""; };

    /* ---------------- chạy ---------------- */
    var currentUrl = null;
    var running = false;
    function run() {
      if (running) return;
      running = true;
      runBtn.disabled = true;
      runBtn.textContent = "… đang chạy";
      consoleBody.innerHTML = "";
      if (opts.onChecks) opts.onChecks({ state: "running" });

      var code = ed.getValue();
      var transpiled;
      try {
        transpiled = window.Babel.transform(code, {
          presets: [["react", { runtime: "automatic" }]],
          filename: "App.js",
          retainLines: true          // giữ số dòng => stack trace khớp code của bạn
        }).code;
      } catch (err) {
        // Babel đã kèm sẵn "code frame" trong message -> in nguyên văn
        var box = el("div", "snack-log err");
        box.appendChild(el("div", "snack-err-head", "⛔ Lỗi cú pháp (không biên dịch được)"));
        var pre = document.createElement("pre");
        pre.className = "snack-frame";
        pre.textContent = (err && err.message) || String(err);
        box.appendChild(pre);
        consoleBody.appendChild(box);
        finish();
        if (opts.onChecks) opts.onChecks({ state: "error", message: "Lỗi cú pháp — xem Console." });
        return;
      }

      if (currentUrl) URL.revokeObjectURL(currentUrl);
      currentUrl = URL.createObjectURL(new Blob([transpiled], { type: "text/javascript" }));
      iframe.srcdoc = iframeDoc(currentUrl, checks, code);

      // lưới an toàn: nếu 8s không có kết quả (mất mạng / CDN chậm)
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (!running) return;
        logError("Quá thời gian chờ: iframe chưa render xong sau 8 giây. Kiểm tra kết nối mạng (react-native-web tải từ esm.sh) hoặc vòng lặp vô hạn trong code.");
        finish();
        if (opts.onChecks) opts.onChecks({ state: "error", message: "Hết thời gian chờ." });
      }, 8000);
    }
    var timer = null;
    function finish() {
      running = false;
      runBtn.disabled = false;
      runBtn.textContent = "▶ Chạy & Chấm";
      clearTimeout(timer);
    }

    runBtn.onclick = run;
    resetBtn.onclick = function () {
      if (!confirm("Khôi phục lại code gốc của bài? Phần bạn sửa sẽ mất.")) return;
      ed.setValue(initialCode);
      run();
    };

    /* ---------------- nhận tin từ iframe ---------------- */
    var handler = function (ev) {
      if (ev.source !== iframe.contentWindow) return;
      var d = ev.data;
      if (!d || d.__snack !== 1) return;
      if (d.type === "log") {
        if (d.payload.level === "error") logError(d.payload.text);
        else logLine(d.payload.level, d.payload.text);
      } else if (d.type === "err") {
        logError(d.payload.text);
      } else if (d.type === "checks") {
        finish();
        if (d.payload && d.payload.fatal) {
          if (opts.onChecks) opts.onChecks({ state: "error", message: d.payload.fatal });
        } else if (opts.onChecks) {
          opts.onChecks({ state: "done", results: (d.payload && d.payload.results) || [] });
        }
      }
    };
    window.addEventListener("message", handler);

    /* ---------------- chạy lần đầu ---------------- */
    var started = false;
    function boot() { if (started) return; started = true; run(); }
    if (opts.lazy) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { boot(); io.disconnect(); } });
      });
      io.observe(container);
    } else boot();

    return {
      run: run,
      getCode: function () { return ed.getValue(); },
      setCode: function (c) { ed.setValue(c); },
      destroy: function () {
        window.removeEventListener("message", handler);
        clearTimeout(timer);
        if (currentUrl) URL.revokeObjectURL(currentUrl);
      }
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
