// ===== Memento Pattern — minh hoạ động (trình soạn thảo Undo/Redo) =====
// Editor (Originator) tự đóng gói trạng thái vào một Memento bất biến qua save(),
// và tự đọc lại qua restore(). Caretaker chỉ giữ chồng memento như "hộp đen" —
// KHÔNG nhìn vào bên trong. Tách "ai tạo trạng thái" khỏi "ai lưu giữ" nó.

const WORDS = ["Head", "First", "Design", "Pattern", "Memento", "lưu",
  "trạng", "thái", "Undo", "Redo", "rất", "gọn"];

// ---- Originator: Editor ----
const editor = { words: [], bg: "#171c23", version: 0 };
let versionSeq = 0;            // bộ đếm để đặt tên phiên bản (v1, v2, ...)

// ---- Caretaker: hai ngăn xếp memento ----
const undoStack = [];
const redoStack = [];

// ---- DOM refs ----
const paper      = document.getElementById("paper");
const paperText  = document.getElementById("paperText");
const stackEl    = document.getElementById("stack");
const undoCount  = document.getElementById("undoCount");
const redoCount  = document.getElementById("redoCount");
const stateBadge = document.getElementById("stateBadge");
const buildView  = document.getElementById("buildView");
const classView  = document.getElementById("classView");
const btnUndo    = document.getElementById("btnUndo");
const btnRedo    = document.getElementById("btnRedo");

// ====== Code TAB 2: định nghĩa lớp (tĩnh) ======
renderCode(classView, [
  "// Memento — ảnh chụp BẤT BIẾN, chỉ Originator hiểu nội dung",
  "class Memento {",
  "  constructor(state) {",
  "    this._state = Object.freeze(state); // đóng băng",
  "  }",
  "  getState() { return this._state; }     // package-private",
  "}",
  "",
  "// Originator — biết cách tự lưu & tự khôi phục",
  "class Editor {",
  "  constructor() { this.words = []; this.bg = '#171c23'; }",
  "  type(w)  { this.words.push(w); }",
  "  erase()  { this.words.pop(); }",
  "  setBg(c) { this.bg = c; }",
  "  save() {                       // -> tạo Memento",
  "    return new Memento({ words: [...this.words], bg: this.bg });",
  "  }",
  "  restore(m) {                   // <- đọc lại từ Memento",
  "    const s = m.getState();",
  "    this.words = [...s.words]; this.bg = s.bg;",
  "  }",
  "}",
  "",
  "// Caretaker — chỉ giữ chồng memento, KHÔNG mở ra xem",
  "class Caretaker {",
  "  constructor() { this.undo = []; this.redo = []; }",
  "  backup(m) { this.undo.push(m); this.redo = []; }",
  "  undo()    { return this.undo.pop(); }",
  "  redo()    { return this.redo.pop(); }",
  "}",
]);

// ====== Code TAB 1: runtime ======
let buildLines = [];
function note(line) { buildLines.push(line); }
function flush() { renderCode(buildView, buildLines); }

// ====== Render sân khấu ======
function renderPaper(restoreFx) {
  paperText.textContent = editor.words.join(" ");
  paper.style.background = editor.bg;
  stateBadge.textContent = "v" + editor.version;
  replay(stateBadge, "flash");
  if (restoreFx) replay(paper, "flash-restore");
}

function preview(state) {
  const t = state.words.join(" ");
  return t.length ? t : "(trống)";
}

function renderStack(popping) {
  stackEl.innerHTML = "";
  if (undoStack.length === 0) {
    const e = document.createElement("div");
    e.className = "mm-empty";
    e.textContent = "Chưa có snapshot nào — hãy soạn thảo gì đó.";
    stackEl.appendChild(e);
  }
  undoStack.forEach((m, i) => {
    const s = m.getState();
    const card = document.createElement("div");
    card.className = "mm-card" + (i === undoStack.length - 1 ? " top" : "");
    card.innerHTML =
      `<span class="mm-swatch" style="background:${s.bg}"></span>` +
      `<span class="mm-tag">v${s.version}</span>` +
      `<span class="mm-prev">${esc(preview(s))}</span>`;
    stackEl.appendChild(card);
  });
  undoCount.textContent = undoStack.length;
  redoCount.textContent = redoStack.length;
  btnUndo.disabled = undoStack.length === 0;
  btnRedo.disabled = redoStack.length === 0;
}

