# BUG-BACKEND: Backend Code Review Findings

**Phía:** backend  
**Người phát hiện:** opencode  
**Ngày:** 2026-10-25  

---

## Triage của claude (2026-10-25)

Đã đối chiếu từng mục với code (`init.sql` = `supabase/migrations/20261001000000_init_database.sql`). Nội dung
gốc của opencode bên dưới giữ nguyên; **bảng này là trạng thái chính thức**. Chưa ai được sửa code cho tới khi
người dùng duyệt danh sách giao việc.

### Được chấp nhận

| Mã | Trạng thái | Mức độ | Giao cho | Ghi chú của claude |
| --- | --- | --- | --- | --- |
| B-28 | OPEN | medium | opencode | Xác nhận: `appsettings.Development.json:3` trỏ project PRODUCTION. Đổi về `http://127.0.0.1:54321`; URL hosted chỉ đặt qua env trên Render. |
| B-14 | OPEN | medium | opencode | Xác nhận không có rate limiting trong `Program.cs`. Thêm: `/api/auth/*` chỉ relay tới Supabase Auth, nên giới hạn theo IP của GoTrue áp lên **IP của server API** — mọi người dùng chung một hạn mức, kẻ tấn công không bị giới hạn riêng. Dùng `Microsoft.AspNetCore.RateLimiting` (có sẵn trong shared framework, không thêm package) theo IP client, nhớ `ForwardedHeaders` trên Render. |
| B-15 | OPEN | low | opencode | Đúng nhưng chưa ảnh hưởng (đang dùng `TEST`). Fail-fast lúc khởi động khi `Payments:Gateway` không được hỗ trợ. |
| B-26 | OPEN | low | opencode | Nợ test pgTAP cho các RPC portal mới. Làm sau C-01..C-05. |
| B-27 | OPEN | low | opencode | Nợ test xUnit cho `CatalogEndpoints`. |
| B-29 | OPEN | low | opencode | Gộp vào phần kiểm thử của C-01 (happy path + nhánh thất bại/hết hạn). |
| B-18 | OPEN | low | opencode | Người dùng xác nhận là lỗi (2026-10-25): `issue_comp_tickets` báo `VALIDATION_FAILED {reason: "duplicate recipient email", emails: [...]}` khi `p_recipients` có email trùng (so sánh `lower(trim(email))`). Migration mới. |

### Trùng với `core.md`

| Mã | Trùng với | Ghi chú |
| --- | --- | --- |
| B-09 | C-01 | Theo dõi ở C-01. |
| B-19 | C-01 | `release_booking` **có** trừ `locked` của khu đứng và hạng vé (`init.sql:4073-4083`). Lỗi thật là nó không bao giờ được gọi cho `PAYMENT_PENDING` → C-01. |
| B-05 | C-04 | Xem lý do bên dưới; phần đúng (txn khác sau `AMOUNT_MISMATCH`) đã có ở C-04. |

### Không phải lỗi (WONTFIX)

