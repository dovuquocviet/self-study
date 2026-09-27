window.LESSONS.push({
  id: "12",
  phase: "3", phaseName: "Giao diện mượt",
  title: "Danh sách dài: ảo hoá, tái sử dụng cell, FlatList vs FlashList",
  subtitle: "RecyclerView/LazyColumn · UICollectionView/List · windowSize · getItemLayout · recycling · key & contentType",

  theory: `
    <p>Danh sách 5.000 sản phẩm không thể tạo 5.000 view: tốn bộ nhớ và thời gian tạo. Mọi nền tảng giải quyết bằng hai kỹ thuật:</p>
    <ul>
      <li><strong>Ảo hoá (virtualization)</strong>: chỉ tạo view cho phần đang hiện + một vùng đệm.</li>
      <li><strong>Tái sử dụng (recycling)</strong>: cell cuộn ra khỏi màn hình được dùng lại cho item mới, chỉ đổ dữ liệu mới vào — không tạo view từ đầu.</li>
    </ul>

    <table>
      <tr><th>Nền tảng</th><th>Thành phần</th><th>Ảo hoá</th><th>Tái sử dụng view</th></tr>
      <tr><td>Android View</td><td><code>RecyclerView</code> + <code>ListAdapter</code>/DiffUtil</td><td>Có</td><td>Có (ViewHolder)</td></tr>
      <tr><td>Compose</td><td><code>LazyColumn</code></td><td>Có</td><td>Tái sử dụng node theo <code>contentType</code></td></tr>
      <tr><td>UIKit</td><td><code>UICollectionView</code>/<code>UITableView</code></td><td>Có</td><td>Có (dequeueReusableCell)</td></tr>
      <tr><td>SwiftUI</td><td><code>List</code>, <code>LazyVStack</code></td><td>Có</td><td><code>List</code> dựa trên collection view nên có tái sử dụng</td></tr>
      <tr><td>RN</td><td><code>FlatList</code></td><td>Có (theo cửa sổ)</td><td><strong>Không</strong> — item ra khỏi cửa sổ bị unmount, vào lại thì mount mới</td></tr>
      <tr><td>RN</td><td><code>FlashList</code> (Shopify)</td><td>Có</td><td><strong>Có</strong> — giữ component, đổi props</td></tr>
    </table>

    <p><strong>FlatList — các tham số quan trọng</strong> (mặc định): <code>initialNumToRender</code> 10, <code>maxToRenderPerBatch</code> 10, <code>windowSize</code> 21 (21 "màn hình" nội dung: 10 phía trên, 10 phía dưới, 1 đang hiện),
    <code>updateCellsBatchingPeriod</code> 50 ms. Giảm <code>windowSize</code> tiết kiệm bộ nhớ nhưng dễ thấy ô trắng khi cuộn nhanh.
    Nếu cell cao cố định, <code>getItemLayout</code> giúp bỏ bước đo từng cell và cho phép <code>scrollToIndex</code> chính xác.</p>

    <p><strong>FlashList v2</strong> (2025) chỉ chạy trên kiến trúc mới, không cần khai báo <code>estimatedItemSize</code> như v1. Lưu ý khi dùng recycling:</p>
    <ul>
      <li>Danh sách nhiều kiểu cell → khai báo <code>getItemType</code> để chỉ tái sử dụng cell cùng kiểu.</li>
      <li>Không đặt prop <code>key</code> bên trong cây của item (làm React tạo lại component, mất lợi ích tái sử dụng).</li>
      <li>State cục bộ trong cell sẽ "đi theo" cell sang item khác — phải reset theo item (v2 có <code>useRecyclingState</code>).</li>
    </ul>

    <p><strong>Quy tắc chung mọi nền tảng</strong></p>
    <ol>
      <li><strong>Key ổn định</strong> (id sản phẩm), không dùng index — để framework biết item nào dịch chuyển, item nào mới.</li>
      <li><strong>Cell nhẹ</strong>: không format/tính toán trong render/bind; chuẩn bị sẵn view model.</li>
      <li><strong>Ảnh đúng kích thước</strong> (bài 13) — nguyên nhân giật số 1 của danh sách sản phẩm.</li>
      <li><strong>Không lồng danh sách cuộn cùng chiều</strong>, không <code>ScrollView</code> + <code>map</code> cho danh sách dài.</li>
    </ol>

    <div class="callout"><p>💡 Chuyển FlatList → FlashList thường là thay đổi có lợi lớn nhất cho màn danh sách RN. Nhưng vẫn đo trước/sau: nếu cell nặng vì ảnh 4000px hay re-render thừa, đổi component list không giải quyết được gốc rễ.</p></div>
  `,

  codeTabs: [
    { id: "flat", label: "① FlatList", lines: [
      "<FlatList",
      "  data={products}",
      "  keyExtractor={p => p.id}                 // key ổn định, không dùng index",
      "  renderItem={renderItem}                   // hàm ổn định (định nghĩa ngoài hoặc useCallback)",
      "  getItemLayout={(_, index) => ({ length: 112, offset: 112 * index, index })}",
      "  initialNumToRender={8}                    // vừa đủ lấp màn đầu",
      "  maxToRenderPerBatch={8}",
      "  windowSize={11}                           // mặc định 21; nhỏ hơn = ít bộ nhớ, dễ thấy ô trắng",
      "  removeClippedSubviews                     // tách view ngoài màn khỏi cây native",
      "/>"
    ]},
    { id: "flash", label: "② FlashList v2", lines: [
      "import { FlashList } from '@shopify/flash-list';",
      "",
      "<FlashList",
      "  data={feed}",
      "  keyExtractor={item => item.id}",
      "  renderItem={renderItem}",
      "  getItemType={item => item.kind}           // 'banner' | 'product' | 'header'",
      "/>",
      "",
      "// ✗ Tránh trong cell: <View key={item.id}> ... → phá tái sử dụng",
      "// ✗ useState trong cell không reset → dữ liệu của item cũ lẫn sang item mới"
    ]},
    { id: "compose", label: "③ Compose LazyColumn", lines: [
      "LazyColumn {",
      "    items(",
      "        items = feed,",
      "        key = { it.id },                         // giữ state & animation đúng item",
      "        contentType = { it.kind }                // chỉ tái sử dụng node cùng loại",
      "    ) { item ->",
      "        when (item) {",
      "            is Banner  -> BannerRow(item)",
      "            is Product -> ProductRow(item.ui)     // ui đã format sẵn trong ViewModel",
      "        }",
      "    }",
      "}"
    ]},
    { id: "ios", label: "④ UIKit / SwiftUI", lines: [
      "// UIKit: diffable data source + tái sử dụng cell",
      "let reg = UICollectionView.CellRegistration<ProductCell, Product> { cell, _, p in",
      "    cell.configure(p.ui)                        // chỉ gán dữ liệu đã chuẩn bị",
      "}",
      "var snap = NSDiffableDataSourceSnapshot<Section, Product.ID>()",
      "snap.appendSections([.main]); snap.appendItems(products.map(\\.id))",
      "dataSource.apply(snap, animatingDifferences: true)",
      "",
      "// SwiftUI: id ổn định; LazyVStack chỉ tạo view khi xuất hiện",
      "ScrollView { LazyVStack { ForEach(products) { ProductRow(product: $0) } } }"
    ]}
  ],

  stageHtml: `
    <div class="node" id="data"><div class="nl">🗂️ 5.000 item dữ liệu</div><div class="ns">chỉ là mảng trong bộ nhớ</div></div>
    <div class="arrow" id="a1">↓ ảo hoá</div>
    <div class="node" id="win"><div class="nl">🪟 Cửa sổ render</div><div class="ns">màn hiện tại + vùng đệm (windowSize)</div></div>
    <div class="arrow" id="a2">↓ cuộn</div>
    <div class="row">
      <div class="node" id="unmount"><div class="nl">🗑️ FlatList</div><div class="ns">unmount → mount mới</div></div>
      <div class="node" id="recycle"><div class="nl">♻️ Recycling</div><div class="ns">FlashList · RecyclerView · UICollectionView</div></div>
    </div>
    <div class="arrow" id="a3">↓</div>
    <div class="node" id="rules"><div class="nl">✅ Key ổn định · cell nhẹ · ảnh đúng cỡ</div><div class="ns">áp dụng mọi nền tảng</div></div>
  `,
  steps: [
    { title: "1 · Chỉ render phần nhìn thấy", tab: "flat", highlight: [2, 6, 8], on: ["data", "a1", "win"],
      desc: "FlatList render theo cửa sổ. windowSize 11 nghĩa là khoảng 5 màn phía trên, 5 phía dưới và màn hiện tại." },
    { title: "2 · Bỏ bước đo cell", tab: "flat", highlight: [3, 4, 5], on: ["win"],
      desc: "Cell cao cố định 112 → getItemLayout trả offset trực tiếp, không cần render để đo." },
    { title: "3 · FlatList không tái sử dụng", tab: "flat", highlight: [9], on: ["a2", "unmount"],
      desc: "Item ra khỏi cửa sổ bị unmount; khi cuộn lại phải mount từ đầu — tốn JS và native." },
    { title: "4 · FlashList tái sử dụng cell", tab: "flash", highlight: [1, 7, 10, 11], on: ["recycle"],
      desc: "getItemType để cell banner không bị đem dùng cho product. Cẩn thận key và state cục bộ trong cell." },
    { title: "5 · Compose: key + contentType", tab: "compose", highlight: [4, 5, 9], on: ["recycle", "a3"],
      desc: "key giữ state đúng item khi danh sách thay đổi; contentType giúp tái sử dụng hiệu quả; dữ liệu format sẵn." },
    { title: "6 · iOS: diffable + registration", tab: "ios", highlight: [2, 3, 5, 7, 10], on: ["rules"],
      desc: "Snapshot theo id ổn định cho phép animation chèn/xoá đúng; cell chỉ gán dữ liệu đã chuẩn bị." }
  ],

  quiz: [
    { q: "Khác biệt cốt lõi giữa FlatList và FlashList?", options: [
        "FlashList không ảo hoá",
        "FlatList unmount item ra khỏi cửa sổ và mount mới khi cần; FlashList tái sử dụng component cho item mới",
        "FlatList chỉ chạy trên iOS",
        "Không khác"
      ], correct: 1, explanation: "Recycling giảm chi phí tạo component khi cuộn." },
    { q: "Giá trị mặc định của windowSize trong FlatList?", options: [
        "5", "10", "21", "50"
      ], correct: 2, explanation: "21 đơn vị chiều cao viewport." },
    { q: "getItemLayout giúp gì?", options: [
        "Tải ảnh nhanh hơn",
        "Bỏ bước đo kích thước từng cell khi chiều cao cố định, scrollToIndex chính xác",
        "Tăng windowSize",
        "Bật recycling"
      ], correct: 1, explanation: "FlatList không cần render để biết offset." },
    { q: "Trong FlashList, vì sao không nên đặt prop key bên trong cây component của item?", options: [
        "Vì gây lỗi cú pháp",
        "Vì key đổi làm React tạo lại component, mất lợi ích tái sử dụng",
        "Vì FlashList không hỗ trợ key",
        "Vì làm chậm mạng"
      ], correct: 1, explanation: "keyExtractor ở cấp list vẫn cần; key lồng bên trong cell thì tránh." },
    { q: "getItemType (FlashList) / contentType (Compose) dùng để làm gì?", options: [
        "Sắp xếp danh sách",
        "Chỉ tái sử dụng cell/node cùng loại, tránh biến cell banner thành cell product",
        "Đặt màu nền",
        "Lọc dữ liệu"
      ], correct: 1, explanation: "Danh sách không đồng nhất cần phân loại." },
    { q: "Vì sao không nên dùng index làm key?", options: [
        "Vì index là số",
        "Khi chèn/xoá, item dịch vị trí → framework gắn nhầm state/animation, render lại nhiều hơn",
        "Vì chậm hơn chuỗi",
        "Vì RN cấm"
      ], correct: 1, explanation: "Key phải gắn với danh tính của item." },
    { q: "Hiện tượng khi giảm windowSize quá nhỏ?", options: [
        "Tốn nhiều bộ nhớ hơn",
        "Dễ thấy ô trắng khi cuộn nhanh vì nội dung chưa kịp render",
        "App crash",
        "Không đổi gì"
      ], correct: 1, explanation: "Đánh đổi bộ nhớ và độ trống." },
    { q: "FlashList v2 có yêu cầu gì về kiến trúc?", options: [
        "Chỉ chạy kiến trúc cũ",
        "Chỉ chạy trên kiến trúc mới của RN",
        "Cần Flipper",
        "Cần Expo Go"
      ], correct: 1, explanation: "v2 viết lại cho new architecture, bỏ estimatedItemSize." },
    { q: "Cách nào SAI khi hiển thị 3.000 sản phẩm trong RN?", options: [
        "FlashList với keyExtractor",
        "ScrollView + products.map(...)",
        "FlatList với getItemLayout",
        "Phân trang từ server"
      ], correct: 1, explanation: "ScrollView render hết mọi item cùng lúc." }
  ]
});
