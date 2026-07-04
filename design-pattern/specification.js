// ===== Specification Pattern — minh hoạ động (lọc sản phẩm) =====
// Mỗi quy tắc là một Specification có isSatisfiedBy(item). Ghép chúng bằng
// .and() / .or() / .not() tạo thành cây spec tổ hợp, rồi lọc danh sách:
//   items.filter(i => spec.isSatisfiedBy(i))

// ---- Dữ liệu sản phẩm ----
const items = [
  { name: "Clean Code",       cat: "Sách",   price: 95,  stock: true  },
  { name: "Refactoring",      cat: "Sách",   price: 120, stock: true  },
  { name: "Bút bi Thiên Long", cat: "VPP",    price: 10,  stock: true  },
  { name: "Sticker Laptop",   cat: "VPP",    price: 50,  stock: false },
  { name: "Design Patterns",  cat: "Sách",   price: 80,  stock: false },
  { name: "Balo Laptop",      cat: "Phụ kiện", price: 200, stock: true  },
];

// ---- Specification: leaf (concrete) ----
function spec(label, code, test) {
  return {
    label, code, test,
    isSatisfiedBy: test,
    and(o) { return combine("AND", this, o); },
    or(o)  { return combine("OR",  this, o); },
    not()  { return negate(this); },
  };
}
function combine(kind, a, b) {
  const test = kind === "AND"
    ? (i) => a.isSatisfiedBy(i) && b.isSatisfiedBy(i)
    : (i) => a.isSatisfiedBy(i) || b.isSatisfiedBy(i);
  return { kind, a, b, isSatisfiedBy: test,
    and(o){return combine("AND",this,o);}, or(o){return combine("OR",this,o);}, not(){return negate(this);} };
}
function negate(a) {
  return { kind: "NOT", a, isSatisfiedBy: (i) => !a.isSatisfiedBy(i),
    and(o){return combine("AND",this,o);}, or(o){return combine("OR",this,o);}, not(){return a;} };
}

const SPECS = {
  price: spec("Giá < 100",   "priceUnder(100)", (i) => i.price < 100),
  stock: spec("Còn hàng",    "inStock()",       (i) => i.stock),
  book:  spec("DM = Sách",   "categoryIs('Sách')", (i) => i.cat === "Sách"),
};

// ---- Trạng thái UI ----
const ui = { active: new Set(), op: "and", not: false };

// ---- DOM refs ----
const prodList  = document.getElementById("prodList");
const matchBadge = document.getElementById("matchBadge");
const specTree  = document.getElementById("specTree");
const notBtn    = document.getElementById("notBtn");
const buildView = document.getElementById("buildView");
const classView = document.getElementById("classView");

// ====== Code TAB 2: định nghĩa lớp (tĩnh) ======
renderCode(classView, [
  "// Interface chung: mọi spec trả true/false cho 1 item",
  "interface Specification {",
  "  isSatisfiedBy(item): boolean;",
  "  and(other), or(other), not();   // tổ hợp",
  "}",
  "",
  "// Spec cụ thể (leaf)",
  "class PriceUnder {",
  "  constructor(max) { this.max = max; }",
  "  isSatisfiedBy(i) { return i.price < this.max; }",
  "}",
  "class InStock {",
  "  isSatisfiedBy(i) { return i.stock; }",
  "}",
  "class CategoryIs {",
  "  constructor(c) { this.c = c; }",
  "  isSatisfiedBy(i) { return i.cat === this.c; }",
  "}",
  "",
  "// Toán tử tổ hợp — cũng là Specification",
  "class AndSpec {",
  "  constructor(a, b) { this.a = a; this.b = b; }",
  "  isSatisfiedBy(i) {",
  "    return this.a.isSatisfiedBy(i) && this.b.isSatisfiedBy(i);",
  "  }",
  "}",
  "class OrSpec {",
  "  isSatisfiedBy(i) {",
  "    return this.a.isSatisfiedBy(i) || this.b.isSatisfiedBy(i);",
  "  }",
  "}",
  "class NotSpec {",
  "  constructor(a) { this.a = a; }",
  "  isSatisfiedBy(i) { return !this.a.isSatisfiedBy(i); }",
  "}",
]);