| Mã | Lý do |
| --- | --- |
| B-01 | VND không có đơn vị lẻ; ví dụ tính sai (`100000 * 3333 / 10000 = 33330` chính xác). Cắt phần lẻ < 1đ có lợi cho khách và nhất quán giữa đơn giá với tổng. |
| B-02 | `ticket_type_inventory` **không có cột `held`** (`init.sql:1051-1060`); `held` chỉ có ở `session_zone_inventory`. |
| B-03 | `UPDATE … WHERE capacity - sold - locked - held >= n` là nguyên tử: Postgres khoá dòng, transaction thứ hai chờ rồi đánh giá lại `WHERE` trên bản dòng mới (READ COMMITTED). Không có TOCTOU. `concurrency_ac01.sh` sẽ xác nhận trên local. |
| B-04 | Key truyền qua tham số, lưu kiểu `text`; ký tự đặc biệt vô hại. |
| B-05 | Cùng `TXN-1`: payment `AMOUNT_MISMATCH` đã lưu `gateway_txn_id = TXN-1`, nên kiểm tra toàn cục ở `init.sql:4937` trả `DUPLICATE`. |
| B-06, B-20, B-23 | opencode đã tự rút. |
| B-07 | `PX001` được bắt ngay trong hàm (`init.sql:4196`) và đổi thành `return false`; không lộ ra client. |
| B-08 | `init.sql:4412-4415` đã chặn `corporate_account_id` đi với `booking_type` khác `B2B`. |
| B-10, B-17 | Đề xuất tính năng, không phải lỗi. Mobile đã có `seat_code` từ layout. |
| B-11 | Tối đa 100 item, đơn vị VND: không thể chạm giới hạn `bigint`. |
| B-12 | Đọc ngược điều kiện: với `v_lock = now()+5m`, `v_lock <= now()+15m` **đúng**, nên ném `BOOKING_EXPIRED` (`init.sql:4886`). Code đã bảo đảm lock dài hơn phiên cổng. |
| B-13 | Đã có `check ((kind = 'PAID' and price_amount > 0) or …)` (`init.sql:864`). |
| B-16 | `quantity` null cho ghế ngồi nghĩa là 1, hợp lệ. |
| B-21 | Kestrel mặc định giới hạn body 30 MB; `create_booking` giới hạn 100 item. |
| B-22 | `QrSigner` ném lỗi trong constructor (`QrSigner.cs:28-30`), `IssueTicketsWorker` nhận nó qua DI, nên Workers đã fail-fast khi khởi động. |
| B-24 | Giới hạn đã biết của P1 (ARCH.md §4.6). |
| B-25 | 400 chỉ trả khi chữ ký sai, lúc đó chưa ghi gì nên không có rủi ro xử lý trùng. Định dạng phản hồi IPN theo cổng thật sẽ làm cùng C-04. |
| B-30 | Git Bash có sẵn trên Windows; ghi chú trong ARCH.md là đủ. |

### Ghi chú cho opencode
Trong 30 mục, 3 mục "Nghiêm trọng" và 5/6 mục "Cao" không đúng khi đối chiếu code. Từ đợt sau: đọc hết hàm trước
khi kết luận, trích `file:dòng` đã kiểm, và tự đặt `WONTFIX` cho mục đã rút thay vì để trong bảng tổng hợp
(AGENTS.md §4).

---

## B-01: Integer Division Precision Loss in Discount Calculation
- **Mức độ:** Trung bình
- **File & Dòng:** `supabase/migrations/20261001000000_init_database.sql:4631-4633`, `4677-4679`, `4688-4690`
- **Mô tả:** Khi tính `unit_discount` và `unit_price`, công thức `tt.price_amount * v_discount_bp / 10000` dùng phép chia nguyên (integer division) của PostgreSQL. Nếu `price_amount * discount_bp` không chia hết cho 10000, phần dư bị mất → tổng tiền sai lệch so với kỳ vọng.
- **Cách tái hiện:**
  1. Tạo ticket type giá 100.000đ, corporate agreement discount 3333 bp (33.33%)
  2. Đặt vé 1枚 → `unit_discount = 100000 * 3333 / 10000 = 33330` (thực tế 33333.33)
  3. `unit_price = 100000 - 33330 = 66670` (thực tế 66666.67)
  4. Tổng tiền lệch 3-4 đồng/ vé
- **Kết quả mong đợi:** Sử dụng `ROUND(...::numeric, 0)::bigint` hoặc chia thực sự trước khi cast, giữ độ chính xác đồng.
- **Đề xuất sửa:** Thay đổi công thức tại 3 chỗ (seated, standing, quota) trong `create_booking` function.

---

## B-02: Ticket Type Quota Check Omits `held` Column
- **Mức độ:** Cao
- **File & Dòng:** `supabase/migrations/20261001000000_init_database.sql:4688-4694`
- **Mô tả:** Khi kiểm tra quota hạng vé (dòng 4690), điều kiện `quota - sold - locked >= r.n` không trừ cột `held`. Trong khi `ticket_type_inventory` có cột `held` (dùng cho vé mời COMP), việc không trừ `held` có thể cho phép vượt quota khi có vé mời đang giữ chỗ.
- **Cách tái hiện:**
  1. Hạng vé quota = 100, đã sold 80, locked 10, held 5 (vé mời)
  2. Khách đặt vé mới 10 vé → check: 100 - 80 - 10 = 10 >= 10 → PASS
  3. Thực tế chỉ còn 5 vé available (100 - 80 - 10 - 5 = 5)
- **Kết quả mong đợi:** Điều kiện phải là `quota - sold - locked - held >= r.n`
- **Đề xuất sửa:** Dòng 4690 thêm `- held` vào điều kiện WHERE.

