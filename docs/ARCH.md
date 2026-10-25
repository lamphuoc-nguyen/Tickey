# Kiến trúc event-platform (Tickey)

Nền tảng bán vé sự kiện nhiều tenant (Phase 1 MVP). Tài liệu này là bản đồ để các agent đọc trước khi sửa code.
Nguồn chi tiết: `README.md` (gốc), `supabase/README.md` (contract RPC + mã lỗi), `docs/DB_INSTRUCTIONS.md`,
`docs/MOBILE_ARCHITECTURE.md`. Khi tài liệu và code lệch nhau, **code là đúng**; ghi lại chỗ lệch vào `docs/bugs/`.

Thuật ngữ: "chuyến/suất" trong yêu cầu = **Event** (sự kiện) và **Session** (suất diễn). Một Event có nhiều Session;
mỗi Session có Ticket Type (hạng vé), sơ đồ ghế (Layout Version) và tồn kho riêng.

## 1. Cấu trúc thư mục

```
event-platform/
├── apps/
│   ├── mobile/            Expo (React Native) — MỘT app, hai giao diện Customer + Staff (chọn theo membership)
│   │   ├── src/app/            expo-router: (auth), (customer), (staff) — chỉ là route, mỏng
│   │   ├── src/features/       auth, customer/{catalog,booking,payment,tickets,refunds,support,...}, staff, forms
│   │   └── src/lib/            supabase client, repositories, capabilities (cờ bật/tắt tính năng)
│   ├── portal/            React + Vite — portal Org (/org/*) và Admin (/admin/*), deploy Vercel
│   │   ├── src/app/            router, RequireWorkspace
│   │   ├── src/features/       auth, org (events, venues, gates, staff, orders, finance...), admin (kyc, approvals, payouts...)
│   │   └── src/lib/api.ts      gọi .NET /api bằng JWT của người dùng
│   └── agent-dashboard/   Vite app quản lý cấu hình AI agent (không thuộc luồng bán vé)
├── packages/              TypeScript dùng chung
│   ├── core/                  @event/core: Supabase client (nơi DUY NHẤT tạo client), repositories, models (zod),
│   │                          ApiError + mã lỗi, HttpClient (.NET /api), HttpPaymentApi
│   ├── seat_map/              @event/seat-map: kiểu layout, validate, spatial index, renderer web/native
│   ├── ui_kit/                @event/ui-kit: design tokens
│   └── agent-manager/         @event/agent-manager: schema/registry cấu hình agent (+ agents/, registry.json)
├── backend/               .NET 10
│   ├── src/EventPlatform.Api/      Minimal API: /api/* (*Endpoints.cs), /payments/*, /health
│   ├── src/EventPlatform.Core/     SupabaseRpc/Rest/Auth/Storage client, IPaymentGateway, QrSigner, IssueTicketsWorker, Media
│   ├── src/EventPlatform.Workers/  Host chạy worker nền (hiện chỉ IssueTicketsWorker)
│   └── tests/EventPlatform.Tests/  xUnit v3
├── supabase/              Database (Postgres + Auth + Storage + pg_cron)
│   ├── migrations/            20261001000000_init_database.sql (toàn bộ schema/RLS/RPC/cron, ~7.6k dòng) + migration bổ sung
│   ├── seed.sql               tài khoản + dữ liệu test (chỉ local)
│   ├── tests/database/        pgTAP
│   ├── scripts/               smoke_e2e.sql, concurrency_ac01.sh, công cụ import dữ liệu (.mjs + test)
│   └── templates/             email Auth
├── docs/                  tài liệu; docs/bugs/ chứa báo cáo lỗi
├── Dockerfile, render.yaml  build + deploy .NET API lên Render
└── package.json, pnpm-workspace.yaml, turbo.json, tsconfig.base.json, global.json, .github/workflows/
```

## 2. Công nghệ