// ====== Dựng spec tổ hợp từ trạng thái UI ======
function buildSpec() {
  const chosen = [...ui.active].map((k) => SPECS[k]);
  if (chosen.length === 0) return null;
  let s = chosen[0];
  for (let i = 1; i < chosen.length; i++) {
    s = ui.op === "and" ? s.and(chosen[i]) : s.or(chosen[i]);
  }
  if (ui.not) s = s.not();
  return s;
}

// ---- Mô tả spec dạng cây (cho sub-panel) ----
function describe(node, indent = "") {
  if (!node) return indent + "(không spec → tất cả thoả mãn)";
  if (node.code) return indent + node.code;            // leaf
  if (node.kind === "NOT") return indent + "NOT(\n" + describe(node.a, indent + "  ") + "\n" + indent + ")";
  return indent + node.kind + "(\n" +
    describe(node.a, indent + "  ") + ",\n" +
    describe(node.b, indent + "  ") + "\n" + indent + ")";
}

// ---- Diễn đạt spec dạng 1 dòng code (cho runtime) ----
function inline(node) {
  if (!node) return "alwaysTrue()";
  if (node.code) return node.code;
  if (node.kind === "NOT") return inline(node.a) + ".not()";
  const join = node.kind === "AND" ? ".and(" : ".or(";
  return inline(node.a) + join + inline(node.b) + ")";
}

// ====== Render danh sách + chạy filter ======
function render() {
  const s = buildSpec();
  let passCount = 0;

  prodList.innerHTML = "";
  items.forEach((it) => {
    const ok = s ? s.isSatisfiedBy(it) : true;
    if (ok) passCount++;
    const row = document.createElement("div");
    row.className = "prod" + (ok ? " pass fade-up" : " fail");
    row.innerHTML =
      `<span class="p-name">${it.name}</span>` +
      `<span class="p-tag">${it.cat}</span>` +
      `<span class="p-price">${it.price}đ</span>` +
      `<span class="p-stock ${it.stock ? "in" : "out"}">${it.stock ? "Còn" : "Hết"}</span>` +
      `<span class="p-mark">${ok ? "✓" : "✕"}</span>`;
    prodList.appendChild(row);
  });

  matchBadge.textContent = `${passCount} / ${items.length} thoả mãn`;
  replay(matchBadge, "flash");
  specTree.textContent = describe(s);

  // ----- Runtime tab -----
  const expr = inline(s);
  const lines = [`const spec = ${expr};`, "", "items.filter(i => spec.isSatisfiedBy(i));"];
  items.forEach((it) => {
    const ok = s ? s.isSatisfiedBy(it) : true;
    lines.push(`//  ${it.name.padEnd(16)} → ${ok ? "✓ giữ lại" : "✕ loại"}`);
  });
  lines.push(`//  = ${passCount} sản phẩm thoả mãn`);
  renderCode(buildView, lines);
}

function replay(el, cls) {
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
}

// ====== Sự kiện ======
document.querySelectorAll(".spec-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const k = chip.dataset.spec;
    if (ui.active.has(k)) { ui.active.delete(k); chip.classList.remove("added"); }
    else { ui.active.add(k); chip.classList.add("added"); }
    render();
  });
});
document.querySelectorAll(".op-btn").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".op-btn").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    ui.op = b.dataset.op;
    render();
  });
});
notBtn.addEventListener("click", () => {
  ui.not = !ui.not;
  notBtn.textContent = `NOT (đảo kết quả): ${ui.not ? "BẬT" : "TẮT"}`;
  notBtn.classList.toggle("on", ui.not);
  render();
});

// ====== Khởi tạo ======
setupTabs();
render();
