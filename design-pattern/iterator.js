// ===== Iterator Pattern — minh hoạ động =====
// PancakeHouseMenu lưu món bằng ArrayList; DinerMenu lưu bằng Array CỐ ĐỊNH.
// Cấu trúc bên trong KHÁC nhau, nhưng cả hai đều có createIterator() trả về một
// Iterator với hasNext()/next(). Vì vậy Waitress.printMenu(iterator) chỉ cần MỘT
// vòng lặp duy nhất, dùng được cho mọi menu — đó là cốt lõi của Iterator Pattern.

// ---- Dữ liệu hai menu (theo Head First) ----
const PANCAKE = [
  { name: "Regular Pancake Breakfast", price: 2.99, veg: true },
  { name: "Blueberry Pancakes",        price: 3.49, veg: true },
  { name: "Waffles",                   price: 3.59, veg: true },
];
const DINER = [
  { name: "Vegetarian BLT", price: 2.99, veg: true },
  { name: "BLT",            price: 2.99, veg: false },
  { name: "Soup of the day",price: 3.29, veg: false },
  { name: "Hotdog",         price: 3.05, veg: false },
];
const MAX_ITEMS = 6; // DinerMenu là mảng cố định -> còn ô trống (null)

const P = PANCAKE.length;            // 3
const D = DINER.length;              // 4
const TOTAL = P + D;                 // 7 lần next() trả về món thật

// Danh sách "walk" gộp: trước hết duyệt hết pancake, rồi tới diner.
const WALK = [
  ...PANCAKE.map((it, i) => ({ menu: "pancake", local: i, item: it })),
  ...DINER.map((it, i) => ({ menu: "diner", local: i, item: it })),
];

// ---- Trạng thái runtime ----
// cur = -1: chưa bắt đầu; 0..TOTAL-1: chỉ số món vừa next() trả về; TOTAL: xong.
let cur = -1;
let autoTimer = null;

// ---- DOM refs ----
const nextBtn      = document.getElementById("nextBtn");
const autoBtn      = document.getElementById("autoBtn");
const resetBtn     = document.getElementById("resetBtn");
const pancakeRows  = document.getElementById("pancakeRows");
const dinerRows    = document.getElementById("dinerRows");
const cursor       = document.getElementById("cursor");
const stageArea    = document.getElementById("stageArea");
const curEmpty     = document.getElementById("curEmpty");
const curBody      = document.getElementById("curBody");
const curName      = document.getElementById("curName");
const curPrice     = document.getElementById("curPrice");
const curMeta      = document.getElementById("curMeta");
const hasNextBadge = document.getElementById("hasNextBadge");
const log          = document.getElementById("log");
const buildView    = document.getElementById("buildView");
const classView    = document.getElementById("classView");

const fmt = (n) => "$" + n.toFixed(2);

// ---------- Dựng các hàng món vào sân khấu (1 lần) ----------
function buildRow(menu, local, item) {
  const div = document.createElement("div");
  div.className = "menu-row";
  div.dataset.menu = menu;
  div.dataset.idx = local;
  div.innerHTML =
    `<div class="row-top"><span class="row-name">${item.name}</span>` +
    `<span class="row-price">${fmt(item.price)}</span></div>` +
    `<div class="row-veg">${item.veg
      ? '🌱 <span class="yes">vegetarian</span>'
      : '🍖 không chay'}</div>`;
  return div;
}
function buildEmptySlot(local) {
  const div = document.createElement("div");
  div.className = "menu-row slot-empty";
  div.dataset.menu = "diner";
  div.dataset.idx = local;
  div.textContent = "null";
  return div;
}
function buildStage() {
  pancakeRows.innerHTML = "";
  dinerRows.innerHTML = "";
  PANCAKE.forEach((it, i) => pancakeRows.appendChild(buildRow("pancake", i, it)));
  DINER.forEach((it, i) => dinerRows.appendChild(buildRow("diner", i, it)));
  // các ô mảng còn trống của DinerMenu (cố định MAX_ITEMS)
  for (let i = D; i < MAX_ITEMS; i++) dinerRows.appendChild(buildEmptySlot(i));
}

// Lấy phần tử DOM của hàng đang được next() trỏ tới
function currentRowEl() {
  if (cur < 0 || cur >= TOTAL) return null;
  const w = WALK[cur];
  const box = w.menu === "pancake" ? pancakeRows : dinerRows;
  return box.querySelector(`.menu-row[data-idx="${w.local}"]:not(.slot-empty)`);
}