| Lớp | Công nghệ (phiên bản theo lockfile/manifest) |
| --- | --- |
| Monorepo | pnpm 12.9.1 (workspace `apps/*`, `packages/*`, `nodeLinker: hoisted`), Turborepo 2.x, Node ≥ 22, TypeScript ~6.0 |
| Mobile | Expo SDK 57, React Native 0.86, React 19.2, expo-router, TanStack Query 5, zustand, zod 4, Skia (seat map), EAS Build |
| Portal | React 19.2, Vite 8, react-router 8, TanStack Query 5, zustand, zod 4, lucide-react; deploy Vercel (`apps/portal/vercel.json`) |
| Shared | `@event/core` (supabase-js 2, zod), `@event/seat-map`, `@event/ui-kit` |
| Backend | .NET 10 (SDK 10.0.100, `global.json`), ASP.NET Core Minimal API, NSec (Ed25519), central package management, `TreatWarningsAsErrors` |
| Database | Supabase: Postgres + RLS, RPC `security definer`, Auth (custom access token hook, TOTP MFA), Storage, pg_cron |
| Lưu ảnh | Supabase Storage hoặc Cloudinary (`MediaStorage:ImageProvider`) |
| Thanh toán | `IPaymentGateway`; hiện chỉ có `TestPaymentGateway` (`Payments:Gateway=TEST`) — cổng thật chưa chọn (OQ-02) |
| Test | Vitest 5 (TS), xUnit v3 (.NET), pgTAP (DB), `node --test` (script import) |
| Hosting | API: Render (Docker, `render.yaml`) · Portal: Vercel · DB: Supabase hosted `ddourrslmudoqevqlvpv` (**PRODUCTION**) |

## 3. Nguyên tắc kiến trúc

- **Client đọc qua RLS, ghi qua RPC** (hoặc qua .NET, mà .NET cũng gọi RPC). Không bảng nghiệp vụ nào cho client
  INSERT/UPDATE/DELETE trực tiếp.
- **Database là nơi quyết định quyền và trạng thái.** Mọi thực thể chính có máy trạng thái bằng trigger
  `tg_guard_status`; chuyển sai → `INVALID_STATE`. Tiền là `bigint` (VND), thời gian `timestamptz`.
- **.NET API là lớp mỏng**: chuyển tiếp JWT của người gọi tới PostgREST (`CallAsUserAsync` / `SelectAsync(..., jwt)`).
  Chỉ các hàm server (IPN, worker) dùng `service_role`.
- **Contract lỗi**: `{ message: "<MÃ>", details: "<json>" }`. API map mã → HTTP status trong `Postgrest.StatusFor`
  (`UNAUTHENTICATED` 401; `FORBIDDEN`/`MFA_REQUIRED`/`OTP_REQUIRED`/`DEVICE_REVOKED` 403; `NOT_FOUND` 404;
  `INVALID_STATE`/`SESSION_NOT_ON_SALE`/`SEAT_CONFLICT`/`SOLD_OUT`/`LIMIT_EXCEEDED`/`BOOKING_EXPIRED`/`IMMUTABLE_ROW` 409).
  `RATE_LIMITED` 429 do middleware rate limit của API sinh ra (chỉ `/api/auth/*`), không phải mã RPC.
  Frontend parse bằng `ApiError.fromPostgrest` và rẽ nhánh theo `message`, không theo status.
- **Định dạng JSON**: request camelCase; response là JSON của DB (snake_case). Portal đổi sang camelCase bằng
  `mapDatabaseJson`.
- **Khoá bí mật**: `service_role`/`sb_secret_…`, `Qr:SigningKey`, Cloudinary secret chỉ ở user-secrets/env của .NET.
  App chỉ có URL + publishable/anon key.

### Frontend gọi server bằng đường nào

