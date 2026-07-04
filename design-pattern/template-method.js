// ===== Template Method Pattern — minh hoạ động =====
// Lớp cha CaffeineBeverage giữ BỘ KHUNG thuật toán prepareRecipe():
//   boilWater() → brew() → pourInCup() → [hook] addCondiments()
// Thứ tự CỐ ĐỊNH (không cho ghi đè). Coffee/Tea chỉ điền brew() & addCondiments().
// Hook customerWantsCondiments() quyết định có chạy addCondiments() hay không.

// ---- Đặc tả 4 bước cho mỗi đồ uống ----
const BEVERAGES = {
  coffee: {
    cls: "Coffee", name: "Coffee", liquid: "#6b4226", finalLiquid: "#a9744a",
    steps: [
      { method: "boilWater()",      kind: "parent", vi: "Đun sôi nước",          fill: 16 },
      { method: "brewCoffeeGrinds()", kind: "child", vi: "Pha cà phê qua phin",  fill: 46, brew: "brewCoffeeGrinds" },
      { method: "pourInCup()",      kind: "parent", vi: "Rót ra cốc",            fill: 78 },
      { method: "addSugarAndMilk()", kind: "child", vi: "Thêm đường + sữa",      fill: 92, cond: "addSugarAndMilk" },
    ],
  },
  tea: {
    cls: "Tea", name: "Tea", liquid: "#c98a2b", finalLiquid: "#e0b35a",
    steps: [
      { method: "boilWater()",   kind: "parent", vi: "Đun sôi nước",     fill: 16 },
      { method: "steepTeaBag()", kind: "child",  vi: "Ngâm túi trà",     fill: 46, brew: "steepTeaBag" },
      { method: "pourInCup()",   kind: "parent", vi: "Rót ra cốc",       fill: 78 },
      { method: "addLemon()",    kind: "child",  vi: "Thêm chanh",       fill: 92, cond: "addLemon" },
    ],
  },
};

// ---- DOM refs ----
const brewCoffeeBtn = document.getElementById("brewCoffee");
const brewTeaBtn    = document.getElementById("brewTea");
const wantsBox      = document.getElementById("wantsCondiments");
const log           = document.getElementById("log");
const buildView     = document.getElementById("buildView");
const classView     = document.getElementById("classView");
const colEls   = { coffee: document.getElementById("col-coffee"), tea: document.getElementById("col-tea") };
const stepEls  = {
  coffee: [...document.querySelectorAll("#steps-coffee .step")],
  tea:    [...document.querySelectorAll("#steps-tea .step")],
};
const liquidEls = { coffee: document.getElementById("liquid-coffee"), tea: document.getElementById("liquid-tea") };

let busy = false;
let lastBev = "coffee"; // đồ uống đang hiển thị ở tab Runtime

// ---------- TAB 2: định nghĩa lớp (tĩnh) ----------
renderCode(classView, [
  "// Lớp trừu tượng giữ BỘ KHUNG thuật toán",
  "abstract class CaffeineBeverage {",
  "",
  "  // template method — final: KHÔNG cho lớp con ghi đè",
  "  final prepareRecipe() {",
  "    boilWater();                     // bước CHUNG (lớp cha)",
  "    brew();                          // lớp con tự định nghĩa",
  "    pourInCup();                     // bước CHUNG (lớp cha)",
  "    if (customerWantsCondiments())   // hook quyết định",
  "      addCondiments();               // lớp con tự định nghĩa",
  "  }",
  "",
  "  boilWater() { /* đun sôi nước */ }    // viết sẵn 1 lần",
  "  pourInCup() { /* rót ra cốc   */ }    // viết sẵn 1 lần",
  "",
  "  abstract brew();          // bước THAY ĐỔI → lớp con điền",
  "  abstract addCondiments(); // bước THAY ĐỔI → lớp con điền",
  "",
  "  // hook: mặc định true, lớp con có thể ghi đè để xen vào luồng",
  "  customerWantsCondiments() { return true; }",
  "}",
  "",
  "class Coffee extends CaffeineBeverage {",
  "  brew()          { brewCoffeeGrinds(); }",
  "  addCondiments() { addSugarAndMilk(); }",
  "}",
  "",
  "class Tea extends CaffeineBeverage {",
  "  brew()          { steepTeaBag(); }",
  "  addCondiments() { addLemon(); }",
  "}",
]);

