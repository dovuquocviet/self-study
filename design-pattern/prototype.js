// ===== Prototype — minh hoạ động (clone quái vật trong game) =====
// Thay vì new + cấu hình lại từ đầu (tốn kém), ta giữ một prototype gốc rồi
// gọi clone() để ra bản sao giống hệt. Mỗi bản sao là đối tượng ĐỘC LẬP —
// sửa nó không đụng tới bản gốc.

// ---- Prototype gốc (read-only trong demo) ----
const original = { name: "Goblin", hue: 0, hp: 100 };

// ---- Các bản sao ----
let clones = [];     // [{ name, hue, hp }]
let selected = -1;   // index bản sao đang chọn

// ---- DOM refs ----
const log         = document.getElementById("log");
const clonesEl    = document.getElementById("clones");
const clonesEmpty = document.getElementById("clonesEmpty");
const originalEl  = document.getElementById("original");
const hue         = document.getElementById("hue");
const hp          = document.getElementById("hp");
const hueVal      = document.getElementById("hueVal");
const hpVal       = document.getElementById("hpVal");
const selName     = document.getElementById("selName");
const buildView   = document.getElementById("buildView");
const classView   = document.getElementById("classView");

// ====== Code TAB 2: định nghĩa lớp (tĩnh) ======
renderCode(classView, [
  "// Interface PROTOTYPE — chỉ cần một phương thức clone()",
  "class Prototype {",
  "  clone() {}   // trả về một bản sao của chính nó",
  "}",
  "",
  "// Concrete Prototype — quái vật biết tự nhân bản",
  "class Monster extends Prototype {",
  "  constructor(name, hue, hp) {",
  "    this.name = name;",
  "    this.hue  = hue;",
  "    this.hp   = hp;",
  "  }",
  "  clone() {",
  "    // tạo object mới với CÙNG trạng thái hiện tại",
  "    return new Monster(this.name + ' copy', this.hue, this.hp);",
  "    // (deep copy: nhớ clone cả các field tham chiếu bên trong)",
  "  }",
  "}",
  "",
  "// Dùng — dựng prototype 1 lần, clone bao nhiêu cũng được",
  "let original = new Monster('Goblin', 0, 100);",
  "let copy = original.clone();   // nhanh hơn new + config lại",
  "copy.hue = 120;                // sửa bản sao...",
  "// ...original.hue vẫn = 0 (hai đối tượng độc lập)",
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
  div.textContent = msg;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

// Áp thuộc tính (hue/hp) lên 1 node quái vật
function styleMonster(node, m) {
  node.style.setProperty("--hue", m.hue);
  const bar = node.querySelector(".m-hpbar i");
  if (bar) bar.style.width = Math.round((m.hp / 200) * 100) + "%";
  const nameEl = node.querySelector(".m-name");
  if (nameEl) nameEl.textContent = `${m.name} · HP ${m.hp}`;
}

function renderOriginal() {
  styleMonster(originalEl, original);
  originalEl.querySelector(".m-name").textContent = `${original.name} · HP ${original.hp}`;
}

function renderClones() {
  clonesEmpty.style.display = clones.length ? "none" : "block";
  clonesEl.querySelectorAll(".monster").forEach((n) => n.remove());
  clones.forEach((m, i) => {
    const node = document.createElement("div");
    node.className = "monster clone" + (i === selected ? " selected" : "");
    node.innerHTML =
      '<div class="m-body"><div class="m-eye"></div><div class="m-eye"></div><div class="m-mouth"></div></div>' +
      '<div class="m-name"></div><div class="m-hpbar"><i></i></div>';
    styleMonster(node, m);
    node.addEventListener("click", () => selectClone(i));
    clonesEl.appendChild(node);
  });
}

// Dựng tab Runtime theo thao tác gần nhất
function renderBuild(extra) {
  const lines = [
    "// Dựng prototype gốc MỘT lần",
    "let original = new Monster('Goblin', 0, 100);",
    "",
  ];
  clones.forEach((m, i) => {
    lines.push(`let copy${i + 1} = original.clone();   // bản sao độc lập`);
  });
  if (selected >= 0) {
    const m = clones[selected];
    lines.push("");
    lines.push(`// chỉnh bản sao đang chọn (copy${selected + 1}):`);
    lines.push(`copy${selected + 1}.hue = ${m.hue};`);
    lines.push(`copy${selected + 1}.hp  = ${m.hp};`);
    lines.push(`// → original.hue = ${original.hue}, original.hp = ${original.hp}  (KHÔNG đổi)`);
  }
  if (extra) lines.push(extra);
  renderCode(buildView, lines);
}

// ====== Hành động ======
function doClone() {
  const copy = { name: original.name + " copy", hue: original.hue, hp: original.hp };
  clones.push(copy);
  selected = clones.length - 1;
  renderClones();
  const node = clonesEl.querySelectorAll(".monster")[selected];
  if (node) replay(node, "spawn");
  logLine(`original.clone() → copy${selected + 1} (giống hệt bản gốc)`, "good");
  syncSliders();
  renderBuild();
}

function selectClone(i) {
  selected = i;
  renderClones();
  syncSliders();
  logLine(`Đang chọn copy${i + 1} để chỉnh`, "muted");
  renderBuild();
}

function syncSliders() {
  const has = selected >= 0;
  hue.disabled = !has; hp.disabled = !has;
  if (has) {
    const m = clones[selected];
    hue.value = m.hue; hp.value = m.hp;
    hueVal.textContent = m.hue; hpVal.textContent = m.hp;
    selName.textContent = `copy${selected + 1}`;
  } else {
    selName.textContent = "—";
  }
}

function onHue() {
  if (selected < 0) return;
  clones[selected].hue = +hue.value;
  hueVal.textContent = hue.value;
  const node = clonesEl.querySelectorAll(".monster")[selected];
  styleMonster(node, clones[selected]);
  // điểm mấu chốt: bản gốc KHÔNG đổi
  renderBuild("// Lưu ý: original không hề thay đổi khi ta sửa bản sao");
}
function onHp() {
  if (selected < 0) return;
  clones[selected].hp = +hp.value;
  hpVal.textContent = hp.value;
  const node = clonesEl.querySelectorAll(".monster")[selected];
  styleMonster(node, clones[selected]);
  renderBuild("// Lưu ý: original không hề thay đổi khi ta sửa bản sao");
}

function doReset() {
  clones = []; selected = -1;
  renderClones();
  syncSliders();
  logLine("Đã xoá các bản sao. Bản gốc vẫn nguyên vẹn.", "muted");
  renderBuild();
}

// ====== Sự kiện ======
document.getElementById("btnClone").addEventListener("click", doClone);
document.getElementById("btnReset").addEventListener("click", doReset);
hue.addEventListener("input", onHue);
hp.addEventListener("input", onHp);

// ====== Khởi tạo ======
setupTabs();
renderOriginal();
renderClones();
syncSliders();
renderBuild();