| Việc | Mobile | Portal |
| --- | --- | --- |
| Đăng nhập, phiên, workspace | supabase-js (`SupabaseAuthRepository`, `SupabaseWorkspaceRepository`) | supabase-js |
| Catalog, sơ đồ ghế, availability | .NET `/api/*` (`HttpCatalogRepository`) | .NET `/api/*` |
| Tạo / xem / huỷ Booking | **RPC trực tiếp** `create_booking`, `get_booking`, `cancel_booking` (`SupabaseBookingRepository`) | — |
| Mở phiên thanh toán | .NET `POST /payments/sessions` (`HttpPaymentApi`) | — |
| Vé, đơn, hoàn tiền, report, hỗ trợ | .NET `/api/*` (`HttpCustomerRepository`) | — |
| Quản trị Org/Admin | — | .NET `/api/*` (`src/lib/api.ts`, `features/*/data/*.ts`) |

## 4. Luồng chính: tìm suất → chọn ghế → giữ chỗ → thanh toán → xác nhận → huỷ/hoàn tiền

### Trạng thái Booking (trigger trên `public.bookings`)

```
PENDING ──begin_payment──► PAYMENT_PENDING ──IPN success──► PAID ──worker phát vé──► CONFIRMED
   │  (vé 0đ: thẳng PAID)        │                           │                        │
   │                             │ (job hỏi cổng: chưa thu)  └────────┬───────────────┘
   ├─cancel_booking─► CANCELLED  └─► EXPIRED ─(IPN muộn, còn ghế)─► PAID
   └─hết T_LOCK (cron)─► EXPIRED                                       ▼
                                          REFUND_PENDING ─► PARTIALLY_REFUNDED / REFUNDED
```

Tham số (`public.app_settings`): `booking.lock_minutes` = 10 (T_LOCK), `payment.session_minutes` = 15,
`payment.max_hold_minutes` = 30 (T_MAX), `booking.confirm_alert_minutes` = 5.

### 4.1 Tìm sự kiện / suất

- Mobile: `features/customer/catalog` (home, search, event, sessions, venue) → `HttpCatalogRepository`.
- API: `CatalogEndpoints.cs` — `GET /api/categories`, `/api/events?q=&categoryId=&featured=` (chỉ `PUBLISHED`),
  `/api/events/{id}`, `/api/events/{id}/sessions`, `/api/sessions/{id}/ticket-types`. Không cần đăng nhập (anon).
- DB: RLS `is_event_public` / `is_session_public`; Venue/Zone/ghế chỉ công khai khi thuộc Session của Event đã công bố.
- Trạng thái Session do cron `run_session_status_transitions` (mỗi phút) chuyển: `SCHEDULED → ON_SALE → SALES_CLOSED → ONGOING → ENDED`.

### 4.2 Chọn ghế

- Mobile: `sessions/[sessionId]/select.tsx` → `features/customer/booking/screens/selection-screen.tsx`,
  `hooks/use-selection-booking.ts`, `selection-rules.ts`, `seat-map-viewport.ts`; vẽ bằng `@event/seat-map`
  (`NativeSeatMap` Skia / `WebSeatMap`). Availability được poll 3 giây (`use-catalog.ts`).
- API: `GET /api/sessions/{id}/layout` (`get_session_layout`), `/availability` (`get_session_availability`),
  `/seat-pricing` (`get_session_seat_pricing`) — các RPC này cấp quyền cho anon.
- Ghế ngồi: `session_seats` (theo seat); khu đứng: `session_zone_inventory` (theo số lượng); quota hạng vé:
  `ticket_type_inventory`.

### 4.3 Giữ chỗ (tạo Booking)

- Mobile: `use-create-booking.ts` → `SupabaseBookingRepository.createBooking` → RPC `create_booking`
  (`p_session_id`, `p_items[]` = `{ticket_type_id, seat_id}` hoặc `{ticket_type_id, zone_id, quantity}`,
  `p_idempotency_key` ≥ 8 ký tự, `p_options`). Không tự retry; retry của người dùng phải dùng lại cùng idempotency key.
  Giỏ nháp: `draft-store.ts`, `booking-intent.ts`.
