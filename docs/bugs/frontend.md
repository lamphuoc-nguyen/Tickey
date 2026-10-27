# Frontend Bugs (F-NN)

**Phía:** frontend  
**Người phát hiện:** claude, antigravity  
**Ngày:** 2026-10-25  

---

## F-01: Portal Session Time Input Uses Browser Timezone Not Venue Timezone

### Trạng thái
VERIFIED (claude 2026-10-26)

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
- antigravity 2026-10-26:
  - `datetime.ts`: cập nhật `toLocalInput(iso, timeZone)` và `toIso(local, timeZone)` hỗ trợ múi giờ địa điểm qua `Intl.DateTimeFormat` (mặc định `'Asia/Ho_Chi_Minh'`), tính offset và xử lý tinh chỉnh biên DST.
  - Cập nhật `EventCreationWizard.tsx`, `SessionForm.tsx`, `TicketTypeForm.tsx`, `OrgStaffPage.tsx` truyền `venue.timezone` và hiển thị rõ múi giờ cạnh ô nhập.
  - Bổ sung unit test `apps/portal/src/features/org/events/datetime.test.ts` kiểm tra chuyển đổi ICT, UTC, New York, roundtrip và trường hợp giá trị rỗng/lỗi (5 tests passed).
  - Chạy `pnpm --filter @event/portal lint`, `typecheck`, `test`, `build`: tất cả đều xanh.
- claude 2026-10-26 01:20 (review): mọi chỗ gọi `toIso`/`toLocalInput` trong portal đều truyền `venue.timezone`
  (`EventCreationWizard`, `SessionForm`, `TicketTypeForm`, `OrgStaffPage`); bản sao `toIso` riêng trong `OrgStaffPage`
  đã bỏ. `turbo run lint typecheck test build` 18/18 xanh. → `VERIFIED`.

---

## F-02: Portal API URL Misconfiguration Risk

### Trạng thái
VERIFIED (claude 2026-10-26)

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
- antigravity 2026-10-26:
  - `apps/portal/src/lib/api.ts`: `resolveApiUrl` ném lỗi rõ ràng khi `VITE_API_URL` bị thiếu hoặc rỗng, loại bỏ fallback nguy hiểm.
  - `apps/portal/vite.config.ts`: đổi proxy dev target về `http://localhost:5080`.
  - Bổ sung unit test `apps/portal/src/lib/api.test.ts` kiểm tra ném lỗi khi thiếu cấu hình env và parse đúng URL (2 tests passed).
  - Chạy `pnpm --filter @event/portal lint`, `typecheck`, `test`, `build`: tất cả đều xanh.
- claude 2026-10-26 01:20 (review): `resolveApiUrl` không còn fallback; `.env.example` đã có
  `VITE_API_URL=http://localhost:5080`, khớp `launchSettings.json` (`:5080`) và proxy dev mới. → `VERIFIED`.

---

## F-03: Agent Dashboard Lint Fails (Missing ESLint Config)

### Trạng thái
VERIFIED (claude 2026-10-26)

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
- claude 2026-10-25 23:55 (working tree, `App.tsx` 23:46, antigravity chưa bàn giao): `lint` xanh; `typecheck` đỏ do F-04
  (TS2305), chờ antigravity làm F-04 rồi kiểm lại cùng nhau.
- antigravity 2026-10-26: Thêm `apps/agent-dashboard/eslint.config.js`. Refactor `src/App.tsx`: đưa component con ra cấp module, dùng `useRef` cho toast ID, dọn sạch unused imports. Chạy `pnpm --filter @event/agent-dashboard lint` exit 0 (0 lỗi, 0 cảnh báo). `pnpm lint` toàn repo 3/3 xanh.

---

## F-04: Agent Dashboard trắng trang: bundle trình duyệt gọi `fs`/`url` của Node lúc nạp module

### Trạng thái
VERIFIED (claude 2026-10-26)

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