// ---------- Cập nhật highlight + con trỏ Waitress ----------
function renderStageState() {
  const rows = stageArea.querySelectorAll(".menu-row");
  rows.forEach((r) => r.classList.remove("current", "passed"));

  // đánh dấu các món ĐÃ duyệt qua (passed) và món hiện tại (current)
  WALK.forEach((w, k) => {
    if (k >= cur && cur < TOTAL) return; // chưa tới
    const box = w.menu === "pancake" ? pancakeRows : dinerRows;
    const el = box.querySelector(`.menu-row[data-idx="${w.local}"]:not(.slot-empty)`);
    if (!el) return;
    if (k < cur) el.classList.add("passed");
  });

  const el = currentRowEl();
  if (el) {
    el.classList.add("current");
    // di chuyển con trỏ tới mép trái hàng hiện tại
    const s = stageArea.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    cursor.style.top = (r.top - s.top + r.height / 2) + "px";
    cursor.style.left = (r.left - s.left - 12) + "px";
    cursor.style.opacity = "1";
  } else {
    cursor.style.opacity = "0";
  }
}

// ---------- Cột trái: món hiện tại + hasNext + output ----------
// hasNext() SAU khi đã next() tới món `cur`: còn món kế trong CÙNG menu không?
function hasNextAfter(idx) {
  if (idx < 0) return true;            // chưa bắt đầu: chắc chắn còn
  if (idx >= TOTAL) return false;      // đã duyệt hết tất cả
  const w = WALK[idx];
  const size = w.menu === "pancake" ? P : D;
  return w.local + 1 < size;           // còn phần tử trong iterator hiện tại
}

function renderSidePanel() {
  // badge hasNext()
  const hn = hasNextAfter(cur);
  hasNextBadge.textContent = (cur < 0) ? "—" : (hn ? "true" : "false");
  hasNextBadge.style.borderColor = hn ? "var(--good)" : "#ff7a7a";
  hasNextBadge.style.color = hn ? "var(--good)" : "#ff9b9b";
  hasNextBadge.classList.remove("flash"); void hasNextBadge.offsetWidth;
  if (cur >= 0) hasNextBadge.classList.add("flash");

  // thẻ "món hiện tại"
  if (cur < 0 || cur >= TOTAL) {
    curBody.classList.add("hidden");
    curEmpty.classList.remove("hidden");
    curEmpty.innerHTML = (cur >= TOTAL)
      ? '✓ Đã duyệt hết cả hai menu. Bấm <code>Làm lại</code> để chạy lại.'
      : 'Chưa bắt đầu — bấm <code>Bước tiếp</code> để Waitress gọi <code>next()</code>.';
  } else {
    curEmpty.classList.add("hidden");
    curBody.classList.remove("hidden");
    const w = WALK[cur];
    curName.textContent = w.item.name;
    curPrice.textContent = fmt(w.item.price);
    const iterName = w.menu === "pancake" ? "ArrayListIterator" : "DinerMenuIterator";
    curMeta.innerHTML =
      `từ <strong>${w.menu === "pancake" ? "PancakeHouseMenu" : "DinerMenu"}</strong> ` +
      `· <code>${iterName}</code> · ` +
      (w.item.veg ? '<span class="veg-yes">🌱 chay</span>' : '🍖 không chay');
  }
}

// Log output cộng dồn các món đã in (printMenu)
function renderLog() {
  if (cur < 0) {
    log.innerHTML = '<div class="log-line muted-line">Output sẽ hiện ở đây khi duyệt…</div>';
    return;
  }
  log.innerHTML = "";
  let lastMenu = null;
  for (let k = 0; k <= cur && k < TOTAL; k++) {
    const w = WALK[k];
    if (w.menu !== lastMenu) {
      const head = document.createElement("div");
      head.className = "log-line muted-line";
      head.textContent = w.menu === "pancake"
        ? "— printMenu(pancakeMenu.createIterator()) —"
        : "— printMenu(dinerMenu.createIterator()) —";
      log.appendChild(head);
      lastMenu = w.menu;
    }
    const line = document.createElement("div");
    line.className = "log-line";
    line.textContent = `${w.item.name}  ${fmt(w.item.price)}`;
    log.appendChild(line);
  }
  if (cur >= TOTAL) {
    const done = document.createElement("div");
    done.className = "log-line"; done.style.color = "var(--good)";
    done.textContent = "✓ printMenu() xong cho cả hai menu";
    log.appendChild(done);
  }
  log.scrollTop = log.scrollHeight;
}

// ---------- TAB 1: code runtime phản chiếu vị trí con trỏ ----------
// Comment trạng thái cho từng menu: 'active' (đang duyệt) / 'done' / 'pending'.
function menuState(menu) {
  if (cur < 0) return ["pending", -1];
  const startDiner = P;
  if (menu === "pancake") {
    if (cur < startDiner) return ["active", cur];        // local = cur
    return ["done", -1];
  } else {
    if (cur >= startDiner && cur < TOTAL) return ["active", cur - startDiner];
    if (cur >= TOTAL) return ["done", -1];
    return ["pending", -1];
  }
}

