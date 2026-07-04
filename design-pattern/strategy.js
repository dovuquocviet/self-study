// ===== Strategy Pattern — minh hoạ động (SimUDuck) =====
// Hành vi BAY và KÊU được tách thành các "chiến lược" (strategy) thay được lúc chạy.
// Duck KHÔNG tự cài đặt hành vi — nó GIỮ tham chiếu rồi UỶ QUYỀN cho object hành vi.

// ---------- Họ chiến lược FlyBehavior ----------
class FlyBehavior  { fly()   { return ""; } }
class FlyWithWings     extends FlyBehavior { fly() { return { say: "Tôi đang bay bằng cánh!", anim: "fly-wings" }; } }
class FlyNoWay         extends FlyBehavior { fly() { return { say: "Tôi không biết bay.",      anim: "fly-noway" }; } }
class FlyRocketPowered extends FlyBehavior { fly() { return { say: "Bay bằng động cơ tên lửa! 🚀", anim: "fly-rocket" }; } }

// ---------- Họ chiến lược QuackBehavior ----------
class QuackBehavior { quack() { return ""; } }
class Quack     extends QuackBehavior { quack() { return { sound: "Quack!",     mute: false }; } }
class Squeak    extends QuackBehavior { quack() { return { sound: "Squeak",     mute: false }; } }
class MuteQuack extends QuackBehavior { quack() { return { sound: "<im lặng>",  mute: true  }; } }

// ---------- Lớp Duck: giữ tham chiếu + uỷ quyền ----------
class Duck {
  constructor(flyBehavior, quackBehavior) {
    this.flyBehavior = flyBehavior;       // tham chiếu chiến lược, KHÔNG cài cứng
    this.quackBehavior = quackBehavior;
  }
  setFlyBehavior(fb)   { this.flyBehavior = fb; }    // đổi chiến lược lúc chạy
  setQuackBehavior(qb) { this.quackBehavior = qb; }
  performFly()   { return this.flyBehavior.fly(); }     // uỷ quyền
  performQuack() { return this.quackBehavior.quack(); } // uỷ quyền
}

// ---------- Bảng tra cứu (UI ↔ class) ----------
const FLY_CLS   = { FlyWithWings, FlyNoWay, FlyRocketPowered };
const QUACK_CLS = { Quack, Squeak, MuteQuack };

// Loại vịt + hành vi mặc định của nó (giống Head First)
const DUCK_TYPES = {
  MallardDuck: { fly: "FlyWithWings", quack: "Quack" },
  RubberDuck:  { fly: "FlyNoWay",     quack: "Squeak" },
  DecoyDuck:   { fly: "FlyNoWay",     quack: "MuteQuack" },
};

// ---------- Trạng thái runtime ----------
let duckType = "MallardDuck";
let flyKey   = "FlyWithWings";
let quackKey = "Quack";
let duck     = new Duck(new FLY_CLS[flyKey](), new QUACK_CLS[quackKey]());
let lastAction = null; // { kind:"fly"|"quack", result }

// ---------- DOM refs ----------
const typePicker  = document.getElementById("typePicker");
const flyPicker   = document.getElementById("flyPicker");
const quackPicker = document.getElementById("quackPicker");
const flyBtn      = document.getElementById("flyBtn");
const quackBtn    = document.getElementById("quackBtn");
const curFly      = document.getElementById("curFly");
const curQuack    = document.getElementById("curQuack");
const duckEl      = document.getElementById("duck");
const duckBody    = document.getElementById("duckBody");
const speech      = document.getElementById("speechBubble");
const speechText  = document.getElementById("speechText");
const buildView   = document.getElementById("buildView");
const classView   = document.getElementById("classView");

const DUCK_EMOJI = { MallardDuck: "🦆", RubberDuck: "🐤", DecoyDuck: "🦆" };

// ---------- TAB 2: định nghĩa lớp (tĩnh) ----------
renderCode(classView, [
  "// Mỗi hành vi là MỘT interface + nhiều class cụ thể",
  "interface FlyBehavior   { fly();   }",
  "interface QuackBehavior { quack(); }",
  "",
  "class FlyWithWings     implements FlyBehavior { fly() { /* bay bằng cánh */ } }",
  "class FlyNoWay         implements FlyBehavior { fly() { /* không bay */ } }",
  "class FlyRocketPowered implements FlyBehavior { fly() { /* tên lửa 🚀 */ } }",
  "",
  "class Quack     implements QuackBehavior { quack() { return 'Quack!'; } }",
  "class Squeak    implements QuackBehavior { quack() { return 'Squeak'; } }",
  "class MuteQuack implements QuackBehavior { quack() { return '<im lặng>'; } }",
  "",
  "// Duck CHỈ giữ tham chiếu rồi UỶ QUYỀN — không tự cài hành vi",
  "class Duck {",
  "  flyBehavior;    // FlyBehavior",
  "  quackBehavior;  // QuackBehavior",
  "  setFlyBehavior(fb)   { this.flyBehavior = fb; }   // đổi lúc chạy",
  "  setQuackBehavior(qb) { this.quackBehavior = qb; }",
  "  performFly()   { return this.flyBehavior.fly(); }     // uỷ quyền",
  "  performQuack() { return this.quackBehavior.quack(); } // uỷ quyền",
  "}",
  "",
  "// Loại vịt chỉ khác nhau ở hành vi mặc định cắm sẵn",
  "class MallardDuck extends Duck {",
  "  constructor() { super(new FlyWithWings(), new Quack()); }",
  "}",
]);

