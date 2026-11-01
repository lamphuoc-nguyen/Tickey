# Customer: xác nhận đặt vé trực tiếp

**Blocker hiện tại (01/11/2026, C-12):** kiểm tra chỉ đọc trên Supabase hosted trả 404/PGRST202 cho RPC get_payment_by_order_ref mà endpoint xác nhận đang gọi. Chủ backend cần đối chiếu migration 20261026000001_fix_payment_pending_repayment.sql, grant và schema cache. Chưa chạy hoặc sửa migration production. Đây là lỗi tích hợp server cần xử lý trước khi kết luận checkout chạy được; đổi giao diện hoặc cấu hình Expo không khắc phục RPC bị thiếu.

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

Backend vẫn phải hỗ trợ adapter xác nhận hiện có (TEST, HMAC ký URL) và worker/phần ký phát vé. Không có server phát vé thì chỉ sửa UI không thể tạo vé hợp lệ. Nếu backend chưa sẵn sàng, app giữ error/pending. Không sửa backend/migration hoặc ghi dữ liệu production trong đợt triển khai này.

Mobile không kiểm tra/gỡ khóa theo hostname production nữa, theo yêu cầu sản phẩm không cần cờ cấu hình payment. Điều này không xác minh môi trường và không cấp quyền chạy giao dịch production cho agent. Kiểm thử ghi chỉ được thực hiện trên local/staging riêng.

**QR còn bị chặn:** contract hiện trả credential từng Ticket; chưa có encoding QR chung Booking kèm số lượt quét. Customer hiện truyền null vào vùng QR chung; StaffCheckInScreen hiện ghi Native camera/QR verifier chưa được nối. Không thể tuyên bố Staff quét được QR chung từ bản code này. Cần chủ Backend/Staff thống nhất credential/decoder và kiểm chứng thật, không tự gộp credential hoặc dựng QR giả.

## Kiểm thử

Unit tests chỉ dùng fixtures trong test: xác nhận không cần cờ payment, request form đúng URL/chữ ký/Booking, chặn gửi lặp, xử lý mất phản hồi bằng getBooking và không ghi cache sau đổi tài khoản. Không dùng test để tuyên bố đã kiểm tra phát hành/check-in E2E.

Chưa chạy giao dịch local/staging hoặc native một chạm trong đợt sửa. Chưa kiểm tra quét QR giữa Customer/Staff.
