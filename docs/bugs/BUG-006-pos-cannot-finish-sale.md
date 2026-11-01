# BUG-006: Màn POS chỉ tạo được Booking: không thu tiền, không có QR, không bán được hạng vé có ghế

- Trạng thái: FIXED (claude, 2026-11-02, nhánh `fix/e2e-findings`, chưa commit)
- Phía: frontend (không đổi contract, API hay DB)
- Giao cho: claude (chủ dự án yêu cầu claude sửa; đây là luồng giữ chỗ → thanh toán → phát vé ở AGENTS mục 2)
- Mức độ: high
- Luồng: giữ chỗ | thanh toán | xác nhận
- Người phát hiện: claude (rà soát sau E2E 2026-11-01)

## Tái hiện
1. Đăng nhập Staff có quyền POS, mở tab "Bán vé".
2. Chọn hạng vé trả phí, bấm "Tạo booking POS": Booking dừng ở `PENDING`, không có nút thanh toán.
3. Chọn hạng có ghế: `create_booking` trả `VALIDATION_FAILED` (`zone_id required or invalid`).

## Kỳ vọng / Thực tế
Kỳ vọng: Staff bán trọn một đơn tại quầy (chọn ghế hoặc số lượng, thu tiền, đưa QR cho khách).
Thực tế: màn hình dừng sau bước giữ chỗ. Khách trả tiền không có đường nào nhận vé.

## Nguyên nhân
DB và API đã hỗ trợ POS: `begin_payment` kiểm `created_by`, `get_booking_admission` cho phép `sold_by`. Thiếu ở app:

- Không gọi phiên thanh toán và không đọc admission.
- Luôn gửi `zones[0]` + `quantity`, kể cả với hạng bán theo ghế; không có sơ đồ ghế.
- Liệt kê cả hạng `COMP`, mà `create_booking` từ chối ở luồng POS.
- Mỗi lần bấm sinh idempotency key mới: mất phản hồi rồi bấm lại sẽ giữ chỗ hai lần.
- Số lượng không bị giới hạn theo `max_per_order` và số chỗ còn lại.
- Rời màn hình là mất đơn đang giữ, không mở lại được QR.

## Cách sửa
Chỉ trong `apps/mobile`:

- `features/staff/screens/staff-pos-screen.tsx`: chọn hạng vé, khu vực, ghế hoặc số lượng; giữ nguyên idempotency key khi thử lại; danh sách đơn gần đây.
- `features/staff/components/pos-seat-picker.tsx`: sơ đồ ghế và chọn dạng danh sách.
- `features/staff/components/pos-checkout.tsx`, `hooks/use-pos-checkout.ts`: giữ chỗ, thu tiền, phát vé, QR, huỷ.
- `features/staff/lib/pos-sale.ts`: quy tắc thuần, khớp `create_booking` (ghế có hạng giá chỉ bán đúng hạng đó, ghế chưa có hạng bán theo Zone).
- `features/customer/payment/run-checkout.ts`: tách từ `use-payment.ts` để hai luồng dùng chung; hành vi của khách không đổi.
- `staff-api.ts`: bỏ `createStaffPosBooking`, tạo Booking qua `repositories.booking` như bảng trong `docs/ARCH.md`.

## Giới hạn còn lại
- Thu tiền vẫn đi qua cổng thanh toán, đúng thiết kế trong `init_database.sql` ("thanh toán qua cổng"). **Chưa có thu tiền mặt**: cần ghi sổ cái và đối soát, phải chốt contract riêng.
- Cổng thật chưa chọn (OQ-02), nên nhánh `REDIRECT` chưa chạy thật trên POS; chỉ có test đơn vị dùng chung với luồng khách.
- Chế độ TEST xác nhận đơn mà không thu tiền; màn hình có ghi rõ. Trên môi trường tắt TEST, API trả 503 `PAYMENT_UNAVAILABLE` và đơn vẫn được giữ.
- Màn POS chưa nhập tên/SĐT người mua; vé POS không có tên người giữ.

## Kiểm thử
Stack local (`supabase`, API `:5080`, gateway TEST), máy ảo Android, tài khoản `staff-a@dev.local`:

- Trên màn hình: đơn 2 ghế VIP (`73AAAB8A71`) và đơn 2 vé khu đứng (`7D9EC2D1AA`): `CONFIRMED`, payment `SUCCEEDED`, 2 vé, 1 QR, hiển thị "Còn 2/2 lượt vào". Mở lại QR từ danh sách đơn gần đây. Không có hạng `COMP`.
- Giữ chỗ để yên 90 giây: vẫn `PENDING`, không có payment; poll `get_booking` khoảng 3 giây một lần.
- Qua API (cùng các request app dùng): gọi lại cùng key trả cùng đơn, key khác trên ghế đã giữ trả `SEAT_CONFLICT`, huỷ giữ chỗ trả `CANCELLED`, quét QR tại cổng trả `OK` với 1 đã vào và 1 còn lại.
- Đơn miễn phí (`87580776DF`): `CONFIRMED`, 1 vé, 1 QR, không có payment.
- `pnpm --filter @event/mobile lint`, `typecheck`, `test`: đạt (40 file, 176 test). Test mới: `features/staff/lib/pos-sale.test.ts`.
- Chưa chạy thật: nút "Kiểm tra lại trạng thái" (poll xong trước khi cần bấm) và nhánh chọn nhiều khu của một hạng vé (seed không có).
- Không chạy `dotnet test` và `supabase test db`: không đổi `backend/**` hay `supabase/**`.

Phát hiện khi chạy thử: có lần poll dừng trên toàn app (cả availability) sau khi Wi-Fi máy ảo kết nối lại trong lúc chạy `uiautomator dump`; khởi động lại thì poll bình thường, chưa tái hiện riêng. Vì vậy bước chờ phát vé có thêm nút "Kiểm tra lại trạng thái".
