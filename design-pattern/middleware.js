// ===== Middleware / Pipeline — minh hoạ động (kiểu Express) =====
// app giữ một MẢNG middleware. Mỗi middleware là hàm (req, res, next).
// app.handle(req) chạy lần lượt: middleware gọi next() để trao cho cái kế tiếp,
// hoặc tự trả response (res.status...) và KHÔNG gọi next() => chuỗi dừng lại.

// ---- DOM refs ----
const log         = document.getElementById("log");
const chain       = document.getElementById("chain");
const packet      = document.getElementById("packet");
const statusBadge = document.getElementById("statusBadge");
const tglAuth     = document.getElementById("tglAuth");
const tglBody     = document.getElementById("tglBody");
const btnSend     = document.getElementById("btnSend");
const buildView   = document.getElementById("buildView");
const classView   = document.getElementById("classView");

const nodes = {};
chain.querySelectorAll(".mw-node").forEach((n) => { nodes[n.dataset.mw] = n; });

// ====== Code TAB 2: định nghĩa lớp (tĩnh) ======
renderCode(classView, [
  "// Một 'app' giữ MẢNG middleware và chạy chúng nối tiếp",
  "class App {",
  "  constructor() { this.stack = []; }",
  "  use(mw) { this.stack.push(mw); }   // xếp chồng middleware",
  "",
  "  handle(req) {",
  "    const res = { send: (s, b) => ({ status: s, body: b }) };",
  "    let i = 0;",
  "    const next = () => {",
  "      const mw = this.stack[i++];",
  "      if (mw) mw(req, res, next);     // gọi middleware kế tiếp",
  "    };",
  "    next();                            // khởi động chuỗi",
  "  }",
  "}",
  "",
  "// Mỗi middleware: (req, res, next) — gọi next() để đi tiếp,",
  "// hoặc trả response và DỪNG (không gọi next).",
  "const logger = (req, res, next) => {",
  "  console.log(req.method, req.url);",
  "  next();                              // luôn cho qua",
  "};",
  "const auth = (req, res, next) => {",
  "  if (!req.user) return res.send(401, 'Unauthorized'); // chặn",
  "  next();",
  "};",
  "const validator = (req, res, next) => {",
  "  if (!req.body) return res.send(400, 'Bad Request');  // chặn",
  "  next();",
  "};",
  "const handler = (req, res) => res.send(200, 'OK');      // mắt cuối",
  "",
  "const app = new App();",
  "app.use(logger); app.use(auth);",
  "app.use(validator); app.use(handler);",
]);

// ====== Code TAB 1: runtime ======
let buildLines = [];
function note(line) { buildLines.push(line); }
function flushBuild() { renderCode(buildView, buildLines); }

function resetBuild() {
  renderCode(buildView, [
    "// app.use(logger); app.use(auth);",
    "// app.use(validator); app.use(handler);",
    "//",
    "// Bấm 'Gửi request' để xem gói tin",
    "// đi qua chuỗi middleware, mỗi cái gọi next().",
  ]);
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function clearNodes() {
  Object.values(nodes).forEach((n) =>
    n.classList.remove("active", "pulse", "passed", "blocked"));
}

// Đưa gói tin REQ tới giữa một node
function movePacketTo(name) {
  const n = nodes[name];
  const x = n.offsetLeft + n.offsetWidth / 2 - packet.offsetWidth / 2;
  packet.style.setProperty("--packet-x", `translateX(${x}px)`);
  packet.style.transform = `translateX(${x}px)`;
}

function setStatus(text, kind) {
  statusBadge.textContent = text;
  statusBadge.style.borderColor = kind === "bad" ? "#ff7a7a" : kind === "good" ? "var(--good)" : "var(--accent)";
  statusBadge.style.color       = kind === "bad" ? "#ff9b9b" : kind === "good" ? "var(--good)" : "var(--accent)";
  statusBadge.classList.remove("flash"); void statusBadge.offsetWidth; statusBadge.classList.add("flash");
}

// ====== Chạy pipeline ======
const ORDER = ["logger", "auth", "validator", "handler"];

async function runPipeline() {
  btnSend.disabled = true;
  log.innerHTML = "";
  clearNodes();

  const req = {
    method: "GET", url: "/profile",
    user: tglAuth.checked ? "alice" : null,
    body: tglBody.checked ? "{ name }" : null,
  };

  buildLines = [
    `const req = { method: "GET", url: "/profile",`,
    `              user: ${req.user ? `"${req.user}"` : "null"}, body: ${req.body ? `"${req.body}"` : "null"} };`,
    `app.handle(req);`,
  ];
  flushBuild();
  logLine(`→ Nhận request GET /profile`, "muted");

  packet.className = "mw-packet show";
  packet.textContent = "REQ";
  movePacketTo("logger");
  setStatus("đang xử lý…", "normal");
  await sleep(450);

  let blocked = false;

  for (const name of ORDER) {
    if (blocked) break;
    movePacketTo(name);
    await sleep(350);
    const node = nodes[name];
    node.classList.add("active", "pulse");

    if (name === "logger") {
      note(`//  logger(req,res,next): ghi log "${req.method} ${req.url}" → next()`);
      logLine("logger: GET /profile → next()");
      node.classList.add("passed");
    }
    else if (name === "auth") {
      if (req.user) {
        note(`//  auth(req,res,next): có req.user="${req.user}" → next()`);
        logLine(`auth: token hợp lệ (${req.user}) → next()`);
        node.classList.add("passed");
      } else {
        note(`//  auth(req,res,next): KHÔNG có req.user → res.send(401) (không gọi next)`);
        logLine("auth: thiếu token → res.send(401) ✗ DỪNG", "bad");
        node.classList.add("blocked");
        blocked = "401 Unauthorized";
      }
    }
    else if (name === "validator") {
      if (req.body) {
        note(`//  validator(req,res,next): có req.body → next()`);
        logLine("validator: body hợp lệ → next()");
        node.classList.add("passed");
      } else {
        note(`//  validator(req,res,next): thiếu req.body → res.send(400) (không gọi next)`);
        logLine("validator: thiếu body → res.send(400) ✗ DỪNG", "bad");
        node.classList.add("blocked");
        blocked = "400 Bad Request";
      }
    }
    else if (name === "handler") {
      note(`//  handler(req,res): res.send(200, "OK")  ← mắt cuối cùng`);
      logLine("handler: res.send(200, 'OK') ✓", "good");
      node.classList.add("passed");
    }
    flushBuild();
    await sleep(500);
  }

  if (blocked) {
    packet.className = "mw-packet show bad";
    note(`//  ⇒ chuỗi DỪNG sớm, các middleware sau không chạy. Response: ${blocked}`);
    flushBuild();
    setStatus(blocked, "bad");
  } else {
    packet.className = "mw-packet show ok";
    packet.textContent = "200";
    note(`//  ⇒ qua hết chuỗi. Response: 200 OK`);
    flushBuild();
    setStatus("200 OK", "good");
  }

  btnSend.disabled = false;
}

btnSend.addEventListener("click", runPipeline);

// ====== Khởi tạo ======
setupTabs();
resetBuild();
setStatus("chờ gửi…", "normal");