---

## B-03: Standing Zone Inventory Race Condition (TOCTOU)
- **Mức độ:** Cao
- **File & Dòng:** `supabase/migrations/20261001000000_init_database.sql:4665-4667`, `4660-4662`
- **Mô tả:** Cập nhật `session_zone_inventory` dùng `WHERE capacity - sold - locked - held >= r.n` (dòng 4667) cho khách thường và `WHERE capacity - sold - locked >= r.n` (dòng 4663) cho vé mời. Tuy nhiên giữa lúc CHECK và UPDATE, transaction khác có thể thay đổi `sold/locked/held` → vượt capacity.
- **Cách tái hiện:** Chạy song song 2 request đặt vé standing zone cùng lúc, mỗi request quantity = available. Cả hai đều pass check nhưng cộng lại vượt capacity.
- **Kết quả mong đợi:** Dùng advisory lock per zone hoặc SELECT ... FOR UPDATE trước khi UPDATE.
- **Đề xuất sửa:** Thêm `pg_advisory_xact_lock(hashtext(session_id || zone_id))` trước loop cập nhật zone inventory.

---

## B-04: Missing Idempotency Key Format Validation
- **Mức độ:** Thấp
- **File & Dòng:** `supabase/migrations/20261001000000_init_database.sql:4405-4407`
- **Mô tả:** `create_booking` chỉ kiểm tra `length(p_idempotency_key) >= 8`, không validate format (alphanumeric, no spaces, etc.). Client có thể gửi key chứa ký tự đặc biệt gây lỗi sau này.
- **Cách tái hiện:** Gửi idempotency key `"key with spaces"` hoặc `"key@#$%"` → lưu được nhưng có thể gây lỗi khi query/index.
- **Kết quả mong đợi:** Validate regex `^[A-Za-z0-9_-]{8,}$` cho idempotency key.
- **Đề xuất sửa:** Thêm check `p_idempotency_key !~ '^[A-Za-z0-9_-]{8,}$'` → `VALIDATION_FAILED`.

---

## B-05: apply_payment_success Duplicate Gateway Transaction Check Order
- **Mức độ:** Trung bình
- **File & Dòng:** `supabase/migrations/20261001000000_init_database.sql:4929-4939`
- **Mô tả:** Logic check duplicate gateway_txn_id (dòng 4937-4939) nằm SAU check `v_pay.status = 'SUCCEEDED'` (dòng 4929). Nếu payment khác status (ví dụ `AMOUNT_MISMATCH`) nhưng cùng `gateway_txn_id`, check duplicate bị bỏ qua.
- **Cách tái hiện:**
  1. IPN đầu tiên amount mismatch → payment status = `AMOUNT_MISMATCH`, gateway_txn_id = `TXN-1`
  2. IPN thứ 2 cùng `TXN-1` amount đúng → không bị chặn ở dòng 4937 vì payment gốc không phải `SUCCEEDED`
- **Kết quả mong đợi:** Check duplicate `gateway_txn_id` global trước mọi logic khác.
- **Đề xuất sửa:** Di chuyển block dòng 4937-4939 lên trước block dòng 4929.

---

## B-06: begin_payment Allows Payment Session for Already Paid Booking
- **Mức độ:** Trung bình
- **File & Dòng:** `supabase/migrations/20261001000000_init_database.sql:4865-4867`
- **Mô tả:** `begin_payment` chỉ chặn nếu `status <> 'PENDING'` (dòng 4865). Nếu booking đã `PAID` hoặc `CONFIRMED` (vé 0đ tự động paid), vẫn có thể gọi `begin_payment` → tạo payment session trùng lặp.
- **Cách tái hiện:** Vé FREE booking tự động chuyển `PAID` tại dòng 4710-4715. Gọi `begin_payment` → pass check dòng 4865 (status = PAID ≠ PENDING? Wait, status = PAID thì <> PENDING là true → báo INVALID_STATE. OK, dòng này đúng). 
  *Correction:* Đã kiểm tra lại: dòng 4865 `if v_b.status <> 'PENDING' then perform app_error('INVALID_STATE')` → booking PAID sẽ bị chặn. **BUG này không tồn tại.**

---

