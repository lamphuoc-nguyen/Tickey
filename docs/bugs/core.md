# Rủi ro cốt lõi của luồng đặt vé (C-xx)

Kiểm tra tĩnh (đọc code), chưa chạy thử trên stack local, chưa sửa code. Mốc: nhánh `fix/agent-audit`, commit `33114f5`.
Đường dẫn `init.sql` dưới đây là `supabase/migrations/20261001000000_init_database.sql`.

## Tổng hợp theo 6 nhóm rủi ro

| # | Rủi ro | Kết luận | Mã lỗi |
| --- | --- | --- | --- |
| 1 | Hai người cùng đặt một ghế | **Không phát hiện lỗi.** `create_booking` chạy trong một transaction: `SELECT … FOR UPDATE` các dòng `session_seats` theo thứ tự `seat_id` (tránh deadlock), rồi `UPDATE … WHERE status = 'AVAILABLE'` có điều kiện; thiếu dòng nào → `SEAT_CONFLICT` và rollback toàn bộ (`init.sql:4604-4627`). Khu đứng và quota dùng `UPDATE … WHERE capacity - sold - locked - held >= n` nguyên tử (`init.sql:4667`, `4690`). Advisory lock theo (user, session) chặn vượt giới hạn vé/tài khoản (`init.sql:4459`). Idempotency key có `unique (created_by, idempotency_key)` + bắt `unique_violation` (`init.sql:4417-4421`, `4598-4601`). Mobile xử lý `SeatConflictError` đúng (`use-selection-booking.ts:53`). Có script `supabase/scripts/concurrency_ac01.sh` nhưng chưa chạy trong đợt này. | — |
| 2 | Thanh toán gọi 2 lần / callback trễ | IPN trùng (cùng `gateway_txn_id`) và IPN trễ sau khi hết hạn được xử lý đúng ở DB. Lỗi nằm ở nhánh **thất bại / hết phiên cổng** và các phần chưa được viết. | C-01, C-02, C-03, C-04 |
| 3 | Nhả ghế khi hết hạn | Booking `PENDING` được nhả mỗi phút (cron + lazy). Booking `PAYMENT_PENDING` **không bao giờ được nhả** → rò quota hạng vé / khu đứng. | C-01 |
| 4 | Xem / huỷ vé người khác bằng cách đổi ID | **Không phát hiện lỗi.** `get_booking` qua `can_view_booking`; `cancel_booking`, `begin_payment` kiểm `created_by`/`user_id` và trả `NOT_FOUND`; `assign_ticket_holder` kiểm `owner_id`; `GET /api/tickets/{id}` đi qua RLS `tickets_read`; QR (`ticket_credentials`) chỉ chủ vé hoặc Staff POS đã bán đọc được (`init.sql:1586-1614`, `4783-4826`, `5281-5300`). API chỉ dùng `service_role` ở IPN và trang thanh toán thử (xem C-03). Function mới mặc định không có quyền execute (`init.sql:63-64`). | C-03 (gián tiếp) |
| 5 | Giá và múi giờ | Giá do server quyết định, chụp vào `booking_items`; không cho đổi giá khi đã có người mua; app hiển thị `total_amount` của server; giờ suất diễn trên mobile dùng `venues.timezone`. Rủi ro ở cách gán hạng giá cho ghế và ô nhập giờ trên portal. | C-05, C-06, C-07 |
| 6 | Frontend–backend khớp API | Mọi đường dẫn `/api/*` mà `@event/core` và portal gọi đều có route tương ứng; payload RPC được serialize `snake_case` (`SupabaseRpcClient.Json`); zod schema khớp các cột được select. Lệch về ngữ nghĩa ở C-05 và cấu hình URL ở C-08. | C-05, C-08 |

---

## C-01: Booking `PAYMENT_PENDING` bị kẹt vĩnh viễn, không thanh toán lại, không huỷ được, giữ quota

- Trạng thái: OPEN (contract đã chốt, xem "Contract đã chốt")
- Phía: shared
- Giao cho: opencode (migration `begin_payment` + `list_payment_pending_to_query`, `PaymentQueryJob`), antigravity (màn hình booking)
- Mức độ: high
- Luồng: thanh toán | giữ chỗ
- Người phát hiện: claude