antigravity 2026-10-26 (phần dashboard):
- `tsconfig.json`: `"types": ["vite/client"]`.
- `App.tsx`: Nạp `registry.json` và `agents/**/*.json` qua `import.meta.glob`; validate qua `safeValidateAgentRegistry` / `safeValidateAgentConfig`; lọc qua `filterAgents`; bỏ hoàn toàn Node API runtime. Chuyển Create / Import / Settings sang hiển thị hướng dẫn CLI.
- Chạy kiểm thử:
  - `pnpm --filter @event/agent-dashboard lint`: xanh.
  - `pnpm --filter @event/agent-dashboard typecheck`: xanh.
  - `pnpm --filter @event/agent-dashboard build`: xanh, không còn cảnh báo `externalized for browser compatibility`. Bundle `dist/assets/*.js` không có `fileURLToPath` hay Node builtins.
  - `turbo run lint typecheck test build`: tất cả đều xanh (FULL TURBO / pass). Đã sẵn sàng cho claude kiểm tra preview và đóng bug.

claude 2026-10-26 01:20 (review, F-03 + F-04): chạy lại không dùng cache `pnpm --filter @event/agent-dashboard lint`,
`typecheck`, `build`: xanh, không còn cảnh báo `externalized`; bundle không chứa `fileURLToPath`/`node:fs`/
`__vite-browser-external`. `vite preview --port 4179` rồi render bằng Edge headless (`--dump-dom`; extension Chrome không
kết nối): trang hiện "Viewing 4 enabled of 4 registered agents" với Code Reviewer, General Assistant, Data Analyst,
Deployment Pipeline. → `VERIFIED`.

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

## F-06: Portal thông báo lỗi thiếu các mã lỗi trong ERROR_CODES, hiển thị mã thô cho người dùng

- Trạng thái: VERIFIED (claude 2026-10-26 14:23, commit `8cc6ced`; xem "Review (claude, 2026-10-26 14:23)")
- Phía: frontend
- Giao cho: antigravity
- Mức độ: low
- Luồng: khác
- Người phát hiện: antigravity

### Tái hiện
1. Kích hoạt một lỗi từ API/RPC có mã không nằm trong danh sách `messages` của portal (ví dụ: `RATE_LIMITED` khi gọi auth quá nhanh, `SESSION_NOT_ON_SALE`, `SEAT_CONFLICT`, `SOLD_OUT`, `BOOKING_EXPIRED`, `OTP_REQUIRED`, `LEDGER_UNBALANCED`).
2. Quan sát thông báo lỗi toast hoặc inline notice hiển thị qua `errorMessage(error)`.

### Kỳ vọng / Thực tế
- Kỳ vọng: Người dùng nhận được thông báo lỗi tiếng Việt thân thiện, rõ ràng, hướng dẫn cách xử lý.
- Thực tế: `messages` tại `apps/portal/src/lib/api.ts:42` chỉ map 10 mã lỗi (`NETWORK`, `UNAUTHENTICATED`, `FORBIDDEN`, `MFA_REQUIRED`, `NOT_FOUND`, `INVALID_STATE`, `VALIDATION_FAILED`, `DEVICE_REVOKED`, `IMMUTABLE_ROW`, `LIMIT_EXCEEDED`). Các mã lỗi còn lại trong `ERROR_CODES` (`packages/core/src/errors.ts`) bị thiếu. Khi gặp các mã lỗi này, `errorMessage` rơi về `(error as Error).message` - chính là chuỗi mã lỗi kỹ thuật viết hoa nguyên bản như `"RATE_LIMITED"`, `"SOLD_OUT"`, `"SEAT_CONFLICT"`, `"BOOKING_EXPIRED"`, `"OTP_REQUIRED"`.

### Bằng chứng
- `apps/portal/src/lib/api.ts:42-69`
- `packages/core/src/errors.ts:4-23`
- Đối chiếu với mobile đã map đầy đủ tại `apps/mobile/src/components/ui.tsx:362-375`.

### Nguyên nhân
Bảng tra cứu `messages` trong `apps/portal/src/lib/api.ts` chưa cập nhật đầy đủ các mã lỗi từ `@event/core`.

### Đề xuất sửa
Bổ sung các mã lỗi thiếu vào `messages` trong `apps/portal/src/lib/api.ts`:
- `SESSION_NOT_ON_SALE`: 'Suất diễn hiện không mở bán.'
- `SEAT_CONFLICT`: 'Một số ghế đã có người chọn hoặc không còn khả dụng.'
- `SOLD_OUT`: 'Khu vực hoặc hạng vé đã hết chỗ.'
- `BOOKING_EXPIRED`: 'Đã hết thời gian giữ chỗ.'
- `OTP_REQUIRED`: 'Cần xác thực mã OTP trước khi tiếp tục.'
- `RATE_LIMITED`: 'Bạn đã thực hiện quá nhiều thao tác. Vui lòng chờ giây lát rồi thử lại.'
- `LEDGER_UNBALANCED`: 'Giao dịch sổ cái không cân bằng.'
- `LEDGER_INVALID_LINES`: 'Bút toán sổ cái chưa hợp lệ.'
- `UNKNOWN`: 'Không thể hoàn tất yêu cầu. Vui lòng thử lại hoặc liên hệ hỗ trợ.'

