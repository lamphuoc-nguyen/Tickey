# Backend Bugs (B-NN)

**Phía:** backend  
**Người phát hiện:** opencode  
**Ngày:** 2026-10-25  

---

## B-01: Integer Division Precision Loss in Discount Calculation

### Trạng thái
WONTFIX

### Mức độ
Trung bình

### Giao cho
opencode

### Luồng
giữ chỗ

### Tái hiện
1. Tạo ticket type giá 100.000đ, corporate agreement discount 3333 bp (33.33%)
2. Đặt vé 1枚 → `unit_discount = 100000 * 3333 / 10000 = 33330` (thực tế 33333.33)
3. `unit_price = 100000 - 33330 = 66670` (thực tế 66666.67)
4. Tổng tiền lệch 3-4 đồng/ vé

### Kỳ vọng / Thực tế
- Kỳ vọng: Sử dụng `ROUND(...::numeric, 0)::bigint` hoặc chia thực sự trước khi cast, giữ độ chính xác đồng.
- Thực tế: Phép chia nguyên làm mất phần dư, tổng tiền sai lệch.

### Bằng chứng
`supabase/migrations/20261001000000_init_database.sql:4631-4633`, `4677-4679`, `4688-4690`

### Nguyên nhân
Công thức `tt.price_amount * v_discount_bp / 10000` dùng phép chia nguyên của PostgreSQL.

### Đề xuất sửa
Thay đổi công thức tại 3 chỗ (seated, standing, quota) trong `create_booking` function. Sử dụng `ROUND((tt.price_amount * v_discount_bp)::numeric / 10000, 0)::bigint`.

### Ghi chú claude
VND không có đơn vị lẻ; ví dụ tính sai (`100000 * 3333 / 10000 = 33330` chính xác). Cắt phần lẻ < 1đ có lợi cho khách và nhất quán giữa đơn giá với tổng.

### Kiểm thử
Chưa chạy. Cần test pgTAP verify discount calculation precision.

---

## B-02: Ticket Type Quota Check Omits `held` Column

### Trạng thái
WONTFIX

### Mức độ
Cao

### Giao cho
opencode

### Luồng
giữ chỗ

### Tái hiện
1. Hạng vé quota = 100, đã sold 80, locked 10, held 5 (vé mời)
2. Khách đặt vé mới 10 vé → check: 100 - 80 - 10 = 10 >= 10 → PASS
3. Thực tế chỉ còn 5 vé available (100 - 80 - 10 - 5 = 5)

### Kỳ vọng / Thực tế
- Kỳ vọng: Điều kiện phải là `quota - sold - locked - held >= r.n`
- Thực tế: Không trừ cột `held` khi kiểm tra quota.

### Bằng chứng
`supabase/migrations/20261001000000_init_database.sql:4688-4694`

### Nguyên nhân
Dòng 4690 kiểm tra `quota - sold - locked >= r.n` thiếu `- held`.

### Đề xuất sửa
Dòng 4690 thêm `- held` vào điều kiện WHERE.

### Ghi chú claude
`ticket_type_inventory` **không có cột `held`** (`init.sql:1051-1060`); `held` chỉ có ở `session_zone_inventory`.

### Kiểm thử
Chưa chạy. Cần test pgTAP verify quota check includes held.

---

## B-03: Standing Zone Inventory Race Condition (TOCTOU)

### Trạng thái
WONTFIX

### Mức độ
Cao

### Giao cho
opencode

### Luồng
chọn ghế

### Tái hiện
Chạy song song 2 request đặt vé standing zone cùng lúc, mỗi request quantity = available. Cả hai đều pass check nhưng cộng lại vượt capacity.

### Kỳ vọng / Thực tế
- Kỳ vọng: Dùng advisory lock per zone hoặc SELECT ... FOR UPDATE trước khi UPDATE.
- Thực tế: Giữa lúc CHECK và UPDATE, transaction khác có thể thay đổi `sold/locked/held` → vượt capacity.

### Bằng chứng
`supabase/migrations/20261001000000_init_database.sql:4665-4667`, `4660-4662`

### Nguyên nhân
Cập nhật `session_zone_inventory` dùng WHERE condition nhưng không có lock bảo vệ giữa check và update.

### Đề xuất sửa
Thêm `pg_advisory_xact_lock(hashtext(session_id || zone_id))` trước loop cập nhật zone inventory.

### Ghi chú claude
`UPDATE … WHERE capacity - sold - locked - held >= n` là nguyên tử: Postgres khoá dòng, transaction thứ hai chờ rồi đánh giá lại `WHERE` trên bản dòng mới (READ COMMITTED). Không có TOCTOU. `concurrency_ac01.sh` sẽ xác nhận trên local.

### Kiểm thử
Chưa chạy. Cần test concurrency với `supabase/scripts/concurrency_ac01.sh`.

---

## B-04: Missing Idempotency Key Format Validation

### Trạng thái
WONTFIX

### Mức độ
Thấp

### Giao cho
opencode

### Luồng
giữ chỗ

### Tái hiện
Gửi idempotency key `"key with spaces"` hoặc `"key@#$%"` → lưu được nhưng có thể gây lỗi khi query/index.