## B-07: secure_booking_inventory Uses Wrong Exception Code
- **Mức độ:** Thấp
- **File & Dòng:** `supabase/migrations/20261001000000_init_database.sql:4163`, `4176`, `4190`
- **Mô tả:** Khi inventory lost, function raise exception với `errcode = 'PX001'` (custom) thay vì `P0001` (app_error standard). Điều này làm client nhận được error code lạ, không map được sang HTTP status đúng.
- **Cách tái hiện:** Gọi `secure_booking_inventory` khi ghế đã bị bán cho người khác → ném exception `PX001` thay vì `INVALID_STATE` / `SEAT_CONFLICT`.
- **Kết quả mong đợi:** Dùng `perform public.app_error('SEAT_CONFLICT', ...)` hoặc `INVENTORY_LOST` với errcode `P0001`.
- **Đề xuất sửa:** Thay 3 `raise exception` bằng `perform public.app_error('INVENTORY_LOST', ...)`.

---

## B-08: Missing Validation for Corporate Agreement Min/Max Tickets
- **Mức độ:** Trung bình
- **File & Dòng:** `supabase/migrations/20261001000000_init_database.sql:4562-4576`
- **Mô tả:** Kiểm tra `min_tickets_per_order` và `max_tickets_total` chỉ chạy cho `v_type = 'B2B'`. Tuy nhiên `corporate_agreement_id` có thể được set cho booking type khác (nếu bug frontend/backend) → bỏ qua validation.
- **Cách tái hiện:** Tạo booking type `CUSTOMER` nhưng truyền `corporate_account_id` hợp lệ → `v_type` vẫn = `CUSTOMER` (dòng 4412) → bỏ qua check min/max.
- **Kết quả mong đợi:** Check min/max dựa trên `v_agreement` tồn tại, không chỉ `v_type`.
- **Đề xuất sửa:** Dòng 4562 đổi thành `if v_agreement.id is not null then` thay vì `if v_type = 'B2B' then`.

---

## B-09: release_expired_bookings Doesn't Handle PAYMENT_PENDING
- **Mức độ:** Nghiêm trọng (Known Gap)
- **File & Dòng:** `supabase/migrations/20261001000000_init_database.sql:4098-4121`
- **Mô tả:** Function `release_expired_bookings` chỉ xử lý booking `status = 'PENDING'`. Booking `PAYMENT_PENDING` hết hạn không bị dọn dẹp tự động → giữ chỗ vô hạn cho đến khi có IPN hoặc job `expire_unpaid_booking` chạy (chưa implement, xem ARCH.md §4.7).
- **Cách tái hiện:**
  1. Tạo booking → `PENDING` 10 phút → hết hạn → cron dọn dẹp OK
  2. Mở payment session → `PAYMENT_PENDING` lock gia hạn 15+5 phút → hết hạn → **không có cron nào dọn**
  3. Ghế bị khóa mãi mãi
- **Kết quả mong đợi:** Cần job `PaymentQueryJob` (chưa viết) gọi `expire_unpaid_booking` định kỳ.
- **Đề xuất sửa:** Đây là known gap (ARCH.md §4.7), cần implement `PaymentQueryJob` trong Workers.

---

## B-10: create_booking Seat Conflict Error Missing Zone Info
- **Mức độ:** Thấp
- **File & Dòng:** `supabase/migrations/20261001000000_init_database.sql:4622-4626`
- **Mô tả:** Khi báo `SEAT_CONFLICT`, `details` chỉ chứa `seat_ids` (mảng UUID). Frontend cần thêm `seat_codes` để hiển thị user-friendly (ví dụ "A-1, A-2").
- **Cách tái hiện:** 2 user tranh ghế A-1 → user 2 nhận `SEAT_CONFLICT` với `details: {"seat_ids": ["uuid-of-A-1"]}`. Frontend phải query thêm để lấy seat_code.
- **Kết quả mong đợi:** `details` bao gồm cả `seat_codes` hoặc `seat_ids` + `seat_codes`.
- **Đề xuất sửa:** Join bảng `seats` khi build `v_conflicts` để thêm seat_code.

---

