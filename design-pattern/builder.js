// ===== Builder — minh hoạ động (dựng burger từng bước) =====
// BurgerBuilder dựng sản phẩm qua NHIỀU BƯỚC. Mỗi addX() trả về this để
// nối chuỗi (fluent). build() đóng gói ra Product cuối cùng. Một Director
// (tuỳ chọn) gói sẵn công thức dựng quen thuộc.

// ---- Cấu hình từng loại lớp ----
const LAYERS = {
  bun:     { label: "Bun",     emoji: "🍞", color: "#e0a35c", h: 26, method: "addBun" },
  patty:   { label: "Patty",   emoji: "🥩", color: "#7a4a2b", h: 22, method: "addPatty" },
  cheese:  { label: "Cheese",  emoji: "🧀", color: "#ffce54", h: 12, method: "addCheese" },
  veggies: { label: "Veggies", emoji: "🥬", color: "#7cb342", h: 14, method: "addVeggies" },
  sauce:   { label: "Sauce",   emoji: "🥫", color: "#e2574c", h: 9,  method: "addSauce" },
};

// ---- Trạng thái builder runtime ----
let builder = [];   // mảng key các lớp đã thêm (theo thứ tự)
let built = false;  // đã gọi build() chưa

// ---- DOM refs ----
const log        = document.getElementById("log");
const stack      = document.getElementById("stack");
const emptyHint  = document.getElementById("emptyHint");
const badge      = document.getElementById("badge");
const buildView  = document.getElementById("buildView");
const classView  = document.getElementById("classView");

// ====== Code TAB 2: định nghĩa lớp (tĩnh) ======
renderCode(classView, [
  "// PRODUCT — thứ ta muốn dựng",
  "class Burger {",
  "  constructor() { this.layers = []; }",
  "  add(layer) { this.layers.push(layer); }",
  "  toString() { return this.layers.join(' + '); }",
  "}",
  "",
  "// BUILDER — dựng Burger qua từng bước, mỗi bước trả về this",
  "class BurgerBuilder {",
  "  constructor() { this.burger = new Burger(); }",
  "  addBun()     { this.burger.add('Bun');     return this; }",
  "  addPatty()   { this.burger.add('Patty');   return this; }",
  "  addCheese()  { this.burger.add('Cheese');  return this; }",
  "  addVeggies() { this.burger.add('Veggies'); return this; }",
  "  addSauce()   { this.burger.add('Sauce');   return this; }",
  "  build()      { return this.burger; }   // ← đóng gói sản phẩm",
  "}",
  "",
  "// DIRECTOR (tuỳ chọn) — gói sẵn một 'công thức' dựng",
  "class Director {",
  "  makeBigMac(builder) {",
  "    return builder",
  "      .addBun().addPatty().addCheese()",
  "      .addVeggies().addSauce().addBun()",
  "      .build();",
  "  }",
  "}",
  "",
  "// Dùng — fluent, đọc như mô tả công thức:",
  "let burger = new BurgerBuilder()",
  "  .addBun().addPatty().addCheese().build();",
]);

// ====== Tiện ích ======
function replay(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
function logLine(msg, kind) {
  const div = document.createElement("div");
  div.className = "log-line" + (kind === "muted" ? " muted-line" : "");
  if (kind === "good") div.style.color = "var(--good)";
  if (kind === "bad")  div.style.color = "#ff9b9b";
  div.textContent = msg;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

// Render chồng burger (lớp đầu tiên ở dưới đáy)
function renderStack(lastAdded) {
  stack.innerHTML = "";
  emptyHint.style.display = builder.length ? "none" : "block";
  builder.forEach((key, i) => {
    const L = LAYERS[key];
    const el = document.createElement("div");
    el.className = "layer layer-" + key;
    el.style.height = L.h + "px";
    el.style.background = L.color;
    el.innerHTML = `<span class="layer-emoji">${L.emoji}</span><span class="layer-name">${L.label}</span>`;
    stack.appendChild(el);
    if (i === lastAdded) replay(el, "drop");
  });
}

// Dựng lại tab Runtime theo chuỗi fluent hiện tại
function renderBuild() {
  const lines = [];
  if (builder.length === 0) {
    lines.push("let builder = new BurgerBuilder();");
    lines.push("// Builder rỗng — thêm vài lớp rồi build()");
  } else {
    lines.push("let burger = new BurgerBuilder()");
    builder.forEach((key, i) => {
      const isLast = i === builder.length - 1;
      lines.push(`  .${LAYERS[key].method}()` + (built && isLast ? "" : "") +
                 `   // → this (nối tiếp được)`);
    });
    if (built) {
      lines.push("  .build();");
      lines.push("//");
      lines.push(`// burger.layers = [${builder.map(k => LAYERS[k].label).join(", ")}]`);
      lines.push("// → Đã đóng gói: Builder trả về Product hoàn chỉnh");
    } else {
      lines.push("  // ...chưa build() — vẫn đang dựng dở");
    }
  }
  renderCode(buildView, lines);
}

// ====== Hành động ======
function addLayer(key) {
  if (built) {            // đã build xong → bắt đầu cái mới
    builder = []; built = false;
  }
  builder.push(key);
  renderStack(builder.length - 1);
  logLine(`${LAYERS[key].method}() → trả về this`);
  badge.textContent = `BurgerBuilder (${builder.length} lớp)`;
  badge.style.color = ""; badge.style.borderColor = "";
  renderBuild();
}

function doBuild() {
  if (builder.length === 0) { logLine("Builder rỗng — chưa có gì để build()", "bad"); return; }
  if (built) { logLine("Đã build() rồi", "bad"); return; }
  built = true;
  replay(stack, "wrapped");
  badge.textContent = "Burger 🍔 (built!)";
  badge.style.color = "var(--good)";
  badge.style.borderColor = "var(--good)";
  replay(badge, "flash");
  logLine(`build() → Burger [${builder.map(k => LAYERS[k].label).join(", ")}]`, "good");
  renderBuild();
}

function doReset() {
  builder = []; built = false;
  renderStack(-1);
  badge.textContent = "BurgerBuilder (đang dựng)";
  badge.style.color = ""; badge.style.borderColor = "";
  logLine("new BurgerBuilder() — bắt đầu lại từ đầu", "muted");
  renderBuild();
}

// Director: gói sẵn công thức nhiều bước
function directorBigMac() {
  doReset();
  const recipe = ["bun", "patty", "cheese", "veggies", "sauce", "bun"];
  logLine("director.makeBigMac(builder)", "good");
  recipe.forEach((key, i) => {
    setTimeout(() => {
      builder.push(key);
      renderStack(builder.length - 1);
      logLine(`  .${LAYERS[key].method}()`);
      badge.textContent = `BurgerBuilder (${builder.length} lớp)`;
      renderBuild();
      if (i === recipe.length - 1) setTimeout(doBuild, 320);
    }, 150 + i * 340);
  });
}

// ====== Sự kiện ======
document.querySelectorAll("[data-add]").forEach((b) =>
  b.addEventListener("click", () => addLayer(b.dataset.add)));
document.getElementById("btnBuild").addEventListener("click", doBuild);
document.getElementById("btnReset").addEventListener("click", doReset);
document.getElementById("btnDirector").addEventListener("click", directorBigMac);

// ====== Khởi tạo ======
setupTabs();
renderStack(-1);
renderBuild();