### Kỳ vọng / Thực tế
- Kỳ vọng: Validate regex `^[A-Za-z0-9_-]{8,}$` cho idempotency key.
- Thực tế: Chỉ kiểm tra `length(p_idempotency_key) >= 8`.

### Bằng chứng
`supabase/migrations/20261001000000_init_database.sql:4405-4407`

### Nguyên nhân
Thiếu validation format cho idempotency key.

### Đề xuất sửa
Thêm check `p_idempotency_key !~ '^[A-Za-z0-9_-]{8,}$'` → `VALIDATION_FAILED`.

### Ghi chú claude
Key truyền qua tham số, lưu kiểu `text`; ký tự đặc biệt vô hại.

### Kiểm thử
Chưa chạy. Cần test pgTAP verify invalid idempotency key rejected.

---

## B-05: apply_payment_success Duplicate Gateway Transaction Check Order

### Trạng thái
WONTFIX

### Mức độ
Trung bình

### Giao cho
opencode

### Luồng
thanh toán

### Tái hiện
1. IPN đầu tiên amount mismatch → payment status = `AMOUNT_MISMATCH`, gateway_txn_id = `TXN-1`
2. IPN thứ 2 cùng `TXN-1` amount đúng → không bị chặn ở dòng 4937 vì payment gốc không phải `SUCCEEDED`

### Kỳ vọng / Thực tế
- Kỳ vọng: Check duplicate `gateway_txn_id` global trước mọi logic khác.
- Thực tế: Logic check duplicate nằm SAU check `v_pay.status = 'SUCCEEDED'`.

### Bằng chứng
`supabase/migrations/20261001000000_init_database.sql:4929-4939`

### Nguyên nhân
Thứ tự kiểm tra sai: check duplicate gateway_txn_id nên làm trước.

### Đề xuất sửa
Di chuyển block dòng 4937-4939 lên trước block dòng 4929.

### Ghi chú claude
Cùng `TXN-1`: payment `AMOUNT_MISMATCH` đã lưu `gateway_txn_id = TXN-1`, nên kiểm tra toàn cục ở `init.sql:4937` trả `DUPLICATE`. Trùng với C-04.

### Kiểm thử
Chưa chạy. Cần test pgTAP verify duplicate gateway_txn_id blocked regardless of payment status.

---

## B-06: begin_payment Allows Payment Session for Already Paid Booking

### Trạng thái
WONTFIX

### Mức độ
Trung bình

### Giao cho
opencode

### Luồng
thanh toán

### Tái hiện
Vé FREE booking tự động chuyển `PAID` tại dòng 4710-4715. Gọi `begin_payment` → pass check dòng 4865 (status = PAID ≠ PENDING? Wait, status = PAID thì <> PENDING là true → báo INVALID_STATE. OK, dòng này đúng).

### Kỳ vọng / Thực tế
- Kỳ vọng: Chặn nếu booking đã PAID/CONFIRMED.
- Thực tế: Dòng 4865 `if v_b.status <> 'PENDING' then perform app_error('INVALID_STATE')` → booking PAID sẽ bị chặn.

### Bằng chứng
`supabase/migrations/20261001000000_init_database.sql:4865-4867`

### Ghi chú claude
BUG này không tồn tại. opencode đã tự rút.

### Kiểm thử
N/A

---

## B-07: secure_booking_inventory Uses Wrong Exception Code

### Trạng thái
WONTFIX

### Mức độ
Thấp

### Giao cho
opencode

### Luồng
chọn ghế

### Tái hiện
Gọi `secure_booking_inventory` khi ghế đã bị bán cho người khác → ném exception `PX001` thay vì `INVALID_STATE` / `SEAT_CONFLICT`.

### Kỳ vọng / Thực tế
- Kỳ vọng: Dùng `perform public.app_error('SEAT_CONFLICT', ...)` hoặc `INVENTORY_LOST` với errcode `P0001`.
- Thực tế: Raise exception với `errcode = 'PX001'` (custom) thay vì `P0001` (app_error standard).

### Bằng chứng
`supabase/migrations/20261001000000_init_database.sql:4163`, `4176`, `4190`

### Nguyên nhân
Sử dụng custom error code thay vì standard app_error.

### Đề xuất sửa
Thay 3 `raise exception` bằng `perform public.app_error('INVENTORY_LOST', ...)`.

### Ghi chú claude
`PX001` được bắt ngay trong hàm (`init.sql:4196`) và đổi thành `return false`; không lộ ra client.

### Kiểm thử
Chưa chạy. Cần test pgTAP verify correct error code returned.

---

## B-08: Missing Validation for Corporate Agreement Min/Max Tickets

### Trạng thái
WONTFIX

### Mức độ
Trung bình

### Giao cho
opencode

### Luồng
giữ chỗ

### Tái hiện
Tạo booking type `CUSTOMER` nhưng truyền `corporate_account_id` hợp lệ → `v_type` vẫn = `CUSTOMER` → bỏ qua check min/max.

### Kỳ vọng / Thực tế
- Kỳ vọng: Check min/max dựa trên `v_agreement` tồn tại, không chỉ `v_type`.
- Thực tế: Kiểm tra chỉ chạy cho `v_type = 'B2B'`.

