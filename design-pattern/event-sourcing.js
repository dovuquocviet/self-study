// ===== Event Sourcing — minh hoạ động (tài khoản ngân hàng) =====
// Không lưu "số dư". Chỉ lưu CHUỖI sự kiện (Deposited / Withdrawn) vào log
// append-only. State (số dư) = fold(events): phát lại từ đầu, cộng dồn từng event.

// ---- Event log runtime (append-only) ----
const events = []; // [{type:'Deposited'|'Withdrawn', amount}]

// ---- DOM refs ----
const track     = document.getElementById("track");
const cursor    = document.getElementById("cursor");
const log        = document.getElementById("log");
const balanceVal = document.getElementById("balanceVal");
const stateBadge = document.getElementById("stateBadge");
const accVal     = document.getElementById("accVal");
const buildView  = document.getElementById("buildView");
const classView  = document.getElementById("classView");

// ====== Code TAB 2: định nghĩa lớp (tĩnh) ======
renderCode(classView, [
  "// ---------- Các loại Event (sự thật bất biến) ----------",
  "class Deposited { constructor(amount){ this.amount = amount; } }",
  "class Withdrawn { constructor(amount){ this.amount = amount; } }",
  "",
  "// ---------- apply: 1 event làm state biến đổi thế nào ----------",
  "function apply(state, e) {",
  "  if (e instanceof Deposited) return state + e.amount;",
  "  if (e instanceof Withdrawn) return state - e.amount;",
  "  return state;",
  "}",
  "",
  "// ---------- Aggregate: chỉ APPEND, không sửa state trực tiếp ----------",
  "class Account {",
  "  constructor() { this.events = []; }",
  "  deposit(a) { this.events.push(new Deposited(a)); } // ghi sự kiện",
  "  withdraw(a){ this.events.push(new Withdrawn(a)); }",
  "",
  "  // state KHÔNG được lưu — luôn dựng lại bằng fold(events)",
  "  get balance() {",
  "    return this.events.reduce(apply, 0);  // replay từ đầu",
  "  }",
  "}",
  "",
  "// state = fold(events).  Log append-only => có đủ lịch sử,",
  "// kiểm toán được, quay lại thời điểm bất kỳ, dựng read model mới.",
]);

// ====== Code TAB 1: runtime ======
let buildLines = [];
function note(l) { buildLines.push(l); }
function flush() { renderCode(buildView, buildLines); }
function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

function fmt(n) { return n.toLocaleString("vi-VN") + "đ"; }

// pure fold để lấy số dư (không animation)
function fold() { return events.reduce((s, e) => e.type === "Deposited" ? s + e.amount : s - e.amount, 0); }

function logLine(msg, kind) {
  const d = document.createElement("div");
  d.className = "log-line" + (kind === "muted" ? " muted-line" : "");
  if (kind === "good") d.style.color = "var(--good)";
  if (kind === "bad")  d.style.color = "#ff9b9b";
  d.textContent = msg;
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
}

function renderTrack() {
  track.innerHTML = '<div class="es-seed">∅<small>state = 0</small></div>';
  events.forEach((e, i) => {
    const el = document.createElement("div");
    el.className = "es-event " + (e.type === "Deposited" ? "dep" : "wdr");
    el.dataset.idx = i;
    el.innerHTML = (e.type === "Deposited" ? "+" : "−") + fmt(e.amount) +
      `<small>${e.type}</small>`;
    track.appendChild(el);
  });
  track.scrollLeft = track.scrollWidth;
}

function setBalance(n, badgeText) {
  balanceVal.textContent = fmt(n);
  stateBadge.textContent = badgeText || ("balance = " + fmt(n));
  replay(stateBadge, "flash");
}

// ====== Lock ======
let busy = false;
function setBusy(v) {
  busy = v;
  ["btnDeposit", "btnWithdraw", "btnReplay", "btnReset"].forEach((id) =>
    document.getElementById(id).disabled = v);
}

