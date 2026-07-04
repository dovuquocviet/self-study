// ===== Dependency Injection — minh hoạ động (Car nhận Engine qua constructor) =====
// Car KHÔNG tự new PetrolEngine(). Nó khai báo "cần một Engine" và nhận qua
// constructor. Container chịu trách nhiệm tạo + tiêm (inject) engine đã đăng ký.

const ENGINES = {
  petrol:   { cls: "PetrolEngine",   sound: "Vroom vroom 🛢️",  label: "Petrol\nEngine" },
  electric: { cls: "ElectricEngine", sound: "Hmmmmm ⚡ (êm)",   label: "Electric\nEngine" },
  mock:     { cls: "MockEngine",     sound: "fake-start ✅ (test)", label: "Mock\nEngine" },
};

// ---- "runtime" state ----
let selected = "petrol";   // engine đang đăng ký trong container
let injected = null;       // engine đã tiêm vào car (null = chưa có)

// ---- DOM refs ----
const log        = document.getElementById("log");
const socket     = document.getElementById("socket");
const socketHint = document.getElementById("socketHint");
const car        = document.getElementById("car");
const regName    = document.getElementById("regName");
const flowArrow  = document.getElementById("flowArrow");
const engineBadge= document.getElementById("engineBadge");
const startBtn   = document.getElementById("startBtn");
const buildView  = document.getElementById("buildView");
const classView  = document.getElementById("classView");

// ====== TAB 2: định nghĩa lớp (tĩnh) ======
renderCode(classView, [
  "// Interface mà Car phụ thuộc — KHÔNG phải lớp cụ thể",
  "class Engine {",
  "  start() {}",
  "}",
  "",
  "// Các bản cài đặt cụ thể",
  "class PetrolEngine extends Engine {",
  "  start() { return 'Vroom vroom'; }",
  "}",
  "class ElectricEngine extends Engine {",
  "  start() { return 'Hmmmmm (êm)'; }",
  "}",
  "class MockEngine extends Engine {     // dùng khi test",
  "  start() { return 'fake-start'; }",
  "}",
  "",
  "// Car nhận engine QUA CONSTRUCTOR (được 'tiêm' vào)",
  "class Car {",
  "  constructor(engine) {   // ← dependency injection",
  "    this.engine = engine; // KHÔNG new ở đây!",
  "  }",
  "  start() {",
  "    return this.engine.start();  // uỷ quyền cho engine",
  "  }",
  "}",
  "",
  "// Container: đăng ký & resolve (tự tiêm phụ thuộc)",
  "class Container {",
  "  constructor() { this.regs = {}; }",
  "  register(key, factory) { this.regs[key] = factory; }",
  "  resolve(key) { return this.regs[key](this); }",
  "}",
  "",
  "const c = new Container();",
  "c.register('Engine', () => new PetrolEngine());",
  "c.register('Car', (c) => new Car(c.resolve('Engine')));",
  "const car = c.resolve('Car');  // engine tự được tiêm",
]);

// ====== TAB 1: runtime ======
function renderBuild() {
  const e = ENGINES[selected];
  const lines = [
    "// Container đăng ký engine đang chọn:",
    `container.register('Engine', () => new ${e.cls}());`,
    "container.register('Car',",
    "  (c) => new Car( c.resolve('Engine') ));",
    "",
  ];
  if (!injected) {
    lines.push("// ⏳ Chưa resolve — Car chưa có engine.");
    lines.push("// Bấm Inject để container tiêm engine vào Car.");
  } else {
    const ie = ENGINES[injected];
    lines.push("const car = container.resolve('Car');");
    lines.push(`//  -> new ${ie.cls}()        // container tạo engine`);
    lines.push(`//  -> new Car(engine)         // rồi TIÊM vào Car`);
    lines.push("// car.engine giờ là " + ie.cls + " — Car không hề biết");
    lines.push("// chi tiết, chỉ thấy interface Engine.");
    if (carStarted) {
      lines.push("");
      lines.push("car.start();");
      lines.push("//  -> this.engine.start()");
      lines.push(`//     "${ie.sound}"`);
    }
  }
  renderCode(buildView, lines);
}

// ====== tiện ích ======
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

let carStarted = false;
let engineEl = null;

function selectEngine(key) {
  selected = key;
  document.querySelectorAll(".engine-chip").forEach((c) =>
    c.classList.toggle("active", c.dataset.engine === key));
  regName.textContent = ENGINES[key].cls;
  logLine(`Container đăng ký '${ENGINES[key].cls}' cho khoá Engine`, "muted");
  renderBuild();
}

function inject() {
  // gỡ engine cũ (nếu có) để tiêm cái mới
  if (engineEl) engineEl.remove();
  injected = selected;
  carStarted = false;

  const e = ENGINES[injected];
  engineEl = document.createElement("div");
  engineEl.className = "engine-block " + injected + " injecting";
  engineEl.textContent = e.label;
  socketHint.style.display = "none";
  socket.classList.add("filled");
  socket.appendChild(engineEl);
  replay(flowArrow, "lit");

  engineBadge.textContent = "engine: " + e.cls;
  replay(engineBadge, "flash");
  startBtn.disabled = false;

  logLine(`💉 container.resolve('Car') → tiêm ${e.cls} vào Car`, "good");
  renderBuild();
}

function startCar() {
  if (!injected) return;
  carStarted = true;
  const e = ENGINES[injected];
  car.classList.add("running");
  if (engineEl) replay(engineEl, "revving");
  logLine(`🔑 car.start() → engine.start() → "${e.sound}"`, "good");
  renderBuild();
  clearTimeout(startCar._t);
  startCar._t = setTimeout(() => {
    car.classList.remove("running");
    if (engineEl) engineEl.classList.remove("revving");
  }, 2200);
}

function reset() {
  if (engineEl) { engineEl.remove(); engineEl = null; }
  injected = null; carStarted = false;
  socket.classList.remove("filled");
  socketHint.style.display = "";
  car.classList.remove("running");
  engineBadge.textContent = "chưa có engine";
  startBtn.disabled = true;
  logLine("♻︎ Đã tháo engine — Car lại rỗng, chờ inject", "muted");
  renderBuild();
}

// ====== sự kiện ======
document.querySelectorAll(".engine-chip").forEach((c) =>
  c.addEventListener("click", () => selectEngine(c.dataset.engine)));
document.getElementById("injectBtn").addEventListener("click", inject);
document.getElementById("startBtn").addEventListener("click", startCar);
document.getElementById("resetBtn").addEventListener("click", reset);

// ====== khởi tạo ======
setupTabs();
renderBuild();
