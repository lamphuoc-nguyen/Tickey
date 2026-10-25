# Frontend Bugs (F-NN)

**Phía:** frontend  
**Người phát hiện:** claude, antigravity  
**Ngày:** 2026-10-25  

---

## F-01: Portal Session Time Input Uses Browser Timezone Not Venue Timezone

### Trạng thái
OPEN

### Mức độ
Thấp

### Giao cho
antigravity

### Luồng
tìm suất

### Tái hiện
1. Đặt múi giờ máy là UTC (hoặc khác ICT). Đăng nhập `owner-a@dev.local`.
2. Tạo Session với "Bắt đầu" 19:00, "Mở bán" 09:00.
3. Xem lại trên portal (danh sách nhân sự/ca) và trên mobile.

### Kỳ vọng / Thực tế
- Kỳ vọng: 19:00 nghĩa là 19:00 giờ địa điểm.
- Thực tế: `toIso` / `toLocalInput` đổi theo múi giờ trình duyệt. Mobile và `formatDateTime` của portal lại hiển thị theo `venues.timezone`. Kết quả: giờ diễn và giờ mở/đóng bán lệch đúng bằng chênh lệch múi giờ. Cửa sổ bán (`sales_start_at`/`sales_end_at`) do `create_booking` kiểm bằng `now()` cũng lệch theo.

### Bằng chứng
`apps/portal/src/features/org/events/datetime.ts`, `apps/portal/src/features/org/events/EventCreationWizard.tsx:60-64,235-238`

### Nguyên nhân
Portal dùng múi giờ trình duyệt thay vì múi giờ venue.

### Đề xuất sửa
Chuyển đổi theo `venue.timezone` của Session (không theo trình duyệt), và hiển thị rõ múi giờ cạnh ô nhập.

### Kiểm thử
Chưa chạy. Thêm unit test Vitest cho `toIso`/`toLocalInput` với múi giờ địa điểm khác múi giờ máy.

---

## F-02: Portal API URL Misconfiguration Risk

### Trạng thái
OPEN

### Mức độ
Thấp

### Giao cho
antigravity

### Luồng
khác

### Tái hiện
1. Build portal không có `VITE_API_URL` (Vercel chưa đặt env, hoặc `.env.local` thiếu biến).
2. Đăng nhập Org, mở bất kỳ trang dữ liệu nào.

### Kỳ vọng / Thực tế
- Kỳ vọng: thiếu cấu hình thì báo lỗi rõ ràng.
- Thực tế:
  - `resolveApiUrl` rơi về `window.location.origin`.
  - Trên Vercel, `vercel.json` rewrite mọi đường dẫn về `index.html`, nên `/api/*` trả HTML. `HttpClient` parse JSON thất bại và báo lỗi `UNKNOWN` khó hiểu.
  - Khi dev, `vite.config.ts` proxy `/api` tới `https://tickey-api.onrender.com` (API nối DB production), nên dev vô tình ghi vào dữ liệu thật.

### Bằng chứng
`apps/portal/src/lib/api.ts:9-16`, `apps/portal/vercel.json` (`rewrites`), `apps/portal/vite.config.ts`

### Nguyên nhân
Fallback URL và proxy config sai.

### Đề xuất sửa
Bỏ fallback, báo lỗi cấu hình khi thiếu `VITE_API_URL`. Proxy dev trỏ `http://localhost:5080`.

### Kiểm thử
Chưa chạy. Vitest cho `resolveApiUrl` khi thiếu env.

---

## F-03: Agent Dashboard Lint Fails (Missing ESLint Config)

### Trạng thái
OPEN

### Mức độ
Thấp

### Giao cho
antigravity

### Luồng
khác

### Người phát hiện
claude

### Tái hiện
1. Ở thư mục gốc chạy `pnpm lint` (hoặc `pnpm --filter @event/agent-dashboard lint`).

### Kỳ vọng / Thực tế
- Kỳ vọng: lint chạy và xanh như portal/mobile.
- Thực tế: `ESLint couldn't find an eslint.config.* file.`, exit 2. `turbo run lint` của cả repo đỏ, nên
  `pnpm lint && pnpm typecheck && pnpm test` (AGENTS.md §6) không bao giờ qua.

