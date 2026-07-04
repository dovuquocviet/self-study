// ===== Interpreter — minh hoạ động (thông dịch biểu thức số học) =====
// Một biểu thức như "5 + 3 * 2" được phân tích thành CÂY cú pháp (AST).
// Mỗi nút là một Expression biết tự interpret():
//   - NumberExpression (lá / terminal)        -> trả về số
//   - Add/Subtract/Multiply (nút / nonterminal) -> gộp kết quả các con
// Đánh giá = gọi interpret() đệ quy, lan TỪ LÁ LÊN GỐC.

const OP_CLASS = { "+": "Add", "-": "Subtract", "*": "Multiply" };
const OP_FN    = { "+": (a, b) => a + b, "-": (a, b) => a - b, "*": (a, b) => a * b };

// ---- DOM refs ----
const exprLine   = document.getElementById("exprLine");
const treeEl     = document.getElementById("tree");
const resultBadge= document.getElementById("resultBadge");
const log        = document.getElementById("log");
const buildView  = document.getElementById("buildView");
const classView  = document.getElementById("classView");
const btnEval    = document.getElementById("btnEval");

// ====== Code TAB 2: định nghĩa lớp (tĩnh) ======
renderCode(classView, [
  "// Interface chung — mọi biểu thức biết tự interpret()",
  "class Expression {",
  "  interpret() {}",
  "}",
  "",
  "// Biểu thức TERMINAL (lá): chỉ là một con số",
  "class NumberExpression extends Expression {",
  "  constructor(value) { super(); this.value = value; }",
  "  interpret() { return this.value; }",
  "}",
  "",
  "// Biểu thức NONTERMINAL (nút): chứa 2 biểu thức con",
  "class Add extends Expression {",
  "  constructor(left, right) { super(); this.left = left; this.right = right; }",
  "  interpret() {",
  "    return this.left.interpret() + this.right.interpret();",
  "  }",
  "}",
  "class Subtract extends Expression {",
  "  constructor(left, right) { super(); this.left = left; this.right = right; }",
  "  interpret() {",
  "    return this.left.interpret() - this.right.interpret();",
  "  }",
  "}",
  "class Multiply extends Expression {",
  "  constructor(left, right) { super(); this.left = left; this.right = right; }",
  "  interpret() {",
  "    return this.left.interpret() * this.right.interpret();",
  "  }",
  "}",
]);

// ====== Code TAB 1: runtime ======
let buildLines = [];
function flushBuild() { renderCode(buildView, buildLines); }

// ====== Parser: chuỗi -> AST ======
// Văn phạm:  expr := term (('+'|'-') term)*
//            term := factor (('*'|'/') factor)*
//            factor := number | '(' expr ')'
function parse(str) {
  const tokens = str.trim().split(/\s+/);
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function factor() {
    if (peek() === "(") {
      next();                 // '('
      const e = expr();
      next();                 // ')'
      return e;
    }
    return { type: "num", value: parseInt(next(), 10) };
  }
  function term() {
    let node = factor();
    while (peek() === "*") {
      const op = next();
      node = { type: "op", op, left: node, right: factor() };
    }
    return node;
  }
  function expr() {
    let node = term();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      node = { type: "op", op, left: node, right: term() };
    }
    return node;
  }
  return expr();
}

// chuỗi khởi tạo đối tượng AST (cho tab Runtime)
function buildExpr(node) {
  if (node.type === "num") return `new Number(${node.value})`;
  return `new ${OP_CLASS[node.op]}(${buildExpr(node.left)}, ${buildExpr(node.right)})`;
}

// ====== Layout + render cây ======
let astRoot = null;

function layout(node) {
  // gán inorder index (cho x) + depth (cho y)
  let idx = 0;
  let maxDepth = 0;
  (function walk(n, depth) {
    if (n.left) walk(n.left, depth + 1);
    n._ix = idx++;
    n._depth = depth;
    maxDepth = Math.max(maxDepth, depth);
    if (n.right) walk(n.right, depth + 1);
  })(node, 0);
  node._count = idx;
  node._maxDepth = maxDepth;
}

