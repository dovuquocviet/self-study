// ===== Unit of Work — minh hoạ động (gom thay đổi rồi commit 1 transaction) =====
// UnitOfWork KHÔNG đụng DB ngay. Mỗi registerNew/Dirty/Removed chỉ bỏ entity vào
// đúng giỏ (new/dirty/removed). commit() mở MỘT transaction, flush tất cả theo thứ
// tự INSERT -> UPDATE -> DELETE rồi xoá giỏ. rollback() vứt sạch, DB nguyên vẹn.

// ---- 3 danh sách runtime ----
const uow = { newObjects: [], dirtyObjects: [], removedObjects: [] };

const NAMES = ["User", "Order", "Cart", "Invoice", "Address", "Coupon", "Review"];
let pk = 100;

// ---- DOM refs ----
const stage      = document.getElementById("stageArea");
const bucketNew  = document.getElementById("bucketNew");
const bucketDirty= document.getElementById("bucketDirty");
const bucketRemoved = document.getElementById("bucketRemoved");
const nNew = document.getElementById("nNew");
const nDirty = document.getElementById("nDirty");
const nRemoved = document.getElementById("nRemoved");
const listNew = document.getElementById("listNew");
const listDirty = document.getElementById("listDirty");
const listRemoved = document.getElementById("listRemoved");
const flushArrow = document.getElementById("flushArrow");
const dbNode  = document.getElementById("dbNode");
const dbState = document.getElementById("dbState");
const txBadge = document.getElementById("txBadge");
const buildView = document.getElementById("buildView");
const classView = document.getElementById("classView");

// ====== Code TAB 2: định nghĩa lớp (tĩnh) ======
renderCode(classView, [
  "class UnitOfWork {",
  "  constructor(db) {",
  "    this.db = db;",
  "    this.newObjects     = [];   // sẽ INSERT",
  "    this.dirtyObjects   = [];   // sẽ UPDATE",
  "    this.removedObjects = [];   // sẽ DELETE",
  "  }",
  "",
  "  // chỉ GHI NHẬN ý định — chưa chạm DB",
  "  registerNew(e)     { this.newObjects.push(e); }",
  "  registerDirty(e)   { this.dirtyObjects.push(e); }",
  "  registerRemoved(e) { this.removedObjects.push(e); }",
  "",
  "  // flush TẤT CẢ trong MỘT giao dịch",
  "  commit() {",
  "    this.db.begin();",
  "    try {",
  "      this.newObjects.forEach(e     => this.db.insert(e));",
  "      this.dirtyObjects.forEach(e   => this.db.update(e));",
  "      this.removedObjects.forEach(e => this.db.delete(e));",
  "      this.db.commit();          // 1 transaction duy nhất",
  "      this.clear();",
  "    } catch (err) {",
  "      this.db.rollback();        // lỗi -> huỷ sạch",
  "    }",
  "  }",
  "",
  "  rollback() { this.clear(); }   // bỏ mọi thay đổi đang theo dõi",
  "  clear() {",
  "    this.newObjects = this.dirtyObjects = this.removedObjects = [];",
  "  }",
  "}",
]);

// ====== Code TAB 1: runtime ======
let buildLines = [];
function note(l) { buildLines.push(l); }
function flush() { renderCode(buildView, buildLines); }
function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

function renderBucket(listEl, arr) {
  listEl.innerHTML = arr.length ? "" : '<div class="bucket-empty">—</div>';
  arr.forEach((e) => {
    const d = document.createElement("div");
    d.className = "row";
    d.textContent = e.label;
    listEl.appendChild(d);
  });
}
function render() {
  nNew.textContent = uow.newObjects.length;
  nDirty.textContent = uow.dirtyObjects.length;
  nRemoved.textContent = uow.removedObjects.length;
  renderBucket(listNew, uow.newObjects);
  renderBucket(listDirty, uow.dirtyObjects);
  renderBucket(listRemoved, uow.removedObjects);
}

function setTx(text, cls) {
  txBadge.textContent = text;
  txBadge.classList.remove("ok", "undo");
  if (cls) txBadge.classList.add(cls);
  replay(txBadge, "flash");
}

// ====== Lock ======
let busy = false;
function setBusy(v) {
  busy = v;
  ["btnNew","btnDirty","btnRemoved","btnCommit","btnRollback"].forEach((id) =>
    document.getElementById(id).disabled = v);
}

// ====== register* (chỉ bỏ vào giỏ) ======
function makeEntity() {
  const name = NAMES[Math.floor(Math.random() * NAMES.length)];
  return { label: `${name}#${++pk}` };
}

