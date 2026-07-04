// ===== State Pattern — minh hoạ động (máy bán kẹo cao su) =====
// GumballMachine KHÔNG chứa if/else khổng lồ. Nó giữ một currentState và
// uỷ quyền mọi thao tác (insertQuarter / ejectQuarter / turnCrank) cho object
// trạng thái đó. Mỗi State tự xử lý hành động + tự gọi machine.setState(...).

// ---- Tên lớp tương ứng mỗi khoá trạng thái ----
const STATE_CLASS = {
  soldOut:    "SoldOutState",
  noQuarter:  "NoQuarterState",
  hasQuarter: "HasQuarterState",
  sold:       "SoldState",
};

const GB_COLORS = ["#ff6b6b","#ffd166","#06d6a0","#4dabf7","#c08bff","#ff9e64","#6ee7a8","#f4a261"];
const MAX_GUMBALLS = 12;

// ---- "Máy" runtime ----
const machine = { count: 5, stateName: "noQuarter" };

// ---- DOM refs ----
const log        = document.getElementById("log");
const diagram    = document.getElementById("diagram");
const gumballsEl  = document.getElementById("gumballs");
const stateBadge = document.getElementById("stateBadge");
const countVal   = document.getElementById("countVal");
const coin       = document.getElementById("coin");
const crank      = document.getElementById("crank");
const outBall    = document.getElementById("outBall");
const buildView  = document.getElementById("buildView");
const classView  = document.getElementById("classView");

// ====== Code TAB 2: định nghĩa lớp (tĩnh) ======
renderCode(classView, [
  "// Interface State — mọi trạng thái cài 4 hành động",
  "class State {",
  "  insertQuarter() {}",
  "  ejectQuarter()  {}",
  "  turnCrank()     {}",
  "  dispense()      {}",
  "}",
  "",
  "// Máy giữ currentState và UỶ QUYỀN cho nó",
  "class GumballMachine {",
  "  constructor(count) {",
  "    this.noQuarter  = new NoQuarterState(this);",
  "    this.hasQuarter = new HasQuarterState(this);",
  "    this.sold       = new SoldState(this);",
  "    this.soldOut    = new SoldOutState(this);",
  "    this.count = count;",
  "    this.state = count > 0 ? this.noQuarter : this.soldOut;",
  "  }",
  "  insertQuarter() { this.state.insertQuarter(); }",
  "  ejectQuarter()  { this.state.ejectQuarter();  }",
  "  turnCrank()     { this.state.turnCrank();",
  "                    this.state.dispense(); }",
  "  setState(s) { this.state = s; }   // ← chuyển trạng thái",
  "  releaseBall() { if (this.count > 0) this.count--; }",
  "}",
  "",
  "// Mỗi trạng thái tự quyết định & tự chuyển tiếp",
  "class NoQuarterState extends State {",
  "  insertQuarter() {",
  "    say('Bạn đã bỏ xu vào');",
  "    this.m.setState(this.m.hasQuarter);",
  "  }",
  "  ejectQuarter() { say('Bạn chưa bỏ xu vào'); }",
  "  turnCrank()    { say('Bạn quay tay nhưng chưa có xu'); }",
  "}",
  "class HasQuarterState extends State {",
  "  ejectQuarter() {",
  "    say('Trả lại xu cho bạn');",
  "    this.m.setState(this.m.noQuarter);",
  "  }",
  "  turnCrank() {",
  "    say('Bạn đã quay tay...');",
  "    this.m.setState(this.m.sold);",
  "  }",
  "}",
  "class SoldState extends State {",
  "  dispense() {",
  "    this.m.releaseBall();          // nhả 1 kẹo",
  "    this.m.setState(this.m.count > 0",
  "      ? this.m.noQuarter : this.m.soldOut);",
  "  }",
  "}",
  "class SoldOutState extends State {",
  "  insertQuarter() { say('Máy đã hết kẹo'); }",
  "  turnCrank()     { say('Máy đã hết kẹo'); }",
  "}",
]);

// ====== Code TAB 1: runtime (cập nhật theo thao tác) ======
let buildLines = [];
function note(line) { buildLines.push(line); }
function flushBuild() { renderCode(buildView, buildLines); }

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

// "say" = vừa ghi log, vừa thêm comment dạy học vào tab Runtime
function say(msg, kind) {
  logLine(msg, kind);
  note(`//     "${msg}"`);
}