function renderTree(node) {
  treeEl.innerHTML = "";
  layout(node);
  const W = treeEl.clientWidth || 400;
  const H = treeEl.clientHeight || 300;
  const N = node._count, D = node._maxDepth;
  const px = (n) => ((n._ix + 0.5) / N) * W;
  const py = (n) => ((n._depth + 0.5) / (D + 1)) * H;

  // vẽ cạnh trước (nằm dưới)
  (function edges(n) {
    [n.left, n.right].forEach((c) => {
      if (!c) return;
      const x1 = px(n), y1 = py(n), x2 = px(c), y2 = py(c);
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx) * 180 / Math.PI;
      const edge = document.createElement("div");
      edge.className = "edge";
      edge.style.left = x1 + "px";
      edge.style.top = y1 + "px";
      edge.style.width = len + "px";
      edge.style.transform = `rotate(${ang}deg)`;
      treeEl.appendChild(edge);
      c._edgeEl = edge;        // cạnh nối c với cha của nó
      edges(c);
    });
  })(node);

  // vẽ nút
  (function nodes(n) {
    const el = document.createElement("div");
    el.className = "ast-node " + (n.type === "num" ? "leaf" : "op");
    el.style.left = px(n) + "px";
    el.style.top = py(n) + "px";
    if (n.type === "num") {
      el.innerHTML = `${n.value}<small>Number</small>`;
    } else {
      el.innerHTML = `${n.op}<small>${OP_CLASS[n.op]}</small>`;
    }
    n._el = el;
    treeEl.appendChild(el);
    if (n.left) nodes(n.left);
    if (n.right) nodes(n.right);
  })(node);
}

// ====== tiện ích ======
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function logLine(msg, kind) {
  const div = document.createElement("div");
  div.className = "log-line" + (kind === "muted" ? " muted-line" : "");
  if (kind === "good") div.style.color = "var(--good)";
  div.textContent = msg;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}
function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

// ====== interpret() có hoạt hình (post-order: lá -> gốc) ======
let running = false;

async function evalNode(node) {
  if (node.type === "num") {
    node._el.classList.add("active");
    replay(node._el, "pulse");
    await sleep(420);
    node._el.classList.remove("active");
    node._el.classList.add("done");
    node._el.innerHTML = `${node.value}<small>Number</small><span class="val">= ${node.value}</span>`;
    if (node._edgeEl) node._edgeEl.classList.add("lit");
    logLine(`Number(${node.value}).interpret() = ${node.value}`);
    buildLines.push(`//  Number(${node.value}).interpret() -> ${node.value}`);
    flushBuild();
    return node.value;
  }
  // nonterminal: tính con trái rồi con phải
  const l = await evalNode(node.left);
  const r = await evalNode(node.right);
  node._el.classList.add("active");
  replay(node._el, "pulse");
  await sleep(420);
  const v = OP_FN[node.op](l, r);
  node._el.classList.remove("active");
  node._el.classList.add("done");
  node._el.innerHTML = `${node.op}<small>${OP_CLASS[node.op]}</small><span class="val">= ${v}</span>`;
  if (node._edgeEl) node._edgeEl.classList.add("lit");
  logLine(`${OP_CLASS[node.op]}(${l}, ${r}).interpret() = ${l} ${node.op} ${r} = ${v}`, "good");
  buildLines.push(`//  ${OP_CLASS[node.op]}.interpret(): ${l} ${node.op} ${r} = ${v}`);
  flushBuild();
  return v;
}

async function evaluate() {
  if (running || !astRoot) return;
  running = true;
  btnEval.disabled = true;
  renderTree(astRoot);            // vẽ lại sạch
  resultBadge.textContent = "= ?";
  resultBadge.classList.remove("done");
  log.innerHTML = "";
  buildLines = [
    "// Dựng cây cú pháp từ biểu thức:",
    `const ast = ${buildExpr(astRoot)};`,
    "const result = ast.interpret();   // lan từ lá lên gốc",
    "//",
  ];
  flushBuild();

  const result = await evaluate_root();
  resultBadge.textContent = "= " + result;
  resultBadge.classList.add("done");
  buildLines.push(`//  => result = ${result}`);
  flushBuild();
  running = false;
  btnEval.disabled = false;
}
async function evaluate_root() { return evalNode(astRoot); }

// ====== chọn biểu thức ======
function setExpr(str) {
  exprLine.textContent = str;
  astRoot = parse(str);
  renderTree(astRoot);
  resultBadge.textContent = "= ?";
  resultBadge.classList.remove("done");
  log.innerHTML = '<div class="log-line muted-line">Bấm interpret() để đánh giá cây…</div>';
  buildLines = [
    "// Cây cú pháp đã dựng xong:",
    `const ast = ${buildExpr(astRoot)};`,
    "// Bấm 🌳 interpret() để chạy.",
  ];
  flushBuild();
}

// ====== sự kiện ======
document.querySelectorAll(".chip-expr").forEach((b) => {
  b.addEventListener("click", () => {
    if (running) return;
    document.querySelectorAll(".chip-expr").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    setExpr(b.dataset.expr);
  });
});
btnEval.addEventListener("click", evaluate);
document.getElementById("btnReset").addEventListener("click", () => {
  if (running) return;
  setExpr(exprLine.textContent);
});

// ====== khởi tạo ======
setupTabs();
setExpr("5 + 3 * 2");
