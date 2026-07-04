// ===== Pub/Sub (Event Bus) — minh hoạ động =====
// Publisher KHÔNG biết subscriber nào. Nó publish(topic, data) vào EventBus.
// Bus tra map topic -> handlers rồi gọi đúng những ai đã subscribe topic đó.

const TOPICS = ["order", "payment", "user"];
const SUBSCRIBERS = [
  { key: "inventory", name: "📦 Inventory", subs: ["order"] },
  { key: "emailer",   name: "✉️ Emailer",   subs: ["order", "user"] },
  { key: "analytics", name: "📊 Analytics", subs: ["order", "payment", "user"] },
];

// ---- EventBus runtime (chính là pattern) ----
const bus = {
  map: {},  // topic -> Set(subscriberKey)
  subscribe(topic, key)   { (this.map[topic] ||= new Set()).add(key); },
  unsubscribe(topic, key) { this.map[topic]?.delete(key); },
  handlers(topic)         { return [...(this.map[topic] || [])]; },
};

let selectedTopic = "order";

// ---- DOM ----
const log       = document.getElementById("log");
const stage     = document.getElementById("stageArea");
const busNode   = document.getElementById("busNode");
const pubNode   = document.getElementById("pubNode");
const subGrid   = document.getElementById("subGrid");
const buildView = document.getElementById("buildView");
const classView = document.getElementById("classView");

// ====== TAB 2: định nghĩa lớp ======
renderCode(classView, [
  "// EventBus — broker trung gian giữ map topic -> handlers",
  "class EventBus {",
  "  constructor() { this.topics = {}; }",
  "",
  "  subscribe(topic, handler) {",
  "    (this.topics[topic] ||= []).push(handler);",
  "    return () => this.unsubscribe(topic, handler); // huỷ",
  "  }",
  "",
  "  unsubscribe(topic, handler) {",
  "    const hs = this.topics[topic] || [];",
  "    this.topics[topic] = hs.filter(h => h !== handler);",
  "  }",
  "",
  "  publish(topic, data) {",
  "    (this.topics[topic] || []).forEach(h => h(data));",
  "    // publisher KHÔNG biết h là ai — chỉ gọi theo topic",
  "  }",
  "}",
  "",
  "// Dùng:",
  "const bus = new EventBus();",
  "bus.subscribe('order', d => inventory.reserve(d));",
  "bus.subscribe('order', d => emailer.sendReceipt(d));",
  "bus.publish('order', { id: 42 }); // cả 2 handler chạy",
]);

// ====== TAB 1: runtime ======
function renderBuild(topic, receivers) {
  const lines = [
    "// Đăng ký (mỗi subscriber tự subscribe topic nó cần):",
  ];
  SUBSCRIBERS.forEach((s) => {
    s.subs.forEach((t) =>
      lines.push(`bus.subscribe('${t}', ${s.key}.handle);`));
  });
  lines.push("");
  if (topic) {
    lines.push(`bus.publish('${topic}', data);`);
    lines.push(`//  -> tra topics['${topic}'] = [${receivers.map((r)=>r.key).join(", ") || "(rỗng)"}]`);
    if (receivers.length === 0) {
      lines.push("//  -> không ai subscribe → không handler nào chạy");
    } else {
      receivers.forEach((r) =>
        lines.push(`//  -> ${r.key}.handle(data)  // ${r.name}`));
    }
    lines.push("//  Publisher không hề biết các tên trên.");
  } else {
    lines.push("// Bấm publish để bus phân phát theo topic.");
  }
  renderCode(buildView, lines);
}

// ====== tiện ích ======
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

// vị trí tâm node (so với stage)
function center(el) { return { x: el.offsetLeft, y: el.offsetTop }; }

