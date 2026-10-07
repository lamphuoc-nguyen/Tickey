# Database v2 — Supabase (ERD v1, chốt Sprint 0)

Căn cứ: *Mô tả dự án và hướng dẫn phát triển* (MT) và *Phân công công việc GĐ1* (PC). Khi lệch nhau, SRS là căn cứ.

```bash
supabase init                 # lần đầu (tạo config.toml), xem mục "Cấu hình Supabase"
supabase start
supabase db reset             # dựng database từ init_database.sql rồi chạy seed.sql
supabase test db              # pgTAP trong tests/database
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/scripts/smoke_e2e.sql   # tự rollback
bash supabase/scripts/concurrency_ac01.sh      # AC-01 song song thật (50 kết nối)
```

## Tài khoản test (seed.sql)

Mật khẩu chung (chỉ dùng local): **`Dev@123456`**

| Email | Vai trò | Dùng để thử |
| --- | --- | --- |
| admin@dev.local | Admin: KYC_REVIEWER, FINANCE_ADMIN, DISPUTE_ADMIN, SUPPORT | Duyệt KYC, duyệt hủy, payout |
| admin-2@dev.local | Admin: FINANCE_ADMIN, DISPUTE_ADMIN | Phiếu thứ hai cho thao tác cần hai người duyệt |
| owner-a@dev.local | OWNER Org A "Nhà hát Ánh Trăng" (APPROVED) | Venue, Layout, sự kiện "Đêm nhạc Mùa Thu" (2 Session đang bán) |
| owner-b@dev.local | OWNER Org B (APPROVED, chỉ có dữ liệu nháp) | Cô lập tenant: không thấy dữ liệu Org A |
| staff-a@dev.local | SCANNER + POS của Org A, phân công "Đêm 1" cổng G1 | Quét vé, check-in thủ công, POS |
| customer-1@dev.local, customer-2@dev.local | Customer | Đặt vé, tranh cùng một ghế |
| multi@dev.local | Customer + SCANNER Org A | Bộ chọn workspace |

Admin, OWNER, FINANCE phải bật 2FA (TOTP) trong app: các RPC nhạy cảm báo `MFA_REQUIRED` khi token chưa `aal2`.

## Cấu trúc database

Toàn bộ database nằm trong **một file**: `migrations/20261001000000_init_database.sql` (dựng mới trên project
Supabase trống). Chạy bằng `supabase db reset`, hoặc dán vào Studio > SQL Editor, hoặc
`psql "<DB_URL>" -v ON_ERROR_STOP=1 -f supabase/migrations/20261001000000_init_database.sql`.
File chia thành các PHẦN theo thứ tự dưới đây; mã trong ngoặc (0100, 1600...) là mã mà các chú thích trong file nhắc tới.
Thay đổi sau khi đã triển khai: không sửa file này, tạo migration mới chạy sau nó.

| Phần | Nội dung | Chủ |
| --- | --- | --- |
| 0100 init_utils | Mã lỗi, trigger dùng chung, `tg_guard_status` (máy trạng thái), `app_settings` (T_LOCK, T_MAX, T_CONFIRM_ALERT, REPORT_WINDOW...) | Khôi |
| 0200 identity_org | profiles, organizations, memberships, workspace, KYC, tài khoản nhận tiền, hợp đồng phí | Khôi |
| 0300 venue_layout | venues, layouts, layout_versions (phát hành thì bất biến), zones, seats, gates | Phước |
| 0400 catalog | categories, events, sessions, ticket_types, ticket_type_zones; quyền xem công khai | Khôi |
| 0500 inventory | session_seats, session_zone_inventory, ticket_type_inventory | Phước |
| 0600 b2b | corporate_accounts, corporate_members, corporate_agreements (P1, mô hình có sẵn) | Phước, Khôi |
| 0700 booking_payment_ticket | bookings, booking_items, payments, tickets, ticket_credentials, signing_keys, outbox | Phước |
| 0800 gate_staff | session_gate_zones, staff_assignments, gate_devices, scan_logs | Phước, Khôi |
| 0900 cancellation_refund | approvals (duyệt hai người), session_change_requests, refunds, chargebacks | Khôi, Phước |
| 1000 ledger_settlement_payout | sổ cái kép, Platform Fee, settlements, fund_holds, payouts, file đối soát cổng | Khôi |
| 1100 reports_disputes_support | dispute_cases, reports, dispute_messages, support_requests | Khôi |
| 1200 notifications_audit | notifications, device_tokens, nhắc lịch, audit_logs | Khôi |
| 1300 storage | bucket kyc-private, report-evidence, event-assets và policy | Khôi |
| 1400–1820 rpc_* | RPC (mọi thao tác ghi) | theo miền |
| 1850 jobs | Hàm job: cảnh báo phát vé, nhắc lịch | Khôi |
| 1900 cron_jobs | Lịch pg_cron | Phước |

