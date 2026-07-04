// ===== Observer Pattern — minh hoạ động (trạm thời tiết Head First) =====
// WeatherData = Subject: giữ DANH SÁCH observer và khi có số đo mới thì
// lặp qua gọi update() trên TỪNG observer — KHÔNG biết lớp cụ thể nào.
// 3 observer: Current Conditions, Statistics, Forecast.
// Forecast có thể register/remove lúc chạy để thấy quan hệ ghép lỏng.

// ---------- DOM refs ----------
const tempSlider = document.getElementById("tempSlider");
const humSlider  = document.getElementById("humSlider");
const presSlider = document.getElementById("presSlider");
const tempVal    = document.getElementById("tempVal");
const humVal     = document.getElementById("humVal");
const presVal    = document.getElementById("presVal");
const setBtn     = document.getElementById("setBtn");
const registerBtn = document.getElementById("registerBtn");
const removeBtn   = document.getElementById("removeBtn");

const subjTemp = document.getElementById("subjTemp");
const subjHum  = document.getElementById("subjHum");
const subjPres = document.getElementById("subjPres");

const forecastNode  = document.getElementById("forecastNode");
const forecastBadge = document.getElementById("forecastBadge");
const subjectNode   = document.getElementById("subjectNode");
const stageArea     = document.getElementById("stageArea");
const wires         = document.querySelector(".wires");
const log = document.getElementById("log");
const buildView = document.getElementById("buildView");
const classView = document.getElementById("classView");

