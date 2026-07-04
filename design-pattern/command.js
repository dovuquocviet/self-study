// ===== Command Pattern — minh hoạ động (Remote Control) =====
// Mỗi nút trên remote (INVOKER) giữ một Command. Bấm nút -> command.execute().
// Command bọc một RECEIVER (thiết bị) + một HÀNH ĐỘNG. Remote KHÔNG biết gì về thiết bị.
// undo() đảo ngược hành động gần nhất.

// ---------- Receiver: các thiết bị biết cách làm việc thật ----------
class Light {
  constructor(name) { this.name = name; this.isOn = false; }
  on()  { this.isOn = true;  setDevice("light", true);  }
  off() { this.isOn = false; setDevice("light", false); }
}
class GarageDoor {
  up()   { this.open = true;  setDevice("garage", true);  }
  down() { this.open = false; setDevice("garage", false); }
}
class Stereo {
  on()  { this.isOn = true;  this.setCD(); this.setVolume(11); setDevice("stereo", true); }
  off() { this.isOn = false; setDevice("stereo", false); }
  setCD()        { /* nạp CD */ }
  setVolume(v)   { this.volume = v; }
}
class CeilingFan {
  high() { this.speed = "HIGH"; setDevice("fan", true);  }
  off()  { this.speed = "OFF";  setDevice("fan", false); }
}

// ---------- Concrete Command: receiver + hành động (execute / undo) ----------
class LightOnCommand        { constructor(l) { this.light = l; } execute() { this.light.on();  } undo() { this.light.off(); } }
class LightOffCommand       { constructor(l) { this.light = l; } execute() { this.light.off(); } undo() { this.light.on();  } }
class GarageDoorUpCommand   { constructor(g) { this.door = g;  } execute() { this.door.up();   } undo() { this.door.down(); } }
class GarageDoorDownCommand { constructor(g) { this.door = g;  } execute() { this.door.down(); } undo() { this.door.up();   } }
class StereoOnWithCDCommand { constructor(s) { this.stereo = s; } execute() { this.stereo.on();  } undo() { this.stereo.off(); } }
class StereoOffCommand      { constructor(s) { this.stereo = s; } execute() { this.stereo.off(); } undo() { this.stereo.on();  } }
class CeilingFanOnCommand   { constructor(f) { this.fan = f; } execute() { this.fan.high(); } undo() { this.fan.off();  } }
class CeilingFanOffCommand  { constructor(f) { this.fan = f; } execute() { this.fan.off();  } undo() { this.fan.high(); } }

// ---------- Invoker: RemoteControl chỉ giữ Command, gọi execute()/undo() ----------
class RemoteControl {
  constructor() { this.onCommands = []; this.offCommands = []; this.undoCommand = null; }
  setCommand(slot, onCmd, offCmd) {
    this.onCommands[slot]  = onCmd;
    this.offCommands[slot] = offCmd;
  }
  onButtonPushed(slot)  { this.onCommands[slot].execute();  this.undoCommand = this.onCommands[slot];  }
  offButtonPushed(slot) { this.offCommands[slot].execute(); this.undoCommand = this.offCommands[slot]; }
  undoButtonPushed()    { if (this.undoCommand) this.undoCommand.undo(); }
}

// ---------- Bảng tra cứu thiết bị (UI ↔ class) ----------
const DEVICES = {
  light:  { key: "light",  name: "Light",        recv: "livingRoomLight", recvCls: "Light",      recvArg: '"Living Room"',
            onCmd: "LightOnCommand",        offCmd: "LightOffCommand",       onMethod: "on",   offMethod: "off",
            onMsg: "Light is ON",         offMsg: "Light is OFF",        stOn: "ON",   stOff: "OFF" },
  garage: { key: "garage", name: "Garage Door",  recv: "garageDoor",      recvCls: "GarageDoor", recvArg: "",
            onCmd: "GarageDoorUpCommand",   offCmd: "GarageDoorDownCommand", onMethod: "up",   offMethod: "down",
            onMsg: "Garage Door is Up",   offMsg: "Garage Door is Down", stOn: "Up",   stOff: "Down" },
  stereo: { key: "stereo", name: "Stereo",       recv: "stereo",          recvCls: "Stereo",     recvArg: "",
            onCmd: "StereoOnWithCDCommand", offCmd: "StereoOffCommand",      onMethod: "on",   offMethod: "off",
            onMsg: "Stereo is ON for CD", offMsg: "Stereo is OFF",       stOn: "ON",   stOff: "OFF" },
  fan:    { key: "fan",    name: "Ceiling Fan",  recv: "ceilingFan",      recvCls: "CeilingFan", recvArg: "",
            onCmd: "CeilingFanOnCommand",   offCmd: "CeilingFanOffCommand",  onMethod: "high", offMethod: "off",
            onMsg: "Ceiling Fan is ON",   offMsg: "Ceiling Fan is OFF",  stOn: "ON",   stOff: "OFF" },
};

