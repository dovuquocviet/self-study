// ===== Object Pool — minh hoạ động (pool kết nối DB) =====
// Tạo Connection rất tốn kém. Thay vì new liên tục, ta giữ một POOL các
// connection tái sử dụng: acquire() mượn 1 cái, release() trả về. Object thật
// sự được tạo (new) ít hơn nhiều số lần acquire nhờ tái dùng.

const MAX_VISUAL = 8;

// ---- "Pool" runtime ----
const pool = {
  free: [],        // connection đang rảnh trong pool
  used: [],        // connection đang được mượn ra dùng
  created: 0,      // tổng số connection từng được new
  acquires: 0,     // tổng số lần gọi acquire()
};

// ---- DOM refs ----
const poolBody    = document.getElementById("poolBody");
const usedBody    = document.getElementById("usedBody");
const statFree    = document.getElementById("statFree");
const statUsed    = document.getElementById("statUsed");
const statCreated = document.getElementById("statCreated");
const statAcquire = document.getElementById("statAcquire");
const saveNote    = document.getElementById("saveNote");
const log         = document.getElementById("log");
const buildView   = document.getElementById("buildView");
const classView   = document.getElementById("classView");

const btnAcquire  = document.getElementById("btnAcquire");
const btnRelease  = document.getElementById("btnRelease");

// ====== Code TAB 2: định nghĩa lớp (tĩnh) ======
renderCode(classView, [
  "// Object đắt đỏ cần tái sử dụng",
  "class Connection {",
  "  constructor(id) {",
  "    this.id = id;",
  "    open();              // tốn kém: socket + TLS",
  "  }",
  "  reset() { /* dọn sạch để dùng lại */ }",
  "}",
  "",
  "// Pool giữ free[] và used[]",
  "class ObjectPool {",
  "  constructor() {",
  "    this.free = [];      // đang rảnh, sẵn sàng cho mượn",
  "    this.used = [];      // đang được dùng",
  "    this.created = 0;    // đếm số lần new thật sự",
  "  }",
  "",
  "  acquire() {",
  "    let c = this.free.pop();      // ưu tiên tái dùng",
  "    if (!c) {                     // pool cạn → mới phải tạo",
  "      c = new Connection(++this.created);",
  "    }",
  "    this.used.push(c);",
  "    return c;",
  "  }",
  "",
  "  release(c) {",
  "    this.used = this.used.filter(x => x !== c);",
  "    c.reset();                    // dọn sạch",
  "    this.free.push(c);            // trả về pool, dùng lại sau",
  "  }",
  "}",
]);

// ====== Code TAB 1: runtime ======
let buildLines = [];
function note(line) { buildLines.push(line); }
function flushBuild() { renderCode(buildView, buildLines); }

// ====== Tiện ích sân khấu ======
function logLine(msg, kind) {
  const div = document.createElement("div");
  div.className = "log-line" + (kind === "muted" ? " muted-line" : "");
  if (kind === "good") div.style.color = "var(--good)";
  if (kind === "bad")  div.style.color = "#ff9b9b";
  if (kind === "new")  div.style.color = "var(--accent)";
  div.textContent = msg;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function makeCard(conn, anim) {
  const el = document.createElement("div");
  el.className = "conn" + (anim ? " " + anim : "");
  el.innerHTML = `<span class="conn-ic">🔌</span><span class="conn-id">Conn#${conn.id}</span>`;
  return el;
}

function render(movedId, dir) {
  poolBody.innerHTML = "";
  usedBody.innerHTML = "";
  pool.free.forEach((c) =>
    poolBody.appendChild(makeCard(c, c.id === movedId && dir === "in" ? "slide-in" : "")));
  pool.used.forEach((c) =>
    usedBody.appendChild(makeCard(c, c.id === movedId && dir === "out" ? "slide-out" : "")));

  statFree.textContent    = pool.free.length;
  statUsed.textContent    = pool.used.length;
  statCreated.textContent = pool.created;
  statAcquire.textContent = pool.acquires;

  if (pool.acquires > 0) {
    const saved = pool.acquires - pool.created;
    saveNote.innerHTML = saved > 0
      ? `Đã acquire <b>${pool.acquires}</b> lần nhưng chỉ <code>new</code> <b>${pool.created}</b> object — tiết kiệm <b>${saved}</b> lần tạo!`
      : `Đã acquire <b>${pool.acquires}</b> lần, tạo <b>${pool.created}</b> object.`;
  }
  btnRelease.disabled = pool.used.length === 0;
}

// ====== Hành vi pool ======
function acquire() {
  buildLines = ["let c = pool.acquire();"];
  pool.acquires++;
  let c = pool.free.pop();
  if (!c) {
    pool.created++;
    c = { id: pool.created };
    note(`//  -> free rỗng → new Connection(#${c.id})   // tốn kém! (đã tạo: ${pool.created})`);
    logLine(`Pool cạn → tạo mới Conn#${c.id}`, "new");
  } else {
    note(`//  -> free còn → TÁI DÙNG Conn#${c.id}   // khỏi new, miễn phí`);
    logLine(`Tái dùng Conn#${c.id} từ pool`, "good");
  }
  pool.used.push(c);
  note(`//  -> used.push(Conn#${c.id})   // free=${pool.free.length}, used=${pool.used.length}`);
  render(c.id, "out");
  flushBuild();
}

function release() {
  if (pool.used.length === 0) return;
  const c = pool.used.pop();
  buildLines = [`pool.release(c);   // c = Conn#${c.id}`];
  note(`//  -> c.reset()   // dọn sạch để dùng lại`);
  pool.free.push(c);
  note(`//  -> free.push(Conn#${c.id})   // trả về pool, lần sau acquire() sẽ tái dùng`);
  note(`//     free=${pool.free.length}, used=${pool.used.length}`);
  logLine(`Trả Conn#${c.id} về pool`, "muted");
  render(c.id, "in");
  flushBuild();
}

function reset() {
  pool.free = [{ id: 1 }, { id: 2 }];
  pool.used = [];
  pool.created = 2;
  pool.acquires = 0;
  buildLines = ["const pool = new ObjectPool();", "// pool tạo sẵn 2 connection rảnh"];
  log.innerHTML = "";
  logLine("Pool khởi tạo sẵn 2 connection rảnh…", "muted");
  saveNote.innerHTML = "Bấm acquire/release nhiều lần — số object thật sự tạo ra sẽ ít hơn nhiều số lần acquire.";
  render();
  flushBuild();
}

// ====== Sự kiện ======
btnAcquire.addEventListener("click", acquire);
btnRelease.addEventListener("click", release);
document.getElementById("btnReset").addEventListener("click", reset);

// ====== Khởi tạo ======
setupTabs();
reset();
renderCode(buildView, [
  "// pool giữ sẵn vài connection rảnh.",
  "// Bấm acquire() để mượn, release() để trả.",
  "//",
  "// let c = pool.acquire();",
  "//   -> tái dùng nếu free còn, new nếu cạn",
]);
