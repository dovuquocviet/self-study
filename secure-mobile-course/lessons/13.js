window.LESSONS.push({
  id: "13",
  phase: "3", phaseName: "Xác thực trên mobile",
  title: "Vòng đời token trên mobile",
  subtitle: "Hết hạn · refresh token rotation · phát hiện dùng lại · device binding · logout & thu hồi · remote wipe",

  theory: `
    <p>App mobile giữ người dùng đăng nhập hàng tháng — không ai muốn nhập mật khẩu mỗi lần mở app. Nhưng phiên càng dài, token bị lộ càng nguy hiểm.
    Bài này là cách cân bằng: <strong>trải nghiệm "đăng nhập mãi"</strong> mà <strong>thiệt hại khi lộ token vẫn nhỏ</strong>.</p>

    <p><strong>1. Hai loại token, hai vai trò</strong></p>
    <table>
      <tr><th></th><th>Access token</th><th>Refresh token</th></tr>
      <tr><td>Dùng để</td><td>Gọi API (header Authorization)</td><td>Xin access token mới</td></tr>
      <tr><td>Thời hạn</td><td>Ngắn: 5–15 phút</td><td>Dài: vài ngày – vài tháng (có hạn tuyệt đối)</td></tr>
      <tr><td>Gửi đi đâu</td><td>Mọi API</td><td><strong>Chỉ</strong> token endpoint</td></tr>
      <tr><td>Lưu</td><td>Bộ nhớ (hoặc secure storage)</td><td>Keychain/Keystore, có thể gắn sinh trắc học</td></tr>
      <tr><td>Thu hồi</td><td>Thường là JWT tự chứa → khó thu hồi tức thì, nên để ngắn</td><td>Lưu trạng thái ở server → thu hồi được ngay</td></tr>
    </table>

    <p><strong>2. Refresh token rotation + phát hiện dùng lại</strong></p>
    <ul>
      <li>Mỗi lần dùng refresh token, server cấp <strong>cặp mới</strong> (access + refresh mới) và đánh dấu refresh cũ là đã dùng.</li>
      <li>Nếu một refresh token <em>đã dùng</em> bị gửi lại → có hai bản sao đang tồn tại (một bị đánh cắp) → server <strong>thu hồi cả "họ" token</strong> (family) và buộc đăng nhập lại.</li>
      <li>Lợi ích: token bị trộm chỉ dùng được đến khi người dùng thật refresh lần kế tiếp — và việc dùng lại bị phát hiện.</li>
      <li>Phía app: xử lý đồng thời — nhiều request cùng gặp 401 thì chỉ <strong>một</strong> lần refresh chạy, các request khác chờ kết quả; nếu không, app tự kích hoạt cơ chế phát hiện dùng lại và tự đăng xuất người dùng.</li>
    </ul>

    <p><strong>3. Hạn tuyệt đối và hạn không hoạt động</strong></p>
    <ul>
      <li><em>Idle timeout</em>: không dùng app X ngày → phiên hết hạn.</li>
      <li><em>Absolute lifetime</em>: dù dùng liên tục, sau Y ngày phải đăng nhập lại (hoặc xác thực mạnh lại).</li>
      <li><em>Step-up</em>: thao tác nhạy cảm (đổi mật khẩu, đổi email, chuyển tiền lớn) yêu cầu xác thực lại ngay cả khi phiên còn hạn.</li>
    </ul>

    <p><strong>4. Device binding — token chỉ dùng được trên đúng máy</strong></p>
    <ul>
      <li>Lúc đăng nhập, app sinh cặp khoá trong phần cứng (bài 05), gửi public key; server gắn phiên với khoá này.</li>
      <li>Khi refresh (và với request nhạy cảm), app ký nonce/nội dung bằng private key. Server kiểm chữ ký.</li>
      <li>Token bị trích ra (từ backup, log, máy root) mang sang máy khác → <strong>không ký được</strong> → vô dụng.</li>
      <li>Chuẩn tham khảo: DPoP (RFC 9449) — gắn token với khoá của client, mỗi request kèm proof có chữ ký.</li>
    </ul>

    <p><strong>5. Logout thật sự</strong></p>
    <ol>
      <li>Gọi server <strong>thu hồi</strong> refresh token (và phiên/family). Chỉ xoá ở app là chưa đủ — bản sao bị trộm vẫn dùng được.</li>
      <li>Xoá mọi thứ cục bộ: token trong secure storage, khoá Keystore/Keychain liên quan, DB, cache, cookie WebView (bài 07).</li>
      <li>Huỷ đăng ký push token trên server để không gửi thông báo cho máy đã đăng xuất.</li>
      <li>Nếu mạng lỗi khi logout: vẫn xoá cục bộ, và xếp hàng lời gọi thu hồi để thử lại.</li>
    </ol>

    <p><strong>6. Quản lý thiết bị và remote wipe</strong></p>
    <ul>
      <li>Cho người dùng xem danh sách thiết bị/phiên đang đăng nhập (tên máy, lần hoạt động cuối, vị trí gần đúng) và nút "Đăng xuất khỏi thiết bị này".</li>
      <li>Khi người dùng đổi mật khẩu hoặc báo mất máy: thu hồi mọi phiên (trừ phiên hiện tại nếu phù hợp).</li>
      <li><strong>Remote wipe</strong>: lần kế tiếp app trên máy bị mất kết nối, server trả mã đặc biệt (ví dụ 401 kèm lý do <code>session_revoked</code>) → app xoá toàn bộ dữ liệu cục bộ.
        Lưu ý: nếu kẻ trộm tắt mạng, wipe không chạy — vì vậy dữ liệu cục bộ vẫn phải được mã hoá (Pha 1). Với máy doanh nghiệp, MDM có wipe cấp OS.</li>
    </ul>

    <p><strong>7. Server-side checklist</strong>: lưu refresh token dạng <em>hash</em> (như mật khẩu), gắn với user + device + family, có trạng thái (active/used/revoked),
    có hạn, và ghi log sự kiện (cấp, dùng, thu hồi, phát hiện dùng lại) để điều tra.</p>

    <div class="callout"><p>💡 Mục tiêu: <strong>token bị lộ thì thiệt hại bị chặn bởi thời gian (hạn ngắn), bởi phát hiện (rotation), bởi nơi dùng (device binding)
    và bởi hành động (thu hồi từ xa)</strong>. Bốn lớp này bù cho nhau.</p></div>
  `,

  codeTabs: [
    { id: "rotate", label: "🔁 Rotation (server)", lines: [
      "handle POST /token (grant_type=refresh_token):",
      "    rec = db.refreshTokens.findByHash(sha256(req.refresh_token))",
      "    if not rec or rec.expiresAt < now() or rec.familyRevoked: return 401",
      "",
      "    if rec.status == 'used':                     // bị dùng lại -> có kẻ giữ bản sao",
      "        db.revokeFamily(rec.familyId)",
      "        alertSecurity(rec.userId, 'refresh_reuse')",
      "        return 401",
      "",
      "    require verifyDeviceProof(rec.devicePublicKey, req.proof, req.nonce)   // device binding",
      "    rec.status = 'used'",
      "    newRt = randomToken(); db.insert(hash(newRt), familyId=rec.familyId, device=rec.device)",
      "    return { access_token: signJwt(ttl='10m'), refresh_token: newRt }"
    ]},
    { id: "client", label: "📱 Refresh đơn luồng", lines: [
      "// Interceptor: nhiều request gặp 401 cùng lúc -> chỉ MỘT lần refresh",
      "let refreshing: Promise<Tokens> | null = null",
      "",
      "async function onUnauthorized(originalRequest) {",
      "  refreshing ??= doRefresh().finally(() => { refreshing = null })",
      "  try {",
      "    const t = await refreshing",
      "    return retry(originalRequest, t.accessToken)",
      "  } catch (e) {",
      "    await localWipe(); goToLogin()               // refresh bị từ chối -> đăng xuất sạch",
      "  }",
      "}",
      "// Kotlin: dùng Mutex; Swift: actor; Dart: Completer — cùng một ý tưởng"
    ]},
    { id: "logout", label: "🚪 Logout đúng", lines: [
      "suspend fun logout() {",
      "    runCatching { api.post(\"/auth/revoke\", mapOf(\"refresh_token\" to rt)) }",
      "        .onFailure { pendingRevocations.enqueue(rt) }   // thử lại khi có mạng",
      "    runCatching { api.delete(\"/devices/me/push-token\") }",
      "",
      "    secureStore.clear()",
      "    keyStore.deleteEntry(\"device_sign\"); keyStore.deleteEntry(\"db_key\")",
      "    context.deleteDatabase(\"app.db\"); cacheDir.deleteRecursively()",
      "    CookieManager.getInstance().removeAllCookies(null)",
      "    navigateToLogin(clearBackStack = true)",
      "}"
    ]},
    { id: "wipe", label: "📵 Thiết bị & remote wipe", lines: [
      "// Server: người dùng bấm 'Đăng xuất khỏi iPhone của Lan'",
      "handle DELETE /me/sessions/:deviceId:",
      "    db.revokeFamiliesForDevice(user.id, deviceId)",
      "    db.devices.mark(deviceId, wipeOnNextContact=true)",
      "",
      "// Mọi API: kiểm tra phiên còn hiệu lực",
      "if session.revoked: return 401 { error: 'session_revoked', wipe: device.wipeOnNextContact }",
      "",
      "// App: nhận wipe -> xoá toàn bộ dữ liệu cục bộ",
      "if (res.status == 401 && res.body.wipe) { localWipe(); goToLogin() }",
      "",
      "// Máy bị tắt mạng thì wipe không chạy -> dữ liệu cục bộ vẫn phải mã hoá"
    ]},
    { id: "policy", label: "⏱️ Chính sách hạn", lines: [
      "# Ví dụ cho app ví điện tử (điều chỉnh theo rủi ro)",
      "access_token_ttl        = 10 phút",
      "refresh_idle_timeout    = 30 ngày không dùng",
      "refresh_absolute_ttl    = 90 ngày -> đăng nhập lại",
      "refresh_rotation        = bật, phát hiện reuse -> thu hồi family",
      "device_binding          = bắt buộc (khoá EC trong Secure Enclave/StrongBox/TEE)",
      "step_up_required_for    = đổi mật khẩu, đổi email/sđt, chuyển > 5 triệu, thêm người nhận",
      "on_password_change      = thu hồi mọi phiên khác",
      "store_refresh_as        = sha256 hash ở server"
    ]}
  ],

  stageHtml: `
    <div class="node" id="login"><div class="nl">🔑 Đăng nhập</div><div class="ns">cấp access (10') + refresh (family F) · đăng ký khoá thiết bị</div></div>
    <div class="arrow" id="a1">↓ access hết hạn</div>
    <div class="node" id="refresh"><div class="nl">🔁 Refresh + chữ ký thiết bị</div><div class="ns">cấp cặp mới, đánh dấu cũ = used</div></div>
    <div class="arrow" id="a2">↓ nếu token cũ bị gửi lại</div>
    <div class="row">
      <div class="node" id="reuse"><div class="nl">🚨 Phát hiện dùng lại</div><div class="ns">thu hồi cả family F</div></div>
      <div class="node" id="other"><div class="nl">📵 Token trên máy khác</div><div class="ns">không ký được → từ chối</div></div>
    </div>
    <div class="arrow" id="a3">↓ kết thúc phiên</div>
    <div class="row">
      <div class="node" id="logout"><div class="nl">🚪 Logout</div><div class="ns">thu hồi ở server + xoá cục bộ</div></div>
      <div class="node" id="remote"><div class="nl">🧹 Remote wipe</div><div class="ns">lần kết nối sau xoá dữ liệu</div></div>
    </div>
  `,

  steps: [
    { title: "1 · Hai token, hai vai trò", tab: "policy", highlight: [2, 3, 4], on: ["login"],
      desc: "Access token ngắn hạn giới hạn thời gian lộ; refresh token dài hạn nhưng có trạng thái ở server nên thu hồi được." },
    { title: "2 · Rotation mỗi lần refresh", tab: "rotate", highlight: [2, 3, 11, 12, 13], on: ["a1", "refresh"],
      desc: "Mỗi refresh token chỉ dùng một lần; server lưu hash, cấp cặp mới cùng family, đánh dấu token cũ là đã dùng." },
    { title: "3 · Phát hiện dùng lại", tab: "rotate", highlight: [5, 6, 7, 8], on: ["a2", "reuse"],
      desc: "Token 'used' xuất hiện lại nghĩa là có hai bản sao. Server thu hồi cả family và cảnh báo — kẻ trộm lẫn người dùng thật đều phải đăng nhập lại." },
    { title: "4 · Device binding", tab: "rotate", highlight: [10], on: ["other"],
      desc: "Refresh phải kèm chữ ký của khoá phần cứng đã đăng ký. Token mang sang máy khác không có khoá → vô dụng." },
    { title: "5 · Client refresh đơn luồng", tab: "client", highlight: [2, 5, 7, 8, 10], on: ["refresh"],
      desc: "Nhiều request 401 cùng lúc chỉ được kích hoạt một lần refresh; nếu không app tự 'dùng lại' token và tự bị thu hồi phiên." },
    { title: "6 · Logout = thu hồi + xoá", tab: "logout", highlight: [2, 3, 4, 6, 7, 8, 9], on: ["a3", "logout"],
      desc: "Thu hồi ở server (xếp hàng thử lại nếu mất mạng), huỷ push token, xoá secure storage, khoá, DB, cache, cookie." },
    { title: "7 · Quản lý thiết bị & remote wipe", tab: "wipe", highlight: [3, 4, 7, 10, 12], on: ["remote"],
      desc: "Người dùng tự đăng xuất máy bị mất; lần kết nối kế tiếp app xoá dữ liệu. Vì máy có thể bị tắt mạng, mã hoá dữ liệu cục bộ vẫn là bắt buộc." }
  ],

  quiz: [
    { q: "Vì sao access token nên ngắn hạn (5–15 phút)?", options: [
        "Để server nhẹ hơn",
        "Access token thường khó thu hồi tức thì; hạn ngắn giới hạn thời gian kẻ trộm dùng được",
        "Để app nhanh hơn",
        "Vì chuẩn JWT bắt buộc"
      ], correct: 1,
      explanation: "JWT tự chứa được chấp nhận đến khi hết hạn; ngắn hạn là cách giảm thiệt hại." },
    { q: "Refresh token rotation là gì?", options: [
        "Đổi thuật toán ký định kỳ",
        "Mỗi lần dùng refresh token, server cấp refresh token mới và vô hiệu token cũ",
        "Luân phiên giữa nhiều server",
        "Mã hoá token hai lần"
      ], correct: 1,
      explanation: "Kết hợp với phát hiện dùng lại, rotation giúp phát hiện token bị đánh cắp." },
    { q: "Server nhận một refresh token đã ở trạng thái 'used'. Nên làm gì?", options: [
        "Cấp token mới bình thường",
        "Thu hồi toàn bộ family token đó và buộc đăng nhập lại",
        "Bỏ qua",
        "Tăng hạn token"
      ], correct: 1,
      explanation: "Token dùng lại là dấu hiệu có bản sao bị đánh cắp." },
    { q: "Nhiều request cùng lúc nhận 401. App nên xử lý thế nào?", options: [
        "Mỗi request tự refresh riêng",
        "Chỉ chạy một lần refresh, các request khác chờ kết quả rồi thử lại",
        "Đăng xuất ngay",
        "Bỏ qua lỗi"
      ], correct: 1,
      explanation: "Refresh song song dùng cùng token → server coi là dùng lại → thu hồi phiên." },
    { q: "Device binding giúp gì khi refresh token bị trích ra từ backup?", options: [
        "Không giúp gì",
        "Token mang sang máy khác không tạo được chữ ký bằng khoá phần cứng của máy gốc nên bị từ chối",
        "Làm token dài hơn",
        "Tự động mã hoá backup"
      ], correct: 1,
      explanation: "Private key không rời phần cứng; không có nó thì không có proof hợp lệ." },
    { q: "Logout chỉ xoá token trong app, không gọi server. Vấn đề?", options: [
        "Không vấn đề",
        "Bản sao token (nếu đã bị lộ) vẫn dùng được vì server chưa thu hồi",
        "App bị crash",
        "Người dùng không đăng nhập lại được"
      ], correct: 1,
      explanation: "Logout phải thu hồi ở server và xoá cục bộ." },
    { q: "Remote wipe có hạn chế gì?", options: [
        "Không có hạn chế",
        "Chỉ chạy khi app kết nối lại server; kẻ trộm tắt mạng thì không chạy — nên dữ liệu cục bộ vẫn phải mã hoá",
        "Chỉ chạy trên Android",
        "Xoá luôn cả OS"
      ], correct: 1,
      explanation: "Remote wipe là lớp bổ sung, không thay thế mã hoá dữ liệu trên máy." },
    { q: "Refresh token nên được lưu ở server dưới dạng nào?", options: [
        "Plaintext để dễ tra cứu",
        "Hash (ví dụ SHA-256), kèm user, device, family, trạng thái, hạn",
        "Mã hoá base64",
        "Không lưu gì"
      ], correct: 1,
      explanation: "Lộ DB không lộ token dùng được; tra cứu bằng hash của token gửi lên." },
    { q: "Người dùng đổi mật khẩu. Phiên trên các thiết bị khác nên?", options: [
        "Giữ nguyên",
        "Bị thu hồi (có thể giữ phiên hiện tại)",
        "Tăng hạn",
        "Chuyển sang chế độ chỉ đọc vĩnh viễn"
      ], correct: 1,
      explanation: "Đổi mật khẩu thường vì nghi ngờ bị lộ; các phiên cũ có thể thuộc về kẻ tấn công." }
  ]
});