## Quy ước

- **Client chỉ đọc qua RLS; mọi thao tác ghi qua RPC hoặc backend .NET** (MT 7.1). Không bảng nghiệp vụ nào có policy
  INSERT/UPDATE/DELETE cho client. Ngoại lệ có chủ đích: `profiles` (giới hạn cột), `device_tokens`,
  `notification_preferences`, `user_reminders`. pgTAP `01_schema_rules` kiểm tra quy tắc này.
- **Phạm vi dữ liệu (MT 1.1).** Bảng cấp tenant có `tenant_id` (Venue, Layout, Zone, Seat, Event, Session, Ticket Type,
  Staff, Payout, settlement, hold) và bảng giao nhau Booking, Ticket. Bảng cấp nền tảng **không có `tenant_id`**: Payment,
  Refund, Chargeback, Ledger, Platform Fee, Report, Dispute Case, approvals, support, audit; chúng có `org_id` để Org xem
  phần liên quan đến mình.
- **Khách chỉ thấy nội dung đã công bố**: Venue / Zone / ghế chỉ công khai khi thuộc một Session của sự kiện đã công bố.
  Sơ đồ ghế tải bằng `get_session_layout`, tình trạng ghế bằng `get_session_availability`.
- **Máy trạng thái (MT 6).** Booking, Ticket, Session, Refund, Organization, Event, Dispute, Payment, Payout, Settlement,
  approvals có trigger `tg_guard_status`: chuyển trạng thái ngoài danh sách thì `INVALID_STATE`. RPC vẫn dùng
  `UPDATE ... WHERE status = '<hiện tại>'`. Vé đã phát không sửa được (VOID và phát vé mới).
- Hàm mới **không** tự có quyền execute (0100 đổi default privileges). Mỗi RPC phải `grant` tường minh.
- Tiền là `bigint` (đồng). Trạng thái là text IN HOA có CHECK. Thời gian `timestamptz` (UTC), hiển thị theo `venues.timezone`.
- Sổ cái bất biến; số dư, đối soát, payout luôn tính từ bút toán (`ledger_account_balances`, `org_payable_balance`).

## Mã lỗi

`raise exception '<MÃ>' using errcode = 'P0001', detail = '<json>'` — frontend (React, React Native) đọc `error.message` của `PostgrestError` (supabase-js) và parse `error.details`; backend .NET đọc trường `message` / `details` trong JSON lỗi của PostgREST.

| Mã | Khi nào |
| --- | --- |
| UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, VALIDATION_FAILED, INVALID_STATE | MT 20.4 |
| SESSION_NOT_ON_SALE, SEAT_CONFLICT (`{"seat_ids":[...]}`), SOLD_OUT, LIMIT_EXCEEDED, BOOKING_EXPIRED | MT 20.4 |
| MFA_REQUIRED | Thao tác của Admin/OWNER/FINANCE khi token chưa `aal2` |
| OTP_REQUIRED | Gửi tài khoản nhận hoàn tiền khi chưa xác thực OTP trong `refund.otp_valid_minutes` |
| DEVICE_REVOKED | Thiết bị soát vé đã bị thu hồi: app xóa dữ liệu local |
| IMMUTABLE_ROW | Cố sửa/xóa log, sổ cái, zone/seat đã phát hành |
| LEDGER_UNBALANCED, LEDGER_INVALID_LINES | Bút toán sai (lỗi lập trình) |

`INVALID_STATE` có thể kèm `detail.reason`: `NEGATIVE_BALANCE_OVERDUE`, `BANK_ACCOUNT_COOLDOWN`, `ORG_ON_HOLD`,
`NO_ACTIVE_BANK_ACCOUNT`, `NOTHING_TO_PAY`.

