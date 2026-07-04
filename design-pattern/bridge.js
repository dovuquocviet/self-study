// ===== Bridge Pattern — minh hoạ động (Remote ↔ Device) =====
// Abstraction (RemoteControl) giữ một THAM CHIẾU tới implementation (Device).
// Remote chỉ gọi qua interface Device → loại remote và loại thiết bị thay đổi
// ĐỘC LẬP với nhau (M + N lớp, không phải M × N).

// ---- "Runtime" trạng thái ----
const sys = {
  remote: "basic",   // basic | advanced
  device: "tv",      // tv | radio
  on: false,
  volume: 30,
};

const REMOTE_CLASS = { basic: "BasicRemote", advanced: "AdvancedRemote" };
const DEVICE_CLASS = { tv: "TV", radio: "Radio" };
const DEVICE_ICON  = { tv: "📺", radio: "📻" };

// ---- DOM refs ----
const log        = document.getElementById("log");
const remoteName = document.getElementById("remoteName");
const deviceName = document.getElementById("deviceName");
const screen     = document.getElementById("screen");
const screenIcon = document.getElementById("screenIcon");
const screenState= document.getElementById("screenState");
const volFill    = document.getElementById("volFill");
const volNum     = document.getElementById("volNum");
const rMute      = document.getElementById("rMute");
const btnMute    = document.getElementById("btnMute");
const bridgeLink = document.getElementById("bridgeLink");
const remoteBox  = document.getElementById("remoteBox");
const deviceBox  = document.getElementById("deviceBox");
const buildView  = document.getElementById("buildView");
const classView  = document.getElementById("classView");

// ====== Code TAB 2: định nghĩa lớp (tĩnh) ======
renderCode(classView, [
  "// ---- Implementation: interface Device + các thiết bị ----",
  "interface Device {",
  "  isEnabled();  enable();  disable();",
  "  getVolume();  setVolume(percent);",
  "}",
  "",
  "class TV implements Device {",
  "  enable()  { this.on = true; }",
  "  disable() { this.on = false; }",
  "  setVolume(p) { this.vol = clamp(p); }",
  "}",
  "class Radio implements Device {",
  "  enable()  { this.on = true; }",
  "  disable() { this.on = false; }",
  "  setVolume(p) { this.vol = clamp(p); }",
  "}",
  "",
  "// ---- Abstraction: giữ THAM CHIẾU tới Device ----",
  "class RemoteControl {",
  "  constructor(device) { this.device = device; }   // ← cây cầu",
  "  power() {",
  "    if (this.device.isEnabled()) this.device.disable();",
  "    else                         this.device.enable();",
  "  }",
  "  volumeUp()   { this.device.setVolume(this.device.getVolume() + 10); }",
  "  volumeDown() { this.device.setVolume(this.device.getVolume() - 10); }",
  "}",
  "",
  "// Refined Abstraction: mở rộng remote, KHÔNG đụng Device",
  "class AdvancedRemote extends RemoteControl {",
  "  mute() { this.device.setVolume(0); }",
  "}",
]);

// ====== Code TAB 1: runtime (cập nhật theo thao tác) ======
let buildLines = [];
function note(line) { buildLines.push(line); }
function flushBuild() { renderCode(buildView, buildLines); }

// dòng đầu luôn dựng lại object remote(device) hiện tại
function header() {
  const R = REMOTE_CLASS[sys.remote], D = DEVICE_CLASS[sys.device];
  return [
    `let device = new ${D}();`,
    `let remote = new ${R}(device);   // remote GIỮ tham chiếu device`,
  ];
}

// ====== Tiện ích sân khấu ======
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

function render() {
  remoteName.textContent = REMOTE_CLASS[sys.remote];
  deviceName.textContent = DEVICE_CLASS[sys.device];
  screenIcon.textContent = DEVICE_ICON[sys.device];
  screen.classList.toggle("on", sys.on);
  screenState.textContent = sys.on ? "ON" : "OFF";
  volFill.style.width = sys.volume + "%";
  volNum.textContent = sys.volume;
  // mute() chỉ có ở AdvancedRemote
  const adv = sys.remote === "advanced";
  rMute.classList.toggle("on", adv);
  btnMute.disabled = !adv;
}

