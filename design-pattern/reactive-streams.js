// ===== Reactive Streams (Observable) — minh hoạ động (kiểu RxJS) =====
// Observable phát ra một LUỒNG giá trị. Các toán tử filter/map KHÔNG sửa luồng gốc,
// mỗi cái trả về một Observable MỚI bọc luồng cũ. Chỉ khi subscribe() thì luồng mới
// thực sự chảy: giá trị đi qua filter → map → tới hàm next() của subscriber.

// ---- DOM refs ----
const received   = document.getElementById("received");
const pipe       = document.getElementById("pipe");
const valueEl    = document.getElementById("value");
const emitBadge  = document.getElementById("emitBadge");
const opFilter   = document.getElementById("opFilter");
const opMap      = document.getElementById("opMap");
const btnEmit    = document.getElementById("btnEmit");
const btnReset   = document.getElementById("btnReset");
const stageArea  = document.getElementById("stageArea");
const buildView  = document.getElementById("buildView");
const classView  = document.getElementById("classView");

const stations = {};
pipe.querySelectorAll(".rx-station").forEach((s) => { stations[s.dataset.st] = s; });

// nhãn "×10" nổi lên ở trạm map
const pop = document.createElement("div");
pop.className = "rx-pop";
stageArea.appendChild(pop);

// ====== Code TAB 2: định nghĩa lớp (tĩnh) ======
renderCode(classView, [
  "// Observable: bọc một hàm nhận observer, gọi observer.next(v)",
  "class Observable {",
  "  constructor(subscribeFn) { this._subscribe = subscribeFn; }",
  "  subscribe(observer) { return this._subscribe(observer); }",
  "",
  "  // map/filter trả về Observable MỚI bọc cái cũ (không sửa gốc)",
  "  pipe(...operators) {",
  "    return operators.reduce((src, op) => op(src), this);",
  "  }",
  "}",
  "",
  "// of(...): phát từng giá trị rồi complete",
  "function of(...values) {",
  "  return new Observable((observer) => {",
  "    values.forEach((v) => observer.next(v));",
  "    observer.complete && observer.complete();",
  "  });",
  "}",
  "",
  "// Toán tử = hàm nhận Observable nguồn, trả Observable mới",
  "const map = (fn) => (src) => new Observable((observer) =>",
  "  src.subscribe({ next: (v) => observer.next(fn(v)) }));",
  "",
  "const filter = (pred) => (src) => new Observable((observer) =>",
  "  src.subscribe({ next: (v) => { if (pred(v)) observer.next(v); } }));",
  "",
  "// Dùng:",
  "of(1, 2, 3, 4, 5)",
  "  .pipe(filter((x) => x % 2 === 0), map((x) => x * 10))",
  "  .subscribe({ next: (v) => console.log(v) }); // 20, 40",
]);

// ====== Code TAB 1: runtime ======
let buildLines = [];
function note(line) { buildLines.push(line); }
function flushBuild() { renderCode(buildView, buildLines); }

function resetBuild() {
  renderCode(buildView, [
    "// const stream$ = of(1,2,3,4,5).pipe(",
    "//   filter(x => x % 2 === 0),",
    "//   map(x => x * 10),",
    "// );",
    "// stream$.subscribe({ next: v => render(v) });",
    "//",
    "// Bấm 'Emit' để phát giá trị tiếp theo vào luồng.",
  ]);
}

// ====== Tiện ích ======
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function recvLine(html, cls) {
  const div = document.createElement("div");
  div.className = "log-line " + (cls || "");
  div.innerHTML = html;
  received.appendChild(div);
  received.scrollTop = received.scrollHeight;
}

function clearStations() {
  Object.values(stations).forEach((s) => s.classList.remove("active", "pulse"));
}

function syncOps() {
  stations.filter.classList.toggle("off", !opFilter.checked);
  stations.map.classList.toggle("off", !opMap.checked);
}

function moveValueTo(name) {
  const s = stations[name];
  const x = s.offsetLeft + s.offsetWidth / 2 - valueEl.offsetWidth / 2;
  valueEl.style.setProperty("--vx", `translateX(${x}px)`);
  valueEl.style.transform = `translateX(${x}px)`;
}

function setBadge(text) {
  emitBadge.textContent = text;
  emitBadge.classList.remove("flash"); void emitBadge.offsetWidth; emitBadge.classList.add("flash");
}

// ====== Trạng thái luồng ======
let n = 1;

async function emit() {
  btnEmit.disabled = true;
  const v = n;
  const useFilter = opFilter.checked;
  const useMap = opMap.checked;
  clearStations();

  buildLines = [`// observer.next(${v})  — Observable phát giá trị ${v}`];
  flushBuild();
  setBadge(`next phát ra: ${v}`);

  // 1) tại source
  valueEl.className = "rx-value show";
  valueEl.textContent = v;
  moveValueTo("source");
  stations.source.classList.add("active", "pulse");
  await sleep(420);

  // 2) qua filter
  moveValueTo("filter");
  stations.filter.classList.add("active", "pulse");
  await sleep(420);
  if (useFilter) {
    if (v % 2 !== 0) {
      note(`//   filter: ${v} % 2 === 0 ? false → LOẠI BỎ (không phát tiếp)`);
      flushBuild();
      recvLine(`<span class="rx-skip">filter loại ${v} (lẻ) — subscriber không nhận</span>`, "rx-skip");
      valueEl.classList.add("dropped");
      setBadge(`${v} bị filter loại`);
      await sleep(550);
      n++; btnEmit.disabled = false;
      return;
    }
    note(`//   filter: ${v} % 2 === 0 ? true → cho qua`);
  } else {
    note(`//   filter: (đang TẮT) → ${v} cho qua`);
  }
  flushBuild();

  // 3) qua map
  moveValueTo("map");
  stations.map.classList.add("active", "pulse");
  await sleep(420);
  let out = v;
  if (useMap) {
    out = v * 10;
    note(`//   map: ${v} → ${v} * 10 = ${out}`);
    // hiệu ứng ×10
    pop.textContent = `${v} × 10 = ${out}`;
    const mx = stations.map.offsetLeft + stations.map.offsetWidth / 2 - 40;
    pop.style.left = mx + "px";
    pop.classList.remove("go"); void pop.offsetWidth; pop.classList.add("go");
    valueEl.classList.add("mapped");
    valueEl.textContent = out;
  } else {
    note(`//   map: (đang TẮT) → giữ nguyên ${out}`);
  }
  flushBuild();
  await sleep(520);

  // 4) tới subscriber
  moveValueTo("subscriber");
  stations.subscriber.classList.add("active", "pulse");
  valueEl.classList.add("delivered");
  note(`//   subscriber.next(${out})  ✓ nhận giá trị`);
  flushBuild();
  recvLine(`<span class="rx-emit">next(${out}) ✓</span>`, "rx-emit");
  setBadge(`subscriber nhận: ${out}`);
  await sleep(500);

  n++;
  btnEmit.disabled = false;
}

function resetStream() {
  n = 1;
  received.innerHTML = '<div class="log-line muted-line">next() chưa được gọi lần nào…</div>';
  valueEl.className = "rx-value";
  valueEl.textContent = "1";
  clearStations();
  setBadge("next phát ra: 1");
  resetBuild();
}

btnEmit.addEventListener("click", emit);
btnReset.addEventListener("click", resetStream);
opFilter.addEventListener("change", syncOps);
opMap.addEventListener("change", syncOps);

// ====== Khởi tạo ======
setupTabs();
resetBuild();
syncOps();
setBadge("next phát ra: 1");