### Bằng chứng
`supabase/migrations/20261001000000_init_database.sql:4562-4576`

### Nguyên nhân
Điều kiện kiểm tra sai: dùng `v_type` thay vì check `v_agreement`.

### Đề xuất sửa
Dòng 4562 đổi thành `if v_agreement.id is not null then` thay vì `if v_type = 'B2B' then`.

### Ghi chú claude
`init.sql:4412-4415` đã chặn `corporate_account_id` đi với `booking_type` khác `B2B`.

### Kiểm thử
Chưa chạy. Cần test pgTAP verify min/max validation applies when corporate_agreement_id provided.

---

## B-09: release_expired_bookings Doesn't Handle PAYMENT_PENDING

### Trạng thái
WONTFIX (trùng C-01, theo dõi ở `docs/bugs/core.md`)

### Mức độ
Cao

### Giao cho
opencode

### Luồng
giữ chỗ

### Tái hiện
1. Tạo booking → `PENDING` 10 phút → hết hạn → cron dọn dẹp OK
2. Mở payment session → `PAYMENT_PENDING` lock gia hạn 15+5 phút → hết hạn → **không có cron nào dọn**
3. Ghế bị khóa mãi mãi

### Kỳ vọng / Thực tế
- Kỳ vọng: Cần job `PaymentQueryJob` (chưa viết) gọi `expire_unpaid_booking` định kỳ.
- Thực tế: Function chỉ xử lý booking `status = 'PENDING'`. Booking `PAYMENT_PENDING` hết hạn không bị dọn dẹp tự động.

### Bằng chứng
`supabase/migrations/20261001000000_init_database.sql:4098-4121`

### Nguyên nhân
Thiết kế phụ thuộc vào `PaymentQueryJob` chưa implement (ARCH.md §4.7).

### Đề xuất sửa
Implement `PaymentQueryJob` trong Workers. Với `TestPaymentGateway`, `QueryAsync` trả "chưa thu", để job gọi `expire_unpaid_booking` khi phiên cổng đã hết hạn.

### Ghi chú claude
Theo dõi ở C-01.

### Kiểm thử
Chưa chạy. Cần test pgTAP cho `apply_payment_failure` → thanh toán lại / hết hạn; test xUnit cho job; kiểm tra `ticket_type_inventory.locked` trở về 0 sau khi hết hạn.

---

## B-10: create_booking Seat Conflict Error Missing Zone Info

### Trạng thái
WONTFIX

### Mức độ
Thấp

### Giao cho
opencode

### Luồng
chọn ghế

### Tái hiện
2 user tranh ghế A-1 → user 2 nhận `SEAT_CONFLICT` với `details: {"seat_ids": ["uuid-of-A-1"]}`. Frontend phải query thêm để lấy seat_code.

### Kỳ vọng / Thực tế
- Kỳ vọng: `details` bao gồm cả `seat_codes` hoặc `seat_ids` + `seat_codes`.
- Thực tế: `details` chỉ chứa `seat_ids` (mảng UUID).

### Bằng chứng
`supabase/migrations/20261001000000_init_database.sql:4622-4626`

### Nguyên nhân
Khi build `v_conflicts` không join bảng `seats` để lấy seat_code.

### Đề xuất sửa
Join bảng `seats` khi build `v_conflicts` để thêm seat_code.

### Ghi chú claude
Đề xuất tính năng, không phải lỗi. Mobile đã có `seat_code` từ layout.

### Kiểm thử
Chưa chạy. Cần test pgTAP verify seat_codes included in conflict error.

---

## B-11: Booking Total Amount Overflow Risk

### Trạng thái
WONTFIX

### Mức độ
Thấp

### Giao cho
opencode

### Luồng
giữ chỗ

### Tái hiện
Tính `sum(unit_list_price * quantity)::bigint` và `sum(unit_discount * quantity)::bigint`. Nếu quantity lớn (max 100 items * max_per_order), tích có thể vượt `bigint` max (9.22e18).

### Kỳ vọng / Thực tế
- Kỳ vọng: Cast sang `numeric` trước khi sum, rồi cast về `bigint`.
- Thực tế: Cộng trực tiếp bigint có rủi ro tràn số (lý thuyết).

### Bằng chứng
`supabase/migrations/20261001000000_init_database.sql:4703-4707`

### Nguyên nhân
Không cast sang numeric trước khi cộng dồn.

### Đề xuất sửa
`sum((unit_list_price * quantity)::numeric)::bigint`.

### Ghi chú claude
Tối đa 100 item, đơn vị VND: không thể chạm giới hạn `bigint`.

### Kiểm thử
Chưa chạy. Cần test pgTAP verify large amounts handled correctly.

---

## B-12: begin_payment T_MAX Check Logic Edge Case

### Trạng thái
WONTFIX

### Mức độ
Trung bình

### Giao cho
opencode

### Luồng
thanh toán

### Tái hiện
Booking tạo 25 phút trước (T_MAX=30). Mở payment → `v_deadline = created_at + 30m = now() + 5m`. `v_lock = least(now()+20m, now()+5m) = now()+5m`. Check `now()+5m <= now()+15m` → PASS. Nhưng lock chỉ 5 phút, gateway session 15 phút → lock hết trước gateway.

