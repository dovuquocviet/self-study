window.LESSONS.push({
  id: "16",
  phase: "3", phaseName: "SwiftUI",
  title: "Layout: stack, List, Lazy và thuật toán đề xuất kích thước",
  subtitle: "Cha đề xuất → con chọn → cha đặt · VStack/HStack/ZStack · Spacer · List vs LazyVStack · so với Flexbox",

  theory: `
    <p>RN dùng Flexbox (Yoga). SwiftUI có thuật toán layout riêng, đơn giản hơn nhưng khác tư duy. Ba bước, lặp đệ quy từ gốc xuống:</p>
    <ol>
      <li><strong>Cha đề xuất</strong> một kích thước cho con (proposed size, ví dụ "bạn có tối đa 390 × 844").</li>
      <li><strong>Con tự chọn</strong> kích thước của mình (có thể nhỏ hơn, bằng, thậm chí lớn hơn đề xuất). Cha <em>không ép</em> được con.</li>
      <li><strong>Cha đặt con</strong> vào vị trí (theo alignment).</li>
    </ol>
    <p>Mỗi view có "tính cách" riêng: <code>Text</code> chỉ lấy vừa đủ chữ (xuống dòng nếu thiếu chỗ); <code>Image</code> mặc định giữ kích thước gốc (cần <code>.resizable()</code>); <code>Color</code>, <code>Spacer</code> lấy hết chỗ được đề xuất; <code>.frame(width: 100)</code> là một view bọc đề xuất 100 cho con.</p>

    <p><strong>Các container</strong></p>
    <table>
      <tr><th>SwiftUI</th><th>Làm gì</th><th>RN / Flexbox</th></tr>
      <tr><td><code>VStack(alignment: .leading, spacing: 8)</code></td><td>Xếp dọc</td><td><code>flexDirection: 'column'</code>, <code>gap</code></td></tr>
      <tr><td><code>HStack</code></td><td>Xếp ngang</td><td><code>flexDirection: 'row'</code></td></tr>
      <tr><td><code>ZStack</code></td><td>Chồng lớp theo trục z</td><td><code>position: 'absolute'</code></td></tr>
      <tr><td><code>Spacer()</code></td><td>Đẩy, chiếm chỗ trống</td><td><code>flex: 1</code> view rỗng</td></tr>
      <tr><td><code>.frame(maxWidth: .infinity)</code></td><td>Lấp đầy chiều ngang</td><td><code>alignSelf: 'stretch'</code></td></tr>
      <tr><td><code>ScrollView { LazyVStack }</code></td><td>Cuộn, tạo view con khi cần</td><td><code>FlatList</code> (không tái sử dụng cell)</td></tr>
      <tr><td><code>List</code></td><td>Danh sách kiểu hệ thống, lazy, có swipe action, section</td><td><code>FlatList</code>/<code>SectionList</code></td></tr>
      <tr><td><code>Grid</code>, <code>LazyVGrid</code></td><td>Lưới</td><td><code>flexWrap</code> / FlatList numColumns</td></tr>
    </table>

    <p><strong>Stack thường vs Lazy</strong>: <code>VStack</code> tạo và tính layout <em>tất cả</em> con ngay lập tức — 1000 dòng trong <code>ScrollView { VStack }</code> sẽ chậm. <code>LazyVStack</code> chỉ tạo view khi sắp hiện (nhưng giữ lại view đã tạo). <code>List</code> dựa trên collection view của UIKit nên có <strong>tái sử dụng cell</strong> — phù hợp danh sách rất dài. Trong Lazy stack, <code>.task</code>/<code>.onAppear</code> của từng dòng là nơi tốt để phân trang (load more).</p>

    <p><strong>Ưu tiên khi thiếu chỗ</strong>: HStack chia chỗ cho con "kém linh hoạt" trước. Dùng <code>.layoutPriority(1)</code> để giữ một Text không bị cắt, <code>.lineLimit(1)</code>, <code>.fixedSize()</code> để con dùng kích thước lý tưởng. Muốn biết kích thước cha: <code>GeometryReader</code> (dùng tiết kiệm) hoặc <code>containerRelativeFrame</code> (iOS 17). Cần layout tuỳ biến: protocol <code>Layout</code> (iOS 16).</p>

    <div class="callout"><p>💡 Khác Flexbox lớn nhất: không có "cha ép con co giãn" (<code>flexShrink</code>); con luôn là người quyết định kích thước. Khi layout lạ, tự hỏi: "cha đề xuất gì, con chọn gì?" — thêm <code>.border(.red)</code> để nhìn khung thật.</p></div>
  `,

  codeTabs: [
    { id: "stack", label: "Stack & Spacer", lines: [
      "struct ProductCard: View {",
      "    let p: Product",
      "    var body: some View {",
      "        HStack(alignment: .top, spacing: 12) {",
      "            AsyncImage(url: p.imageURL) { $0.resizable().scaledToFill() } placeholder: { Color.gray.opacity(0.2) }",
      "                .frame(width: 72, height: 72)",
      "                .clipShape(.rect(cornerRadius: 8))",
      "                .accessibilityHidden(true)",
      "            VStack(alignment: .leading, spacing: 4) {",
      "                Text(p.name).font(.headline).lineLimit(2)",
      "                Text(p.price, format: .currency(code: \"VND\")).foregroundStyle(.secondary)",
      "            }",
      "            Spacer()                      // đẩy nội dung sang trái",
      "        }",
      "    }",
      "}"
    ]},
    { id: "zstack", label: "ZStack & overlay", lines: [
      "ZStack(alignment: .topTrailing) {",
      "    Image(systemName: \"cart\").font(.title)",
      "    Text(\"3\")",
      "        .font(.caption2).padding(4)",
      "        .background(.red, in: .circle)",
      "        .foregroundStyle(.white)",
      "}",
      "",
      "// thường gọn hơn: .overlay(alignment: .topTrailing) { Badge() }"
    ]},
    { id: "lists", label: "List vs Lazy", lines: [
      "// 1000 dòng: VStack tạo hết ngay → chậm",
      "ScrollView { VStack { ForEach(products) { ProductCard(p: $0) } } }",
      "",
      "// LazyVStack: tạo khi sắp hiện, hợp để load more",
      "ScrollView {",
      "    LazyVStack(spacing: 12) {",
      "        ForEach(products) { p in",
      "            ProductCard(p: p)",
      "                .task { if p.id == products.last?.id { await model.loadMore() } }",
      "        }",
      "    }",
      "}",
      "",
      "// List: kiểu hệ thống, tái sử dụng cell, swipe action",
      "List(orders) { o in OrderRow(o: o) }"
    ]},
    { id: "algo", label: "Thuật toán", lines: [
      "// Màn hình đề xuất 390 × 844 cho HStack",
      "HStack {",
      "    Text(\"Tên sản phẩm rất dài…\")     // chọn: vừa chữ, có thể xuống dòng",
      "    Spacer()                            // chọn: mọi chỗ trống còn lại",
      "    Text(\"99.000đ\").layoutPriority(1)  // được chia chỗ trước, không bị cắt",
      "}",
      ".frame(height: 44)                      // view bọc: đề xuất chiều cao 44",
      ".border(.red)                           // debug: nhìn khung thật"
    ]},
    { id: "rn", label: "React Native", lines: [
      "<View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>",
      "  <Image source={{ uri }} style={{ width: 72, height: 72, borderRadius: 8 }} />",
      "  <View style={{ flex: 1, gap: 4 }}>",
      "    <Text numberOfLines={2}>{p.name}</Text>",
      "    <Text>{price}</Text>",
      "  </View>",
      "</View>",
      "<FlatList data={products} renderItem={...} onEndReached={loadMore} />"
    ]}
  ],

  stageHtml: `
    <div class="node" id="parent"><div class="nl">Cha (HStack)</div><div class="ns">có 390 × 44</div></div>
    <div class="arrow" id="a1">↓ ① đề xuất kích thước cho từng con</div>
    <div class="row">
      <div class="node" id="t1"><div class="nl">Text tên</div><div class="ns">chọn vừa chữ</div></div>
      <div class="node" id="sp"><div class="nl">Spacer</div><div class="ns">chọn chỗ còn lại</div></div>
      <div class="node" id="t2"><div class="nl">Text giá</div><div class="ns">layoutPriority 1</div></div>
    </div>
    <div class="arrow" id="a2">↑ ② con báo kích thước đã chọn</div>
    <div class="node" id="place"><div class="nl">③ Cha đặt vị trí</div><div class="ns">theo alignment & spacing</div></div>
  `,
  steps: [
    { title: "1 · HStack + VStack lồng nhau", tab: "stack", highlight: [4, 9, 10, 11, 13], on: ["parent"],
      desc: "alignment và spacing đặt trên stack. <code>Spacer</code> đẩy nội dung sang trái như <code>flex: 1</code>." },
    { title: "2 · frame là view bọc", tab: "stack", highlight: [5, 6, 7, 8], on: ["a1"],
      desc: "<code>.frame(72×72)</code> đề xuất 72×72 cho ảnh; <code>.resizable()</code> cho phép ảnh chấp nhận kích thước đó." },
    { title: "3 · Thuật toán 3 bước", tab: "algo", highlight: [2, 3, 4, 5, 7], on: ["t1", "sp", "t2", "a2"],
      desc: "Con quyết định kích thước. <code>layoutPriority</code> cho Text giá được chia chỗ trước." },
    { title: "4 · Cha đặt vị trí; debug bằng border", tab: "algo", highlight: [8], on: ["place"],
      desc: "Khi layout lạ, thêm <code>.border</code> để thấy mỗi view thật sự chọn kích thước gì." },
    { title: "5 · ZStack & overlay", tab: "zstack", highlight: [1, 5, 9], on: ["parent"],
      desc: "Chồng lớp với alignment; <code>.overlay</code> thường gọn hơn và kích thước theo view gốc." },
    { title: "6 · Danh sách dài", tab: "lists", highlight: [2, 6, 9, 15], on: ["parent"],
      desc: "VStack tạo hết; LazyVStack tạo khi cần; List tái sử dụng cell. Load more bằng <code>.task</code> trên dòng cuối." }
  ],

  quiz: [
    { q: "Thứ tự thuật toán layout SwiftUI?", options: [
        "Con đề xuất, cha chọn",
        "Cha đề xuất kích thước → con tự chọn kích thước → cha đặt vị trí con",
        "Cha ép kích thước cho con như flexShrink",
        "Tính toàn cục bằng constraint solver"
      ], correct: 1, explanation: "Con luôn là bên quyết định kích thước của mình." },
    { q: "Image hiển thị ảnh 2000px bị tràn khung dù có .frame(width: 72). Thiếu gì?", options: [
        ".resizable() (và thường .scaledToFill/.scaledToFit)", ".padding()", ".clipped() là đủ", ".id()"
      ], correct: 0, explanation: "Mặc định Image giữ kích thước gốc." },
    { q: "Tương đương flexDirection: 'row' là?", options: [
        "VStack", "HStack", "ZStack", "List"
      ], correct: 1, explanation: "HStack xếp ngang." },
    { q: "ScrollView { VStack { ForEach(1000 phần tử) } } có vấn đề gì?", options: [
        "Không cuộn được",
        "VStack tạo và layout tất cả con ngay, tốn thời gian/bộ nhớ",
        "Không hiển thị gì",
        "Không có vấn đề"
      ], correct: 1, explanation: "Dùng LazyVStack hoặc List." },
    { q: "Khác biệt List và LazyVStack?", options: [
        "Không khác",
        "List dựa trên collection view hệ thống, tái sử dụng cell, có style/swipe action; LazyVStack tạo lười nhưng giữ view đã tạo và tự do style",
        "LazyVStack tái sử dụng cell, List thì không",
        "List không lazy"
      ], correct: 1, explanation: "Chọn List cho danh sách chuẩn rất dài; LazyVStack cho layout tuỳ biến." },
    { q: "Spacer() trong HStack làm gì?", options: [
        "Thêm khoảng cách cố định 8pt", "Chiếm toàn bộ chỗ trống còn lại theo trục của stack", "Xuống dòng", "Ẩn view"
      ], correct: 1, explanation: "Giống một view flex: 1 rỗng." },
    { q: ".frame(maxWidth: .infinity) nghĩa là?", options: [
        "Crash", "View bọc lấy toàn bộ chiều ngang được đề xuất", "Chiều rộng 0", "Cuộn ngang"
      ], correct: 1, explanation: "Hay dùng để nút full-width." },
    { q: "Text giá bị cắt thành '99.0…' trong HStack chật. Cách đơn giản để ưu tiên nó?", options: [
        ".layoutPriority(1)", ".zIndex(1)", ".id(1)", ".opacity(1)"
      ], correct: 0, explanation: "Stack chia chỗ cho con có priority cao trước." },
    { q: "Nơi tốt để kích hoạt 'load more' trong LazyVStack?", options: [
        "Trong body của view cha",
        ".task hoặc .onAppear của phần tử cuối (hoặc gần cuối)",
        "Timer mỗi giây",
        "init của View"
      ], correct: 1, explanation: "Phần tử được tạo khi sắp hiển thị." }
  ]
});