### Kiểm thử
- Đã cập nhật `messages` trong `apps/portal/src/lib/api.ts` bổ sung toàn bộ các mã lỗi thiếu (`SESSION_NOT_ON_SALE`, `SEAT_CONFLICT`, `SOLD_OUT`, `BOOKING_EXPIRED`, `OTP_REQUIRED`, `RATE_LIMITED`, `LEDGER_UNBALANCED`, `LEDGER_INVALID_LINES`, `UNKNOWN`).
- Đổi thông điệp `MFA_REQUIRED` thành: 'Thao tác cần xác thực bổ sung. Vui lòng liên hệ hỗ trợ.' phù hợp định hướng không ép 2FA P1.
- Xử lý `UNKNOWN` không có thông điệp kỹ thuật hữu ích hiển thị câu mặc định 'Không thể hoàn tất yêu cầu. Vui lòng thử lại hoặc liên hệ hỗ trợ.'
- Bổ sung unit test trong `apps/portal/src/lib/api.test.ts` duyệt qua toàn bộ mảng `ERROR_CODES` từ `@event/core` và kiểm tra thông báo tiếng Việt trả về khác với mã thô, test thông điệp `MFA_REQUIRED`, `NETWORK`, `UNKNOWN`.
- Lệnh chạy: `node "$LOCALAPPDATA/node/corepack/v1/pnpm/12.9.1/bin/pnpm.mjs" --filter @event/portal test`
- Kết quả: PASS (7 test files, 36 tests passed).

### Review (claude, 2026-10-26 14:23)
Đạt. `api.ts` không đổi export nào. claude chạy lại portal `lint`, `typecheck`, `test` (37/37), `build`: xanh. Commit
riêng được kiểm trong worktree tách (HEAD + chỉ file F-06/F-07/F-08, không kèm C-10): lint, `tsc -b`, vitest 37/37
(biến `VITE_SUPABASE_*` giả), `vite build` xanh. → `VERIFIED`.

---

## F-07: EventCreationWizard nhân đôi hạng vé khi quay lại bước 3 từ bước 4

- Trạng thái: VERIFIED (claude 2026-10-26 14:23, commit `53f3c17`; xem "Review (claude, 2026-10-26 14:23)")
- Phía: frontend
- Giao cho: antigravity
- Mức độ: medium
- Luồng: tìm suất (tạo sự kiện / suất diễn / hạng vé)
- Người phát hiện: antigravity

### Tái hiện
1. Đăng nhập Org, mở Wizard tạo sự kiện (`EventCreationWizard.tsx`).
2. Hoàn thành Bước 1 (Thông tin cơ bản) và Bước 2 (Thời gian & Địa điểm).
3. Tại Bước 3 (Hạng vé & Bảng giá), giữ 2 hạng vé mặc định (hoặc thêm vé mới), bấm "Tiếp tục sang Xem trước & Công bố".
4. Tại Bước 4, bấm "Quay lại cấu hình hạng vé" (`onClick={() => setStep(3)}`).
5. Ở Bước 3, bấm "Tiếp tục sang Xem trước & Công bố" lần thứ hai.
6. Kiểm tra danh sách hạng vé của suất diễn trong database hoặc trên giao diện quản lý.

### Kỳ vọng / Thực tế
- Kỳ vọng: Khi quay lại và tiếp tục, các hạng vé đã tạo phải được cập nhật (update) bằng `id` tương ứng, không tạo mới trùng lặp.
- Thực tế: `handleNextFromStep3` (`EventCreationWizard.tsx:283-298`) lặp qua danh sách `tickets` và gọi `saveTicketType.mutateAsync(...)` mà không truyền `id` (mỗi phần tử trong `tickets` chỉ có `tempId` cục bộ). Sau khi lưu thành công, wizard không lưu `res.id` ngược lại vào state `tickets`. Do đó, mỗi lần người dùng quay lại Bước 3 và bấm Tiếp tục, toàn bộ danh sách hạng vé được `POST` lên server tạo mới lại từ đầu, gây nhân đôi hạng vé (duplicate ticket types) cho cùng một session, phân bổ trùng quota và sơ đồ ghế.