### Kỳ vọng / Thực tế
- Kỳ vọng: Check nên đảm bảo `v_lock - now() >= session_minutes + buffer`.
- Thực tế: Check so với `now() + v_minutes` thay vì độ dài thực của lock.

### Bằng chứng
`supabase/migrations/20261001000000_init_database.sql:4882-4887`

### Nguyên nhân
Logic check `v_lock <= now() + v_minutes` không đảm bảo lock duration đủ dài.

### Đề xuất sửa
Thêm check `v_lock - now() >= make_interval(mins => v_minutes + 5)` thay vì so với `now() + v_minutes`.

### Ghi chú claude
Đọc ngược điều kiện: với `v_lock = now()+5m`, `v_lock <= now()+15m` **đúng**, nên ném `BOOKING_EXPIRED` (`init.sql:4886`). Code đã bảo đảm lock dài hơn phiên cổng.

### Kiểm thử
Chưa chạy. Cần test pgTAP verify payment session lock duration sufficient.

---

## B-13: Missing Input Validation on Ticket Type Price Amount

### Trạng thái
WONTFIX

### Mức độ
Thấp

### Giao cho
opencode

### Luồng
khác

### Tái hiện
Tạo ticket type với price_amount âm → logic tính tổng tiền, discount sai.

### Kỳ vọng / Thực tế
- Kỳ vọng: Thêm `CHECK (price_amount >= 0)` vào migration (cần migration mới).
- Thực tế: Không có CHECK constraint `price_amount >= 0` trên bảng `ticket_types`.

### Bằng chứng
Schema definition `ticket_types.price_amount` là `bigint` không có constraint.

### Nguyên nhân
Thiếu validation tại database level.

### Đề xuất sửa
Tạo migration mới thêm constraint `CHECK (price_amount >= 0)`.

### Ghi chú claude
Đã có `check ((kind = 'PAID' and price_amount > 0) or …)` (`init.sql:864`).

### Kiểm thử
Chưa chạy. Cần migration mới và test pgTAP verify negative price rejected.

---

## B-14: AuthEndpoints Missing Rate Limiting on Auth Endpoints

### Trạng thái
OPEN

### Mức độ
Trung bình

### Giao cho
opencode

### Luồng
khác

### Tái hiện
Gọi `/api/auth/login` liên tục với email sai → không bị chặn.

### Kỳ vọng / Thực tế
- Kỳ vọng: Thêm rate limiting (ASP.NET Core rate limiting middleware) cho auth endpoints.
- Thực tế: Các endpoint `/api/auth/login`, `/register`, `/otp`, `/resend-signup` không có rate limiting.

### Bằng chứng
`backend/src/EventPlatform.Api/AuthEndpoints.cs:34-93`

### Nguyên nhân
Chưa cấu hình rate limiting middleware cho auth group.

### Đề xuất sửa
Cấu hình rate limiting trong `Program.cs` cho group `/api/auth`.

### Ghi chú claude
Xác nhận không có rate limiting trong `Program.cs`. Thêm: `/api/auth/*` chỉ relay tới Supabase Auth, nên giới hạn theo IP của GoTrue áp lên **IP của server API** — mọi người dùng chung một hạn mức, kẻ tấn công không bị giới hạn riêng. Dùng `Microsoft.AspNetCore.RateLimiting` (có sẵn trong shared framework, không thêm package) theo IP client, nhớ `ForwardedHeaders` trên Render.

### Contract đã chốt (claude, 2026-10-25)
- Phạm vi: **chỉ** group `/api/auth` (`RequireRateLimiting("auth")`). Không đặt `GlobalLimiter`.
- Khoá phân vùng: IP client sau `UseForwardedHeaders` (`XForwardedFor`, `ForwardLimit = 1`, xoá `KnownNetworks`/`KnownProxies`
  vì IP proxy của Render không cố định; chỉ lấy giá trị phải nhất do proxy Render thêm vào). `UseForwardedHeaders` chạy
  trước `UseRateLimiter`.
- Hạn mức: fixed window 10 request/phút/IP, `QueueLimit = 0` (từ chối ngay, không xếp hàng).
- Từ chối: HTTP 429, header `Retry-After: <giây>`, body `{ "message": "RATE_LIMITED", "details": "{\"retry_after_seconds\":N}" }`
  (đặt trong `OnRejected`). `@event/core` đã có mã `RATE_LIMITED` (`packages/core/src/errors.ts`).
- Giới hạn cấu hình được (`RateLimit:Auth:PermitLimit`, `RateLimit:Auth:WindowSeconds`) để test đặt hạn mức nhỏ.

### Review bản nháp (claude, 2026-10-25, working tree trên `6b860ab`)
Chưa đạt, cần sửa trước khi bàn giao:
1. `Program.cs` đặt `options.GlobalLimiter` 10 request/phút/IP cho **mọi** endpoint → app poll `get_booking` 3s một lần,
   duyệt catalog… sẽ bị chặn sau 10 request. Bỏ `GlobalLimiter`.