// ---------- TAB 1: code runtime cập nhật theo thao tác ----------
function renderBuildCode() {
  const def = DUCK_TYPES[duckType];
  const lines = [];

  lines.push("// 1 · Tạo vịt — hành vi mặc định được cắm sẵn");
  lines.push(`let duck = new ${duckType}();`);
  lines.push(`//   flyBehavior   = new ${def.fly}()`);
  lines.push(`//   quackBehavior = new ${def.quack}()`);

  // Chỉ hiện setX khi đã đổi khác mặc định của loại vịt
  const swaps = [];
  if (flyKey !== def.fly)   swaps.push(`duck.setFlyBehavior(new ${flyKey}());`);
  if (quackKey !== def.quack) swaps.push(`duck.setQuackBehavior(new ${quackKey}());`);
  if (swaps.length) {
    lines.push("");
    lines.push("// 2 · Đổi CHIẾN LƯỢC lúc chạy (class Duck KHÔNG đổi)");
    swaps.forEach((s) => lines.push(s));
  }

  if (lastAction) {
    lines.push("");
    lines.push("// 3 · Gọi method — Duck uỷ quyền cho object hành vi");
    if (lastAction.kind === "fly") {
      lines.push("duck.performFly();");
      lines.push(`//   → uỷ quyền: flyBehavior.fly()   [${flyKey}]`);
      lines.push(`//   → "${lastAction.result.say}"`);
    } else {
      lines.push("duck.performQuack();");
      lines.push(`//   → uỷ quyền: quackBehavior.quack()   [${quackKey}]`);
      lines.push(`//   → "${lastAction.result.sound}"`);
    }
  } else {
    lines.push("");
    lines.push("// → Nhấn performFly() / performQuack() để chạy thử");
  }

  renderCode(buildView, lines);
}

// ---------- Đồng bộ UI (chip active + panel phụ) ----------
function syncControls() {
  typePicker.querySelectorAll(".type-chip").forEach((b) =>
    b.classList.toggle("active", b.dataset.type === duckType));
  flyPicker.querySelectorAll(".strat-chip").forEach((b) =>
    b.classList.toggle("active", b.dataset.fly === flyKey));
  quackPicker.querySelectorAll(".strat-chip").forEach((b) =>
    b.classList.toggle("active", b.dataset.quack === quackKey));

  curFly.textContent = flyKey;
  curQuack.textContent = quackKey;
  duckBody.textContent = DUCK_EMOJI[duckType];
  duckEl.classList.remove("t-MallardDuck", "t-RubberDuck", "t-DecoyDuck");
  duckEl.classList.add("t-" + duckType);
}

function flashBadge(el) {
  el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
}

// ---------- Sự kiện: chọn loại vịt → đặt lại hành vi mặc định ----------
typePicker.addEventListener("click", (e) => {
  const btn = e.target.closest(".type-chip");
  if (!btn) return;
  duckType = btn.dataset.type;
  const def = DUCK_TYPES[duckType];
  flyKey = def.fly; quackKey = def.quack;
  duck = new Duck(new FLY_CLS[flyKey](), new QUACK_CLS[quackKey]());
  lastAction = null;
  syncControls(); flashBadge(curFly); flashBadge(curQuack);
  renderBuildCode();
});

// ---------- Sự kiện: đổi FlyBehavior lúc chạy ----------
flyPicker.addEventListener("click", (e) => {
  const btn = e.target.closest(".strat-chip");
  if (!btn) return;
  flyKey = btn.dataset.fly;
  duck.setFlyBehavior(new FLY_CLS[flyKey]());  // SWAP object chiến lược
  syncControls(); flashBadge(curFly);
  renderBuildCode();
});

// ---------- Sự kiện: đổi QuackBehavior lúc chạy ----------
quackPicker.addEventListener("click", (e) => {
  const btn = e.target.closest(".strat-chip");
  if (!btn) return;
  quackKey = btn.dataset.quack;
  duck.setQuackBehavior(new QUACK_CLS[quackKey]());
  syncControls(); flashBadge(curQuack);
  renderBuildCode();
});

// ---------- performFly(): uỷ quyền + animate ----------
const FLY_ANIMS = ["fly-wings", "fly-noway", "fly-rocket"];
flyBtn.addEventListener("click", () => {
  const result = duck.performFly();           // ← uỷ quyền cho flyBehavior
  lastAction = { kind: "fly", result };
  duckEl.classList.remove(...FLY_ANIMS);
  void duckEl.offsetWidth;                     // reflow để chạy lại animation
  duckEl.classList.add(result.anim);
  renderBuildCode();
});
duckEl.addEventListener("animationend", (e) => {
  if (e.target === duckEl) duckEl.classList.remove(...FLY_ANIMS);
});

// ---------- performQuack(): uỷ quyền + bong bóng thoại ----------
quackBtn.addEventListener("click", () => {
  const result = duck.performQuack();         // ← uỷ quyền cho quackBehavior
  lastAction = { kind: "quack", result };
  speechText.textContent = result.sound;
  speech.classList.toggle("mute", result.mute);
  speech.classList.remove("show");
  void speech.offsetWidth;
  speech.classList.add("show");
  renderBuildCode();
});

// ---------- Khởi tạo ----------
setupTabs();
syncControls();
renderBuildCode();