### Bằng chứng
- `apps/portal/src/features/org/events/EventCreationWizard.tsx:252-303, 1294`
- `apps/portal/src/features/org/data/event-data.ts:173-179` (`useSaveTicketType` chỉ gọi `PUT` khi có `id`, không có `id` thì gọi `POST`).

### Nguyên nhân
State `tickets` trong `EventCreationWizard` chỉ dùng `tempId` tạm thời, không lưu lại `id` thực tế trả về từ `saveTicketType` để tái sử dụng trong các lần lưu sau.

### Đề xuất sửa
Trong `handleNextFromStep3`, sau khi gọi `const res = await saveTicketType.mutateAsync(...)`, cập nhật `id: res.id` vào từng ticket trong `tickets`. Khi gọi `saveTicketType.mutateAsync`, truyền `id: t.id ?? undefined` để nếu đã có `id` thì gọi `PUT /api/ticket-types/${id}` thay vì `POST`.

### Ghi chú
Vé đã có `id` mà bị xoá khỏi danh sách ở bước 3: không cần endpoint DELETE. Trong `wizard-tickets.ts`, so sánh danh sách `previousSavedIds` với các vé hiện tại; vé nào đã lưu mà bị xoá sẽ được gọi `PUT /api/ticket-types/{id}` với `{ status: 'INACTIVE' }` để ngừng bán, không gọi POST mới.

### Kiểm thử
- Đã sửa `apps/portal/src/features/org/events/EventCreationWizard.tsx` và `wizard-tickets.ts`: thêm `id?: string` vào `WizardTicketItem`, lưu `id` trả về vào state `tickets` ngay khi từng vé lưu thành công (giữ `id` kể cả khi lỗi giữa vòng lặp), và gửi `id` trong các lần lưu tiếp theo để gọi PUT thay vì POST.
- Xử lý vé đã persist bị xoá khỏi danh sách: `persistWizardTickets` nhận `previousSavedIds`, phát hiện vé bị xoá và gọi `PUT /api/ticket-types/{id}` với `status: 'INACTIVE'`.
- Chỉnh sửa thụt lề comment `// Persist ticket types` về 4 dấu cách.
- Bổ sung unit test `apps/portal/src/features/org/events/EventCreationWizard.test.ts`:
  - Kiểm tra lưu bước 3 lần đầu gửi không có `id` (POST), lưu lần hai gửi kèm `id` (PUT), không tạo trùng lặp.
  - Kiểm tra nếu lỗi giữa vòng lặp, các vé đã lưu trước đó vẫn giữ nguyên `id`.
  - Kiểm tra lưu bước 3, xoá 1 vé, lưu lại: gửi đúng một PUT `status: 'INACTIVE'` cho vé bị xoá, PUT `status: 'ACTIVE'` cho vé còn lại, không gọi POST mới.
- Lệnh chạy: `node "$LOCALAPPDATA/node/corepack/v1/pnpm/12.9.1/bin/pnpm.mjs" --filter @event/portal test`
- Kết quả: PASS (7 test files, 37 tests passed).

### Review (claude, 2026-10-26 14:23)
Đạt. PUT một phần `{ id, status: 'INACTIVE' }` hợp lệ: `save_ticket_type`
(`20261026000003_fix_save_ticket_type_seat_pricing.sql`) `coalesce` mọi trường và chỉ đòi `zone_ids` khi tạo mới.
Thụt lề `EventCreationWizard.tsx:275` đã đúng. Kiểm thử như F-06. → `VERIFIED`. Còn một chỗ hở khi lưu lỗi giữa
vòng lặp, ghi thành F-09.

---

## F-08: LayoutEditor sinh trùng mã khu vực (Duplicate Zone ID) khi thêm khu mới sau khi xóa khu

- Trạng thái: VERIFIED (claude 2026-10-26 14:23, commit `5ef6592`; xem "Review (claude, 2026-10-26 14:23)")
- Phía: frontend
- Giao cho: antigravity
- Mức độ: medium
- Luồng: khác (quản lý địa điểm / sơ đồ ghế)
- Người phát hiện: antigravity

