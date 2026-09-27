window.LESSONS.push({
  id: "08",
  phase: "1", phaseName: "Thread & rendering",
  title: "UI khai báo & danh sách dài: recomposition, identity và tái sử dụng cell",
  subtitle: "Compose stability · SwiftUI identity · LazyColumn / List · RecyclerView & UITableView cell reuse",

  theory: `
    <p>Bài 04 nói UI khai báo = <em>hàm của state</em>. Câu hỏi hiệu năng là: <strong>khi state đổi, bao nhiêu phần bị tính lại?</strong></p>

    <p><strong>Compose</strong> theo dõi state nào được đọc trong composable nào. Khi <code>State</code> đổi, chỉ những scope đã đọc nó bị recompose.
    Composable có thể được <em>skip</em> nếu mọi tham số không đổi — nhưng chỉ khi Compose chứng minh được tham số là <strong>stable</strong> (kiểu bất biến, primitive, String, hoặc đánh dấu <code>@Immutable</code>/<code>@Stable</code>).
    <code>List&lt;T&gt;</code> của Kotlin là interface có thể mutable nên trước đây bị coi là unstable; từ Kotlin 2.0.20 chế độ <em>strong skipping</em> bật mặc định, so sánh tham số unstable bằng tham chiếu (<code>===</code>), giảm đáng kể việc recompose thừa.</p>
    <ul>
      <li>Đọc state <em>càng muộn càng tốt</em>: truyền lambda <code>{ scrollOffset }</code> thay vì giá trị, dùng <code>Modifier.offset { }</code> (đọc ở pha layout) thay vì <code>Modifier.offset(x.dp)</code> (đọc ở composition).</li>
      <li>Giá trị suy ra từ state thay đổi liên tục → <code>derivedStateOf</code>.</li>
      <li>Công cụ: Layout Inspector (đếm số lần recompose), Compose compiler reports.</li>
    </ul>

    <p><strong>SwiftUI</strong> so sánh <em>identity</em> của view: identity cấu trúc (vị trí trong cây) và identity tường minh (<code>id</code> trong <code>ForEach</code>, <code>.id()</code>). Identity đổi → SwiftUI coi là view mới: mất <code>@State</code>, chạy lại <code>.task</code>, animation chuyển cảnh.
    Vì thế <code>ForEach</code> cần id ổn định (không dùng index hay <code>UUID()</code> sinh mới mỗi lần). Với <code>@Observable</code> (iOS 17+), view chỉ cập nhật khi thuộc tính mà <code>body</code> thực sự đọc thay đổi.</p>

    <p><strong>Danh sách dài — nguyên tắc chung "chỉ dựng cái đang thấy"</strong></p>
    <table>
      <tr><th></th><th>Android</th><th>iOS</th><th>React Native</th></tr>
      <tr><td>Kiểu View cổ điển</td><td><code>RecyclerView</code>: tái sử dụng ViewHolder, <code>DiffUtil</code></td><td><code>UITableView</code>/<code>UICollectionView</code>: <code>dequeueReusableCell</code>, diffable data source</td><td><code>FlatList</code> (ảo hoá, không tái sử dụng native view), FlashList (tái sử dụng)</td></tr>
      <tr><td>Kiểu khai báo</td><td><code>LazyColumn</code> + <code>key</code> + <code>contentType</code></td><td><code>List</code> / <code>LazyVStack</code> + <code>id</code> ổn định</td><td>—</td></tr>
    </table>
    <p>Cell reuse: cuộn 10.000 dòng mà chỉ khoảng 12 view tồn tại, được "tái chế" và gán dữ liệu mới. Giải mã ảnh trong cell phải bất đồng bộ và huỷ khi cell bị tái sử dụng (Coil/Glide, Kingfisher/SDWebImage làm sẵn).</p>

    <div class="callout"><p>💡 Tương tự trong backend: phân trang thay vì <code>findAll()</code>. Trên UI, "phân trang" là ảo hoá + tái sử dụng; đừng bao giờ đặt 1.000 phần tử trong <code>Column</code> + <code>verticalScroll</code> hay <code>VStack</code> không lazy.</p></div>
  `,

  codeTabs: [
    { id: "lazy", label: "① Compose LazyColumn", lines: [
      "@Immutable",
      "data class ProductRow(val id: String, val name: String, val price: Long)",
      "",
      "@Composable",
      "fun ProductList(items: List<ProductRow>, onClick: (String) -> Unit) {",
      "    LazyColumn {",
      "        items(items, key = { it.id }, contentType = { \"product\" }) { row ->",
      "            ProductItem(row, onClick)   // skip được nếu row không đổi",
      "        }",
      "    }",
      "}"
    ]},
    { id: "defer", label: "② Đọc state muộn", lines: [
      "// Recompose MỖI frame khi cuộn:",
      "val offset = listState.firstVisibleItemScrollOffset",
      "Header(Modifier.offset(y = (-offset / 2).dp))",
      "",
      "// Chỉ chạy lại pha layout, không recompose:",
      "Header(Modifier.offset { IntOffset(0, -listState.firstVisibleItemScrollOffset / 2) })",
      "",
      "// Chỉ recompose khi giá trị boolean thật sự đổi:",
      "val showFab by remember { derivedStateOf { listState.firstVisibleItemIndex > 0 } }"
    ]},
    { id: "swift", label: "③ SwiftUI identity", lines: [
      "struct ProductList: View {",
      "    let items: [Product]",
      "    var body: some View {",
      "        List(items, id: \\.id) { p in       // id ổn định từ server",
      "            ProductRowView(product: p)",
      "        }",
      "    }",
      "}",
      "// SAI: ForEach(items.indices, id: \\.self)  -> xoá phần tử đầu làm lệch mọi state",
      "// SAI: .id(UUID())  -> view mới mỗi lần render, mất @State, chạy lại .task"
    ]},
    { id: "reuse", label: "④ Cell reuse (UIKit)", lines: [
      "func tableView(_ tv: UITableView, cellForRowAt ip: IndexPath) -> UITableViewCell {",
      "    let cell = tv.dequeueReusableCell(withIdentifier: \"product\", for: ip) as! ProductCell",
      "    let p = items[ip.row]",
      "    cell.nameLabel.text = p.name",
      "    cell.photo.kf.setImage(with: p.imageURL)   // tải/giải mã bất đồng bộ",
      "    return cell",
      "}",
      "// ProductCell.prepareForReuse(): huỷ tải ảnh cũ, reset trạng thái"
    ]}
  ],

  stageHtml: `
    <div class="node" id="state"><div class="nl">🔔 State đổi</div><div class="ns">giá, số lượng, vị trí cuộn</div></div>
    <div class="arrow" id="a1">↓ ai đã đọc state này?</div>
    <div class="row">
      <div class="node" id="re"><div class="nl">🔁 Recompose scope đó</div><div class="ns">Compose / @Observable</div></div>
      <div class="node" id="skip"><div class="nl">⏭️ Skip con stable</div><div class="ns">tham số không đổi</div></div>
    </div>
    <div class="arrow" id="a2">↓ danh sách dài</div>
    <div class="node" id="lazy"><div class="nl">📜 Lazy / tái sử dụng</div><div class="ns">chỉ ~12 view cho 10.000 dòng</div></div>
    <div class="arrow" id="a3">↓ identity / key ổn định</div>
    <div class="node" id="id"><div class="nl">🆔 Giữ đúng state từng dòng</div><div class="ns">key = id, không phải index</div></div>
  `,
  steps: [
    { title: "1 · State đổi, chỉ phần đọc nó bị tính lại", tab: "lazy", highlight: [1, 2, 8], on: ["state", "a1", "re", "skip"],
      desc: "<code>@Immutable</code> giúp Compose chắc chắn row là stable → ProductItem skip khi row không đổi." },
    { title: "2 · Đọc state muộn", tab: "defer", highlight: [2, 3, 6], on: ["re"],
      desc: "Đọc offset ở composition → recompose mỗi frame. Đọc trong lambda của <code>Modifier.offset { }</code> → chỉ chạy lại layout." },
    { title: "3 · derivedStateOf", tab: "defer", highlight: [9], on: ["skip"],
      desc: "Index đổi liên tục nhưng <code>showFab</code> chỉ đổi 2 lần → chỉ recompose khi boolean đổi." },
    { title: "4 · Danh sách lazy có key", tab: "lazy", highlight: [6, 7], on: ["a2", "lazy"],
      desc: "<code>key</code> giữ state đúng khi thêm/xoá; <code>contentType</code> giúp tái sử dụng node cùng loại." },
    { title: "5 · SwiftUI: identity ổn định", tab: "swift", highlight: [4, 9, 10], on: ["a3", "id"],
      desc: "Id từ dữ liệu, không phải index hay UUID() tạo mới — nếu không SwiftUI coi là view khác." },
    { title: "6 · UIKit: dequeue & prepareForReuse", tab: "reuse", highlight: [2, 5, 8], on: ["lazy"],
      desc: "Cell được tái chế; tải ảnh bất đồng bộ và huỷ yêu cầu cũ khi cell được dùng lại." }
  ],

  quiz: [
    { q: "Trong Compose, khi một State đổi thì phần nào bị recompose?", options: [
        "Toàn bộ màn hình", "Các scope đã đọc State đó (và con không skip được)", "Chỉ Activity", "Không có gì cho tới khi xoay màn"
      ], correct: 1, explanation: "Compose ghi nhận ai đọc state nào để recompose chính xác." },
    { q: "Điều kiện để Compose skip một composable là gì?", options: [
        "Composable không có tham số", "Tham số không đổi (so sánh được nhờ tính stable hoặc strong skipping)", "Nằm trong LazyColumn", "Được gọi trên IO"
      ], correct: 1, explanation: "@Immutable/@Stable giúp compiler tin tưởng so sánh equals." },
    { q: "Modifier.offset { } (lambda) tốt hơn Modifier.offset(x.dp) khi giá trị đổi mỗi frame vì…", options: [
        "Viết ngắn hơn", "State được đọc ở pha layout, tránh recomposition mỗi frame", "Chạy trên GPU", "Không khác"
      ], correct: 1, explanation: "Đọc state muộn = làm ít việc hơn." },
    { q: "Dùng index làm id cho ForEach/LazyColumn có vấn đề gì?", options: [
        "Không vấn đề", "Xoá/chèn phần tử làm id dịch chuyển → state và animation gắn nhầm dòng", "Không biên dịch", "Chậm mạng"
      ], correct: 1, explanation: "Id phải gắn với dữ liệu (vd product.id)." },
    { q: "Gắn .id(UUID()) cho một view SwiftUI sẽ…", options: [
        "Tối ưu hiệu năng", "Khiến view bị coi là mới mỗi lần render: mất @State, chạy lại .task", "Không ảnh hưởng", "Bắt buộc với List"
      ], correct: 1, explanation: "Identity đổi = view khác." },
    { q: "Vì sao RecyclerView/UITableView cuộn 10.000 dòng vẫn nhẹ?", options: [
        "Tải hết 10.000 view vào RAM", "Chỉ giữ số view đủ phủ màn hình và tái sử dụng chúng", "Dùng WebView", "Giảm độ phân giải"
      ], correct: 1, explanation: "Cell reuse + ảo hoá." },
    { q: "derivedStateOf dùng khi nào?", options: [
        "Gọi API", "Giá trị suy ra từ state đổi thường xuyên nhưng kết quả ít đổi (vd index > 0)", "Lưu vào DB", "Thay cho ViewModel"
      ], correct: 1, explanation: "Giảm recompose thừa." },
    { q: "Đặt 1.000 item trong Column + verticalScroll (không lazy) thì sao?", options: [
        "Tương đương LazyColumn", "Mọi item đều được compose/measure dù không nhìn thấy → chậm và tốn RAM", "Lỗi biên dịch", "Tự chuyển thành lazy"
      ], correct: 1, explanation: "Chỉ dùng Column cho danh sách nhỏ, cố định." },
    { q: "prepareForReuse() của UITableViewCell nên làm gì?", options: [
        "Tải lại toàn bộ bảng", "Huỷ tác vụ cũ (tải ảnh) và reset trạng thái trước khi cell được gán dữ liệu mới", "Giải phóng table view", "Gọi API mới"
      ], correct: 1, explanation: "Tránh ảnh của dòng cũ hiện ở dòng mới." }
  ]
});