- API tương đương: `POST /api/bookings` (key trong body hoặc header `Idempotency-Key`) — dùng cho Staff POS
  (`options.bookingType = "POS"`).
- RPC `create_booking` (`supabase/migrations/...init_database.sql`, phần 1600): idempotency → Session phải `ON_SALE`
  (POS: cả `SALES_CLOSED`/`ONGOING`) và Org `APPROVED` → kiểm từng dòng → giới hạn vé/tài khoản → tạo Booking
  `PENDING` với `lock_expires_at = now + T_LOCK` → **khoá ghế all-or-nothing, theo thứ tự `seat_id`** (tránh deadlock;
  ghế bị lấy → `SEAT_CONFLICT` với `details.seat_ids`) → khu đứng (`sold + locked + held + n ≤ capacity`, không thì
  `SOLD_OUT`) → quota hạng vé → chốt tổng tiền. **Booking 0đ (FREE/COMP) chuyển thẳng `PAID`** và vào hàng phát vé.
- Hết hạn: cron `release-expired-bookings` mỗi phút + gọi lazy trong `create_booking` → `release_expired_bookings`
  → `release_booking(..., 'EXPIRED')` trả ghế/khu/quota. **Chỉ áp dụng cho `PENDING`**.
- Kiểm thử đồng thời: `supabase/scripts/concurrency_ac01.sh` (AC-01, 50 kết nối tranh một ghế).

### 4.4 Thanh toán

1. Mobile `features/customer/payment/hooks/use-payment.ts` (cần `EXPO_PUBLIC_PAYMENT_GATEWAY`, vd. `TEST`) →
   `HttpPaymentApi.createPaymentSession` → `POST {API}/payments/sessions` (`PaymentEndpoints.cs`) với JWT của khách.
   Tương đương: `POST /api/bookings/{id}/payment`.
2. API gọi RPC `begin_payment` **bằng JWT của khách**: kiểm chủ sở hữu, Session còn bán, chưa quá T_MAX; Booking →
   `PAYMENT_PENDING`, gia hạn lock = `min(now + 15 + 5 phút, created_at + T_MAX)`, tạo `payments` (`INITIATED`,
   `order_ref = <booking code>-<n>`). Gọi lại khi phiên cổng còn hạn → trả lại phiên cũ.
3. API dựng URL cổng (`IPaymentGateway.BuildPaymentUrl`), app mở bằng `WebBrowser.openAuthSessionAsync`.
   Chế độ TEST: trang `/payments/test/{orderRef}` (`TestPaymentEndpoints.cs`) có nút "Thanh toán thành công/thất bại".
4. Kết quả:
   - Cổng thật: `POST /payments/ipn/{gateway}` (hoặc `/api/payments/ipn/{gateway}`) → `VerifyIpnAsync` → RPC
     `apply_payment_success` / `apply_payment_failure` bằng `service_role`; luôn 200 sau khi ghi.
   - TEST: trang test gọi thẳng hai RPC đó rồi redirect về `/payments/return`.
   - `apply_payment_success`: idempotent theo `gateway_txn_id` (AC-06); sai số tiền → `AMOUNT_MISMATCH` + gắn cờ;
     Booking đã thanh toán bằng phiên khác → refund `DUPLICATE_PAYMENT`; còn lại `secure_booking_inventory`
     (khoá lại đúng ghế cũ nếu Booking đã EXPIRED) → `mark_booking_paid` (`PAID`, enqueue `ISSUE_TICKETS`) + ghi sổ cái
     (Platform Fee). Không còn ghế / Booking đã CANCELLED → `REFUND_PENDING` + refund `LATE_PAYMENT_NO_SEAT`.
   - `apply_payment_failure`: chỉ đánh dấu payment `FAILED`; **Booking vẫn `PAYMENT_PENDING`**, chờ job truy vấn cổng.