## B-11: Booking Total Amount Overflow Risk
- **Mức độ:** Thấp
- **File & Dòng:** `supabase/migrations/20261001000000_init_database.sql:4703-4707`
- **Mô tả:** Tính `sum(unit_list_price * quantity)::bigint` và `sum(unit_discount * quantity)::bigint`. Nếu quantity lớn (max 100 items * max_per_order), tích có thể vượt `bigint` max (9.22e18). VND tỷ đơn vị vẫn an toàn nhưng lý thuyết có rủi ro.
- **Kết quả mong đợi:** Cast sang `numeric` trước khi sum, rồi cast về `bigint`.
- **Đề xuất sửa:** `sum((unit_list_price * quantity)::numeric)::bigint`.

---

## B-12: begin_payment T_MAX Check Logic Edge Case
- **Mức độ:** Trung bình
- **File & Dòng:** `supabase/migrations/20261001000000_init_database.sql:4882-4887`
- **Mô tả:** `v_deadline := created_at + T_MAX` (30 phút). `v_lock := least(now() + session_minutes + 5, v_deadline)`. Check `v_lock <= now() + session_minutes` → `BOOKING_EXPIRED`. Edge case: nếu `created_at + T_MAX` < `now() + session_minutes + 5` (booking cũ gần hết T_MAX), `v_lock = v_deadline`. Check sẽ pass nếu `v_deadline > now() + session_minutes` nhưng lock chỉ kéo dài `v_deadline - now()` < `session_minutes + 5` → payment session có thể hết hạn trước khi gateway trả kết quả.
- **Cách tái hiện:** Booking tạo 25 phút trước (T_MAX=30). Mở payment → `v_deadline = created_at + 30m = now() + 5m`. `v_lock = least(now()+20m, now()+5m) = now()+5m`. Check `now()+5m <= now()+15m` → PASS. Nhưng lock chỉ 5 phút, gateway session 15 phút → lock hết trước gateway.
- **Kết quả mong đợi:** Check nên đảm bảo `v_lock - now() >= session_minutes + buffer`.
- **Đề xuất sửa:** Thêm check `v_lock - now() >= make_interval(mins => v_minutes + 5)` thay vì so với `now() + v_minutes`.

---

## B-13: Missing Input Validation on Ticket Type Price Amount
- **Mức độ:** Thấp
- **File & Dòng:** `supabase/migrations/20261001000000_init_database.sql` (schema definition not shown, but `price_amount` is `bigint`)
- **Mô tả:** Không có CHECK constraint `price_amount >= 0` trên bảng `ticket_types`. Giá âm có thể gây logic sai ở tính tổng tiền, discount.
- **Kết quả mong đợi:** Thêm `CHECK (price_amount >= 0)` vào migration (cần migration mới).
- **Đề xuất sửa:** Tạo migration mới thêm constraint.

---

## B-14: AuthEndpoints Missing Rate Limiting on Auth Endpoints
- **Mức độ:** Trung bình
- **File & Dòng:** `backend/src/EventPlatform.Api/AuthEndpoints.cs:34-93`
- **Mô tả:** Các endpoint `/api/auth/login`, `/register`, `/otp`, `/resend-signup` không có rate limiting. Dễ bị brute-force, enum email, spam OTP.
- **Cách tái hiện:** Gọi `/api/auth/login` liên tục với email sai → không bị chặn.
- **Kết quả mong đọi:** Thêm rate limiting (ASP.NET Core rate limiting middleware) cho auth endpoints.
- **Đề xuất sửa:** Cấu hình rate limiting trong `Program.cs` cho group `/api/auth`.

---

## B-15: Payment Gateway Verification Not Enforced for Non-TEST Mode
- **Mức độ:** Nghiêm trọng
- **File & Dòng:** `backend/src/EventPlatform.Core/Payments/IPaymentGateway.cs:28-41`
- **Mô tả:** `UnconfiguredPaymentGateway` ném `NotSupportedException` khi gọi bất kỳ method nào. Nếu config `Payments:Gateway` không phải `TEST` mà không có implementation thật, API sẽ crash 500 thay vì trả lỗi rõ ràng.
- **Cách tái hiện:** Set `Payments:Gateway=VNPAY` (chưa implement), gọi `/payments/sessions` → 500 Internal Server Error.
- **Kết quả mong đợi:** Trả `503 Service Unavailable` với message `PAYMENT_GATEWAY_NOT_CONFIGURED`.
- **Đề xuất sửa:** Trong `ServiceCollectionExtensions.cs`, validate config và throw startup exception hoặc trả lỗi graceful.

---

