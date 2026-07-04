// ===== Composite Pattern — minh hoạ động =====
// Menu (CÀNH = composite) chứa danh sách MenuComponent: có thể là Menu khác
// HOẶC MenuItem (LÁ = leaf). Client gọi print() trên GỐC; mỗi Menu tự ĐỆ QUY
// xuống con — cành và lá đáp ứng CÙNG một interface MenuComponent.

// ---- Dữ liệu cây ban đầu (đúng ví dụ Head First) ----
function buildMenuTree() {
  return {
    type: "menu", name: "ALL MENUS",
    children: [
      { type: "menu", name: "PANCAKE HOUSE MENU", children: [
        { type: "item", name: "K&B's Pancake Breakfast", price: 2.99 },
        { type: "item", name: "Regular Pancake Breakfast", price: 2.99 },
        { type: "item", name: "Blueberry Pancakes", price: 3.49 },
      ]},
      { type: "menu", name: "DINER MENU", children: [
        { type: "item", name: "Vegetarian BLT", price: 2.99 },
        { type: "item", name: "Soup of the day", price: 3.29 },
        { type: "menu", name: "DESSERT MENU", children: [
          { type: "item", name: "Apple Pie", price: 1.59 },
          { type: "item", name: "Cheesecake", price: 1.99 },
        ]},
      ]},
      { type: "menu", name: "CAFE MENU", children: [
        { type: "item", name: "Veggie Burger and Air Fries", price: 3.99 },
        { type: "item", name: "Soup of the day", price: 3.69 },
      ]},
    ],
  };
}

// ---- Trạng thái runtime ----
let root = null;
let uid = 0;           // bộ đếm id cho từng node
const nodeById = {};   // _uid -> node
let busy = false;      // đang chạy print()

// ---- DOM refs ----
const stageArea  = document.getElementById("stageArea");
const output     = document.getElementById("output");
const printBtn   = document.getElementById("printBtn");
const resetBtn   = document.getElementById("resetBtn");
const addBtn     = document.getElementById("addBtn");
const menuSelect = document.getElementById("menuSelect");
const itemName   = document.getElementById("itemName");
const itemPrice  = document.getElementById("itemPrice");
const buildView  = document.getElementById("buildView");
const classView  = document.getElementById("classView");

// Gán _uid cho mọi node + nạp vào nodeById
function indexTree(node) {
  node._uid = uid++;
  nodeById[node._uid] = node;
  if (node.type === "menu") node.children.forEach(indexTree);
}

// ---------- TAB 2: định nghĩa lớp (tĩnh) ----------
renderCode(classView, [
  "// MenuComponent: interface CHUNG cho cả LÁ lẫn CÀNH.",
  "// Method mặc định ném lỗi -> lớp con chỉ override cái nó hỗ trợ.",
  "abstract class MenuComponent {",
  "  add(c)     { throw new UnsupportedOperationException(); }",
  "  remove(c)  { throw new UnsupportedOperationException(); }",
  "  getName()  { throw new UnsupportedOperationException(); }",
  "  getPrice() { throw new UnsupportedOperationException(); }",
  "  print()    { throw new UnsupportedOperationException(); }",
  "}",
  "",
  "// LÁ: MenuItem — KHÔNG có con, chỉ in chính nó.",
  "class MenuItem extends MenuComponent {",
  "  constructor(name, price) { super(); this.name = name; this.price = price; }",
  "  getName()  { return this.name; }",
  "  getPrice() { return this.price; }",
  "  print()    { console.log(this.name + ', $' + this.price); }",
  "}",
  "",
  "// CÀNH: Menu — GIỮ danh sách MenuComponent (Menu HOẶC MenuItem).",
  "class Menu extends MenuComponent {",
  "  constructor(name) { super(); this.name = name; this.children = []; }",
  "  add(c)     { this.children.push(c); }   // thêm con: cành hay lá đều được",
  "  getName()  { return this.name; }",
  "  print() {",
  "    console.log('== ' + this.name + ' ==');",
  "    for (const c of this.children) c.print();  // ĐỆ QUY đồng nhất",
  "  }",
  "}",
]);

// ---------- TAB 1: code runtime ----------
function renderIdleBuild() {
  renderCode(buildView, [
    "let allMenus = buildMenuTree();   // cây Menu / MenuItem",
    "allMenus.print();",
    "//",
    "// Client chỉ gọi print() trên GỐC.",
    "// Menu.print():     in tên menu, rồi lặp children -> child.print()",
    "// MenuItem.print(): in tên + giá (lá, không có con)",
    "//",
    "// ▶ Bấm \"print() toàn bộ\" để xem thứ tự duyệt DFS.",
  ]);
}

function renderTraversalBuild(steps) {
  const lines = [
    "allMenus.print();",
    "//",
    "// DFS preorder: Menu in chính nó RỒI đệ quy children;",
    "//              MenuItem là lá -> chỉ in tên + giá.",
    "//",
  ];
  steps.forEach((s, idx) => {
    const ind = "  ".repeat(s.depth);
    const cur = idx === steps.length - 1 ? "▶ " : "  ";
    const txt = s.node.type === "menu"
      ? `${cur}${ind}Menu.print()      "${s.node.name}"`
      : `${cur}${ind}MenuItem.print()  "${s.node.name}" $${s.node.price.toFixed(2)}`;
    lines.push("// " + txt);
  });
  renderCode(buildView, lines);
}

function renderAddBuild(parent, name, price) {
  renderCode(buildView, [
    `let item = new MenuItem("${name}", ${price.toFixed(2)});`,
    `${varName(parent)}.add(item);`,
    "//",
    `// Thêm 1 LÁ vào nhánh "${parent.name}".`,
    "// Cây lớn lên ĐỒNG NHẤT — client & print() không cần đổi.",
    "//",
    "// ▶ Bấm \"print() toàn bộ\" để duyệt lại cả cây.",
  ]);
}

