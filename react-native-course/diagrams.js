/* ============================================================================
 * diagrams.js — Hình vẽ TƯƠNG TÁC cho phần 3 của mỗi bài.
 * Mỗi hàm nhận (container) và tự dựng UI. Đăng ký trong window.Diagrams[id].
 * app.js sẽ gọi window.Diagrams[id](el) khi diagram.type === 'custom'.
 * ==========================================================================*/
(function () {
  "use strict";
  var D = {};

  function h(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  /* ---------- 1. JSX -> cây phần tử ---------- */
  D["jsx-tree"] = function (root) {
    root.innerHTML =
      '<div class="dg-caption">JSX bạn viết chỉ là "đường tắt" của lời gọi tạo phần tử. Di chuột vào từng dòng.</div>' +
      '<div class="dg-jsx-grid">' +
      '  <div class="dg-col"><div class="dg-col-h">Bạn viết (JSX)</div>' +
      '    <pre class="dg-pre">' +
      '<span class="dg-l" data-k="v">&lt;View&gt;</span>\n' +
      '  <span class="dg-l" data-k="t">&lt;Text&gt;Xin chào&lt;/Text&gt;</span>\n' +
      '<span class="dg-l" data-k="v">&lt;/View&gt;</span></pre></div>' +
      '  <div class="dg-arrow">➜</div>' +
      '  <div class="dg-col"><div class="dg-col-h">React hiểu thành (cây)</div>' +
      '    <div class="dg-tree">' +
      '      <div class="dg-node" data-k="v">View' +
      '        <div class="dg-node child" data-k="t">Text → "Xin chào"</div>' +
      '      </div>' +
      '    </div></div>' +
      '</div>';
    var ls = root.querySelectorAll(".dg-l");
    var ns = root.querySelectorAll(".dg-node");
    function hi(k, on) {
      ls.forEach(function (x) { if (x.dataset.k === k) x.classList.toggle("hot", on); });
      ns.forEach(function (x) { if (x.dataset.k === k) x.classList.toggle("hot", on); });
    }
    [].forEach.call(root.querySelectorAll("[data-k]"), function (x) {
      x.addEventListener("mouseenter", function () { hi(x.dataset.k, true); });
      x.addEventListener("mouseleave", function () { hi(x.dataset.k, false); });
    });
  };

  /* ---------- 2. Luồng props cha -> con ---------- */
  D["props-flow"] = function (root) {
    var names = ["An", "Bình", "Chi", "Dũng"];
    var idx = 0;
    root.innerHTML =
      '<div class="dg-caption">Component <b>cha</b> truyền dữ liệu xuống <b>con</b> qua <b>props</b>. Bấm nút để đổi giá trị và xem nó "chảy" xuống.</div>' +
      '<div class="dg-flow">' +
      '  <div class="dg-box parent">Cha<br><small>&lt;Greeting name="<span class="dg-val">An</span>" /&gt;</small></div>' +
      '  <div class="dg-pipe"><span class="dg-token">name = "<span class="dg-val2">An</span>"</span></div>' +
      '  <div class="dg-box child">Con: Greeting<br><small>props.name → <span class="dg-out">An</span></small></div>' +
      '</div>' +
      '<button class="dg-btn">Đổi tên (props mới)</button>';
    var btn = root.querySelector(".dg-btn");
    btn.addEventListener("click", function () {
      idx = (idx + 1) % names.length;
      var v = names[idx];
      root.querySelector(".dg-val").textContent = v;
      root.querySelector(".dg-val2").textContent = v;
      var tok = root.querySelector(".dg-token");
      var out = root.querySelector(".dg-out");
      tok.classList.remove("move"); void tok.offsetWidth; tok.classList.add("move");
      setTimeout(function () { out.textContent = v; out.classList.add("flash"); setTimeout(function () { out.classList.remove("flash"); }, 400); }, 450);
    });
  };

  /* ---------- 3. State thay đổi -> re-render ---------- */
  D["state-rerender"] = function (root) {
    var count = 0, renders = 0;
    root.innerHTML =
      '<div class="dg-caption">Gọi <code>setCount</code> làm <b>state đổi</b> → React <b>render lại</b> component → UI cập nhật. Bấm thử.</div>' +
      '<div class="dg-rr">' +
      '  <div class="dg-rr-cell"><div class="dg-rr-k">state.count</div><div class="dg-rr-v" id="rrCount">0</div></div>' +
      '  <div class="dg-rr-arrow">gọi setCount ➜ render lại ➜</div>' +
      '  <div class="dg-rr-cell"><div class="dg-rr-k">UI hiển thị</div><div class="dg-rr-ui" id="rrUi">Bạn đã bấm 0 lần</div></div>' +
      '</div>' +
      '<div class="dg-rr-foot">Số lần render: <b id="rrN">1</b></div>' +
      '<button class="dg-btn">setCount(count + 1)</button>';
    root.querySelector(".dg-btn").addEventListener("click", function () {
      count++; renders++;
      var c = root.querySelector("#rrCount"), ui = root.querySelector("#rrUi");
      c.textContent = count; c.classList.add("flash");
      ui.textContent = "Bạn đã bấm " + count + " lần";
      root.querySelector("#rrN").textContent = renders + 1;
      var box = root.querySelector(".dg-rr");
      box.classList.remove("pulse"); void box.offsetWidth; box.classList.add("pulse");
      setTimeout(function () { c.classList.remove("flash"); }, 400);
    });
  };

  /* ---------- 4. Vòng đời useEffect ---------- */
  D["useeffect-lifecycle"] = function (root) {
    root.innerHTML =
      '<div class="dg-caption">Chọn dependency array để xem <code>useEffect</code> chạy khi nào (so với vòng đời).</div>' +
      '<div class="dg-tabs">' +
      '  <button class="dg-tab active" data-d="empty">[] rỗng</button>' +
      '  <button class="dg-tab" data-d="dep">[count]</button>' +
      '  <button class="dg-tab" data-d="none">không có array</button>' +
      '</div>' +
      '<div class="dg-life">' +
      '  <div class="dg-life-row"><span class="dg-life-ph">Mount (hiện lần đầu)</span><span class="dg-life-fire" data-p="mount">effect chạy</span></div>' +
      '  <div class="dg-life-row"><span class="dg-life-ph">Re-render (count đổi)</span><span class="dg-life-fire" data-p="update">effect chạy</span></div>' +
      '  <div class="dg-life-row"><span class="dg-life-ph">Re-render (thứ khác đổi)</span><span class="dg-life-fire" data-p="other">effect chạy</span></div>' +
      '  <div class="dg-life-row"><span class="dg-life-ph">Unmount (biến mất)</span><span class="dg-life-fire" data-p="cleanup">cleanup chạy</span></div>' +
      '</div>';
    var map = {
      empty: { mount: 1, update: 0, other: 0, cleanup: 1 },
      dep: { mount: 1, update: 1, other: 0, cleanup: 1 },
      none: { mount: 1, update: 1, other: 1, cleanup: 1 }
    };
    function apply(d) {
      var m = map[d];
      [].forEach.call(root.querySelectorAll(".dg-life-fire"), function (f) {
        f.classList.toggle("on", !!m[f.dataset.p]);
      });
    }
    [].forEach.call(root.querySelectorAll(".dg-tab"), function (t) {
      t.addEventListener("click", function () {
        root.querySelectorAll(".dg-tab").forEach(function (x) { x.classList.remove("active"); });
        t.classList.add("active"); apply(t.dataset.d);
      });
    });
    apply("empty");
  };

  /* ---------- 5. Playground Flexbox ---------- */
  D["flexbox"] = function (root) {
    root.innerHTML =
      '<div class="dg-caption">Chỉnh các thuộc tính Flexbox và xem 3 ô di chuyển. Đây chính là cách bố cục trong React Native.</div>' +
      '<div class="dg-fb-controls">' +
      '  <label>flexDirection <select id="fbDir"><option>row</option><option selected>column</option></select></label>' +
      '  <label>justifyContent <select id="fbJust"><option>flex-start</option><option>center</option><option>space-between</option><option>space-around</option></select></label>' +
      '  <label>alignItems <select id="fbAlign"><option>stretch</option><option>flex-start</option><option>center</option><option>flex-end</option></select></label>' +
      '</div>' +
      '<div class="dg-fb-stage" id="fbStage">' +
      '  <div class="dg-fb-item">1</div><div class="dg-fb-item">2</div><div class="dg-fb-item">3</div>' +
      '</div>' +
      '<pre class="dg-pre" id="fbCode"></pre>';
    var stage = root.querySelector("#fbStage");
    var dir = root.querySelector("#fbDir"), just = root.querySelector("#fbJust"), align = root.querySelector("#fbAlign");
    function upd() {
      stage.style.flexDirection = dir.value;
      stage.style.justifyContent = just.value;
      stage.style.alignItems = align.value;
      root.querySelector("#fbCode").textContent =
        "container: {\n  flex: 1,\n  flexDirection: '" + dir.value + "',\n  justifyContent: '" + just.value + "',\n  alignItems: '" + align.value + "',\n}";
    }
    [dir, just, align].forEach(function (s) { s.addEventListener("change", upd); });
    upd();
  };

  /* ---------- 6. Danh sách & key ---------- */
  D["list-keys"] = function (root) {
    var items = [{ id: 1, t: "🍎 Táo" }, { id: 2, t: "🍌 Chuối" }, { id: 3, t: "🍊 Cam" }];
    root.innerHTML =
      '<div class="dg-caption"><code>.map()</code> biến mảng dữ liệu thành mảng phần tử UI. Mỗi phần tử cần <code>key</code> duy nhất để React theo dõi.</div>' +
      '<div class="dg-lk"><div class="dg-lk-col"><div class="dg-col-h">Dữ liệu (mảng)</div><div id="lkData"></div></div>' +
      '<div class="dg-arrow">.map()➜</div>' +
      '<div class="dg-lk-col"><div class="dg-col-h">UI render ra</div><div id="lkUi"></div></div></div>' +
      '<button class="dg-btn">+ Thêm phần tử</button>';
    var next = 4;
    function draw() {
      var dEl = root.querySelector("#lkData"), uEl = root.querySelector("#lkUi");
      dEl.innerHTML = ""; uEl.innerHTML = "";
      items.forEach(function (it) {
        dEl.appendChild(h("div", "dg-lk-row", "{ id: " + it.id + ", t: '" + it.t + "' }"));
        var row = h("div", "dg-lk-item");
        row.innerHTML = '<span class="dg-key">key=' + it.id + "</span> " + it.t;
        uEl.appendChild(row);
      });
    }
    root.querySelector(".dg-btn").addEventListener("click", function () {
      var pool = ["🍇 Nho", "🥝 Kiwi", "🍑 Đào", "🍍 Dứa"];
      items.push({ id: next, t: pool[(next - 1) % pool.length] }); next++;
      draw();
    });
    draw();
  };

  /* ---------- 7. Lifting state up ---------- */
  D["lifting-state"] = function (root) {
    var v = 0;
    root.innerHTML =
      '<div class="dg-caption">State chung được đặt ở <b>cha</b>. Hai con dùng chung: một con sửa, con kia thấy ngay. Bấm nút ở con A.</div>' +
      '<div class="dg-lift">' +
      '  <div class="dg-box parent">Cha (giữ state: <span class="dg-val">0</span>)</div>' +
      '  <div class="dg-lift-children">' +
      '    <div class="dg-box child">Con A<br><button class="dg-btn small">+1</button></div>' +
      '    <div class="dg-box child">Con B<br><small>hiển thị: <span class="dg-out">0</span></small></div>' +
      '  </div>' +
      '</div>';
    root.querySelector(".dg-btn").addEventListener("click", function () {
      v++;
      root.querySelector(".dg-val").textContent = v;
      var o = root.querySelector(".dg-out");
      o.textContent = v; o.classList.add("flash");
      setTimeout(function () { o.classList.remove("flash"); }, 400);
    });
  };

  window.Diagrams = D;
})();
