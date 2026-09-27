window.LESSONS.push({
  id: "02",
  phase: "0", phaseName: "Khởi động",
  title: "Cargo & crate — Maven/Gradle của Rust",
  subtitle: "rustup · cargo new/build/run/check/test · Cargo.toml · Cargo.lock · crates.io · workspace",

  theory: `
    <p>Trong Java bạn cần JDK + Maven/Gradle + plugin format + plugin test. Rust gom tất cả vào một bộ chính thức:</p>
    <ul>
      <li><strong>rustup</strong>: cài và chuyển phiên bản toolchain (giống SDKMAN cho JDK). Kênh <code>stable</code> ra bản mới mỗi 6 tuần.</li>
      <li><strong>rustc</strong>: trình biên dịch (giống <code>javac</code>, nhưng ra mã máy). Bạn hiếm khi gọi trực tiếp.</li>
      <li><strong>cargo</strong>: build tool + package manager + test runner + doc generator (Maven + JUnit runner + Javadoc gộp một).</li>
    </ul>

    <p><strong>Crate và package</strong></p>
    <ul>
      <li><strong>Crate</strong> = đơn vị biên dịch: một cây module, gốc là <code>src/main.rs</code> (crate binary, ra file chạy) hoặc <code>src/lib.rs</code> (crate library). Gần giống một "artifact".</li>
      <li><strong>Package</strong> = thư mục có <code>Cargo.toml</code>, chứa tối đa 1 lib crate và nhiều bin crate.</li>
      <li><strong>crates.io</strong> = kho thư viện công khai, như Maven Central. Tài liệu tự sinh ở <code>docs.rs</code>.</li>
    </ul>

    <table>
      <tr><th>Maven / Gradle</th><th>Cargo</th></tr>
      <tr><td><code>pom.xml</code> / <code>build.gradle</code></td><td><code>Cargo.toml</code> (TOML)</td></tr>
      <tr><td>&lt;dependency&gt; groupId:artifactId:version</td><td><code>serde = "1"</code> dưới <code>[dependencies]</code></td></tr>
      <tr><td>Lock phiên bản (Gradle lockfile, ít dùng)</td><td><code>Cargo.lock</code> sinh tự động — commit với ứng dụng</td></tr>
      <tr><td><code>mvn compile</code></td><td><code>cargo check</code> (chỉ kiểm tra, không sinh binary — nhanh nhất)</td></tr>
      <tr><td><code>mvn package</code></td><td><code>cargo build --release</code> → <code>target/release/ten-app</code></td></tr>
      <tr><td><code>mvn test</code></td><td><code>cargo test</code></td></tr>
      <tr><td>multi-module project</td><td><strong>workspace</strong> (dùng chung Cargo.lock và target/)</td></tr>
      <tr><td>Checkstyle / Spotless</td><td><code>cargo clippy</code> (lint) · <code>cargo fmt</code> (format)</td></tr>
    </table>

    <p><strong>Phiên bản</strong>: Cargo hiểu <code>"1.2"</code> là <code>^1.2</code> — chấp nhận mọi 1.x.y ≥ 1.2.0 (SemVer), không nhảy lên 2.0.
    <code>Cargo.lock</code> ghim bản chính xác; <code>cargo update</code> mới nâng. <strong>Features</strong> bật/tắt phần tuỳ chọn của crate
    (vd <code>tokio = { version = "1", features = ["full"] }</code>) — giống kiểu chọn starter trong Spring nhưng ở mức biên dịch.</p>

    <p><strong>Edition</strong> (<code>edition = "2024"</code>): bộ quy tắc ngôn ngữ; crate khác edition vẫn dùng chung được. Debug build (mặc định) nhanh biên dịch, chạy chậm;
    luôn đo hiệu năng bằng <code>--release</code>.</p>

    <div class="callout"><p>💡 Thói quen tốt: sửa code → <code>cargo check</code> liên tục (vài giây), chỉ <code>cargo run</code> khi cần chạy. Và chạy <code>cargo clippy</code> —
    nó dạy bạn viết Rust "đúng chất" nhanh hơn đọc sách.</p></div>
  `,

  codeTabs: [
    { id: "cli", label: "Lệnh cargo", lines: [
      "$ curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh   # cài rustup",
      "$ cargo new order-svc          # tạo crate binary (src/main.rs)",
      "$ cargo new --lib pricing      # tạo crate library (src/lib.rs)",
      "$ cd order-svc",
      "$ cargo add serde --features derive   # thêm dependency vào Cargo.toml",
      "$ cargo check                  # kiểm tra kiểu, không sinh binary",
      "$ cargo run                    # build debug + chạy",
      "$ cargo build --release        # binary tối ưu: target/release/order-svc",
      "$ cargo test                   # chạy test",
      "$ cargo clippy && cargo fmt    # lint + format"
    ]},
    { id: "toml", label: "Cargo.toml", lines: [
      "[package]",
      "name = \"order-svc\"",
      "version = \"0.1.0\"",
      "edition = \"2024\"",
      "",
      "[dependencies]",
      "serde = { version = \"1\", features = [\"derive\"] }",
      "tokio = { version = \"1\", features = [\"full\"] }",
      "anyhow = \"1\"",
      "",
      "[dev-dependencies]            # chỉ dùng khi test (như <scope>test</scope>)",
      "pretty_assertions = \"1\"",
      "",
      "[profile.release]",
      "lto = true                    # tối ưu xuyên crate, binary nhỏ/nhanh hơn"
    ]},
    { id: "tree", label: "Cấu trúc thư mục", lines: [
      "order-svc/",
      "├── Cargo.toml        # khai báo package + dependency",
      "├── Cargo.lock        # phiên bản chính xác đã resolve (commit cho app)",
      "├── src/",
      "│   ├── main.rs       # gốc crate binary: fn main()",
      "│   ├── lib.rs        # (tuỳ chọn) gốc crate library",
      "│   └── bin/tool.rs   # thêm binary phụ: cargo run --bin tool",
      "├── tests/            # integration test",
      "├── benches/          # benchmark",
      "└── target/           # output build (như target/ của Maven) - gitignore"
    ]},
    { id: "ws", label: "Workspace", lines: [
      "# Cargo.toml ở thư mục gốc (giống parent pom multi-module)",
      "[workspace]",
      "resolver = \"3\"",
      "members = [\"order-svc\", \"pricing\", \"common\"]",
      "",
      "[workspace.dependencies]     # quản lý version tập trung (như dependencyManagement)",
      "serde = { version = \"1\", features = [\"derive\"] }",
      "",
      "# order-svc/Cargo.toml",
      "[dependencies]",
      "serde = { workspace = true }",
      "pricing = { path = \"../pricing\" }   # phụ thuộc crate nội bộ"
    ]},
    { id: "cmp", label: "Java ↔ Rust", lines: [
      "// Maven                                   // Cargo",
      "// <groupId>com.fasterxml.jackson.core     serde = \"1\"",
      "//   jackson-databind 2.17.0</...>         serde_json = \"1\"",
      "// mvn dependency:tree                     cargo tree",
      "// mvn versions:display-dependency-updates cargo update --dry-run",
      "// mvn javadoc:javadoc                     cargo doc --open",
      "// mvn spring-boot:run                     cargo run",
      "// java -jar app.jar (cần JRE)             ./target/release/app (không cần runtime)"
    ]}
  ],

  stageHtml: `
    <div class="node" id="toml"><div class="nl">📄 Cargo.toml</div><div class="ns">khai báo dependency, features</div></div>
    <div class="arrow" id="a1">↓ resolve SemVer</div>
    <div class="node" id="lock"><div class="nl">🔒 Cargo.lock</div><div class="ns">ghim bản chính xác, tải từ crates.io</div></div>
    <div class="arrow" id="a2">↓ rustc biên dịch từng crate</div>
    <div class="row">
      <div class="node" id="dbg"><div class="nl">🐢 target/debug</div><div class="ns">cargo run: build nhanh</div></div>
      <div class="node" id="rel"><div class="nl">🚀 target/release</div><div class="ns">--release: tối ưu</div></div>
    </div>
  `,
  steps: [
    { title: "1 · Tạo project", tab: "cli", highlight: [2, 3, 5], on: ["toml"],
      desc: "<code>cargo new</code> tạo sẵn Cargo.toml, src/main.rs, .gitignore và git repo. <code>cargo add</code> sửa Cargo.toml hộ bạn." },
    { title: "2 · Khai báo dependency", tab: "toml", highlight: [4, 7, 8, 11], on: ["toml"],
      desc: "<code>\"1\"</code> nghĩa là ^1: mọi bản 1.x. Features bật phần tuỳ chọn, giảm thời gian biên dịch nếu không cần." },
    { title: "3 · Lock phiên bản", tab: "tree", highlight: [2, 3], on: ["a1", "lock"],
      desc: "Lần build đầu, Cargo resolve và ghi Cargo.lock. Các lần sau build lại đúng những bản đó — build tái lập được." },
    { title: "4 · Biên dịch", tab: "cli", highlight: [6, 7, 8], on: ["a2", "dbg", "rel"],
      desc: "check chỉ kiểm tra kiểu; run build debug; build --release bật tối ưu. Đo hiệu năng luôn dùng release." },
    { title: "5 · Nhiều crate = workspace", tab: "ws", highlight: [2, 4, 6, 11, 12], on: ["toml"],
      desc: "Giống Maven multi-module: chung Cargo.lock, chung thư mục target/, version tập trung ở workspace.dependencies." }
  ],

  quiz: [
    { q: "Lệnh nào kiểm tra lỗi kiểu nhanh nhất mà không sinh binary?", options: [
        "cargo build", "cargo check", "cargo run", "rustc --release"
      ], correct: 1, explanation: "cargo check bỏ qua bước sinh mã máy nên nhanh hơn nhiều." },
    { q: "<code>serde = \"1.0.200\"</code> trong Cargo.toml chấp nhận phiên bản nào?", options: [
        "Chỉ đúng 1.0.200",
        "Mọi bản ≥ 1.0.200 và &lt; 2.0.0",
        "Mọi phiên bản mới nhất, kể cả 2.x",
        "Chỉ 1.0.x"
      ], correct: 1, explanation: "Mặc định là caret requirement (^), tương thích theo SemVer." },
    { q: "Cargo.lock có vai trò gì?", options: [
        "Khoá không cho sửa Cargo.toml",
        "Ghi phiên bản chính xác đã resolve để build tái lập được",
        "Lưu mật khẩu crates.io",
        "Khoá file khi đang build"
      ], correct: 1, explanation: "Với ứng dụng (binary) nên commit Cargo.lock." },
    { q: "\"Crate\" trong Rust gần nhất với khái niệm nào?", options: [
        "Một class Java",
        "Một đơn vị biên dịch (library hoặc binary), gốc là lib.rs hoặc main.rs",
        "Một method",
        "Một thread"
      ], correct: 1, explanation: "Crate là đơn vị rustc biên dịch; package có Cargo.toml chứa các crate." },
    { q: "Tương đương multi-module Maven trong Cargo là gì?", options: [
        "Feature", "Workspace", "Profile", "Edition"
      ], correct: 1, explanation: "Workspace gom nhiều package, dùng chung lock và target." },
    { q: "Binary build bằng <code>cargo build --release</code> nằm ở đâu?", options: [
        "build/libs/", "target/release/", "out/", "bin/"
      ], correct: 1, explanation: "Debug nằm ở target/debug/." },
    { q: "Muốn đo hiệu năng service Rust, nên dùng build nào?", options: [
        "Debug (cargo run) là đủ",
        "Release (--release), vì debug không tối ưu và có thể chậm hơn nhiều lần",
        "Không khác nhau",
        "Chỉ dùng cargo check"
      ], correct: 1, explanation: "Debug build tắt tối ưu, thêm kiểm tra tràn số — không phản ánh production." },
    { q: "<code>[dev-dependencies]</code> tương đương gì trong Maven?", options: [
        "scope compile", "scope test", "scope provided", "plugin"
      ], correct: 1, explanation: "Chỉ dùng cho test, example, benchmark — không vào binary chính." },
    { q: "Công cụ lint chính thức của Rust là gì?", options: [
        "rustfmt", "clippy", "rustdoc", "miri"
      ], correct: 1, explanation: "cargo clippy gợi ý hàng trăm lỗi/phong cách; cargo fmt để format." }
  ]
});
