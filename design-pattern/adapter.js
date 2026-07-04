// ===== Adapter Pattern — minh hoạ động =====
// Client chỉ biết interface Duck. Một WildTurkey (interface Turkey, không tương thích)
// được bọc bởi TurkeyAdapter — adapter dịch:
//   duck.quack() -> turkey.gobble()
//   duck.fly()   -> turkey.fly() x5  (gà tây chỉ bay được quãng ngắn)

// ---------- Mô hình lớp chạy thật ----------
class MallardDuck {
  quack() { return "Quack!"; }
  fly()   { return "bay một mạch"; }
}
class WildTurkey {
  gobble() { return "Gobble gobble!"; }
  fly()    { return "bay quãng ngắn"; }
}
class TurkeyAdapter {
  constructor(turkey) { this.turkey = turkey; }   // GIỮ adaptee bên trong
  quack() { return this.turkey.gobble(); }        // dịch quack() -> gobble()
  fly() {                                          // gà tây bay ngắn -> lặp 5 lần
    const out = [];
    for (let i = 0; i < 5; i++) out.push(this.turkey.fly());
    return out;
  }
}

// ---------- Trạng thái ----------
let target = "adapter";       // "mallard" | "adapter"
let lastCall = null;          // "quack" | "fly"

// ---------- DOM refs ----------
const targetToggle = document.getElementById("targetToggle");
const btnQuack     = document.getElementById("btnQuack");
const btnFly       = document.getElementById("btnFly");
const translateLog = document.getElementById("translateLog");

const callBubble   = document.getElementById("callBubble");
const mallardView  = document.getElementById("mallardView");
const adapterView  = document.getElementById("adapterView");
const adapterBox   = document.getElementById("adapterBox");
const adapterIface = document.getElementById("adapterIface");
const translateArrow = document.getElementById("translateArrow");

const mallardAnimal = document.getElementById("mallardAnimal");
const turkeyAnimal  = document.getElementById("turkeyAnimal");
const mallardSpeech = document.getElementById("mallardSpeech");
const turkeySpeech  = document.getElementById("turkeySpeech");

const buildView = document.getElementById("buildView");
const classView = document.getElementById("classView");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- TAB 2: định nghĩa lớp (tĩnh) ----------
renderCode(classView, [
  "// Interface đích — client CHỈ biết Duck",
  "interface Duck {",
  "  quack();",
  "  fly();",
  "}",
  "",
  "class MallardDuck implements Duck {",
  "  quack() { return 'Quack!'; }",
  "  fly()   { /* bay một mạch */ }",
  "}",
  "",
  "// Adaptee — interface KHÔNG tương thích",
  "interface Turkey {",
  "  gobble();   // gà tây 'gừ gừ', không quack",
  "  fly();      // chỉ bay được quãng ngắn",
  "}",
  "class WildTurkey implements Turkey {",
  "  gobble() { return 'Gobble gobble!'; }",
  "  fly()    { /* bay quãng ngắn */ }",
  "}",
  "",
  "// Adapter — LÀ Duck, nhưng BỌC một Turkey",
  "class TurkeyAdapter implements Duck {",
  "  constructor(turkey) {",
  "    this.turkey = turkey;          // giữ adaptee",
  "  }",
  "  quack() {",
  "    return this.turkey.gobble();   // quack() -> gobble()",
  "  }",
  "  fly() {",
  "    for (let i = 0; i < 5; i++)    // bay ngắn -> lặp 5 lần",
  "      this.turkey.fly();",
  "  }",
  "}",
]);

// ---------- TAB 1: code runtime theo lựa chọn ----------
function renderBuildCode() {
  const lines = [];
  if (target === "mallard") {
    lines.push("// Đối tượng: một con vịt THẬT");
    lines.push("let duck = new MallardDuck();");
    lines.push("");
    lines.push("duck.quack();   // → \"Quack!\"");
    lines.push("duck.fly();     // → bay một mạch");
  } else {
    lines.push("// Đối tượng: gà tây được GÓI thành vịt");
    lines.push("let turkey = new WildTurkey();");
    lines.push("let duck = new TurkeyAdapter(turkey);  // gói gà tây thành vịt");
    lines.push("");
    lines.push("duck.quack();   // adapter -> turkey.gobble()");
    lines.push("duck.fly();     // adapter -> turkey.fly() x5");
  }

  // Phần động: vừa gọi method nào?
  if (lastCall) {
    lines.push("");
    lines.push("// ── ▶ vừa gọi ──");
    if (lastCall === "quack") {
      if (target === "mallard") {
        lines.push("duck.quack();");
        lines.push("//   = \"Quack!\"   (vịt tự quack)");
      } else {
        lines.push("duck.quack();");
        lines.push("//   = turkey.gobble()");
        lines.push("//   = \"Gobble gobble!\"");
      }
    } else {
      if (target === "mallard") {
        lines.push("duck.fly();");
        lines.push("//   = bay một mạch (1 lần)");
      } else {
        lines.push("duck.fly();");
        lines.push("//   = turkey.fly() x5");
        lines.push("//   = 5 cú bay ngắn");
      }
    }
  }
  renderCode(buildView, lines);
}

