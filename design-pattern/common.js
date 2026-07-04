// ===== Tiện ích dùng chung cho mọi trang pattern =====
// Cung cấp: esc(), hl() syntax-highlight, renderCode(), setupTabs()

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Tô màu 1 dòng code (keyword / number / method / string / comment)
function hl(line) {
  const c = line.indexOf("//");
  let code = line, comment = "";
  if (c !== -1) { code = line.slice(0, c); comment = line.slice(c); }
  let out = esc(code)
    .replace(/\b(let|const|var|new|return|class|extends|this|super|if|else|for|function|interface|implements|null|true|false)\b/g,
      '<span class="kw">$1</span>')
    .replace(/\b(\d+\.\d+|\d+)\b/g, '<span class="num">$1</span>')
    .replace(/\.(\w+)\(/g, '.<span class="fn">$1</span>(')
    .replace(/(&quot;[^&]*&quot;|'[^']*')/g, '<span class="str">$1</span>');
  if (comment) out += '<span class="cm">' + esc(comment) + "</span>";
  return out;
}

// Render mảng dòng vào 1 <code>
function renderCode(el, lines) {
  el.innerHTML = lines.map(hl).join("\n");
}

// Gắn hành vi cho .code-tab + .code-view (data-tab khớp id view)
function setupTabs(root = document) {
  const tabs = root.querySelectorAll(".code-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.dataset.tab;
      root.querySelectorAll(".code-view").forEach((v) => {
        v.classList.toggle("hidden", v.dataset.view !== target);
      });
    });
  });
}
