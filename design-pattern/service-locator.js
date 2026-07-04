// ===== Service Locator Pattern — minh hoạ động =====
// Một registry trung tâm (Map khoá → instance). Code đăng ký service một lần
// rồi ở bất cứ đâu chỉ cần biết KHOÁ là "định vị" lấy ra dùng, không tự new.

// ---- Catalog service demo ----
const SERVICES = {
  logger: { icon: "📝", label: "Logger", ctor: "new Logger()",  use: "logger.log('hi')" },
  db:     { icon: "🗃️", label: "Database", ctor: "new Db()",    use: "db.query('...')" },
  mailer: { icon: "✉️", label: "Mailer",  ctor: "new Mailer()", use: "mailer.send(...)" },
};

// ---- Registry runtime (khoá đã đăng ký) ----
const registry = new Map();

// ---- DOM refs ----
const shelf       = document.getElementById("shelf");
const shelfEmpty  = document.getElementById("shelfEmpty");
const registryBox = document.getElementById("registryBox");
const clientBox   = document.getElementById("clientBox");
const hand        = document.getElementById("hand");
const fly         = document.getElementById("fly");
const actionBadge = document.getElementById("actionBadge");
const buildView   = document.getElementById("buildView");
const classView   = document.getElementById("classView");

// ====== Code TAB 2: định nghĩa lớp (tĩnh) ======
renderCode(classView, [
  "// Registry trung tâm: khoá (string) → instance",
  "class ServiceLocator {",
  "  static registry = new Map();",
  "",
  "  static register(key, instance) {",
  "    this.registry.set(key, instance);",
  "  }",
  "",
  "  static get(key) {",
  "    const svc = this.registry.get(key);",
  "    if (!svc)",
  "      throw new Error(`Service '${key}' chưa đăng ký`);",
  "    return svc;",
  "  }",
  "}",
  "",
  "// Đăng ký một lần (thường lúc khởi động app)",
  "ServiceLocator.register('db', new Db());",
  "",
  "// Ở bất cứ đâu — chỉ cần biết KHOÁ",
  "const db = ServiceLocator.get('db');",
  "db.query('SELECT 1');",
]);

// ====== Tiện ích ======
function replay(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

function setBadge(text, kind) {
  actionBadge.textContent = text;
  actionBadge.style.borderColor = "";
  actionBadge.style.color = "";
  if (kind === "good") { actionBadge.style.borderColor = "var(--good)"; actionBadge.style.color = "var(--good)"; }
  if (kind === "bad")  { actionBadge.style.borderColor = "#ff6b6b"; actionBadge.style.color = "#ff9b9b"; }
  replay(actionBadge, "flash");
}

// ====== Vẽ tủ + danh sách registry ======
function renderShelf() {
  shelf.innerHTML = "";
  const keys = [...registry.keys()];
  shelfEmpty.style.display = keys.length ? "none" : "block";
  keys.forEach((k) => {
    const s = SERVICES[k];
    const chip = document.createElement("div");
    chip.className = "sl-chip fade-up";
    chip.dataset.key = k;
    chip.innerHTML = `<span class="sl-chip-ic">${s.icon}</span>` +
      `<span class="sl-chip-txt"><b>'${k}'</b><small>${s.ctor}</small></span>`;
    shelf.appendChild(chip);
  });

  // sub-panel danh sách
  if (!keys.length) {
    registryBox.innerHTML = '<div class="log-line muted-line">Tủ trống — hãy register() một service.</div>';
  } else {
    registryBox.innerHTML = keys.map((k) =>
      `<div class="log-line">${SERVICES[k].icon} '${k}' → ${SERVICES[k].ctor}</div>`
    ).join("");
  }
}

// ====== register(key) ======
function register(key) {
  const s = SERVICES[key];
  const already = registry.has(key);
  registry.set(key, s.ctor);
  renderShelf();

  // chip vừa thêm "rơi" vào tủ
  const chip = shelf.querySelector(`.sl-chip[data-key="${key}"]`);
  if (chip) replay(chip, "drop-in");
  setBadge(`register('${key}')`, "good");

  renderCode(buildView, [
    `ServiceLocator.register('${key}', ${s.ctor});`,
    `//   registry.set('${key}', <${s.label}>)`,
    already ? `//   (ghi đè instance cũ của '${key}')`
            : `//   ✓ đã cất '${key}' vào tủ`,
    `//   tủ hiện có: [${[...registry.keys()].map((k) => `'${k}'`).join(", ")}]`,
  ]);
}

// ====== get(key) ======
function get(key) {
  const s = SERVICES[key];
  if (!registry.has(key)) {
    // KHÔNG có → ném lỗi
    setBadge(`get('${key}') ✗`, "bad");
    hand.textContent = `❌ '${key}' chưa đăng ký`;
    hand.className = "sl-hand err";
    replay(clientBox, "shake");
    renderCode(buildView, [
      `const svc = ServiceLocator.get('${key}');`,
      `//   registry.get('${key}') → undefined`,
      `//   ✗ chưa register('${key}') trước đó`,
      `//   💥 throw Error("Service '${key}' chưa đăng ký")`,
    ]);
    return;
  }

  // CÓ → bay từ tủ sang client
  setBadge(`get('${key}')`, "good");
  flyService(key, s);

  renderCode(buildView, [
    `const ${key} = ServiceLocator.get('${key}');`,
    `//   registry.get('${key}') → <${s.label} instance>`,
    `//   ✓ chính instance đã đăng ký (không new mới)`,
    `${s.use};`,
  ]);
}

// chip "bay" từ shelf tới client hand
function flyService(key, s) {
  const chip = shelf.querySelector(`.sl-chip[data-key="${key}"]`);
  const stage = document.getElementById("stageArea");
  if (!chip) return;
  const cRect = chip.getBoundingClientRect();
  const sRect = stage.getBoundingClientRect();
  const hRect = hand.getBoundingClientRect();

  fly.textContent = `${s.icon} '${key}'`;
  fly.style.left = (cRect.left - sRect.left) + "px";
  fly.style.top  = (cRect.top  - sRect.top) + "px";
  fly.style.setProperty("--dx", (hRect.left - cRect.left) + "px");
  fly.style.setProperty("--dy", (hRect.top  - cRect.top) + "px");
  fly.classList.remove("go"); void fly.offsetWidth; fly.classList.add("go");

  replay(chip, "pick");
  setTimeout(() => {
    hand.textContent = `${s.icon} nhận ${s.label}`;
    hand.className = "sl-hand ok";
    replay(clientBox, "pulse-ok");
  }, 520);
}

// ====== Sự kiện ======
document.querySelectorAll("[data-reg]").forEach((b) =>
  b.addEventListener("click", () => register(b.dataset.reg)));
document.querySelectorAll("[data-get]").forEach((b) =>
  b.addEventListener("click", () => get(b.dataset.get)));

// ====== Khởi tạo ======
setupTabs();
renderShelf();
renderCode(buildView, [
  "// registry rỗng lúc đầu.",
  "// ① Bấm register('logger') để cất service vào tủ.",
  "// ② Bấm get('logger') để client định vị lấy ra dùng.",
  "// Thử get() một service CHƯA đăng ký để thấy lỗi.",
]);