### Bằng chứng
`apps/agent-dashboard/package.json:10` (`"lint": "eslint ."`), thư mục `apps/agent-dashboard/` không có
`eslint.config.*`. Các devDependency cần thiết (`@eslint/js`, `globals`, `typescript-eslint`,
`eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`) đã có ở `apps/agent-dashboard/package.json:24-34`.
Baseline ngày 2026-10-25 trên `e0a713a`: `turbo run lint typecheck test --continue` → 15/16 xanh, chỉ
`@event/agent-dashboard#lint` đỏ.

### Nguyên nhân
Tạo app nhưng thiếu file cấu hình flat config cho ESLint 10.

### Đề xuất sửa
Thêm `apps/agent-dashboard/eslint.config.js` theo mẫu `apps/portal/eslint.config.js` (ignore `dist`). Không thêm
dependency. Nếu lint báo lỗi trong `src/`, sửa luôn trong cùng mục này.

### Review bản nháp (claude, 2026-10-25 23:35)
`apps/agent-dashboard/eslint.config.js` (chưa track) giống hệt `apps/portal/eslint.config.js`, đúng vùng, không thêm
dependency: đạt. Nhưng mục này **chưa xong**: lint giờ chạy được và báo 15 lỗi, 1 cảnh báo, tất cả trong `src/App.tsx`
(theo "Đề xuất sửa" thì sửa luôn ở mục này):
- `no-unused-vars`: import `Edit`, `ChevronDown`, `ChevronUp` không dùng (dòng 12, 16, 17).
- `react-hooks/static-components` (dòng 1041-1048): `AgentListView`, `CreateAgentView`, `ImportRegistryView`,
  `SettingsView`, `AgentDetailModal`, `ToastContainer` được khai báo **bên trong** `App` (dòng 197-961), nên mỗi lần
  render là một component mới: React unmount/mount lại, form `CreateAgentView` mất state và focus khi gõ. Đưa ra cấp
  module, truyền state qua props.
- `react-hooks/purity` (dòng 63, `Date.now()` trong `showToast`) và `react-hooks/set-state-in-effect` +
  `exhaustive-deps` (dòng 171-172, `useEffect(() => { loadAgents(); }, [])`).
- `no-explicit-any` (dòng 883, 903, 920, 928).
Không tắt rule để qua lint; nếu một rule không hợp lý thì ghi lý do vào bug và hỏi claude.

Kết quả claude chạy trên working tree: `lint` exit 1 (15 lỗi); `typecheck` xanh; `build` xanh nhưng bundle hỏng lúc
chạy (xem F-04, lỗi có từ trước, không do bản sửa này).

### Kiểm thử
Chưa chạy. `pnpm --filter @event/agent-dashboard lint`, `typecheck`, `build`.
claude 2026-10-25 23:55 (working tree, `App.tsx` 23:46, antigravity chưa bàn giao): `lint` xanh; `typecheck` đỏ do F-04
(TS2305), chờ antigravity làm F-04 rồi kiểm lại cùng nhau.

---

## F-04: Agent Dashboard trắng trang: bundle trình duyệt gọi `fs`/`url` của Node lúc nạp module

### Trạng thái
IN_PROGRESS (phần `packages/agent-manager` xong; chờ antigravity sửa `apps/agent-dashboard`)

### Phía
shared (`packages/agent-manager` + `apps/agent-dashboard`)

### Mức độ
Cao (app không chạy được)

### Giao cho
claude (`packages/agent-manager`, xong) · antigravity (`apps/agent-dashboard`)

### Luồng
khác

### Người phát hiện
claude

### Tái hiện
1. `pnpm --filter @event/agent-dashboard build` (xanh, kèm cảnh báo `Module "fs"/"path"/"url" has been externalized
   for browser compatibility`).
2. Mở `dist/` bằng `vite preview`.

### Kỳ vọng / Thực tế
- Kỳ vọng: dashboard hiển thị danh sách agent.
- Thực tế: bundle thay `fs`/`path`/`url` bằng object rỗng; câu lệnh cấp module `fileURLToPath(import.meta.url)` ném
  `TypeError` ngay khi nạp → trang trắng. (Kết luận từ bundle, chưa mở trình duyệt.)

### Bằng chứng
- `packages/agent-manager/src/registry/agent-registry.ts:1-3` import `fs`, `path`, `url`; dòng 24
  `const __filename = fileURLToPath(import.meta.url);` chạy ở cấp module; `readFileSync`/`writeFileSync` ở dòng 59,
  88, 121, 308, 345, 352, 364.