5. `GET /payments/return?booking_id=` redirect về deep link `App:PaymentResultDeepLink` (`eventcustomer://payment-result`).
   App **không tin** tham số trả về: luôn gọi `get_booking`, và `use-booking.ts` poll 3 giây khi trạng thái còn chuyển.

### 4.5 Xác nhận (phát vé)

- `IssueTicketsWorker` (`backend/src/EventPlatform.Core/Outbox/`) chạy trong Workers **hoặc trong API khi có
  `Qr:SigningKey`** (cấu hình Render hiện tại): `claim_outbox('ISSUE_TICKETS')` (SKIP LOCKED) → `issue_tickets`
  (sinh vé `ISSUED`, payload chỉ chứa id) → ký Ed25519 (`QrSigner`) → `attach_ticket_credentials` (đủ chữ ký → Booking
  `CONFIRMED`) → `complete_outbox` (lỗi → DB tự lên lịch retry/backoff, quá số lần → `DEAD`).
- Không có khoá ký với `kid` `ACTIVE` trong `signing_keys` → Booking kẹt ở `PAID`; cron `booking-confirm-alerts`
  cảnh báo sau T_CONFIRM_ALERT.
- Khách xem vé: `GET /api/tickets`, `/api/tickets/{id}` (kèm `credential` kid/payload/signature để vẽ QR), gán người
  giữ vé `PUT /api/tickets/{id}/holder`. Mobile cache vé offline (`tickets/ticket-cache.ts`).
- Soát vé (Staff): `register_gate_device` → `get_session_manifest` → `check_in` / `sync_offline_scans` /
  `manual_check_in` (`CheckInEndpoints.cs`). Vé `ISSUED → USED`; sau Session cron chuyển `NO_SHOW`.

### 4.6 Huỷ / hoàn tiền

- **Khách huỷ giữ chỗ**: `cancel_booking` (RPC trực tiếp, hoặc `DELETE /api/bookings/{id}`) — chỉ khi `PENDING`;
  `PAYMENT_PENDING` trả `INVALID_STATE` (tiền có thể đang về). Trả ghế, payment `INITIATED` → `EXPIRED`.
- **Khách tự yêu cầu hoàn tiền: chưa hỗ trợ ở P1** (`customerCapabilities.voluntaryRefund = false`, màn
  `refund-request` là màn "unsupported").
- **Org huỷ Session/Event**: `request_session_cancellation` / `request_event_cancellation` → tạo approval cần **hai
  Admin** (`vote_approval`) → `execute_session_cancellation`: Session `CANCELLED`; Booking `PENDING` được release;
  Booking 0đ → `CANCELLED` + vé `VOID`; Booking đã trả tiền → `REFUND_PENDING` + vé `REFUND_PENDING` + `create_refund`;
  enqueue `PROCESS_SESSION_REFUNDS`, `NOTIFY_SESSION_CANCELLED`.
- **Admin**: `create_manual_refund` (từ `approval.refund_manual_threshold` = 10.000.000đ cần hai người duyệt),
  `admin_refund_action` (`RETRY` / `REQUEST_BANK_INFO`, chỉ cho refund `FAILED`), chargeback, dispute
  (`resolve_dispute_case`).
- Trạng thái Refund: `REQUESTED → PROCESSING → SUCCEEDED | FAILED | AWAITING_BANK_INFO`;
  `AWAITING_BANK_INFO → MANUAL_TRANSFER → SUCCEEDED`. Khách nhập tài khoản: `POST /api/refunds/{id}/bank-info`
  (`submit_refund_bank_info`, cần OTP trong 10 phút: `POST /api/auth/otp` → `/otp/verify` → gọi lại), Admin xác nhận
  `confirm_manual_transfer` (cần approval). Thành công → `finalize_refund_success`: vé `REFUNDED`, Booking
  `REFUNDED`/`PARTIALLY_REFUNDED`, ghi sổ cái.