## RPC theo ứng dụng (contract)

| Ứng dụng | RPC |
| --- | --- |
| Mọi app | `list_my_workspaces`, `set_active_workspace` (rồi `auth.refreshSession()`), `mark_notifications_read` |
| Customer | `get_session_layout`, `get_session_availability`, `get_session_seat_pricing` (cả anon); `create_booking`, `get_booking`, `cancel_booking`, `begin_payment` (qua API .NET `POST /payments/sessions`), `assign_ticket_holder`, `submit_report`, `submit_refund_bank_info`, `create_support_request`, `add_support_message` |
| Org portal | `create_organization`, `set_org_member`, `submit_kyc`, `save_venue`, `create_layout`, `save_layout_draft`, `new_layout_version`, `publish_layout_version`, `save_event`, `submit_event_for_review`, `save_session`, `save_ticket_type`, `assign_seats_ticket_type`, `set_session_seat_status` (giữ/chặn ghế), `set_zone_held`, `issue_comp_tickets` (vé mời), `set_session_gate_zones`, `assign_staff`, `revoke_staff_assignment`, `revoke_gate_device`, `request_session_cancellation`, `request_event_cancellation`, `add_dispute_message`, `request_bank_account_change`, `get_org_finance_summary`, `get_gate_analytics` |
| Staff app | `register_gate_device`, `get_session_manifest` (đầy đủ / delta), `check_in`, `sync_offline_scans`, `search_attendees`, `manual_check_in`, `get_gate_analytics`; POS: `create_booking` với `{"booking_type":"POS"}` + `POST /payments/sessions` (API .NET) |
| Admin portal | `review_kyc`, `review_event`, `request_org_status_change` (SUSPEND / UNSUSPEND / TERMINATE), `vote_approval` (mọi thao tác hai người), `resolve_dispute_case`, `create_manual_refund`, `admin_refund_action`, `confirm_manual_transfer`, `record_chargeback`, `resolve_chargeback`, `recompute_settlement`, `review_bank_account`, `propose_payout`, `cancel_payout`, `import_gateway_statement` |

Thao tác hai người duyệt (`approvals` + `vote_approval`; mỗi Admin một phiếu, người đề nghị là phiếu thứ nhất khi là Admin):
hủy Session, đình chỉ / gỡ đình chỉ Org, payout, hoàn tiền thủ công từ `approval.refund_manual_threshold`,
chuyển khoản hoàn tiền thủ công, gỡ hold sau Dispute.

## Hàm chỉ dành cho server (backend .NET dùng service_role, hoặc pg_cron)

Backend .NET (`backend/`, MT 20.9) gọi RPC qua PostgREST: `POST {SUPABASE_URL}/rest/v1/rpc/<tên hàm>`. Hàm chỉ dành cho
server gọi bằng `service_role` key (header `apikey` và `Authorization: Bearer`); `begin_payment` gọi bằng JWT của chính
người dùng kèm anon key. Không cần migration mới: `service_role` đã có quyền execute.

| Thành phần .NET | Hàm |
| --- | --- |
| Api `POST /payments/sessions` | gọi `begin_payment` bằng JWT của khách, dựng URL cổng từ `order_ref` + `amount` |
| Api `POST /payments/ipn/{gateway}` | xác thực chữ ký cổng → `apply_payment_success` / `apply_payment_failure`; luôn trả 200 sau khi ghi nhận |
| Workers `PaymentQueryJob` (mỗi 2 phút) | `list_payment_pending_to_query` → hỏi cổng → `apply_payment_success` hoặc `expire_unpaid_booking` |
| Workers `IssueTicketsWorker` | `claim_outbox('ISSUE_TICKETS', ...)` → `issue_tickets` → ký Ed25519 → `attach_ticket_credentials` → `complete_outbox` |
| Workers `RefundWorker` | `claim_outbox('PROCESS_REFUND' / 'PROCESS_SESSION_REFUNDS')` → `start_refund_processing` (idempotency key = refund id) → API hoàn của cổng → `apply_refund_result` |
| Workers `PayoutWorker` | `claim_outbox('PROCESS_PAYOUT')` → `mark_payout_sent` → `confirm_payout` |
| Workers `ReconciliationJob` (hằng ngày) | `import_gateway_statement` |
| Workers `NotificationsWorker` | đọc `notifications` QUEUED và outbox `NOTIFY_*`, `ADMIN_ALERT`, `GATE_ALERT`, `BOOKING_CONFIRM_ALERT` |

