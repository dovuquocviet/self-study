// ===== Visitor Pattern — minh hoạ động (giỏ hàng) =====
// Một tập phần tử ỔN ĐỊNH (Book, Fruit, Electronic). Mỗi THAO TÁC mới
// (tính giá, phí ship, gói quà) được gom vào MỘT lớp Visitor riêng.
// element.accept(v) -> v.visitBook(this)  ← DOUBLE DISPATCH:
//   element biết kiểu thật của mình, visitor biết thao tác cần làm.

// ---- Elements: mỗi loại tự định nghĩa accept() (nửa thứ nhất của dispatch) ----
const items = [
  { type: "Book",       icon: "📕", name: "Head First", price: 120, weight: 0.8,
    accept(v) { return v.visitBook(this); } },
  { type: "Fruit",      icon: "🍎", name: "Táo Fuji",   price: 40,  weight: 1.2,
    accept(v) { return v.visitFruit(this); } },
  { type: "Electronic", icon: "🎧", name: "Tai nghe",   price: 300, weight: 0.3,
    accept(v) { return v.visitElectronic(this); } },
];

// ---- Visitors: mỗi visitor cài 3 method visitXxx (nửa thứ hai của dispatch) ----
const VISITORS = {
  price: {
    name: "PriceVisitor", icon: "🧮", unit: "",
    visitBook(b)       { return { val: +(b.price * 0.9).toFixed(0), how: `${b.price} × 0.9 (sách −10%)` }; },
    visitFruit(f)      { return { val: f.price,                     how: `${f.price} (giá gốc)` }; },
    visitElectronic(e) { return { val: +(e.price * 1.1).toFixed(0), how: `${e.price} × 1.1 (thuế +10%)` }; },
  },
  shipping: {
    name: "ShippingVisitor", icon: "🚚", unit: "",
    visitBook(b)       { return { val: +(b.weight * 5).toFixed(0),       how: `${b.weight}kg × 5` }; },
    visitFruit(f)      { return { val: +(f.weight * 5 + 10).toFixed(0),  how: `${f.weight}kg × 5 + 10 (giữ lạnh)` }; },
    visitElectronic(e) { return { val: +(e.weight * 5 + 20).toFixed(0),  how: `${e.weight}kg × 5 + 20 (bảo hiểm)` }; },
  },
  giftwrap: {
    name: "GiftWrapVisitor", icon: "🎁", unit: "",
    visitBook(b)       { return { val: 5,  how: `bọc giấy = 5` }; },
    visitFruit(f)      { return { val: 0,  how: `không gói quà = 0` }; },
    visitElectronic(e) { return { val: 15, how: `hộp cứng = 15` }; },
  },
};

let current = "price";
let running = false;

// ---- DOM refs ----
const visitorEl   = document.getElementById("visitor");
const itemsEl     = document.getElementById("items");
const trackEl     = document.getElementById("track");
const resultBox   = document.getElementById("result");
const resultTitle = document.getElementById("resultTitle");
const totalVal    = document.getElementById("totalVal");
const visitorBadge= document.getElementById("visitorBadge");
const buildView   = document.getElementById("buildView");
const classView   = document.getElementById("classView");
const btnApply    = document.getElementById("btnApply");
const cards       = [...itemsEl.querySelectorAll(".vs-card")];

// ====== Code TAB 2: định nghĩa lớp (tĩnh) ======
renderCode(classView, [
  "// Element — mọi phần tử cài accept(visitor)",
  "class Item {",
  "  accept(v) {}            // double dispatch (nửa 1)",
  "}",
  "class Book extends Item {",
  "  accept(v) { return v.visitBook(this); }",
  "}",
  "class Fruit extends Item {",
  "  accept(v) { return v.visitFruit(this); }",
  "}",
  "class Electronic extends Item {",
  "  accept(v) { return v.visitElectronic(this); }",
  "}",
  "",
  "// Visitor — interface khai báo 1 method cho MỖI loại element",
  "class Visitor {",
  "  visitBook(b)       {}",
  "  visitFruit(f)      {}",
  "  visitElectronic(e) {}",
  "}",
  "",
  "// Concrete visitor: gom 1 THAO TÁC vào 1 lớp",
  "class PriceVisitor extends Visitor {",
  "  visitBook(b)       { return b.price * 0.9; }",
  "  visitFruit(f)      { return f.price; }",
  "  visitElectronic(e) { return e.price * 1.1; }",
  "}",
  "class ShippingVisitor extends Visitor {",
  "  visitBook(b)       { return b.weight * 5; }",
  "  visitFruit(f)      { return f.weight * 5 + 10; }",
  "  visitElectronic(e) { return e.weight * 5 + 20; }",
  "}",
  "// Thêm visitor mới KHÔNG đụng tới Book/Fruit/Electronic!",
]);