- Mobile: `features/customer/refunds` (danh sách, chi tiết, nhập ngân hàng, OTP).

### 4.7 Phần chưa có / khoảng trống đã biết (đọc trước khi điều tra lỗi)

- **`RefundWorker` chưa được viết**: outbox `PROCESS_REFUND` / `PROCESS_SESSION_REFUNDS` không có ai tiêu thụ, nên
  refund tạo ra ở trạng thái `REQUESTED` không tự tiến lên.
- **`PaymentQueryJob` chưa được viết**: Booking `PAYMENT_PENDING` mà khách bỏ dở / thanh toán thất bại sẽ giữ ghế
  cho đến khi có kết quả cổng (`list_payment_pending_to_query` → `expire_unpaid_booking`); cron chỉ giải phóng `PENDING`.
- `PayoutWorker`, `ReconciliationJob`, `NotificationsWorker` chưa có. Cổng thanh toán thật chưa chọn
  (`UnconfiguredPaymentGateway` ném lỗi khi không bật TEST).
- API chưa tự validate JWT (để PostgREST kiểm); xem `Bearer.cs`.
- `backend/src/EventPlatform.Api/appsettings.Development.json` đang trỏ `Supabase:Url` tới **project hosted
  PRODUCTION**, trong khi README nói dev mặc định là `127.0.0.1:54321`. Muốn chạy local phải ghi đè bằng user-secrets.
- `apps/portal/vite.config.ts` proxy `/api` tới API trên Render khi không đặt `VITE_API_URL`.

## 5. Cách chạy

Yêu cầu: Node ≥ 22 + pnpm 12 (`corepack enable` hoặc `npx pnpm@12.9.1 ...`), .NET 10 SDK, Docker Desktop +
Supabase CLI (`npx supabase ...`), Android Studio / Xcode cho mobile.

```bash
pnpm install
```

### 5.1 Database (Supabase local)

```bash
supabase start             # API http://127.0.0.1:54321 · DB 54322 · Studio 54323 · email test 54324
supabase db reset          # chạy migrations/ rồi seed.sql; mật khẩu mọi tài khoản test: Dev@123456
supabase status            # lấy API URL, anon key, service_role key
```

- Tài khoản test: `customer-1@dev.local`, `customer-2@dev.local` (đặt vé), `owner-a@dev.local` (Org A),
  `admin@dev.local` + `admin-2@dev.local` (hai phiếu duyệt), `staff-a@dev.local` (soát vé/POS), `multi@dev.local`.
  Admin/Owner phải bật TOTP, không thì RPC nhạy cảm trả `MFA_REQUIRED`.
- Khoá ký QR (để Booking lên `CONFIRMED`): xem `supabase/README.md` mục "Cấu hình Supabase cần làm tay".
- Thay đổi schema: **không sửa** `20261001000000_init_database.sql`; tạo migration mới trong `supabase/migrations/`.
- ⚠️ **Không** chạy `supabase db reset`, `supabase test db`, `seed.sql`, `smoke_e2e.sql`, `concurrency_ac01.sh`
  lên project hosted `ddourrslmudoqevqlvpv` (PRODUCTION).

### 5.2 Backend (.NET)

```bash
cd backend
dotnet user-secrets --project src/EventPlatform.Api set "Supabase:Url"            "http://127.0.0.1:54321"
dotnet user-secrets --project src/EventPlatform.Api set "Supabase:AnonKey"        "<anon key>"
dotnet user-secrets --project src/EventPlatform.Api set "Supabase:ServiceRoleKey" "<service_role key>"
# Tuỳ chọn: thanh toán thử + phát vé ngay trong API
dotnet user-secrets --project src/EventPlatform.Api set "Payments:Gateway" "TEST"
dotnet user-secrets --project src/EventPlatform.Api set "Qr:SigningKey"    "<ed25519 seed>"
dotnet user-secrets --project src/EventPlatform.Api set "Qr:Kid"           "dev-1"
# Workers dùng cùng bộ khoá với --project src/EventPlatform.Workers
cd ..

dotnet run --project backend/src/EventPlatform.Api       # http://0.0.0.0:5080, kiểm tra GET /health
dotnet run --project backend/src/EventPlatform.Workers   # chỉ cần khi API không có Qr:SigningKey
```

