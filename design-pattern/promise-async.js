// ===== Promise / Async — minh hoạ động (vòng đời + chuỗi then/catch) =====
// Promise đi qua ĐÚNG MỘT LẦN: pending → fulfilled | rejected (settle xong là khoá).
// Mỗi .then nhận giá trị mắt trước trả về và trả giá trị cho mắt sau. Khi rejected,
// các .then (chỉ có onFulfilled) bị BỎ QUA, lỗi nhảy tới .catch. Callback chạy ở
// MICROTASK QUEUE — sau khi code đồng bộ hiện tại kết thúc.

// ---- DOM refs ----
const log        = document.getElementById("log");
const promiseEl  = document.getElementById("promise");
const prState    = document.getElementById("prState");
const prVal      = document.getElementById("prVal");
const prBadge    = document.getElementById("prBadge");
const chain      = document.getElementById("chain");
const btnResolve = document.getElementById("btnResolve");
const btnReject  = document.getElementById("btnReject");
const btnAddThen = document.getElementById("btnAddThen");
const btnReset   = document.getElementById("btnReset");
const buildView  = document.getElementById("buildView");
const classView  = document.getElementById("classView");

const MAX_THENS = 4;
let thenCount = 2;
let settled = null;     // null | "fulfilled" | "rejected"

// ====== Code TAB 2: định nghĩa lớp (tĩnh) ======
renderCode(classView, [
  "// 3 trạng thái — settle xong thì KHÓA, không đổi nữa",
  "const PENDING = 'pending', FULFILLED = 'fulfilled', REJECTED = 'rejected';",
  "",
  "class MyPromise {",
  "  constructor(executor) {",
  "    this.state = PENDING; this.value = undefined;",
  "    this.cbs = [];   // các callback chờ microtask",
  "    const settle = (state, v) => {",
  "      if (this.state !== PENDING) return;   // chỉ settle 1 lần",
  "      this.state = state; this.value = v;",
  "      queueMicrotask(() => this.cbs.forEach(run => run())); // ← microtask",
  "    };",
  "    executor(v => settle(FULFILLED, v), e => settle(REJECTED, e));",
  "  }",
  "",
  "  // then trả về Promise MỚI → cho phép xâu chuỗi",
  "  then(onOk, onErr) {",
  "    return new MyPromise((res, rej) => {",
  "      const run = () => {",
  "        try {",
  "          if (this.state === FULFILLED) res(onOk ? onOk(this.value) : this.value);",
  "          else                          (onErr ? res(onErr(this.value)) : rej(this.value));",
  "        } catch (e) { rej(e); }",
  "      };",
  "      this.state === PENDING ? this.cbs.push(run) : queueMicrotask(run);",
  "    });",
  "  }",
  "  catch(onErr) { return this.then(null, onErr); }",
  "}",
]);

// ====== Code TAB 1: runtime ======
let buildLines = [];
function note(line) { buildLines.push(line); }
function flushBuild() { renderCode(buildView, buildLines); }

function chainSource() {
  const lines = ["fetchData()"];
  for (let i = 0; i < thenCount; i++) lines.push("  .then(v => v + 1)");
  lines.push("  .catch(e => 'fallback');");
  lines.push("");
  lines.push("// async/await tương đương:");
  lines.push("async function run() {");
  lines.push("  try {");
  lines.push("    let v = await fetchData();");
  for (let i = 0; i < thenCount; i++) lines.push("    v = v + 1;");
  lines.push("    return v;");
  lines.push("  } catch (e) { return 'fallback'; }");
  lines.push("}");
  return lines;
}
function resetBuild() { renderCode(buildView, chainSource()); }

