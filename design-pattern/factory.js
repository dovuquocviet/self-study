// ===== Factory Method Pattern — minh hoạ động =====
// PizzaStore.orderPizza() là quy trình CỐ ĐỊNH; còn createPizza() (factory method)
// do mỗi cửa hàng con tự override -> cùng "type" nhưng mỗi cửa hàng tạo ra một
// Pizza cụ thể (concrete product) khác nhau. Đó chính là điểm cốt lõi của pattern.

// ---- Mỗi cửa hàng là 1 concrete factory ----
const STORES = {
  NY: {
    cls: "NYPizzaStore", prefix: "NY", style: "New York Style",
    dough: "Thin Crust Dough", sauce: "Marinara Sauce", cheese: "Reggiano Cheese",
    cut: "cutIntoDiagonalSlices()", cutVi: "cắt thành 8 miếng tam giác",
  },
  Chicago: {
    cls: "ChicagoPizzaStore", prefix: "Chicago", style: "Chicago Style",
    dough: "Extra Thick Crust Dough", sauce: "Plum Tomato Sauce", cheese: "Shredded Mozzarella Cheese",
    cut: "cutIntoSquares()", cutVi: "cắt thành các ô vuông",
  },
};

// ---- Loại pizza (type) + topping thêm ----
const TYPES = {
  cheese:    { pascal: "Cheese",    extra: [] },
  veggie:    { pascal: "Veggie",    extra: ["Mushrooms", "Onions", "Peppers"] },
  clam:      { pascal: "Clam",      extra: ["Clams"] },
  pepperoni: { pascal: "Pepperoni", extra: ["Pepperoni", "Mushrooms"] },
};

const TOPPING_COLOR = {
  Mushrooms: "#b08968", Onions: "#e9d8a6", Peppers: "#2a9d8f",
  Clams: "#cdd5df", Pepperoni: "#c1352a",
};

// ---- Trạng thái runtime ----
let currentStore = "NY";
let currentType = "cheese";
let busy = false;

// ---- DOM refs ----
const storePicker = document.getElementById("storePicker");
const typePicker  = document.getElementById("typePicker");
const orderBtn    = document.getElementById("orderBtn");
const track       = document.getElementById("pizzaTrack");
const pizzaName   = document.getElementById("pizzaName");
const log         = document.getElementById("log");
const buildView   = document.getElementById("buildView");
const classView   = document.getElementById("classView");

// Tạo "đặc tả" của Pizza cụ thể mà cửa hàng sẽ tạo ra
function spec(storeKey, typeKey) {
  const s = STORES[storeKey], t = TYPES[typeKey];
  return {
    name: `${s.style} ${t.pascal} Pizza`,
    concrete: `${s.prefix}Style${t.pascal}Pizza`,
    dough: s.dough, sauce: s.sauce,
    toppings: [s.cheese, ...t.extra],
  };
}

// ---------- TAB 2: định nghĩa lớp (tĩnh) ----------
renderCode(classView, [
  "// PizzaStore: orderPizza() CỐ ĐỊNH; createPizza() để lớp con quyết định",
  "class PizzaStore {",
  "  orderPizza(type) {",
  "    let pizza = this.createPizza(type);  // factory method",
  "    pizza.prepare();",
  "    pizza.bake();",
  "    pizza.cut();",
  "    pizza.box();",
  "    return pizza;",
  "  }",
  "  createPizza(type) {}   // trừu tượng — lớp con override",
  "}",
  "",
  "// Mỗi cửa hàng là một concrete factory:",
  "class NYPizzaStore extends PizzaStore {",
  "  createPizza(type) {",
  '    if (type === "cheese") return new NYStyleCheesePizza();',
  '    if (type === "veggie") return new NYStyleVeggiePizza();',
  '    if (type === "clam")   return new NYStyleClamPizza();',
  "    return new NYStylePepperoniPizza();",
  "  }",
  "}",
  "class ChicagoPizzaStore extends PizzaStore {",
  "  createPizza(type) {",
  '    if (type === "cheese") return new ChicagoStyleCheesePizza();',
  "    // ...veggie / clam / pepperoni...",
  "  }",
  "}",
  "",
  "// Pizza gốc + các style cụ thể (concrete products)",
  "class Pizza { prepare(){} bake(){} cut(){} box(){} }",
  "",
  "class NYStyleCheesePizza extends Pizza {",
  '  dough = "Thin Crust Dough";',
  '  sauce = "Marinara Sauce";',
  '  toppings = ["Reggiano Cheese"];',
  "}",
  "class ChicagoStyleCheesePizza extends Pizza {",
  '  dough = "Extra Thick Crust Dough";',
  '  sauce = "Plum Tomato Sauce";',
  '  toppings = ["Shredded Mozzarella Cheese"];',
  "  cut() {}   // override: cắt thành các ô vuông",
  "}",
]);