// ====== Hành động trên remote (uỷ quyền cho device) ======
function power() {
  buildLines = header();
  note("remote.power();");
  if (sys.on) {
    note("//  -> device.isEnabled() == true → device.disable()");
    sys.on = false;
    logLine(`Tắt ${DEVICE_CLASS[sys.device]}`, "bad");
  } else {
    note("//  -> device.isEnabled() == false → device.enable()");
    sys.on = true;
    logLine(`Bật ${DEVICE_CLASS[sys.device]}`, "good");
  }
  signal(); render(); flushBuild();
}

function volume(dir) {
  buildLines = header();
  if (!sys.on) {
    note(`remote.volume${dir > 0 ? "Up" : "Down"}();`);
    note("//  -> device đang OFF, chỉnh âm lượng vẫn ghi nhận nội bộ");
  }
  const before = sys.volume;
  sys.volume = Math.max(0, Math.min(100, sys.volume + dir * 10));
  if (dir > 0) {
    note("remote.volumeUp();");
    note(`//  -> device.setVolume(device.getVolume() + 10)`);
  } else {
    note("remote.volumeDown();");
    note(`//  -> device.setVolume(device.getVolume() - 10)`);
  }
  note(`//     volume: ${before} -> ${sys.volume}`);
  logLine(`Âm lượng ${DEVICE_CLASS[sys.device]}: ${before} → ${sys.volume}`);
  signal(); render(); flushBuild();
}

function mute() {
  buildLines = header();
  note("remote.mute();   // chỉ AdvancedRemote mới có");
  note("//  -> device.setVolume(0)");
  const before = sys.volume;
  sys.volume = 0;
  logLine(`Tắt tiếng ${DEVICE_CLASS[sys.device]} (${before} → 0)`);
  signal(); render(); flushBuild();
}

function signal() {
  replay(bridgeLink, "signal");
}

// ====== Đổi remote / device (2 trục độc lập) ======
function pickRemote(kind, silent) {
  sys.remote = kind;
  document.querySelectorAll("#remotePicker .btn").forEach((b) =>
    b.classList.toggle("primary", b.dataset.remote === kind));
  if (!silent) {
    replay(remoteBox, "swap");
    logLine(`Đổi remote → ${REMOTE_CLASS[kind]}`, "muted");
    buildLines = header();
    note("// đổi abstraction — device giữ nguyên, KHÔNG cần lớp mới");
    flushBuild();
  }
  render();
}

function pickDevice(kind, silent) {
  sys.device = kind;
  sys.on = false; sys.volume = 30;   // thiết bị mới, reset trạng thái
  document.querySelectorAll("#devicePicker .btn").forEach((b) =>
    b.classList.toggle("primary", b.dataset.device === kind));
  if (!silent) {
    replay(deviceBox, "swap");
    logLine(`Cắm remote vào → ${DEVICE_CLASS[kind]}`, "muted");
    buildLines = header();
    note("// đổi implementation — remote giữ nguyên, hai phía độc lập");
    flushBuild();
  }
  render();
}

// ====== Sự kiện ======
document.querySelectorAll("#remotePicker .btn").forEach((b) =>
  b.addEventListener("click", () => pickRemote(b.dataset.remote)));
document.querySelectorAll("#devicePicker .btn").forEach((b) =>
  b.addEventListener("click", () => pickDevice(b.dataset.device)));
document.getElementById("btnPower").addEventListener("click", () => { replay(document.getElementById("rPower"), "press"); power(); });
document.getElementById("btnVolDown").addEventListener("click", () => { replay(document.getElementById("rDown"), "press"); volume(-1); });
document.getElementById("btnVolUp").addEventListener("click", () => { replay(document.getElementById("rUp"), "press"); volume(1); });
document.getElementById("btnMute").addEventListener("click", () => { if (sys.remote === "advanced") { replay(rMute, "press"); mute(); } });

// ====== Khởi tạo ======
setupTabs();
pickRemote("basic", true);
pickDevice("tv", true);
render();
renderCode(buildView, [
  "// remote GIỮ tham chiếu device qua constructor —",
  "// đó là 'cây cầu' nối abstraction với implementation.",
  "//",
  "let device = new TV();",
  "let remote = new BasicRemote(device);",
  "// Bấm nút bên trái để remote uỷ quyền cho device.",
]);