function replay(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

// ====== Memento "lớp" thu nhỏ (runtime helpers) ======
function makeMemento(state) {
  return { getState: () => state };
}
function save() {
  return makeMemento({ words: [...editor.words], bg: editor.bg, version: editor.version });
}
function restore(m) {
  const s = m.getState();
  editor.words = [...s.words];
  editor.bg = s.bg;
  editor.version = s.version;
}

// ====== Thao tác soạn thảo ======
function commit(action, label) {
  buildLines = [];
  note("// 1) Cất trạng thái HIỆN TẠI vào Caretaker trước khi đổi");
  note("caretaker.backup( editor.save() );");
  undoStack.push(save());          // caretaker.backup(editor.save())
  redoStack.length = 0;            // mọi nhánh redo cũ bị bỏ
  note(`//    -> undo stack: ${undoStack.length} memento, redo bị xoá`);

  action();                        // áp dụng thay đổi lên editor
  editor.version = ++versionSeq;   // sang phiên bản mới
  note("// 2) Áp dụng thay đổi lên editor (Originator)");
  note(`editor.${label};   // -> phiên bản mới v${editor.version}`);

  renderPaper(false);
  renderStack();
  flush();
}

function typeWord() {
  const w = WORDS[editor.words.length % WORDS.length];
  commit(() => editor.words.push(w), `type("${w}")`);
}
function eraseWord() {
  if (editor.words.length === 0) return;
  const w = editor.words[editor.words.length - 1];
  commit(() => editor.words.pop(), `erase()   // bỏ "${w}"`);
}
function setBg(c) {
  highlightSwatch(c);
  commit(() => (editor.bg = c), `setBg("${c}")`);
}

// ====== Undo / Redo ======
function doUndo() {
  if (undoStack.length === 0) return;
  buildLines = [];
  note("// Đẩy trạng thái hiện tại sang redo để còn quay lại");
  note("caretaker.redo.push( editor.save() );");
  redoStack.push(save());
  note("// Lấy memento gần nhất ra & khôi phục");
  note("editor.restore( caretaker.undo() );");
  const m = undoStack.pop();
  restore(m);
  note(`//    -> editor quay về v${editor.version}`);
  renderPaper(true);
  renderStack();
  flush();
}

function doRedo() {
  if (redoStack.length === 0) return;
  buildLines = [];
  note("// Cất trạng thái hiện tại lại vào undo");
  note("caretaker.undo.push( editor.save() );");
  undoStack.push(save());
  note("// Khôi phục từ memento ở nhánh redo");
  note("editor.restore( caretaker.redo() );");
  const m = redoStack.pop();
  restore(m);
  note(`//    -> editor tiến tới v${editor.version}`);
  renderPaper(true);
  renderStack();
  flush();
}

// ====== Swatch màu ======
function highlightSwatch(c) {
  document.querySelectorAll(".swatch").forEach((s) =>
    s.classList.toggle("active", s.dataset.bg === c));
}

// ====== Sự kiện ======
document.getElementById("btnType").addEventListener("click", typeWord);
document.getElementById("btnErase").addEventListener("click", eraseWord);
btnUndo.addEventListener("click", doUndo);
btnRedo.addEventListener("click", doRedo);
document.getElementById("colorRow").addEventListener("click", (e) => {
  const sw = e.target.closest(".swatch");
  if (sw) setBg(sw.dataset.bg);
});

// ====== Khởi tạo ======
setupTabs();
highlightSwatch(editor.bg);
renderPaper(false);
renderStack();
renderCode(buildView, [
  "// editor (Originator) bắt đầu rỗng, v0.",
  "// Mỗi lần soạn thảo:",
  "//   caretaker.backup( editor.save() );",
  "// Mỗi lần Undo:",
  "//   editor.restore( caretaker.undo() );",
  "//",
  "// Hãy bấm 'Gõ thêm 1 từ' bên trái để bắt đầu.",
]);
