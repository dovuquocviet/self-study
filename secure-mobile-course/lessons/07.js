window.LESSONS.push({
  id: "07",
  phase: "1", phaseName: "Dữ liệu trên thiết bị",
  title: "Database & file cục bộ",
  subtitle: "SQLite mã hoá (SQLCipher) · cache HTTP & ảnh · file tạm · external storage · Data Protection của iOS",

  theory: `
    <p>App offline-first, app chat, app ghi chú… đều lưu nhiều dữ liệu người dùng trong <strong>database cục bộ</strong> (SQLite, Room, Core Data, Realm, Isar, WatermelonDB…)
    và <strong>file</strong> (ảnh, PDF, file tải về). Khối dữ liệu này thường lớn và nhạy cảm hơn token nhiều, nhưng hay bị bỏ quên.</p>

    <p><strong>1. SQLite mặc định KHÔNG mã hoá</strong></p>
    <ul>
      <li>Room (Android), Core Data / SwiftData (iOS), sqflite / drift (Flutter), react-native-sqlite, WatermelonDB… đều ghi file <code>.db</code>/<code>.sqlite</code> dạng thường.</li>
      <li>Ai có file (máy root, backup, công cụ debug) mở bằng trình xem SQLite là thấy hết tin nhắn, lịch sử giao dịch.</li>
      <li>Các file phụ <code>-wal</code>, <code>-shm</code>, <code>-journal</code> cũng chứa dữ liệu — mã hoá/xoá phải tính cả chúng.</li>
    </ul>

    <p><strong>2. Mã hoá database: SQLCipher và tương đương</strong></p>
    <ul>
      <li><strong>SQLCipher</strong>: bản SQLite mã hoá toàn bộ file (AES-256) theo trang. Có bản cho Android (tích hợp với Room qua <code>SupportFactory</code>),
        iOS, React Native (op-sqlite, react-native-sqlcipher…), Flutter (sqflite_sqlcipher, sqlcipher_flutter_libs cho drift).</li>
      <li>Realm có tuỳ chọn <code>encryptionKey</code> 64 byte. Isar/Hive có chế độ mã hoá với khoá do bạn cung cấp.</li>
      <li>Điểm mấu chốt: <strong>khoá DB lấy ở đâu?</strong> Sinh ngẫu nhiên (CSPRNG) lần đầu, cất vào Keychain/Keystore (bài 04–05).
        Không viết cứng, không dẫn từ device ID, không dẫn từ tên người dùng.</li>
      <li>Nếu dữ liệu cực nhạy cảm và chấp nhận nhập mật khẩu/PIN mỗi lần mở: dẫn khoá từ mật khẩu bằng hàm chậm (PBKDF2/Argon2 với salt ngẫu nhiên).</li>
    </ul>

    <p><strong>3. iOS Data Protection — mã hoá file ở mức OS</strong></p>
    <ul>
      <li>Mỗi file trên iOS có một <em>protection class</em>. Mặc định là <code>completeUntilFirstUserAuthentication</code> — sau lần mở khoá đầu tiên file đọc được cả khi máy khoá lại.</li>
      <li>Với file nhạy cảm không cần đọc khi máy khoá: dùng <code>.complete</code> (<code>FileProtectionType.complete</code>) — khoá máy là file không đọc được.</li>
      <li>Android có mã hoá toàn bộ/theo file của thiết bị, nhưng nó bảo vệ khi <em>máy tắt/khoá</em>; khi app đang chạy thì file đọc được bình thường → vẫn cần mã hoá cấp app cho dữ liệu nhạy cảm.</li>
    </ul>

    <p><strong>4. Cache — nơi dữ liệu trốn</strong></p>
    <table>
      <tr><th>Loại cache</th><th>Rủi ro</th><th>Cách xử lý</th></tr>
      <tr><td>HTTP cache (URLCache, OkHttp Cache)</td><td>Response API chứa dữ liệu cá nhân nằm trong thư mục cache</td><td>Server trả <code>Cache-Control: no-store</code> cho API nhạy cảm; hoặc tắt cache cho các request đó; xoá cache khi logout</td></tr>
      <tr><td>Cache ảnh (Glide, SDWebImage, FastImage, cached_network_image)</td><td>Ảnh giấy tờ, ảnh riêng tư lưu lại</td><td>Tắt disk cache cho ảnh nhạy cảm; xoá khi logout</td></tr>
      <tr><td>WebView cache/cookie</td><td>Phiên đăng nhập web, trang đã xem</td><td>Xoá khi logout (bài 16)</td></tr>
      <tr><td>State persist (redux-persist, HydratedBloc…)</td><td>Toàn bộ store kể cả token ghi xuống AsyncStorage/file</td><td>Loại trừ slice nhạy cảm (blacklist) hoặc dùng storage mã hoá</td></tr>
    </table>

    <p><strong>5. File tạm và file xuất ra</strong></p>
    <ul>
      <li>File tạm (PDF sao kê vừa tải, ảnh vừa chụp để upload) nên nằm trong thư mục cache/tmp riêng của app và <strong>xoá ngay sau khi dùng</strong>.</li>
      <li>Đặt tên file bằng ID ngẫu nhiên, không chứa thông tin cá nhân (<code>cccd_nguyenvana.jpg</code> → <code>f3a9….jpg</code>).</li>
      <li>Chia sẻ file cho app khác: Android dùng <code>FileProvider</code> + quyền tạm thời <code>FLAG_GRANT_READ_URI_PERMISSION</code>, không dùng đường dẫn <code>file://</code>;
        iOS dùng <code>UIActivityViewController</code>/document picker.</li>
    </ul>

    <p><strong>6. External storage (Android)</strong></p>
    <ul>
      <li>Thư mục chung (Downloads, DCIM, Documents) có thể bị app khác đọc/ghi. Scoped storage (Android 10+) giảm rủi ro nhưng không loại bỏ.</li>
      <li>Không bao giờ lưu dữ liệu nhạy cảm vào vùng chung. Không tin file đọc từ vùng chung: app khác có thể <em>sửa</em> nó → validate trước khi dùng
        (đặc biệt nếu đó là file cấu hình, file để nạp code — bài 19).</li>
    </ul>

    <p><strong>7. Xoá dữ liệu đúng cách</strong> — Logout / xoá tài khoản: xoá DB (kể cả file WAL), cache HTTP, cache ảnh, file tạm, WebView storage, và khoá trong Keystore/Keychain.
    Xoá khoá là cách nhanh nhất để "xoá" mọi dữ liệu đã mã hoá bằng khoá đó (crypto-shredding).</p>

    <div class="callout"><p>💡 Mô hình chuẩn: <strong>dữ liệu lớn mã hoá bằng khoá dữ liệu → khoá dữ liệu cất trong Keychain/Keystore</strong>.
    Kẻ lấy được file mà không lấy được khoá thì chỉ có một đống byte vô nghĩa.</p></div>
  `,

  codeTabs: [
    { id: "room", label: "🤖 Room + SQLCipher", lines: [
      "// 1. Lấy (hoặc tạo lần đầu) khoá DB 32 byte ngẫu nhiên, lưu dạng mã hoá bằng khoá Keystore",
      "val passphrase: ByteArray = dbKeyStore.getOrCreate {",
      "    ByteArray(32).also { SecureRandom().nextBytes(it) }",
      "}",
      "",
      "// 2. Mở Room với SQLCipher",
      "val factory = SupportOpenHelperFactory(passphrase)",
      "val db = Room.databaseBuilder(ctx, AppDb::class.java, \"messages.db\")",
      "    .openHelperFactory(factory)",
      "    .build()",
      "",
      "// 3. Xoá passphrase khỏi bộ nhớ sau khi mở (nếu thư viện cho phép)"
    ]},
    { id: "ios", label: "🍎 iOS Data Protection", lines: [
      "// Ghi file nhạy cảm với protection class .complete",
      "try data.write(to: url, options: [.completeFileProtection])",
      "",
      "// Hoặc đặt cho thư mục/file sẵn có",
      "try FileManager.default.setAttributes(",
      "    [.protectionKey: FileProtectionType.complete], ofItemAtPath: url.path)",
      "",
      "// Core Data: đặt option cho persistent store",
      "description.setOption(FileProtectionType.complete as NSObject,",
      "                      forKey: NSPersistentStoreFileProtectionKey)",
      "",
      "// Lưu ý: .complete => không đọc được khi máy khoá (tác vụ nền sẽ lỗi)"
    ]},
    { id: "xplat", label: "⚛️ RN & Flutter", lines: [
      "// Flutter + drift + SQLCipher: khoá lấy từ flutter_secure_storage",
      "final key = await storage.read(key: 'db_key') ?? await createAndSaveKey();",
      "NativeDatabase(file, setup: (db) {",
      "  db.execute(\"PRAGMA key = '\" + key + \"';\");   // key là hex ngẫu nhiên, không từ user",
      "});",
      "",
      "// React Native + op-sqlite (build có SQLCipher)",
      "const key = await SecureStore.getItemAsync('db_key') ?? (await createKey())",
      "const db = open({ name: 'app.db', encryptionKey: key })",
      "",
      "// Realm (mọi nền tảng): encryptionKey 64 byte",
      "Realm.open({ schema, encryptionKey: keyBytes64 })"
    ]},
    { id: "cache", label: "🗃️ Cache & file tạm", lines: [
      "// Server: API nhạy cảm không cho cache",
      "Cache-Control: no-store",
      "",
      "// Android OkHttp: bỏ cache cho request nhạy cảm",
      "request.newBuilder().cacheControl(CacheControl.FORCE_NETWORK).build()",
      "",
      "// iOS",
      "let cfg = URLSessionConfiguration.ephemeral     // không cache, không cookie trên đĩa",
      "",
      "// redux-persist: không persist slice chứa token",
      "persistConfig = { key: 'root', storage: AsyncStorage, blacklist: ['auth'] }",
      "",
      "// File tạm: tên ngẫu nhiên, trong cache riêng, xoá ngay",
      "val tmp = File.createTempFile(\"doc\", \".pdf\", context.cacheDir)",
      "try { upload(tmp) } finally { tmp.delete() }"
    ]},
    { id: "wipe", label: "🧹 Xoá khi logout", lines: [
      "fun onLogout() {",
      "    db.close()",
      "    context.deleteDatabase(\"messages.db\")          // xoá cả -wal, -shm, -journal",
      "    httpClient.cache?.evictAll()",
      "    imageLoader.clearDiskCache()",
      "    context.cacheDir.deleteRecursively()",
      "    WebStorage.getInstance().deleteAllData(); CookieManager.getInstance().removeAllCookies(null)",
      "    keyStore.deleteEntry(\"db_key_wrapper\")        // crypto-shredding",
      "    secureStore.clear()",
      "}"
    ]}
  ],

  stageHtml: `
    <div class="node" id="app"><div class="nl">📱 App</div><div class="ns">tin nhắn, giao dịch, ảnh, PDF</div></div>
    <div class="arrow" id="a1">↓ ghi xuống đĩa</div>
    <div class="row">
      <div class="node" id="db"><div class="nl">🗄️ SQLite / Realm</div><div class="ns">mặc định plaintext</div></div>
      <div class="node" id="cache"><div class="nl">🗃️ Cache</div><div class="ns">HTTP, ảnh, state persist</div></div>
      <div class="node" id="tmp"><div class="nl">📄 File tạm / xuất</div><div class="ns">PDF, ảnh chụp</div></div>
    </div>
    <div class="arrow" id="a2">↓ mã hoá bằng khoá dữ liệu</div>
    <div class="node" id="enc"><div class="nl">🔐 SQLCipher / Data Protection</div><div class="ns">file trên đĩa chỉ là byte vô nghĩa</div></div>
    <div class="arrow" id="a3">↓ khoá dữ liệu cất ở</div>
    <div class="node" id="ks"><div class="nl">🔑 Keychain / Keystore</div><div class="ns">xoá khoá = xoá dữ liệu (crypto-shredding)</div></div>
  `,

  steps: [
    { title: "1 · Database mặc định là plaintext", tab: "room", highlight: [8], on: ["app", "a1", "db"],
      desc: "Room, Core Data, sqflite, WatermelonDB… đều ghi file SQLite thường. Có file là đọc được toàn bộ tin nhắn/giao dịch." },
    { title: "2 · Mã hoá bằng SQLCipher", tab: "room", highlight: [2, 3, 7, 9], on: ["db", "a2", "enc"],
      desc: "Khoá DB là 32 byte ngẫu nhiên từ SecureRandom, được bảo vệ bằng khoá Keystore. Room mở DB qua SupportOpenHelperFactory của SQLCipher." },
    { title: "3 · Cross-platform cũng làm được", tab: "xplat", highlight: [2, 4, 8, 9, 12], on: ["enc", "a3", "ks"],
      desc: "drift/op-sqlite/Realm đều hỗ trợ mã hoá. Khoá luôn lấy từ secure storage, không lấy từ dữ liệu người dùng hay device ID." },
    { title: "4 · iOS: protection class", tab: "ios", highlight: [2, 5, 6, 9, 10, 12], on: ["enc"],
      desc: "<code>.complete</code> khiến file không đọc được khi máy khoá. Cân nhắc với tác vụ nền: chọn class chặt nhất mà tính năng vẫn chạy." },
    { title: "5 · Bịt cache và file tạm", tab: "cache", highlight: [2, 5, 8, 11, 14, 15], on: ["cache", "tmp"],
      desc: "no-store cho API nhạy cảm, session ephemeral, không persist slice auth, file tạm tên ngẫu nhiên trong cache riêng và xoá ngay sau khi dùng." },
    { title: "6 · Xoá sạch khi logout", tab: "wipe", highlight: [3, 4, 5, 6, 7, 8], on: ["db", "cache", "tmp", "ks"],
      desc: "Xoá DB kèm file WAL, cache HTTP/ảnh, WebView storage và khoá. Xoá khoá khiến mọi bản mã còn sót lại trở nên vô dụng." }
  ],

  quiz: [
    { q: "Room/Core Data/sqflite mặc định lưu dữ liệu thế nào?", options: [
        "Mã hoá AES-256",
        "File SQLite dạng thường, mở bằng trình xem SQLite là đọc được",
        "Lưu trên cloud",
        "Lưu trong Keychain"
      ], correct: 1,
      explanation: "Muốn mã hoá phải dùng SQLCipher hoặc tuỳ chọn mã hoá của thư viện." },
    { q: "Khoá cho SQLCipher nên lấy ở đâu?", options: [
        "Viết cứng trong code",
        "Dẫn từ ANDROID_ID hoặc IMEI",
        "Sinh ngẫu nhiên lần đầu bằng CSPRNG và cất trong Keychain/Keystore",
        "Dùng tên đăng nhập của người dùng"
      ], correct: 2,
      explanation: "Khoá viết cứng hoặc dẫn từ giá trị đoán được đều có thể tái tạo lại." },
    { q: "Ngoài file .db, file nào cũng có thể chứa dữ liệu SQLite?", options: [
        "Không có",
        "Các file -wal, -shm, -journal đi kèm",
        "File AndroidManifest.xml",
        "Info.plist"
      ], correct: 1,
      explanation: "Khi xoá hoặc kiểm tra rò rỉ phải tính cả các file phụ này." },
    { q: "Protection class FileProtectionType.complete trên iOS có nghĩa là?", options: [
        "File không bao giờ đọc được",
        "File chỉ đọc được khi thiết bị đang mở khoá",
        "File được đồng bộ iCloud",
        "File được nén"
      ], correct: 1,
      explanation: "Khoá máy → khoá giải mã file bị loại khỏi bộ nhớ → file không đọc được." },
    { q: "API trả hồ sơ người dùng. Server nên gửi header nào để tránh bị lưu trong HTTP cache của app?", options: [
        "Cache-Control: public, max-age=3600",
        "Cache-Control: no-store",
        "Content-Type: text/plain",
        "X-Frame-Options: DENY"
      ], correct: 1,
      explanation: "no-store yêu cầu client không lưu response vào cache." },
    { q: "redux-persist lưu toàn bộ store xuống AsyncStorage, kể cả slice 'auth' chứa token. Cách sửa?", options: [
        "Không cần sửa",
        "Đưa 'auth' vào blacklist và lưu token bằng secure storage",
        "Đổi tên slice",
        "Nén dữ liệu trước khi lưu"
      ], correct: 1,
      explanation: "State persist là kênh rò rỉ hay bị quên; bí mật phải đi qua secure storage." },
    { q: "Chia sẻ file PDF cho app khác trên Android nên làm thế nào?", options: [
        "Copy vào Downloads rồi gửi đường dẫn file://",
        "Dùng FileProvider với content:// URI và quyền đọc tạm thời",
        "Đặt file ở chế độ world-readable",
        "Gửi qua clipboard"
      ], correct: 1,
      explanation: "FileProvider cấp quyền có phạm vi và tạm thời thay vì mở file cho mọi app." },
    { q: "'Crypto-shredding' khi logout nghĩa là gì?", options: [
        "Ghi đè file nhiều lần bằng số 0",
        "Xoá khoá mã hoá; mọi dữ liệu mã hoá bằng khoá đó không còn giải mã được",
        "Nén rồi xoá file",
        "Gửi dữ liệu lên server trước khi xoá"
      ], correct: 1,
      explanation: "Trên flash storage, xoá file không đảm bảo xoá vật lý; xoá khoá là cách đáng tin hơn." },
    { q: "App đọc file cấu hình từ thư mục chung (external storage). Rủi ro chính?", options: [
        "File đọc chậm",
        "App khác có thể sửa file đó; app tin dữ liệu bị sửa",
        "File quá lớn",
        "Không có rủi ro"
      ], correct: 1,
      explanation: "Dữ liệu từ vùng chung là input không đáng tin, phải validate hoặc không dùng." }
  ]
});
