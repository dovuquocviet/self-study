// ===== Module Pattern — minh hoạ động (Counter với closure) =====
// IIFE chạy ngay, tạo biến `count` PRIVATE trong closure. Object trả về chỉ
// lộ API công khai (increment/reset/get). Bên ngoài KHÔNG chạm được `count`.

// ---- Counter THẬT (closure thật trong JS) ----
const Counter = (function () {
  let count = 0;                       // PRIVATE — không ai ngoài chạm tới
  return {
    increment() { count++; return count; },
    reset()     { count = 0; return count; },
    get()       { return count; },
  };
})();

// ---- DOM refs ----
const countVal  = document.getElementById("countVal");
const badge     = document.getElementById("badge");
const shield    = document.getElementById("shield");
const privZone  = document.getElementById("privZone");
const log       = document.getElementById("log");
const buildView = document.getElementById("buildView");
const classView = document.getElementById("classView");
const apiInc    = document.getElementById("apiInc");
const apiReset  = document.getElementById("apiReset");
const apiGet    = document.getElementById("apiGet");

// ====== Code TAB 2: định nghĩa lớp (tĩnh) ======
renderCode(classView, [
  "// IIFE: hàm tự gọi ngay → tạo một scope riêng",
  "const Counter = (function () {",
  "",
  "  // ----- PRIVATE: chỉ sống trong closure này -----",
  "  let count = 0;                  // không export ra ngoài",
  "  function log(msg) { ... }       // helper riêng tư",
  "",
  "  // ----- PUBLIC: revealing module -----",
  "  return {",
  "    increment() { count++; return count; },",
  "    reset()     { count = 0; },",
  "    get()       { return count; },",
  "  };",
  "})();",
  "",
  "// Dùng:",
  "Counter.increment();   // ✓ qua API public",
  "Counter.get();         // ✓ → đọc count gián tiếp",
  "",
  "// Phá rào:",
  "Counter.count;         // undefined — không lộ ra!",
  "Counter.count = 999;   // tạo prop RÁC, KHÔNG đụng count thật",
  "Counter.get();         // vẫn là giá trị closure đúng",
]);

// ====== Tiện ích ======
function logLine(msg, kind) {
  const div = document.createElement("div");
  div.className = "log-line" + (kind === "muted" ? " muted-line" : "");
  if (kind === "good") div.style.color = "var(--good)";
  if (kind === "bad")  div.style.color = "#ff9b9b";
  div.textContent = msg;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}
function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

function syncCount() {
  countVal.textContent = Counter.get();
  replay(countVal, "bump");
}

// ====== Hành vi qua API public ======
function callInc() {
  replay(apiInc, "fire");
  replay(privZone, "touch");
  const v = Counter.increment();
  syncCount();
  badge.textContent = `Counter.get() → ${v}`;
  replay(badge, "flash");
  logLine(`increment() → count = ${v}`, "good");
  renderCode(buildView, [
    "Counter.increment();",
    "//  -> bên trong closure: count++",
    `//  -> count giờ = ${v}`,
    "//  (bạn KHÔNG thấy count trực tiếp, chỉ thấy kết quả)",
  ]);
}

function callReset() {
  replay(apiReset, "fire");
  replay(privZone, "touch");
  Counter.reset();
  syncCount();
  badge.textContent = "Counter.get() → 0";
  replay(badge, "flash");
  logLine("reset() → count = 0", "muted");
  renderCode(buildView, [
    "Counter.reset();",
    "//  -> bên trong closure: count = 0",
    "//  -> state riêng tư đã về 0",
  ]);
}

function callGet() {
  replay(apiGet, "fire");
  const v = Counter.get();
  badge.textContent = `Counter.get() → ${v}`;
  replay(badge, "flash");
  logLine(`get() → ${v}`, "good");
  renderCode(buildView, [
    "Counter.get();",
    `//  -> return count   // = ${v}`,
    "//  getter là cách DUY NHẤT đọc count từ ngoài",
  ]);
}

// ====== Thử phá rào: truy cập trực tiếp ======
function hack() {
  replay(shield, "block");
  replay(privZone, "deny");
  // Thật sự thử trên object Counter:
  const before = Counter.get();
  const direct = Counter.count;        // undefined — không lộ
  Counter.count = 999;                 // chỉ tạo prop rác, không đụng closure
  const after = Counter.get();
  logLine("Counter.count → undefined (bị chặn) 🛡️", "bad");
  logLine(`Counter.count = 999 vô hại: get() vẫn = ${after}`, "bad");
  badge.textContent = `Counter.get() → ${after}`;
  renderCode(buildView, [
    "Counter.count;          // " + String(direct) + "  ← không lộ ra!",
    "Counter.count = 999;    // chỉ tạo property RÁC bên ngoài",
    "Counter.get();          // = " + after + "  (count thật không đổi)",
    "//  -> closure bảo vệ count: phá rào bất thành 🛡️",
    `//  -> trước=${before}, sau=${after}`,
  ]);
}

// ====== Sự kiện ======
document.getElementById("btnInc").addEventListener("click", callInc);
document.getElementById("btnReset").addEventListener("click", callReset);
document.getElementById("btnGet").addEventListener("click", callGet);
document.getElementById("btnHack").addEventListener("click", hack);

// ====== Khởi tạo ======
setupTabs();
syncCount();
renderCode(buildView, [
  "const Counter = (function () {",
  "  let count = 0;   // PRIVATE trong closure",
  "  return { increment, reset, get };",
  "})();",
  "//",
  "// Bấm các nút bên trái để gọi API public.",
]);