// ---------- Tiện ích hiệu ứng ----------
function pulse(node) {
  node.classList.remove("pulse");
  void node.offsetWidth;          // ép trình duyệt "reset" animation
  node.classList.add("pulse");
}
function litLine(line) {
  if (!line) return;
  line.classList.add("lit");
  setTimeout(() => line.classList.remove("lit"), 650);
}
function logLine(text, kind) {
  const div = document.createElement("div");
  div.className = "log-line" + (kind === "muted" ? " muted-line" : "");
  if (kind === "good") div.style.color = "var(--good)";
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

// ---------- Vẽ dây nối CHẠM ĐÚNG MÉP node (tự co theo kích thước) ----------
const WIRE_PAIRS = [
  ["lineCurrent",  "currentNode"],
  ["lineStats",    "statsNode"],
  ["lineForecast", "forecastNode"],
];
// Đo tâm + nửa-kích-thước của 1 phần tử, TƯƠNG ĐỐI với gốc toạ độ của SVG.
// Vì SVG không có viewBox nên user-space của nó = pixel, gốc tại góc trên-trái
// của chính nó → mọi toạ độ tính theo origin này là khớp tuyệt đối.
function rectCenter(el, origin) {
  const r = el.getBoundingClientRect();
  return { cx: r.left + r.width / 2 - origin.left,
           cy: r.top  + r.height / 2 - origin.top,
           hw: r.width / 2, hh: r.height / 2 };
}
// điểm giao của tia (từ tâm c tới đích tx,ty) với viền hình chữ nhật c
function borderPoint(c, tx, ty) {
  const dx = tx - c.cx, dy = ty - c.cy;
  if (!dx && !dy) return [c.cx, c.cy];
  const tX = dx ? c.hw / Math.abs(dx) : Infinity;
  const tY = dy ? c.hh / Math.abs(dy) : Infinity;
  const t = Math.min(tX, tY);
  return [c.cx + dx * t, c.cy + dy * t];
}
function layoutWires() {
  const origin = wires.getBoundingClientRect();   // gốc toạ độ = khung SVG
  if (!origin.width) return;
  const sub = rectCenter(subjectNode, origin);
  WIRE_PAIRS.forEach(([lineId, nodeId]) => {
    const node = rectCenter(document.getElementById(nodeId), origin);
    const [x1, y1] = borderPoint(sub, node.cx, node.cy);   // mép subject → node
    const [x2, y2] = borderPoint(node, sub.cx, sub.cy);    // mép node → subject
    const line = document.getElementById(lineId);
    line.setAttribute("x1", x1.toFixed(1));
    line.setAttribute("y1", y1.toFixed(1));
    line.setAttribute("x2", x2.toFixed(1));
    line.setAttribute("y2", y2.toFixed(1));
  });
}
function refreshWires() {
  requestAnimationFrame(layoutWires);
  setTimeout(layoutWires, 700);   // vẽ lại sau khi hiệu ứng pulse kết thúc
}

// =======================================================================
//  SUBJECT
// =======================================================================
class WeatherData {
  constructor() { this.observers = []; }       // danh sách observer đã đăng ký

  registerObserver(o) {
    if (!this.observers.includes(o)) this.observers.push(o);
  }
  removeObserver(o) {
    const i = this.observers.indexOf(o);
    if (i >= 0) this.observers.splice(i, 1);
  }
  notifyObservers() {                          // ⭐ điểm cốt lõi của pattern
    for (const o of this.observers) {
      o.update(this.temperature, this.humidity, this.pressure);
    }
  }
  setMeasurements(t, h, p) {
    this.temperature = t; this.humidity = h; this.pressure = p;
    this.notifyObservers();
  }
}

// =======================================================================
//  CÁC OBSERVER CỤ THỂ (mỗi cái implement update())
// =======================================================================
class CurrentConditionsDisplay {
  constructor() {
    this.varName = "currentDisplay";
    this.node = document.getElementById("currentNode");
    this.line = document.getElementById("lineCurrent");
    this.el   = document.getElementById("currentVal");
  }
  update(t, h, p) { this.temperature = t; this.humidity = h; this.display(); }
  display() {
    this.el.textContent = `${this.temperature}°C · ${this.humidity}%`;
    pulse(this.node); litLine(this.line);
  }
  summary() { return `${this.temperature}°C / ${this.humidity}%`; }
}

class StatisticsDisplay {
  constructor() {
    this.varName = "statisticsDisplay";
    this.node = document.getElementById("statsNode");
    this.line = document.getElementById("lineStats");
    this.el   = document.getElementById("statsVal");
    this.sum = 0; this.count = 0;
    this.max = -Infinity; this.min = Infinity;
  }
  update(t, h, p) {
    this.sum += t; this.count++;
    if (t > this.max) this.max = t;
    if (t < this.min) this.min = t;
    this.display();
  }
  get avg() { return this.count ? this.sum / this.count : 0; }
  display() {
    this.el.textContent =
      `avg ${this.avg.toFixed(1)}°\nmin ${this.min}° · max ${this.max}°`;
    pulse(this.node); litLine(this.line);
  }
  summary() {
    return `avg ${this.avg.toFixed(1)} / min ${this.min} / max ${this.max}`;
  }
}

class ForecastDisplay {
  constructor() {
    this.varName = "forecastDisplay";
    this.node = document.getElementById("forecastNode");
    this.line = document.getElementById("lineForecast");
    this.el   = document.getElementById("forecastVal");
    this.currentPressure = 1013;   // áp suất khởi điểm
    this.lastPressure = 1013;
    this.text = "—";
  }
  update(t, h, p) {
    this.lastPressure = this.currentPressure;
    this.currentPressure = p;
    this.display();
  }
  display() {
    if (this.currentPressure > this.lastPressure)      this.text = "🌤 Trời đang đẹp lên!";
    else if (this.currentPressure === this.lastPressure) this.text = "🌥 Thời tiết giữ nguyên";
    else                                                this.text = "🌧 Trời mát, có thể mưa";
    this.el.textContent = this.text;
    pulse(this.node); litLine(this.line);
  }
  summary() { return this.text; }
}

// =======================================================================
//  KHỞI TẠO
// =======================================================================
const weatherData     = new WeatherData();
const currentDisplay  = new CurrentConditionsDisplay();
const statsDisplay    = new StatisticsDisplay();
const forecastDisplay = new ForecastDisplay();

// thứ tự cố định khi vẽ sơ đồ / build code
const ALL = [currentDisplay, statsDisplay, forecastDisplay];

// ban đầu đăng ký cả 3 observer
weatherData.registerObserver(currentDisplay);
weatherData.registerObserver(statsDisplay);
weatherData.registerObserver(forecastDisplay);

function isRegistered(o) { return weatherData.observers.includes(o); }

// ---------- TAB 2: định nghĩa lớp (tĩnh) ----------
renderCode(classView, [
  "// «Subject» — giao diện cho đối tượng được quan sát",
  "interface Subject {",
  "  registerObserver(o)",
  "  removeObserver(o)",
  "  notifyObservers()",
  "}",
  "",
  "// «Observer» — ai muốn nhận tin phải có update()",
  "interface Observer {",
  "  update(temp, humidity, pressure)",
  "}",
  "",
  "// WeatherData: subject cụ thể, GIỮ danh sách observer",
  "class WeatherData implements Subject {",
  "  constructor() { this.observers = []; }",
  "  registerObserver(o) { this.observers.push(o); }",
  "  removeObserver(o) {",
  "    this.observers.splice(this.observers.indexOf(o), 1);",
  "  }",
  "  notifyObservers() {",
  "    for (const o of this.observers)        // KHÔNG biết lớp cụ thể",
  "      o.update(this.temp, this.humidity, this.pressure);",
  "  }",
  "  setMeasurements(t, h, p) {",
  "    this.temp = t; this.humidity = h; this.pressure = p;",
  "    this.notifyObservers();                // có tin mới → báo hết",
  "  }",
  "}",
  "",
  "// Các display là Observer cụ thể",
  "class CurrentConditionsDisplay implements Observer {",
  "  update(t, h, p) { this.temp = t; this.humidity = h; this.display(); }",
  "}",
  "class StatisticsDisplay implements Observer {",
  "  update(t, h, p) { /* cộng dồn avg/min/max nhiệt độ */ }",
  "}",
  "class ForecastDisplay implements Observer {",
  "  update(t, h, p) { /* dự báo theo xu hướng áp suất */ }",
  "}",
]);

// ---------- TAB 1: code runtime theo trạng thái hiện tại ----------
function renderBuildView() {
  const t = +tempSlider.value, h = +humSlider.value, p = +presSlider.value;
  const lines = [];
  lines.push(`weatherData.setMeasurements(${t}, ${h}, ${p});`);
  lines.push("");
  lines.push("// notifyObservers(): lặp qua danh sách observer đã đăng ký");
  weatherData.observers.forEach((o) => {
    lines.push(`//   ${o.varName}.update(${t}, ${h}, ${p})`);
  });
  if (!isRegistered(forecastDisplay)) {
    lines.push("//   forecastDisplay đã removeObserver() → KHÔNG được gọi");
  }
  lines.push("");
  lines.push("// Mỗi display tự cập nhật trạng thái của nó:");
  ALL.forEach((o) => {
    if (isRegistered(o)) lines.push(`//   ${o.varName} → ${o.summary()}`);
  });
  renderCode(buildView, lines);
}

// ---------- Cập nhật sơ đồ (subject + trạng thái đăng ký) ----------
function renderSubject() {
  subjTemp.textContent = tempSlider.value;
  subjHum.textContent  = humSlider.value;
  subjPres.textContent = presSlider.value;
}
function renderForecastReg() {
  const on = isRegistered(forecastDisplay);
  forecastNode.classList.toggle("unsubscribed", !on);
  forecastBadge.textContent = on ? "đăng ký" : "đã huỷ";
  // làm mờ dây nối khi không đăng ký
  forecastDisplay.line.classList.toggle("muted", !on);
}

// ---------- Hành động chính: đặt số đo & notify ----------
function setMeasurements() {
  const t = +tempSlider.value, h = +humSlider.value, p = +presSlider.value;
  renderSubject();
  pulse(document.getElementById("subjectNode"));

  log.innerHTML = "";
  logLine(`setMeasurements(${t}, ${h}, ${p})`);
  logLine(`→ notifyObservers()  ·  ${weatherData.observers.length} observer`, "muted");

  weatherData.setMeasurements(t, h, p);   // ⭐ subject lặp & gọi update()

  weatherData.observers.forEach((o) => logLine(`✓ ${o.varName}.update()`, "good"));
  if (!isRegistered(forecastDisplay)) {
    logLine("✗ forecastDisplay (đã huỷ đăng ký) — bỏ qua", "muted");
  }
  renderBuildView();
  refreshWires();          // nội dung node đổi cỡ → vẽ lại dây cho khớp
}

// ---------- Sự kiện ----------
tempSlider.addEventListener("input", () => { tempVal.textContent = tempSlider.value; renderSubject(); renderBuildView(); refreshWires(); });
humSlider .addEventListener("input", () => { humVal.textContent  = humSlider.value;  renderSubject(); renderBuildView(); refreshWires(); });
presSlider.addEventListener("input", () => { presVal.textContent = presSlider.value; renderSubject(); renderBuildView(); refreshWires(); });

// Thả chuột khỏi slider → tự notify (kéo xong là các bảng cập nhật ngay)
[tempSlider, humSlider, presSlider].forEach((s) =>
  s.addEventListener("change", setMeasurements));

setBtn.addEventListener("click", setMeasurements);

registerBtn.addEventListener("click", () => {
  if (isRegistered(forecastDisplay)) return;
  weatherData.registerObserver(forecastDisplay);
  renderForecastReg();
  pulse(forecastNode);
  logLine("weatherData.registerObserver(forecastDisplay)", "good");
  renderBuildView();
  refreshWires();
});

removeBtn.addEventListener("click", () => {
  if (!isRegistered(forecastDisplay)) return;
  weatherData.removeObserver(forecastDisplay);
  renderForecastReg();
  logLine("weatherData.removeObserver(forecastDisplay)", "muted");
  renderBuildView();
  refreshWires();
});

window.addEventListener("resize", refreshWires);

// ---------- Tabs + chạy lần đầu ----------
setupTabs();
renderForecastReg();
setMeasurements();   // populate sơ đồ + code ngay khi tải trang
refreshWires();      // vẽ dây lần đầu (sau khi layout xong)
window.addEventListener("load", refreshWires);