// tạo 1 dot bay từ (a) tới (b), gọi onArrive khi tới
function flyDot(from, to, topic, onArrive) {
  const dot = document.createElement("div");
  dot.className = "msg-dot dot-" + topic;
  dot.style.left = from.x + "px";
  dot.style.top  = from.y + "px";
  stage.appendChild(dot);
  void dot.offsetWidth;             // ép reflow để transition chạy
  dot.style.left = to.x + "px";
  dot.style.top  = to.y + "px";
  setTimeout(() => { onArrive && onArrive(); dot.remove(); }, 460);
}

// ====== render bảng subscribe ở cột trái + chip trong node ======
function renderSubChips() {
  SUBSCRIBERS.forEach((s) => {
    const box = document.getElementById("topics_" + s.key);
    box.innerHTML = "";
    TOPICS.forEach((t) => {
      const span = document.createElement("span");
      span.className = "t" + (s.subs.includes(t) ? " on" : "");
      span.textContent = t;
      box.appendChild(span);
    });
    const node = document.getElementById("sub_" + s.key);
    node.classList.toggle("idle", s.subs.length === 0);
  });
}

function renderSubGrid() {
  subGrid.innerHTML = "";
  SUBSCRIBERS.forEach((s) => {
    const row = document.createElement("div");
    row.className = "sub-line";
    const who = document.createElement("span");
    who.className = "who"; who.textContent = s.name;
    const toggles = document.createElement("span");
    toggles.className = "toggles";
    TOPICS.forEach((t) => {
      const b = document.createElement("button");
      b.className = "sub-toggle" + (s.subs.includes(t) ? " on" : "");
      b.textContent = t;
      b.addEventListener("click", () => toggleSub(s, t));
      toggles.appendChild(b);
    });
    row.appendChild(who); row.appendChild(toggles);
    subGrid.appendChild(row);
  });
}

function toggleSub(s, topic) {
  const i = s.subs.indexOf(topic);
  if (i === -1) {
    s.subs.push(topic);
    bus.subscribe(topic, s.key);
    logLine(`${s.name} subscribe('${topic}')`, "good");
  } else {
    s.subs.splice(i, 1);
    bus.unsubscribe(topic, s.key);
    logLine(`${s.name} unsubscribe('${topic}')`, "bad");
  }
  renderSubGrid();
  renderSubChips();
  renderBuild(null, []);
}

// ====== publish: dot bay pub→bus, rồi bus→từng subscriber của topic ======
function publish() {
  const topic = selectedTopic;
  const receivers = SUBSCRIBERS.filter((s) => s.subs.includes(topic));
  replay(pubNode, "pulse");

  flyDot(center(pubNode), center(busNode), topic, () => {
    busNode.classList.add("active");
    replay(busNode, "pulse");
    if (receivers.length === 0) {
      logLine(`publish('${topic}') → không ai subscribe → bỏ qua`, "bad");
    }
    receivers.forEach((r) => {
      const node = document.getElementById("sub_" + r.key);
      flyDot(center(busNode), center(node), topic, () => {
        node.classList.add("receiving");
        replay(node, "pulse");
        setTimeout(() => node.classList.remove("receiving"), 500);
      });
    });
    setTimeout(() => busNode.classList.remove("active"), 500);
  });

  logLine(`publish('${topic}') → giao cho ${receivers.length} subscriber`,
          receivers.length ? "good" : "bad");
  renderBuild(topic, receivers);
}

// ====== sự kiện ======
document.querySelectorAll(".topic-chip").forEach((c) =>
  c.addEventListener("click", () => {
    selectedTopic = c.dataset.topic;
    document.querySelectorAll(".topic-chip").forEach((x) =>
      x.classList.toggle("active", x === c));
  }));
document.getElementById("pubBtn").addEventListener("click", publish);

// ====== khởi tạo: nạp đăng ký mặc định vào bus ======
SUBSCRIBERS.forEach((s) => s.subs.forEach((t) => bus.subscribe(t, s.key)));
setupTabs();
renderSubGrid();
renderSubChips();
renderBuild(null, []);