### Tái hiện
1. API chạy `Payments:Gateway=TEST`, mobile `EXPO_PUBLIC_PAYMENT_GATEWAY=TEST`. Đăng nhập `customer-1@dev.local`.
2. Chọn ghế "Đêm 1" → tạo Booking (`PENDING`) → "Thanh toán" (`begin_payment` → `PAYMENT_PENDING`).
3. Trên trang thử chọn **"Thanh toán thất bại"** (hoặc đóng trình duyệt và chờ quá 15 phút).
4. Quay lại app, bấm thanh toán lần nữa, hoặc thử huỷ đơn.

### Kỳ vọng / Thực tế
- Kỳ vọng: khách thanh toán lại được trong thời hạn T_MAX, hoặc đơn hết hạn và trả chỗ.
- Thực tế:
  - `apply_payment_failure` chỉ đổi payment sang `FAILED`, Booking vẫn `PAYMENT_PENDING` (`init.sql:5011-5031`).
  - `begin_payment` với Booking `PAYMENT_PENDING` chỉ tìm payment `INITIATED` còn hạn. Không có thì trả
    `INVALID_STATE {reason: "awaiting gateway confirmation"}` (`init.sql:4851-4863`), nên không thể thanh toán lại.
  - `cancel_booking` chỉ nhận `PENDING` (`init.sql:4813-4816`).
  - `release_expired_bookings` (cron mỗi phút) chỉ nhả `PENDING` (`init.sql:4098-4124`).
  - Lối thoát duy nhất là `PaymentQueryJob` → `list_payment_pending_to_query` → `expire_unpaid_booking`, nhưng job
    này **chưa được viết** (`backend/src/EventPlatform.Workers/Program.cs:12`).
  - Mobile hiển thị "Đang xác nhận thanh toán… Vui lòng không thanh toán lại" và poll `get_booking` mỗi 3 giây mãi
    mãi (`booking-outcome.ts`, `hooks/use-booking.ts:19`).
- Hệ quả về tồn kho (rủi ro 3): sau khi `lock_expires_at` qua, ghế `LOCKED` được coi là trống
  (`get_session_availability`, `init.sql:4282`), và người khác lấy được ghế (`init.sql:4618`). Nhưng
  `ticket_type_inventory.locked` và `session_zone_inventory.locked` của Booking kẹt **không bao giờ bị trừ**, vì
  `release_booking` không được gọi. Quota hạng vé bị tính hai lần, khu đứng mất chỗ, dẫn tới `SOLD_OUT` giả.
  Khoá ghế trong `secure_booking_inventory` vẫn an toàn: IPN đến muộn sẽ hoàn tiền nếu ghế đã bị lấy.

### Bằng chứng
`init.sql:4851-4863`, `init.sql:4813-4816`, `init.sql:5011-5031`, `init.sql:4098-4124`,
`backend/src/EventPlatform.Workers/Program.cs:12-13`,
`apps/mobile/src/features/customer/booking/booking-outcome.ts` (nhánh `PAYMENT_PENDING`).

### Nguyên nhân
Thiết kế "PAYMENT_PENDING chỉ hết hạn khi cổng xác nhận chưa thu" (SRS 3.4) phụ thuộc vào `PaymentQueryJob`,
mà job này chưa tồn tại. Chế độ TEST không có trạng thái "truy vấn cổng" nào để dựa vào.

### Contract đã chốt (người dùng duyệt 2026-10-25: **cho thanh toán lại trong T_MAX**)
Không đổi chữ ký RPC, endpoint hay schema JSON (`booking_to_json` đã có `status`, `lock_expires_at`,
`payment_deadline_at`, `server_now`).

1. **`begin_payment` với Booking `PAYMENT_PENDING`** (migration mới, opencode):
   - Payment mới nhất `INITIATED` và phiên còn hạn → trả lại phiên đó (giữ nguyên hành vi hiện tại, idempotent).
   - Ngược lại (payment mới nhất `FAILED`, hoặc `INITIATED` đã quá `payment.session_minutes`):
     - `lock_expires_at <= now()` → `BOOKING_EXPIRED`.
     - Tính `v_lock` như nhánh `PENDING` (theo `payment_deadline_at`); không đủ một phiên trọn vẹn →
       `BOOKING_EXPIRED {reason: "T_MAX reached"}`.
     - Đặt payment `INITIATED` cũ sang `EXPIRED` (máy trạng thái cho phép, và vẫn nhận IPN đến muộn
       `EXPIRED → SUCCEEDED`; khoản thu thừa đi nhánh `DUPLICATE_PAYMENT`, cần C-02 để thực sự hoàn).
     - Tạo payment mới (`order_ref` = `<code>-<n+1>`), gia hạn `bookings.lock_expires_at` và ghế `LOCKED`.
     - Response giống hệt nhánh `PENDING`.
   - Bỏ lỗi `INVALID_STATE {reason: "awaiting gateway confirmation"}`.
