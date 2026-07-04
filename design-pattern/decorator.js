// ===== Decorator Pattern — minh hoạ động =====
// 1 đồ uống gốc (Beverage) được bọc bởi nhiều CondimentDecorator.
// Mỗi lớp bọc tự cộng cost() và mô tả của nó.

class Beverage {
  constructor(name, cost, color, cls) {
    this.name = name; this._cost = cost; this.color = color; this.cls = cls;
  }
  cost() { return this._cost; }
}
class CondimentDecorator {
  constructor(meta, beverage) {
    this.name = meta.name; this._cost = meta.cost; this.color = meta.color;
    this.cls = meta.cls; this.beverage = beverage;     // GIỮ đồ uống bên trong
  }
  cost() { return this._cost + this.beverage.cost(); } // cộng dồn (đệ quy)
}

// --- Trạng thái runtime ---
let base = null;
let toppings = []; // [{name, cls, cost, color}]

// --- DOM refs ---
const drink       = document.getElementById("drink");
const coreLabel   = document.getElementById("coreLabel");
const core        = document.getElementById("core");
const receiptList = document.getElementById("receiptList");
const totalCost   = document.getElementById("totalCost");
const buildView   = document.querySelector("#buildView code");
const classView   = document.querySelector("#classView code");
const basePicker  = document.getElementById("basePicker");
const toppingPicker = document.getElementById("toppingPicker");
const resetBtn    = document.getElementById("resetBtn");

const CORE_SIZE = 96, RING_STEP = 38;

