# 🗝️ Auth nâng cao: OAuth 1.0a, OAuth 2.x, OIDC & chuẩn hiện đại

Khoá tiếp nối `auth-course` (Nhập môn Auth). Đi sâu vào từng chuẩn nhưng chỉ giữ phần cốt lõi; mỗi bài có request/response thật và trắc nghiệm.

## Chạy

```bash
python3 -m http.server 8080   # ở thư mục gốc repo
# mở http://localhost:8080/auth-advanced-course/
```

## Lộ trình (16 bài · 145 câu trắc nghiệm)

**Pha 0 — Bản đồ**

- 01 · Bản đồ các chuẩn: ai giải quyết bài toán gì

**Pha 1 — OAuth 1.0a**

- 02 · OAuth 1.0a — bộ 4 chuỗi credential là gì?
- 03 · Chữ ký OAuth 1.0a — tính oauth_signature từng bước
- 04 · OAuth 1.0a vs OAuth 2.0 — khác nhau ở đâu, vì sao đổi

**Pha 2 — OAuth 2.0 cốt lõi**

- 05 · OAuth 2.0: 4 vai trò, 2 loại client, các grant type
- 06 · Authorization Code + PKCE — từng tham số một
- 07 · Token: opaque vs JWT, refresh rotation, audience, introspection, revocation
- 08 · Client xác thực với AS & discovery metadata

**Pha 3 — Danh tính & định dạng token**

- 09 · OpenID Connect sâu: id_token, UserInfo, nonce, discovery
- 10 · JOSE: JWT, JWS, JWE, JWK, JWKS — và xoay khoá

**Pha 4 — Các chuẩn hiện đại**

- 11 · OAuth 2.1 & Security BCP (RFC 9700)
- 12 · Token gắn khoá: DPoP (RFC 9449) & mTLS (RFC 8705)
- 13 · PAR, JAR, RAR & FAPI 2.0
- 14 · Device Flow, CIBA & Token Exchange
- 15 · SAML 2.0 vs OIDC & SCIM — SSO và đồng bộ user trong doanh nghiệp
- 16 · Passkeys, GNAP & bảng chọn chuẩn — tổng kết khoá

## Cấu trúc

Giống các khoá khác: `index.html`, `lesson.html`, `common.js` (engine, có xáo đáp án), `styles.css`, `lessons/NN.js`.

> Trong chuỗi backtick (`theory`/`stageHtml`) KHÔNG dùng ký tự backtick và KHÔNG dùng `${...}`.
