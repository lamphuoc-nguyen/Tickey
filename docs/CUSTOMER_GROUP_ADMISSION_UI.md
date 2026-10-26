# Customer — luồng mua gọn và vé theo đơn

Phạm vi được người dùng duyệt: chỉ UI/UX Customer Mobile. Bỏ nhập tên từng người, lấy người mua từ tài khoản và thiết kế một mã vào cổng theo đơn. Không sửa backend, migration, Staff, Portal hoặc packages chung; không ghi dữ liệu production, không commit/push trong lượt này.

## Luồng mới

Chọn sự kiện → Chọn suất/chỗ/số lượng → Kiểm tra đơn → Thanh toán → Vé vào cổng của đơn. Vé miễn phí giữ luồng server phát hành; PAID tiếp tục hiện đang phát hành, không tự chuyển CONFIRMED.

- Không còn form tên/email từng người trong vé miễn phí, bước trước thanh toán hoặc chi tiết vé.
- BuyerInfo chỉ đọc hồ sơ hiện tại và email phiên tài khoản. Lỗi tải hồ sơ có retry; thiếu tên không biến thành yêu cầu nhập tên khi mua và không lấy holder_name của vé làm người mua.
- `/booking/[bookingId]/holder` vẫn mở màn thanh toán cho link cũ. `/tickets/[ticketId]/holder` mở màn vé theo đơn; không gán tên.
- Danh sách vé gom theo Booking. Chi tiết cũ theo ticketId tải các vé cùng đơn rồi hiển thị chung, bỏ carousel/next-ticket. Kết quả đặt vé `/booking/[bookingId]/result` là điểm mở vé chung theo đơn.

## Theo màn

| Màn | UI/UX đã sửa | Dữ liệu/thao tác hiện có | Giới hạn |
| --- | --- | --- | --- |
| Home | Giữ khoảng 2,3 card, canh chiều cao tên/CTA; banner giới hạn 2 dòng để không cắt link | Catalog/categories/events thật | Không điền ảnh/giá thiếu bằng dữ liệu giả |
| Tìm kiếm | Chip vuốt ngang, chọn rõ, xóa bộ lọc; tên sự kiện tối đa 2 dòng | q/category và pagination cũ | Filter thời gian/địa điểm vẫn khóa |
| Sự kiện | Ưu tiên thông tin suất đang bán; organizer chưa có nằm trong mục mở rộng | Event/sessions cũ | Không suy diễn tên tổ chức, giá tối thiểu hoặc cổng |
| Chọn suất | CTA Chọn chỗ gọn; phân biệt đang bán/đóng/hoãn/hủy/đang diễn ra | Session status từ server | Không tự sửa trạng thái suất theo UI |
| Ghế/khu đứng | Danh sách hạng và lịch bán mở rộng khi cần, không banner dài; giá chưa xác định không hiện 0đ | Layout/availability/pricing/ticket types và booking hook cũ | Multi-zone thiếu mapping vẫn khóa; không nhập tên cho vé miễn phí |
| Kiểm tra đơn | Summary gọn, người mua chỉ đọc, CTA thẳng thanh toán | get_booking/cancel_booking hiện có | Hủy vẫn chỉ PENDING, countdown giữ server anchor |
| Thanh toán | Summary gọn, người mua sẵn có, lỗi tải trạng thái chặn checkout | HttpPaymentApi/capability/return cũ | Không bật gateway mới hoặc mô phỏng thanh toán |
| Đơn của tôi | Badge trạng thái, bộ lọc Tất cả/Đang xử lý/Đã phát hành | Order list thật, phân trang | Filter trên các đơn đã tải; có thể tải thêm để tìm đơn cũ |
| Vé theo đơn | Một vùng mã vào cổng, số chỗ từ đơn; ghế/hạng nằm trong disclosure | get_booking, order lookup, bookingTickets qua wrapper cũ | QR chung chưa khả dụng, check-in/còn lại hiện — |
| Danh sách vé | Một card cho một Booking, tab Theo đơn/Đã lưu | Ticket list thật được gom/dedupe ở tầng hiển thị | Không coi số record của một trang là tổng sức chứa đơn |
| Offline | Gom snapshot theo đơn, mở ngay mục đã chọn, mốc cập nhật bảo thủ | Lưu các Ticket thật bằng TicketCache cũ, theo account/generation | Số chỗ đã lưu khác tổng lượt vào cổng; không có QR giả hoặc counter client |

## Contract chưa có — không bù bằng frontend

Hiện Ticket trả credential riêng `{kid, payload, signature}`. Booking/Order không trả credential dùng nhiều lượt hoặc bộ đếm cấp đơn. UI không lấy QR của một Ticket, nối các credential hoặc ký envelope để giả QR chung. Backend/Staff cần chốt:

- Credential cấp theo Booking, encoding và quy tắc hiệu lực theo session/zone/gate.
- Tổng lượt hợp lệ, đã sử dụng và còn lại được server trả về; không suy ra từ số Ticket USED hay từ cache.
- Check-in nguyên tử, chống trừ lặp/retry và xử lý nhiều máy quét; camera không tự tiêu hết lượt khi liên tục đọc cùng mã.
- Điều chỉnh khi hủy/hoàn một phần và chọn chỗ nào được sử dụng trong mỗi lần check-in.

UI hiển thị số chỗ mua từ Booking.itemCount/Order.itemCount. Nếu chỉ có snapshot hoặc một phần danh sách, chỉ ghi số chỗ đã tải/đã lưu. Lượt check-in/còn lại luôn là chưa có thông tin trong phiên bản này. Khi PAID/PAYMENT_PENDING/hủy/hết hạn, hiển thị trạng thái server thay vì trình bày mã vào cổng như đã sẵn sàng.

## Offline và liên kết

Không đổi định dạng TicketCache hoặc nới offline/account/role guards. Lưu đơn chỉ lưu các phản hồi Ticket thật của cùng Booking; cache tiếp tục chặn ghi muộn khi đổi tài khoản. Nếu lưu bị ngắt, các record đã lưu vẫn được ghi là chỗ đã lưu, không khẳng định đủ đơn. Mốc cập nhật nhóm dùng thời điểm cũ nhất, không tự lấy giờ hiện tại để nói dữ liệu mới. QR chung chưa được server cấp nên bản offline cũng chỉ có vùng chưa khả dụng.

Giữ nguyên ID của [79 frame](CUSTOMER_FRAME_MATRIX.md). Frame nhập tên/next-ticket trong prototype được đối chiếu là đã thay flow theo yêu cầu mới; không sửa Figma.

## Kiểm tra

Kiểm tra ngày 26/10/2026 trên bản sửa cuối:

| Kiểm tra | Kết quả thực tế |
| --- | --- |
| `pnpm --filter @event/mobile lint` | Qua, không lỗi hoặc warning sau khi gộp import trùng |
| `pnpm --filter @event/mobile typecheck` | Qua |
| `pnpm --filter @event/mobile test` | 96/96 tests, 26 files; gồm 6 tests mới về gom đơn, dedupe, cô lập booking, timestamp offline và trạng thái phát hành |
| `git diff --check` | Qua |
| Kiểm tra CI trước commit | `pnpm lint`, `pnpm typecheck`, `pnpm test` và Portal build đều qua. TypeScript: Mobile 96, Core 73, Portal 22, Seat-map 8 tests; ui-kit chưa có test. Một số task package dùng cache Turbo. Portal build có cảnh báo bundle trên 500 kB |
| Backend CI cục bộ | `dotnet test --solution backend/EventPlatform.sln`: 174/174, không skip; output tách trong `.turbo` để không đụng backend đang chạy |
| Database CI | Chưa chạy pgTAP vì máy chưa có Docker/Supabase CLI; không chạy lệnh database trên hosted project |
| Expo export Android | Qua trên source cuối: Hermes, 2.747 modules, 61 assets. Chỉ build bundle, không phải chạy native |
| Web Edge headless + API local | 39 trường hợp route/kích thước; Home 320/360/390, Search 320/390, auth/guest guards và event/session/selection/venue trên dữ liệu catalog thật. Không phát hiện tràn ngang, JS exception/console error hoặc HTTP response lỗi. Có 164 request bị hủy (`ERR_ABORTED`) trong lượt điều hướng, không coi là kết quả kiểm chứng mạng hoàn chỉnh |
| Ràng buộc không ghi production | Trình duyệt chặn method ngoài GET/HEAD/OPTIONS; không phát sinh request ghi bị chặn. API kiểm tra chạy với `--Qr:SigningKey=` để không khởi động worker phát hành vé. Không đăng nhập, tạo/hủy/thanh toán đơn hay upload trong QA |
| Native runtime và đơn/vé thật | Chưa kiểm tra giao diện vé theo đơn bằng dữ liệu thật. Trong lượt xử lý kết nối sau đó đã tìm được Android Emulator/ADB đang chạy; chưa có phiên tài khoản/đơn phù hợp để kiểm tra các màn được bảo vệ |

Unit fixtures chỉ dùng trong tests; không có mock/preview route hoặc record nghiệp vụ mẫu được đưa vào app. Kiểm tra web chỉ mở phần chọn khu vực mặc định; chưa kiểm chứng toàn bộ thao tác seat map, bàn phím/gesture native, buyer profile, thanh toán, lưu đơn offline hoặc QR với dữ liệu thật. Các màn cần đơn/vé/tài khoản thật là **đã dựng nhưng chưa kiểm tra runtime bằng dữ liệu thật**. Web/export bundle không thay kiểm tra native; không kết luận toàn bộ 79 frame đã kiểm chứng hoàn chỉnh.