Cấu hình khác: `Api:PublicUrl` (link trả về từ cổng), `Cors:Origins` (portal), `MediaStorage:ImageProvider` +
`Cloudinary:*` (`backend/scripts/configure-cloudinary.ps1`). Docker: `docker build -t tickey-api .` ở thư mục gốc
(`Dockerfile`), container nghe cổng 8080.

### 5.3 Frontend

```bash
cp apps/mobile/.env.example apps/mobile/.env.local   # EXPO_PUBLIC_SUPABASE_URL/ANON_KEY, EXPO_PUBLIC_API_URL, EXPO_PUBLIC_PAYMENT_GATEWAY=TEST
cp apps/portal/.env.example apps/portal/.env.local   # VITE_SUPABASE_URL/ANON_KEY, VITE_API_URL

pnpm dev:portal            # Vite http://localhost:5173 (Org/Admin)
pnpm dev:mobile            # Expo: a = Android emulator, i = iOS simulator, w = web
# Android emulator truy cập máy host qua 10.0.2.2; máy thật cần IP LAN hoặc URL HTTPS công khai.
# Native module: pnpm --filter @event/mobile run:android
pnpm --filter @event/agent-dashboard dev   # (không bắt buộc) dashboard agent
```

Build: `pnpm build` (turbo), portal `pnpm --filter @event/portal build`; APK qua EAS (`cd apps/mobile && pnpm build:apk`).

## 6. Lệnh chạy test và kiểm tra

| Phạm vi | Lệnh | Ghi chú |
| --- | --- | --- |
| Toàn bộ TS (lint) | `pnpm lint` | turbo → eslint của mobile, portal, agent-dashboard |
| Toàn bộ TS (type) | `pnpm typecheck` | turbo → `tsc` từng workspace |
| Toàn bộ TS (unit) | `pnpm test` | turbo → Vitest: mobile, portal, core, seat_map, ui_kit, agent-manager |
| Một workspace | `pnpm --filter @event/mobile test` (hoặc `@event/portal`, `@event/core`, `@event/seat-map`, `@event/agent-manager`) | Mobile chỉ chạy `src/**/*.test.ts`, môi trường node |
| Build portal | `pnpm --filter @event/portal build` | CI chạy bước này |
| Định dạng | `pnpm format:check` | Prettier |
| Backend | `dotnet test --solution backend/EventPlatform.sln` | xUnit v3 (Microsoft.Testing.Platform), dùng fake HTTP, không cần DB |
| Database | `supabase test db` | pgTAP `supabase/tests/database/*.test.sql` — **chỉ local** |
| Smoke E2E DB | `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/scripts/smoke_e2e.sql` | tự rollback, chỉ local |
| Đồng thời AC-01 | `bash supabase/scripts/concurrency_ac01.sh` | chỉ local |
| Script dữ liệu | `pnpm data:test` | `node --test` cho công cụ import |

CI (`.github/workflows/ci.yml`) chạy: `pnpm lint`, `pnpm typecheck`, `pnpm test`, build portal, `dotnet test`,
`supabase db start` + `supabase test db`. Bộ kiểm tra tối thiểu trước khi bàn giao một thay đổi:

```bash
pnpm lint && pnpm typecheck && pnpm test
dotnet test --solution backend/EventPlatform.sln
supabase test db           # khi có thay đổi trong supabase/
```