// ---------- Log dịch lời gọi ----------
function clearLog() { translateLog.innerHTML = ""; }
function log(text, muted = false) {
  const div = document.createElement("div");
  div.className = "log-line" + (muted ? " muted-line" : "");
  div.textContent = text;
  translateLog.appendChild(div);
  translateLog.scrollTop = translateLog.scrollHeight;
}

// ---------- Hiệu ứng phụ ----------
function flashBubble(text) {
  callBubble.textContent = text;
  callBubble.classList.remove("drop");
  void callBubble.offsetWidth;
  callBubble.classList.add("drop");
}
function showSpeech(el, text) {
  el.textContent = text;
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
}
function animateOnce(el, cls, dur) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  return sleep(dur);
}

// ---------- Khoá nút trong lúc chạy animation ----------
let busy = false;
function setBusy(v) {
  busy = v;
  btnQuack.disabled = v; btnFly.disabled = v;
}

// ---------- duck.quack() ----------
async function callQuack() {
  if (busy) return;
  setBusy(true);
  lastCall = "quack";
  clearLog();
  flashBubble("duck.quack()");
  log("client: duck.quack()");
  await sleep(420);

  if (target === "mallard") {
    log("MallardDuck.quack()");
    await animateOnce(mallardAnimal, "gobble", 500);
    showSpeech(mallardSpeech, "Quack!");
    log('→ "Quack!"');
  } else {
    adapterIface.classList.add("pulse");
    adapterBox.classList.add("active");
    log("TurkeyAdapter.quack()");
    await sleep(260);
    translateArrow.textContent = "quack() → gobble()";
    translateArrow.classList.add("lit");
    log("   dịch:  quack()  ->  gobble()");
    await sleep(380);
    await animateOnce(turkeyAnimal, "gobble", 500);
    showSpeech(turkeySpeech, "Gobble gobble!");
    log("WildTurkey.gobble()");
    log('→ "Gobble gobble!"');
    await sleep(300);
    translateArrow.classList.remove("lit");
    adapterIface.classList.remove("pulse");
    adapterBox.classList.remove("active");
  }
  renderBuildCode();
  setBusy(false);
}

// ---------- duck.fly() ----------
async function callFly() {
  if (busy) return;
  setBusy(true);
  lastCall = "fly";
  clearLog();
  flashBubble("duck.fly()");
  log("client: duck.fly()");
  await sleep(420);

  if (target === "mallard") {
    log("MallardDuck.fly()");
    log("   dịch:  fly()  ->  fly()");
    await animateOnce(mallardAnimal, "fly-long", 1100);
    log("→ bay một mạch ✈");
  } else {
    adapterIface.classList.add("pulse");
    adapterBox.classList.add("active");
    log("TurkeyAdapter.fly()");
    await sleep(220);
    translateArrow.textContent = "fly() → fly() × 5";
    translateArrow.classList.add("lit");
    log("   dịch:  fly()  ->  fly() x5");
    await sleep(300);
    for (let i = 1; i <= 5; i++) {
      await animateOnce(turkeyAnimal, "hop", 340);
      log("   turkey.fly()  #" + i + "  (bay ngắn)");
      await sleep(70);
    }
    log("→ 5 cú bay ngắn thay cho 1 lần");
    translateArrow.classList.remove("lit");
    adapterIface.classList.remove("pulse");
    adapterBox.classList.remove("active");
  }
  renderBuildCode();
  setBusy(false);
}

// ---------- Đổi đối tượng đích ----------
function setTarget(next) {
  if (busy || next === target) return;
  target = next;
  lastCall = null;
  targetToggle.querySelectorAll(".target-chip").forEach((b) => {
    const on = b.dataset.target === target;
    b.classList.toggle("active", on);
    b.classList.toggle("primary", on);
  });
  mallardView.classList.toggle("hidden", target !== "mallard");
  adapterView.classList.toggle("hidden", target !== "adapter");
  // reset mũi tên về quack mặc định
  translateArrow.textContent = "quack() → gobble()";
  translateArrow.classList.remove("lit");
  clearLog();
  log("Đang cầm: " + (target === "mallard" ? "MallardDuck (vịt thật)" : "TurkeyAdapter (gà tây gói thành vịt)"), true);
  renderBuildCode();
}

// ---------- Sự kiện ----------
targetToggle.addEventListener("click", (e) => {
  const btn = e.target.closest(".target-chip");
  if (btn) setTarget(btn.dataset.target);
});
btnQuack.addEventListener("click", callQuack);
btnFly.addEventListener("click", callFly);

// ---------- Tabs + khởi tạo ----------
setupTabs();
renderBuildCode();