// ====== Code TAB 1: runtime ======
let buildLines = [];
function note(line) { buildLines.push(line); }
function flush() { renderCode(buildView, buildLines); }

function replay(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

function logLine(msg, kind) {
  const div = document.createElement("div");
  div.className = "log-line" + (kind === "muted" ? " muted-line" : "");
  if (kind === "good") div.style.color = "var(--good)";
  div.innerHTML = msg;
  resultBox.appendChild(div);
  resultBox.scrollTop = resultBox.scrollHeight;
}

// ====== Chọn visitor ======
function selectVisitor(key) {
  if (running) return;
  current = key;
  document.querySelectorAll(".visitor-chip").forEach((c) =>
    c.classList.toggle("active", c.dataset.v === key));
  const v = VISITORS[key];
  visitorEl.textContent = v.icon;
  visitorBadge.textContent = v.name;
  resultTitle.textContent = v.name;
  replay(visitorBadge, "flash");
  resetStage();
}

function resetStage() {
  resultBox.innerHTML = '<div class="log-line muted-line">Bấm "Áp dụng" để visitor ghé thăm…</div>';
  totalVal.textContent = "—";
  cards.forEach((c) => {
    c.classList.remove("visiting");
    c.querySelector("[data-out]").classList.remove("show");
    c.querySelector("[data-out]").textContent = "";
  });
  visitorEl.style.left = "0px";
}

function moveVisitorTo(card) {
  const center = card.offsetLeft + card.offsetWidth / 2;
  visitorEl.style.left = center + "px";
}

// ====== Áp dụng: items.forEach(i => i.accept(visitor)) ======
function apply() {
  if (running) return;
  running = true;
  resetStage();
  const v = VISITORS[current];
  let total = 0;

  buildLines = [];
  note(`const visitor = new ${v.name}();`);
  note("let total = 0;");
  note("items.forEach(item => {");
  flush();

  let i = 0;
  function step() {
    if (i >= items.length) {
      note("});");
      note(`// => tổng = ${total}`);
      flush();
      totalVal.textContent = total;
      logLine(`<b>Tổng cộng = ${total}</b>`, "good");
      running = false;
      return;
    }
    const item = items[i];
    const card = cards[i];
    moveVisitorTo(card);

    setTimeout(() => {
      replay(visitorEl, "acting");
      card.classList.add("visiting");
      replay(card, "visiting");

      const r = item.accept(v);          // ← DOUBLE DISPATCH
      total += r.val;

      const out = card.querySelector("[data-out]");
      out.textContent = "= " + r.val;
      replay(out, "show");

      note(`  item.accept(visitor);   // ${item.type}.accept → visitor.visit${item.type}(this)`);
      note(`  //   -> ${r.how} = ${r.val}   (tổng: ${total})`);
      flush();
      logLine(`${item.icon} <b>${item.type}</b>: ${r.how} = <b>${r.val}</b>`);

      i++;
      setTimeout(step, 520);
    }, 560);
  }
  step();
}

// ====== Sự kiện ======
document.getElementById("visitorPicker").addEventListener("click", (e) => {
  const chip = e.target.closest(".visitor-chip");
  if (chip) selectVisitor(chip.dataset.v);
});
btnApply.addEventListener("click", apply);

// ====== Khởi tạo ======
setupTabs();
selectVisitor("price");
renderCode(buildView, [
  "// Cùng MỘT vòng lặp cho mọi visitor:",
  "//   items.forEach(i => i.accept(visitor));",
  "//",
  "// element.accept(v) gọi v.visitBook/Fruit/Electronic(this)",
  "//   -> đây là DOUBLE DISPATCH.",
  "//",
  "// Hãy bấm 'Áp dụng' bên trái để xem visitor ghé thăm.",
]);
