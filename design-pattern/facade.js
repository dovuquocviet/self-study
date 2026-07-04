// ===== Facade Pattern — minh hoạ động =====
// Dàn Home Theater có 6 subsystem (Popper, Lights, Screen, Projector, Amp, DVD),
// mỗi cái nhiều method. HomeTheaterFacade GÓI chúng lại sau watchMovie()/endMovie().
// Client chỉ ra MỘT lệnh — facade gọi cả tá lệnh subsystem đúng thứ tự.

// ---------- Code Runtime: watchMovie() ----------
// (mỗi dòng có index để tô sáng theo bước animation)
const WATCH_LINES = [
  'homeTheater.watchMovie("Inception");',                       // 0
  "// Một lệnh DUY NHẤT — facade lo hết phần còn lại:",         // 1
  "popper.on();",                                               // 2
  "popper.pop();                 // bắp bắt đầu nổ 🍿",          // 3
  "lights.dim(10);               // chỉnh đèn còn 10%",         // 4
  "screen.down();                // hạ màn chiếu xuống",        // 5
  "projector.on();",                                            // 6
  "projector.wideScreenMode();   // chế độ màn ảnh rộng",       // 7
  "amp.on();",                                                  // 8
  "amp.setVolume(5);             // chỉnh âm lượng = 5",        // 9
  "dvd.on();",                                                  // 10
  'dvd.play("Inception");        // ▶ bắt đầu chiếu',           // 11
];

// ---------- Code Runtime: endMovie() ----------
const END_LINES = [
  "homeTheater.endMovie();",                                    // 0
  "// Lại MỘT lệnh — facade tắt mọi thứ theo thứ tự NGƯỢC:",    // 1
  "dvd.stop();",                                                // 2
  "dvd.off();                    // ⏹ dừng & tắt đầu DVD",       // 3
  "amp.off();                    // tắt ampli",                 // 4
  "projector.off();              // tắt máy chiếu",             // 5
  "screen.up();                  // kéo màn chiếu lên",         // 6
  "lights.on();                  // bật đèn sáng lại",          // 7
  "popper.off();                 // tắt máy bắp rang",          // 8
];

// ---------- Trình tự gọi (flat) cho watchMovie ----------
// node = id subsystem; line = dòng code tô sáng; log = dòng ghi vào output-box
const WATCH_SEQ = [
  { node: "popper",    line: 2,  log: "popper.on()                → máy bắp rang bật" },
  { node: "popper",    line: 3,  log: "popper.pop()               → bắp nổ lụp bụp 🍿" },
  { node: "lights",    line: 4,  log: "lights.dim(10)             → đèn mờ còn 10%" },
  { node: "screen",    line: 5,  log: "screen.down()              → màn chiếu hạ xuống" },
  { node: "projector", line: 6,  log: "projector.on()             → máy chiếu bật" },
  { node: "projector", line: 7,  log: "projector.wideScreenMode() → màn ảnh rộng 16:9" },
  { node: "amp",       line: 8,  log: "amp.on()                   → ampli bật" },
  { node: "amp",       line: 9,  log: "amp.setVolume(5)           → âm lượng = 5" },
  { node: "dvd",       line: 10, log: "dvd.on()                   → đầu DVD bật" },
  { node: "dvd",       line: 11, log: 'dvd.play("Inception")      → ▶ phim chiếu' },
];

// ---------- Trình tự gọi (flat) cho endMovie (đảo ngược) ----------
const END_SEQ = [
  { node: "dvd",       line: 2, log: "dvd.stop()        → ⏹ dừng phim", off: false },
  { node: "dvd",       line: 3, log: "dvd.off()         → tắt đầu DVD", off: true },
  { node: "amp",       line: 4, log: "amp.off()         → tắt ampli", off: true },
  { node: "projector", line: 5, log: "projector.off()   → tắt máy chiếu", off: true },
  { node: "screen",    line: 6, log: "screen.up()       → kéo màn chiếu lên", off: true },
  { node: "lights",    line: 7, log: "lights.on()       → bật đèn sáng lại", off: true },
  { node: "popper",    line: 8, log: "popper.off()      → tắt máy bắp rang", off: true },
];

// ---------- DOM refs ----------
const watchBtn     = document.getElementById("watchBtn");
const endBtn       = document.getElementById("endBtn");
const log          = document.getElementById("log");
const buildView    = document.getElementById("buildView");
const classView    = document.getElementById("classView");
const marqueeTitle = document.getElementById("marqueeTitle");
const marquee      = document.getElementById("marquee");

