# Customer mobile — đối chiếu backend và kiểm tra 21/10/2026

Phạm vi: Customer trong `apps/mobile` và client dùng chung trong `packages/core`. Giữ một app, một phiên đăng nhập và phân giao diện từ membership server; không có nút chuyển role. Không sửa Staff, Portal, backend, migration, Figma hoặc danh sách phân công trong lần rà soát này. Commit/push lên nhánh giaunh-cusmobile theo yêu cầu người dùng; không merge/deploy/phát hành.

Nhóm chưa có staging. Chỉ gọi GET công khai qua API cục bộ tới Supabase nhóm; không đăng nhập, gửi email, tạo đơn, thanh toán, upload hoặc chạy Workers trên hosted PRODUCTION. Các HTTP giả lập bên dưới chỉ thuộc kiểm thử, không được nối vào app.

## Contract và kết quả đối chiếu

| Màn/flow | Contract hiện có và tích hợp | UI/hành vi sau rà soát | Phần còn thiếu / kiểm tra chưa thực hiện |
| --- | --- | --- | --- |
| Auth/workspace | SupabaseAuthRepository; list_my_workspaces, set_active_workspace + refreshSession | Một login/register/recovery; STAFF hợp lệ được ưu tiên theo quy tắc sản phẩm; không chọn role. Loading/lỗi membership không trở thành Customer. | Chưa đăng nhập hoặc gửi email trên hosted. Backend vẫn cho mọi tài khoản kích hoạt CUSTOMER; phân loại mobile độc quyền còn cần BE chốt. |
| Home/Search | GET categories/events; q/category/featured/limit/offset | Card Search chọn sự kiện rồi tiếp tục; có trạng thái chọn/accessibility. Bộ lọc chưa hỗ trợ có lý do, không giả kết quả. | GET thật trả `[]`; không có sự kiện công khai để mở detail/session. Không suy ra database hoàn toàn không có sự kiện. |
| Event/Session | GET event detail/sessions, session ticket-types/layout/availability/seat-pricing | Giữ chọn suất; session lỗi được hiển thị và retry trong chọn chỗ. | Chưa kiểm tra native bằng event/session thật. Summary venue/min price/artist và các filter nâng cao còn thiếu. |
| Chọn ghế/xung đột | LayoutData/SeatState và RPC pricing thật; create_booking cũ | Hiện panel vé đã chọn, bỏ từng ghế; giữ ghế qua đổi khu ngồi. Ghế thiếu mapping không bị âm thầm bỏ khỏi payload. Chặn chuyển sang đặt khu đứng khi vẫn còn ghế được chọn. Kiểm tra quantity nguyên dương, ghế trùng và giới hạn. | Chưa đo native gestures/performance hoặc chạy xung đột thật. SELECTED/CONFLICT chỉ là UI. |
| Khu đứng | Ticket type/inventory/zone thật | Liệt kê khu thật; thiếu mapping nhiều khu thì khóa đặt với lý do. | Chưa có ticket_type_zones mapping đủ để xác định hạng vé cho từng khu; không dùng khu/type đầu tiên. |
| Booking/hold/hủy | SupabaseBookingRepository: create/get/cancel_booking | retry:false, giữ idempotency key cho cùng intent; không nhận kết quả muộn vào tài khoản/workspace khác. Hủy chỉ PENDING; countdown không tự hết hạn PAYMENT_PENDING. | Chưa tạo/hủy đơn thật vì chưa có staging. |
| PAID/CONFIRMED/vé miễn phí | get_booking, GET tickets; IssueTicketsWorker hiện có | Chỉ tải danh sách vé theo booking khi CONFIRMED, tránh cache danh sách rỗng trong lúc PAID rồi không tải lại khi vé được phát. PAID vẫn “Đang phát hành vé”. | Chưa chạy worker hoặc free issuance thật; API không tự hosting Workers. |
| Thanh toán/return | HttpPaymentApi POST /payments/sessions; PaymentSession riêng; callback eventcustomer://payment-result | Giữ UI và capability gate khóa checkout; return chỉ điều hướng rồi đọc trạng thái server. | UnconfiguredPaymentGateway vẫn ném lỗi; chưa có gateway/attempt receipt/reconcile hoàn chỉnh. Không bật chỉ vì có biến env. |
| Đơn/vé/QR | GET bookings/tickets/detail, snapshot tài khoản | Một vé một vùng QR; giữ “Mã QR chưa khả dụng”; không tự tạo encoding từ object credential. | `{kid,payload,signature}` chưa có wire encoding thống nhất với Staff decoder; chưa kiểm tra vé/đơn native thật. |
| Vé offline | Cache thật có namespace tài khoản, last-account và chống ghi muộn | Khi mất mạng chỉ cho mở `/tickets/offline` để đọc snapshot, nếu không biết có quyền Staff/không có lỗi từ chối quyền. Query local chạy cả khi offline; có thời điểm cập nhật và nút kiểm tra server khi online. | Không dùng snapshot xác nhận hiệu lực vé hay cấp quyền server. Không thể biết quyền bị thay đổi khi hoàn toàn offline. Chưa chạy native bằng snapshot thật hoặc đổi tài khoản thật. |
| Hồ sơ/preferences/notifications | GET/PUT me; preferences qua core/RLS; history/read | Khi sửa switch, xóa trạng thái “đã lưu” cũ; chỉ response lưu mới báo thành công. | Push delivery/notification Workers chưa hoàn chỉnh; chưa chạy permission/tap/scheduling native. Expo Go Android vẫn dùng loader chặn SDK entry lỗi. |
| Holder | PUT ticket holder → assign_ticket_holder | Bổ sung lỗi kiểm tra số điện thoại trên form. Holder trước payment vẫn local và thông báo chưa gửi. | Server chỉ gán lần đầu cho ISSUED; không suy ra contract lưu người tham dự trước booking. |
| Hoàn tiền/bank OTP | GET refunds; POST bank-info; email OTP | Verify thành công rồi bank request lỗi mạng: thử lại bank bằng phiên đã xác thực, không tiêu thụ lại OTP một lần. Server OTP_REQUIRED buộc xác thực lại. Trạng thái xác thực giới hạn account/refund. | Chỉ AWAITING_BANK_INFO được gửi; REFUND_PENDING chưa phải đã hoàn. Chưa gọi bank/OTP hosted. Refund worker và request refund P1 chưa đủ contract. |
| Report/evidence | GET tickets, POST reports, upload REPORT_EVIDENCE | Form chọn vé thật, loading/error/empty/pagination; giữ nội dung và file khi chọn vé. Kiểm tra scope trước từng upload và trước gửi, không tiếp tục nhiều bước dưới tài khoản khác. | Chưa upload/gửi thật. Supplement/case history/replies chưa có contract Customer. |
| Hỗ trợ | Support list/create/messages | Wrapper thật, form/validation/lỗi/retry và CLOSED khóa gửi được giữ. | Chưa gửi yêu cầu/tin nhắn thật. |
| Business/invoice/audience/refund request và kết quả P1 | Chưa đủ contract | Giữ màn/form theo bảng 79 frame; hành động gửi khóa có lý do; không tạo link giả tới kết quả thành công. | Cần contract và dữ liệu server trước khi kích hoạt; các màn cần record thật đã dựng nhưng chưa kiểm tra runtime. |

