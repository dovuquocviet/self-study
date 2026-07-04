// ===== Chain of Responsibility — minh hoạ động (máy ATM nhả tiền) =====
// Người dùng gọi atm.dispense(amount). Yêu cầu được ném vào ĐẦU chuỗi handler.
// Mỗi handler chỉ biết nhả mệnh giá của mình: lấy floor(amount / denom) tờ rồi
// chuyển remainder = amount % denom cho next.handle(remainder). Sender KHÔNG biết
// handler nào lo phần nào — đó là tinh thần của Chain of Responsibility.

const DENOMS = [50, 20, 10, 5];

// ---- DOM refs ----
const amtSlider  = document.getElementById("amtSlider");
const amtVal     = document.getElementById("amtVal");
const packet     = document.getElementById("packet");
const packetVal  = document.getElementById("packetVal");
const statusBadge= document.getElementById("statusBadge");
const log        = document.getElementById("log");
const buildView  = document.getElementById("buildView");
const classView  = document.getElementById("classView");
const btnDispense= document.getElementById("btnDispense");

const handlerEls = {};
const billsEls   = {};
const tookEls    = {};
const arrowEls   = [];
DENOMS.forEach((d) => {
  handlerEls[d] = document.querySelector(`.handler[data-denom="${d}"]`);
  billsEls[d]   = document.getElementById("bills" + d);
  tookEls[d]    = document.getElementById("took" + d);
});
document.querySelectorAll(".arrow[data-link]").forEach((a) => arrowEls.push(a));

// ====== Code TAB 2: định nghĩa lớp (tĩnh) ======
renderCode(classView, [
  "// Handler trừu tượng — giữ tham chiếu tới next trong chuỗi",
  "class DispenseHandler {",
  "  constructor(denom) {",
  "    this.denom = denom;",
  "    this.next  = null;",
  "  }",
  "  setNext(handler) {        // nối mắt xích kế tiếp",
  "    this.next = handler;",
  "    return handler;          // tiện nối dây chuyền",
  "  }",
  "  handle(amount) {",
  "    const n = Math.floor(amount / this.denom);",
  "    if (n > 0) this.release(n);          // nhả n tờ mệnh giá này",
  "    const remainder = amount % this.denom;",
  "    if (remainder === 0) return;          // đã xử lý xong",
  "    if (this.next) this.next.handle(remainder); // CHUYỂN phần dư",
  "    else throw new Error('Không nhả được ' + remainder);",
  "  }",
  "}",
  "",
  "// Nối chuỗi: $50 -> $20 -> $10 -> $5",
  "const h50 = new DispenseHandler(50);",
  "const h20 = new DispenseHandler(20);",
  "const h10 = new DispenseHandler(10);",
  "const h5  = new DispenseHandler(5);",
  "h50.setNext(h20); h20.setNext(h10); h10.setNext(h5);",
  "",
  "// Sender chỉ biết ĐẦU chuỗi",
  "const atm = { dispense: (amt) => h50.handle(amt) };",
]);

// ====== Code TAB 1: runtime (cập nhật theo thao tác) ======
let buildLines = [];
function note(line) { buildLines.push(line); }
function flushBuild() { renderCode(buildView, buildLines); }

// ====== tiện ích sân khấu ======
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function logLine(msg, kind) {
  const div = document.createElement("div");
  div.className = "log-line" + (kind === "muted" ? " muted-line" : "");
  if (kind === "good") div.style.color = "var(--good)";
  if (kind === "bad")  div.style.color = "#ff9b9b";
  div.textContent = msg;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function resetStage() {
  DENOMS.forEach((d) => {
    billsEls[d].innerHTML = "";
    tookEls[d].textContent = "0 tờ";
    handlerEls[d].classList.remove("touched");
  });
  arrowEls.forEach((a) => a.classList.remove("lit"));
  packet.classList.remove("done");
  packetVal.textContent = "$0";
  statusBadge.className = "state-badge";
  statusBadge.textContent = "Sẵn sàng";
}

function setBadge(text, kind) {
  statusBadge.textContent = text;
  statusBadge.className = "state-badge" + (kind ? " " + kind : "");
}

function showBills(d, n) {
  for (let i = 0; i < n; i++) {
    const b = document.createElement("span");
    b.className = "bill";
    billsEls[d].appendChild(b);
  }
  tookEls[d].textContent = n + " tờ";
}

// ====== dispense: chạy yêu cầu dọc chuỗi ======
let running = false;

async function dispense(amount) {
  if (running) return;
  running = true;
  btnDispense.disabled = true;
  resetStage();

  buildLines = [`atm.dispense(${amount});`, `//  -> h50.handle(${amount})`];
  flushBuild();
  logLine(`Yêu cầu rút $${amount}`, "muted");
  setBadge("Đang xử lý…");

  let remaining = amount;
  let totalBills = 0;

  for (let i = 0; i < DENOMS.length; i++) {
    const d = DENOMS[i];
    // gói chạy tới handler hiện tại
    handlerEls[d].classList.add("touched");
    if (i > 0) arrowEls[i - 1].classList.add("lit");
    packetVal.textContent = "$" + remaining;
    packet.classList.add("move");
    await sleep(260);
    packet.classList.remove("move");

    const n = Math.floor(remaining / d);
    const rem = remaining % d;
    note(`//  $${d} Handler: ${remaining} / ${d} = ${n} tờ, dư ${rem}`);
    flushBuild();

    if (n > 0) {
      showBills(d, n);
      totalBills += n;
      logLine(`$${d} Handler nhả ${n} tờ (= $${n * d})`, "good");
      await sleep(280);
    } else {
      logLine(`$${d} Handler: không lấy tờ nào, chuyển tiếp`, "muted");
    }

    remaining = rem;
    if (remaining === 0) {
      note(`//  remainder == 0 → DỪNG, không gọi next`);
      flushBuild();
      break;
    }
    if (i < DENOMS.length - 1) {
      note(`//  -> next.handle(${remaining})`);
      flushBuild();
    }
  }

  packetVal.textContent = "$" + remaining;
  if (remaining === 0) {
    packet.classList.add("done");
    setBadge(`✓ Nhả ${totalBills} tờ = $${amount}`, "ok");
    logLine(`Hoàn tất: tổng ${totalBills} tờ.`, "good");
  } else {
    setBadge(`✗ Còn dư $${remaining}`, "warn");
    logLine(`Không handler nào nhả được $${remaining} (cuối chuỗi).`, "bad");
    note(`//  hết chuỗi mà còn $${remaining} → Error`);
    flushBuild();
  }

  running = false;
  btnDispense.disabled = false;
}

// ====== sự kiện ======
amtSlider.addEventListener("input", () => { amtVal.textContent = "$" + amtSlider.value; });
btnDispense.addEventListener("click", () => dispense(parseInt(amtSlider.value, 10)));
document.getElementById("btnReset").addEventListener("click", () => {
  if (running) return;
  resetStage();
  logLine("Đã reset chuỗi.", "muted");
});
document.querySelectorAll(".btn[data-quick]").forEach((b) => {
  b.addEventListener("click", () => {
    amtSlider.value = b.dataset.quick;
    amtVal.textContent = "$" + b.dataset.quick;
  });
});

// ====== khởi tạo ======
setupTabs();
resetStage();
renderCode(buildView, [
  "// atm.dispense(amount) ném yêu cầu vào ĐẦU chuỗi.",
  "// Mỗi handler lấy phần mệnh giá của mình rồi",
  "// chuyển remainder cho next.handle(remainder).",
  "//",
  "// Bấm 💵 dispense() để xem gói chạy dọc chuỗi.",
]);
