// ===== Singleton Pattern — minh hoạ động (Chocolate Boiler) =====
// Constructor PRIVATE; getInstance() tạo lười (lazy) đúng 1 lần rồi
// luôn trả lại CÙNG một thể hiện. Mọi ref đều trỏ về 1 bồn duy nhất.

class ChocolateBoiler {
  static #instance = null;             // ô nhớ tĩnh giữ thể hiện duy nhất

  constructor() {                      // "private": chỉ getInstance() gọi
    this.empty = true;
    this.boiled = false;
  }

  static getInstance() {
    if (ChocolateBoiler.#instance === null) {   // lazy init
      ChocolateBoiler.#instance = new ChocolateBoiler();
    }
    return ChocolateBoiler.#instance;
  }

  static _resetForDemo() { ChocolateBoiler.#instance = null; } // chỉ phục vụ demo

  fill()  { if (this.empty) { this.empty = false; this.boiled = false; return true; } return false; }
  boil()  { if (!this.empty && !this.boiled) { this.boiled = true; return true; } return false; }
  drain() { if (!this.empty && this.boiled) { this.empty = true; this.boiled = false; return true; } return false; }
  isEmpty()  { return this.empty; }
  isBoiled() { return this.boiled; }
}

// ---------- Trạng thái runtime của trang ----------
let refs = [];        // ['ref1','ref2',...] — TÊN các tham chiếu đã lấy
let actions = [];     // [{ref, op, note}] — chuỗi thao tác fill/boil/drain
const MAX_REFS = 5;

// ---------- DOM refs ----------
const getInstanceBtn = document.getElementById("getInstanceBtn");
const fillBtn   = document.getElementById("fillBtn");
const boilBtn   = document.getElementById("boilBtn");
const drainBtn  = document.getElementById("drainBtn");
const resetBtn  = document.getElementById("resetBtn");

const instanceCount = document.getElementById("instanceCount");
const equalityCheck = document.getElementById("equalityCheck");
const refChips  = document.getElementById("refChips");
const refStack  = document.getElementById("refStack");

const tank      = document.getElementById("tank");
const tankState = document.getElementById("tankState");
const flagEmpty = document.getElementById("flagEmpty");
const flagFull  = document.getElementById("flagFull");
const flagBoiled= document.getElementById("flagBoiled");
const crossRead = document.getElementById("crossRead");

const buildView = document.getElementById("buildView");
const classView = document.getElementById("classView");

// ---------- TAB 2: định nghĩa lớp (tĩnh) ----------
renderCode(classView, [
  "// Singleton: 1 lớp chỉ có ĐÚNG 1 thể hiện",
  "class ChocolateBoiler {",
  "  // ô nhớ tĩnh giữ thể hiện duy nhất (private)",
  "  static #instance = null;",
  "",
  "  // Constructor PRIVATE — không cho new từ ngoài",
  "  constructor() {",
  "    this.empty = true;",
  "    this.boiled = false;",
  "  }",
  "",
  "  // Cửa truy cập DUY NHẤT — tạo lười (lazy)",
  "  static getInstance() {",
  "    if (ChocolateBoiler.#instance === null) {",
  "      // chỉ lần đầu mới thật sự new",
  "      ChocolateBoiler.#instance = new ChocolateBoiler();",
  "    }",
  "    // các lần sau: trả lại đúng thể hiện cũ",
  "    return ChocolateBoiler.#instance;",
  "    // Đa luồng: bọc synchronized hoặc dùng eager-init",
  "    // để 2 luồng không lỡ tạo ra 2 instance.",
  "  }",
  "",
  "  fill()  { if (this.empty) { this.empty = false; this.boiled = false; } }",
  "  boil()  { if (!this.empty && !this.boiled) this.boiled = true; }",
  "  drain() { if (!this.empty && this.boiled) { this.empty = true; this.boiled = false; } }",
  "}",
]);

// ---------- TAB 1: code runtime cập nhật theo thao tác ----------
function renderRuntime() {
  const boiler = refs.length ? ChocolateBoiler.getInstance() : null;
  const lines = [];

  if (refs.length === 0) {
    lines.push("// Bồn chưa được tạo — bấm getInstance() để bắt đầu");
    lines.push("let boiler = ChocolateBoiler.getInstance();");
    lines.push("//          lần đầu chạy 'new', sau đó luôn dùng lại");
    renderCode(buildView, lines);
    return;
  }

  lines.push("// Mỗi lần gọi getInstance() trả về CÙNG một bồn");
  refs.forEach((r, i) => {
    const cm = i === 0 ? "// tạo MỚI (lazy: chạy new lần đầu)" : "// trả lại instance đã có";
    lines.push(`let ${r} = ChocolateBoiler.getInstance();  ${cm}`);
  });

  if (refs.length >= 2) {
    lines.push("");
    lines.push("// Tất cả chỉ là MỘT đối tượng?");
    for (let i = 1; i < refs.length; i++) {
      lines.push(`${refs[0]} === ${refs[i]};   // true`);
    }
  }

  if (actions.length) {
    lines.push("");
    lines.push("// Thao tác — chỉ DUY NHẤT 1 bồn bị thay đổi");
    actions.forEach((a) => {
      lines.push(`${a.ref}.${a.op}();   // ${a.note}`);
    });

    if (refs.length >= 2) {
      const reader = refs[refs.length - 1];
      lines.push("");
      lines.push(`// Đọc state qua ${reader} (khác ${refs[0]})`);
      lines.push(`${reader}.isEmpty();   // ${boiler.isEmpty()}`);
      lines.push(`${reader}.isBoiled();  // ${boiler.isBoiled()}`);
      lines.push(`// -> ${reader} thấy đúng thay đổi của ${refs[0]} vì CÙNG object`);
    }
  }

  renderCode(buildView, lines);
}

// ---------- Cập nhật bồn + panel trạng thái ----------
function renderState() {
  const boiler = refs.length ? ChocolateBoiler.getInstance() : null;
  const empty  = boiler ? boiler.isEmpty()  : true;
  const boiled = boiler ? boiler.isBoiled() : false;
  const full   = !empty;

  tank.classList.toggle("full", full);
  tank.classList.toggle("boiled", boiled);

  tankState.classList.remove("full", "boiled");
  if (boiled)      { tankState.textContent = "đã sôi"; tankState.classList.add("boiled"); }
  else if (full)   { tankState.textContent = "đầy (chưa sôi)"; tankState.classList.add("full"); }
  else             { tankState.textContent = "empty"; }

  flagEmpty.classList.toggle("on", empty);
  flagFull.classList.toggle("on", full);
  flagBoiled.classList.toggle("on", boiled);
  flagBoiled.classList.toggle("boiled-on", boiled);

  if (!refs.length) {
    crossRead.innerHTML = "Chưa có thao tác nào.";
  } else {
    const reader = refs[refs.length - 1];
    crossRead.innerHTML =
      `Đọc qua <span class="who">${reader}</span>: ` +
      `isEmpty()=<b>${empty}</b>, isBoiled()=<b>${boiled}</b>`;
  }
}

// ---------- Cập nhật panel instance + danh sách ref ----------
function renderInstanceInfo() {
  const created = refs.length ? 1 : 0;     // singleton: tối đa 1
  instanceCount.textContent = created;

  if (refs.length >= 2) {
    equalityCheck.textContent = `${refs[0]} === ${refs[1]}  →  true  (cùng object)`;
    equalityCheck.classList.add("ok");
  } else {
    equalityCheck.textContent = "— gọi ≥ 2 lần để so sánh tham chiếu —";
    equalityCheck.classList.remove("ok");
  }

  refChips.innerHTML = refs
    .map((r) => `<span class="rc">${r}</span>`)
    .join("");
}

// ---------- Thêm 1 nhãn ref vào sân khấu (mũi tên trỏ về bồn) ----------
function addRefToStage(name) {
  const item = document.createElement("div");
  item.className = "ref-item fade-up";
  item.innerHTML =
    `<span class="ref-badge">${name}</span>` +
    `<span class="ref-arrow lit">▶</span>`;
  refStack.appendChild(item);
  // ping bồn để thể hiện "mũi tên này trỏ về CÙNG bồn"
  tank.classList.remove("ping"); void tank.offsetWidth; tank.classList.add("ping");
}

// ---------- Bật/tắt các nút thao tác ----------
function syncButtons() {
  const hasInstance = refs.length > 0;
  fillBtn.disabled  = !hasInstance;
  boilBtn.disabled  = !hasInstance;
  drainBtn.disabled = !hasInstance;
  getInstanceBtn.disabled = refs.length >= MAX_REFS;
}

function renderAll() {
  renderInstanceInfo();
  renderState();
  renderRuntime();
  syncButtons();
}

// ---------- Sự kiện: lấy instance ----------
getInstanceBtn.addEventListener("click", () => {
  if (refs.length >= MAX_REFS) return;
  ChocolateBoiler.getInstance();          // gọi thật (lazy tạo lần đầu)
  const name = "ref" + (refs.length + 1);
  refs.push(name);
  addRefToStage(name);
  // nhấp nháy badge để nhấn mạnh: số vẫn = 1
  instanceCount.classList.remove("flash"); void instanceCount.offsetWidth;
  instanceCount.classList.add("flash");
  renderAll();
});

// ---------- Sự kiện: thao tác trên bồn (qua ref1) ----------
function runOp(op) {
  if (!refs.length) return;
  const boiler = ChocolateBoiler.getInstance();
  const ok = boiler[op]();
  let note;
  if (op === "fill")  note = ok ? "empty=false (đổ nguyên liệu)" : "bỏ qua: bồn không rỗng";
  if (op === "boil")  note = ok ? "boiled=true (đun sôi)"        : "bỏ qua: cần đầy & chưa sôi";
  if (op === "drain") note = ok ? "empty=true, boiled=false (xả ra)" : "bỏ qua: cần đã sôi mới xả";
  actions.push({ ref: refs[0], op, note });
  tank.classList.remove("ping"); void tank.offsetWidth; tank.classList.add("ping");
  renderAll();
}

fillBtn.addEventListener("click",  () => runOp("fill"));
boilBtn.addEventListener("click",  () => runOp("boil"));
drainBtn.addEventListener("click", () => runOp("drain"));

// ---------- Sự kiện: reset ----------
resetBtn.addEventListener("click", () => {
  refs = [];
  actions = [];
  ChocolateBoiler._resetForDemo();        // xoá để demo lại từ đầu
  refStack.innerHTML = "";
  renderAll();
});

// ---------- Tabs + khởi tạo ----------
setupTabs();
renderAll();