Đọc CatalogEndpoints, BookingEndpoints, AccountEndpoints, AuthEndpoints, SupportEndpoints, UploadEndpoints, PaymentEndpoints, core wrappers, SQL/RPC liên quan và Workers. Request thông thường camelCase, database response snake_case có Zod/mapper; PaymentSession camelCase riêng. Phân trang limit/offset được giữ.

`HttpClient` trước đây đổi mọi HTTP 403 thành FORBIDDEN, làm mất OTP_REQUIRED/MFA_REQUIRED/DEVICE_REVOKED. Nay ưu tiên đọc message/details hợp lệ rồi mới fallback status. Thêm timeout 20 giây cho request REST, vẫn truyền hủy từ Query; thông báo lỗi dùng tiếng Việt, không đưa endpoint/code kỹ thuật vào UI. Constructor thêm timeout tùy chọn tương thích cách gọi cũ và không dùng TypeScript parameter property, để Portal vẫn typecheck với erasableSyntaxOnly.

Các mutation nghiệp vụ kiểm tra lại session trước request và sau response; request nhiều bước có checkpoint. Thay đổi user/workspace không được báo thành công vào màn hiện tại hoặc tiếp tục upload dưới tài khoản mới. Đây không phải rollback: request đã được server chấp nhận trước khi đổi phiên vẫn phải được kiểm tra trong đúng tài khoản. Auth mutations được tách vì bản thân thao tác đó thay đổi phiên. Lock ngăn gửi lặp và idempotency server vẫn giữ nguyên.