// ====== Thêm event (append-only) ======
function addEvent(type) {
  if (busy) return;
  const amount = (Math.floor(Math.random() * 9) + 1) * 10000;
  events.push({ type, amount });

  buildLines = [`account.${type === "Deposited" ? "deposit" : "withdraw"}(${amount});`];
  note(`//  -> events.push(new ${type}(${amount}))   // chỉ APPEND`);
  note(`//     log dài ${events.length} event, KHÔNG sửa cái cũ`);
  renderTrack();
  const bal = fold();
  note(`//     balance = fold(events) = ${bal}`);
  setBalance(bal);
  logLine(`${type === "Deposited" ? "⬆️ Deposited +" : "⬇️ Withdrawn −"}${fmt(amount)}`,
    type === "Deposited" ? "good" : "bad");
  flush();
}

// ====== REPLAY: chạy con trỏ qua từng event, cộng dồn ======
function doReplay() {
  if (busy) return;
  if (events.length === 0) { setBalance(0, "log trống — balance = 0đ"); return; }
  setBusy(true);
  logLine("▶ Replay: dựng lại state từ event đầu tiên…", "muted");

  buildLines = ["// state = fold(events): phát lại từ đầu"];
  note("let acc = 0;                       // seed");
  flush();

  const evEls = [...track.querySelectorAll(".es-event")];
  const seed  = track.querySelector(".es-seed");
  let acc = 0, i = 0;

  // đặt con trỏ dưới seed
  cursor.classList.add("on");
  cursor.style.left = (seed.offsetLeft + seed.offsetWidth / 2 - 6) + "px";
  accVal.textContent = "0";
  setBalance(0, "replay… acc = 0đ");

  const step = () => {
    if (i >= events.length) {
      // xong
      evEls.forEach((el) => el.classList.remove("scan"));
      note(`acc;  // => ${acc}   ✔ state đã dựng xong`);
      setBalance(acc, "balance = " + fmt(acc));
      logLine(`✔ Replay xong: balance = ${fmt(acc)}`, "good");
      flush();
      setTimeout(() => { cursor.classList.remove("on"); setBusy(false); }, 600);
      return;
    }
    const e = events[i], el = evEls[i];
    evEls.forEach((x) => x.classList.remove("scan"));
    el.classList.add("scan");
    cursor.style.left = (el.offsetLeft + el.offsetWidth / 2 - 6) + "px";
    el.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });

    const before = acc;
    acc = e.type === "Deposited" ? acc + e.amount : acc - e.amount;
    note(`acc = apply(acc, e[${i}]);` +
      `  // ${before} ${e.type === "Deposited" ? "+" : "−"} ${e.amount} = ${acc}`);
    accVal.textContent = acc.toLocaleString("vi-VN");
    setBalance(acc, "replay… acc = " + fmt(acc));
    flush();
    i++;
    setTimeout(step, 700);
  };
  setTimeout(step, 400);
}

// ====== Reset (tài khoản mới = log rỗng) ======
function reset() {
  if (busy) return;
  events.length = 0;
  renderTrack();
  accVal.textContent = "0";
  cursor.classList.remove("on");
  setBalance(0, "balance = 0đ");
  log.innerHTML = '<div class="log-line muted-line">Tài khoản mới — log rỗng.</div>';
  buildLines = ["const account = new Account();  // events = []"];
  note("//  log append-only bắt đầu lại từ rỗng");
  flush();
}

// ====== Sự kiện ======
document.getElementById("btnDeposit").addEventListener("click", () => addEvent("Deposited"));
document.getElementById("btnWithdraw").addEventListener("click", () => addEvent("Withdrawn"));
document.getElementById("btnReplay").addEventListener("click", doReplay);
document.getElementById("btnReset").addEventListener("click", reset);

// ====== Khởi tạo ======
setupTabs();
renderTrack();
renderCode(buildView, [
  "// Event Sourcing: state KHÔNG được lưu.",
  "// Mỗi thao tác chỉ append 1 event vào log.",
  "//",
  "// account.deposit(50000);  -> events.push(new Deposited)",
  "// account.balance          -> fold(events) (replay)",
  "//",
  "// Bấm Deposit / Withdraw rồi Replay để xem cộng dồn.",
]);
