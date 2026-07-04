// ===== CQRS — minh hoạ động (đặt hàng tách Write / Read) =====
// Command (PlaceOrder, UpdateName) đi qua bus -> handler GHI vào writeDb rồi
// phát sự kiện. Projector lắng nghe, dựng lại readDb (view tối ưu cho đọc).
// Query (GetOrders) CHỈ đọc readDb — không bao giờ chạm phía ghi.

// ---- Hai kho dữ liệu runtime ----
const writeDb = []; // [{id, item, customer}]  — nguồn sự thật khi GHI
const readDb  = []; // [{id, label}]           — view "dọn sẵn" để ĐỌC

const ITEMS = ["Áo thun", "Giày sneaker", "Tai nghe", "Bàn phím", "Ấm trà"];
const NAMES = ["An", "Bình", "Chi", "Dũng", "Hà"];
let seq = 1041;

// ---- DOM refs ----
const writeNode  = document.getElementById("writeNode");
const readNode   = document.getElementById("readNode");
const writeCount = document.getElementById("writeCount");
const readCount  = document.getElementById("readCount");
const writeListEl = document.getElementById("writeList");
const readListEl  = document.getElementById("readList");
const portCmd  = document.getElementById("portCmd");
const portQry  = document.getElementById("portQry");
const syncArrow = document.getElementById("syncArrow");
const packet   = document.getElementById("packet");
const chLabel  = document.getElementById("chLabel");
const actBadge = document.getElementById("actBadge");
const buildView = document.getElementById("buildView");
const classView = document.getElementById("classView");

// ====== Code TAB 2: định nghĩa lớp (tĩnh) ======
renderCode(classView, [
  "// ---------- Phía COMMAND (ghi) ----------",
  "class PlaceOrder {           // Command = ý định thay đổi",
  "  constructor(id, item) { this.id = id; this.item = item; }",
  "}",
  "class PlaceOrderHandler {",
  "  handle(cmd) {",
  "    writeDb.save(cmd);                 // ghi vào Write Model",
  "    bus.publish(new OrderPlaced(cmd)); // phát sự kiện đồng bộ",
  "  }",
  "}",
  "",
  "// ---------- Đồng bộ: Projector dựng Read Model ----------",
  "class OrderProjector {",
  "  on(event) {                          // lắng nghe sự kiện ghi",
  "    readDb.upsert(toView(event));      // view tối ưu cho ĐỌC",
  "  }",
  "}",
  "",
  "// ---------- Phía QUERY (đọc) ----------",
  "class GetOrders {}           // Query = yêu cầu đọc",
  "class GetOrdersHandler {",
  "  handle(q) { return readDb.all(); }   // chỉ đọc, rất nhanh",
  "}",
  "",
  "// ---------- Bus định tuyến tới đúng handler ----------",
  "class Bus {",
  "  send(msg)    { return handlers[msg.type].handle(msg); }",
  "  publish(evt) { projectors.forEach(p => p.on(evt)); }",
  "}",
  "// 2 mô hình tách biệt: writeDb (ghi) ≠ readDb (đọc)",
]);

// ====== Code TAB 1: runtime (cập nhật theo thao tác) ======
let buildLines = [];
function note(line) { buildLines.push(line); }
function flush() { renderCode(buildView, buildLines); }

function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

function setBadge(txt) { actBadge.textContent = txt; replay(actBadge, "flash"); }

function renderStores(freshWriteId, freshReadId) {
  writeCount.textContent = writeDb.length + " lệnh ghi";
  readCount.textContent  = readDb.length + " bản ghi";

  writeListEl.innerHTML = writeDb.length ? "" : '<div class="store-empty">— trống —</div>';
  writeDb.forEach((o) => {
    const d = document.createElement("div");
    d.className = "row" + (o.id === freshWriteId ? " fresh" : "");
    d.textContent = `#${o.id} ${o.item} · ${o.customer}`;
    writeListEl.appendChild(d);
  });

  readListEl.innerHTML = readDb.length ? "" : '<div class="store-empty">— trống —</div>';
  readDb.forEach((v) => {
    const d = document.createElement("div");
    d.className = "row" + (v.id === freshReadId ? " fresh" : "");
    d.textContent = v.label;
    readListEl.appendChild(d);
  });
}

// ====== Lock đơn giản để animation không chồng nhau ======
let busy = false;
function setBusy(v) {
  busy = v;
  ["btnPlace", "btnRename", "btnQuery"].forEach((id) => {
    document.getElementById(id).disabled = v;
  });
}

