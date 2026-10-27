# Customer mobile — kế hoạch hoàn thiện UX sau PR #37

Nguồn code: `origin/main` tại `cdadeb7`, tiếp tục trên `giaunh-cusmobile`. Phạm vi được người dùng duyệt: Customer và các component mobile dùng chung cần thiết. Giữ Auth/role, Staff, backend, migration và contract hiện có. Không runtime mock, giao dịch thử trên production hoặc phát hành app. Commit/push theo yêu cầu người dùng sau khi chốt kiểm tra.

## Kế hoạch

- [x] Rà Figma, source và môi trường; ghi vấn đề xác định được, không coi đề xuất là lỗi đã tái hiện.
- [x] Hoàn thiện điều hướng danh sách vé/đơn, trạng thái thanh toán và rà lựa chọn vé; giữ quyền quyết định trạng thái ở server.
- [x] Rà form hồ sơ, nội dung nháp và validation; giữ dữ liệu người dùng khi lỗi.
- [x] Thêm preview minh chứng, thông tin tệp và thao tác bỏ tệp; kiểm tra hợp lệ trước upload thật.
- [x] Làm rõ thông báo đã đọc/chưa đọc và thời gian; chỉ mở đích hợp lệ từ record.
- [x] Hoàn thiện form tài khoản nhận hoàn và OTP 8 ô một hàng, lỗi ở đúng trường; chỉ gửi khi server yêu cầu và OTP hợp lệ.
- [x] Kiểm tra màn nhỏ, chữ lớn, scroll/footer và accessibility của các màn có thể mở; sửa lỗi quan sát được. Giới hạn keyboard/E2E ghi dưới đây.
- [x] Chạy lint/typecheck/test và Android bundle; đã chạy Android Expo Go, ghi riêng các trạng thái chưa kiểm tra.
- [x] Cập nhật bảng đối chiếu 79 frame và bàn giao kết quả theo màn, phần đã kiểm tra và phần còn bị chặn.

## Không tự bật khi thiếu contract

QR chung cấp Booking và bộ đếm lượt quét; cổng thanh toán thật; mapping nhiều khu đứng; summary giá/địa điểm/timezone sự kiện; filter đơn trên server. Màn vẫn giữ cấu trúc và trạng thái trung thực, không mô phỏng thành công.

## Kết quả theo màn

| Màn/thành phần | Thay đổi | API / kiểm tra thực tế và giới hạn |
| --- | --- | --- |
| Home | Banner tăng chiều cao theo font scale; hàng tiêu đề và Xem tất cả được wrap khi thiếu chỗ; giữ rail 2,3 card | Catalog/categories thật, Android khoảng 393dp và 320dp/font 150%. Không thay thứ tự hoặc giá/ảnh từ server |
| Search | Placeholder ngắn, một dòng; giữ xóa từ khóa và bàn phím tìm kiếm | Native với catalog thật, tìm từ khóa không có kết quả; không đổi filter contract |
| Chọn suất/chỗ | Thu gọn thông báo về thanh toán; giữ chọn khu, các guard giá/kho và footer hiện có | Native mở lịch và khu ghế thật ở 320dp/font 150%; chưa tạo booking, chưa thử conflict/standing hợp lệ hoặc đo hiệu năng renderer |
| Vé của tôi | Tab nằm trong URL để giữ ngữ cảnh; tự cuộn tab đang chọn vào tầm nhìn; bản lưu có thời điểm cập nhật | GET bookings và cache cũ; native mở Tất cả đơn với record EXPIRED thật. Chưa có vé phát hành/bản lưu để kiểm tra data branch |
| Offline | Link theo booking chỉ hiển thị snapshot thuộc đơn đó; giữ phân tách tài khoản và kiểm tra hiệu lực khi online | Không tạo snapshot/QR giả. Thay đổi đã dựng nhưng chưa kiểm tra runtime với snapshot thật |
| Chi tiết giao dịch | Bỏ thông báo cấm thanh toán lại vô điều kiện; cho tiếp tục đúng canPay và gate khả dụng; giữ refresh/hỗ trợ | getBooking cũ. Đã dựng nhưng chưa kiểm tra runtime nhánh PAYMENT_PENDING/thanh toán thật; không bật TEST checkout |
| Hồ sơ | Khóa nhập trước khi tải được profile hoặc khi đang gửi; Next từ tên sang điện thoại; trim trước gửi; email chỉ đọc và có thể chọn/copy | GET profile thật và native focus sang điện thoại. Không lưu hồ sơ; chưa kiểm tra lỗi PUT hoặc keyboard đầy đủ trên mọi thiết bị |
| Phản ánh | Preview ảnh cục bộ, modal xem ảnh/Back, tên/kích thước/PDF, bỏ tệp; kiểm MIME/10 MB trước upload; khóa gửi khi picker đang mở; đổi vé vẫn giữ form; khóa selector vé rỗng | Native: danh sách vé thực tế rỗng, picker thật chọn ảnh chụp QA, thumbnail/modal/Back/bỏ tệp. Không upload hoặc gửi report; chưa runtime nhánh report thành công/lỗi server |
| Thông báo | Ngày Hôm nay/Hôm qua/Trước đó và giờ gọn; dấu chưa đọc; không biến record thiếu đích thành nút điều hướng rỗng | Native empty thật. Nhánh có notification/chuyển read chưa runtime; unit tests cover ngày và đích hợp lệ |
| Ngân hàng nhận hoàn | Lỗi từng trường theo schema cũ; xử lý khoảng trắng khi paste số tài khoản nhưng giữ số 0 đầu, không bỏ chữ sai; Next giữa fields; chỉ nhập/gửi đúng trạng thái server | Chưa có record AWAITING_BANK_INFO để kiểm tra native; đã dựng nhưng chưa kiểm tra runtime; không tạo danh sách ngân hàng giả |
| OTP | Giữ email từ context và 8 ô một hàng; Next/Done bàn phím; thông báo khóa theo nguyên nhân riêng, không gộp mọi trường hợp | Native thấy đủ 8 ô cùng tọa độ Y ở 320dp/font 150% trên Auth verify thiếu email nên bị khóa. Chưa kiểm tra native autofill/nhập mã hoặc gửi/verify thật; logic nhập/paste/backspace có unit tests |
| Component chung trong mobile | Field nhận inputRef theo cách additive; Button giữ tên accessibility khi busy; lỗi rate limit có thông báo người dùng | Không đổi Auth/role/provider hoặc API; Staff tiếp tục dùng component cũ tương thích |

