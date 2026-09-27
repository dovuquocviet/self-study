window.LESSONS.push({
  id: "17",
  phase: "3", phaseName: "Jetpack Compose cốt lõi",
  title: "Theming với Material 3",
  subtitle: "MaterialTheme = colorScheme + typography + shapes · dark mode · dynamic color · CompositionLocal · token thay vì mã màu",

  theory: `
    <p>Material 3 (Material You) là hệ thiết kế mặc định của Compose (<code>androidx.compose.material3</code>). Mọi component (Button, Card, TopAppBar...) lấy màu, chữ, bo góc
    từ <code>MaterialTheme</code> — nên đổi theme một chỗ là cả app đổi theo.</p>

    <table>
      <tr><th>Thành phần</th><th>Chứa gì</th><th>Dùng trong code</th></tr>
      <tr><td><code>ColorScheme</code></td><td>Vai trò màu: <code>primary</code>, <code>onPrimary</code>, <code>secondary</code>, <code>surface</code>, <code>onSurface</code>, <code>surfaceVariant</code>, <code>error</code>...</td><td><code>MaterialTheme.colorScheme.primary</code></td></tr>
      <tr><td><code>Typography</code></td><td>Thang chữ: <code>displayLarge</code> … <code>headlineMedium</code>, <code>titleLarge</code>, <code>bodyMedium</code>, <code>labelSmall</code> (15 kiểu)</td><td><code>MaterialTheme.typography.titleMedium</code></td></tr>
      <tr><td><code>Shapes</code></td><td><code>extraSmall</code> … <code>extraLarge</code></td><td><code>MaterialTheme.shapes.medium</code></td></tr>
    </table>

    <p><strong>Cặp "on"</strong>: mỗi màu nền có màu chữ tương ứng (<code>primary</code> ↔ <code>onPrimary</code>, <code>surface</code> ↔ <code>onSurface</code>). <code>Surface</code>/<code>Card</code>
    tự đặt màu nội dung phù hợp qua <code>LocalContentColor</code>, nên Text bên trong tự đúng màu mà không cần chỉ định.</p>

    <p><strong>Cơ chế</strong>: <code>MaterialTheme(colorScheme, typography, shapes) { content }</code> cung cấp giá trị qua <strong>CompositionLocal</strong> — dữ liệu truyền ngầm xuống
    toàn bộ cây con (như React Context). <code>MaterialTheme.colorScheme</code> chỉ là đọc CompositionLocal gần nhất. Vì vậy có thể lồng theme khác cho một vùng.</p>

    <p><strong>Dark mode & dynamic color</strong>: <code>isSystemInDarkTheme()</code> đọc cài đặt hệ thống. Từ Android 12 (API 31), <code>dynamicLightColorScheme(context)</code>/
    <code>dynamicDarkColorScheme(context)</code> sinh bảng màu từ hình nền của user. App có nhận diện thương hiệu mạnh (shop) thường <em>tắt</em> dynamic color để giữ màu brand.</p>

    <div class="callout"><p>💡 Quy tắc vàng: trong màn hình <strong>không viết mã màu cứng</strong> (<code>Color(0xFF7F52FF)</code>) hay cỡ chữ cứng — dùng token
    <code>colorScheme.primary</code>, <code>typography.bodyLarge</code>. Mã màu chỉ xuất hiện trong file Theme. Đổi brand/dark mode sẽ không phải sửa từng màn hình.
    Material Theme Builder (web) sinh sẵn file Color.kt/Theme.kt từ một màu gốc.</p></div>
  `,

  codeTabs: [
    { id: "color", label: "① Color.kt", lines: [
      "val Brand = Color(0xFF7F52FF)",
      "",
      "val LightColors = lightColorScheme(",
      "    primary = Brand, onPrimary = Color.White,",
      "    secondary = Color(0xFF00B894),",
      "    surface = Color(0xFFFDFBFF), onSurface = Color(0xFF1B1B1F),",
      "    error = Color(0xFFBA1A1A)",
      ")",
      "val DarkColors = darkColorScheme(",
      "    primary = Color(0xFFCBBEFF), onPrimary = Color(0xFF2E0F8A),",
      "    surface = Color(0xFF131316), onSurface = Color(0xFFE5E1E6)",
      ")"
    ]},
    { id: "theme", label: "② Theme.kt", lines: [
      "@Composable",
      "fun ShopTheme(",
      "    darkTheme: Boolean = isSystemInDarkTheme(),",
      "    dynamicColor: Boolean = false,            // shop giữ màu brand",
      "    content: @Composable () -> Unit",
      ") {",
      "    val colors = when {",
      "        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {",
      "            val ctx = LocalContext.current",
      "            if (darkTheme) dynamicDarkColorScheme(ctx) else dynamicLightColorScheme(ctx)",
      "        }",
      "        darkTheme -> DarkColors",
      "        else -> LightColors",
      "    }",
      "    MaterialTheme(colorScheme = colors, typography = ShopTypography, content = content)",
      "}"
    ]},
    { id: "use", label: "③ Dùng token", lines: [
      "@Composable",
      "fun OrderBadge(status: OrderStatus) {",
      "    val (bg, fg) = when (status) {",
      "        OrderStatus.PAID -> MaterialTheme.colorScheme.primaryContainer to MaterialTheme.colorScheme.onPrimaryContainer",
      "        OrderStatus.NEW -> MaterialTheme.colorScheme.surfaceVariant to MaterialTheme.colorScheme.onSurfaceVariant",
      "        OrderStatus.SHIPPED -> MaterialTheme.colorScheme.tertiaryContainer to MaterialTheme.colorScheme.onTertiaryContainer",
      "    }",
      "    Surface(color = bg, contentColor = fg, shape = MaterialTheme.shapes.small) {",
      "        Text(status.label, style = MaterialTheme.typography.labelMedium,",
      "             modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp))",
      "    }",
      "}",
      "// ❌ Text(color = Color(0xFF333333)) — dark mode sẽ thành chữ tối trên nền tối"
    ]},
    { id: "local", label: "④ CompositionLocal", lines: [
      "data class Spacing(val s: Dp = 4.dp, val m: Dp = 8.dp, val l: Dp = 16.dp)",
      "val LocalSpacing = staticCompositionLocalOf { Spacing() }",
      "",
      "@Composable",
      "fun ShopThemeWithSpacing(content: @Composable () -> Unit) {",
      "    CompositionLocalProvider(LocalSpacing provides Spacing()) {",
      "        ShopTheme(content = content)",
      "    }",
      "}",
      "",
      "val gap = LocalSpacing.current.m        // đọc ở bất kỳ đâu trong cây con"
    ]}
  ],

  stageHtml: `
    <div class="node" id="act"><div class="nl">📱 setContent { ShopTheme { App() } }</div><div class="ns">bọc toàn bộ app</div></div>
    <div class="arrow" id="a1">↓ chọn bảng màu</div>
    <div class="row">
      <div class="node" id="light"><div class="nl">☀️ LightColors</div><div class="ns">mặc định</div></div>
      <div class="node" id="dark"><div class="nl">🌙 DarkColors</div><div class="ns">isSystemInDarkTheme()</div></div>
      <div class="node" id="dyn"><div class="nl">🎨 Dynamic</div><div class="ns">API 31+, từ hình nền</div></div>
    </div>
    <div class="arrow" id="a2">↓ CompositionLocal truyền ngầm</div>
    <div class="node" id="comp"><div class="nl">🧩 Button, Card, Text...</div><div class="ns">đọc MaterialTheme.colorScheme / typography</div></div>
  `,
  steps: [
    { title: "1 · Định nghĩa bảng màu theo vai trò", tab: "color", highlight: [3, 4, 6, 9, 10], on: ["light", "dark"],
      desc: "Không phải 'màu tím', 'màu xám' mà là primary/onPrimary/surface... Mỗi nền có cặp màu chữ." },
    { title: "2 · Chọn scheme theo hệ thống", tab: "theme", highlight: [3, 4, 7, 8, 10, 12, 13], on: ["a1", "light", "dark", "dyn"],
      desc: "Dark mode từ isSystemInDarkTheme; dynamic color chỉ từ Android 12 (VERSION_CODES.S)." },
    { title: "3 · MaterialTheme cung cấp giá trị", tab: "theme", highlight: [15], on: ["act", "a2"],
      desc: "Giá trị được cung cấp qua CompositionLocal cho toàn bộ cây con." },
    { title: "4 · Component dùng token", tab: "use", highlight: [4, 8, 9, 13], on: ["comp"],
      desc: "Surface đặt contentColor; Text bên trong tự dùng màu đó. Mã màu cứng sẽ vỡ ở dark mode." },
    { title: "5 · Tự tạo CompositionLocal", tab: "local", highlight: [2, 6, 11], on: ["a2", "comp"],
      desc: "Cùng cơ chế với MaterialTheme; hợp cho token thiết kế (spacing), không hợp cho state nghiệp vụ." }
  ],

  quiz: [
    { q: "MaterialTheme gồm ba nhóm chính nào?", options: [
        "Color, Font, Icon", "colorScheme, typography, shapes", "Light, Dark, Dynamic", "Primary, Secondary, Tertiary"
      ], correct: 1, explanation: "Component Material đọc từ ba nhóm này." },
    { q: "onPrimary dùng cho?", options: [
        "Nền chính", "Màu nội dung (chữ/icon) đặt trên nền primary", "Màu khi bấm", "Màu lỗi"
      ], correct: 1, explanation: "Cặp màu đảm bảo tương phản." },
    { q: "Dynamic color có từ phiên bản Android nào?", options: [
        "Android 10", "Android 12 (API 31)", "Android 14", "Mọi phiên bản"
      ], correct: 1, explanation: "Cần kiểm tra SDK_INT trước khi gọi." },
    { q: "MaterialTheme truyền giá trị xuống cây con bằng cơ chế gì?", options: [
        "Tham số từng hàm", "CompositionLocal", "Biến static", "SharedPreferences"
      ], correct: 1, explanation: "Giống React Context." },
    { q: "Vì sao tránh Text(color = Color(0xFF333333)) trong màn hình?", options: [
        "Chậm", "Mã màu cứng không đổi theo dark mode/brand — chữ tối trên nền tối", "Lỗi compile", "Không hỗ trợ hex"
      ], correct: 1, explanation: "Dùng token colorScheme.onSurface..." },
    { q: "App shop có màu thương hiệu thường chọn gì với dynamic color?", options: [
        "Bật bắt buộc", "Tắt để giữ màu brand", "Chỉ bật ở dark", "Không liên quan"
      ], correct: 1, explanation: "Dynamic color hợp với app tiện ích hơn app brand." },
    { q: "Text bên trong Surface(contentColor = fg) không chỉ định màu sẽ có màu gì?", options: [
        "Đen", "fg — lấy từ LocalContentColor do Surface cung cấp", "primary", "Ngẫu nhiên"
      ], correct: 1, explanation: "Surface đặt LocalContentColor." },
    { q: "Nên dùng CompositionLocal tự tạo cho?", options: [
        "Giỏ hàng", "Token thiết kế/môi trường như spacing", "Kết quả API", "Trạng thái đăng nhập thay đổi liên tục"
      ], correct: 1, explanation: "State nghiệp vụ nên truyền tường minh hoặc qua ViewModel." },
    { q: "Typography của Material 3 có bao nhiêu kiểu chữ chuẩn?", options: [
        "5", "10", "15 (display/headline/title/body/label × large/medium/small)", "20"
      ], correct: 2, explanation: "5 nhóm × 3 cỡ." }
  ]
});