2. **`PaymentQueryJob`** (opencode): chạy được trong API (hosted service, giống `IssueTicketsWorker`, vì Render chỉ
   có một service) và trong Workers. Mỗi phút lấy `list_payment_pending_to_query`, **thêm điều kiện
   `b.lock_expires_at < now()`** (migration mới) để không cắt ngang cửa sổ thanh toán lại. Payment `FAILED` → gọi
   `expire_unpaid_booking` luôn; còn lại hỏi `IPaymentGateway.QueryAsync` (`TestPaymentGateway` trả `null`, coi là "chưa thu") → chưa thu thì
   `expire_unpaid_booking`, đã thu thì `apply_payment_success`.
3. **App** (antigravity), Booking `PAYMENT_PENDING`:
   - `lock_expires_at > server_now` → hiện nút **"Tiếp tục thanh toán"**, gọi `POST /payments/sessions` (`PaymentApi`, bên trong là
     `begin_payment`) rồi mở `paymentUrl` (gọi lại khi phiên cũ còn hạn thì được đúng phiên cũ, nên an toàn). Bỏ dòng "Vui lòng không thanh toán lại".
   - `lock_expires_at <= server_now` → hiện "Đang chờ xác nhận / sắp hết hạn", tiếp tục poll nhưng giãn dần
     (3s → 10s → 30s), tối đa ~10 phút rồi dừng với nút "Tải lại".
   - `BOOKING_EXPIRED` từ `begin_payment` → màn hình hết hạn hiện có.
   - `@event/core` không cần đổi (claude kiểm lại khi review).

### Kiểm thử
Chưa chạy. Cần thêm: pgTAP cho `apply_payment_failure` → thanh toán lại / hết hạn; test xUnit cho job; kiểm tra
`ticket_type_inventory.locked` trở về 0 sau khi hết hạn.

---

## C-02: Không có `RefundWorker`, refund nằm mãi ở `REQUESTED`

- Trạng thái: OPEN
- Phía: backend
- Giao cho: opencode
- Mức độ: high
- Luồng: huỷ/hoàn tiền | thanh toán (callback trễ)
- Người phát hiện: claude

### Tái hiện
1. Gây một refund bằng một trong các cách sau:
   - IPN/thanh toán thử đến sau khi Booking đã `EXPIRED` và ghế đã bị lấy (`LATE_PAYMENT_NO_SEAT`).
   - Thanh toán hai phiên cho cùng Booking (`DUPLICATE_PAYMENT`).
   - Huỷ Session đủ hai phiếu Admin (`execute_session_cancellation`).
2. Xem `public.refunds` và outbox `PROCESS_REFUND` / `PROCESS_SESSION_REFUNDS`.

### Kỳ vọng / Thực tế
- Kỳ vọng: worker nhận outbox → `start_refund_processing` → gọi cổng → `apply_refund_result`.
- Thực tế:
  - Không có consumer nào cho outbox `PROCESS_REFUND` / `PROCESS_SESSION_REFUNDS`: chỉ có hằng số trong
    `OutboxJob.cs:18-19`, `Program.cs` ghi chú "Still to build".
  - Refund ở `REQUESTED`, Booking ở `REFUND_PENDING`, khách thấy "Đang xử lý hoàn tiền" vô thời hạn.
  - `admin_refund_action` chỉ áp dụng cho refund `FAILED` (`init.sql:6693-6695`), nên Admin không đẩy tay được.
- Cổng thật chưa chọn (OQ-02), nhưng ngay cả chế độ TEST cũng không có đường nào để refund tự kết thúc.

### Bằng chứng
`backend/src/EventPlatform.Core/Outbox/OutboxJob.cs:18-19`, `backend/src/EventPlatform.Workers/Program.cs:12`,
`init.sql:4960-4967`, `init.sql:4990-5005`, `init.sql:6045-6075`, `init.sql:6679-6709`.

### Đề xuất sửa
Viết `RefundWorker` theo contract trong `supabase/README.md` (idempotency key = `refunds.id`). Cho
`TestPaymentGateway` một "hoàn tiền thử" thành công, để kiểm thử E2E được. Cân nhắc cho Admin chuyển refund
`REQUESTED` quá hạn sang `AWAITING_BANK_INFO`; việc này cần migration mới.