2. `QueueLimit = 20` khiến request bị treo tới hết cửa sổ thay vì nhận 429. Đặt `0`.
3. Thiếu `ForwardedHeaders`: trên Render `RemoteIpAddress` là IP proxy → mọi người dùng chung một hạn mức.
4. Thiếu `OnRejected` → body rỗng, không theo contract `{ message, details }`.
5. Policy lặp lại hai lần; bỏ comment thừa `// Already has rate limiting applied…` ở `Program.cs`.
6. Chưa có xUnit: vượt hạn mức → 429 + body `RATE_LIMITED`; endpoint ngoài `/api/auth` không bị giới hạn.

### Kiểm thử
Chưa chạy. Cần test xUnit verify rate limiting enforced on auth endpoints.

---

## B-15: Payment Gateway Verification Not Enforced for Non-TEST Mode

### Trạng thái
OPEN

### Mức độ
Thấp

### Giao cho
opencode

### Luồng
thanh toán

### Tái hiện
Set `Payments:Gateway=VNPAY` (chưa implement), gọi `/payments/sessions` → 500 Internal Server Error.

### Kỳ vọng / Thực tế
- Kỳ vọng: Trả `503 Service Unavailable` với message `PAYMENT_GATEWAY_NOT_CONFIGURED`.
- Thực tế: `UnconfiguredPaymentGateway` ném `NotSupportedException` khi gọi bất kỳ method nào.

### Bằng chứng
`backend/src/EventPlatform.Core/Payments/IPaymentGateway.cs:28-41`

### Nguyên nhân
Không validate config tại startup, để runtime crash.

### Đề xuất sửa
Trong `ServiceCollectionExtensions.cs`, validate config và throw startup exception hoặc trả lỗi graceful.

### Ghi chú claude
Đúng nhưng chưa ảnh hưởng (đang dùng `TEST`). Fail-fast lúc khởi động khi `Payments:Gateway` không được hỗ trợ.

### Review bản nháp (claude, 2026-10-25)
Hướng sửa trong `ServiceCollectionExtensions.cs` đúng (`render.yaml:28` đặt `TEST` nên production không bị ảnh hưởng).
Còn thiếu: xUnit cho `AddEventPlatformCore` với `Payments:Gateway=VNPAY` → `InvalidOperationException`, và khi không cấu
hình → `UnconfiguredPaymentGateway`. Bỏ dòng trắng có khoảng trắng thừa (`+        `). Chưa `FIXED` khi chưa có test.

### Kiểm thử
Chưa chạy. Cần test xUnit verify startup fails with clear message when gateway not configured.

---

## B-16: Missing Validation on Booking Items Quantity for Seated Tickets

### Trạng thái
WONTFIX

### Mức độ
Trung bình

### Giao cho
opencode

### Luồng
giữ chỗ

### Tái hiện
Gửi item `{ticket_type_id: "...", seat_id: "...", quantity: null}` → pass validation.

### Kỳ vọng / Thực tế
- Kỳ vọng: Seated ticket phải reject nếu `quantity` được cung cấp và ≠ 1.
- Thực tế: Check `coalesce(x.quantity, 1) <> 1` cho phép `quantity: null`.

### Bằng chứng
`supabase/migrations/20261001000000_init_database.sql:4519-4522`

### Nguyên nhân
Dùng `coalesce` cho phép null pass như thể là 1.

### Đề xuất sửa
Thêm check `x.seat_id is not null and x.quantity is not null and x.quantity <> 1`.

### Ghi chú claude
`quantity` null cho ghế ngồi nghĩa là 1, hợp lệ.

### Kiểm thử
Chưa chạy. Cần test pgTAP verify seated ticket with quantity null rejected.

---

## B-17: Booking Snapshot Missing Email for POS Bookings

### Trạng thái
WONTFIX

### Mức độ
Thấp

### Giao cho
opencode

### Luồng
khác

### Tái hiện
POS booking snapshot chỉ lưu `holder_name`, `holder_phone`, `holder_email`, `sold_by`. Không lưu `full_name`, `phone` của staff bán.

### Kỳ vọng / Thực tế
- Kỳ vọng: Thêm `sold_by_name`, `sold_by_phone` vào snapshot từ profile của `v_user` (staff).
- Thực tế: Snapshot thiếu thông tin staff.

### Bằng chứng
`supabase/migrations/20261001000000_init_database.sql:4495-4497`

### Nguyên nhân
Không query profile của staff khi tạo snapshot POS.

### Đề xuất sửa
Query profile của staff và thêm vào `v_snapshot`.

### Ghi chú claude
Đề xuất tính năng, không phải lỗi.

### Kiểm thử
Chưa chạy. Cần test pgTAP verify POS snapshot includes staff info.

---

## B-18: Comp Ticket Recipient Validation Allows Duplicate Emails

### Trạng thái
OPEN

### Mức độ
Thấp

### Giao cho
opencode

### Luồng
khác

### Tái hiện
Gửi 2 recipient cùng email → tạo 2 booking COMP riêng biệt.

### Kỳ vọng / Thực tế
- Kỳ vọng: Validate unique email trong `p_recipients` array.
- Thực tế: Loop qua recipients nhưng không check duplicate email.

