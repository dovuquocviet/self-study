// ===== Lazy Loading — minh hoạ động (ảnh HD nặng) =====
// Tài nguyên nặng KHÔNG tạo ngay. Lần đầu đọc .value mới heavyInit() (tốn thời
// gian), rồi cache lại trong _value. Các lần sau trả thẳng từ cache.

const LOAD_MS = 1400;

// ---- "Tài nguyên lazy" runtime ----
const res = {
  _value: null,     // cache; null = chưa tạo
  created: 0,       // số lần heavyInit() chạy thật
  access: 0,        // số lần đọc .value
  loading: false,
};

// ---- DOM refs ----
const placeholder = document.getElementById("placeholder");
const spinner     = document.getElementById("spinner");
const hdImg       = document.getElementById("hdImg");
const badge       = document.getElementById("badge");
const statInit    = document.getElementById("statInit");
const statCreated = document.getElementById("statCreated");
const statAccess  = document.getElementById("statAccess");
const saveNote    = document.getElementById("saveNote");
const log         = document.getElementById("log");
const buildView   = document.getElementById("buildView");
const classView   = document.getElementById("classView");
const btnAccess   = document.getElementById("btnAccess");

// ====== Code TAB 2: định nghĩa lớp (tĩnh) ======
renderCode(classView, [
  "// Cách 1 — Lazy getter: cache trong _value",
  "class HdImage {",
  "  constructor(url) {",
  "    this.url = url;",
  "    this._value = null;   // chưa tải gì cả",
  "  }",
  "",
  "  get value() {",
  "    if (!this._value) {            // lần đầu?",
  "      this._value = heavyInit();   // tốn kém, chạy 1 lần",
  "    }",
  "    return this._value;            // lần sau: trả cache",
  "  }",
  "}",
  "",
  "// Cách 2 — Virtual Proxy: đứng thay tài nguyên thật",
  "class ImageProxy {",
  "  constructor(url) { this.url = url; this.real = null; }",
  "  display() {",
  "    if (!this.real)                 // tạo khi cần",
  "      this.real = new RealImage(this.url);",
  "    return this.real.display();",
  "  }",
  "}",
  "",
  "function heavyInit() {",
  "  // mở file HD, giải nén, decode... (chậm)",
  "  return loadHdFromDisk();",
  "}",
]);

// ====== Tiện ích ======
function logLine(msg, kind) {
  const div = document.createElement("div");
  div.className = "log-line" + (kind === "muted" ? " muted-line" : "");
  if (kind === "good") div.style.color = "var(--good)";
  if (kind === "new")  div.style.color = "var(--accent)";
  div.textContent = msg;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}
function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

function renderStats() {
  statInit.textContent    = res._value ? "rồi" : "chưa";
  statInit.style.color    = res._value ? "var(--good)" : "var(--muted)";
  statCreated.textContent = res.created;
  statAccess.textContent  = res.access;
}

// ====== Hành vi: đọc .value ======
function access() {
  res.access++;
  btnAccess.disabled = true;

  if (res._value) {
    // ----- CACHE HIT: trả ngay -----
    renderCode(buildView, [
      `hdImage.value;   // lần truy cập #${res.access}`,
      "//  get value() {",
      "//    if (!this._value) {...}   // _value đã có → BỎ QUA",
      `//    return this._value;       // ⚡ trả ngay từ cache`,
      "//  }",
      `//  -> không tải lại; created vẫn = ${res.created}`,
    ]);
    logLine(`Truy cập #${res.access}: cache hit ⚡ trả ngay`, "good");
    replay(hdImg, "cacheHit");
    renderStats();
    btnAccess.disabled = false;
    return;
  }

  // ----- LẦN ĐẦU: phải khởi tạo -----
  renderCode(buildView, [
    `hdImage.value;   // lần truy cập #${res.access} (LẦN ĐẦU)`,
    "//  get value() {",
    "//    if (!this._value)            // null → cần tạo",
    "//      this._value = heavyInit(); // ⏳ tải HD... (chậm)",
  ]);
  logLine(`Truy cập #${res.access}: _value rỗng → heavyInit()…`, "new");
  res.loading = true;
  placeholder.classList.add("hidden");
  spinner.classList.remove("hidden");
  badge.textContent = "đang heavyInit()…";
  renderStats();

  setTimeout(() => {
    res._value = { hd: true };   // cache lại
    res.created++;
    res.loading = false;
    spinner.classList.add("hidden");
    hdImg.classList.remove("hidden");
    replay(hdImg, "reveal");
    badge.textContent = "_value = <HdImage>";
    replay(badge, "flash");
    logLine("Tải xong → cache vào _value", "good");

    renderCode(buildView, [
      `hdImage.value;   // lần truy cập #${res.access} (LẦN ĐẦU)`,
      "//  get value() {",
      "//    if (!this._value)            // null → cần tạo",
      "//      this._value = heavyInit(); // ✓ xong, đã cache",
      "//    return this._value;",
      "//  }",
      `//  -> created = ${res.created}. Lần sau sẽ KHÔNG tải lại.`,
    ]);
    saveNote.innerHTML = `Đã truy cập <b>${res.access}</b> lần, nhưng heavyInit() chỉ chạy <b>${res.created}</b> lần. Bấm tiếp để thấy cache hit ⚡`;
    renderStats();
    btnAccess.disabled = false;
  }, LOAD_MS);
}

function reset() {
  res._value = null; res.created = 0; res.access = 0; res.loading = false;
  spinner.classList.add("hidden");
  hdImg.classList.add("hidden");
  placeholder.classList.remove("hidden");
  badge.textContent = "_value = null";
  btnAccess.disabled = false;
  log.innerHTML = "";
  logLine("Tài nguyên chưa được tạo (lazy)…", "muted");
  saveNote.innerHTML = "Dù truy cập bao nhiêu lần, tài nguyên chỉ được tạo <b>đúng 1 lần</b>.";
  renderStats();
  renderCode(buildView, [
    "const hdImage = new HdImage('photo.hd');",
    "// _value = null  → CHƯA tải gì cả (lazy)",
    "//",
    "// Bấm 'hdImage.value' để truy cập lần đầu.",
  ]);
}

// ====== Sự kiện ======
btnAccess.addEventListener("click", access);
document.getElementById("btnReset").addEventListener("click", reset);

// ====== Khởi tạo ======
setupTabs();
reset();