function stateComment(menu) {
  const size = menu === "pancake" ? P : D;
  const data = menu === "pancake" ? PANCAKE : DINER;
  const [st, local] = menuState(menu);
  if (st === "pending") return "  //  ⏳ chưa tới — sẽ dùng ĐÚNG vòng lặp trên";
  if (st === "done")    return `  //  ✓ đã duyệt hết ${size} món (hasNext()=false)`;
  const it = data[local];
  const hn = local + 1 < size;
  return `  //  → "${it.name}"  ${fmt(it.price)}   [${local + 1}/${size}]  hasNext()=${hn}`;
}

function renderBuildView() {
  renderCode(buildView, [
    "// Waitress KHÔNG cần biết menu lưu kiểu gì — chỉ xin Iterator rồi duyệt.",
    "",
    "// 1 · Pancake menu (ArrayList) :",
    "let it = pancakeMenu.createIterator();   // → ArrayListIterator",
    "while (it.hasNext()) {",
    "  let item = it.next();" + stateComment("pancake"),
    "  print(item.name + \"  \" + item.price);",
    "}",
    "",
    "// 2 · Diner menu (Array cố định) — DÙNG LẠI Y HỆT, không sửa 1 dòng:",
    "let it = dinerMenu.createIterator();      // → DinerMenuIterator",
    "while (it.hasNext()) {",
    "  let item = it.next();" + stateComment("diner"),
    "  print(item.name + \"  \" + item.price);",
    "}",
  ]);
}

// ---------- TAB 2: định nghĩa lớp (tĩnh) ----------
renderCode(classView, [
  "// Iterator: giao diện CHUNG để duyệt — giấu cấu trúc bên trong",
  "interface Iterator {",
  "  hasNext();   // còn phần tử kế tiếp?",
  "  next();      // trả phần tử hiện tại + dời con trỏ",
  "}",
  "",
  "// PancakeHouseMenu lưu món bằng ArrayList (động)",
  "class PancakeHouseMenu {",
  "  constructor() { this.menuItems = []; }",
  "  addItem(name, price, veg) {",
  "    this.menuItems.push(new MenuItem(name, price, veg));",
  "  }",
  "  createIterator() {",
  "    return new ArrayListIterator(this.menuItems);",
  "  }",
  "}",
  "class ArrayListIterator {",
  "  constructor(items) { this.items = items; this.pos = 0; }",
  "  hasNext() { return this.pos < this.items.length; }",
  "  next()    { return this.items[this.pos++]; }",
  "}",
  "",
  "// DinerMenu lưu món bằng MẢNG CỐ ĐỊNH (có ô null ở cuối)",
  "class DinerMenu {",
  "  constructor() { this.menuItems = new Array(MAX_ITEMS); this.n = 0; }",
  "  addItem(name, price, veg) {",
  "    this.menuItems[this.n++] = new MenuItem(name, price, veg);",
  "  }",
  "  createIterator() {",
  "    return new DinerMenuIterator(this.menuItems);",
  "  }",
  "}",
  "class DinerMenuIterator {",
  "  constructor(items) { this.items = items; this.pos = 0; }",
  "  hasNext() {                       // dừng khi hết MẢNG hoặc gặp null",
  "    return this.pos < this.items.length",
  "        && this.items[this.pos] != null;",
  "  }",
  "  next() { return this.items[this.pos++]; }",
  "}",
  "",
  "// Waitress: MỘT printMenu() chạy được cho MỌI menu",
  "class Waitress {",
  "  printMenus() {",
  "    this.printMenu(pancakeMenu.createIterator());",
  "    this.printMenu(dinerMenu.createIterator());   // y hệt vòng trên",
  "  }",
  "  printMenu(iterator) {       // ← không biết Array hay ArrayList",
  "    while (iterator.hasNext()) {",
  "      let item = iterator.next();",
  "      print(item.name + \"  \" + item.price);",
  "    }",
  "  }",
  "}",
]);

// ---------- Vẽ lại toàn bộ ----------
function renderAll() {
  renderStageState();
  renderSidePanel();
  renderLog();
  renderBuildView();
  nextBtn.disabled = (cur >= TOTAL);
}

// ---------- Hành động ----------
function step() {
  if (cur >= TOTAL) return false;
  cur++;
  renderAll();
  return cur < TOTAL;
}

function stopAuto() {
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  autoBtn.textContent = "▶ Tự động duyệt hết (printMenu)";
  nextBtn.disabled = (cur >= TOTAL);
}

function reset() {
  stopAuto();
  cur = -1;
  renderAll();
}

// ---------- Sự kiện ----------
nextBtn.addEventListener("click", () => { stopAuto(); step(); });

autoBtn.addEventListener("click", () => {
  if (autoTimer) { stopAuto(); return; }
  if (cur >= TOTAL) reset();
  autoBtn.textContent = "⏸ Dừng";
  nextBtn.disabled = true;
  autoTimer = setInterval(() => {
    const more = step();
    if (!more) stopAuto();
  }, 750);
});

resetBtn.addEventListener("click", reset);
window.addEventListener("resize", renderStageState);

// ---------- Khởi tạo ----------
setupTabs();
buildStage();
renderAll();