let busy = false;     // đang chạy animation
let playing = false;  // phim đang chiếu

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- TAB 2: định nghĩa lớp (tĩnh) ----------
renderCode(classView, [
  "// 6 subsystem — mỗi lớp tự lo phần việc phức tạp của nó",
  "class PopcornPopper { on(){} off(){} pop(){} }",
  "class TheaterLights { on(){} off(){} dim(level){} }",
  "class Screen        { up(){} down(){} }",
  "class Projector     { on(){} off(){} wideScreenMode(){} }",
  "class Amplifier     { on(){} off(){} setVolume(n){} }",
  "class DvdPlayer     { on(){} off(){} play(movie){} stop(){} }",
  "",
  "// FACADE: giữ tham chiếu tới MỌI subsystem",
  "class HomeTheaterFacade {",
  "  constructor(popper, lights, screen, projector, amp, dvd) {",
  "    this.popper = popper; this.lights = lights;",
  "    this.screen = screen; this.projector = projector;",
  "    this.amp = amp; this.dvd = dvd;",
  "  }",
  "",
  "  // Gói nhiều lời gọi subsystem vào MỘT method đơn giản",
  "  watchMovie(movie) {",
  "    this.popper.on();",
  "    this.popper.pop();",
  "    this.lights.dim(10);",
  "    this.screen.down();",
  "    this.projector.on();",
  "    this.projector.wideScreenMode();",
  "    this.amp.on();",
  "    this.amp.setVolume(5);",
  "    this.dvd.on();",
  "    this.dvd.play(movie);",
  "  }",
  "",
  "  endMovie() {          // đảo ngược toàn bộ trình tự",
  "    this.dvd.stop();  this.dvd.off();",
  "    this.amp.off();   this.projector.off();",
  "    this.screen.up(); this.lights.on();",
  "    this.popper.off();",
  "  }",
  "}",
  "",
  "// CLIENT chỉ cần 2 dòng:",
  "let homeTheater =",
  "  new HomeTheaterFacade(popper, lights, screen, projector, amp, dvd);",
  'homeTheater.watchMovie("Inception");',
]);

// ---------- TAB 1: render code runtime + tô sáng dòng hiện tại ----------
// Dùng hl() (house style) cho từng dòng, bọc trong .code-line để có thể highlight.
function renderSeqCode(lines, activeLine) {
  buildView.innerHTML = lines
    .map((l, i) => {
      const inner = hl(l) || "&nbsp;";
      const cls = "code-line" + (i === activeLine ? " hl" : "");
      return `<span class="${cls}">${inner}</span>`;
    })
    .join("");
}

// ---------- Cập nhật 1 subsystem .node ----------
function setNode(id, on, pulse) {
  const node = document.getElementById(id);
  const status = node.querySelector(".sys-status");
  node.classList.toggle("active", on);
  status.textContent = on ? "● ON" : "tắt";
  status.classList.toggle("on", on);
  if (pulse) {
    node.classList.remove("pulse");
    void node.offsetWidth;     // reflow để chạy lại animation
    node.classList.add("pulse");
  }
}

function resetNodes() {
  ["popper", "lights", "screen", "projector", "amp", "dvd"].forEach((id) =>
    setNode(id, false, false)
  );
}

function addLog(text, kind) {
  const div = document.createElement("div");
  div.className = "log-line" + (kind === "muted" ? " muted-line" : "");
  if (kind === "good") div.style.color = "var(--good)";
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

// ---------- Chạy 1 trình tự (watch hoặc end) ----------
async function runSequence(seq, lines, opts) {
  busy = true;
  watchBtn.disabled = true;
  endBtn.disabled = true;
  log.innerHTML = "";
  addLog(opts.header, "muted");

  renderSeqCode(lines, -1);
  await sleep(350);

  for (const step of seq) {
    // bật/tắt subsystem trên sân khấu
    setNode(step.node, !step.off, true);
    // tô sáng đúng dòng code đang gọi
    renderSeqCode(lines, step.line);
    addLog(step.log);
    await sleep(430);
  }

  renderSeqCode(lines, -1);
  addLog(opts.done, "good");

  busy = false;
  playing = opts.playing;
  watchBtn.disabled = playing;
  endBtn.disabled = !playing;
}

// ---------- watchMovie() ----------
async function watchMovie() {
  if (busy || playing) return;
  marquee.classList.add("on");
  marqueeTitle.textContent = "▶  INCEPTION";
  await runSequence(WATCH_SEQ, WATCH_LINES, {
    header: 'homeTheater.watchMovie("Inception")',
    done: "✓ Tất cả subsystem đã sẵn sàng — phim đang chiếu!",
    playing: true,
  });
}

// ---------- endMovie() ----------
async function endMovie() {
  if (busy || !playing) return;
  await runSequence(END_SEQ, END_LINES, {
    header: "homeTheater.endMovie()",
    done: "✓ Đã tắt cả dàn máy theo thứ tự ngược.",
    playing: false,
  });
  marquee.classList.remove("on");
  marqueeTitle.textContent = "— màn hình tắt —";
}

// ---------- Sự kiện ----------
watchBtn.addEventListener("click", watchMovie);
endBtn.addEventListener("click", endMovie);

// ---------- Tabs + khởi tạo ----------
setupTabs();
renderSeqCode(WATCH_LINES, -1);