// ====== Tiện ích ======
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function logLine(html, cls) {
  const div = document.createElement("div");
  div.className = "log-line " + (cls || "");
  div.innerHTML = html;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function setBadge(text, kind) {
  prBadge.textContent = text;
  prBadge.style.borderColor = kind === "bad" ? "#ff7a7a" : kind === "good" ? "var(--good)" : "var(--accent)";
  prBadge.style.color       = kind === "bad" ? "#ff9b9b" : kind === "good" ? "var(--good)" : "var(--accent)";
  prBadge.classList.remove("flash"); void prBadge.offsetWidth; prBadge.classList.add("flash");
}

// Dựng lại chuỗi .then + .catch
function buildChain() {
  chain.innerHTML = "";
  for (let i = 0; i < thenCount; i++) {
    if (i > 0) addConn();
    const el = document.createElement("div");
    el.className = "pr-link";
    el.dataset.then = i;
    el.innerHTML = `<b>.then #${i + 1}</b><span>v =&gt; v + 1</span><span class="pr-pass">·</span>`;
    chain.appendChild(el);
  }
  addConn();
  const c = document.createElement("div");
  c.className = "pr-link catch";
  c.id = "catchLink";
  c.innerHTML = `<b>.catch</b><span>e =&gt; 'fallback'</span><span class="pr-pass">·</span>`;
  chain.appendChild(c);
}
function addConn() {
  const s = document.createElement("span");
  s.className = "pr-conn"; s.textContent = "→";
  chain.appendChild(s);
}

function lockButtons(locked) {
  btnResolve.disabled = locked;
  btnReject.disabled = locked;
  btnAddThen.disabled = locked || thenCount >= MAX_THENS;
}

// ====== Hành động ======
async function doResolve() {
  if (settled) return;
  settled = "fulfilled";
  lockButtons(true);
  log.innerHTML = "";

  buildLines = chainSource();
  note(""); note("// ── chạy ──");
  note(`// [sync]  gọi fetchData() → trả Promise(pending)`);
  flushBuild();
  logLine(`<span class="pr-sync">[sync] fetchData() → Promise &lt;pending&gt;</span>`, "pr-sync");
  await sleep(450);

  // settle
  let value = 1;
  promiseEl.classList.remove("pending", "rejected");
  promiseEl.classList.add("fulfilled");
  prState.textContent = "fulfilled";
  prVal.textContent = value;
  setBadge("PromiseState: fulfilled", "good");
  note(`// [settle] resolve(${value}) → state = fulfilled`);
  flushBuild();
  logLine(`<span class="pr-sync">[settle] resolve(${value}) → fulfilled</span>`, "pr-sync");
  await sleep(550);

  // chạy từng then như microtask
  const thens = chain.querySelectorAll(".pr-link[data-then]");
  for (const el of thens) {
    const before = value;
    value = value + 1;
    el.classList.add("lit");
    el.querySelector(".pr-pass").textContent = `${before} → ${value}`;
    note(`// [microtask] .then #${+el.dataset.then + 1}: ${before} → ${value}`);
    flushBuild();
    logLine(`<span class="pr-micro">[microtask] .then #${+el.dataset.then + 1}: nhận ${before}, trả ${value}</span>`, "pr-micro");
    await sleep(600);
  }

  // catch bị bỏ qua
  const catchLink = document.getElementById("catchLink");
  catchLink.classList.add("skip");
  note(`// [microtask] .catch BỎ QUA (không có lỗi)`);
  note(`// ⇒ giá trị cuối: ${value}`);
  flushBuild();
  logLine(`<span class="pr-micro">[done] .catch không chạy — giá trị cuối: ${value}</span>`, "pr-micro");
  prVal.textContent = value;
}

async function doReject() {
  if (settled) return;
  settled = "rejected";
  lockButtons(true);
  log.innerHTML = "";

  buildLines = chainSource();
  note(""); note("// ── chạy ──");
  note(`// [sync]  gọi fetchData() → trả Promise(pending)`);
  flushBuild();
  logLine(`<span class="pr-sync">[sync] fetchData() → Promise &lt;pending&gt;</span>`, "pr-sync");
  await sleep(450);

  promiseEl.classList.remove("pending", "fulfilled");
  promiseEl.classList.add("rejected");
  prState.textContent = "rejected";
  prVal.textContent = "Error";
  setBadge("PromiseState: rejected", "bad");
  note(`// [settle] reject(Error) → state = rejected`);
  flushBuild();
  logLine(`<span class="pr-err">[settle] reject(Error) → rejected</span>`, "pr-err");
  await sleep(550);

  // tất cả then bị bỏ qua
  const thens = chain.querySelectorAll(".pr-link[data-then]");
  for (const el of thens) {
    el.classList.add("skip");
    note(`// [microtask] .then #${+el.dataset.then + 1}: bỏ qua (không có onRejected) → chuyển lỗi tiếp`);
    flushBuild();
    logLine(`<span class="pr-err">[microtask] .then #${+el.dataset.then + 1}: bỏ qua, đẩy lỗi xuống</span>`, "pr-err");
    await sleep(420);
  }

  // catch bắt lỗi
  const catchLink = document.getElementById("catchLink");
  catchLink.classList.add("lit");
  catchLink.querySelector(".pr-pass").textContent = `Error → 'fallback'`;
  note(`// [microtask] .catch bắt Error → trả 'fallback'`);
  note(`// ⇒ Promise hồi phục, giá trị cuối: 'fallback'`);
  flushBuild();
  logLine(`<span class="pr-micro">[microtask] .catch bắt Error → 'fallback' ✓</span>`, "pr-micro");
}

function addThen() {
  if (settled || thenCount >= MAX_THENS) return;
  thenCount++;
  buildChain();
  lockButtons(false);
  resetBuild();
}

function reset() {
  settled = null;
  promiseEl.classList.remove("fulfilled", "rejected");
  promiseEl.classList.add("pending");
  prState.textContent = "pending";
  prVal.textContent = "?";
  log.innerHTML = '<div class="log-line muted-line">Promise đang pending… bấm resolve hoặc reject.</div>';
  buildChain();
  lockButtons(false);
  setBadge("PromiseState: pending", "normal");
  resetBuild();
}

btnResolve.addEventListener("click", doResolve);
btnReject.addEventListener("click", doReject);
btnAddThen.addEventListener("click", addThen);
btnReset.addEventListener("click", reset);

// ====== Khởi tạo ======
setupTabs();
buildChain();
lockButtons(false);
setBadge("PromiseState: pending", "normal");
resetBuild();