// ====== Đồng bộ Write -> Read (animation packet chạy qua kênh) ======
function syncToRead(event, freshWriteId, done) {
  chLabel.textContent = event.type;
  note(`//  ~~ bus.publish(${event.type})`);
  note(`//     projector.on(${event.type})  // dựng Read Model`);
  setTimeout(() => {
    syncArrow.classList.add("lit");
    replay(packet, "move");
  }, 250);
  setTimeout(() => {
    // áp event vào readDb (upsert theo id)
    const view = { id: event.id, label: `#${event.id} ${event.item} — ${event.customer}` };
    const idx = readDb.findIndex((v) => v.id === event.id);
    if (idx === -1) readDb.push(view); else readDb[idx] = view;
    readNode.classList.add("active");
    replay(readNode, "pulse");
    note(`//     readDb.upsert(${JSON.stringify(view.label)})`);
    renderStores(freshWriteId, event.id);
    flush();
  }, 1050);
  setTimeout(() => {
    syncArrow.classList.remove("lit");
    readNode.classList.remove("active");
    writeNode.classList.remove("active");
    portCmd.classList.remove("hot");
    if (done) done();
  }, 1700);
}

// ====== COMMAND: PlaceOrder ======
function placeOrder() {
  if (busy) return;
  setBusy(true);
  const id = ++seq;
  const item = ITEMS[Math.floor(Math.random() * ITEMS.length)];
  const customer = NAMES[Math.floor(Math.random() * NAMES.length)];

  buildLines = [`bus.send(new PlaceOrder(${id}, "${item}"));`];
  note(`//  -> PlaceOrderHandler.handle(cmd)   // phía GHI`);
  setBadge("PlaceOrder ▸ writeDb");

  portCmd.classList.add("hot");
  writeNode.classList.add("active");
  replay(writeNode, "pulse");

  writeDb.push({ id, item, customer });
  note(`//     writeDb.save({id:${id}, item:"${item}"})`);
  renderStores(id, null);
  flush();

  syncToRead({ type: "OrderPlaced", id, item, customer }, id, () => setBusy(false));
}

// ====== COMMAND: UpdateName (sửa khách trên đơn mới nhất) ======
function updateName() {
  if (busy) return;
  if (writeDb.length === 0) { setBadge("chưa có đơn để sửa"); return; }
  setBusy(true);
  const order = writeDb[writeDb.length - 1];
  let next = NAMES[Math.floor(Math.random() * NAMES.length)];
  if (next === order.customer) next = NAMES[(NAMES.indexOf(next) + 1) % NAMES.length];
  order.customer = next;

  buildLines = [`bus.send(new UpdateName(${order.id}, "${next}"));`];
  note(`//  -> UpdateNameHandler.handle(cmd)   // phía GHI`);
  setBadge("UpdateName ▸ writeDb");

  portCmd.classList.add("hot");
  writeNode.classList.add("active");
  replay(writeNode, "pulse");
  note(`//     writeDb[#${order.id}].customer = "${next}"`);
  renderStores(order.id, null);
  flush();

  syncToRead({ type: "NameUpdated", id: order.id, item: order.item, customer: next },
    order.id, () => setBusy(false));
}

// ====== QUERY: GetOrders (chỉ đọc readDb) ======
function getOrders() {
  if (busy) return;
  setBusy(true);
  buildLines = [`const rows = readDb.query("SELECT * FROM order_view");`];
  note(`//  -> GetOrdersHandler.handle(q)      // phía ĐỌC`);
  note(`//     KHÔNG chạm writeDb — đọc thẳng read model`);
  setBadge("GetOrders ◂ readDb");

  portQry.classList.add("hot");
  readNode.classList.add("active");
  replay(readNode, "pulse");

  if (readDb.length === 0) {
    note(`//     => [] (read model còn trống)`);
  } else {
    readDb.forEach((v) => note(`//     -> ${v.label}`));
    note(`//     => ${readDb.length} bản ghi (đọc tức thì)`);
  }
  flush();

  setTimeout(() => {
    portQry.classList.remove("hot");
    readNode.classList.remove("active");
    setBusy(false);
  }, 900);
}

// ====== Sự kiện ======
document.getElementById("btnPlace").addEventListener("click", placeOrder);
document.getElementById("btnRename").addEventListener("click", updateName);
document.getElementById("btnQuery").addEventListener("click", getOrders);

// ====== Khởi tạo ======
setupTabs();
renderStores(null, null);
renderCode(buildView, [
  "// CQRS: GHI và ĐỌC đi hai con đường riêng.",
  "//",
  "// Bấm PlaceOrder / UpdateName  -> phía GHI (writeDb) + đồng bộ",
  "// Bấm GetOrders                -> phía ĐỌC (readDb)",
  "//",
  "// bus.send(new PlaceOrder(...));",
]);
