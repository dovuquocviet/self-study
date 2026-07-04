// ===== MVC / MVVM — minh hoạ động (bộ đếm) =====
// Dữ liệu chảy MỘT CHIỀU: Controller nhận input → cập nhật Model →
// Model notify → View render lại. View KHÔNG tự sửa state.

// ---- "runtime" ----
let modelCount = 0;

// ---- DOM ----
const log        = document.getElementById("log");
const modelVal   = document.getElementById("modelVal");
const viewSync   = document.getElementById("viewSync");
const modelState = document.getElementById("modelState");
const viewScreen = document.getElementById("viewScreen");
const arrCM      = document.getElementById("arrCM");
const arrMV      = document.getElementById("arrMV");
const arrVC      = document.getElementById("arrVC");
const ctrlBox    = document.getElementById("ctrlBox");
const modelBox   = document.getElementById("modelBox");
const viewBox    = document.getElementById("viewBox");
const buildView  = document.getElementById("buildView");
const classView  = document.getElementById("classView");

// ====== TAB 2: định nghĩa lớp ======
renderCode(classView, [
  "// MODEL — giữ state + báo cho ai đang lắng nghe",
  "class CounterModel {",
  "  constructor() { this.count = 0; this.listeners = []; }",
  "  subscribe(fn) { this.listeners.push(fn); }   // (MVVM: binding)",
  "  notify() { this.listeners.forEach(fn => fn(this.count)); }",
  "  increment() { this.count++; this.notify(); }",
  "  decrement() { this.count--; this.notify(); }",
  "  reset()     { this.count = 0; this.notify(); }",
  "}",
  "",
  "// VIEW — CHỈ hiển thị, không chứa logic nghiệp vụ",
  "class CounterView {",
  "  render(count) {",
  "    screen.textContent = count;   // vẽ lại theo state",
  "  }",
  "}",
  "",
  "// CONTROLLER — dịch input người dùng thành lệnh cho Model",
  "class CounterController {",
  "  constructor(model) { this.model = model; }",
  "  increment() { this.model.increment(); }",
  "  decrement() { this.model.decrement(); }",
  "  reset()     { this.model.reset(); }",
  "}",
  "",
  "// Lắp ráp + 'binding' Model → View",
  "const model = new CounterModel();",
  "const view  = new CounterView();",
  "const ctrl  = new CounterController(model);",
  "model.subscribe(count => view.render(count)); // 1 chiều",
]);

// ====== TAB 1: runtime ======
function renderBuild(action, before, after) {
  renderCode(buildView, [
    `// Người dùng bấm → controller.${action}()`,
    `ctrl.${action}();`,
    `//  -> model.${action}()`,
    `//     model.count: ${before} -> ${after}`,
    "//  -> model.notify()",
    "//     lặp qua listeners, gọi view.render(count)",
    `//  -> view.render(${after})`,
    `//     màn hình hiển thị: ${after}`,
    "//",
    "// Lưu ý: input KHÔNG sửa thẳng View —",
    "// luôn đi qua Model rồi mới render.",
  ]);
}

// ====== tiện ích ======
function logLine(msg, kind) {
  const div = document.createElement("div");
  div.className = "log-line" + (kind === "muted" ? " muted-line" : "");
  if (kind === "good") div.style.color = "var(--good)";
  div.textContent = msg;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}
function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

// VIEW.render — chỉ cập nhật hiển thị theo state
function viewRender(count) {
  viewScreen.textContent = count;
  viewSync.textContent = count;
  replay(viewScreen, "bump");
}

// chạy hoạt cảnh vòng C → M → V theo thứ tự
function playFlow() {
  replay(ctrlBox, "pulse");
  arrCM.classList.add("lit");
  setTimeout(() => {
    arrCM.classList.remove("lit");
    replay(modelBox, "pulse");
    modelState.textContent = modelCount;
    modelVal.textContent = modelCount;
    arrMV.classList.add("lit");
  }, 360);
  setTimeout(() => {
    arrMV.classList.remove("lit");
    replay(viewBox, "pulse");
    viewRender(modelCount);   // Model notify → View render
    arrVC.classList.add("lit");
  }, 760);
  setTimeout(() => arrVC.classList.remove("lit"), 1160);
}

// CONTROLLER.action — nhận input, cập nhật MODEL
function dispatch(action) {
  const before = modelCount;
  if (action === "increment") modelCount++;
  if (action === "decrement") modelCount--;
  if (action === "reset")     modelCount = 0;
  logLine(`controller.${action}() → model.count ${before} → ${modelCount} → view render`, "good");
  renderBuild(action, before, modelCount);
  playFlow();
}

// ====== sự kiện ======
document.getElementById("incBtn").addEventListener("click", () => dispatch("increment"));
document.getElementById("decBtn").addEventListener("click", () => dispatch("decrement"));
document.getElementById("resetBtn").addEventListener("click", () => dispatch("reset"));

// ====== khởi tạo ======
setupTabs();
viewRender(0);
renderCode(buildView, [
  "// model.count = 0; view đã subscribe model",
  "// Bấm một nút bên trái để xem dữ liệu chảy",
  "// một chiều: Controller → Model → View.",
]);
