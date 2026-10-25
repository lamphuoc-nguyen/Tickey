<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# Luật làm việc cho các agent

Nhóm có ba agent: **claude** (trưởng nhóm), **opencode** (backend), **antigravity** (frontend).
Đọc `docs/ARCH.md` trước khi bắt đầu: cấu trúc thư mục, công nghệ, luồng đặt vé, cách chạy và lệnh test.

## 1. Quyền sở hữu thư mục

| Agent | Sở hữu (được sửa) | Ghi chú |
| --- | --- | --- |
| **opencode** — backend | `backend/**` · `supabase/**` (migrations, seed, pgTAP, scripts, templates, config) · `Dockerfile` · `render.yaml` | .NET API/Workers/Core, database, RLS, RPC, cron |
| **antigravity** — frontend | `apps/mobile/**` · `apps/portal/**` · `apps/agent-dashboard/**` | Màn hình, hook, route, state, style, cấu hình build của từng app (`app.json`, `eas.json`, `vite.config.ts`, `vercel.json`, `.env.example`) |
| **claude** — dùng chung | `packages/**` (`core`, `seat_map`, `ui_kit`, `agent-manager`) · `agents/**`, `registry.json` · cấu hình gốc (`package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `turbo.json`, `tsconfig.base.json`, `global.json`, `.github/**`, `.prettierrc.json`, `.prettierignore`, `.editorconfig`, `.gitignore`, `.vercelignore`) · `docs/**` · `README.md` · `AGENTS.md` | Kèm mọi lỗi **liên quan cả hai phía** (xem mục 2) |

- Chỉ sửa file trong vùng của mình. Cần thay đổi ở vùng khác → **không tự sửa**, ghi bug vào `docs/bugs/` và
  giao cho chủ vùng đó (mục 4).
- File mới thuộc về vùng chứa nó. Trường hợp không rõ → hỏi claude trước khi tạo.
- `assets/catalog/**` (ảnh catalog, dùng bởi `supabase/scripts/complete-catalog-images.mjs`) thuộc opencode.

## 2. Lỗi liên quan cả hai phía (claude xử lý)

Một lỗi thuộc claude khi bản sửa cần đụng **cả** backend và frontend, hoặc đụng contract giữa hai bên:

- Chữ ký RPC / endpoint `/api/*`, tên trường JSON request (camelCase) và response (snake_case), mã lỗi
  `{ message, details }` và HTTP status (`Postgrest.StatusFor`) ↔ `ApiError` / zod schema trong `@event/core`.
- Máy trạng thái (Booking, Payment, Ticket, Refund, Session…) mà app hiển thị hoặc rẽ nhánh theo.
- Luồng xuyên suốt: giữ chỗ → `begin_payment` → IPN/test checkout → deep link → `get_booking` → phát vé.
- Biến môi trường/URL dùng chung giữa app và API (`*_API_URL`, `App:PaymentResultDeepLink`, CORS).

Cách làm: claude chốt contract trước (ghi vào bug), sau đó hoặc tự sửa cả hai phía, hoặc tách thành việc riêng cho
opencode và antigravity cùng tham chiếu một bug. Không agent nào tự đổi contract một phía.

## 3. Git: chỉ claude được commit

- **Chỉ claude** chạy `git commit`, `git push`, `git merge`, `git rebase`, `git tag`, tạo PR.
- opencode và antigravity: để thay đổi trong working tree, **không** `git add`/`commit`/`stash`/`reset`/`checkout --`/
  `clean`, không đổi branch. Được dùng lệnh chỉ đọc: `git status`, `git diff`, `git log`, `git show`, `git blame`.
- Khi xong việc, báo cho claude: bug ID, danh sách file đã sửa, lệnh test đã chạy và kết quả (dán output khi thất bại).
- claude review diff, kiểm tra file nằm đúng vùng sở hữu, chạy lại test, rồi commit theo Conventional Commits
  (`fix(api): ...`, `fix(mobile): ...`, `fix(core): ...`), mỗi commit nhắc bug ID.

## 4. Báo cáo lỗi (`docs/bugs/`)

Lỗi được ghi theo nhóm, mỗi nhóm một file, mỗi lỗi một mục `## <mã>: <tóm tắt>`:

| File | Mã | Nội dung |
| --- | --- | --- |
| `docs/bugs/core.md` | `C-NN` | Luồng đặt vé cốt lõi, lỗi liên quan cả hai phía |
| `docs/bugs/backend.md` | `B-NN` | Lỗi chỉ ở `backend/**`, `supabase/**` |
| `docs/bugs/frontend.md` | `F-NN` | Lỗi chỉ ở `apps/**` |

Mã tăng dần trong từng file, không dùng lại mã đã có. Lỗi lớn cần thảo luận dài có thể tách file riêng
`docs/bugs/BUG-<NNN>-<slug>.md` (3 chữ số, slug tiếng Anh kebab-case). Mỗi mục theo mẫu dưới đây (với file nhóm,
tiêu đề mục là `##` và các phần con là `###`):

```markdown
# BUG-001: <tóm tắt một dòng>

- Trạng thái: OPEN | IN_PROGRESS | FIXED | VERIFIED | WONTFIX
- Phía: backend | frontend | shared
- Giao cho: opencode | antigravity | claude
- Mức độ: critical | high | medium | low
- Luồng: tìm suất | chọn ghế | giữ chỗ | thanh toán | xác nhận | huỷ/hoàn tiền | khác
- Người phát hiện: <agent>

## Tái hiện
1. ...

## Kỳ vọng / Thực tế

## Bằng chứng
`đường/dẫn/file.ts:123`, output test, log, request/response.

## Nguyên nhân (nếu đã xác định)

## Đề xuất sửa
Các file cần đổi và thuộc vùng của ai.

## Kiểm thử
Lệnh đã chạy và kết quả; test mới thêm (nếu có).
```

- Mỗi mục phải có đủ các trường trạng thái ở trên. Trích dẫn `file:dòng` phải được đối chiếu với code trước khi ghi;
  mục nào kiểm lại thấy không phải lỗi thì đặt `WONTFIX` kèm lý do, không để lẫn vào bảng tổng hợp.
- Chưa sửa code khi bug chưa được claude giao (trường `Giao cho`). Người sửa cập nhật `Trạng thái` và mục
  `Kiểm thử`; chỉ claude chuyển sang `VERIFIED`.
- File trong `docs/bugs/` là ngoại lệ của mục 1: mọi agent được tạo và cập nhật bug, nhưng không xoá bug của người khác.

## 5. An toàn

- Project Supabase hosted `ddourrslmudoqevqlvpv` là **PRODUCTION**. Không chạy `supabase db reset`,
  `supabase test db`, `supabase db push`, `seed.sql`, `smoke_e2e.sql`, `concurrency_ac01.sh`, hay `pnpm data:import`
  lên nó. Chỉ dùng stack local (`supabase start`). Chú ý `appsettings.Development.json` đang trỏ tới hosted: luôn đặt
  user-secrets `Supabase:Url` về `http://127.0.0.1:54321` trước khi chạy backend.
- Không ghi secret (`service_role`/`sb_secret_…`, `Qr:SigningKey`, Cloudinary secret, mật khẩu) vào file được
  track, `EXPO_PUBLIC_*`, `VITE_*`, log hay bug report. Không đọc/sao chép `.env.local` vào nơi khác.
- Không sửa `supabase/migrations/20261001000000_init_database.sql` hay migration đã có; thay đổi schema = migration
  mới. Mọi RPC mới phải `grant execute` tường minh.
- Giữ nguyên tắc: client đọc qua RLS, ghi qua RPC; chỉ `packages/core` tạo Supabase client.
- Không cài/đổi phiên bản dependency, không sửa `pnpm-lock.yaml` khi chưa được claude đồng ý.

## 6. Kiểm tra trước khi bàn giao

| Vùng đã sửa | Lệnh tối thiểu |
| --- | --- |
| `backend/**` | `dotnet test --solution backend/EventPlatform.sln` (build bật `TreatWarningsAsErrors`) |
| `supabase/**` | `supabase db reset` rồi `supabase test db` (**local**) |
| `apps/mobile/**` | `pnpm --filter @event/mobile lint`, `typecheck`, `test` |
| `apps/portal/**` | `pnpm --filter @event/portal lint`, `typecheck`, `test`, `build` |
| `packages/**`, cấu hình gốc | `pnpm lint && pnpm typecheck && pnpm test` và `dotnet test` nếu contract đổi |

Không báo "đã xong" khi test đỏ hoặc chưa chạy; ghi rõ bước nào bỏ qua và lý do.