// ---------- Khởi tạo receiver + cặp command 1 lần ----------
const receivers = {
  light:  new Light("Living Room"),
  garage: new GarageDoor(),
  stereo: new Stereo(),
  fan:    new CeilingFan(),
};
const commands = {
  light:  { on: new LightOnCommand(receivers.light),        off: new LightOffCommand(receivers.light) },
  garage: { on: new GarageDoorUpCommand(receivers.garage),  off: new GarageDoorDownCommand(receivers.garage) },
  stereo: { on: new StereoOnWithCDCommand(receivers.stereo),off: new StereoOffCommand(receivers.stereo) },
  fan:    { on: new CeilingFanOnCommand(receivers.fan),     off: new CeilingFanOffCommand(receivers.fan) },
};

// ---------- Trạng thái runtime ----------
const remote = new RemoteControl();
let slots = ["light", "garage", "stereo", "fan"]; // thiết bị gán cho slot 0..3
let lastSlot = null;       // slot của lần bấm ON/OFF gần nhất
let lastCmdType = null;    // "on" | "off"
let lastWasUndo = false;   // lần bấm gần nhất có phải Undo không

// ---------- DOM refs ----------
const slotAssign  = document.getElementById("slotAssign");
const remoteSlots = document.getElementById("remoteSlots");
const logBox      = document.getElementById("logBox");
const undoBtn     = document.getElementById("undoBtn");
const clearBtn    = document.getElementById("clearBtn");
const buildView   = document.getElementById("buildView");
const classView   = document.getElementById("classView");

// ---------- Cập nhật thiết bị trên sân khấu ----------
function setDevice(key, isOn) {
  const card = document.getElementById("dev-" + key);
  card.classList.toggle("active", isOn);
  const d = DEVICES[key];
  document.getElementById("status-" + key).textContent = isOn ? d.stOn : d.stOff;
}
function bumpDevice(key) {
  const art = document.querySelector("#dev-" + key + " .dev-art");
  art.classList.remove("bump"); void art.offsetWidth; art.classList.add("bump");
}

// ---------- Nhật ký ----------
function log(msg, kind) {
  const line = document.createElement("div");
  line.className = "log-line" + (kind ? " " + kind + "-line" : "");
  line.textContent = msg;
  logBox.appendChild(line);
  logBox.scrollTop = logBox.scrollHeight;
}

// ---------- Render cột trái: gán command cho slot ----------
function renderAssign() {
  slotAssign.innerHTML = "";
  slots.forEach((cur, i) => {
    const row = document.createElement("div");
    row.className = "assign-row";
    const label = document.createElement("span");
    label.className = "assign-label";
    label.textContent = "Slot " + i;
    const chips = document.createElement("div");
    chips.className = "assign-chips";
    Object.values(DEVICES).forEach((d) => {
      const b = document.createElement("button");
      b.className = "chip mini" + (d.key === cur ? " active" : "");
      b.textContent = d.name;
      b.dataset.slot = i;
      b.dataset.dev = d.key;
      chips.appendChild(b);
    });
    row.appendChild(label);
    row.appendChild(chips);
    slotAssign.appendChild(row);
  });
}

// ---------- Render remote (các slot ON/OFF) ----------
function renderRemote() {
  remoteSlots.innerHTML = "";
  slots.forEach((k, i) => {
    const d = DEVICES[k];
    const el = document.createElement("div");
    el.className = "slot";
    el.innerHTML =
      '<div class="slot-head"><span class="slot-num">' + i + '</span>' +
      '<span class="slot-device">' + d.name + "</span></div>" +
      '<div class="slot-btns">' +
      '<button class="slot-btn on"  data-slot="' + i + '" data-act="on">ON</button>' +
      '<button class="slot-btn off" data-slot="' + i + '" data-act="off">OFF</button></div>';
    remoteSlots.appendChild(el);
  });
}

// ---------- Code TAB 2: định nghĩa lớp (tĩnh) ----------
function renderClassCode() {
  renderCode(classView, [
    "// 1 · Command — interface chung: chỉ execute() và undo()",
    "interface Command {",
    "  execute();",
    "  undo();",
    "}",
    "",
    "// 2 · Concrete Command: bọc 1 receiver + 1 hành động",
    "class LightOnCommand implements Command {",
    "  constructor(light) { this.light = light; }  // giữ receiver",
    "  execute() { this.light.on();  }             // gọi hành động",
    "  undo()    { this.light.off(); }             // đảo ngược",
    "}",
    "",
    "// 3 · Invoker — chỉ giữ Command, KHÔNG biết gì về thiết bị",
    "class RemoteControl {",
    "  setCommand(slot, onCmd, offCmd) {",
    "    this.onCommands[slot]  = onCmd;",
    "    this.offCommands[slot] = offCmd;",
    "  }",
    "  onButtonPushed(slot) {",
    "    this.onCommands[slot].execute();",
    "    this.undoCommand = this.onCommands[slot];  // nhớ để Undo",
    "  }",
    "  undoButtonPushed() {",
    "    this.undoCommand.undo();",
    "  }",
    "}",
    "",
    "// 4 · Receiver — biết cách làm việc thật",
    "class Light {",
    "  on()  { this.isOn = true;  }",
    "  off() { this.isOn = false; }",
    "}",
  ]);
}