### Bằng chứng
`supabase/migrations/20261001000000_init_database.sql:4753-4776`

### Nguyên nhân
Thiếu validation unique email trước loop.

### Đề xuất sửa
Thêm check duplicate email trước loop.

### Ghi chú claude
Người dùng xác nhận là lỗi (2026-10-25). Migration mới: `issue_comp_tickets` báo
`VALIDATION_FAILED {reason: "duplicate recipient email", emails: [...]}` khi `p_recipients` có email trùng
(so sánh `lower(trim(email))`), trước khi tạo bất kỳ booking nào.

### Review bản nháp (claude, 2026-10-25)
`supabase/migrations/20261025100000_validate_comp_ticket_emails.sql` chưa đạt:
1. **Chặn**: khối `declare` bỏ mất `r record;` → migration không áp dụng được. Đã thử trên DB local trong transaction
   rồi rollback: `ERROR: loop variable of loop over rows must be a record variable or list of scalar variables` (LINE 46).
   `supabase db reset` sẽ hỏng.
2. Recipient không có `email` (null/rỗng) bị gộp thành "trùng" `[null]`. Lọc `where nullif(trim(email), '') is not null`
   trong truy vấn đếm trùng; để `create_booking` tự xử lý thiếu email như cũ.
3. `v_emails` khai báo và gán nhưng không dùng; bỏ đi.
4. Tên file: theo quy ước đợt này `202610250000NN_<slug>.sql` → đổi thành `20261025000001_validate_comp_ticket_emails.sql`.
5. Thêm pgTAP: hai recipient `A@x.com` / ` a@x.com ` → `VALIDATION_FAILED` với `reason = 'duplicate recipient email'`,
   không tạo booking nào; danh sách không trùng → vẫn tạo đủ booking.
Quyền `EXECUTE` (authenticated, service_role) khớp bản gốc, giữ nguyên.

### Kiểm thử
Chưa chạy. Cần test pgTAP verify duplicate emails in comp tickets rejected.

---

## B-19: Ticket Type Inventory Locked Not Decremented on Booking Expiry for Standing Zones

### Trạng thái
WONTFIX

### Mức độ
Cao

### Giao cho
opencode

### Luồng
huỷ/hoàn tiền

### Tái hiện
Cần kiểm tra function `release_booking` có giảm `ticket_type_inventory.locked` khi booking PENDING/EXPIRED/CANCELLED không.

### Kỳ vọng / Thực tế
- Kỳ vọng: `release_booking` cập nhật đúng `ticket_type_inventory.locked` cho cả seated và standing.
- Thực tế: Chưa xác nhận (cần đọc full function trong migration).

### Bằng chứng
`supabase/migrations/20261001000000_init_database.sql` - function `release_booking` (line ~4100+)

### Nguyên nhân
Chưa verify logic release_booking cho standing zones.

### Đề xuất sửa
Đọc function `release_booking` đầy đủ để confirm. Nếu thiếu, thêm UPDATE cho `ticket_type_inventory.locked` và `session_zone_inventory.locked`.

### Ghi chú claude
`release_booking` **có** trừ `locked` của khu đứng và hạng vé (`init.sql:4073-4083`). Lỗi thật là nó không bao giờ được gọi cho `PAYMENT_PENDING` → C-01.

### Kiểm thử
Chưa chạy. Cần đọc function release_booking và test pgTAP verify locked counts decremented.

---

## B-20: Test Payment Endpoint Accepts Arbitrary Return URLs (Partial Fix)

### Trạng thái
WONTFIX

### Mức độ
Trung bình

### Giao cho
opencode

### Luồng
thanh toán

### Tái hiện
Config `Api:PublicUrl=http://localhost:5080`, gửi `return=https://evil.com/payments/return` → `Uri.Compare` với `UriComponents.SchemeAndServer` sẽ khác scheme → block. OK.

### Kỳ vọng / Thực tế
- Kỳ vọng: Validate scheme, host, port của return URL.
- Thực tế: Code dùng `UriComponents.SchemeAndServer` → đã check scheme + host + port.

### Bằng chứng
`backend/src/EventPlatform.Api/TestPaymentEndpoints.cs:52-57`

### Ghi chú claude
BUG này không tồn tại. opencode đã tự rút.

### Kiểm thử
N/A

---

## B-21: Missing Request Size Limit on JSON Endpoints

### Trạng thái
WONTFIX

### Mức độ
Thấp

### Giao cho
opencode

### Luồng
khác

### Tái hiện
Gửi request JSON lớn đến các endpoint (create_booking, create_event, etc.) → không bị giới hạn.

### Kỳ vọng / Thực tế
- Kỳ vọng: Thêm global request size limit middleware hoặc per-endpoint.
- Thực tế: Chỉ `/api/uploads` có `RequestSizeLimitAttribute`.

### Bằng chứng
`backend/src/EventPlatform.Api/UploadEndpoints.cs:75`

### Nguyên nhân
Chưa cấu hình request size limit global.

### Đề xuất sửa
Cấu hình `builder.Services.Configure<IISServerOptions>` và `KestrelServerOptions` limit request body size.