### Kiểm thử
Chưa chạy. Cần test xUnit cho worker (giống `IssueTicketsWorkerTests.cs`) và pgTAP cho chuỗi trạng thái refund.

---

## C-03: Trang thanh toán thử nhận POST không cần đăng nhập, ai biết `order_ref` cũng chốt được kết quả

- Trạng thái: OPEN
- Phía: backend
- Giao cho: opencode
- Mức độ: medium
- Luồng: thanh toán
- Người phát hiện: claude

### Tái hiện
1. Có `order_ref` của người khác. Định dạng là `<booking code>-<n>`: code gồm 10 ký tự hex, hiển thị cho khách và
   Staff, và nằm trong URL thanh toán.
2. Gửi `POST {API}/payments/test/{orderRef}` với form `amount=<tổng tiền>`, `result=fail` hoặc `success`, và
   `return=<Api:PublicUrl>/payments/return?booking_id=...`. Không cần JWT.

### Kỳ vọng / Thực tế
- Kỳ vọng: chỉ chủ Booking (hoặc cổng thật đã ký) mới chốt được kết quả.
- Thực tế: endpoint gọi `apply_payment_success` / `apply_payment_failure` bằng `service_role` mà không kiểm tra
  người gọi (`TestPaymentEndpoints.cs:21-48`).
  - Gửi `fail` sẽ đẩy Booking của người khác vào trạng thái kẹt C-01.
  - Gửi `success` sẽ phát vé không cần thanh toán. Đây là bản chất của chế độ TEST, nhưng chế độ này đang bật
    trên API hosted (`render.yaml`, `Payments__Gateway=TEST`).
  - Nộp form "thành công" hai lần (double-click) tạo `gateway_txn_id` mới, dẫn tới `NEEDS_REVIEW` + `ADMIN_ALERT`
    giả (`init.sql:4928-4935`).

### Bằng chứng
`backend/src/EventPlatform.Api/TestPaymentEndpoints.cs:21-48`, `render.yaml` (`Payments__Gateway: TEST`),
`init.sql:1263-1264` (cách sinh `code`), `init.sql:4897` (cách sinh `order_ref`).

### Đề xuất sửa
Ký `orderRef + amount + return` bằng HMAC phía server lúc dựng URL (`TestPaymentGateway.BuildPaymentUrl`) và kiểm
chữ ký ở POST. Làm cho POST idempotent: gửi lần hai thì trả kết quả cũ, không tạo txn mới.

### Kiểm thử
Chưa chạy. Bổ sung `TestPaymentTests.cs`: POST thiếu hoặc sai chữ ký → 400; POST hai lần → một giao dịch.

---

## C-04: IPN giao dịch thứ hai cho cùng đơn và IPN sau `AMOUNT_MISMATCH` không có đường xử lý

- Trạng thái: OPEN
- Phía: backend
- Giao cho: opencode
- Mức độ: low (chưa có cổng thật, cần sửa trước khi bật cổng thật)
- Luồng: thanh toán
- Người phát hiện: claude

### Tái hiện
1. Payment đã `SUCCEEDED`, cổng gửi IPN thành công với `gateway_txn_id` **khác** cho cùng `order_ref`.
2. Hoặc: IPN đầu sai số tiền (payment → `AMOUNT_MISMATCH`), sau đó cổng gửi IPN đúng số tiền với txn khác.

### Kỳ vọng / Thực tế
- Kỳ vọng: khoản thu thứ hai được hoàn (như `DUPLICATE_PAYMENT`); IPN hợp lệ sau mismatch được ghi nhận hoặc
  chuyển duyệt tay, và cổng nhận 200.
- Thực tế:
  - Trường hợp 1: chỉ enqueue `ADMIN_ALERT` `SECOND_TXN_SAME_ORDER` và trả `NEEDS_REVIEW` (`init.sql:4928-4935`).
    Không tạo refund, và chưa có `NotificationsWorker` nên không ai thấy cảnh báo. Tiền khách bị thu hai lần.
  - Trường hợp 2: máy trạng thái không cho `AMOUNT_MISMATCH → SUCCEEDED` (`init.sql:1371-1374`), nên
    `tg_guard_status` ném `INVALID_STATE`. API trả 409 (`Postgrest.StatusFor`) và cổng sẽ retry IPN liên tục.

