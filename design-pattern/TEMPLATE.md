# Spec dựng 1 trang Design Pattern (BẮT BUỘC tuân theo)

Mỗi pattern là 3 file: `<slug>.html`, `<slug>.js`, `<slug>.css`.
Tham khảo bản mẫu đã hoàn chỉnh: `decorator.html`, `decorator.js` (đọc trước khi làm).

## Khung HTML (giữ nguyên cấu trúc này)

```html
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TÊN Pattern — Minh hoạ động</title>
  <link rel="stylesheet" href="styles.css" />
  <link rel="stylesheet" href="<slug>.css" />
</head>
<body class="pattern-page">
  <header class="site-header compact">
    <a class="back" href="index.html">← Tất cả pattern</a>
    <h1>TÊN Pattern</h1>
    <p class="subtitle">MỘT CÂU mô tả ví dụ (theo Head First)</p>
  </header>

  <main class="pattern-layout">
    <!-- CỘT TRÁI: điều khiển + panel phụ (state/output/receipt) -->
    <section class="panel controls"> ... </section>

    <!-- CỘT GIỮA: sân khấu animation -->
    <section class="panel stage">
      <div class="stage-area" id="stageArea"> ...animation... </div>
      <p class="hint"> gợi ý 1 dòng, có thể chèn <code>code</code> </p>
    </section>

    <!-- CỘT PHẢI: code demo 2 tab -->
    <section class="panel code-panel">
      <div class="code-tabs">
        <button class="code-tab active" data-tab="build">▶ Runtime</button>
        <button class="code-tab" data-tab="classes">📦 Định nghĩa lớp</button>
      </div>
      <pre class="code-view" data-view="build"><code id="buildView"></code></pre>
      <pre class="code-view hidden" data-view="classes"><code id="classView"></code></pre>
      <div class="lesson"><h4>💡 Vì sao dùng ...?</h4><p>...</p></div>
    </section>
  </main>

  <script src="common.js"></script>
  <script src="<slug>.js"></script>
</body>
</html>
```

## Yêu cầu nội dung

1. **Cột giữa = animation tương tác** minh hoạ đúng ví dụ Head First của pattern.
   Animation phải CHẠY khi người dùng tương tác ở cột trái (CSS keyframes, mượt).

2. **Cột phải có 2 tab** (dùng `setupTabs()` từ common.js + `renderCode(el, lines)`):
   - **Runtime**: code dựng/chạy đối tượng CẬP NHẬT THEO thao tác người dùng,
     KÈM comment dạy học (ví dụ giải thích từng bước gọi method, sự chuyển trạng thái,
     hay phép tính cộng dồn — giống phần "giải đệ quy cost()" của Decorator).
   - **Định nghĩa lớp**: code TĨNH cho thấy interface/class chính của pattern.

3. **Cột trái**: các nút/slider điều khiển + 1 panel phụ (`.sub-panel`) hiển thị
   trạng thái / output / hoá đơn tuỳ pattern.

## Dùng lại class có sẵn (KHÔNG tự định nghĩa lại)
`.panel .controls .stage .stage-area .hint .lesson .code-panel .code-tabs .code-tab
.code-view .btn .btn.primary/.good/.danger .btn-row .ctrl-row .field-label .slider
.state-badge(.flash) .output-box(.log-line) .node(.active/.pulse) .arrow(.lit)
.sub-panel .divider .fade-up .chip` — đã có trong styles.css.
Token màu code: `.kw .num .fn .str .cm` (common.js tự thêm).

`<slug>.css` CHỈ chứa style RIÊNG cho animation của pattern đó (hình vẽ, vị trí,
keyframe riêng). KHÔNG sửa styles.css (file dùng chung, tránh xung đột).

## Phong cách
- Dark theme, biến CSS: `--accent #ffb454`, `--accent-2 #6ad0ff`, `--good #6ee7a8`,
  `--panel #171c23`, `--line #2a323d`, `--muted #93a1b1`.
- Tiếng Việt cho phần giải thích; tên class/biến code bằng tiếng Anh.
- Gọn gàng, không phụ thuộc thư viện ngoài.