### Ghi chú claude
Kestrel mặc định giới hạn body 30 MB; `create_booking` giới hạn 100 item.

### Kiểm thử
Chưa chạy. Cần test xUnit verify large request bodies rejected.

---

## B-22: QR Signing Key Not Validated at Startup for Workers

### Trạng thái
WONTFIX

### Mức độ
Trung bình

### Giao cho
opencode

### Luồng
khác

### Tái hiện
Workers chạy riêng mà thiếu `Qr:SigningKey` → crash khi nhận job `ISSUE_TICKETS`.

### Kỳ vọng / Thực tế
- Kỳ vọng: Workers cũng validate `Qr:SigningKey` tại startup.
- Thực tế: API check key để add `IssueTicketsWorker` nhưng Workers project không có validation.

### Bằng chứng
`backend/src/EventPlatform.Api/Program.cs:18-23`

### Nguyên nhân
Validation chỉ ở API, không ở Workers.

### Đề xuất sửa
Thêm validation tương tự trong `Workers/Program.cs`.

### Ghi chú claude
`QrSigner` ném lỗi trong constructor (`QrSigner.cs:28-30`), `IssueTicketsWorker` nhận nó qua DI, nên Workers đã fail-fast khi khởi động.

### Kiểm thử
Chưa chạy. Cần test verify Workers fails fast at startup without Qr:SigningKey.

---

## B-23: OrgEndpoints Search Query Injection Risk (Low)

### Trạng thái
WONTFIX

### Mức độ
Thấp

### Giao cho
opencode

### Luồng
khác

### Tái hiện
`Search(q, ...)` function (Postgrest.cs:36-43) sanitize term bằng cách chỉ giữ letter/digit/space. Tuy nhiên `BuyerColumns` chứa JSON path (`buyer_snapshot->>full_name`) → nếu term chứa ký tự đặc biệt có thể bypass? Code đã clean term → an toàn.

### Kỳ vọng / Thực tế
- Kỳ vọng: Không có injection risk.
- Thực tế: Code đã sanitize term.

### Bằng chứng
`backend/src/EventPlatform.Api/OrgEndpoints.cs:456-458`

### Ghi chú claude
BUG này không tồn tại. opencode đã tự rút.

### Kiểm thử
N/A

---

## B-24: Cancellation Flow Missing Refund for Paid Bookings (Known Gap)

### Trạng thái
WONTFIX

### Mức độ
Nghiêm trọng

### Giao cho
opencode

### Luồng
huỷ/hoàn tiền

### Tái hiện
`cancel_booking` chỉ cho phép hủy khi `status = 'PENDING'`. Booking `PAID`/`CONFIRMED` không thể hủy qua RPC này.

### Kỳ vọng / Thực tế
- Kỳ vọng: Cho phép hủy và hoàn tiền cho booking đã thanh toán.
- Thực tế: Hoàn tiền phải qua luồng Admin/Org cancellation hoặc manual refund.

### Bằng chứng
`supabase/migrations/20261001000000_init_database.sql:4799-4820` (`cancel_booking`)

### Ghi chú claude
Giới hạn đã biết của P1 (ARCH.md §4.6).

### Kiểm thử
N/A

---

## B-25: Payment IPN Handler Returns 200 Even on Verification Failure

### Trạng thái
WONTFIX

### Mức độ
Cao

### Giao cho
opencode

### Luồng
thanh toán

### Tái hiện
Cổng gửi IPN signature sai → API trả 400 → cổng retry → có thể gây duplicate nếu lần sau verify pass.

### Kỳ vọng / Thực tế
- Kỳ vọng: Luôn trả `Results.Ok()` sau khi log warning, không trả 400/500.
- Thực tế: `HandleIpnAsync` trả `Results.BadRequest()` khi `VerifyIpnAsync` return null.

### Bằng chứng
`backend/src/EventPlatform.Api/PaymentEndpoints.cs:60-65`

### Nguyên nhân
Spec (ARCH.md §4.4): "luôn 200 sau khi ghi" nhưng code trả 400.

### Đề xuất sửa
Dòng 64 đổi thành `return Results.Ok();` (vẫn log warning).

### Ghi chú claude
400 chỉ trả khi chữ ký sai, lúc đó chưa ghi gì nên không có rủi ro xử lý trùng. Định dạng phản hồi IPN theo cổng thật sẽ làm cùng C-04.

### Kiểm thử
Chưa chạy. Cần test xUnit verify IPN always returns 200.

---

## B-26: Missing Database Tests for New Migration RPCs

### Trạng thái
OPEN

### Mức độ
Trung bình

### Giao cho
opencode

### Luồng
khác

### Tái hiện
Không có test cho các RPC mới như `save_gate`, `assign_seats_ticket_type`, `set_session_seat_status`, `issue_comp_tickets`, `request_bank_account_change`, etc. (migration 20261021*).

### Kỳ vọng / Thực tế
- Kỳ vọng: Mở rộng pgTAP tests cover tất cả RPC public.
- Thực tế: Có 3 file test pgTAP nhưng thiếu test cho RPC mới.

