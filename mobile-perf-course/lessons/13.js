window.LESSONS.push({
  id: "13",
  phase: "3", phaseName: "Giao diện mượt",
  title: "Ảnh: kích thước, decode, cache — nguyên nhân giật số 1",
  subtitle: "Bộ nhớ = rộng × cao × 4 · downsampling · cache nhiều tầng · Coil/Glide · SDWebImage/Kingfisher · expo-image · CDN resize",

  theory: `
    <p>File JPEG 300 KB trông nhỏ, nhưng để hiển thị, nó phải được <strong>decode</strong> thành bitmap. Bộ nhớ bitmap không phụ thuộc kích thước file mà phụ thuộc số pixel:</p>
    <p style="text-align:center"><strong>bộ nhớ = rộng × cao × 4 byte</strong> (ARGB_8888 / RGBA 8 bit)</p>
    <table>
      <tr><th>Ảnh gốc</th><th>Bitmap</th><th>Ghi chú</th></tr>
      <tr><td>4000 × 3000 (ảnh chụp 12 MP)</td><td>≈ 48 MB</td><td>Vài ảnh là OOM trên máy yếu</td></tr>
      <tr><td>1080 × 1080</td><td>≈ 4,7 MB</td><td></td></tr>
      <tr><td>Thumbnail hiển thị 120 × 120 pt @3x = 360 × 360 px</td><td>≈ 0,5 MB</td><td>Đủ nét cho ô sản phẩm</td></tr>
    </table>

    <p><strong>Chi phí của một ảnh</strong></p>
    <ol>
      <li><strong>Tải</strong> qua mạng (bytes của file) → nên có cache đĩa.</li>
      <li><strong>Decode</strong> (tốn CPU, tỉ lệ với số pixel) → phải làm ngoài main thread và <strong>downsample</strong> về đúng kích thước hiển thị.</li>
      <li><strong>Upload lên GPU</strong> và vẽ → ảnh lớn hơn khung hiển thị là lãng phí cả bộ nhớ lẫn băng thông GPU.</li>
    </ol>

    <p><strong>Cache nhiều tầng</strong>: memory cache (bitmap đã decode, vào lại là hiện ngay) → disk cache (file đã tải) → mạng. Đừng tự viết: dùng thư viện đã làm đúng việc decode nền, downsample, cache, huỷ request khi cell bị tái sử dụng.</p>
    <table>
      <tr><th>Nền tảng</th><th>Thư viện</th></tr>
      <tr><td>Android</td><td>Coil (Kotlin-first, có Compose), Glide</td></tr>
      <tr><td>iOS</td><td>SDWebImage, Kingfisher, Nuke; tự làm thì dùng ImageIO <code>CGImageSourceCreateThumbnailAtIndex</code> hoặc <code>UIImage.preparingThumbnail(of:)</code> (iOS 15)</td></tr>
      <tr><td>RN</td><td><code>expo-image</code> (dùng SDWebImage/Glide bên dưới, cache đĩa, placeholder blurhash), <code>react-native-fast-image</code> (cũ, ít bảo trì)</td></tr>
    </table>

    <p><strong>Phía server/CDN</strong> quan trọng không kém: trả đúng kích thước (<code>?width=360</code>), định dạng hiện đại (WebP; AVIF nếu thiết bị hỗ trợ), có header cache.
    Không gì nhanh bằng không phải tải và decode ảnh 4000px ngay từ đầu.</p>

    <div class="callout"><p>💡 Kiểm tra nhanh: mở màn danh sách, xem Memory Profiler/Allocations khi cuộn. Bộ nhớ nhảy hàng chục MB mỗi màn = ảnh đang được decode ở kích thước gốc.</p></div>
  `,

  codeTabs: [
    { id: "math", label: "① Tính bộ nhớ", lines: [
      "bitmap_bytes = width * height * 4",
      "",
      "4000 * 3000 * 4 = 48,000,000 B  ≈ 48 MB   // ảnh gốc từ CMS",
      " 360 *  360 * 4 =    518,400 B  ≈ 0.5 MB  // đúng cỡ ô 120pt @3x",
      "",
      "# 20 ô trên màn hình:",
      "#   ảnh gốc : 960 MB  → OOM / jetsam",
      "#   đúng cỡ :  10 MB"
    ]},
    { id: "android", label: "② Coil (Compose)", lines: [
      "AsyncImage(",
      "    model = ImageRequest.Builder(LocalContext.current)",
      "        .data(product.imageUrl + \"?width=360\")    // CDN resize",
      "        .crossfade(true)",
      "        .build(),",
      "    contentDescription = product.name,",
      "    modifier = Modifier.size(120.dp),",
      "    contentScale = ContentScale.Crop",
      ")",
      "// Coil tự decode nền, downsample theo kích thước view, cache memory + disk,",
      "// huỷ request khi item rời khỏi composition"
    ]},
    { id: "ios", label: "③ iOS downsample", lines: [
      "func downsample(_ url: URL, to size: CGSize, scale: CGFloat) -> UIImage? {",
      "    let srcOpts = [kCGImageSourceShouldCache: false] as CFDictionary   // chưa decode",
      "    guard let src = CGImageSourceCreateWithURL(url as CFURL, srcOpts) else { return nil }",
      "    let maxPx = max(size.width, size.height) * scale",
      "    let opts = [",
      "        kCGImageSourceCreateThumbnailFromImageAlways: true,",
      "        kCGImageSourceShouldCacheImmediately: true,          // decode ngay tại đây",
      "        kCGImageSourceCreateThumbnailWithTransform: true,",
      "        kCGImageSourceThumbnailMaxPixelSize: maxPx",
      "    ] as CFDictionary",
      "    guard let cg = CGImageSourceCreateThumbnailAtIndex(src, 0, opts) else { return nil }",
      "    return UIImage(cgImage: cg)",
      "}",
      "// Gọi hàm này trên thread nền, rồi gán vào UIImageView trên main"
    ]},
    { id: "rn", label: "④ RN expo-image", lines: [
      "import { Image } from 'expo-image';",
      "",
      "<Image",
      "  source={{ uri: product.imageUrl + '?width=360' }}",
      "  style={{ width: 120, height: 120 }}",
      "  contentFit='cover'",
      "  placeholder={{ blurhash: product.blurhash }}",
      "  cachePolicy='memory-disk'",
      "  recyclingKey={product.id}      // dùng trong list có recycling (FlashList)",
      "  transition={150}",
      "/>"
    ]}
  ],

  stageHtml: `
    <div class="node" id="cdn"><div class="nl">🌐 CDN</div><div class="ns">resize · WebP/AVIF · cache header</div></div>
    <div class="arrow" id="a1">↓ bytes</div>
    <div class="node" id="disk"><div class="nl">💾 Disk cache</div><div class="ns">file đã tải</div></div>
    <div class="arrow" id="a2">↓ decode nền + downsample</div>
    <div class="node" id="mem"><div class="nl">🧠 Memory cache</div><div class="ns">bitmap = rộng × cao × 4</div></div>
    <div class="arrow" id="a3">↓ upload GPU</div>
    <div class="node" id="view"><div class="nl">🖼️ View 120 × 120 pt</div><div class="ns">360 × 360 px @3x</div></div>
  `,
  steps: [
    { title: "1 · Bộ nhớ tính theo pixel", tab: "math", highlight: [1, 3, 4, 7, 8], on: ["mem"],
      desc: "File 300 KB nhưng bitmap 48 MB. 20 ô ảnh gốc gần 1 GB — máy nào cũng bị kill." },
    { title: "2 · Resize ngay ở CDN", tab: "android", highlight: [3], on: ["cdn", "a1"],
      desc: "Giảm bytes tải về và công decode. Đây là tối ưu rẻ nhất, nhiều nhất." },
    { title: "3 · Thư viện ảnh làm phần khó", tab: "android", highlight: [1, 7, 10, 11], on: ["disk", "mem"],
      desc: "Coil/Glide decode nền, downsample theo kích thước view, cache 2 tầng, huỷ request khi không cần." },
    { title: "4 · iOS: downsample bằng ImageIO", tab: "ios", highlight: [2, 4, 6, 7, 9, 11, 14], on: ["a2", "mem"],
      desc: "Tạo thumbnail tối đa maxPx, decode ngay trên thread nền — không bao giờ decode ảnh gốc 12 MP." },
    { title: "5 · RN: expo-image", tab: "rn", highlight: [4, 7, 8, 9], on: ["a3", "view"],
      desc: "Cache memory + disk, placeholder blurhash, recyclingKey để ảnh cũ không nháy khi cell được tái sử dụng." }
  ],

  quiz: [
    { q: "Ảnh 4000 × 3000 decode dạng RGBA 8 bit chiếm bao nhiêu bộ nhớ?", options: [
        "Khoảng 300 KB (bằng file JPEG)", "Khoảng 12 MB", "Khoảng 48 MB", "Khoảng 480 MB"
      ], correct: 2, explanation: "4000 × 3000 × 4 = 48.000.000 byte." },
    { q: "Bộ nhớ bitmap phụ thuộc vào điều gì?", options: [
        "Kích thước file nén", "Số pixel (rộng × cao) và định dạng pixel", "Tên file", "Tốc độ mạng"
      ], correct: 1, explanation: "JPEG nén nhỏ trên đĩa nhưng decode ra đầy đủ pixel." },
    { q: "Ô ảnh 120 × 120 pt trên màn @3x cần ảnh bao nhiêu pixel là đủ?", options: [
        "120 × 120", "360 × 360", "1080 × 1080", "4000 × 3000"
      ], correct: 1, explanation: "120 × 3 = 360 pixel mỗi chiều." },
    { q: "Downsampling nghĩa là gì?", options: [
        "Nén file mạnh hơn",
        "Decode ảnh ở kích thước nhỏ vừa đủ hiển thị thay vì kích thước gốc",
        "Đổi sang ảnh đen trắng",
        "Tải ảnh chậm lại"
      ], correct: 1, explanation: "Giảm bộ nhớ và thời gian decode." },
    { q: "Vì sao decode ảnh nên làm ngoài main thread?", options: [
        "Vì main thread không đọc được file",
        "Decode tốn CPU tỉ lệ với số pixel — trên main thread gây giật khi cuộn",
        "Vì GPU yêu cầu",
        "Không cần thiết"
      ], correct: 1, explanation: "Thư viện ảnh đều decode nền." },
    { q: "Tối ưu nào thường rẻ và hiệu quả nhất cho ảnh sản phẩm?", options: [
        "Viết thư viện cache riêng",
        "Để CDN trả đúng kích thước và định dạng hiện đại",
        "Tăng windowSize",
        "Tắt ảnh"
      ], correct: 1, explanation: "Không phải tải và decode phần thừa ngay từ đầu." },
    { q: "Trong ImageIO, tuỳ chọn nào giới hạn kích thước ảnh thumbnail?", options: [
        "kCGImageSourceThumbnailMaxPixelSize", "kCGImageSourceShouldCache", "UIImage(named:)", "contentMode"
      ], correct: 0, explanation: "Kết hợp CreateThumbnailFromImageAlways và ShouldCacheImmediately." },
    { q: "recyclingKey của expo-image dùng để làm gì?", options: [
        "Mã hoá ảnh",
        "Khi view được tái sử dụng cho item khác, xoá ảnh cũ ngay để không hiện nhầm ảnh",
        "Đặt tên file cache",
        "Tăng độ nét"
      ], correct: 1, explanation: "Quan trọng trong list có recycling như FlashList." },
    { q: "Cuộn danh sách thấy bộ nhớ tăng vài chục MB mỗi màn. Nghi ngờ đầu tiên?", options: [
        "Font chữ",
        "Ảnh đang decode ở kích thước gốc, không downsample",
        "Log quá nhiều",
        "Kích thước APK"
      ], correct: 1, explanation: "Ảnh là nguồn tiêu bộ nhớ lớn nhất trong list." }
  ]
});
