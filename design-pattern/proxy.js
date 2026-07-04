// ===== Proxy Pattern — minh hoạ động =====
// Virtual Proxy: ImageProxy triển khai CÙNG interface với RealImage, nhưng chỉ
// dựng RealImage (việc nặng: loadFromDisk()) ở LẦN ĐẦU display(). Các lần sau
// proxy dùng lại realImage đã có -> hiển thị tức thì. Đó là điểm cốt lõi.

// ---- Mô hình proxy chạy thật trong trang (chỉ để bộ đếm "trung thực") ----
let realCount = 0;       // số RealImage đã thực sự được dựng (mong đợi = 1)
let displayCount = 0;    // số lần client gọi display()
let hasReal = false;     // proxy đã có realImage chưa
let busy = false;        // đang chạy animation tải?

// ---- DOM refs ----
const frame        = document.getElementById("frame");
const phText       = document.getElementById("phText");
const progressBar  = document.getElementById("progressBar");
const frameTag     = document.getElementById("frameTag");
const realCountEl  = document.getElementById("realCount");
const displayCountEl = document.getElementById("displayCount");
const log          = document.getElementById("log");
const displayBtn   = document.getElementById("displayBtn");
const resetBtn     = document.getElementById("resetBtn");
const buildView    = document.getElementById("buildView");
const classView    = document.getElementById("classView");

// ---------- TAB 2: định nghĩa lớp (tĩnh) ----------
renderCode(classView, [
  "// Interface chung: cả ảnh thật lẫn proxy đều LÀ Image",
  "interface Image {",
  "  display();",
  "}",
  "",
  "// RealImage RẤT NẶNG: vừa tạo đã loadFromDisk() ngay",
  "class RealImage implements Image {",
  "  constructor(filename) {",
  "    this.filename = filename;",
  "    this.loadFromDisk();      // tốn ~1.5s",
  "  }",
  "  loadFromDisk() {",
  '    print("Loading " + this.filename);',
  "  }",
  "  display() {",
  '    print("Displaying " + this.filename);',
  "  }",
  "}",
  "",
  "// ProxyImage: CÙNG interface, đứng thay RealImage",
  "class ProxyImage implements Image {",
  "  constructor(filename) {",
  "    this.filename = filename;",
  "    this.realImage = null;    // CHƯA tạo gì cả",
  "  }",
  "  display() {",
  "    if (this.realImage == null) {        // lazy creation",
  "      this.realImage = new RealImage(this.filename);",
  "    }",
  "    this.realImage.display();            // uỷ quyền cho ảnh thật",
  "  }",
  "}",
]);

// ---------- TAB 1: code runtime, cập nhật theo số lần display() ----------
function renderBuildView() {
  const lines = [
    'let image = new ProxyImage("photo.jpg");',
    "// → proxy chỉ giữ filename, realImage = null (chưa tải gì cả)",
    "",
  ];

  if (displayCount === 0) {
    lines.push("// Chưa gọi display() lần nào → RealImage chưa tồn tại");
  }

  for (let i = 1; i <= displayCount; i++) {
    lines.push("image.display();");
    if (i === 1) {
      lines.push("//   #1: realImage == null → new RealImage(\"photo.jpg\")");
      lines.push("//       → loadFromDisk()  (việc NẶNG, làm 1 lần)");
      lines.push("//       → realImage.display()");
    } else {
      lines.push(`//   #${i}: realImage đã có → bỏ qua việc tải`);
      lines.push("//       → realImage.display()  (tức thì)");
    }
  }

  lines.push("");
  lines.push(`// RealImage đã dựng: ${realCount}  (luôn = 1 dù display() nhiều lần)`);
  renderCode(buildView, lines);
}

// ---------- Log ----------
function addLog(text, kind) {
  const div = document.createElement("div");
  div.className = "log-line" + (kind === "muted" ? " muted-line" : "");
  if (kind === "good") div.style.color = "var(--good)";
  if (kind === "accent") div.style.color = "var(--accent-2)";
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function updateCounters() {
  realCountEl.textContent = realCount;
  realCountEl.classList.remove("flash");
  void realCountEl.offsetWidth;
  realCountEl.classList.add("flash");
  displayCountEl.textContent = `display() đã gọi: ${displayCount} lần`;
}

// ---------- Hành vi display() của proxy ----------
function proxyDisplay() {
  if (busy) return;
  displayCount++;

  if (!hasReal) {
    // LẦN ĐẦU: proxy phải dựng RealImage (việc nặng) -> animation tải
    busy = true;
    displayBtn.disabled = true;
    addLog(`display() #${displayCount}: realImage == null → tải RealImage từ ổ đĩa...`, "accent");

    frame.classList.add("loading");
    phText.textContent = "loadFromDisk(\"photo.jpg\")…";
    frameTag.textContent = 'new RealImage("photo.jpg")';

    let pct = 0;
    progressBar.style.width = "0%";
    const timer = setInterval(() => {
      pct += 100 / 15;                 // ~1.5s (15 bước × 100ms)
      progressBar.style.width = Math.min(pct, 100) + "%";
      if (pct >= 100) {
        clearInterval(timer);
        // RealImage sẵn sàng
        realCount++;
        hasReal = true;
        frame.classList.remove("loading");
        frame.classList.add("loaded");
        phText.textContent = "";
        frameTag.textContent = "realImage.display()  // photo.jpg";
        addLog("RealImage đã sẵn sàng → realImage.display() (hiển thị)", "good");
        busy = false;
        displayBtn.disabled = false;
        updateCounters();
        renderBuildView();
      }
    }, 100);
  } else {
    // LẦN SAU: realImage đã có -> hiển thị ngay, KHÔNG tải lại
    addLog(`display() #${displayCount}: realImage đã có → dùng lại, hiển thị ngay`, "");
    frame.classList.remove("loaded");
    void frame.offsetWidth;          // restart hiệu ứng fade-in cho thấy "vẽ lại"
    frame.classList.add("loaded");
  }

  updateCounters();
  renderBuildView();
}

// ---------- Tạo proxy mới (reset) ----------
function newProxy() {
  if (busy) return;
  realCount = 0;
  displayCount = 0;
  hasReal = false;
  frame.classList.remove("loaded", "loading");
  progressBar.style.width = "0%";
  phText.textContent = "Đang chờ… (chưa tải ảnh thật)";
  frameTag.textContent = 'ProxyImage("photo.jpg")';
  log.innerHTML = "";
  addLog("ProxyImage tạo (chưa tải ảnh thật)", "muted");
  updateCounters();
  renderBuildView();
}

// ---------- Sự kiện ----------
displayBtn.addEventListener("click", proxyDisplay);
resetBtn.addEventListener("click", newProxy);

// ---------- Tabs + khởi tạo ----------
setupTabs();
newProxy();