## Kiểm tra thực tế

| Kiểm tra | Kết quả / bằng chứng |
| --- | --- |
| Dependencies | `pnpm install --frozen-lockfile` thành công, lockfile không đổi; không nâng framework. |
| Mobile | Lint/typecheck qua; Vitest **76/76**, 22 files: thêm quantity/seat mapping, offline access, bank OTP retry và scoped requests. Đây là test logic, không phải native component test. |
| Core | Typecheck qua; Vitest **61/61**, 10 files; thêm 403 business code/details, timeout và hủy request. |
| Shared/Portal | Seat-map **8/8**, 3 files; Core/seat-map/ui-kit và Portal typecheck qua. Không sửa Portal. |
| Backend | Build test project thành công, 0 warnings/errors; Microsoft Testing Platform **81/81**, 0 failed/skipped. HTTP upstream dùng FakeHttpHandler trong tests, không ghi hosted. |
| Đọc thật qua backend | Development API tại cổng QA 5091: GET /health **200**, GET /api/categories **200 []**, GET /api/events?limit=2&offset=0 **200 []**. Log xác nhận upstream Supabase nhóm; đây chỉ là read check, không chứng minh endpoint ghi/worker hoạt động. |
| Android phiên này | AVD TickeyMobileQA riêng, Android 36/Expo Go; chạy Home → Search, thấy network timeout + retry thật do URL LAN hiện không kết nối; direct Staff guest bị chặn, có login chung. Đã xem screenshot/hierarchy Home/Search và đối chiếu Figma Search/selection. |
| Giới hạn native | System UI ban đầu treo, sau Wait chạy được; sau đó Windows báo thiếu tài nguyên (CreateProcess 1455), ADB mất kết nối. Đã dừng AVD QA, API QA và Metro QA. Chưa kiểm tra lại native sau lần thu gọn filter cuối; chưa kiểm tra empty native bằng API QA, login/callback/payment lần này hoặc bất kỳ màn cần record thật. Các kiểm tra của migration trước vẫn được ghi riêng ở MOBILE_ARCHITECTURE.md. |

Không dùng web/export hoặc unit fixtures để tuyên bố hoàn thành native/E2E. Bảng [79 frame](CUSTOMER_FRAME_MATRIX.md) giữ nguyên coverage, route và trạng thái từng màn; những màn cần đơn/vé/sự kiện thật **đã dựng nhưng chưa kiểm tra runtime**. Chưa thể kết luận toàn bộ UI/UX Customer đã hoàn thành kiểm chứng.

## Chạy tiếp

```powershell
pnpm install --frozen-lockfile
dotnet run --project backend/src/EventPlatform.Api
pnpm dev:mobile

pnpm --filter @event/mobile lint
pnpm --filter @event/mobile typecheck
pnpm --filter @event/mobile test
pnpm --filter @event/core test
pnpm --filter @event/seat-map test
```

Giữ `.env.local` thật và user-secrets backend; không copy service_role/signing/gateway secrets vào app. Backend cần môi trường Development để nạp user-secrets. Android emulator có thể dùng `http://10.0.2.2:5080` khi API chạy trên máy host; thiết bị thật cần URL LAN/HTTPS truy cập được. URL LAN hiện tại không được tự sửa trong lần QA này. Scheme `eventcustomer` giữ nguyên.

Để mở các nhánh nghiệp vụ cần local/staging có sự kiện/session/layout/pricing thật, tài khoản Customer và quyền ghi được phép. BE/đồng đội cần chốt QR encoding + Staff decoder, gateway/return/IPN/reconcile, worker hosting và mapping nhiều khu đứng; sau đó kiểm thử P0/native bằng dữ liệu thật. Không seed hoặc tạo giao dịch trên hosted PRODUCTION để lấp chỗ trống.
