# Customer UI — thu gọn thao tác và nội dung (21/10/2026)

Theo phản hồi về ảnh `Screenshot 2026-10-21 172126`, Customer giảm chuỗi nút viền lớn và hướng dẫn lặp. Giữ màu/font/assets Material hiện có. Đây là điều chỉnh UX được người dùng yêu cầu sau bản đối chiếu Figma; không thay Figma, route, phân quyền hoặc contract. Không đánh dấu toàn bộ 79 frame đã kiểm chứng lại.

## Thay đổi

| Vùng | Giao diện sau chỉnh sửa |
| --- | --- |
| Tài khoản | Hai nhóm Cá nhân/Hỗ trợ với hàng điều hướng và mũi tên. Đăng xuất tách cuối màn. Bỏ các card mô tả trùng nội dung và card vai trò thừa. |
| Tìm kiếm | Chạm sự kiện mở chi tiết ngay; bỏ chọn card rồi bấm Tiếp tục. Bộ lọc chưa hỗ trợ vẫn khóa, gộp lý do thành một dòng cạnh bộ lọc. Từ khóa/danh mục vẫn giữ trong draft. |
| Thẻ sự kiện | Tên, danh mục thật và liên kết hạng vé; mô tả dài nằm trong chi tiết. Không thêm ảnh hoặc giá giả. |
| Sự kiện | Một tiêu đề, nhãn danh mục/độ tuổi nhỏ; địa điểm là hàng điều hướng; điều khoản có thể mở/thu gọn. Thiếu ảnh hiện vùng trống có nhãn, giảm chiều cao. |
| Chọn suất/ghế | Nhãn Khu vực, thanh sân khấu, chú giải gọn và liên kết mở danh sách ghế. Bỏ chọn là thao tác chữ, có nhãn accessibility theo ghế. Giá ở footer ghi Tạm tính. Giữ các lý do khóa, cảnh báo conflict và yêu cầu chưa có kết quả. |
| Đơn của tôi | Chạm một đơn mở chi tiết; bỏ bước chọn rồi bấm nút xem. Tab luôn hiện cả khi empty. |
| Chi tiết đơn | Đồng hồ giữ chỗ gọn; nhóm liên kết giao dịch/hỗ trợ. Giữ nguyên trạng thái do server, modal xác nhận hủy và giới hạn thao tác. |
| Người tham dự | Một ghi chú chung về thông tin tạm nhập chưa gửi; bỏ helper lặp ở từng trường. Nội dung form và draft vẫn được giữ. |
| Thanh toán | Một lý do khóa gần nút thanh toán; bỏ giải thích phát hành vé lặp lại. Không bật gateway hoặc giả kết quả. |
| Vé | Nhóm thông tin/lưu vé và hỗ trợ. Hàng lưu/cập nhật là thao tác, không mang mũi tên điều hướng. Vùng QR chỉ có một nhãn chưa khả dụng. Giữ cảnh báo suất hủy, snapshot cũ/offline và thời điểm tải. |
| Danh sách vé | Hai tab Tất cả vé/Đã lưu thay nút chuyển danh sách; khi offline khóa tab cần mạng và giải thích rõ. |
| Thông báo | Các switch gộp trong một nhóm, bỏ dòng Tùy chỉnh thông báo lặp. Giữ trạng thái chưa tải, lưu lỗi và hạn chế nhắc lịch trên thiết bị. |
| Phản ánh/hỗ trợ/hoàn tiền | Danh sách mở bằng hàng điều hướng, chọn bằng chứng có nhãn dung lượng, bỏ tệp bằng thao tác chữ. Rút ngắn ghi chú và giữ validation, lỗi, OTP, trạng thái server, lý do khóa. |
| Thành phần chung | `customer-controls.tsx`: MenuGroup/MenuRow/TextAction/Badge/Disclosure. Vùng chạm tối thiểu 48, hàng menu 56; text co giãn; role, expanded, busy, disabled và lý do được giữ. ActionFooter bỏ dòng Kết nối an toàn cố định. Unavailable dùng chữ phụ thay banner cảnh báo cho thiếu tính năng thông thường. |

Không sửa repository/API, backend, migration, package/framework, Staff hoặc dữ liệu Supabase. Không thêm runtime mock hay preview route. Chức năng chưa có contract tiếp tục khóa thao tác gửi. Các route callback và deep link không đổi.

## Kiểm tra và giới hạn

- Kiểm tra cuối: `pnpm --filter @event/mobile lint`, `typecheck` và `test` đều qua; Vitest **76/76**, **22 files**. `git diff --check` qua. Đây là kiểm thử logic, không thay kiểm thử component native.
- Expo Go trên Android `emulator-5554` đã tải bundle mới. Ghi nhận được màn danh sách đơn thật với hàng mở trực tiếp, màn chọn ghế và form người tham dự với bố cục/ghi chú mới. Đây là quan sát hiển thị, chưa kiểm chứng toàn bộ tương tác, bàn phím hoặc trạng thái của các màn đó.
- Máy ảo có thao tác điều hướng đồng thời; dừng điều khiển phiên đó để tránh can thiệp. Menu Profile mới, Search sau thay đổi cuối và các màn vé/hoàn tiền chưa được kiểm tra native đầy đủ trong lượt này.
- Chỉ thao tác xem trong QA; không gửi/hủy đơn, lưu hồ sơ, thanh toán, xác thực OTP hoặc upload để kiểm chứng UI. Không dùng sự thành công của thao tác từ người khác trên máy ảo làm bằng chứng kiểm thử.
- Metro QA chạy riêng cổng 8094, dùng API local cổng 5080 qua địa chỉ emulator; không sửa `.env.local` hoặc dừng Metro 8081 có trước. Bundler dùng CI để kiểm tra, nên cần reload/restart để nhận chỉnh sửa sau lần bundle đầu.
- Chưa kiểm tra iOS, màn hình nhỏ/font scale lớn, screen reader hoặc đầy đủ 79 frame. Không kết luận UI/UX hoàn thành kiểm chứng toàn bộ.

Lúc chốt kiểm tra sau khi tiếp tục, `adb devices` không còn thiết bị kết nối. Không mở lại hoặc nhận là đã kiểm tra thêm native sau thời điểm đó.