Khóa công khai QR không cần endpoint riêng: app Staff đọc `signing_keys` (RLS cho phép) và nhận kèm trong manifest.

Job pg_cron (1900): chuyển trạng thái Session và vé NO_SHOW (mỗi phút), dọn lock hết hạn (mỗi phút),
cảnh báo Booking PAID chưa CONFIRMED (mỗi phút), nhắc lịch 24 giờ / 2 giờ / tùy chỉnh (15 phút),
chốt kỳ đối soát (mỗi giờ), số dư âm (hằng ngày).

## Cấu hình Supabase cần làm tay

1. `config.toml` (sau `supabase init`) hoặc Dashboard > Authentication > Hooks:
   ```toml
   [auth.hook.custom_access_token]
   enabled = true
   uri = "pg-functions://postgres/public/custom_access_token_hook"

   [auth.mfa.totp]
   enroll_enabled = true
   verify_enabled = true
   ```
2. Khóa ký QR Ed25519: khóa bí mật chỉ nằm trong cấu hình bí mật của backend .NET, khóa công khai insert vào `signing_keys`:
   ```bash
   node -e "const {generateKeyPairSync}=require('crypto');const k=generateKeyPairSync('ed25519');console.log('PRIVATE',k.privateKey.export({format:'jwk'}).d);console.log('PUBLIC',k.publicKey.export({format:'jwk'}).x)"
   dotnet user-secrets --project backend/src/EventPlatform.Workers set "Qr:SigningKey" "<PRIVATE>"
   dotnet user-secrets --project backend/src/EventPlatform.Workers set "Qr:Kid" "dev-1"
   psql ... -c "insert into public.signing_keys (kid, public_key) values ('dev-1', '<PUBLIC>')"
   ```
3. Secret của cổng thanh toán (sau khi chốt OQ-02) nằm trong cấu hình .NET (`Gateway:*`). Job cần gọi cổng (truy vấn
   giao dịch, đối soát file) chạy và lên lịch trong `EventPlatform.Workers`; pg_cron chỉ giữ các job thuần database.

## Chưa có trong bản này (P1 theo PC mục 8, mô hình dữ liệu đã sẵn)

Đổi lịch Session (`POSTPONE`), chuyển nhượng vé, khách tự yêu cầu hoàn, voucher, POS tiền mặt và bán offline
theo quota, chargeback tự động, khiếu nại lại (`APPEALED`), hạng STANDARD/TRUSTED và ứng trước.

## Thay đổi so với bản đề xuất v2 ban đầu (event-platform-db-v2)

- Thêm máy trạng thái ở database cho mọi thực thể chính; vé đã phát bất biến.
- Bảng cấp nền tảng đổi `tenant_id` → `org_id` (MT 1.1).
- Venue / Zone / ghế không còn công khai mặc định; chỉ công khai theo Session đã công bố; thêm `get_session_layout`.
- Thêm RPC còn thiếu của P0: vé mời COMP, POS online, đình chỉ Org (hai người), hoàn tiền thủ công, thu tài khoản (OTP)
  và chuyển khoản thủ công, chargeback, đối soát theo Session, payout, đổi tài khoản nhận tiền có cooldown,
  số dư âm, nhập file đối soát cổng, bảng tổng hợp doanh thu Org.
- Refund engine bắt buộc REQUESTED → PROCESSING trước khi gọi cổng; outbox có `claim_outbox` / `complete_outbox`
  (SKIP LOCKED, backoff, DEAD).
- Job: cảnh báo T_CONFIRM_ALERT, nhắc lịch, chốt đối soát, số dư âm.
- `seed.sql` theo MT 16, pgTAP cho bốn bài test bắt buộc (MT 26), script AC-01 song song.
- Sửa lỗi: IPN đến muộn cho Booking đã CANCELLED nay hoàn tiền thay vì khóa lại chỗ; log quét offline đồng bộ sau khi
  Session kết thúc chuyển NO_SHOW → USED; gỡ hold trong `resolve_dispute_case` không còn dùng nhầm phiếu duyệt cũ.
