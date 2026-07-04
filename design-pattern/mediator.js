// ===== Mediator — minh hoạ động (phòng chat) =====
// Mỗi thành viên (Colleague) CHỈ giữ tham chiếu tới mediator, không biết ai khác.
// Khi Alice gửi: alice.send(msg) -> mediator.send(msg, alice) -> mediator phát
// cho TẤT CẢ thành viên còn lại. Logic "ai nói với ai" gom hết về ChatRoom.

const NAMES = { A: "Alice", B: "Bob", C: "Carol", D: "Dave" };
const VAR   = { A: "alice", B: "bob", C: "carol", D: "dave" };
const SAMPLE = {
  A: "Chào cả nhà!", B: "Có ai online không?",
  C: "Họp lúc 3h nhé", D: "Ok, đã rõ 👍",
};

// ---- DOM refs ----
const hubWrap    = document.getElementById("hubWrap");
const edgesEl    = document.getElementById("edges");
const mediatorEl = document.getElementById("mediator");
const bubble     = document.getElementById("bubble");
const statusBadge= document.getElementById("statusBadge");
const log        = document.getElementById("log");
const buildView  = document.getElementById("buildView");
const classView  = document.getElementById("classView");

const memberEls = {};
document.querySelectorAll(".member").forEach((el) => { memberEls[el.dataset.id] = el; });

// ====== Code TAB 2: định nghĩa lớp (tĩnh) ======
renderCode(classView, [
  "// Mediator — đầu mối duy nhất biết tất cả thành viên",
  "class ChatMediator {",
  "  send(msg, sender) {}",
  "}",
  "",
  "class ChatRoom extends ChatMediator {",
  "  constructor() { super(); this.members = []; }",
  "  register(member) {        // thêm thành viên mới",
  "    this.members.push(member);",
  "    member.room = this;",
  "  }",
  "  send(msg, sender) {",
  "    for (const m of this.members) {",
  "      if (m !== sender) m.receive(msg, sender); // phát cho mọi người TRỪ người gửi",
  "    }",
  "  }",
  "}",
  "",
  "// Colleague — CHỈ biết mediator, không biết thành viên khác",
  "class User {",
  "  constructor(name) { this.name = name; this.room = null; }",
  "  send(msg)  { this.room.send(msg, this); }   // nói qua trung gian",
  "  receive(msg, from) {",
  "    console.log(`${this.name} nhận: \"${msg}\" (từ ${from.name})`);",
  "  }",
  "}",
  "",
  "const room = new ChatRoom();",
  "const alice = new User('Alice'), bob = new User('Bob');",
  "const carol = new User('Carol'), dave = new User('Dave');",
  "[alice, bob, carol, dave].forEach(u => room.register(u));",
]);

// ====== Code TAB 1: runtime ======
function flushBuild(lines) { renderCode(buildView, lines); }

// ====== vẽ cạnh member ↔ mediator ======
function centerOf(el) {
  const r = el.getBoundingClientRect();
  const w = hubWrap.getBoundingClientRect();
  return { x: r.left - w.left + r.width / 2, y: r.top - w.top + r.height / 2 };
}
const edgeEls = {};
function drawEdges() {
  edgesEl.innerHTML = "";
  const c = centerOf(mediatorEl);
  Object.keys(memberEls).forEach((id) => {
    const m = centerOf(memberEls[id]);
    const dx = c.x - m.x, dy = c.y - m.y;
    const len = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx) * 180 / Math.PI;
    const e = document.createElement("div");
    e.className = "edge";
    e.style.left = m.x + "px";
    e.style.top = m.y + "px";
    e.style.width = len + "px";
    e.style.transform = `rotate(${ang}deg)`;
    edgesEl.appendChild(e);
    edgeEls[id] = e;
  });
}

// ====== tiện ích ======
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function logLine(msg, kind) {
  const div = document.createElement("div");
  div.className = "log-line" + (kind === "muted" ? " muted-line" : "");
  if (kind === "good") div.style.color = "var(--good)";
  if (kind === "send") div.style.color = "var(--accent)";
  div.textContent = msg;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}
function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
function moveBubble(p) {
  bubble.style.left = p.x + "px";
  bubble.style.top = p.y + "px";
}

function clearGlow() {
  Object.values(memberEls).forEach((el) => el.classList.remove("sender", "recv"));
  mediatorEl.classList.remove("active");
  Object.values(edgeEls).forEach((e) => e.classList.remove("lit-up", "lit-down"));
}

// ====== send: chạy tin nhắn qua mediator ======
let running = false;

async function send(fromId) {
  if (running) return;
  running = true;
  clearGlow();

  const msg = SAMPLE[fromId];
  const others = Object.keys(memberEls).filter((id) => id !== fromId);

  // tab Runtime: dựng kịch bản
  const lines = [
    `${VAR[fromId]}.send("${msg}");`,
    `//  -> room.send("${msg}", ${VAR[fromId]})`,
    `//  ChatRoom lặp members, bỏ qua người gửi:`,
  ];
  flushBuild(lines);

  // 1) sender -> mediator
  statusBadge.textContent = `${NAMES[fromId]} đang gửi…`;
  statusBadge.className = "state-badge send";
  memberEls[fromId].classList.add("sender");
  edgeEls[fromId].classList.add("lit-up");
  bubble.classList.remove("recv");
  bubble.style.opacity = "1";
  moveBubble(centerOf(memberEls[fromId]));
  await sleep(60);
  moveBubble(centerOf(mediatorEl));
  await sleep(440);

  // 2) mediator nhận
  mediatorEl.classList.add("active");
  replay(mediatorEl, "pulse");
  logLine(`${NAMES[fromId]} → ChatRoom: "${msg}"`, "send");
  await sleep(360);

  // 3) mediator -> từng thành viên còn lại
  statusBadge.textContent = "ChatRoom đang phát…";
  statusBadge.className = "state-badge recv";
  bubble.classList.add("recv");
  for (const id of others) {
    edgeEls[id].classList.add("lit-down");
    moveBubble(centerOf(mediatorEl));
    await sleep(40);
    moveBubble(centerOf(memberEls[id]));
    await sleep(380);
    memberEls[id].classList.add("recv");
    replay(memberEls[id], "pulse");
    logLine(`ChatRoom → ${NAMES[id]}: "${msg}"`, "good");
    lines.push(`//  ${VAR[id]}.receive("${msg}", from=${NAMES[fromId]})`);
    flushBuild(lines);
  }

  bubble.style.opacity = "0";
  statusBadge.textContent = `Đã phát cho ${others.length} người`;
  running = false;
}

// ====== sự kiện ======
document.querySelectorAll(".btn[data-from]").forEach((b) => {
  b.addEventListener("click", () => send(b.dataset.from));
});
document.getElementById("btnReset").addEventListener("click", () => {
  if (running) return;
  clearGlow();
  bubble.style.opacity = "0";
  log.innerHTML = '<div class="log-line muted-line">Bấm một thành viên để gửi tin nhắn…</div>';
  statusBadge.textContent = "Chưa có tin nhắn";
  statusBadge.className = "state-badge";
  initBuild();
});

// ====== khởi tạo ======
function initBuild() {
  flushBuild([
    "// Mỗi User chỉ biết 'room' (mediator).",
    "// Bấm một thành viên bên trái để gửi:",
    "//",
    "//   alice.send(\"Chào cả nhà!\");",
    "//     -> room.send(msg, alice)",
    "//       -> phát cho bob, carol, dave",
  ]);
}
setupTabs();
drawEdges();
initBuild();
window.addEventListener("resize", drawEdges);