function register(kind) {
  if (busy) return;
  const e = makeEntity();
  const map = {
    new:     { arr: uow.newObjects,     bucket: bucketNew,     fn: "registerNew",     op: "INSERT" },
    dirty:   { arr: uow.dirtyObjects,   bucket: bucketDirty,   fn: "registerDirty",   op: "UPDATE" },
    removed: { arr: uow.removedObjects, bucket: bucketRemoved, fn: "registerRemoved", op: "DELETE" },
  }[kind];
  map.arr.push(e);

  buildLines = [`uow.${map.fn}(${e.label});`];
  note(`//  -> ${kind}Objects.push(${e.label})   // chờ ${map.op}, DB CHƯA đụng`);
  note(`//     đang theo dõi: ${uow.newObjects.length} new / ${uow.dirtyObjects.length} dirty / ${uow.removedObjects.length} removed`);
  map.bucket.classList.add("active");
  replay(map.bucket, "pulse");
  setTimeout(() => map.bucket.classList.remove("active"), 600);
  render();
  setTx("đang gom thay đổi…");
  flush();
}

// ====== commit() — flush tất cả trong 1 transaction ======
function commit() {
  if (busy) return;
  const total = uow.newObjects.length + uow.dirtyObjects.length + uow.removedObjects.length;
  if (total === 0) { setTx("không có gì để commit"); return; }
  setBusy(true);

  buildLines = ["uow.commit();"];
  note("//  -> db.begin();   // MỞ 1 transaction");
  flush();
  setTx("BEGIN…");
  flushArrow.classList.add("lit");

  // bắn các "viên" bay xuống DB
  for (let i = 0; i < Math.min(total, 8); i++) {
    const fly = document.createElement("span");
    fly.className = "uow-fly";
    stage.appendChild(fly);
    setTimeout(() => {
      replay(fly, "go");
      setTimeout(() => fly.remove(), 600);
    }, 120 * i);
  }

  setTimeout(() => {
    uow.newObjects.forEach((e)     => note(`//     db.insert(${e.label})`));
    uow.dirtyObjects.forEach((e)   => note(`//     db.update(${e.label})`));
    uow.removedObjects.forEach((e) => note(`//     db.delete(${e.label})`));
    const ni = uow.newObjects.length, nd = uow.dirtyObjects.length, nr = uow.removedObjects.length;
    note(`//  -> db.commit();  // ${ni} INSERT, ${nd} UPDATE, ${nr} DELETE — 1 lượt`);
    dbNode.classList.add("commit");
    replay(dbNode, "pulse");
    dbState.textContent = `✔ COMMIT: ${ni} INSERT · ${nd} UPDATE · ${nr} DELETE`;
    setTx("COMMIT ✔", "ok");

    // clear giỏ
    uow.newObjects = []; uow.dirtyObjects = []; uow.removedObjects = [];
    note("//  -> uow.clear();  // các giỏ rỗng lại");
    render();
    flush();
  }, 700);

  setTimeout(() => {
    flushArrow.classList.remove("lit");
    dbNode.classList.remove("commit");
    setBusy(false);
  }, 1500);
}

// ====== rollback() — vứt sạch, DB nguyên vẹn ======
function rollback() {
  if (busy) return;
  const total = uow.newObjects.length + uow.dirtyObjects.length + uow.removedObjects.length;
  buildLines = ["uow.rollback();"];
  note(`//  -> bỏ ${total} thay đổi đang theo dõi`);
  note("//     DB KHÔNG bị đụng vì chưa hề commit");
  uow.newObjects = []; uow.dirtyObjects = []; uow.removedObjects = [];
  render();
  dbNode.classList.add("rollback");
  replay(dbNode, "pulse");
  dbState.textContent = "↩︎ ROLLBACK — DB giữ nguyên";
  setTx("ROLLBACK ↩︎", "undo");
  setTimeout(() => dbNode.classList.remove("rollback"), 700);
  flush();
}

// ====== Sự kiện ======
document.getElementById("btnNew").addEventListener("click", () => register("new"));
document.getElementById("btnDirty").addEventListener("click", () => register("dirty"));
document.getElementById("btnRemoved").addEventListener("click", () => register("removed"));
document.getElementById("btnCommit").addEventListener("click", commit);
document.getElementById("btnRollback").addEventListener("click", rollback);

// ====== Khởi tạo ======
setupTabs();
render();
renderCode(buildView, [
  "// Unit of Work gom thay đổi, DB chưa bị đụng.",
  "//",
  "// uow.registerNew(user);     -> vào giỏ new",
  "// uow.registerDirty(order);  -> vào giỏ dirty",
  "// uow.registerRemoved(cart); -> vào giỏ removed",
  "// uow.commit();              -> flush TẤT CẢ trong 1 transaction",
  "//",
  "// Bấm các nút bên trái để xem.",
]);