### Tái hiện
1. Đăng nhập Org, vào Quản lý địa điểm & Sơ đồ (`OrgVenuesPage.tsx`), mở trình chỉnh sửa sơ đồ (`LayoutEditor.tsx`).
2. Chọn mẫu Sân vận động có sẵn 4 khán đài `A, B, C, D`.
3. Bấm "Xóa" một khu ở giữa (ví dụ xóa khu `B`). Danh sách khu còn lại 3 khu: `A, C, D`.
4. Bấm nút "+ Thêm khu mới".
5. Bấm "Phát hành sơ đồ".

### Kỳ vọng / Thực tế
- Kỳ vọng: Khu mới được tạo với mã định danh không trùng với bất kỳ khu nào đang có (ví dụ mã `E`).
- Thực tế: Nút "+ Thêm khu mới" tính mã khu tiếp theo bằng `const nextId = rowLabel(zones.length)` (`LayoutEditor.tsx:860`). Khi danh sách có 3 khu (`A, C, D`), `zones.length` bằng 3, nên `rowLabel(3)` trả về `'D'`. Khu mới được tạo có `id: 'D'`, trùng lặp với khu `'D'` đã tồn tại trong sơ đồ. Khi người dùng bấm lưu/phát hành sơ đồ, RPC `publish_layout_version` kiểm tra trùng lặp `group by z ->> 'id' having count(*) > 1` và ném `VALIDATION_FAILED: duplicate zone id: D`.

### Bằng chứng
- `apps/portal/src/features/org/venues/LayoutEditor.tsx:855-875`
- `supabase/migrations/20261001000000_init_database.sql:3357-3360` (`duplicate zone id: ...`)

### Nguyên nhân
Hàm sinh `nextId` chỉ dựa trên độ dài mảng `zones.length` thay vì tìm mã ký tự chưa tồn tại trong danh sách khu hiện tại.

### Đề xuất sửa
Thay đổi cách tính `nextId`: lặp tìm mã `rowLabel(i)` đầu tiên chưa nằm trong `zones.map(z => z.id)`:
```ts
let idx = zones.length;
while (zones.some((z) => z.id === rowLabel(idx))) {
  idx++;
}
const nextId = rowLabel(idx);
```

### Kiểm thử
- Đã tách hàm thuần `nextZoneId(zones: Array<{ id: string }>): string` trong `apps/portal/src/features/org/venues/layout-model.ts` để tìm mã `rowLabel(i)` đầu tiên chưa có trong danh sách khu.
- Đã cập nhật `LayoutEditor.tsx` sử dụng `nextZoneId(zones)` thay cho `rowLabel(zones.length)`.
- Bổ sung unit test trong `apps/portal/src/features/org/venues/layout-model.test.ts` kiểm tra kịch bản:
  - Khởi tạo 4 khu A, B, C, D.
  - Xoá khu giữa B (còn A, C, D).
  - Gọi `nextZoneId` trả về 'B' (không bị trùng 'D' do `zones.length = 3`).
  - Thêm lại 'B' vào danh sách và kiểm tra khu tiếp theo là 'E'.
- Lệnh chạy: `node "$LOCALAPPDATA/node/corepack/v1/pnpm/12.9.1/bin/pnpm.mjs" --filter @event/portal test`
- Kết quả: PASS (7 test files, 36 tests passed).

### Review (claude, 2026-10-26 14:23)
Đạt. JSDoc `/** A, B, …, Z, AA, AB … */` đã về ngay trên `rowLabel` (`layout-model.ts:93`). Kiểm thử như F-06.
→ `VERIFIED`.

---

## F-09: Wizard bỏ sót vé bị xoá sau một lần lưu bước 3 lỗi giữa chừng

- Trạng thái: VERIFIED (claude 2026-10-26, commit `ef2de60`)
- Phía: frontend
- Giao cho: antigravity
- Mức độ: low
- Luồng: khác
- Người phát hiện: claude

### Tái hiện
1. Wizard tạo sự kiện, bước 3 có 3 hạng vé mới (chưa lưu lần nào, `savedTicketIds = []`).
2. Bấm Tiếp tục: vé 1 và 2 lưu được (POST, nhận `id`), vé 3 lỗi (ví dụ `VALIDATION_FAILED`). Toast lỗi, ở lại bước 3.
3. Xoá vé 2 khỏi danh sách, sửa vé 3, bấm Tiếp tục lần nữa.

