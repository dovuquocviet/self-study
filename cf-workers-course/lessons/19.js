window.LESSONS.push({
  id: "19",
  phase: "5", phaseName: "Vận hành: giới hạn, log, test",
  title: "Test Worker với Vitest trong runtime thật",
  subtitle: "@cloudflare/vitest-plugin (thay vitest-pool-workers) · cloudflareTest · env/exports · unit vs integration · storage cô lập · test cron/queue/D1",

  theory: `
    <p>Chạy test Worker bằng Node thuần sẽ "xanh giả": Node có API mà Workers không có (và ngược lại), không có KV/D1 thật. Cloudflare cung cấp tích hợp Vitest
    chạy test <strong>bên trong workerd</strong> — cùng runtime production — với binding giả lập local. Giống <code>@SpringBootTest</code> + Testcontainers, nhưng nhẹ hơn nhiều.</p>

    <p><strong>Tên gói (cập nhật 2026)</strong>: <code>@cloudflare/vitest-plugin</code> thay thế <code>@cloudflare/vitest-pool-workers</code>; API không đổi, có codemod để chuyển.
    Yêu cầu Vitest 4.1 trở lên. Tài liệu/blog cũ vẫn ghi tên cũ và <code>defineWorkersConfig</code> — nhận ra để khỏi bối rối.</p>

    <p><strong>Hai kiểu test</strong></p>
    <table>
      <tr><th></th><th>Unit</th><th>Integration</th></tr>
      <tr><td>Gọi</td><td><code>worker.fetch(request, env, ctx)</code> trực tiếp</td><td><code>exports.default.fetch(url)</code> — đi qua Worker như request thật</td></tr>
      <tr><td>Import</td><td><code>env</code> từ <code>cloudflare:workers</code>; <code>createExecutionContext</code>, <code>waitOnExecutionContext</code> từ <code>cloudflare:test</code></td><td><code>exports</code> từ <code>cloudflare:workers</code> (thay cho <code>SELF</code> cũ)</td></tr>
      <tr><td>Kiểm soát</td><td>Tự tạo ctx, đợi <code>waitUntil</code> xong rồi assert</td><td>Gần hành vi thật nhất</td></tr>
    </table>

    <p><strong>Helper hay dùng</strong> (từ <code>cloudflare:test</code>): <code>createScheduledController()</code> để gọi <code>scheduled()</code>; <code>createMessageBatch()</code> + <code>getQueueResult()</code>
    để test consumer và xem tin nào ack/retry; <code>runInDurableObject()</code> để chạy code bên trong một DO; <code>applyD1Migrations()</code> để dựng schema D1 trước khi test.</p>

    <p><strong>Cô lập</strong>: mỗi <em>file test</em> có storage riêng (KV/D1/R2/DO) — ghi ở file này không thấy ở file khác. Các file chạy song song mặc định.
    Mock gọi HTTP ra ngoài: dùng <code>@msw/cloudflare</code> theo hướng dẫn hiện hành.</p>

    <div class="callout"><p>💡 Plugin tự bật <code>nodejs_compat</code> khi chạy test. Nếu Worker của bạn <em>không</em> bật cờ này mà code lỡ dùng API Node, test vẫn xanh nhưng deploy/production lỗi.
    Giữ cấu hình compatibility thống nhất và chạy thêm <code>wrangler deploy --dry-run</code> trong CI.</p></div>
  `,

  codeTabs: [
    { id: "cfg", label: "vitest.config.ts", lines: [
      "import path from 'node:path';",
      "import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';",
      "import { defineConfig } from 'vitest/config';",
      "",
      "export default defineConfig({",
      "  plugins: [",
      "    cloudflareTest(async () => ({",
      "      wrangler: { configPath: './wrangler.jsonc' },           // lấy binding từ config thật",
      "      miniflare: {",
      "        bindings: { TEST_MIGRATIONS: await readD1Migrations(path.join(__dirname, 'migrations')) },",
      "      },",
      "    })),",
      "  ],",
      "  test: { setupFiles: ['./test/apply-migrations.ts'] },",
      "});"
    ]},
    { id: "setup", label: "apply-migrations.ts", lines: [
      "import { env } from 'cloudflare:workers';",
      "import { applyD1Migrations } from 'cloudflare:test';",
      "",
      "// chạy trước mỗi file test: dựng schema cho D1 cô lập của file đó",
      "await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);"
    ]},
    { id: "unit", label: "Unit test", lines: [
      "import { env } from 'cloudflare:workers';",
      "import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';",
      "import { describe, it, expect } from 'vitest';",
      "import worker from '../src/index';",
      "",
      "describe('GET /api/products/:id', () => {",
      "  it('trả 404 khi không có sản phẩm', async () => {",
      "    const request = new Request('http://example.com/api/products/nope');",
      "    const ctx = createExecutionContext();",
      "    const res = await worker.fetch(request, env, ctx);",
      "    await waitOnExecutionContext(ctx);            // đợi mọi waitUntil xong",
      "    expect(res.status).toBe(404);",
      "  });",
      "});"
    ]},
    { id: "integ", label: "Integration + queue", lines: [
      "import { env, exports } from 'cloudflare:workers';",
      "import { createMessageBatch, createExecutionContext, getQueueResult } from 'cloudflare:test';",
      "import { it, expect } from 'vitest';",
      "import worker from '../src/index';",
      "",
      "it('tạo sản phẩm rồi đọc lại', async () => {",
      "  await env.DB.prepare('INSERT INTO products (id, name, price, stock) VALUES (?, ?, ?, ?)')",
      "    .bind('p1', 'Áo', 150000, 3).run();",
      "  const res = await exports.default.fetch('http://example.com/api/products/p1');",
      "  expect(await res.json()).toMatchObject({ id: 'p1' });",
      "});",
      "",
      "it('consumer ack tin hợp lệ', async () => {",
      "  const batch = createMessageBatch('orders', [",
      "    { id: 'm1', timestamp: new Date(), attempts: 1, body: { orderId: 'o1', email: 'a@b.vn' } },",
      "  ]);",
      "  const ctx = createExecutionContext();",
      "  await worker.queue(batch, env, ctx);",
      "  const result = await getQueueResult(batch, ctx);",
      "  expect(result.explicitAcks).toContain('m1');",
      "});"
    ]}
  ],

  stageHtml: `
    <div class="node" id="vt"><div class="nl">🧪 Vitest (Node)</div><div class="ns">đọc config, gom file test</div></div>
    <div class="arrow" id="a1">↓ cloudflareTest() khởi động workerd</div>
    <div class="node" id="wd"><div class="nl">⚙️ workerd</div><div class="ns">runtime thật · binding giả lập</div></div>
    <div class="row">
      <div class="node" id="f1"><div class="nl">📄 products.test.ts</div><div class="ns">D1/KV riêng</div></div>
      <div class="node" id="f2"><div class="nl">📄 queue.test.ts</div><div class="ns">D1/KV riêng</div></div>
    </div>
    <div class="arrow" id="a2">↓ unit: worker.fetch(...) · integration: exports.default.fetch(...)</div>
    <div class="node" id="as"><div class="nl">✅ expect(...)</div><div class="ns">status · body · ack/retry</div></div>
  `,
  steps: [
    { title: "1 · Plugin chạy test trong workerd", tab: "cfg", highlight: [2, 7, 8], on: ["vt", "a1", "wd"],
      desc: "Binding lấy từ wrangler.jsonc thật; thêm binding chỉ dành cho test qua <code>miniflare.bindings</code>." },
    { title: "2 · Dựng schema D1", tab: "setup", highlight: [1, 2, 5], on: ["f1", "f2"],
      desc: "Migration đọc ở Node (<code>readD1Migrations</code>), áp trong workerd (<code>applyD1Migrations</code>) cho từng file test." },
    { title: "3 · Unit test gọi handler trực tiếp", tab: "unit", highlight: [1, 2, 9, 10, 11, 12], on: ["a2", "as"],
      desc: "Tự tạo ctx; <code>waitOnExecutionContext</code> đợi các <code>waitUntil</code> để assert kết quả phụ." },
    { title: "4 · Integration qua exports", tab: "integ", highlight: [1, 7, 8, 9, 10], on: ["f1", "as"],
      desc: "<code>exports.default.fetch</code> đi qua Worker như request thật. Dữ liệu ghi chỉ sống trong file test này." },
    { title: "5 · Test consumer queue", tab: "integ", highlight: [14, 15, 18, 19, 20], on: ["f2", "as"],
      desc: "Tạo lô tin giả, gọi <code>queue()</code>, rồi kiểm tra tin nào đã được ack." }
  ],

  quiz: [
    { q: "Vì sao không nên test Worker bằng Node thuần?", options: [
        "Node chậm",
        "Node có/khác API so với workerd và không có binding thật — test có thể xanh giả",
        "Vitest không chạy trên Node",
        "Bị cấm"
      ], correct: 1, explanation: "Tích hợp Vitest chạy test trong chính runtime production." },
    { q: "Gói hiện hành cho tích hợp Vitest (2026)?", options: [
        "@cloudflare/jest-workers",
        "@cloudflare/vitest-plugin (thay @cloudflare/vitest-pool-workers)",
        "miniflare-test",
        "wrangler-test"
      ], correct: 1, explanation: "API giữ nguyên; có codemod chuyển đổi." },
    { q: "Trong unit test, vì sao gọi waitOnExecutionContext(ctx)?", options: [
        "Để tạo ctx",
        "Để đợi mọi promise đã đăng ký bằng ctx.waitUntil hoàn tất trước khi assert",
        "Để reset DB",
        "Không cần thiết"
      ], correct: 1, explanation: "Nếu không, side effect trong waitUntil có thể chưa xảy ra." },
    { q: "Thay cho SELF.fetch cũ, integration test hiện dùng gì?", options: [
        "fetch toàn cục", "exports.default.fetch từ cloudflare:workers", "env.SELF", "worker.request"
      ], correct: 1, explanation: "exports trỏ tới các export của Worker chính." },
    { q: "Storage (KV/D1...) giữa hai file test khác nhau?", options: [
        "Dùng chung",
        "Cô lập — mỗi file test có storage riêng",
        "Dùng production",
        "Phải tự xoá"
      ], correct: 1, explanation: "Muốn dùng chung thì chạy với --max-workers=1 --no-isolate." },
    { q: "Dựng schema D1 cho test bằng gì?", options: [
        "Chạy wrangler d1 migrations apply --remote",
        "readD1Migrations trong config + applyD1Migrations trong setup file",
        "Tạo bảng tay trong từng test",
        "Không test được D1"
      ], correct: 1, explanation: "Migration giống production, áp cho từng storage cô lập." },
    { q: "Test consumer queue và kiểm tra tin nào được ack?", options: [
        "Không test được",
        "createMessageBatch + gọi worker.queue + getQueueResult",
        "Gửi tin lên queue thật",
        "Dùng cron"
      ], correct: 1, explanation: "getQueueResult trả thông tin ack/retry và đợi waitUntil." },
    { q: "Rủi ro khi plugin tự bật nodejs_compat trong test?", options: [
        "Không có rủi ro",
        "Code dùng API Node có thể pass test nhưng lỗi khi deploy/production nếu Worker không bật cờ này",
        "Test chạy chậm",
        "Không dùng được D1"
      ], correct: 1, explanation: "Giữ compatibility thống nhất và chạy deploy --dry-run trong CI." },
    { q: "Tương đương gần nhất trong thế giới Spring?", options: [
        "Mockito thuần",
        "@SpringBootTest + Testcontainers, nhưng nhẹ hơn nhiều",
        "JMeter",
        "Selenium"
      ], correct: 1, explanation: "Runtime thật + hạ tầng giả lập local." }
  ]
});