- `apps/agent-dashboard/src/App.tsx:33` import từ `@event/agent-manager`; dòng 640 `await import('fs')`.
- Bundle `dist/assets/index-*.js`: `var af=t(((e,t)=>{t.exports={}})),Q=af(); ... var sf=(0,Q.fileURLToPath)(import.meta.url);`
  và lần nữa ở `ff=(0,Q.fileURLToPath)(import.meta.url)` (từ `App.tsx`).

### Nguyên nhân
`@event/agent-manager` chỉ có một entry dùng cho cả CLI Node và trình duyệt; registry đọc/ghi `registry.json` trực tiếp
trên đĩa, điều trình duyệt không làm được.

### Đề xuất sửa
Cần người dùng chọn hướng trước khi sửa:
- (a) Dashboard đọc `registry.json` tĩnh (import JSON lúc build / fetch) và chỉ đọc; tác vụ ghi để CLI. `agent-manager`
  tách entry thuần (schema, validate, không `fs`) cho trình duyệt và entry `node` cho registry.
- (b) Dashboard gọi một API cục bộ (dev server/Node) để đọc/ghi registry.
Sau khi chốt: claude sửa `packages/agent-manager`, antigravity sửa `apps/agent-dashboard`.

### Hướng đã chốt (người dùng chọn (a), 2026-10-25)
Dashboard **chỉ đọc**, nạp `registry.json` và `agents/**/*.json` lúc build. Mọi thao tác ghi (tạo, đăng ký, bật/tắt,
sửa tag, import/export) thuộc CLI `@event/agent-manager`, không làm trong trình duyệt.

Contract `@event/agent-manager` (claude, đã làm):
- Entry `@event/agent-manager` (`src/index.ts`) an toàn cho trình duyệt: schema + `validate*`/`safeValidate*`
  (`AgentRegistrySchema`, `AgentConfigSchema`…), `filterAgents(agents, { enabledOnly, category, tag })`, `toPosixPath`,
  `generateUUID`/`isValidUUID`/`generateShortId`/`slugify`, các type. Test `Browser entry > does not import Node built-ins`
  chặn mọi import `fs`/`path`/`url`/`os`/`node:*` trong cây import của entry này.
- Entry `@event/agent-manager/node` (`src/node.ts`): như trên + `AgentRegistryManager`, `createAgentRegistryManager`.
  Chỉ dùng trong Node (CLI, test).
- `configPath` trong registry luôn dùng `/` (`registerAgent` gọi `toPosixPath`; `registry.json` đã chuẩn hoá), khớp khoá
  của `import.meta.glob` sau khi bỏ tiền tố `../../../`.
- Bỏ câu lệnh cấp module `fileURLToPath(import.meta.url)` (không dùng) ở `agent-registry.ts`.

Việc của antigravity (`apps/agent-dashboard/**`):
1. `App.tsx`: bỏ `createAgentRegistryManager`, `resolve`, `__dirname`, `import('fs')`. Nạp dữ liệu bằng
   `import.meta.glob('../../../registry.json', { eager: true, import: 'default' })` và
   `import.meta.glob('../../../agents/**/*.json', { eager: true, import: 'default' })` (glob không vướng `rootDir: src`),
   kiểm bằng `safeValidateAgentRegistry` / `safeValidateAgentConfig`; dữ liệu sai → hiện lỗi trên trang, không trắng trang.
   Lọc bằng `filterAgents`.
2. Bỏ hoặc vô hiệu các tab/nút ghi (Create Agent, Import Registry, Export, bật/tắt, Settings đổi đường dẫn); nếu giữ
   chỗ hiển thị thì ghi rõ lệnh CLI tương ứng thay vì nút.
3. `tsconfig.json`: `"types": ["node"]` → `["vite/client"]` để dùng Node API trong `src/` báo lỗi lúc typecheck
   (`vite/client` đi kèm `vite`, không thêm dependency). Không thêm/đổi package.
4. Làm cùng F-03 (lint) vì cùng sửa `App.tsx`.

