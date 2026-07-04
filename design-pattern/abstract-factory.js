// ===== Abstract Factory — minh hoạ động (lò pizza NY & Chicago) =====
// Code làm pizza KHÔNG biết lớp nguyên liệu cụ thể. Nó chỉ gọi
// factory.createDough() / createSauce() / ... Đổi factory cụ thể (NY hay
// Chicago) là đổi cả MỘT HỌ nguyên liệu khớp nhau — code dùng không đổi.

// ---- Dữ liệu 2 họ sản phẩm (mỗi factory một họ) ----
const FACTORIES = {
  ny: {
    className: "NYPizzaIngredientFactory",
    label: "🗽 NY Ingredient Factory",
    color: "#6ad0ff",
    products: {
      dough:   { name: "ThinCrustDough",  color: "#e8c79a" },
      sauce:   { name: "MarinaraSauce",   color: "#e25d4f" },
      cheese:  { name: "ReggianoCheese",  color: "#ffd166" },
      veggies: { name: "Garlic + Onion",  color: "#8ec06c" },
    },
  },
  chicago: {
    className: "ChicagoPizzaIngredientFactory",
    label: "🏙️ Chicago Ingredient Factory",
    color: "#ffb454",
    products: {
      dough:   { name: "ThickCrustDough",  color: "#d8a766" },
      sauce:   { name: "PlumTomatoSauce",  color: "#c0392b" },
      cheese:  { name: "MozzarellaCheese", color: "#fff3cf" },
      veggies: { name: "Eggplant + Spinach", color: "#5aa469" },
    },
  },
};

const SLOTS = ["dough", "sauce", "cheese", "veggies"];
const CREATE = { dough: "createDough", sauce: "createSauce", cheese: "createCheese", veggies: "createVeggies" };

// ---- DOM refs ----
const log           = document.getElementById("log");
const grid          = document.getElementById("grid");
const factoryBox    = document.getElementById("factoryBox");
const factoryLabel  = document.getElementById("factoryLabel");
const factoryBadge  = document.getElementById("factoryBadge");
const buildView     = document.getElementById("buildView");
const classView     = document.getElementById("classView");

// ====== Code TAB 2: định nghĩa lớp (tĩnh) ======
renderCode(classView, [
  "// Interface ABSTRACT FACTORY — tạo một HỌ nguyên liệu",
  "class PizzaIngredientFactory {",
  "  createDough()   {}",
  "  createSauce()   {}",
  "  createCheese()  {}",
  "  createVeggies() {}",
  "}",
  "",
  "// Factory cụ thể #1 — họ nguyên liệu kiểu NY",
  "class NYPizzaIngredientFactory extends PizzaIngredientFactory {",
  "  createDough()   { return new ThinCrustDough(); }",
  "  createSauce()   { return new MarinaraSauce(); }",
  "  createCheese()  { return new ReggianoCheese(); }",
  "  createVeggies() { return [new Garlic(), new Onion()]; }",
  "}",
  "",
  "// Factory cụ thể #2 — họ nguyên liệu kiểu Chicago",
  "class ChicagoPizzaIngredientFactory extends PizzaIngredientFactory {",
  "  createDough()   { return new ThickCrustDough(); }",
  "  createSauce()   { return new PlumTomatoSauce(); }",
  "  createCheese()  { return new MozzarellaCheese(); }",
  "  createVeggies() { return [new Eggplant(), new Spinach()]; }",
  "}",
  "",
  "// Vài PRODUCT trừu tượng + cụ thể",
  "class Dough {}",
  "class ThinCrustDough  extends Dough {}",
  "class ThickCrustDough extends Dough {}",
  "class Sauce {}",
  "class MarinaraSauce  extends Sauce {}",
  "class PlumTomatoSauce extends Sauce {}",
  "",
  "// Code DÙNG factory — không biết lớp cụ thể nào",
  "class Pizza {",
  "  constructor(factory) {",
  "    this.dough   = factory.createDough();",
  "    this.sauce   = factory.createSauce();",
  "    this.cheese  = factory.createCheese();",
  "    this.veggies = factory.createVeggies();",
  "  }",
  "}",
]);

// ====== Code TAB 1: runtime (cập nhật theo thao tác) ======
function replay(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

function logLine(msg, kind) {
  const div = document.createElement("div");
  div.className = "log-line" + (kind === "muted" ? " muted-line" : "");
  if (kind === "good") div.style.color = "var(--good)";
  div.textContent = msg;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function resetCards() {
  grid.querySelectorAll(".ing-card").forEach((card) => {
    card.classList.remove("filled", "drop");
    card.querySelector(".ing-name").textContent = "—";
    card.querySelector(".ing-name").style.color = "";
    card.style.setProperty("--ing-color", "transparent");
  });
}

// ====== Hành động chính: chọn 1 factory cụ thể ======
function pickFactory(key) {
  const f = FACTORIES[key];

  // cập nhật sân khấu
  factoryLabel.textContent = f.className;
  factoryBox.style.setProperty("--factory-color", f.color);
  replay(factoryBox, "produce");
  factoryBadge.textContent = f.className;
  factoryBadge.style.color = f.color;
  factoryBadge.style.borderColor = f.color;
  replay(factoryBadge, "flash");

  log.innerHTML = "";
  logLine(`new ${f.className}()`, "good");
  resetCards();

  // dựng code runtime + animation nhả từng nguyên liệu
  const lines = [
    `// Chọn factory cụ thể cho vùng này:`,
    `let factory = new ${f.className}();`,
    `let pizza = {};`,
    `// Cùng các lời gọi createXxx() — nhưng ra sản phẩm khác:`,
  ];
  renderCode(buildView, lines);

  SLOTS.forEach((slot, i) => {
    setTimeout(() => {
      const p = f.products[slot];
      const card = grid.querySelector(`.ing-card[data-slot="${slot}"]`);
      card.querySelector(".ing-name").textContent = p.name;
      card.style.setProperty("--ing-color", p.color);
      card.classList.add("filled");
      replay(card, "drop");

      logLine(`${CREATE[slot]}() → ${p.name}`);
      lines.push(`pizza.${slot} = factory.${CREATE[slot]}();   // → ${p.name}`);
      renderCode(buildView, lines);

      if (i === SLOTS.length - 1) {
        lines.push("// → Cả họ nguyên liệu đều khớp vùng, không lo trộn nhầm");
        renderCode(buildView, lines);
        logLine("✓ Một họ nguyên liệu khớp nhau đã sẵn sàng", "good");
      }
    }, 180 + i * 360);
  });
}

// ====== Sự kiện ======
document.getElementById("btnNY").addEventListener("click", () => pickFactory("ny"));
document.getElementById("btnChicago").addEventListener("click", () => pickFactory("chicago"));

// ====== Khởi tạo ======
setupTabs();
factoryBox.style.setProperty("--factory-color", "#5a6675");
renderCode(buildView, [
  "// Bấm một factory bên trái để xem nó",
  "// tạo ra MỘT HỌ nguyên liệu khớp nhau.",
  "//",
  "// let factory = new NYPizzaIngredientFactory();",
  "// let dough   = factory.createDough();",
  "//   -> ra ThinCrustDough (kiểu NY)",
]);