### Bằng chứng
`init.sql:4924-4950`, `init.sql:1371-1374`, `backend/src/EventPlatform.Api/PaymentEndpoints.cs:56-87`.

### Đề xuất sửa
Migration mới: trường hợp 1 ghi một payment/refund `DUPLICATE_PAYMENT` cho txn thứ hai; trường hợp 2 trả kết quả
`NEEDS_REVIEW` thay vì ném lỗi, để IPN luôn nhận 200 sau khi đã ghi nhận.

### Kiểm thử
Chưa chạy. pgTAP cho hai kịch bản trên.

---

## C-05: Hạng giá của ghế phụ thuộc thứ tự lưu hạng vé; hạng FREE/COMP có thể "chiếm" ghế của hạng trả tiền

- Trạng thái: OPEN (cần tái hiện trên local)
- Phía: backend (DB), ảnh hưởng hiển thị mobile
- Giao cho: opencode
- Mức độ: medium
- Luồng: chọn ghế | giá
- Người phát hiện: claude

### Tái hiện
1. Portal Org A: tạo Session mới. Lưu hạng **"Khách mời" (COMP)** hoặc **"Sinh viên (FREE)"** với `zone_ids`
   chứa zone ghế ngồi VIP **trước khi** lưu hạng VIP (PAID).
2. Lưu hạng VIP cho cùng zone. Mở bán.
3. Mobile: mở chọn ghế suất đó.

### Kỳ vọng / Thực tế
- Kỳ vọng: ghế VIP bán theo giá VIP. Hạng COMP/FREE không làm đổi giá ghế đã định.
- Thực tế (suy ra từ code):
  - `save_ticket_type` gán `session_seats.ticket_type_id` cho mọi ghế đang `null` trong zone, cho **hạng nào được
    lưu trước**, kể cả COMP/FREE (`init.sql:3832-3835`). Hạng lưu sau không gán được nữa.
  - `get_session_seat_pricing` chỉ trả ánh xạ ghế → hạng đã gán (`init.sql:4336-4352`).
  - `create_booking` bắt khách đặt đúng hạng đã gán cho ghế (`init.sql:4539-4540`).
  - Kết quả: ghế gán COMP bị mobile hiển thị `BLOCKED`, vì mobile lọc bỏ COMP/HIDDEN
    (`selection-screen.tsx:68-70,114-118`). Ghế gán FREE được bán **0đ** thay vì giá VIP.
  - Seed hiện tại lưu PAID trước (`supabase/seed.sql:135-144`) nên không lộ lỗi.
- Ghi chú contract: DB cho phép ghế `ticket_type_id = null` nếu hạng vé phủ zone (`init.sql:4541-4545`), nhưng
  mobile coi mọi ghế không có trong `seat-pricing` là `BLOCKED`. Hai bên đang hiểu khác nhau về "ghế chưa gán hạng".

### Bằng chứng
`init.sql:3822-3836`, `init.sql:4336-4352`, `init.sql:4536-4545`,
`apps/mobile/src/features/customer/booking/screens/selection-screen.tsx:68-82,114-118`.

### Đề xuất sửa
Trong migration mới, `save_ticket_type` chỉ tự gán ghế cho hạng `PAID`/`FREE` `PUBLIC`, không gán cho `COMP`, và
không ghi đè khi zone đã có hạng khác (hoặc báo lỗi để Org chọn qua `PUT /api/sessions/{id}/seats/ticket-type`).
Nếu đổi nghĩa "ghế null = theo zone" thì claude cập nhật contract `seat-pricing` cho mobile.

### Kiểm thử
Chưa chạy. pgTAP: lưu COMP trước PAID → ghế giữ hạng PAID; đặt ghế VIP qua `create_booking` → `total_amount` =
giá VIP.

---

## C-06: Portal nhập giờ suất diễn theo múi giờ trình duyệt, nhưng hiển thị theo múi giờ địa điểm

- Trạng thái: chuyển sang `docs/bugs/frontend.md` F-01 (lỗi chỉ ở frontend; theo dõi ở đó)
- Phía: frontend
- Giao cho: antigravity
- Mức độ: low (chỉ lộ khi trình duyệt của Org khác múi giờ với `venues.timezone`, mặc định `Asia/Ho_Chi_Minh`)
- Luồng: tìm suất (giờ mở bán / diễn)
- Người phát hiện: claude