function replay(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

function renderGumballs() {
  gumballsEl.innerHTML = "";
  const perRow = 5, size = 22, gap = 2;
  for (let i = 0; i < machine.count; i++) {
    const row = Math.floor(i / perRow), col = i % perRow;
    const gb = document.createElement("span");
    gb.className = "gb";
    gb.style.background = GB_COLORS[i % GB_COLORS.length];
    const offset = row % 2 ? size / 2 : 0;
    gb.style.left   = (26 + col * (size + gap) + offset) + "px";
    gb.style.bottom = (10 + row * (size - 5)) + "px";
    gumballsEl.appendChild(gb);
  }
  countVal.textContent = machine.count;
}

function renderDiagram() {
  diagram.querySelectorAll(".node").forEach((n) => {
    const on = n.dataset.state === machine.stateName;
    n.classList.toggle("active", on);
    if (on) replay(n, "pulse");
  });
}

function setBadge(flash) {
  stateBadge.textContent = STATE_CLASS[machine.stateName];
  if (flash) replay(stateBadge, "flash");
}

// Chuyển trạng thái — điểm mấu chốt của pattern
function setState(name) {
  machine.stateName = name;
  renderDiagram();
  setBadge(true);
}

function releaseBall() {
  if (machine.count > 0) machine.count--;
  renderGumballs();
  replay(outBall, "roll");
}

// ====== Các object STATE (uỷ quyền) ======
const states = {
  noQuarter: {
    insertQuarter() {
      say("Bạn đã bỏ xu vào");
      replay(coin, "drop");
      note("//  -> machine.setState(hasQuarterState)");
      setState("hasQuarter");
    },
    ejectQuarter() { say("Bạn chưa bỏ xu vào", "bad"); },
    turnCrank()    { say("Bạn quay tay nhưng chưa có xu", "bad"); },
  },

  hasQuarter: {
    insertQuarter() { say("Bạn không thể bỏ thêm xu — đã có 1 xu rồi", "bad"); },
    ejectQuarter() {
      say("Trả lại xu cho bạn");
      note("//  -> machine.setState(noQuarterState)");
      setState("noQuarter");
    },
    turnCrank() {
      say("Bạn đã quay tay...");
      replay(crank, "spin");
      note("//  -> machine.setState(soldState)");
      setState("sold");
      note("//  -> soldState.dispense()");
      states.sold.dispense();
    },
  },

  sold: {
    insertQuarter() { say("Đợi chút, máy đang nhả kẹo", "bad"); },
    ejectQuarter()  { say("Xin lỗi, bạn đã quay tay rồi", "bad"); },
    turnCrank()     { say("Quay hai lần cũng không thêm kẹo đâu", "bad"); },
    dispense() {
      releaseBall();
      say("Một viên kẹo lăn ra cửa 🍬", "good");
      note("//     machine.releaseBall(); count--");
      if (machine.count === 0) {
        say("Ôi! Hết kẹo rồi", "bad");
        note("//  -> count == 0 → machine.setState(soldOutState)");
        setState("soldOut");
      } else {
        note("//  -> machine.setState(noQuarterState)");
        setState("noQuarter");
      }
    },
  },

  soldOut: {
    insertQuarter() { say("Máy đã hết kẹo, không nhận xu", "bad"); },
    ejectQuarter()  { say("Bạn chưa bỏ xu để mà trả lại", "bad"); },
    turnCrank()     { say("Bạn quay tay nhưng máy đã hết kẹo", "bad"); },
    dispense()      { say("Không có kẹo nào được nhả", "bad"); },
  },
};

// ====== Dispatch: machine.action() uỷ quyền cho currentState ======
function dispatch(action) {
  buildLines = [`machine.${action}();`];
  note(`//  -> currentState.${action}()   // currentState = ${STATE_CLASS[machine.stateName]}`);
  states[machine.stateName][action]();
  flushBuild();
}

// refill() là method riêng của máy (không uỷ quyền)
function refill() {
  const before = machine.count;
  machine.count = Math.min(MAX_GUMBALLS, machine.count + 5);
  buildLines = ["machine.refill();"];
  note(`//  count: ${before} -> ${machine.count}`);
  logLine(`Đã nạp thêm kẹo (còn ${machine.count})`, "good");
  renderGumballs();
  if (machine.stateName === "soldOut" && machine.count > 0) {
    note("//  -> đang SoldOut mà có kẹo lại → machine.setState(noQuarterState)");
    setState("noQuarter");
  }
  flushBuild();
}

// ====== Sự kiện ======
document.getElementById("btnInsert").addEventListener("click", () => dispatch("insertQuarter"));
document.getElementById("btnEject").addEventListener("click",  () => dispatch("ejectQuarter"));
document.getElementById("btnCrank").addEventListener("click",  () => dispatch("turnCrank"));
document.getElementById("btnRefill").addEventListener("click", refill);

// ====== Khởi tạo ======
setupTabs();
renderGumballs();
renderDiagram();
setBadge(false);
renderCode(buildView, [
  "// machine giữ currentState = NoQuarterState",
  "// Bấm một thao tác bên trái để xem máy",
  "// UỶ QUYỀN cho object trạng thái đang giữ.",
  "//",
  "// machine.insertQuarter();",
  "//   -> currentState.insertQuarter()",
]);