### Kiểm thử
claude (2026-10-25, phần package): `pnpm --filter @event/agent-manager typecheck` xanh, `test` 17/17 xanh (thêm 3 test;
đã thử đột biến: thêm `createAgentRegistryManager` vào `index.ts` → test chặn đỏ, chỉ ra `agent-registry.ts: fs`, `path`).
`turbo run lint typecheck test`: 14/16; đỏ `@event/agent-dashboard#lint` (F-03, có sẵn) và
`@event/agent-dashboard#typecheck`: `src/App.tsx(29,3): error TS2305: Module '"@event/agent-manager"' has no exported
member 'createAgentRegistryManager'` — **dự kiến**: lỗi lúc chạy nay lộ ra lúc typecheck, hết khi antigravity làm xong.
Đóng bug khi: `lint`, `typecheck`, `build` dashboard xanh; `build` không còn cảnh báo `externalized for browser
compatibility`; `vite preview` hiển thị 4 agent của `registry.json` (claude kiểm trên trình duyệt).

---

## F-05: CLI `@event/agent-manager` không chạy: Node không tìm thấy `../registry/agent-registry.js`

### Trạng thái
VERIFIED

### Phía
shared (`packages/agent-manager`)

### Mức độ
Thấp (công cụ dev; không ảnh hưởng app người dùng)

### Giao cho
claude

### Luồng
khác

### Người phát hiện
claude

### Tái hiện
1. `cd packages/agent-manager && node src/cli/list-agents.ts` (cũng là script `agent:list`; tương tự `agent:validate`,
   `agent:register`).

### Kỳ vọng / Thực tế
- Kỳ vọng: in danh sách agent.
- Thực tế: `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/src/registry/agent-registry.js' imported from
  …/src/cli/list-agents.ts`.

### Bằng chứng
`packages/agent-manager/src/cli/list-agents.ts:1` (`HEAD` cũng vậy, có từ trước F-04): Node chạy `.ts` bằng type
stripping nhưng không đổi specifier `.js` → `.ts`; chỉ bundler/vitest làm việc đó.

### Nguyên nhân
Script dùng `node <file>.ts` trong khi mã import theo kiểu bundler (`.js`).

### Đề xuất sửa
Chọn một: đổi import trong cây CLI sang `.ts` + `allowImportingTsExtensions` (cần `noEmit`, hiện tsconfig của package
`noEmit: false`), hoặc chạy CLI qua công cụ đã có trong repo (không thêm dependency). Cần thống nhất trước khi sửa vì
F-04 hướng dẫn dashboard trỏ người dùng sang CLI.

### Sửa (claude, 2026-10-25)
- Chọn `.ts` specifier + `rewriteRelativeImportExtensions` (TS ≥ 5.7, giữ `noEmit: false`), không thêm dependency.
  Chỉ đổi các file chỉ chạy trong Node (`src/cli/*.ts`, `src/registry/agent-registry.ts`); cây import của entry trình
  duyệt (`index.ts` → schemas, `registry-query`, `utils/id`) giữ `.js`, nên dashboard không cần đổi tsconfig.
- Node strip type nhưng không biết tên nào là type: `import { AgentConfig }` lỗi lúc chạy. Bật `verbatimModuleSyntax`
  + `erasableSyntaxOnly` ở `packages/agent-manager/tsconfig.json` để typecheck bắt lỗi này; sửa 7 import thành `type`
  (`agent-registry.ts`, `registry-query.ts`).
- Lỗi thứ hai lộ ra sau khi CLI chạy được: thư mục gốc mặc định là `process.cwd()`, mà pnpm chạy script trong
  `packages/agent-manager`, nên `agent:list` báo "No agents found". Mặc định nay là repo root
  (`resolve(import.meta.dirname, '../../../..')`); `--root` vẫn ghi đè. README ghi cách gọi từ repo root.

### Kiểm thử
claude 2026-10-25: `pnpm --filter @event/agent-manager typecheck` xanh, `test` 17/17. `agent:list` → 4 agent;
`agent:validate` → "All configs valid." (4); `agent:validate --file agents/coding/code-reviewer-v1.0.0.json` hợp lệ;
`agent:list --format json` đúng; `register-agent.ts --help` chạy (không chạy lệnh ghi). `turbo run lint typecheck test`:
15/16, chỉ đỏ `@event/agent-dashboard#typecheck` TS2305 (F-04, chờ antigravity).

---

## Summary by Severity

| Severity | Count | Bugs |
|----------|-------|------|
| Nghiêm trọng (Critical) | 0 | — |
| Cao (High) | 1 | F-04 |
| Trung bình (Medium) | 0 | — |
| Thấp (Low) | 4 | F-01, F-02, F-03, F-05 |