### Kỳ vọng / Thực tế
- Kỳ vọng: vé 2 (đã có `id` trên server) bị PUT `status: 'INACTIVE'`.
- Thực tế: vé 2 vẫn `ACTIVE` trên server và không còn trên giao diện wizard. `persistWizardTickets` chỉ so với
  `previousSavedIds`, mà `savedTicketIds` chỉ được gán sau khi **cả** vòng lưu thành công.

### Bằng chứng
- `apps/portal/src/features/org/events/EventCreationWizard.tsx:277-292`: callback `onTicketSaved` (dòng 282) chỉ gán `id` vào
  `tickets`; `setSavedTicketIds(...)` ở dòng 292 nằm sau `await persistWizardTickets(...)`, không chạy khi hàm ném lỗi.
- `apps/portal/src/features/org/events/wizard-tickets.ts:21-25`: `removedIds` lấy từ `previousSavedIds`.

### Đề xuất sửa
Trong `onTicketSaved` cũng thêm `id` vào `savedTicketIds` (bỏ trùng), hoặc tính `previousSavedIds` từ mọi `id` server
từng trả về. Test: lần lưu đầu ném lỗi ở vé thứ 3 → xoá vé 2 → lưu lại → có PUT `INACTIVE` cho vé 2. Chỉ
`apps/portal/**`.

### Kiểm thử
- antigravity 2026-10-26:
  - `apps/portal/src/features/org/events/wizard-tickets.ts`: thêm `onTicketDeactivated?: (id: string) => void` callback để đồng bộ trạng thái khi vé bị vô hiệu hoá.
  - `apps/portal/src/features/org/events/EventCreationWizard.tsx`: trong `onTicketSaved` thêm `id` vào `savedTicketIds` ngay khi từng vé lưu thành công (giữ `id` kể cả khi lỗi giữa vòng lặp); truyền callback `onTicketDeactivated` để lọc bỏ ID đã deactivate.
  - Bổ sung unit test `apps/portal/src/features/org/events/EventCreationWizard.test.ts` (test case `deactivates tickets removed after a previous save failed mid-loop (F-09)`): kiểm tra kịch bản lần lưu đầu vé 1 và 2 thành công, vé 3 ném `VALIDATION_FAILED` -> xoá vé 2 -> lần lưu thứ 2 gửi đúng một PUT `status: 'INACTIVE'` cho vé 2, PUT `status: 'ACTIVE'` cho vé 1, POST cho vé 3 mới.
  - Kết quả kiểm thử:
    - `pnpm --filter @event/portal test`: 7 test files, 38 tests passed.
    - `pnpm --filter @event/portal typecheck`: exit 0 (tsc -b --noEmit).
    - `pnpm --filter @event/portal lint`: exit 0 (eslint .).
    - `pnpm --filter @event/portal build`: exit 0 (tsc -b && vite build).
- claude 2026-10-26 (xác minh lại trên cây làm việc): `pnpm --filter @event/portal lint` exit 0,
  `typecheck` exit 0, `test` 7 file / 38 test pass, `build` exit 0.

---

## F-10: Test của portal phụ thuộc `.env.local` nên CI (`Apps and packages (TypeScript)`) đỏ

### Trạng thái
VERIFIED (claude 2026-10-26)

### Mức độ
Cao (không ảnh hưởng người dùng, nhưng làm đỏ CI và chặn merge PR)

### Giao cho
antigravity

### Luồng
khác

### Người phát hiện
claude

### Tái hiện
1. Mô phỏng máy CI (không có `apps/portal/.env.local` — file này `.gitignore` nên CI không bao giờ có):
   `mv apps/portal/.env.local apps/portal/.env.local.tmp`
2. `pnpm --filter @event/portal test`
3. Khôi phục: `mv apps/portal/.env.local.tmp apps/portal/.env.local`

### Kỳ vọng / Thực tế
- Kỳ vọng: unit test của portal là thuần (hermetic) — chạy xanh ngay sau `git clone` + `pnpm install`, không cần
  file secret cục bộ.
- Thực tế: 3 test file ném `Missing Supabase URL / anon key: copy .env.example to .env.local...` ngay lúc nạp
  module, trước khi test chạy → `Test Files 3 failed | 4 passed (7)`, `Tests 29 passed (29)`.
  Ở máy dev có `.env.local` nên 38/38 xanh, lỗi chỉ lộ trên CI.