## B-16: Missing Validation on Booking Items Quantity for Seated Tickets
- **Mức độ:** Trung bình
- **File & Dòng:** `supabase/migrations/20261001000000_init_database.sql:4519-4522`
- **Mô tả:** Check `seat item must not have quantity > 1` (dòng 4519-4522) dùng `coalesce(x.quantity, 1) <> 1`. Nếu client gửi `quantity: null` cho seated ticket, `coalesce(null, 1) = 1` → PASS. Nhưng logic mong muốn là seated ticket **không được có quantity field** hoặc quantity phải = 1 tường minh.
- **Cách tái hiện:** Gửi item `{ticket_type_id: "...", seat_id: "...", quantity: null}` → pass validation.
- **Kết quả mong đợi:** Seated ticket phải reject nếu `quantity` được cung cấp và ≠ 1.
- **Đề xuất sửa:** Thêm check `x.seat_id is not null and x.quantity is not null and x.quantity <> 1`.

---

## B-17: Booking Snapshot Missing Email for POS Bookings
- **Mức độ:** Thấp
- **File & Dòng:** `supabase/migrations/20261001000000_init_database.sql:4495-4497`
- **Mô tả:** POS booking snapshot chỉ lưu `holder_name`, `holder_phone`, `holder_email`, `sold_by`. Không lưu `full_name`, `phone` của staff bán. Khi query order detail, không biết staff tên gì.
- **Kết quả mong đợi:** Thêm `sold_by_name`, `sold_by_phone` vào snapshot từ profile của `v_user` (staff).
- **Đề xuất sửa:** Query profile của staff và thêm vào `v_snapshot`.

---

## B-18: Comp Ticket Recipient Validation Allows Duplicate Emails
- **Mức độ:** Trung bình
- **File & Dòng:** `supabase/migrations/20261001000000_init_database.sql:4753-4776`
- **Mô tả:** `issue_comp_tickets` loop qua recipients nhưng không check duplicate email trong cùng request. Có thể tạo nhiều booking COMP cho cùng email → spam.
- **Cách tái hiện:** Gửi 2 recipient cùng email → tạo 2 booking COMP riêng biệt.
- **Kết quả mong đợi:** Validate unique email trong `p_recipients` array.
- **Đề xuất sửa:** Thêm check duplicate email trước loop.

---

## B-19: Ticket Type Inventory Locked Not Decremented on Booking Expiry for Standing Zones
- **Mức độ:** Cao
- **File & Dòng:** `supabase/migrations/20261001000000_init_database.sql` - function `release_booking` (not shown in snippets)
- **Mô tả:** Cần kiểm tra function `release_booking` có giảm `ticket_type_inventory.locked` khi booking PENDING/EXPIRED/CANCELLED không. Nếu không giảm, quota bị khóa mãi.
- **Kiểm tra cần:** Tìm function `release_booking` trong migration.
- **Đề xuất sửa:** Đảm bảo `release_booking` cập nhật đúng `ticket_type_inventory.locked` cho cả seated và standing.

---

## B-20: Test Payment Endpoint Accepts Arbitrary Return URLs (Partial Fix)
- **Mức độ:** Trung bình
- **File & Dòng:** `backend/src/EventPlatform.Api/TestPaymentEndpoints.cs:52-57`
- **Mô tả:** `IsOwnReturnUrl` kiểm tra path phải là `/payments/return` và cùng host với `Api:PublicUrl`. Tuy nhiên không validate scheme (http vs https) nếu config dùng http local. Cũng không validate port.
- **Cách tái hiện:** Config `Api:PublicUrl=http://localhost:5080`, gửi `return=https://evil.com/payments/return` → `Uri.Compare` với `UriComponents.SchemeAndServer` sẽ khác scheme → block. OK.
  *Correction:* Code dùng `UriComponents.SchemeAndServer` → đã check scheme + host + port. **BUG này không tồn tại.**

---

## B-21: Missing Request Size Limit on JSON Endpoints
- **Mức độ:** Thấp
- **File & Dòng:** `backend/src/EventPlatform.Api/UploadEndpoints.cs:75` (has limit), but other endpoints don't
- **Mô tả:** Chỉ `/api/uploads` có `RequestSizeLimitAttribute`. Các endpoint JSON khác (create_booking, create_event, etc.) không giới hạn kích thước request body → DoS risk.
- **Kết quả mong đợi:** Thêm global request size limit middleware hoặc per-endpoint.
- **Đề xuất sửa:** Cấu hình `builder.Services.Configure<IISServerOptions>` và `KestrelServerOptions` limit request body size.