## Figma và assets

Đã đọc lại design context và screenshot của `1:2340` (report), `1:2270` (bank), `1:2310` (OTP), `1:2490` (notifications), `1:2564` (profile edit). Giữ Material, token, font và icon đã có; các điều chỉnh UX theo yêu cầu mới không thay Figma.

Screenshot native phát hiện icon upload đang tham chiếu nhầm ảnh chuông. Đã thay bằng SVG gốc từ frame report (`Icon/upload`, component `1:284`), file `assets/figma/1-2340-upload.svg`, 24×24, 701 byte; cập nhật provenance trong `sources.json`. Không chỉnh path SVG hoặc dùng screenshot Figma làm ảnh runtime.

## Kiểm tra và môi trường

- Mobile lint/typecheck qua; Vitest **115/115**, 32 files. Tám tests mới về MIME/size minh chứng, ngày thông báo và dữ liệu ngân hàng; fixture chỉ phục vụ test.
- Trước commit/push đã chạy `pnpm lint`, `pnpm typecheck`, `pnpm test` toàn workspace và build Portal: đều qua. Turbo dùng cache cho phần ngoài mobile không thay đổi; UI Kit chưa có test. Portal còn cảnh báo chunk lớn hơn 500 kB. Backend/build source không đổi so với lần 212 tests và Release build đã qua tại `75a2467`, không chạy lại .NET trong lượt commit này. Docker image/pgTAP chưa chạy cục bộ vì thiếu Docker/Supabase CLI; không tuyên bố toàn bộ CI đã xanh.
- Android export bản cuối qua: 2.760 modules, 62 assets, có SVG upload gốc mới; đây là bundle, không thay cho các kiểm tra native nêu trong bảng. Không sửa dependency, lockfile hoặc cấu hình framework.
- Native: Android emulator Pixel_5 + Expo Go 57.0.9; màn 1080px ở density 440 (khoảng 393dp), sau đó density 540 (320dp) và font scale 1.5. Screenshot/XML nằm trong `.expo/customer-ux-qa/`, được ignore, có dữ liệu cá nhân nên không commit.
- API QA riêng tại 5082 với **cả** `--Payments:Gateway=` và `--Qr:SigningKey=` để tắt payment job và issuer; chỉ đọc. Metro QA tại 8097. Không đổi `.env.local`, backend source/config hoặc dịch vụ của người dùng. `--localhost` ban đầu chỉ bind IPv6, đã chạy QA bằng LAN bind và địa chỉ packager loopback để Android reverse kết nối được.
- Đã khôi phục density/font scale của máy ảo, bỏ tệp QA khỏi draft/Downloads và dừng đúng emulator, API 5082, Metro 8097 do lượt này tạo; artifacts vẫn nằm trong thư mục ignore để xem lại.
- Không tạo/hủy/thanh toán booking, đổi profile, gửi mail/OTP, mark-read, upload, report hoặc bank-info. Ảnh QA dùng trong picker là ảnh chụp app tại máy ảo, đã bỏ khỏi draft; không trở thành dữ liệu nghiệp vụ.
- Phát hiện tên zone trên server còn tiền tố DEMO; không sửa dữ liệu production hoặc che tên bằng dữ liệu client. Cần nhóm xử lý dữ liệu riêng nếu muốn đổi tên.
- Chưa iOS, screen reader, keyboard/autofill trên thiết bị thật, luồng hỗ trợ có messages thật, thanh toán/hoàn tiền/phát vé E2E, native PAID/CONFIRMED/PAYMENT_PENDING, lỗi quyền/mạng của mọi form, hoặc toàn bộ 79 frame. Không kết luận UI/UX toàn section đã được kiểm chứng hoàn chỉnh.