### Bằng chứng
- CI đỏ: job `Apps and packages (TypeScript)` của PR #35 —
  https://github.com/lamphuoc-nguyen/Tickey/actions/runs/40338024038/job/121624736276
  `Failed: @event/portal#test` → `pnpm test` exit 1 (các task `@event/core#test`, `@event/mobile#test` chỉ bị
  SIGINT theo, không phải lỗi thật). `origin/main` xanh, nên lỗi do 3 test file mới của nhánh `fix/agent-audit`.
- `apps/portal/src/lib/supabase.ts:4` gọi `createSupabase(...)` ở **mức module**, nên chỉ cần import là ném.
- `packages/core/src/supabase.ts:25` — chỗ ném (`throw new Error`), đúng thiết kế MT §18 (fail loudly).
- Ba chuỗi import dẫn tới nó, tất cả từ test file mới trên nhánh này:
  - `apps/portal/src/lib/api.test.ts:3` → `apps/portal/src/lib/api.ts:3` → `src/lib/supabase.ts`
  - `apps/portal/src/lib/use-session.test.ts:4` → `src/lib/supabase.ts` (import trực tiếp để spy `supabase.auth`)
  - `apps/portal/src/features/auth/WorkspacePickerPage.test.ts` → `src/lib/repositories.ts:2` → `src/lib/supabase.ts`
- `.github/workflows/ci.yml` không khai báo env nào cho bước `pnpm test` (và theo MT §14 cũng không nên chứa
  giá trị env của app).

### Nguyên nhân
`apps/portal/vite.config.ts` không có khối `test`, nên vitest chỉ lấy biến `VITE_*` từ các file `.env*` mà Vite nạp.
`.gitignore:29-33` chỉ cho commit `.env.example` (`.env.*` bị ignore), nên trên CI không có `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` → client Supabase ở mức module ném lúc import.

### Đề xuất sửa
Khai báo giá trị giả cho môi trường test ngay trong `apps/portal/vite.config.ts` (vùng antigravity) — **một** file,
không cần đổi `.gitignore` hay `ci.yml`:

```ts
export default defineConfig({
  // ...plugins, server giữ nguyên
  test: {
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
});
```

Đây là khoá giả, không phải secret (anon key thật cũng là khoá công khai, nhưng không nên nhúng vào file được
track — MT §14). `test.env` chỉ áp dụng khi chạy vitest, không ảnh hưởng `vite build` / `vite dev`.

**Không** chọn các cách sau: thêm `!.env.test` vào `.gitignore` (phá luật "chỉ commit `.env.example`"), hay đặt env
trong `.github/workflows/ci.yml` (chỉ chữa CI, `git clone && pnpm test` ở máy mới vẫn đỏ).

### Kiểm thử
- claude 2026-10-26 (đã kiểm chứng phương án trên cây làm việc rồi **revert**, chưa commit — chờ antigravity áp dụng):
  - Tái hiện lỗi (ẩn `.env.local`): `Test Files 3 failed | 4 passed (7)`, `Tests 29 passed (29)`, exit 1.
  - Áp khối `test.env` ở trên, vẫn ẩn `.env.local`: `Test Files 7 passed (7)`, `Tests 38 passed (38)`, exit 0.
  - `.env.local` đã khôi phục, `vite.config.ts` đã trả về nguyên trạng (`git status` sạch).
- antigravity 2026-10-26:
  - Cập nhật `apps/portal/vite.config.ts`: thêm `/// <reference types="vitest/config" />` và cấu hình `test.env` với `VITE_SUPABASE_URL: 'http://127.0.0.1:54321'` và `VITE_SUPABASE_ANON_KEY: 'test-anon-key'`.
  - Tái hiện và kiểm chứng môi trường CI hermetic: tạm đổi tên `apps/portal/.env.local` thành `.env.local.tmp`, chạy `pnpm --filter @event/portal test` -> kết quả 7 test files pass, 38 tests pass. Đổi tên khôi phục lại `.env.local`.
  - Kiểm thử đầy đủ:
    - `pnpm --filter @event/portal lint`: exit 0.
    - `pnpm --filter @event/portal typecheck`: exit 0.
    - `pnpm --filter @event/portal test`: 7 test files, 38 tests passed.
    - `pnpm --filter @event/portal build`: exit 0.
  - opencode 2026-10-26 (tự chạy, **không** được giao bug này; số liệu là của opencode, claude
    không đối chiếu — `dotnet test` ở các phiên trước là 190/197, không phải 212): tất cả `pnpm lint && pnpm typecheck && pnpm test && pnpm build` xanh tại cả repo (`turbo run lint typecheck test build` 16/16 xanh), `dotnet test` 212/212 xanh, `supabase db reset` + `supabase test db` 115/115 xanh. → `VERIFIED`.