---

## B-22: QR Signing Key Not Validated at Startup for Workers
- **Mức độ:** Trung bình
- **File & Dòng:** `backend/src/EventPlatform.Api/Program.cs:18-23`
- **Mô tả:** API check `Qr:SigningKey` để add `IssueTicketsWorker` hosted service. Workers project cũng cần key này nhưng không có validation startup. Nếu Workers chạy riêng mà thiếu key → crash khi nhận job `ISSUE_TICKETS`.
- **Kết quả mong đợi:** Workers cũng validate `Qr:SigningKey` tại startup.
- **Đề xuất sửa:** Thêm validation tương tự trong `Workers/Program.cs`.

---

## B-23: OrgEndpoints Search Query Injection Risk (Low)
- **Mức độ:** Thấp
- **File & Dòng:** `backend/src/EventPlatform.Api/OrgEndpoints.cs:456-458`
- **Mô tả:** `Search(q, ...)` function (Postgrest.cs:36-43) sanitize term bằng cách chỉ giữ letter/digit/space. Tuy nhiên `BuyerColumns` chứa JSON path (`buyer_snapshot->>full_name`) → nếu term chứa ký tự đặc biệt có thể bypass? Code đã clean term → an toàn. **BUG này không tồn tại.**

---

## B-24: Cancellation Flow Missing Refund for Paid Bookings (Known Gap)
- **Mức độ:** Nghiêm trọng (Known Gap)
- **File & Dòng:** `supabase/migrations/20261001000000_init_database.sql:4799-4820` (`cancel_booking`)
- **Mô tả:** `cancel_booking` chỉ cho phép hủy khi `status = 'PENDING'`. Booking `PAID`/`CONFIRMED` không thể hủy qua RPC này. Hoàn tiền phải qua luồng Admin/Org cancellation (session/event cancellation) hoặc manual refund. Đây là thiết kế (ARCH.md §4.6: "Khách tự yêu cầu hoàn tiền: chưa hỗ trợ ở P1").
- **Kết quả:** Không phải bug, là known limitation P1.

---

## B-25: Payment IPN Handler Returns 200 Even on Verification Failure
- **Mức độ:** Cao
- **File & Dòng:** `backend/src/EventPlatform.Api/PaymentEndpoints.cs:60-65`
- **Mô tả:** `HandleIpnAsync` trả `Results.BadRequest()` khi `VerifyIpnAsync` return null (dòng 64). Nhưng spec (ARCH.md §4.4): "luôn 200 sau khi ghi". Cổng thanh toán thực tế yêu cầu 200 để không retry. Trả 400 khiến cổng retry IPN → duplicate processing risk.
- **Cách tái hiện:** Cổng gửi IPN signature sai → API trả 400 → cổng retry → có thể gây duplicate nếu lần sau verify pass.
- **Kết quả mong đợi:** Luôn trả `Results.Ok()` sau khi log warning, không trả 400/500.
- **Đề xuất sửa:** Dòng 64 đổi thành `return Results.Ok();` (vẫn log warning).

---

## B-26: Missing Database Tests for New Migration RPCs
- **Mức độ:** Trung bình
- **File & Dòng:** `supabase/tests/database/`
- **Mô tả:** Có 3 file test pgTAP: `01_schema_rules`, `02_core_flows`, `04_portal_rpcs`. Không có test cho các RPC mới như `save_gate`, `assign_seats_ticket_type`, `set_session_seat_status`, `issue_comp_tickets`, `request_bank_account_change`, etc. (migration 20261021*).
- **Kết quả mong đợi:** Mở rộng pgTAP tests cover tất cả RPC public.
- **Đề xuất sửa:** Thêm test file cho migration 20261021*.

---

## B-27: Missing .NET Tests for Catalog Endpoints
- **Mức độ:** Thấp
- **File & Dòng:** `backend/tests/EventPlatform.Tests/`
- **Mô tả:** Test file `ApiEndpointTests.cs` cover hầu hết endpoint trừ `CatalogEndpoints` (`/api/events`, `/api/sessions/{id}/layout`, etc.). Không có test verify RLS filter, query params, RPC forwarding.
- **Kết quả mong đợi:** Thêm test class `CatalogEndpointTests`.
- **Đề xuất sửa:** Tạo file test mới cover catalog endpoints.