// ---------- TAB 1: code runtime theo lựa chọn hiện tại ----------
function renderBuildView() {
  const s = STORES[currentStore], sp = spec(currentStore, currentType);
  renderCode(buildView, [
    `let store = new ${s.cls}();`,
    `let pizza = store.orderPizza("${currentType}");`,
    "",
    "// orderPizza() là quy trình CỐ ĐỊNH trong PizzaStore:",
    `//   pizza = createPizza("${currentType}");   ← factory method`,
    `//   cửa hàng ${s.style} chọn concrete product:`,
    `//      → new ${sp.concrete}()`,
    "",
    "//   rồi chạy các bước CHUNG (không đổi):",
    `//   pizza.prepare();  // ${sp.dough}`,
    `//                     // ${sp.sauce}`,
    `//                     // ${sp.toppings.join(", ")}`,
    "//   pizza.bake();     // 25 phút @ 350°F",
    `//   pizza.${s.cut}   // ${s.cutVi}`,
    "//   pizza.box();",
    "",
    `// kết quả → ${sp.name}`,
  ]);
}

// ---------- Sân khấu: dựng đĩa pizza theo cửa hàng ----------
function renderPizza(storeKey, sp) {
  track.innerHTML = "";
  const pizza = document.createElement("div");
  pizza.className = "pizza " + (storeKey === "NY" ? "ny" : "chicago");
  pizza.innerHTML =
    '<div class="crust"></div><div class="sauce"></div><div class="cheese"></div>';

  // topping (bỏ phần tử cheese đầu — đã vẽ thành lớp cheese)
  sp.toppings.slice(1).forEach((top) => {
    const color = TOPPING_COLOR[top] || "#f6e7c1";
    for (let i = 0; i < 5; i++) {
      const dot = document.createElement("span");
      dot.className = "topping-dot";
      dot.style.background = color;
      const a = Math.random() * 2 * Math.PI, r = Math.random() * 55;
      dot.style.left = `calc(50% + ${Math.cos(a) * r}px)`;
      dot.style.top  = `calc(50% + ${Math.sin(a) * r}px)`;
      pizza.appendChild(dot);
    }
  });
  track.appendChild(pizza);
}

// ---------- Log từng bước prepare → bake → cut → box ----------
function runSteps(storeKey, sp) {
  const s = STORES[storeKey];
  log.innerHTML = "";
  const lines = [
    [`store.orderPizza("${currentType}")`, ""],
    [`→ createPizza("${currentType}")   // factory method`, "muted"],
    [`→ new ${sp.concrete}()`, ""],
    [`prepare() · ${sp.dough}`, ""],
    [`          · ${sp.sauce}`, ""],
    [`          · ${sp.toppings.join(", ")}`, ""],
    ["bake()    · nướng 25 phút @ 350°F", ""],
    [`cut()     · ${s.cutVi}`, ""],
    ["box()     · cho vào hộp PizzaStore", ""],
    [`✓ ${sp.name}`, "good"],
  ];

  busy = true;
  orderBtn.disabled = true;
  pizzaName.textContent = "";
  let i = 0;
  (function next() {
    if (i >= lines.length) {
      busy = false;
      orderBtn.disabled = false;
      pizzaName.textContent = sp.name;
      pizzaName.classList.remove("fade-up");
      void pizzaName.offsetWidth;
      pizzaName.classList.add("fade-up");
      return;
    }
    const [txt, kind] = lines[i++];
    const div = document.createElement("div");
    div.className = "log-line" + (kind === "muted" ? " muted-line" : "");
    if (kind === "good") div.style.color = "var(--good)";
    div.textContent = txt;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    setTimeout(next, 300);
  })();
}

// ---------- Đặt pizza ----------
function orderPizza() {
  if (busy) return;
  const sp = spec(currentStore, currentType);
  renderBuildView();
  renderPizza(currentStore, sp);
  runSteps(currentStore, sp);
}

// ---------- Sự kiện ----------
storePicker.addEventListener("click", (e) => {
  const b = e.target.closest("[data-store]");
  if (!b || busy) return;
  currentStore = b.dataset.store;
  storePicker.querySelectorAll(".btn").forEach((x) => x.classList.toggle("primary", x === b));
  renderBuildView();
});

typePicker.addEventListener("click", (e) => {
  const b = e.target.closest("[data-type]");
  if (!b || busy) return;
  currentType = b.dataset.type;
  typePicker.querySelectorAll(".btn").forEach((x) => x.classList.toggle("primary", x === b));
  renderBuildView();
});

orderBtn.addEventListener("click", orderPizza);

// ---------- Tabs + khởi tạo ----------
setupTabs();
renderBuildView();
