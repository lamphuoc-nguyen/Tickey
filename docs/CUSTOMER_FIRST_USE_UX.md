# Customer — UX cho người dùng lần đầu

Phạm vi: Customer trong `apps/mobile`, tiếp nối commit `75e6527`. Không sửa Staff, Auth provider/role, backend, migration, package chung hoặc dữ liệu nghiệp vụ. Commit/push theo yêu cầu đồng bộ của người dùng ngày 28/10/2026.

## Đồng bộ main ngày 28/10/2026

- Nhập `origin/main` tại `75a2467` bằng fast-forward, giữ toàn bộ UX cục bộ bằng stash dự phòng trước khi khôi phục.
- Kết hợp C-01 với thẻ trạng thái gọn: `PAYMENT_PENDING` còn hạn cho mở lại bước thanh toán; hết thời gian hiển thị vẫn chờ kết quả server và cho kiểm tra lại. Giữ CTA khám phá cho đơn `EXPIRED`/`CANCELLED`.
- Giữ backoff polling từ main và quy tắc chỉ `PENDING` mới được hủy. Gateway mô phỏng hoặc chưa khả dụng vẫn bị chặn bởi guard hiện có; không coi việc nhập code là thanh toán thật đã sẵn sàng.
- Không chạy API/worker, migration, seed hoặc thao tác ghi vào hosted project trong lượt đồng bộ này.

| Kiểm tra sau đồng bộ | Kết quả |
| --- | --- |
| `pnpm install --frozen-lockfile` | Qua, dùng lockfile từ main; không nâng dependency |
| `pnpm lint` / `pnpm typecheck` | Qua toàn workspace |
| `pnpm test` | Mobile 107, Core 74, Portal 38, Agent Manager 17 và Seat Map 8 đều qua; UI Kit chưa có test, Seat Map dùng cache |
| `pnpm --filter @event/portal build` | Qua; có cảnh báo kích thước chunk lớn hơn 500 kB |
| `dotnet test --solution backend/EventPlatform.sln` | 212/212 qua, không skip |
| `dotnet build --configuration Release backend/EventPlatform.sln` | Qua, 0 warning / 0 error |
| Android Expo export | Qua, 2.756 modules / 61 assets; bundle cục bộ, chưa chạy lại native sau đồng bộ |
| Docker image / pgTAP | Chưa chạy: máy chưa có Docker và Supabase CLI; cần kiểm tra bằng CI hoặc stack local phù hợp |

Kiểm tra native/web của lượt UX trước được ghi riêng ở dưới; không dùng kết quả đó để tuyên bố đã kiểm tra runtime của C-01 sau đồng bộ.

## Các thay đổi

| Màn | Hành vi mới | Dữ liệu và giới hạn |
| --- | --- | --- |
| Home | Tiêu đề gọn, trung tính; tối đa 5 banner nổi bật; một banner không cần chấm điều hướng; dãy Khám phá thêm giữ 2,3 card và không lặp banner | Catalog thật, giữ thứ tự server và pagination; không tự xếp hạng bán chạy hoặc gọi tất cả là sự kiện cuối tuần |
| Card sự kiện | Tên tối đa 2 dòng, ngày diễn sắp tới nếu có, cả card mở chi tiết | Ngày từ session summary; bỏ lịch hủy/hoãn/kết thúc và ngày đã qua khi tìm ngày tiếp theo. Ngày hiển thị không khẳng định đang bán. Catalog chưa có venue/min-price tổng hợp nên không dựng địa điểm/giá giả |
| Search | Một ô tìm kiếm có nút xóa từ khóa, category vuốt ngang; filter chưa hỗ trợ nằm trong Bộ lọc khác | q/category và debounce, draft cũ được giữ; filter thời gian/địa điểm vẫn khóa và giải thích khi mở |
| Sự kiện | Một CTA Đặt vé hoặc Xem lịch diễn; ngày giờ và venue thật ở đầu; có liên kết tất cả lịch khi nhiều suất | Ưu tiên suất đang bán, theo ngày giờ; không lấy giá suất đầu làm giá toàn sự kiện. Thiếu lịch/lỗi tải có trạng thái riêng |
| Ngày và giờ | Suất đang bán ở phần chính; lựa chọn rõ; suất hủy/hoãn/chưa mở/đóng nằm trong Lịch diễn khác | Phân loại bằng status và salesPaused thực; không tự đổi trạng thái bằng đồng hồ client |
| Ghế/khu đứng | Footer hiện số chỗ đã chọn và tiền tạm tính; nút Tiếp tục/Đăng ký miễn phí; khu đứng dùng nút tăng giảm; chú thích ghế chi tiết được thu gọn | Giữ guard tồn kho/hạng vé/sale window/conflict/idempotency. Mapping khu đứng chưa đủ vẫn khóa; không vẽ hướng sân khấu khi layout không cung cấp |
| Thanh toán chưa sẵn sàng | Báo ở bước ngày giờ và chọn vé; chặn tạo ý định mới cho vé trả phí khi cấu hình chưa hỗ trợ thanh toán | Không chặn replay một yêu cầu đã gửi mà mất phản hồi. Vé FREE giữ flow server phát hành. Gateway TEST bị chặn trong UI và payment hook vì là thanh toán mô phỏng; tên gateway không xuất hiện trên UI |
| Kiểm tra đơn | Tổng tiền server và số chỗ luôn hiện; ghế/hạng trong mục mở rộng, người mua chỉ đọc; P1 trong Tùy chọn khác | Không nhập tên từng người. Không tính lại giá server, không gửi holder. Các form P1 và route cũ còn nguyên |
| Trạng thái đơn | Một thẻ trạng thái gọn; không lặp icon/badge lớn. Đơn hết hạn/hủy có CTA khám phá; countdown hết vẫn cho kiểm tra lại trạng thái | PAYMENT_PENDING và PAID giữ nguyên nghĩa chờ server. Không tự EXPIRED, CONFIRMED hoặc báo đã hoàn tiền |
| Vé của tôi | `/orders` và `/tickets` dùng chung TicketHubScreen; mặc định Vé đã mua; Đang xử lý, Tất cả đơn, Đã lưu ở cùng màn | List order thật; CONFIRMED/PARTIALLY_REFUNDED mở vé theo đơn; PAID còn nằm trong đang xử lý. Filter trên các trang đã tải, có load more, không coi lỗi là rỗng |
| Offline | Mục Đã lưu mở snapshot theo booking; mất mạng chuyển sang bản lưu với giải thích rõ | Cache/generation/account guards cũ được giữ; không fallback cache để che lỗi online. Không suy ra hiệu lực hoặc số lượt quét |
| Chi tiết vé | Số chỗ ở cạnh vùng QR; lượt sử dụng chưa có dữ liệu đưa vào mục mở rộng, ghế/hạng vẫn mở được | QR chung chưa có contract nên vẫn chưa khả dụng; không dùng credential riêng của Ticket để tạo QR dùng nhiều lượt |