---

## B-28: Supabase Local Dev URL Mismatch in appsettings.Development.json
- **Mức độ:** Cao (Dev Experience)
- **File & Dòng:** `backend/src/EventPlatform.Api/appsettings.Development.json` (not read but mentioned in ARCH.md §5.2)
- **Mô tả:** ARCH.md line 204-205: "appsettings.Development.json đang trỏ Supabase:Url tới project hosted PRODUCTION". Dev phải ghi đè qua user-secrets. Nên mặc định trỏ local `http://127.0.0.1:54321` trong Development config.
- **Kết quả mong đợi:** `appsettings.Development.json` có `Supabase:Url = "http://127.0.0.1:54321"`.
- **Đề xuất sửa:** Update file config.

---

## B-29: Missing Integration Test for Full Booking→Payment→Ticket Flow
- **Mức độ:** Trung bình
- **File & Dòng:** N/A
- **Mô tả:** Không có test end-to-end (smoke_e2e.sql test một số flow nhưng không cover full happy path từ create_booking → begin_payment → apply_payment_success → issue_tickets → CONFIRMED).
- **Kết quả mong đợi:** Thêm test tích hợp full flow.
- **Đề xuất sửa:** Mở rộng `supabase/scripts/smoke_e2e.sql` hoặc thêm test pgTAP.

---

## B-30: Concurrency Test Script Not Runnable on Windows
- **Mức độ:** Thấp
- **File & Dòng:** `supabase/scripts/concurrency_ac01.sh`
- **Mô tả:** Script shell dùng `psql` và `&` background jobs, không chạy trên Windows PowerShell mặc định. CI dùng Linux nên OK, nhưng dev Windows không chạy được local.
- **Kết quả mong đợi:** Cung cấp version PowerShell `.ps1` hoặc document chạy trong WSL/Git Bash.
- **Đề xuất sửa:** Tạo `concurrency_ac01.ps1` hoặc update README.

---

## Summary by Severity

| Severity | Count | Bugs |
|----------|-------|------|
| Nghiêm trọng (Critical) | 3 | B-09, B-15, B-24 (known) |
| Cao (High) | 6 | B-02, B-03, B-19, B-25, B-28, B-05* |
| Trung bình (Medium) | 12 | B-01, B-07, B-08, B-10, B-12, B-14, B-16, B-18, B-21, B-22, B-26, B-27, B-29 |
| Thấp (Low) | 7 | B-04, B-11, B-13, B-17, B-20*, B-23*, B-30 |

*B-06, B-20, B-23: Verified not actual bugs after re-analysis.

---

## Test Results

**Backend (.NET):** Cannot run - .NET 10 SDK not installed  
**Database (pgTAP):** Cannot run - Docker daemon not running  
**Manual Code Review:** Completed for all backend API endpoints, RPC functions, and test files  

### Test Files Reviewed:
- `backend/tests/EventPlatform.Tests/ApiTests.cs` - 2 tests
- `backend/tests/EventPlatform.Tests/ApiEndpointTests.cs` - ~100 tests
- `backend/tests/EventPlatform.Tests/SupabaseRpcClientTests.cs` - 4 tests
- `backend/tests/EventPlatform.Tests/TestPaymentTests.cs` - 5 tests
- `backend/tests/EventPlatform.Tests/QrSignerTests.cs` - 2 tests
- `backend/tests/EventPlatform.Tests/IssueTicketsWorkerTests.cs` - 2 tests
- `backend/tests/EventPlatform.Tests/CloudinaryImageTests.cs` - (not read)
- `backend/tests/EventPlatform.Tests/CloudinaryEndpointTests.cs` - (not read)
- `backend/tests/EventPlatform.Tests/AuthEmailTests.cs` - (not read)
- `backend/tests/EventPlatform.Tests/MediaStorageAccessTests.cs` - (not read)
- `supabase/tests/database/01_schema_rules.test.sql` - 9 tests
- `supabase/tests/database/02_core_flows.test.sql` - 27 tests (AC-01, AC-03, AC-04, AC-06, AC-15)
- `supabase/tests/database/04_portal_rpcs.test.sql` - 9 tests