### Tái hiện
1. Đặt múi giờ máy là UTC (hoặc khác ICT). Đăng nhập `owner-a@dev.local`.
2. Tạo Session với "Bắt đầu" 19:00, "Mở bán" 09:00.
3. Xem lại trên portal (danh sách nhân sự/ca) và trên mobile.

### Kỳ vọng / Thực tế
- Kỳ vọng: 19:00 nghĩa là 19:00 giờ địa điểm.
- Thực tế: `toIso` / `toLocalInput` đổi theo múi giờ trình duyệt (`apps/portal/src/features/org/events/datetime.ts`).
  Mobile và `formatDateTime` của portal lại hiển thị theo `venues.timezone` (`packages/core/src/models/catalog.ts:136`,
  `apps/portal/src/lib/api.ts:75`). Kết quả: giờ diễn và giờ mở/đóng bán lệch đúng bằng chênh lệch múi giờ. Cửa sổ
  bán (`sales_start_at`/`sales_end_at`) do `create_booking` kiểm bằng `now()` cũng lệch theo.

### Bằng chứng
`apps/portal/src/features/org/events/datetime.ts`, `apps/portal/src/features/org/events/EventCreationWizard.tsx:60-64,235-238`.

### Đề xuất sửa
Chuyển đổi theo `venue.timezone` của Session (không theo trình duyệt), và hiển thị rõ múi giờ cạnh ô nhập.

### Kiểm thử
Chưa chạy. Thêm unit test Vitest cho `toIso`/`toLocalInput` với múi giờ địa điểm khác múi giờ máy.

---

## C-07: Chia số tiền hoàn theo vé bị làm tròn xuống, tổng `refund_items` nhỏ hơn số tiền refund

- Trạng thái: OPEN
- Phía: backend
- Giao cho: opencode
- Mức độ: low
- Luồng: huỷ/hoàn tiền | giá
- Người phát hiện: claude

### Tái hiện
`create_refund` cho Booking 3 vé đồng giá với `p_amount = 1.000.000`.

### Kỳ vọng / Thực tế
- Kỳ vọng: tổng `refund_items.amount` = `refunds.amount`.
- Thực tế: mỗi vé nhận `unit_price * p_amount / v_base`, là phép chia nguyên `bigint` (`init.sql:6620`), tức
  333.333 × 3 = 999.999. Lệch 1đ giữa refund và chi tiết theo vé, có thể làm sai đối soát.

### Bằng chứng
`init.sql:6614-6622`.

### Đề xuất sửa
Cộng phần dư vào dòng cuối (hoặc phân bổ theo largest-remainder) trong migration mới.

### Kiểm thử
Chưa chạy. pgTAP: `sum(refund_items.amount) = refunds.amount`.

---

## C-08: Portal có thể gọi nhầm `/api` vào chính origin của portal hoặc API production

- Trạng thái: chuyển sang `docs/bugs/frontend.md` F-02 (lỗi chỉ ở frontend; theo dõi ở đó)
- Phía: frontend
- Giao cho: antigravity
- Mức độ: low
- Luồng: khác (cấu hình FE ↔ BE)
- Người phát hiện: claude

### Tái hiện
1. Build portal không có `VITE_API_URL` (Vercel chưa đặt env, hoặc `.env.local` thiếu biến).
2. Đăng nhập Org, mở bất kỳ trang dữ liệu nào.

### Kỳ vọng / Thực tế
- Kỳ vọng: thiếu cấu hình thì báo lỗi rõ ràng, như `createSupabase` / `HttpClient` đang làm.
- Thực tế:
  - `resolveApiUrl` rơi về `window.location.origin` (`apps/portal/src/lib/api.ts:9-16`).
  - Trên Vercel, `vercel.json` rewrite mọi đường dẫn về `index.html`, nên `/api/*` trả HTML. `HttpClient` parse JSON
    thất bại và báo lỗi `UNKNOWN` khó hiểu.
  - Khi dev, `vite.config.ts` proxy `/api` tới `https://tickey-api.onrender.com` (API nối DB production), nên dev
    vô tình ghi vào dữ liệu thật.

### Bằng chứng
`apps/portal/src/lib/api.ts:9-16`, `apps/portal/vercel.json` (`rewrites`), `apps/portal/vite.config.ts`.

### Đề xuất sửa
Bỏ fallback, báo lỗi cấu hình khi thiếu `VITE_API_URL`. Proxy dev trỏ `http://localhost:5080`.

### Kiểm thử
Chưa chạy. Vitest cho `resolveApiUrl` khi thiếu env.
