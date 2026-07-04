// ===== Flyweight Pattern — minh hoạ động (rừng cây) =====
// TreeType = flyweight: phần INTRINSIC (tên loài, màu, emoji) DÙNG CHUNG.
// Tree     = phần EXTRINSIC (x, y) riêng từng cây, nhưng TRỎ vào một TreeType.
// TreeFactory giữ pool: cùng (name,color) → trả về CÙNG một object TreeType.

// ---- Catalog loài cây có thể có (nhưng chỉ tạo flyweight khi được dùng) ----
const SPECIES = [
  { name: "Oak",    color: "#5aa469", emoji: "🌳" },
  { name: "Pine",   color: "#2f8f6b", emoji: "🌲" },
  { name: "Cherry", color: "#ff9bbf", emoji: "🌸" },
  { name: "Palm",   color: "#7bc47f", emoji: "🌴" },
];

// ====== TreeFactory — pool flyweight ======
const pool = new Map();          // key "name|color" -> { type, reuse }
let totalCreated = 0;            // số object TreeType THỰC SỰ tạo (new)

function getTreeType(name, color, emoji) {
  const key = name + "|" + color;
  let entry = pool.get(key);
  if (!entry) {
    // chưa có loại này → TẠO MỚI flyweight (new)
    const type = { name, color, emoji };          // intrinsic, bất biến
    entry = { type, reuse: 0 };
    pool.set(key, entry);
    totalCreated++;
    factoryLog(`new TreeType("${name}") → +1 flyweight`, "good", key);
  } else {
    entry.reuse++;
    factoryLog(`đã có "${name}" → tái dùng object cũ`, "muted", key);
  }
  return entry;
}

// ---- danh sách cây (extrinsic) ----
const trees = [];   // { x, y, scale, entry }

// ---- DOM refs ----
const forest    = document.getElementById("forest");
const treeCount = document.getElementById("treeCount");
const typeCount = document.getElementById("typeCount");
const savedVal  = document.getElementById("savedVal");
const poolEl    = document.getElementById("pool");
const badge     = document.getElementById("badge");
const log       = document.getElementById("log");
const buildView = document.getElementById("buildView");
const classView = document.getElementById("classView");

// ====== Code TAB 2: định nghĩa lớp (tĩnh) ======
renderCode(classView, [
  "// ---- Flyweight: phần INTRINSIC dùng chung, BẤT BIẾN ----",
  "class TreeType {",
  "  constructor(name, color, texture) {",
  "    this.name = name;        // nặng & lặp lại giữa vô số cây",
  "    this.color = color;",
  "    this.texture = texture;",
  "  }",
  "  draw(canvas, x, y) {        // nhận extrinsic từ ngoài vào",
  "    canvas.paint(this.texture, this.color, x, y);",
  "  }",
  "}",
  "",
  "// ---- Factory: giữ POOL, đảm bảo mỗi loại chỉ tạo 1 lần ----",
  "class TreeFactory {",
  "  static pool = new Map();",
  "  static getTreeType(name, color, texture) {",
  "    const key = name + color;",
  "    if (!this.pool.has(key))",
  "      this.pool.set(key, new TreeType(name, color, texture));",
  "    return this.pool.get(key);   // ← cùng loại = CÙNG object",
  "  }",
  "}",
  "",
  "// ---- Context: phần EXTRINSIC riêng từng cây ----",
  "class Tree {",
  "  constructor(x, y, type) {",
  "    this.x = x; this.y = y;      // nhẹ, riêng từng cây",
  "    this.type = type;            // TRỎ vào flyweight dùng chung",
  "  }",
  "  draw(canvas) { this.type.draw(canvas, this.x, this.y); }",
  "}",
]);

// ====== Code TAB 1: runtime ======
let buildLines = [];
function note(line) { buildLines.push(line); }
function flushBuild() { renderCode(buildView, buildLines); }

// ====== nhật ký factory ======
function factoryLog(msg, kind) {
  const div = document.createElement("div");
  div.className = "log-line" + (kind === "muted" ? " muted-line" : "");
  if (kind === "good") div.style.color = "var(--good)";
  div.textContent = msg;
  log.appendChild(div);
  while (log.children.length > 40) log.removeChild(log.firstChild);
  log.scrollTop = log.scrollHeight;
}
function bump(el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }

// pseudo-random cố định theo index (vị trí ổn định, không nhảy mỗi lần render)
function rng(seed) { const x = Math.sin(seed * 99.71) * 43758.5453; return x - Math.floor(x); }

// ====== Trồng N cây ======
function plant(n) {
  buildLines = [
    "// Mỗi cây mới: factory quyết định TẠO MỚI hay TÁI DÙNG TreeType",
  ];
  let created = 0, reused = 0;
  for (let i = 0; i < n; i++) {
    const idx = trees.length;
    const sp = SPECIES[Math.floor(rng(idx + 1) * SPECIES.length)];
    const before = totalCreated;
    const entry = getTreeType(sp.name, sp.color, sp.emoji);   // ← qua factory
    if (totalCreated > before) created++; else reused++;

    // extrinsic: vị trí cố định theo index
    const x = 6 + rng(idx * 2 + 3) * 88;          // %
    const y = 32 + rng(idx * 2 + 7) * 60;         // %
    const scale = 0.7 + (y / 100) * 0.9;          // xa nhỏ, gần to
    trees.push({ x, y, scale, entry });
    addTreeEl(x, y, scale, sp, idx);
  }

  note(`let tree = new Tree(x, y, factory.getTreeType("...", "..."));`);
  note(`//  trồng ${n} cây: TẠO MỚI ${created} TreeType · TÁI DÙNG ${reused}`);
  note(`//  tổng: ${trees.length} cây nhưng chỉ ${totalCreated} flyweight trong pool`);
  flushBuild();
  renderStats();
}

function addTreeEl(x, y, scale, sp, idx) {
  const el = document.createElement("span");
  el.className = "tree";
  el.textContent = sp.emoji;
  el.style.left = x + "%";
  el.style.top = y + "%";
  el.style.setProperty("--s", scale.toFixed(2));
  el.style.zIndex = Math.round(y);
  el.style.fontSize = (14 + scale * 8).toFixed(0) + "px";
  forest.appendChild(el);
}

function renderStats() {
  treeCount.textContent = trees.length;
  typeCount.textContent = totalCreated;
  bump(treeCount); bump(typeCount);
  badge.textContent = `${trees.length} cây · ${totalCreated} loại`;

  // tỉ lệ tiết kiệm: nếu KHÔNG dùng flyweight, mỗi cây 1 object intrinsic
  if (trees.length > 0) {
    const saved = trees.length - totalCreated;
    const pct = Math.round((saved / trees.length) * 100);
    savedVal.textContent = `${saved} object (${pct}%)`;
  } else {
    savedVal.textContent = "—";
  }

  renderPool();
}

function renderPool() {
  poolEl.innerHTML = "";
  for (const entry of pool.values()) {
    const it = document.createElement("div");
    it.className = "pool-item";
    it.innerHTML =
      `<span class="swatch" style="background:${entry.type.color}"></span>` +
      `${entry.type.emoji} ${entry.type.name}` +
      `<span class="reuse">×${entry.reuse + 1} cây</span>`;
    poolEl.appendChild(it);
  }
}

function clearForest() {
  trees.length = 0;
  pool.clear();
  totalCreated = 0;
  forest.innerHTML = "";
  log.innerHTML = "";
  factoryLog("Đã dọn rừng — pool flyweight trống.", "muted");
  buildLines = ["// pool.clear() — bắt đầu lại."];
  flushBuild();
  renderStats();
}

// ====== Sự kiện ======
document.getElementById("btnPlant").addEventListener("click", () => plant(20 + Math.floor(Math.random() * 20)));
document.getElementById("btnPlant500").addEventListener("click", () => plant(500));
document.getElementById("btnClear").addEventListener("click", clearForest);

// ====== Khởi tạo ======
setupTabs();
renderStats();
renderCode(buildView, [
  "// Bấm 'Trồng cây': mỗi Tree giữ x,y riêng (extrinsic)",
  "// nhưng CHIA SẺ một TreeType qua TreeFactory.",
  "//",
  "let factory = new TreeFactory();",
  "let tree = new Tree(x, y,",
  "  factory.getTreeType('Oak', '#5aa469'));",
]);
