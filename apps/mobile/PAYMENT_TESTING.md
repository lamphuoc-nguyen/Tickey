# Customer: xác nhận đặt vé trực tiếp

**Cập nhật sau sửa backend:** GET get_payment_by_order_ref với mã không tồn tại đã trả 200/null thay cho PGRST202. RPC admission cũng đã có (probe không có user trả UNAUTHENTICATED). Không cần thêm cờ cấu hình thanh toán ở mobile. Đây là xác minh đường đọc/contract, không phải xác nhận đã thanh toán hoặc phát vé E2E.

Theo yêu cầu cập nhật ngày 01/11/2026, Customer không cần cấu hình cổng thanh toán, cờ TEST hoặc chế độ xem trước. Mobile dùng luồng xác nhận server hiện có, không mở browser và không tự tạo vé.

## Hành vi

1. Chọn chỗ, tạo Booking theo flow hiện tại.
2. Mở Thanh toán, bấm Thanh toán. Không cần checkbox hay cấu hình payment trong .env.local.
3. Mobile tạo phiên bằng HttpPaymentApi với mã adapter TEST của backend, chuyển tiếp form amount/return/sig đã được server ký và result=success tới endpoint TEST cùng origin API.
4. Luôn getBooking để kiểm tra kết quả. PAID mở màn Đang phát hành vé; CONFIRMED hiện Đặt vé thành công và tải các Ticket server phát hành.
5. Lỗi server hoặc chưa xác nhận vẫn hiển thị lỗi/pending, không gán trạng thái thành công ở client, không tạo credential giả.

Tên adapter TEST là chi tiết implementation hiện có của backend, không phải vé xem trước. Luồng này cập nhật dữ liệu thanh toán/phát hành ở server nhưng không thu tiền qua ngân hàng hay ví điện tử. Không dùng nó để khẳng định đã thực thu tiền. Không thêm nhãn vé vô hiệu: hiệu lực của từng Ticket do trạng thái server và cơ chế check-in quyết định.

## Cấu hình mobile

Chỉ còn cấu hình kết nối dữ liệu/Auth/API hiện có: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_API_URL. Không cần EXPO_PUBLIC_PAYMENT_GATEWAY hoặc EXPO_PUBLIC_PAYMENT_TEST_MODE; các giá trị cũ bị bỏ qua. Không đổi .env.local của người dùng.

Khởi động lại Metro nếu đang chạy bundle cũ:

```powershell
pnpm --filter @event/mobile exec expo start --go --clear
```

## Điều kiện server và giới hạn

Backend phải bật `Payments:Test:AllowCheckout=true` (mặc định tắt, API trả 503 `PAYMENT_UNAVAILABLE`), vẫn phải hỗ trợ adapter xác nhận hiện có (TEST, HMAC ký URL) và worker/phần ký phát vé. Không có server phát vé thì chỉ sửa UI không thể tạo vé hợp lệ. Nếu backend chưa sẵn sàng, app giữ error/pending. Không sửa backend/migration hoặc ghi dữ liệu production trong đợt triển khai này.

Mobile không kiểm tra/gỡ khóa theo hostname production nữa, theo yêu cầu sản phẩm không cần cờ cấu hình payment. Điều này không xác minh môi trường và không cấp quyền chạy giao dịch production cho agent. Kiểm thử ghi chỉ được thực hiện trên local/staging riêng.

**Cập nhật sau merge main PR #46/#47:** đã có contract QR chung Booking và số lượt qua GET /api/bookings/{id}/admission. Worker ký credential v2; Customer dùng chuỗi QR server cấp và lưu offline, Staff có camera expo-camera và gửi kiểm tra chữ ký tới server. Các phần này được giữ nguyên khi merge. Hosted vẫn cần đầy đủ migration/quyền/cache và worker; trong phiên merge này chưa chạy giao dịch/phát hành hoặc quét native E2E. Chi tiết và QA do tác giả ghi tại docs/BOOKING_ADMISSION_FLOW.md. Không tự gộp credential hay dựng QR giả.

## Kiểm thử

Flow hiện tại bổ sung: QR chậm tự đọc lại sau 3 giây; có QR/lượt thì cập nhật sau 5 giây khi app foreground. Lỗi admission có retry riêng, không dùng counter cũ như dữ liệu mới. Hết lượt, hủy hoặc hoàn hết sẽ ẩn QR; offline chỉ hiện QR server đã tải, lượt hiện dấu gạch và thời điểm bản lưu. Lưu offline chỉ mở khi có QR và vé đúng đơn còn lượt. Khi đọc kết quả thanh toán gặp lỗi mạng, booking poll có thể khôi phục và chuyển tới vé nếu server đã PAID/CONFIRMED; không gửi lặp mutation. Timeout payment được cấu hình chung với timeout API Mobile.

Lint/typecheck toàn workspace qua; Mobile 162 test/39 file, Core 93 test/14 file qua. Android Expo Go trên AVD Pixel_5 API 36 read-only: đã mở Home, danh sách đơn thật, empty vé đã mua, đơn hết hạn và empty vé đã lưu. Tài khoản QA chưa có vé đã phát hành nên QR và trạng thái PAID/CONFIRMED mới kiểm tra bằng unit tests; chưa chạy thanh toán, phát vé hoặc Staff scan E2E. Không ghi production. Các process QA riêng đã được dừng khi bàn giao; không dừng process của người dùng.

Unit tests chỉ dùng fixtures trong test: xác nhận không cần cờ payment, request form đúng URL/chữ ký/Booking, chặn gửi lặp, xử lý mất phản hồi bằng getBooking và không ghi cache sau đổi tài khoản. Không dùng test để tuyên bố đã kiểm tra phát hành/check-in E2E.

Chưa chạy giao dịch local/staging hoặc native một chạm trong đợt sửa. Chưa kiểm tra quét QR giữa Customer/Staff.