### Bằng chứng
`supabase/tests/database/` - chỉ có 01_schema_rules, 02_core_flows, 04_portal_rpcs

### Nguyên nhân
Test coverage không cập nhật khi thêm migration mới.

### Đề xuất sửa
Thêm test file cho migration 20261021*.

### Ghi chú claude
Nợ test pgTAP cho các RPC portal mới. Làm sau C-01..C-05.

### Kiểm thử
Chưa chạy. Cần thêm pgTAP test files.

---

## B-27: Missing .NET Tests for Catalog Endpoints

### Trạng thái
OPEN

### Mức độ
Thấp

### Giao cho
opencode

### Luồng
khác

### Tái hiện
Test file `ApiEndpointTests.cs` cover hầu hết endpoint trừ `CatalogEndpoints` (`/api/events`, `/api/sessions/{id}/layout`, etc.).

### Kỳ vọng / Thực tế
- Kỳ vọng: Thêm test class `CatalogEndpointTests`.
- Thực tế: Không có test verify RLS filter, query params, RPC forwarding cho catalog.

### Bằng chứng
`backend/tests/EventPlatform.Tests/`

### Nguyên nhân
Test coverage thiếu cho catalog endpoints.

### Đề xuất sửa
Tạo file test mới cover catalog endpoints.

### Ghi chú claude
Nợ test xUnit cho `CatalogEndpoints`.

### Kiểm thử
Chưa chạy. Cần tạo `CatalogEndpointTests.cs`.

---

## B-28: Supabase Local Dev URL Mismatch in appsettings.Development.json

### Trạng thái
OPEN

### Mức độ
Trung bình

### Giao cho
opencode

### Luồng
khác

### Tái hiện
Dev phải ghi đè qua user-secrets vì `appsettings.Development.json` trỏ Supabase:Url tới project hosted PRODUCTION.

### Kỳ vọng / Thực tế
- Kỳ vọng: `appsettings.Development.json` có `Supabase:Url = "http://127.0.0.1:54321"`.
- Thực tế: Config mặc định trỏ production, rủi ro ghi nhầm dữ liệu thật.

### Bằng chứng
`backend/src/EventPlatform.Api/appsettings.Development.json`

### Nguyên nhân
Config development không trỏ local Supabase stack.

### Đề xuất sửa
Update file config trỏ local.

### Ghi chú claude
Xác nhận: `appsettings.Development.json:3` trỏ project PRODUCTION. Đổi về `http://127.0.0.1:54321`; URL hosted chỉ đặt qua env trên Render.

### Kiểm thử
Chưa chạy. Verify config sau khi sửa.

---

## B-29: Missing Integration Test for Full Booking→Payment→Ticket Flow

### Trạng thái
OPEN

### Mức độ
Trung bình

### Giao cho
opencode

### Luồng
thanh toán

### Tái hiện
Không có test end-to-end cover full happy path từ create_booking → begin_payment → apply_payment_success → issue_tickets → CONFIRMED.

### Kỳ vọng / Thực tế
- Kỳ vọng: Thêm test tích hợp full flow.
- Thực tế: `smoke_e2e.sql` test một số flow nhưng không cover full path.

### Bằng chứng
N/A

### Nguyên nhân
Thiếu test integration end-to-end.

### Đề xuất sửa
Mở rộng `supabase/scripts/smoke_e2e.sql` hoặc thêm test pgTAP.

### Ghi chú claude
Gộp vào phần kiểm thử của C-01 (happy path + nhánh thất bại/hết hạn).

### Kiểm thử
Chưa chạy. Cần thêm integration test.

---

## B-30: Concurrency Test Script Not Runnable on Windows

### Trạng thái
WONTFIX

### Mức độ
Thấp

### Giao cho
opencode

### Luồng
khác

### Tái hiện
Script shell dùng `psql` và `&` background jobs, không chạy trên Windows PowerShell mặc định.

### Kỳ vọng / Thực tế
- Kỳ vọng: Cung cấp version PowerShell `.ps1` hoặc document chạy trong WSL/Git Bash.
- Thực tế: CI dùng Linux nên OK, nhưng dev Windows không chạy được local.

### Bằng chứng
`supabase/scripts/concurrency_ac01.sh`

### Nguyên nhân
Script chỉ tương thích Unix shell.

### Đề xuất sửa
Tạo `concurrency_ac01.ps1` hoặc update README.

### Ghi chú claude
Git Bash có sẵn trên Windows; ghi chú trong ARCH.md là đủ.

### Kiểm thử
Chưa chạy. Cần tạo PowerShell version.

---

## Summary by Severity (Sau triage)

| Mức độ | Mục còn mở |
|----------|------|
| Trung bình | B-14, B-26, B-28, B-29 |
| Thấp | B-15, B-18, B-27 |
| Trùng `core.md` | B-09 (C-01) |
| WONTFIX | B-01..B-08, B-10..B-13, B-16, B-17, B-19..B-25, B-30 |

---

## Test Results

**Backend (.NET):** Cannot run - .NET 10 SDK not installed  
**Database (pgTAP):** Cannot run - Docker daemon not running  
**Manual Code Review:** Completed for all backend API endpoints, RPC functions, and test files