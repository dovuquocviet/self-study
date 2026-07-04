window.LESSONS.push({
  id: "06",
  phase: "1", phaseName: "Container & Bean",
  title: "Bean Scope",
  subtitle: "Singleton, prototype, và vì sao singleton là mặc định",

  theory: `
    <p><strong>Scope</strong> quyết định container tạo <em>bao nhiêu</em> instance cho một bean
    và <em>khi nào</em> tạo. Có hai scope cốt lõi:</p>
    <ul>
      <li><strong>singleton</strong> (mặc định): <strong>MỘT</strong> instance duy nhất cho mỗi
          container. Nó được tạo một lần rồi <strong>cache</strong> trong
          <code>singletonObjects</code>; mọi <code>getBean()</code> hay inject sau đó đều trả về
          <strong>CÙNG</strong> object.</li>
      <li><strong>prototype</strong>: <strong>MỖI</strong> lần <code>getBean()</code> / inject,
          container tạo một instance <strong>MỚI</strong>. Container KHÔNG giữ nó lại và
          KHÔNG gọi callback huỷ (destroy) cho prototype — client tự lo dọn dẹp.</li>
    </ul>
    <p>Ngoài ra trong <strong>web context</strong> còn có <code>request</code> (mỗi HTTP request
    một instance) và <code>session</code> (mỗi session một instance) — chỉ tồn tại khi chạy web.</p>
    <p><strong>Vì sao singleton là mặc định?</strong> Tạo một lần nên <em>hiệu năng</em> tốt,
    <em>tiết kiệm bộ nhớ</em>, và hầu hết service là <em>stateless</em> (không giữ trạng thái riêng
    của từng request) nên chia sẻ chung một instance là an toàn.</p>
    <div class="callout"><p>⚠️ <strong>Pitfall kinh điển:</strong> inject một bean
    <code>prototype</code> vào một bean <code>singleton</code>. Prototype chỉ được tiêm
    <strong>MỘT lần</strong> lúc singleton được tạo, nên sau đó bạn luôn dùng lại <em>cùng</em>
    một instance → mất tính prototype. Cách sửa: <code>ObjectProvider&lt;T&gt;</code>,
    <code>@Lookup</code>, hoặc gọi <code>getBean()</code> mỗi lần cần.</p></div>
  `,

  codeTabs: [
    { id: "scope", label: "🔁 Khai báo scope", lines: [
      "@Service                       // mặc định = singleton",
      "class EmailService { }",
      "",
      "@Service",
      "@Scope(\"prototype\")            // mỗi lần lấy = mới",
      "class ReportBuilder { }",
      "",
      "// Lấy bean 3 lần",
      "var a = ctx.getBean(EmailService.class);",
      "var b = ctx.getBean(EmailService.class);",
      "// a == b   (CÙNG một object, từ cache)",
      "",
      "var p1 = ctx.getBean(ReportBuilder.class);",
      "var p2 = ctx.getBean(ReportBuilder.class);",
      "// p1 != p2 (HAI object khác nhau)"
    ]},
    { id: "pitfall", label: "⚠️ Prototype trong singleton", lines: [
      "@Service                       // singleton",
      "class OrderProcessor {",
      "    // SAI: chỉ tiêm 1 lần lúc tạo singleton",
      "    @Autowired ReportBuilder builder;",
      "",
      "    // ĐÚNG: hỏi container mỗi lần cần",
      "    @Autowired ObjectProvider<ReportBuilder> provider;",
      "",
      "    void run() {",
      "        var b = provider.getObject();  // instance mới",
      "        b.build();",
      "    }",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="row">
      <div class="col">
        <div class="node" id="sHdr"><div class="nl">singleton (mặc định)</div><div class="ns">cache trong singletonObjects</div></div>
        <div class="node" id="sc1"><div class="nl">getBean() lần 1</div><div class="ns">tạo & cache</div></div>
        <div class="node" id="sc2"><div class="nl">getBean() lần 2</div><div class="ns">lấy từ cache</div></div>
        <div class="node" id="sc3"><div class="nl">getBean() lần 3</div><div class="ns">lấy từ cache</div></div>
        <div class="arrow" id="as">↓ luôn trả về</div>
        <div class="node" id="sA1"><div class="nl">#A1</div><div class="ns">MỘT instance duy nhất</div></div>
      </div>
      <div class="col">
        <div class="node" id="pHdr"><div class="nl">prototype</div><div class="ns">không cache, không destroy</div></div>
        <div class="node" id="pc1"><div class="nl">getBean() lần 1</div><div class="ns">→ #P1</div></div>
        <div class="node" id="pc2"><div class="nl">getBean() lần 2</div><div class="ns">→ #P2</div></div>
        <div class="node" id="pc3"><div class="nl">getBean() lần 3</div><div class="ns">→ #P3</div></div>
        <div class="arrow" id="ap">↓ mỗi lần một instance</div>
        <div class="node" id="pNew"><div class="nl">#P1 ≠ #P2 ≠ #P3</div><div class="ns">BA instance khác nhau</div></div>
      </div>
    </div>
    <div class="arrow" id="apit">↓ pitfall: prototype trong singleton</div>
    <div class="node" id="pit"><div class="nl">Tiêm ReportBuilder vào OrderProcessor</div><div class="ns">chỉ inject 1 lần → luôn dùng lại cùng #P1</div></div>
    <div class="arrow" id="afix">↓ cách sửa</div>
    <div class="node" id="fix"><div class="nl">ObjectProvider / @Lookup / getBean</div><div class="ns">hỏi container mỗi lần → lấy lại instance mới</div></div>
  `,
  steps: [
    { title: "1 · Singleton là mặc định", tab: "scope", highlight: [1, 2], on: ["sHdr"],
      desc: "Bean không khai báo scope thì mặc định là <code>singleton</code>: container chỉ tạo <strong>một</strong> instance và cache lại trong <code>singletonObjects</code>." },
    { title: "2 · getBean singleton 3 lần → cùng object", tab: "scope", highlight: [9, 10, 11], on: ["sc1", "sc2", "sc3", "as", "sA1"],
      desc: "Lần 1 tạo & cache; lần 2, 3 lấy thẳng từ cache. Vì vậy <code>a == b</code> — tất cả trỏ về cùng <code>#A1</code>. Đây là lý do singleton <em>tiết kiệm</em> bộ nhớ và hiệu năng." },
    { title: "3 · Khai báo prototype", tab: "scope", highlight: [4, 5, 6], on: ["pHdr"],
      desc: "<code>@Scope(\"prototype\")</code> bảo container: đừng cache, mỗi lần yêu cầu hãy tạo mới. Container cũng KHÔNG gọi callback <code>@PreDestroy</code> cho prototype." },
    { title: "4 · getBean prototype 3 lần → 3 object", tab: "scope", highlight: [13, 14, 15], on: ["pc1", "pc2", "pc3", "ap", "pNew"],
      desc: "Mỗi <code>getBean(ReportBuilder.class)</code> sinh một instance mới: <code>#P1</code>, <code>#P2</code>, <code>#P3</code> khác nhau, nên <code>p1 != p2</code>." },
    { title: "5 · Pitfall: prototype trong singleton", tab: "pitfall", highlight: [1, 3, 4], on: ["pit"],
      desc: "<code>OrderProcessor</code> là singleton nên chỉ được tạo <strong>một lần</strong>; lúc đó <code>builder</code> được tiêm <strong>một lần</strong>. Về sau bạn luôn dùng lại cùng <code>#P1</code> → tính prototype bị <em>mất</em>." },
    { title: "6 · Sửa bằng ObjectProvider", tab: "pitfall", highlight: [7, 10], on: ["fix"],
      desc: "Thay vì tiêm sẵn instance, tiêm một <code>ObjectProvider&lt;ReportBuilder&gt;</code> rồi gọi <code>provider.getObject()</code> mỗi lần cần — container tạo instance mới cho từng lần. (<code>@Lookup</code> hay <code>getBean()</code> cũng đạt hiệu quả tương tự.)" }
  ],

  quiz: [
    { q: "Với scope singleton, gọi getBean() nhiều lần trong cùng một container trả về gì?", options: [
        "Mỗi lần một instance mới",
        "Luôn CÙNG một instance duy nhất (được cache)",
        "Một instance mới cho mỗi thread",
        "null nếu bean đã được lấy trước đó"
      ], correct: 1,
      explanation: "Singleton tạo một lần và cache trong singletonObjects; mọi getBean/inject sau đó trả về cùng object đó." },
    { q: "Bean prototype được container tạo vào lúc nào?", options: [
        "Một lần khi container khởi động",
        "MỖI lần có yêu cầu (getBean/inject) tạo một instance mới",
        "Chỉ khi ứng dụng tắt",
        "Không bao giờ — prototype không được tạo"
      ], correct: 1,
      explanation: "Prototype không cache: mỗi lần getBean hoặc inject, container dựng một instance mới rồi giao cho client." },
    { q: "Container có gọi callback huỷ (destroy / @PreDestroy) cho bean prototype không?", options: [
        "Có, giống hệt singleton",
        "Không — container không giữ prototype nên không gọi destroy; client tự lo",
        "Có, nhưng chỉ khi bean implement DisposableBean",
        "Chỉ gọi trong web context"
      ], correct: 1,
      explanation: "Sau khi tạo và giao ra, container 'quên' prototype đi, nên không quản vòng đời huỷ — việc dọn dẹp là của client." },
    { q: "Vì sao inject một bean prototype vào một bean singleton lại 'mất' tính prototype, và sửa thế nào?", options: [
        "Không mất gì cả; mỗi lần dùng vẫn là instance mới",
        "Vì singleton tạo 1 lần nên prototype chỉ được tiêm 1 lần → luôn dùng lại cùng instance; sửa bằng ObjectProvider/@Lookup/getBean",
        "Vì prototype tự chuyển thành singleton khi bị inject",
        "Vì Spring cấm inject prototype; phải đổi sang singleton"
      ], correct: 1,
      explanation: "Singleton chỉ được khởi tạo một lần nên phụ thuộc prototype cũng chỉ tiêm một lần. Muốn lấy instance mới mỗi lần dùng, hãy hỏi container qua ObjectProvider.getObject(), @Lookup, hoặc getBean()." }
  ]
});