// ---------- TAB 1: code runtime theo đồ uống + trạng thái hook ----------
function renderBuildView(bevKey) {
  const b = BEVERAGES[bevKey];
  const wants = wantsBox.checked;
  const brewStep = b.steps[1], condStep = b.steps[3];

  const lines = [
    `let bev = new ${b.cls}();`,
    "bev.prepareRecipe();   // template method ở lớp cha",
    "",
    "// Thứ tự CỐ ĐỊNH do prepareRecipe() quy định:",
    "//   boilWater();             (lớp cha)",
    `//   brew();                  -> ${brewStep.brew}()  (${b.cls})`,
    "//   pourInCup();             (lớp cha)",
    `//   if (customerWantsCondiments())  // hook = ${wants}`,
  ];
  if (wants) {
    lines.push(`//       addCondiments();     -> ${condStep.cond}()  (${b.cls})`);
  } else {
    lines.push("//       addCondiments();     ⨯ BỎ QUA (hook = false)");
  }
  lines.push("");
  lines.push(`// → một cốc ${b.name}${wants ? " (có gia vị)" : " (không gia vị)"}`);
  renderCode(buildView, lines);
}

// ---------- Reset hình ảnh các cột ----------
function resetVisual(activeKey) {
  Object.keys(colEls).forEach((k) => {
    const col = colEls[k];
    col.classList.toggle("brewing", k === activeKey);
    col.classList.toggle("idle", k !== activeKey);
    col.classList.remove("steaming");
    liquidEls[k].style.height = "0";
    liquidEls[k].style.background = BEVERAGES[k].liquid;
    stepEls[k].forEach((el) => el.classList.remove("active", "done", "skipped"));
  });
}

function addLog(text, kind) {
  const div = document.createElement("div");
  div.className = "log-line" + (kind === "muted" ? " muted-line" : "");
  if (kind === "good") div.style.color = "var(--good)";
  if (kind === "skip") div.style.color = "#ff9b9b";
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

// ---------- Chạy prepareRecipe() có hoạt hình ----------
function prepareRecipe(bevKey) {
  if (busy) return;
  busy = true;
  lastBev = bevKey;
  const b = BEVERAGES[bevKey];
  const wants = wantsBox.checked;

  brewCoffeeBtn.disabled = true;
  brewTeaBtn.disabled = true;
  resetVisual(bevKey);
  log.innerHTML = "";
  addLog(`new ${b.cls}().prepareRecipe()`, "muted");
  renderBuildView(bevKey);

  const els = stepEls[bevKey];
  let i = 0;

  (function next() {
    if (i >= b.steps.length) {
      colEls[bevKey].classList.remove("steaming");
      addLog(`✓ Hoàn tất — một cốc ${b.name}`, "good");
      busy = false;
      brewCoffeeBtn.disabled = false;
      brewTeaBtn.disabled = false;
      return;
    }
    const step = b.steps[i];
    const el = els[i];

    // bước 4 (addCondiments) phụ thuộc hook
    if (step.cond && !wants) {
      el.classList.add("skipped");
      addLog(`if (customerWantsCondiments()) // false → BỎ QUA addCondiments()`, "skip");
      i++;
      setTimeout(next, 360);
      return;
    }

    // đánh dấu bước trước là done
    if (i > 0 && !els[i - 1].classList.contains("skipped")) els[i - 1].classList.add("done");

    el.classList.add("active");
    const owner = step.kind === "parent" ? "lớp cha" : b.cls;
    addLog(`${step.method.padEnd(18)} · ${step.vi}  (${owner})`, step.kind === "parent" ? "" : "good");

    // cập nhật cốc
    liquidEls[bevKey].style.height = step.fill + "%";
    if (step.method === "boilWater()") colEls[bevKey].classList.add("steaming");
    if (step.cond) liquidEls[bevKey].style.background = b.finalLiquid;

    i++;
    setTimeout(() => {
      el.classList.remove("active");
      el.classList.add("done");
      next();
    }, 520);
  })();
}

// ---------- Sự kiện ----------
brewCoffeeBtn.addEventListener("click", () => {
  brewCoffeeBtn.classList.add("primary");
  brewTeaBtn.classList.remove("primary");
  prepareRecipe("coffee");
});
brewTeaBtn.addEventListener("click", () => {
  brewTeaBtn.classList.add("primary");
  brewCoffeeBtn.classList.remove("primary");
  prepareRecipe("tea");
});
wantsBox.addEventListener("change", () => renderBuildView(lastBev));

// ---------- Tabs + khởi tạo ----------
setupTabs();
renderBuildView("coffee");