// tên biến gợi nhớ cho 1 Menu (chỉ để hiển thị trong code demo)
function varName(node) {
  const camel = node.name.toLowerCase().replace(/[^a-z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""));
  return camel || "menu";
}

// ---------- Sân khấu: dựng cây thực đơn ----------
function buildTreeDOM(node, depth) {
  const box = document.createElement("div");
  box.className = "tree-box";

  const row = document.createElement("div");
  row.className = "tree-node " + (node.type === "menu" ? "menu-node" : "item-node");
  if (depth === 0) row.classList.add("root-node");
  node._el = row;

  if (node.type === "menu") {
    row.innerHTML =
      '<span class="t-icon">📂</span>' +
      `<span class="t-name">${node.name}</span>` +
      '<span class="t-tag">Menu · cành</span>';
  } else {
    row.innerHTML =
      '<span class="t-icon">📄</span>' +
      `<span class="t-name">${node.name}</span>` +
      `<span class="t-price">$${node.price.toFixed(2)}</span>`;
  }
  box.appendChild(row);

  if (node.type === "menu") {
    const kids = document.createElement("div");
    kids.className = "tree-children";
    node.children.forEach((c) => kids.appendChild(buildTreeDOM(c, depth + 1)));
    box.appendChild(kids);
  }
  return box;
}

function renderTree() {
  stageArea.innerHTML = "";
  stageArea.appendChild(buildTreeDOM(root, 0));
}

// ---------- Dropdown chọn Menu để add() ----------
function renderMenuSelect() {
  const prev = menuSelect.value;
  menuSelect.innerHTML = "";
  collectMenus(root, 0).forEach(({ node, depth }) => {
    const opt = document.createElement("option");
    opt.value = node._uid;
    opt.textContent = "  ".repeat(depth) + (depth ? "└ " : "") + node.name;
    menuSelect.appendChild(opt);
  });
  if (nodeById[prev]) menuSelect.value = prev;
}

function collectMenus(node, depth, out = []) {
  if (node.type !== "menu") return out;
  out.push({ node, depth });
  node.children.forEach((c) => collectMenus(c, depth + 1, out));
  return out;
}

// ---------- Duyệt DFS preorder ----------
function flatten(node, depth, out) {
  out.push({ node, depth });
  if (node.type === "menu") node.children.forEach((c) => flatten(c, depth + 1, out));
}

function clearVisiting() {
  stageArea.querySelectorAll(".visiting").forEach((el) => el.classList.remove("visiting"));
}

function appendLog(node, depth) {
  const div = document.createElement("div");
  div.className = "log-line";
  div.style.marginLeft = depth * 16 + "px";
  if (node.type === "menu") {
    div.textContent = `📂 == ${node.name} ==`;
    div.style.color = "var(--accent)";
  } else {
    div.textContent = `📄 ${node.name}, $${node.price.toFixed(2)}`;
  }
  output.appendChild(div);
  output.scrollTop = output.scrollHeight;
}

function setBusy(state) {
  busy = state;
  printBtn.disabled = state;
  resetBtn.disabled = state;
  addBtn.disabled = state;
}

function runPrint() {
  if (busy) return;
  clearVisiting();
  output.innerHTML = "";
  const order = [];
  flatten(root, 0, order);
  const steps = [];
  setBusy(true);

  let i = 0;
  (function next() {
    if (i >= order.length) {
      setBusy(false);
      setTimeout(clearVisiting, 400);
      return;
    }
    clearVisiting();
    const step = order[i++];
    step.node._el.classList.add("visiting");
    step.node._el.scrollIntoView({ block: "nearest" });
    appendLog(step.node, step.depth);
    steps.push(step);
    renderTraversalBuild(steps);
    setTimeout(next, 350);
  })();
}

// ---------- Thêm MenuItem vào submenu đã chọn ----------
function addItem() {
  if (busy) return;
  const parent = nodeById[menuSelect.value];
  if (!parent) return;
  const name = (itemName.value || "").trim() || "New Item";
  let price = parseFloat(itemPrice.value);
  if (isNaN(price) || price < 0) price = 0;

  const node = { type: "item", name, price, _uid: uid++ };
  nodeById[node._uid] = node;
  parent.children.push(node);

  renderTree();
  renderMenuSelect();
  renderAddBuild(parent, name, price);

  // nhấp nháy node vừa thêm
  node._el.classList.add("just-added");
  node._el.scrollIntoView({ block: "nearest" });
  setTimeout(() => node._el && node._el.classList.remove("just-added"), 900);
  itemName.value = "";
}

// ---------- Reset ----------
function resetTree() {
  if (busy) return;
  uid = 0;
  for (const k in nodeById) delete nodeById[k];
  root = buildMenuTree();
  indexTree(root);
  renderTree();
  renderMenuSelect();
  renderIdleBuild();
  output.innerHTML =
    '<div class="log-line muted-line">Bấm "print() toàn bộ" để duyệt cây theo chiều sâu…</div>';
}

// ---------- Sự kiện ----------
printBtn.addEventListener("click", runPrint);
resetBtn.addEventListener("click", resetTree);
addBtn.addEventListener("click", addItem);
itemName.addEventListener("keydown", (e) => { if (e.key === "Enter") addItem(); });

// ---------- Khởi tạo ----------
root = buildMenuTree();
indexTree(root);
renderTree();
renderMenuSelect();
renderIdleBuild();
setupTabs();
