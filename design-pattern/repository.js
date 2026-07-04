// ===== Repository Pattern — minh hoạ động (UserRepository) =====
// Client gọi repo.add() / repo.findById() / repo.remove() trên một INTERFACE.
// Phía sau là InMemory (Map RAM) hay ApiUserRepository (gọi REST) — client KHÔNG đổi code.

// ---- hai bản cài đặt thật của cùng interface ----
const stores = {
  memory: {
    cls: "InMemoryUserRepository", sub: "Map trong RAM", async: false,
    data: new Map(),
  },
  api: {
    cls: "ApiUserRepository", sub: "fetch('/api/users') — có độ trễ", async: true,
    data: new Map(),
  },
};
let current = "memory";   // backing store đang chọn
let nextId = 1;

// ---- DOM ----
const log         = document.getElementById("store");
const nameInput   = document.getElementById("nameInput");
const idInput     = document.getElementById("idInput");
const packet      = document.getElementById("packet");
const arrow1      = document.getElementById("arrow1");
const arrow2      = document.getElementById("arrow2");
const sourceNode  = document.getElementById("sourceNode");
const sourceTitle = document.getElementById("sourceTitle");
const sourceSub   = document.getElementById("sourceSub");
const repoNode    = document.getElementById("repoNode");
const buildView   = document.getElementById("buildView");
const classView   = document.getElementById("classView");

// ====== TAB 2: định nghĩa lớp ======
renderCode(classView, [
  "// Interface chung — client CHỈ phụ thuộc cái này",
  "class UserRepository {",
  "  add(user)      {}",
  "  findById(id)   {}",
  "  remove(id)     {}",
  "}",
  "",
  "// Bản 1: lưu trong RAM (nhanh, hợp khi test)",
  "class InMemoryUserRepository extends UserRepository {",
  "  constructor() { super(); this.map = new Map(); }",
  "  add(user)    { this.map.set(user.id, user); return user; }",
  "  findById(id) { return this.map.get(id) || null; }",
  "  remove(id)   { return this.map.delete(id); }",
  "}",
  "",
  "// Bản 2: gọi REST API thật (cùng interface!)",
  "class ApiUserRepository extends UserRepository {",
  "  async add(user)    { return post('/api/users', user); }",
  "  async findById(id) { return get(`/api/users/${id}`); }",
  "  async remove(id)   { return del(`/api/users/${id}`); }",
  "}",
  "",
  "// Client chỉ biết interface — tiêm bản nào cũng chạy",
  "class UserService {",
  "  constructor(repo) { this.repo = repo; }",
  "  register(name) {",
  "    return this.repo.add({ id: nextId(), name });",
  "  }",
  "}",
]);

// ====== TAB 1: runtime ======
let lastOp = null;   // {action, code:[...]}
function renderBuild() {
  const s = stores[current];
  const head = [
    "// Đổi store = đổi 1 dòng tiêm, client GIỮ NGUYÊN:",
    `const repo = new ${s.cls}();`,
    "const service = new UserService(repo);",
    "",
  ];
  const body = lastOp ? lastOp.code : [
    "// Bấm một thao tác bên trái để xem",
    "// service uỷ quyền cho repo.<method>().",
  ];
  renderCode(buildView, head.concat(body));
}

// ====== tiện ích sân khấu ======
function logLine(msg, kind) {
  const div = document.createElement("div");
  div.className = "log-line" + (kind === "muted" ? " muted-line" : "");
  if (kind === "good") div.style.color = "var(--good)";
  if (kind === "bad")  div.style.color = "#ff9b9b";
  div.textContent = msg;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}
function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

function renderStore() {
  const map = stores[current].data;
  log.innerHTML = "";
  if (map.size === 0) {
    logLine("Store rỗng…", "muted");
    return;
  }
  map.forEach((u) => {
    const row = document.createElement("div");
    row.className = "log-line store-row";
    row.innerHTML = `<span><span class="uid">#${u.id}</span> ${esc(u.name)}</span><span>👤</span>`;
    log.appendChild(row);
  });
}

// gửi gói dữ liệu xuống source rồi trả lên — callback chạy khi "tới nơi"
function animateFlow(down, onArrive, onDone) {
  replay(arrow1, "lit"); replay(arrow2, "lit");
  replay(packet, down ? "go-down" : "go-up");
  const delay = stores[current].async ? 900 : 450;
  setTimeout(() => { onArrive && onArrive(); }, delay);
  setTimeout(() => {
    arrow1.classList.remove("lit"); arrow2.classList.remove("lit");
    onDone && onDone();
  }, 950);
}

// ====== Các thao tác qua repository ======
function add() {
  const name = (nameInput.value || "Unknown").trim();
  const id = nextId++;
  const s = stores[current];
  replay(repoNode, "pulse");
  animateFlow(true, () => {
    s.data.set(id, { id, name });
    renderStore();
  });
  lastOp = { code: [
    `service.register("${name}");`,
    "//  -> repo.add({ id: " + id + ", name })",
    s.async ? "//  -> await POST /api/users  (có độ trễ)"
            : "//  -> map.set(" + id + ", user)  (tức thì)",
    `//     đã lưu vào ${s.cls}`,
  ]};
  logLine(`add() → lưu #${id} "${name}" vào ${s.cls}`, "good");
  renderBuild();
}

function find() {
  const id = parseInt(idInput.value, 10);
  const s = stores[current];
  replay(repoNode, "pulse");
  animateFlow(true, null, () => {
    const u = s.data.get(id);
    if (u) logLine(`findById(${id}) → tìm thấy "${u.name}"`, "good");
    else   logLine(`findById(${id}) → null (không có)`, "bad");
  });
  const u = s.data.get(id);
  lastOp = { code: [
    `service.repo.findById(${id});`,
    s.async ? "//  -> await GET /api/users/" + id
            : "//  -> map.get(" + id + ")",
    u ? `//  <- { id: ${id}, name: "${u.name}" }`
      : `//  <- null  (không tìm thấy)`,
  ]};
  renderBuild();
}

function remove() {
  const id = parseInt(idInput.value, 10);
  const s = stores[current];
  const existed = s.data.has(id);
  replay(repoNode, "pulse");
  animateFlow(true, () => { s.data.delete(id); renderStore(); });
  lastOp = { code: [
    `service.repo.remove(${id});`,
    s.async ? "//  -> await DELETE /api/users/" + id
            : "//  -> map.delete(" + id + ")",
    existed ? "//  <- true  (đã xoá)" : "//  <- false (không có để xoá)",
  ]};
  logLine(existed ? `remove(${id}) → đã xoá` : `remove(${id}) → không có gì để xoá`,
          existed ? "good" : "bad");
  renderBuild();
}

function switchStore(key) {
  current = key;
  document.querySelectorAll(".store-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.store === key));
  const s = stores[key];
  sourceTitle.textContent = s.cls;
  sourceSub.textContent = s.sub;
  sourceNode.classList.toggle("api", key === "api");
  replay(sourceNode, "pulse");
  logLine(`⇄ Đổi backing store → ${s.cls} (client KHÔNG đổi code)`, "muted");
  renderStore();
  renderBuild();
}

// ====== sự kiện ======
document.querySelectorAll(".store-btn").forEach((b) =>
  b.addEventListener("click", () => switchStore(b.dataset.store)));
document.getElementById("addBtn").addEventListener("click", add);
document.getElementById("findBtn").addEventListener("click", find);
document.getElementById("removeBtn").addEventListener("click", remove);

// ====== khởi tạo ======
setupTabs();
renderStore();
renderBuild();