// ---------- Code TAB 1: dựng/chạy theo thao tác người dùng ----------
function renderBuildCode() {
  const lines = [];
  const used = [...new Set(slots)];

  lines.push("// 1 · Tạo receiver (thiết bị) cần điều khiển");
  used.forEach((k) => {
    const d = DEVICES[k];
    lines.push("let " + d.recv + " = new " + d.recvCls + "(" + d.recvArg + ");");
  });

  lines.push("");
  lines.push("// 2 · Bọc receiver bằng Command rồi nạp vào slot của remote");
  slots.forEach((k, i) => {
    const d = DEVICES[k];
    lines.push("remote.setCommand(" + i + ", new " + d.onCmd + "(" + d.recv + "), new " + d.offCmd + "(" + d.recv + "));");
  });

  lines.push("");
  if (lastSlot === null) {
    lines.push("// 3 · Bấm ON/OFF trên remote để chạy command…");
  } else {
    const d = DEVICES[slots[lastSlot]];
    lines.push("// 3 · Thao tác gần nhất trên remote");
    if (lastCmdType === "on") {
      lines.push("remote.onButtonPushed(" + lastSlot + ");   // -> command.execute() -> " + d.recv + "." + d.onMethod + "()");
      lines.push('//   => "' + d.onMsg + '"');
    } else {
      lines.push("remote.offButtonPushed(" + lastSlot + ");  // -> command.execute() -> " + d.recv + "." + d.offMethod + "()");
      lines.push('//   => "' + d.offMsg + '"');
    }
    if (lastWasUndo) {
      const undoMethod = lastCmdType === "on" ? d.offMethod : d.onMethod;
      const undoMsg    = lastCmdType === "on" ? d.offMsg    : d.onMsg;
      lines.push("remote.undoButtonPushed();  // -> undoCommand.undo() -> " + d.recv + "." + undoMethod + "()");
      lines.push('//   => "Undo: ' + undoMsg + '"');
    }
  }
  renderCode(buildView, lines);
}

// ---------- Hành động ----------
function pushButton(slot, act) {
  const d = DEVICES[slots[slot]];
  if (act === "on")  { remote.onButtonPushed(slot);  log(d.onMsg, "on"); }
  else               { remote.offButtonPushed(slot); log(d.offMsg, "off"); }
  lastSlot = slot; lastCmdType = act; lastWasUndo = false;
  bumpDevice(slots[slot]);
  renderBuildCode();
}
function pushUndo() {
  if (lastSlot === null || !remote.undoCommand) {
    log("Chưa có lệnh nào để Undo.", "muted");
    return;
  }
  remote.undoButtonPushed();
  const d = DEVICES[slots[lastSlot]];
  const undoMsg = lastCmdType === "on" ? d.offMsg : d.onMsg;
  log("Undo: " + undoMsg, "undo");
  lastWasUndo = true;
  bumpDevice(slots[lastSlot]);
  renderBuildCode();
}

// ---------- Sự kiện ----------
slotAssign.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip.mini");
  if (!btn) return;
  const i = +btn.dataset.slot;
  slots[i] = btn.dataset.dev;
  remote.setCommand(i, commands[slots[i]].on, commands[slots[i]].off);
  // gán lại command thì thao tác Undo cũ không còn ý nghĩa cho slot này
  if (lastSlot === i) { lastSlot = null; lastCmdType = null; lastWasUndo = false; }
  renderAssign();
  renderRemote();
  renderBuildCode();
});

remoteSlots.addEventListener("click", (e) => {
  const btn = e.target.closest(".slot-btn");
  if (!btn) return;
  pushButton(+btn.dataset.slot, btn.dataset.act);
});

undoBtn.addEventListener("click", pushUndo);
clearBtn.addEventListener("click", () => { logBox.innerHTML = ""; });

// ---------- Khởi tạo ----------
slots.forEach((k, i) => remote.setCommand(i, commands[k].on, commands[k].off));
Object.keys(DEVICES).forEach((k) => setDevice(k, false));
renderAssign();
renderRemote();
renderClassCode();
renderBuildCode();
setupTabs();