## Contract còn thiếu

- QR cấp Booking, encoding và lượt check-in do server quản lý; không sửa decoder Staff.
- Giá thấp nhất và venue ở cấp sự kiện; timezone của session summary trong catalog. Card ngày hiện dùng timezone mặc định hiện có của app, chưa có timezone riêng từ summary.
- Trạng thái gateway khả dụng từ server. Guard thanh toán hiện chỉ kiểm tra capability/cấu hình client, không chứng minh adapter hoặc giao dịch live đã hoạt động.
- Filter order theo trạng thái ở server; hiện chỉ lọc các trang đã tải. Multi-zone standing giữ nguyên giới hạn mapping.

Tab Vé của tôi mặc định mở vé đã mua. Các liên kết Đơn của tôi/Kiểm tra đơn và callback thanh toán thiếu ID hợp lệ dùng `/orders?view=all`, để không che mất đơn pending/hết hạn. Callback có UUID hợp lệ tiếp tục mở booking và hỏi server; không suy ra thành công từ URL.

## Kiểm chứng

| Kiểm tra | Kết quả và giới hạn |
| --- | --- |
| Chốt source sau khi tiếp tục | `pnpm --filter @event/mobile lint` không lỗi/warning; typecheck qua; `git diff --check` qua; giữ đúng 79 ID frame theo thứ tự gốc |
| Mobile logic tests | 105/105 tests, 29 files; thêm 9 tests về banner/date/session, gateway mô phỏng và phân loại đơn. Callback hợp lệ giữ route booking; callback không hợp lệ mở toàn bộ đơn, không suy ra thành công |
| Android export bản cuối | Qua: Hermes, 2.756 modules, 61 assets. Đây là build bundle, không phải kiểm chứng native của mọi trạng thái |
| Web public, 26/10/2026 | 39 trường hợp chính và 13 bổ sung trên dữ liệu catalog thật. Home 320/360/390, Search 320/390, event/session/selection/venue, guest guards và auth. Không ghi nhận JS exception/console error, response HTTP lỗi hoặc tràn ngang. Có 164 + 62 request `ERR_ABORTED` trong lượt chuyển trang; không gọi đó là kiểm tra mạng hoàn chỉnh |
| Android Expo Go, 26/10/2026 | Đã quan sát Home mới, chuyển tab Vé của tôi, empty Vé đã mua/Đang xử lý, Tất cả đơn có một record EXPIRED thật, mở đơn và kiểm tra summary/CTA gọn. Không suy ra các trạng thái đơn khác đã chạy chỉ từ việc chúng có code |
| Điều khiển khu đứng | Đã dựng nút tăng/giảm và guard số lượng. Không tìm thấy suất FREE một khu đứng đủ contract trong dữ liệu hiện có để kiểm tra thao tác tăng/giảm hợp lệ; không tạo record thay thế |
| Không ghi dữ liệu nghiệp vụ trong QA | Không tạo/hủy/thanh toán booking, không upload hoặc phát hành vé. Browser chặn method ngoài GET/HEAD/OPTIONS, không phát sinh request ghi bị chặn. API QA riêng tắt issuer bằng `--Qr:SigningKey=`; không đổi backend người dùng đang chạy |
| Chưa kiểm tra đầy đủ | Native 320px/font lớn/keyboard của ô Search mới, mua vé miễn phí, PAYMENT_PENDING/PAID/CONFIRMED, gateway thật/return E2E, QR chung, dữ liệu vé đã lưu và hiệu lực offline. Các màn cần dữ liệu này là **đã dựng nhưng chưa kiểm tra runtime bằng dữ liệu thật** |

Test fixtures chỉ nằm trong unit tests. Không tạo đơn/vé hoặc mô phỏng trạng thái để chụp màn hình. Bảng 79 frame giữ nguyên ID và đường dẫn công khai, cập nhật component/state tương ứng; không sửa Figma. Web và Android export không thay thế kiểm tra native; không kết luận toàn bộ 79 frame đã được kiểm chứng hoàn chỉnh.
