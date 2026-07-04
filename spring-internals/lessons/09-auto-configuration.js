window.LESSONS.push({
  id: "09",
  phase: "2", phaseName: "Cấu hình",
  title: "Auto-configuration & @Conditional",
  subtitle: "Vì sao Spring Boot 'tự tạo cái nọ cái kia' cho bạn",

  theory: `
    <p><strong>@SpringBootApplication</strong> bên trong gồm cả
    <code>@EnableAutoConfiguration</code>. Chính annotation này bảo Spring Boot:
    "hãy nạp thêm một loạt class cấu hình có sẵn" — gọi là
    <strong>auto-configuration</strong> (tự động cấu hình).</p>
    <p>Danh sách các auto-config class được liệt kê trong file
    <code>META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports</code>
    nằm bên trong các <strong>starter jar</strong>. Đây là cách hiện tại
    (từ Boot 2.7+/3.x). Boot cũ dùng file <code>META-INF/spring.factories</code>
    với key <code>EnableAutoConfiguration</code> — cùng ý tưởng, khác vị trí.</p>
    <ul>
      <li>Mỗi auto-config class là một <code>@Configuration</code> bị "gác cổng"
          bằng <strong>@Conditional</strong>.</li>
      <li><code>@ConditionalOnClass</code> — chỉ chạy nếu class X có trên classpath
          (vd <code>DataSource</code>).</li>
      <li><code>@ConditionalOnMissingBean</code> — chỉ tạo bean nếu người dùng
          <strong>chưa</strong> tự định nghĩa (gọi là <em>back off</em> — nhường).</li>
      <li><code>@ConditionalOnProperty</code> — bật/tắt theo property trong config.</li>
    </ul>
    <div class="callout"><p>💡 Chuỗi quyết định:
    <strong>classpath</strong> (có class không?) + <strong>property</strong> (có bật không?)
    + <strong>bean hiện có</strong> (người dùng khai chưa?) → điều kiện quyết định
    auto-config có tạo bean hay không. Thêm starter là Boot tự lo; bạn tự khai bean
    là Boot NHƯỜNG cho bạn.</p></div>
  `,

  codeTabs: [
    { id: "autoconfig", label: "🔩 Một auto-config class", lines: [
      "@AutoConfiguration",
      "@ConditionalOnClass(DataSource.class)",
      "class DataSourceAutoConfiguration {",
      "",
      "    @Bean",
      "    @ConditionalOnMissingBean",
      "    DataSource dataSource(DataSourceProperties p) {",
      "        // Boot tự tạo pool (HikariDataSource)",
      "        return buildDataSource(p);",
      "    }",
      "}"
    ]},
    { id: "imports", label: "📄 File .imports", lines: [
      "# Nằm trong mỗi starter .jar, tại:",
      "# META-INF/spring/",
      "#   ...AutoConfiguration.imports",
      "org..jdbc.DataSourceAutoConfiguration",
      "org..web.WebMvcAutoConfiguration",
      "org..jackson.JacksonAutoConfiguration",
      "# Boot < 2.7: META-INF/spring.factories"
    ]}
  ],

  stageHtml: `
    <div class="node" id="enable"><div class="nl">@EnableAutoConfiguration</div><div class="ns">nằm trong @SpringBootApplication</div></div>
    <div class="arrow" id="a1">↓ đọc file</div>
    <div class="node" id="imp"><div class="nl">AutoConfiguration.imports</div><div class="ns">danh sách auto-config class</div></div>
    <div class="arrow" id="a2">↓ duyệt từng class</div>
    <div class="node" id="ac"><div class="nl">DataSourceAutoConfiguration</div><div class="ns">bị @Conditional gác cổng</div></div>
    <div class="arrow" id="a3">↓ kiểm tra điều kiện</div>
    <div class="row">
      <div class="node" id="hit"><div class="nl">✅ Điều kiện ĐẠT</div><div class="ns">tạo bean giúp bạn</div></div>
      <div class="node" id="backoff"><div class="nl">↩️ BACK OFF</div><div class="ns">bạn đã có bean → nhường</div></div>
    </div>
  `,
  steps: [
    { title: "1 · @EnableAutoConfiguration khởi động", tab: "imports", highlight: [1, 2, 3], on: ["enable", "a1", "imp"],
      desc: "<code>@SpringBootApplication</code> đã bao gồm <code>@EnableAutoConfiguration</code>. Nó bảo Boot tìm và đọc file <code>AutoConfiguration.imports</code> trong mọi starter jar trên classpath." },
    { title: "2 · Đọc danh sách auto-config", tab: "imports", highlight: [4, 5, 6], on: ["imp", "a2", "ac"],
      desc: "Mỗi dòng là một auto-config class ứng viên. Boot nạp cả danh sách này làm <strong>candidate</strong> — nhưng chưa vội tạo bean, còn phải qua cửa @Conditional." },
    { title: "3 · Mỗi class bị @Conditional gác cổng", tab: "autoconfig", highlight: [1, 2, 3], on: ["ac", "a3"],
      desc: "<code>@ConditionalOnClass(DataSource.class)</code> nghĩa là class này chỉ chạy nếu <code>DataSource</code> có mặt trên classpath — thứ mà starter JDBC kéo vào. Không có starter ⇒ bỏ qua." },
    { title: "4 · Điều kiện ĐẠT → tạo bean", tab: "autoconfig", highlight: [5, 6, 7], on: ["ac", "a3", "hit"],
      desc: "Qua cửa @ConditionalOnClass, tới <code>@ConditionalOnMissingBean</code>: nếu bạn <em>chưa</em> tự khai <code>DataSource</code>, điều kiện đạt và Boot tạo bean hộ bạn." },
    { title: "5 · Bạn đã có bean → BACK OFF", tab: "autoconfig", highlight: [6], on: ["ac", "backoff"],
      desc: "Nếu bạn tự <code>@Bean DataSource</code> của riêng mình, <code>@ConditionalOnMissingBean</code> thất bại ⇒ auto-config <strong>back off</strong> (nhường). Đây là lý do config của bạn luôn thắng." }
  ],

  quiz: [
    { q: "Hiện nay (Boot 2.7+/3.x), danh sách các auto-config class được liệt kê ở file nào?", options: [
        "application.properties",
        "META-INF/spring.factories",
        "META-INF/spring/org...AutoConfiguration.imports",
        "pom.xml / build.gradle"
      ], correct: 2,
      explanation: "Từ Boot 2.7+ dùng file META-INF/spring/...AutoConfiguration.imports trong starter jar. spring.factories là cách cũ (Boot < 2.7)." },
    { q: "@ConditionalOnMissingBean dùng để làm gì?", options: [
        "Xoá bean mà người dùng đã tạo",
        "Chỉ tạo bean nếu người dùng CHƯA tự định nghĩa — nếu có rồi thì 'back off' nhường",
        "Bắt buộc phải có sẵn một bean cùng loại",
        "Tạo bean nhiều lần cho mỗi request"
      ], correct: 1,
      explanation: "Đây là cơ chế 'back off': auto-config chỉ tạo bean mặc định khi bạn chưa khai; nếu bạn đã có bean thì nó nhường, config của bạn thắng." },
    { q: "Vì sao chỉ cần thêm một starter (dependency) là Spring Boot tự cấu hình giúp?", options: [
        "Vì starter chạy một script cấu hình khi cài",
        "Vì starter đưa class vào classpath, khiến @ConditionalOnClass đạt và auto-config kích hoạt",
        "Vì JVM tự nhận diện starter",
        "Vì starter ghi đè application.properties của bạn"
      ], correct: 1,
      explanation: "Starter kéo các class (vd DataSource) vào classpath. @ConditionalOnClass thấy class có mặt nên điều kiện đạt và auto-config tương ứng chạy." },
    { q: "Nếu bạn tự khai báo một @Bean DataSource của riêng mình thì auto-config DataSource làm gì?", options: [
        "Báo lỗi vì trùng bean",
        "Tạo thêm một DataSource thứ hai song song",
        "Back off — không tạo bean mặc định, để bean của bạn được dùng",
        "Ghi đè bean của bạn bằng bean mặc định"
      ], correct: 2,
      explanation: "Nhờ @ConditionalOnMissingBean, khi đã có DataSource do bạn khai, điều kiện không đạt nên auto-config nhường (back off) và bean của bạn được dùng." }
  ]
});