// ---------- Syntax highlight ----------
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function hl(line) {
  // comment cả dòng (giữ nguyên, không tô token bên trong)
  const c = line.indexOf("//");
  let code = line, comment = "";
  if (c !== -1) { code = line.slice(0, c); comment = line.slice(c); }
  let out = esc(code)
    .replace(/\b(let|const|new|return|class|extends|this|super)\b/g, '<span class="kw">$1</span>')
    .replace(/\b(\d+\.\d+|\d+)\b/g, '<span class="num">$1</span>')
    .replace(/\.(cost|describe|getDescription)\b/g, '.<span class="fn">$1</span>')
    .replace(/(&quot;[^&]*&quot;|'[^']*')/g, '<span class="str">$1</span>');
  if (comment) out += '<span class="cm">' + esc(comment) + "</span>";
  return out;
}
function render(el, lines) {
  el.innerHTML = lines.map((l) => hl(l)).join("\n");
}

// ---------- Code TAB 2: định nghĩa lớp (tĩnh) ----------
render(classView, [
  "// Lớp trừu tượng cho mọi đồ uống",
  "class Beverage {",
  "  cost() { return this.price; }",
  "}",
  "",
  "// Decorator: vừa LÀ Beverage, vừa BỌC một Beverage",
  "class CondimentDecorator extends Beverage {",
  "  constructor(beverage) {",
  "    super();",
  "    this.beverage = beverage;   // đồ uống bên trong",
  "  }",
  "  cost() {",
  "    return this.price + this.beverage.cost();",
  "  }",
  "}",
  "",
  "// Mỗi topping là một decorator cụ thể",
  "class Milk  extends CondimentDecorator { price = 0.10 }",
  "class Mocha extends CondimentDecorator { price = 0.20 }",
  "class Whip  extends CondimentDecorator { price = 0.10 }",
]);

// ---------- Code TAB 1: dựng đối tượng theo lựa chọn ----------
function renderBuildCode() {
  const lines = [];
  lines.push("// 1 · Bắt đầu với đồ uống gốc");
  lines.push(`let drink = new ${base.cls}();`);
  lines.push(`//          → cost() = ${base._cost.toFixed(2)}`);

  if (toppings.length) {
    lines.push("");
    lines.push("// 2 · Bọc thêm từng topping (decorator)");
    let running = base._cost;
    toppings.forEach((t) => {
      running += t.cost;
      lines.push(`drink = new ${t.cls}(drink);   // +${t.cost.toFixed(2)} → ${running.toFixed(2)}`);
    });
  }

  lines.push("");
  lines.push("// 3 · Gọi cost() — chạy đệ quy từ NGOÀI vào TRONG");
  lines.push("drink.cost();");

  // Phần giải đệ quy: 0.10 + (0.20 + (... + base))
  const outerToInner = [...toppings].reverse(); // ngoài → trong
  if (toppings.length) {
    let expr = base._cost.toFixed(2);
    outerToInner.reverse().forEach(() => {}); // no-op, giữ thứ tự
    // build từ trong ra ngoài để lồng dấu ngoặc
    let nested = base._cost.toFixed(2);
    for (let i = 0; i < toppings.length; i++) {
      nested = `${toppings[i].cost.toFixed(2)} + (${nested})`;
    }
    const total = (base._cost + toppings.reduce((s, t) => s + t.cost, 0)).toFixed(2);
    lines.push(`//   = ${nested}`);
    lines.push(`//   = ${total}`);
  } else {
    lines.push(`//   = ${base._cost.toFixed(2)}`);
  }

  render(buildView, lines);
}

// ---------- Sân khấu (các vòng tròn) ----------
function renderStage(animateLastRing) {
  drink.querySelectorAll(".ring-layer").forEach((el) => el.remove());
  core.style.background = base.color;
  coreLabel.textContent = base.name;

  toppings.forEach((t, i) => {
    const size = CORE_SIZE + RING_STEP * 2 * (i + 1);
    const ring = document.createElement("div");
    ring.className = "ring-layer";
    if (!animateLastRing && i < toppings.length - 1) ring.style.animation = "none";
    ring.style.width = size + "px";
    ring.style.height = size + "px";
    ring.style.background = t.color;
    ring.style.zIndex = 100 - (i + 1);
    const label = document.createElement("span");
    label.className = "ring-label";
    label.textContent = t.name;
    ring.appendChild(label);
    drink.appendChild(ring);
  });
}

// ---------- Hoá đơn ----------
function renderReceipt() {
  receiptList.innerHTML = "";
  const baseLi = document.createElement("li");
  baseLi.className = "receipt-base";
  baseLi.innerHTML = `<span>${base.name}</span><span>$${base._cost.toFixed(2)}</span>`;
  receiptList.appendChild(baseLi);
  toppings.forEach((t) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>+ ${t.name}</span><span>$${t.cost.toFixed(2)}</span>`;
    receiptList.appendChild(li);
  });
  const total = base._cost + toppings.reduce((s, t) => s + t.cost, 0);
  totalCost.textContent = "$" + total.toFixed(2);
}

function renderAll(animateLastRing = true) {
  renderStage(animateLastRing);
  renderReceipt();
  renderBuildCode();
}

// ---------- Sự kiện ----------
basePicker.addEventListener("click", (e) => {
  const btn = e.target.closest(".base-chip");
  if (!btn) return;
  basePicker.querySelectorAll(".base-chip").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  base = new Beverage(btn.dataset.name, parseFloat(btn.dataset.cost), btn.dataset.color, btn.dataset.name.replace(/\s/g, ""));
  core.style.animation = "none"; void core.offsetWidth; core.style.animation = "pop .4s ease";
  renderAll(false);
});

toppingPicker.addEventListener("click", (e) => {
  const btn = e.target.closest(".topping-chip");
  if (!btn) return;
  const data = {
    name: btn.dataset.name, cls: btn.dataset.cls,
    cost: parseFloat(btn.dataset.cost), color: btn.dataset.color,
  };
  const idx = toppings.findIndex((t) => t.cls === data.cls);
  if (idx === -1) { toppings.push(data); btn.classList.add("added"); renderAll(true); }
  else { toppings.splice(idx, 1); btn.classList.remove("added"); renderAll(false); }
});

resetBtn.addEventListener("click", () => {
  toppings = [];
  toppingPicker.querySelectorAll(".topping-chip").forEach((b) => b.classList.remove("added"));
  renderAll(false);
});

// ---------- Tabs ----------
document.querySelectorAll(".code-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".code-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const isBuild = tab.dataset.tab === "build";
    document.getElementById("buildView").classList.toggle("hidden", !isBuild);
    document.getElementById("classView").classList.toggle("hidden", isBuild);
  });
});

// ---------- Khởi tạo ----------
base = new Beverage("Espresso", 1.99, "#3b2417", "Espresso");
renderAll(false);