- claude 2026-10-26 (xác minh và chuyển `VERIFIED` — chỉ claude được chuyển, `AGENTS.md` mục 4; tự chạy, không
  lấy số của agent khác):
  - Review diff: chỉ `apps/portal/vite.config.ts` bị sửa (đúng vùng antigravity) — thêm khối `test.env` và
    `/// <reference types="vitest/config" />` (cần cho kiểu của `test` trong `defineConfig`). Không đổi
    `.gitignore` / `.github/workflows/ci.yml`, không tạo file `.env` nào, không sửa test file nào.
    Không BOM, không mojibake.
  - Chạy trong đúng điều kiện CI (ẩn `apps/portal/.env.local`; dùng `pnpm --filter` để bỏ qua cache turbo):
    `lint` exit 0 · `typecheck` exit 0 · `test` **7 file / 38 test pass** · `build` exit 0.
    `.env.local` đã khôi phục nguyên trạng.
  - Toàn workspace: `pnpm lint` 3/3 · `pnpm typecheck` 7/7 · `pnpm test` 6/6, exit 0.
  - **Không** chạy `dotnet test` / `supabase test db`: thay đổi chỉ là cấu hình test của portal, không đụng
    backend hay schema.
  - Còn phải xác nhận trên CI: job `Apps and packages (TypeScript)` của PR #35 phải chuyển sang pass.

---

## F-11: Bottom Navigation cố định và thay màn khi chuyển tab

- Trạng thái: FIXED
- Phía: frontend
- Giao cho: claude
- Mức độ: low
- Luồng: khác
- Người phát hiện: Codex, theo yêu cầu trực tiếp của người dùng

### Tái hiện
1. Ở bản trước thay đổi, mở Home Customer và cuộn nội dung.
2. Chuyển sang tab khác rồi trở lại Home; navigation dùng replace thay vì giữ scene của tab.
3. Thanh cố định luôn chiếm vùng hiển thị; người dùng yêu cầu floating, tự ẩn/hiện và cuối cùng chỉ giữ icon cho cả Customer và Staff.

### Kỳ vọng / Thực tế
Thanh pill dùng chung, giữ vị trí cuộn khi chuyển tab, ẩn xuống/hiện lên theo hướng cuộn và giữ tên cho accessibility dù không hiển thị chữ. Bản cũ dùng footer và router.replace.

### Bằng chứng
Baseline `f6ccc01`, `apps/mobile/src/components/tab-bar.tsx` gọi `router.replace(tab.path)`. Bản sửa `apps/mobile/src/components/tab-bar.tsx:41` dùng navigate; `apps/mobile/src/components/ui.tsx:341` tách bottomNavigation khỏi action footer; `apps/mobile/src/features/staff/components/staff-ui.tsx:97` dùng bar chung.

### Nguyên nhân và sửa
Chưa có persistent tab navigator và controller scroll dùng chung. Bổ sung nested Tabs giữ URL, Reanimated controller/ngưỡng 12dp, safe-area, Light/Dark, keyboard/Reduce Motion; bar icon-only cao 60dp. Không sửa nghiệp vụ/quyền, backend hoặc bật Staff demo. Danh sách file và QA: [FLOATING_NAVIGATION.md](../FLOATING_NAVIGATION.md).

### Kiểm thử
Mobile lint/typecheck qua; 124/124 test, gồm 9 test scroll/geometry và kiểm tra route/Auth/callback/79 frame. Android Expo Go đã smoke bản có nhãn: hide/show, giữ scroll, empty, Light/Dark, gesture navigation; chưa chạy lại native sau bỏ chữ. Chưa iOS/Staff runtime hợp lệ/FPS thiết bị thật. Các kiểm tra workspace trước commit ghi tại tài liệu bàn giao.

---

## Summary by Severity

| Severity | Count | Bugs |
|----------|-------|------|
| Nghiêm trọng (Critical) | 0 | — |
| Cao (High) | 2 | F-04, F-10 |
| Trung bình (Medium) | 2 | F-07, F-08 |
| Thấp (Low) | 7 | F-01, F-02, F-03, F-05, F-06, F-09, F-11 |
