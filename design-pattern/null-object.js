// ===== Null Object Pattern — minh hoạ động =====
// Thay vì trả về null khi không tìm thấy user, ta trả về một GuestUser
// (Null Object): cài đủ method nhưng trả giá trị mặc định vô hại.
// Client gọi method như bình thường, không cần if (user != null).

// ---- Trạng thái runtime ----
const app = {
  mode: "nullobject", // "nullobject" | "plainnull"
  who:  "guest",      // "alice" | "guest"
};

// "Dữ liệu" các đối tượng
const REAL  = { name: "Alice", discount: 20 };   // RealUser
const GUEST = { name: "Khách", discount: 0 };    // GuestUser (Null Object)

// ---- DOM refs ----
const modeNO     = document.getElementById("modeNO");
const modeNull   = document.getElementById("modeNull");
const whoAlice   = document.getElementById("whoAlice");
const whoGuest   = document.getElementById("whoGuest");
const callName   = document.getElementById("callName");
const callDisc   = document.getElementById("callDiscount");

const clientCall = document.getElementById("clientCall");
const arrow1     = document.getElementById("arrow1");
const arrow2     = document.getElementById("arrow2");
const userObj    = document.getElementById("userObj");
const objTitle   = document.getElementById("objTitle");
const objBody    = document.getElementById("objBody");
const resultBox  = document.getElementById("resultBox");
const objBadge   = document.getElementById("objBadge");

const buildView  = document.getElementById("buildView");
const classView  = document.getElementById("classView");

// ====== Code TAB 2: định nghĩa lớp (tĩnh) ======
renderCode(classView, [
  "// 'Hợp đồng' chung — ai cũng cài đủ method",
  "class User {",
  "  getName()     {}",
  "  getDiscount() {}",
  "}",
  "",
  "// Người dùng thật",
  "class RealUser extends User {",
  "  constructor(name, discount) {",
  "    super();",
  "    this.name = name; this.discount = discount;",
  "  }",
  "  getName()     { return this.name; }",
  "  getDiscount() { return this.discount; }",
  "}",
  "",
  "// NULL OBJECT — 'rỗng' nhưng vẫn hợp lệ",
  "class GuestUser extends User {",
  "  getName()     { return 'Khách'; }   // mặc định",
  "  getDiscount() { return 0; }         // an toàn",
  "}",
  "",
  "// Không thấy thì trả Null Object, KHÔNG trả null",
  "function findUser(id) {",
  "  return db.get(id) ?? new GuestUser();",
  "}",
]);

// ====== Tiện ích ======
function replay(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

// Đối tượng mà biến `user` đang trỏ tới, tuỳ mode + who
function currentObjKind() {
  if (app.who === "alice") return "real";                // luôn là RealUser
  return app.mode === "nullobject" ? "guest" : "null";   // khách: GuestUser hoặc null
}

// ====== Vẽ object ở giữa ======
function renderObj() {
  const kind = currentObjKind();
  userObj.classList.remove("is-real", "is-guest", "is-null", "broken");
  resultBox.className = "no-result";
  resultBox.textContent = "— chờ lời gọi —";
  arrow1.classList.remove("lit", "bad");
  arrow2.classList.remove("lit", "bad");

  if (kind === "real") {
    userObj.classList.add("is-real");
    objTitle.textContent = "RealUser";
    objBody.innerHTML = "name: <b>Alice</b> · discount: <b>20</b>";
    objBadge.textContent = "RealUser";
  } else if (kind === "guest") {
    userObj.classList.add("is-guest");
    objTitle.textContent = "GuestUser";
    objBody.innerHTML = "Null Object — trả mặc định an toàn";
    objBadge.textContent = "GuestUser (Null Object)";
  } else {
    userObj.classList.add("is-null");
    objTitle.textContent = "null";
    objBody.innerHTML = "không có đối tượng nào!";
    objBadge.textContent = "null ⚠️";
  }
}

// ====== Gọi method ======
function call(method) {
  const kind = currentObjKind();
  clientCall.textContent = `gọi user.${method}()`;
  replay(arrow1, "lit");

  // dựng code runtime dạy học
  const lines = [];
  if (kind === "null") {
    lines.push("let user = findUser(id);   // không dùng Null Object");
    lines.push("//   db.get(id) → không thấy → trả về null");
    lines.push(`user.${method}();`);
  } else {
    lines.push("let user = findUser(id) ?? new GuestUser();");
    if (kind === "real") {
      lines.push("//   db.get(id) → tìm thấy RealUser('Alice')");
    } else {
      lines.push("//   db.get(id) → không thấy → trả về GuestUser");
    }
    lines.push(`user.${method}();`);
  }

  if (kind === "null") {
    // VỠ: animation đỏ
    setTimeout(() => {
      arrow1.classList.add("bad");
      replay(userObj, "broken");
      arrow2.classList.add("bad");
      resultBox.className = "no-result err";
      resultBox.textContent = `💥 TypeError: Cannot read properties of null (reading '${method}')`;
    }, 220);
    lines.push(`//   ✗ null.${method}() — không có method để gọi`);
    lines.push("//   💥 TypeError: Cannot read properties of null");
    lines.push("//   → muốn an toàn phải bọc if (user != null)");
  } else {
    const src = kind === "real" ? REAL : GUEST;
    const val = method === "getName" ? `'${src.name}'` : src.discount;
    setTimeout(() => {
      replay(userObj, "pulse-ok");
      replay(arrow2, "lit");
      resultBox.className = "no-result ok";
      resultBox.textContent = `✓ trả về: ${method === "getName" ? src.name : src.discount + "%"}`;
    }, 220);
    lines.push(`//   ${kind === "real" ? "RealUser" : "GuestUser"}.${method}() → ${val}`);
    if (kind === "guest") lines.push("//   ✓ mặc định an toàn, KHÔNG cần if null");
    else lines.push("//   ✓ chạy bình thường");
  }

  renderCode(buildView, lines);
}

// ====== Chọn mode / user ======
function setMode(m) {
  app.mode = m;
  modeNO.classList.toggle("primary", m === "nullobject");
  modeNull.classList.toggle("primary", m === "plainnull");
  renderObj();
  hintIntro();
}

function setWho(w) {
  app.who = w;
  whoAlice.classList.toggle("good", w === "alice");
  whoGuest.classList.toggle("good", w === "guest");
  renderObj();
  hintIntro();
}

function hintIntro() {
  renderCode(buildView, [
    "// user trỏ tới: " + objBadge.textContent,
    "// Bấm user.getName() hoặc user.getDiscount()",
    "// để xem lời gọi chạy an toàn hay vỡ.",
  ]);
}

// ====== Sự kiện ======
modeNO.addEventListener("click",   () => setMode("nullobject"));
modeNull.addEventListener("click", () => setMode("plainnull"));
whoAlice.addEventListener("click", () => setWho("alice"));
whoGuest.addEventListener("click", () => setWho("guest"));
callName.addEventListener("click", () => call("getName"));
callDisc.addEventListener("click", () => call("getDiscount"));

// ====== Khởi tạo ======
setupTabs();
setMode("nullobject");
setWho("guest");
