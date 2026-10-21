# Customer mobile — triển khai và bàn giao

Cập nhật UI 21/10/2026 theo phản hồi ảnh menu: [thu gọn điều hướng và ghi chú Customer](CUSTOMER_UI_REFINEMENT.md). Search/Orders mở chi tiết bằng một lần chạm; menu nhóm gọn, ít banner hơn. Giữ các hạn chế backend và không nâng trạng thái kiểm chứng toàn bộ 79 frame.

Rà soát mới nhất ngày **21/10/2026**: [đối chiếu backend, thay đổi Customer và kết quả kiểm tra](CUSTOMER_BACKEND_AUDIT.md). Mobile 76 tests, Core 61, backend 81 qua; kiểm tra GET thật trả catalog rỗng. Android phiên này chỉ xác nhận Home/Search lỗi kết nối và Staff guest guard; không xác nhận flow đơn/vé hoặc UI/UX hoàn chỉnh. Chưa có staging, chỉ kiểm thử cục bộ và đọc hosted.

Phạm vi theo phân công Customer mới: `apps/mobile` và package chung cần thiết. Mobile là **một app dùng chung Customer/Staff**, đăng nhập chung và phân giao diện theo quyền server, không có nút chuyển role. Nền Customer đã chuyển sang `apps/mobile` (`@event/mobile`), giữ Expo Router và cấu hình native hiện có; không khởi tạo app mới. Giữ tài liệu phân công gốc, nhánh giaunh-cusmobile và công việc của đồng đội. Lần audit 21/10/2026 không sửa backend/migration/Figma; commit/push theo yêu cầu người dùng trên nhánh hiện có, không merge/deploy, EAS/store, reset/seed hoặc ghi dữ liệu hosted PRODUCTION.

Đã dựng giao diện và nối wrapper thật cho các flow Customer; **chưa kết luận UI/UX hoàn thành kiểm chứng toàn bộ**. Cấu hình public Supabase nhóm và env local được bảo toàn. API LAN hiện chưa kết nối từ app, nhưng API QA cục bộ với launch profile Development đã khởi động và GET catalog thật trả 200 với danh sách rỗng; không sửa hoặc in backend secrets. Native guest smoke chạy trên AVD QA riêng; chưa chạy iOS hoặc tài khoản nghiệp vụ thật; các màn cần sự kiện/đơn/vé **đã dựng nhưng chưa kiểm tra runtime bằng dữ liệu thật**. Bảng [79 frame Customer/Auth](CUSTOMER_FRAME_MATRIX.md) ghi rõ route, component/state, API, trạng thái UI và contract gap của từng frame. Không có runtime mock hoặc design-preview trong Customer.

## Nguồn đã đọc và đối chiếu

- `AGENTS.md`, `README.md`, `docs/DB_INSTRUCTIONS.md`, `supabase/README.md`.
- Trích xuất OOXML đủ đoạn văn và bảng theo thứ tự: `Mo_ta_du_an_va_huong_dan.docx` **763 block / 31 bảng**; `Phan_cong_cong_viec_GD1.docx` **454 block / 49 bảng**. Không sửa tên/phân công trong tài liệu.
- [Figma Customer](https://www.figma.com/design/JImBbTpHu4JczBDfKVlVzu/Untitled?node-id=9-878) **73 frame** và [Auth](https://www.figma.com/design/JImBbTpHu4JczBDfKVlVzu/Untitled?node-id=9-877) **6 frame**: design context + screenshot từng frame, components/variables/assets, prototype links và controls. Inventory tại [customer-frame-inventory.json](customer-frame-inventory.json), mapping kiểm đủ 79 ID duy nhất tại [bảng đối chiếu từng frame](CUSTOMER_FRAME_MATRIX.md). Không sửa Figma.
- [API tham khảo](https://docs.google.com/document/d/172DMdtBIu_g7wRbzx0JhirZ93pAaQC3RKs3BacztDLg/edit), đối chiếu Catalog, Booking, Account, Auth, Support, Upload, Payment endpoints, Supabase RPC/schema, worker/signing.
- [Taste README](https://github.com/Leonxlnx/taste-skill), `soft-skill/SKILL.md`, `minimalist-skill/SKILL.md`: áp dụng typography/spacing/readability/interaction quality phù hợp product mobile. Không chọn lại art direction, áp marketing hero/ảnh tối thiểu/section animation, hoặc thay RN bằng HTML/WebView.

## Flow và hành vi đã dựng

“Đã nối” trong bảng này nghĩa là frontend sử dụng contract thật trong checkout. Không phải xác nhận endpoint, worker hoặc giao dịch live đã hoạt động tại môi trường hiện tại.

| Flow P0 | Hành vi |
| --- | --- |
| Auth/workspace | Login/register/email verify/forgot/reset/callback/OTP/logout dùng chung; listMyWorkspaces phân giao diện: có STAFF hợp lệ → Staff, tài khoản còn lại có CUSTOMER → Customer. Không có nút chuyển role trong app thật; các nút Figma đó chỉ dùng prototype. Staff chỉ chọn tổ chức có quyền và refresh session theo repository cũ. Return path/deep link bị giới hạn theo giao diện. Không Login Staff riêng. |
| Home → Search → Event → Session | Catalog/categories/events thật, carousel, q/category, limit/offset; chọn suất hợp lệ và giữ lựa chọn. Thiếu ảnh dùng vùng chưa có ảnh, không ảnh business mẫu. |
| Ghế/khu đứng | LayoutData/SeatState thật; renderer chung Skia native + SVG web, pan/pinch/zoom/culling; zone và ticket type chọn tường minh. Nhiều khu đứng thiếu mapping vẫn hiện khu nhưng khóa đặt. |
| Booking/hold/conflict | useCreateBooking retry:false; UUID cho một ý định/payload; NETWORK/UNKNOWN giữ ý định để replay; conflict giữ lựa chọn khác nhưng không coi đã giữ. Exclusive lock chặn request lặp. |
| Giữ chỗ/hủy | Countdown từ lockExpiresAt/serverNow và thời gian trôi; refresh foreground; hủy native Modal chỉ PENDING theo server. PAYMENT_PENDING không tự EXPIRED theo đồng hồ. |
| Vé miễn phí | Form và số lượng thật; create_booking không gửi giá; PAID hiện Đang phát hành vé, chờ CONFIRMED. Không tạo Ticket client hoặc tự báo phát hành thành công. |
| Thanh toán/return | UI đầy đủ summary, phương thức, điều khoản/footer; nút checkout khóa do gateway chưa sẵn sàng. HttpPaymentApi/WebBrowser/return handler có code, return chỉ điều hướng và getBooking kiểm kết quả. |
| Đơn/vé/offline | List/chi tiết trạng thái thật, link theo record ID, một Ticket một vùng QR; tải snapshot thật theo tài khoản, thời điểm cập nhật, refresh online. QR chưa có encoding nên hiện Mã QR chưa khả dụng. |
| Hồ sơ/nhắc lịch/thông báo | GET/PUT profile; preferences RLS qua core; lịch sử notification/mark read; nhắc cục bộ, tap notification kiểm UUID và điều hướng record thật. Không hứa đã gửi push/email. |
| Suất hủy/hoàn tiền/bank OTP | Chỉ Session CANCELLED mới nói đã hủy; trạng thái refund đọc server; chỉ AWAITING_BANK_INFO nhận bank form, OTP trước gửi; REFUND_PENDING chưa phải đã hoàn. |
| Report/support | Form, validation, chọn vé thật, evidence picker/upload, gửi phản ánh; support list/create/messages, CLOSED khóa gửi. Success chỉ sau response server. |

Tất cả các flow nghiệp vụ trên chưa chạy E2E live/native. Các nhánh loading/data/empty/error, quyền/auth/unavailable đã có code; không dùng unit fixture để tuyên bố đã kiểm tra UI trạng thái đó.

## Màn chưa có contract và tính liên tục

- Dựng P1 refund request/ineligible, business form/review, audience pricing, report supplement, payment detail và invoice information bằng component thật. Form có thể nhập/kiểm tra cục bộ; submit unsupported khóa và ghi lý do gần nút. Các kết quả submitted/failed/late/business-paid chỉ có thể được xác nhận bằng record/server contract; không có nút giả để mở thành công hoặc mã đơn/vé mẫu.
- Holder trước payment giữ tên/email/phone cục bộ, ghi rõ chưa gửi. Contract hiện chỉ gán lần đầu cho Ticket ISSUED; holder thật ở chi tiết vé dùng endpoint hiện có.
- Không tạo sự kiện/đơn/vé/công ty/nhóm giá/QR demo. Khung vé/đơn/venue/form vẫn hiện khi thiếu dữ liệu, với trường chưa tải/chưa cung cấp.
- Response [] thành công là empty; lỗi mạng có retry; 401 yêu cầu login; 403 báo quyền; chưa hỗ trợ dùng unavailable; giao dịch pending dùng trạng thái server. Missing env chặn khởi tạo live và hiện lỗi cấu hình.
- Draft trong bộ nhớ theo form/record, giữ khi back/lỗi; không lưu password/OTP/bank vào AsyncStorage. Clear khi đổi tài khoản/logout. Query cache cancel/clear khi đổi account/workspace. Offline cache tách tài khoản, có chống ghi muộn từ tài khoản cũ.
- Exclusive mutation theo user/scope ngăn gửi lặp kể cả unmount/remount; không thay thế idempotency server. Booking giữ cùng key khi mất phản hồi, không sửa payload để replay.
- Image business chỉ dùng URL thật từ server. Auth artwork/icon/font xuất từ Figma; ảnh minh họa venue có caption rõ. Không tải ảnh để lấp nội dung catalog.

## Module và tương thích

| Vùng | Thay đổi |
| --- | --- |
| apps/mobile/src/app | Routes mỏng cho auth/catalog/booking/payment/tickets/profile/notifications/refunds/reports/support/workspaces. Không fake preview route. |
| apps/mobile/src/features/customer và auth | Screen/hook/state theo feature; thêm forms cho memory draft, local validation và exclusive mutations; unsupported cho cấu trúc P1. |
| apps/mobile/src/components, lib, assets | RN Screen/Field/Button/Select/Modal, loading/error/empty; config/capabilities rõ; assets Figma/font, provenance/licenses. |
| packages/core | Additive catalog/customer/auth repositories, HTTP client, Zod mapper/error handling; giữ SupabaseBookingRepository/SupabaseWorkspaceRepository/ApiError/SeatConflictError. HttpPaymentApi thêm validation; ApiError bổ sung phân loại transport/JWT/permission của RPC, giữ business message/details. |
| packages/ui_kit | Chỉ thêm customerTheme, giữ exports/token cũ. |
| packages/seat_map | Giữ types/spatial index/validation; thêm renderer qua /native và /native.web, pure geometry/render-plan helpers/tests. Không gọi Supabase; nhận props/callback. Pure entry không import native. |
| Config/test | Mobile Vitest logic, dependency native phù hợp Expo đang cài; lockfile/pnpm-workspace allow Skia postinstall. Không đổi router/framework/package manager/Turbo. |

SELECTED và CONFLICT chỉ là UI state. Renderer dùng viewport culling, không tạo hàng chục nghìn View cho map lớn; chưa đo 50.000 ghế, không tuyên bố đạt NFR-04. Native peers optional để không ép Portal/Staff import Skia. Staff cùng app được kiểm tra bằng mobile typecheck; Portal giữ dependency chung.

## API/RPC thật đã tích hợp

| Nguồn | Wrapper/contract |
| --- | --- |
| Supabase Auth SDK | SupabaseAuthRepository: session/subscription/login/signup/resend signup/OTP/recovery/callback/logout. SDK network errors tách khỏi missing authentication. |
| Booking RPC | SupabaseBookingRepository cũ: create_booking/get_booking/cancel_booking; server quyết giá/tồn kho. Client chỉ sessionId/items/idempotencyKey. |
| Workspace RPC | SupabaseWorkspaceRepository cũ: list_my_workspaces/set_active_workspace và refreshSession. |
| Catalog REST | /api/categories, /api/events, event detail/sessions, session ticket-types/layout/availability/seat-pricing. |
| Account/tickets | /api/me GET/PUT; /api/bookings và /api/tickets limit/offset; Ticket detail; PUT holder. |
| Notifications | GET /api/notifications, PUT /read; core preferences RLS exception theo schema/tài liệu. |
| Refund | GET /api/refunds; POST /api/refunds/{id}/bank-info sau OTP. |
| Report/upload/support | GET/POST /api/reports; multipart /api/uploads REPORT_EVIDENCE; /api/support-requests và /messages. |
| Payment | HttpPaymentApi gọi POST /payments/sessions, response PaymentSession camelCase riêng. Code checkout bị capability gate khóa; chưa gọi gateway thật. |

Request thông thường camelCase; database response snake_case được Zod kiểm và mapper camelCase trong core. PaymentSession không dùng database mapper. Lỗi message/details được ApiError xử lý; UI dùng tiếng Việt, không hiển thị endpoint/worker/credential. Detail report/refund/support/order tìm bằng pagination thật khi chưa có GET-by-ID; không suy diễn endpoint từ tên frame.

Chỉ packages/core import @supabase/supabase-js. Không fetch hoặc truy vấn/ghi bảng nghiệp vụ trong component/hook.

## Khác biệt tài liệu và contract/backend còn thiếu

| Vấn đề | Đối chiếu và UI |
| --- | --- |
| QR encoding chưa chốt | Người dùng xác nhận chưa. Worker/API có credential {kid,payload,signature}, DB_INSTRUCTIONS ghi encoding chỉ là ví dụ cần thống nhất; Staff chưa decoder. ServerTicketQr nhận chuỗi đã chốt trong tương lai nhưng hiện luôn null; không ký hoặc tạo envelope. UI Mã QR chưa khả dụng. |
| Gateway chưa sẵn sàng | Checkout dùng UnconfiguredPaymentGateway. Capability false dù có env gateway; không chỉ mở nút theo biến môi trường. begin_payment có thể commit trước adapter error; hook refresh Booking. Cần adapter/return/IPN/reconcile và live kiểm chứng trước bật. |
| Payment failed/cancelled/late | Booking status không đủ xác định kết quả từng attempt/đóng browser/tiền nhận muộn. Dựng khung kết quả, reference/time/status chưa cung cấp; không báo thất bại hoặc cho thanh toán lại tùy ý. Cần attempt status/time/receipt contract. |
| Worker | IssueTicketsWorker phải phát hành thật: PAID chờ CONFIRMED. Refund/Notifications/PaymentQueryReconciliation chưa hoàn chỉnh; không simulate hoàn/phát/push. |
| Multi-zone standing | Ticket-types chưa có ticket_type_zones mapping. Liệt kê zone thật, không mặc định zone/type đầu; khóa gửi trường hợp thiếu mapping. |
| Catalog summary/filter | Events thiếu min price/venue/org/artists summary. UI Xem hạng vé; không lấy giá suất đầu làm giá event. Backend hiện q/title/category/featured/limit/offset; month/city/artist/venue filters khóa. |
| Gate/audience | Không có gate/audience-pricing contract; không G1/G2/Người lớn mặc định. Khung giữ trường chưa có thông tin; audience selector khóa. |
| Holder | Figma có form trước payment, RPC chỉ first assignment trên ISSUED. Form trước payment local chưa gửi; không tự ghi Booking holder. |
| Business/invoice/refund request | P1 chưa đủ contract Customer được phép tạo/thanh toán/đánh giá eligibility. Form/review dựng, submit khóa. Không dùng DB model tồn tại để suy ra API hoạt động. |
| Report supplement/case/history | Chưa Customer supplement/case/evidence history/replies contract. Dựng khung, picker local; không upload bổ sung hoặc phản hồi mẫu. |
| Notification | Chỉ history/preferences/mark read và local reminder code; chưa push token delivery. Cần native permission/tap/scheduling runtime. |
| API tham khảo | Doc IPN /api/payments/ipn, implementation /api/payments/ipn/{gateway}; Customer không gọi IPN. |
| Tài liệu REFUND_PENDING | Mô tả cũ nói đã hoàn 100%; thực tế pending. UI Đang xử lý hoàn tiền, chỉ kết quả server hoàn tất mới nói đã hoàn. |
| Ví dụ DOCX | CancelBooking thực trả Booking, không void; .NET có /api/* ngoài payment. Theo implementation hiện có, không sửa backend cho khớp ví dụ. |

Chuyển nhượng/đổi lịch/voucher/khiếu nại lại không có frame riêng trong hai section đã đọc; không thêm backend hoặc flow gửi giả. Phần mock: **không có runtime mock/preview**, fixture chỉ nằm trong unit tests.

## Chỉnh bố cục Customer ngày 22/10/2026

- Home: dãy sự kiện hiện khoảng 2,3 thẻ theo chiều rộng thực; bộ lọc có thể vuốt ngang ở màn hẹp, ô “Tất cả” rộng hơn và không xuống dòng. Icon khớp slug danh mục tiếng Việt đang được server trả về. Footer chi tiết sự kiện không tràn mép.
- Xác nhận email/khôi phục: rút gọn phần đầu và hướng dẫn; trợ giúp dài nằm trong mục mở rộng. Giữ nhập mã, gửi lại, validation và callback thật; không gửi email trong QA lần này.
- OTP xác nhận email, khôi phục mật khẩu và nhận hoàn dùng chung component cố định **8 ô**, kiểm tra đúng 8 số: nhập một số chuyển ô tiếp theo, Backspace ở ô trống quay lại, sửa một số không dịch các số còn lại; hỗ trợ dán/tự điền cả mã. Email được hiển thị từ bước đăng ký/đăng nhập/khôi phục trước, không nhập lại trong màn OTP. Khi login báo chưa xác minh, dùng email của request login vừa gửi, tránh lấy nội dung form đã chỉnh sau lỗi. Route thiếu email thì khóa xác nhận/gửi lại và cho quay về bước trước; hoàn tiền lấy email từ phiên đang đăng nhập. Không tự gửi khi nhập xong. Đã kiểm tra nhập/xóa/dán và chặn mã 6 số trên web ở 320/390 px bằng mã kiểm thử nhập cục bộ, không gửi lên server; chưa kiểm tra bàn phím/autofill native hoặc màn hoàn tiền bằng record thật. `supabase/config.toml` đặt email OTP local 8 số; chưa chạy local Supabase hoặc thay đổi cấu hình hosted. Wrapper Auth chung vẫn giữ contract 6–10 số để tương thích app khác, frontend mobile chỉ chấp nhận 8 số theo yêu cầu sản phẩm.
- Chọn ghế: các khu nằm trên một hàng vuốt ngang. Chiều cao sơ đồ phụ thuộc kích thước bố trí và màn hình, giữ kích thước ghế của renderer, dùng prop `height` có sẵn; không sửa renderer/package chung. Khu đứng thiếu mapping vẫn khóa đúng và giải thích lý do.
- Người tham dự: tóm tắt số vé/tổng tiền, mở rộng để xem từng vé; không để danh sách chi tiết dài đẩy form xuống quá xa. Hỗ trợ: ô nhập và lỗi gửi nằm cạnh nút gửi trong footer, giữ draft và khóa khi request đang chạy hoặc yêu cầu đã kết thúc. Vé offline mở ngay trong mục đã chọn, có trạng thái mở/đóng cho accessibility và giữ thời điểm tải/cảnh báo hiệu lực.
- Bỏ ba whitespace string nằm trực tiếp ngoài Text ở OTP hoàn tiền/Report. Không thay API, quyền, dữ liệu production hoặc thêm runtime mock.
- Rà lại trước commit: hộp chọn có chiều cao giới hạn, danh sách tùy chọn cuộn và có padding safe area; xác nhận hủy đơn cuộn được khi nội dung dài/chữ lớn. Đây là sửa từ kiểm tra code; chưa mở hộp hủy bằng một đơn thật để kiểm chứng native.

Kiểm tra đợt này: Mobile lint/typecheck và **88/88 test logic (25 files)** qua, gồm ba kiểm thử mới cho chiều cao sơ đồ, sáu kiểm thử chỉnh sửa/độ dài mã OTP và ba kiểm thử email đích xác minh. Đã kiểm tra web bằng API local và dữ liệu catalog server: 31 trường hợp ban đầu, sau đó 13 trường hợp sau chỉnh sửa ở 320/360/390 px, gồm chọn khu thật, mở trợ giúp và validation form rỗng. Sau thay đổi yêu cầu OTP 8 số, đã kiểm tra ba trường hợp xác nhận email/khôi phục ở 320/390 px, không gửi mã. Không gửi request ghi dữ liệu. Màn người tham dự, hội thoại hỗ trợ có dữ liệu và mở vé offline **đã sửa nhưng chưa kiểm tra runtime bằng đơn/vé/tài khoản thật**. Chưa kiểm tra lại native trong đợt này; các kết quả native cũ ở dưới không phải xác nhận cho bản sửa mới. Dữ liệu server còn tên khu chứa DEMO và một sự kiện thiếu cover; chưa sửa production hoặc thay bằng ảnh/dữ liệu giả trong UI.

Kiểm tra theo các bước CI trên nhánh trước commit: `pnpm lint`, `pnpm typecheck`, `pnpm test`, build Portal và 130/130 test backend đều qua. Root test gồm Mobile 84, Core 73 và Seat-map 8; các package không đổi có kết quả được Turborepo cache phục hồi. Portal hiện chỉ có script “no tests yet”, ui-kit không có test file; không tính hai script đó là kiểm thử UI. Build Portal có cảnh báo chunk lớn đã tồn tại. Chưa chạy pgTAP vì môi trường không có Docker/Supabase CLI; không dùng hosted PRODUCTION để thay thế. Remote main có các thay đổi mới của đồng đội; đợt commit UI này giữ trên nhánh giaunh-cusmobile hiện tại, chưa merge các thay đổi đó. Không suy rộng kết quả local sang CI của main mới.

## Kiểm tra thực tế và giới hạn

| Kiểm tra | Kết quả |
| --- | --- |
| Mobile lint/typecheck | Qua sau chỉnh UI và logic cuối. |
| Core/seat-map/ui-kit và Portal typecheck; Staff nằm trong mobile typecheck | Qua, giữ tương thích app khác. |
| Dependency peer check | Có mismatch đã tồn tại trong lockfile gốc: Customer metro-config 0.87.1 so với community-cli-plugin 0.86.3; Portal React/React DOM 19.2.3 so với react-router 8.4.0 yêu cầu >=19.2.7. Không nâng framework hoặc sửa Portal trong nhiệm vụ này. |
| Mobile Vitest | **88/88**, 25 files. Auth/callback/recovery, email đích xác minh, Staff priority/guard, account/workspace scope, exclusive requests/idempotent booking, countdown, selection limits/mapping/duplicate seats, chiều cao sơ đồ ghế, chỉnh sửa/dán/xóa/độ dài OTP, offline cache/access, bank OTP retry, reminder/notification destinations và Expo Go loader. |
| Core Vitest | **73/73**, 12 files (kết quả cache trong root test trước commit). Mapper/Zod/HTTP error/empty/permission/not-found, 403 business codes, timeout/cancellation, Auth email/OTP/recovery, PaymentSession, media và workspace contract. |
| Seat-map Vitest | **8/8**, 3 files. Geometry/spatial/render-plan. |
| Web Edge headless 390×844 | Lần kiểm tra trước khi tạo .env.local: chỉ root lỗi thiếu cấu hình, đúng thông báo; không console/page errors, failed HTTP responses hoặc request ghi dữ liệu. Artifact kiểm tra được giữ ngoài repo; ảnh preview cũ đã bỏ. |
| Android Expo export | Hermes bundle/assets sau migration: 2.715 modules, 61 assets. Đây là bundle build, không phải chạy app trên Android hay test native component. |
| Native/live E2E | Android guest smoke đã chạy trên AVD QA Android 36 + Expo Go 57.0.9: Home/Search, Staff guest guard/login chung, Auth/payment error return, keyboard/scroll/footer/validation. Chưa live E2E hoặc iOS; không login thật/ghi dữ liệu. Chi tiết và ảnh QA ngoài repo, xem MOBILE_ARCHITECTURE.md. |

Không báo script “no tests yet” là test mobile. Customer đã cấu hình Vitest cho logic TypeScript; **chưa có test native component/Jest tự động; Android guest smoke được kiểm tra bằng ADB/hierarchy/screenshot riêng**. Không dùng fixtures để kiểm chứng fake-success hoặc chụp data screens của bản hiện tại. Việc đọc screenshot Figma và kiểm tra code không thay thế so sánh screenshot app native bằng dữ liệu thật.

Còn cần kiểm tra native với data thật: keyboard/safe area/text dài/scroll/footer; seat-map gestures/performance; Auth mail/OTP; free issuance; gateway return/background; pending/expired/conflict; cancellation/refund; evidence uploads/messages; offline account separation và notification permission/tap. Các trạng thái chưa mở được ghi rõ ở bảng từng frame. Không kết luận toàn bộ UI/UX hoàn thành cho đến khi kiểm chứng và xử lý các vấn đề đó.

## Cách chạy và cấu hình

### Mobile dùng chung Customer/Staff

Kiến trúc và bàn giao migration tại [MOBILE_ARCHITECTURE.md](MOBILE_ARCHITECTURE.md). Một app tại `apps/mobile`, một AuthProvider/QueryClient/Supabase singleton; route groups `(auth)`, `(customer)`, `(staff)` không thêm URL prefix. Staff dùng segment thật `/staff`, `/staff/workspaces`; URL Customer/Auth/payment cũ giữ nguyên.

- Login/register/verify/reset/callback đọc membership server qua điểm phân luồng `/workspaces`; có STAFF thì vào Staff, không có STAFF thì dùng Customer khi được server cấp CUSTOMER. Không chọn role bằng UI, không tự chọn tổ chức/scanner. Customer layout chặn Staff kể cả link payment/offline; Customer mở Staff link được đưa về Customer. Đang tải quyền/lỗi quyền/thu hồi quyền có trạng thái riêng, không fallback sang Customer. Chi tiết và giới hạn server/offline tại [MOBILE_ARCHITECTURE.md](MOBILE_ARCHITECTURE.md).
- Không có nút chuyển Customer/Staff trong sản phẩm. Staff guard đọc membership server, phân biệt loading/error/unauthenticated/forbidden/revoked; kiểm tra khi vào, foreground và định kỳ. Chỉ chọn tổ chức Staff được phân quyền qua setActiveWorkspace/refreshSession và đối chiếu user/kind/orgId/roles sau refresh. Giữ một phiên đăng nhập chung.
- Staff nguồn chỉ có scaffold; đã chuyển home, layout và adapter vào `src/features/staff`, layout bỏ Query provider riêng, adapter dùng singleton chung. Không có scanner/database/queue/sync đang hoạt động để thay thế hoặc xóa. Nhóm Staff tiếp tục assignment/session/gate/device, scanner, storage và sync theo contract thật; chưa bật camera hoặc tạo session/gate giả.
- Query private tách user/workspace/org; cancel/clear cache khi đổi scope, giữ Customer drafts khi chỉ đổi chế độ và clear khi đổi account/logout. Offline Ticket cache giữ namespace đã có theo account, không clear toàn bộ AsyncStorage; không đụng queue/namespace khác. Native/Staff thật chưa được kiểm chứng.

```powershell
# Node >=22; packageManager trong repo pnpm@12.9.1
pnpm install
# Chỉ copy khi chưa có .env.local; file hiện đã được điền cho máy này.
if (-not (Test-Path apps/mobile/.env.local)) {
    Copy-Item apps/mobile/.env.example apps/mobile/.env.local
}
# Điền giá trị thật; không copy service_role/QR signing/gateway secrets vào app
pnpm dev:mobile

pnpm --filter @event/mobile lint
pnpm --filter @event/mobile typecheck
pnpm --filter @event/mobile test
pnpm --filter @event/core test
pnpm --filter @event/seat-map test
```

Live cần EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY (publishable/anon), EXPO_PUBLIC_API_URL. URL http/https hợp lệ; secret/service_role key bị chặn. Android emulator dùng 10.0.2.2; web/iOS simulator localhost; thiết bị thật dùng LAN/HTTPS phù hợp. Không còn EXPO_PUBLIC_APP_MODE hoặc chế độ design-preview.

Máy này đã tạo apps/mobile/.env.local (Git ignored) với URL/publishable key của nhóm lấy từ README, API http://192.168.1.5:5080 theo IPv4 Wi-Fi hiện tại. Điện thoại cần cùng mạng; cập nhật API URL nếu IP máy đổi. Đã kiểm tra GET /auth/v1/health của Supabase trả HTTP 200, không kiểm tra đăng nhập hoặc ghi database. Metro đang chạy trước khi tạo env cần khởi động lại bằng lệnh Expo Go bên dưới.

Ở phiên cấu hình trước đã chạy script -PublicOnly (nay chuyển tới apps/mobile/scripts/configure-local-api.ps1), lưu URL và khóa public vào user-secrets đúng tài khoản Windows và đúng UserSecretsId của API. Đã kiểm tra hai giá trị khớp Customer mà không in giá trị khóa. Lần kiểm tra trước thiếu Supabase:ServiceRoleKey; không đọc lại/ghi secret trong migration, API LAN hiện chưa kết nối được.

Lấy khóa secret của cùng dự án theo README mục New teammate: getting access, rồi chạy script trong terminal của bạn. Script đọc URL/public key từ Customer và hỏi khóa server bằng Read-Host -AsSecureString; truyền JSON qua stdin cho dotnet user-secrets, không đưa khóa vào argv hoặc file trung gian. Cách dùng JSON stdin theo [Microsoft](https://learn.microsoft.com/en-us/aspnet/core/security/app-secrets?view=aspnetcore-10.0).

```powershell
powershell -NoProfile -File .\apps\mobile\scripts\configure-local-api.ps1
dotnet run --project backend/src/EventPlatform.Api
```

Script không ghi vào .env.local, không sửa backend, không gọi API/database hoặc worker. Secret server chỉ nằm trong .NET user-secrets của người chạy. Không dùng khóa public giả làm khóa server để vượt validation. Đã chạy và kiểm tra nhánh -PublicOnly; nhánh nhập secret thật cần bạn thực hiện tại terminal, chưa được agent kiểm tra bằng secret thật. Cho đến khi backend chạy đúng cấu hình, lỗi tải catalog vẫn là lỗi kết nối thật.

Gateway env để trống khi chưa sẵn sàng. Chỉ bật capability checkout sau contract/adapter/sandbox đã hoàn thiện và kiểm tra. Scheme app eventcustomer; backend return eventcustomer://payment-result. Supabase phải allow callback/recovery scheme thực. Không hardcode scheme khác hoặc bỏ secret backend vào public env.

Đã chạy guest smoke bằng Expo Go trên AVD QA; kiểm tra native đầy đủ vẫn cần development build/module phù hợp SDK hiện tại và dữ liệu thật. Chưa build APK/EAS/store; chưa release. Khi có QR contract, cần round-trip credential thật với Staff decoder; khi có staging/local thật, chạy các nhánh P0 nêu trên mà không ghi hosted PRODUCTION.

### Chạy UI/API bằng Expo Go Android

Log do người dùng cung cấp có lỗi expo-notifications về remote push, sau đó là cảnh báo route thiếu default export và ErrorBoundary undefined. Trong phiên bản SDK đang cài, import entry expo-notifications kéo theo DevicePushTokenAutoRegistration.fx, gọi addPushTokenListener ngay khi đánh giá module; warnOfExpoGoPushUsage ném lỗi trên Expo Go Android. Route import bị đứt dù các file vẫn có default export.

Đã chuyển sang loader dùng isRunningInExpoGo và Platform trước dynamic import. Android Expo Go và web không đánh giá SDK entry; Auth/logout, notification tap và reminder scheduling đều qua loader này. Không sửa node_modules, không tắt LogBox, không dựng thông báo hoặc success giả. Trong preferences có thông báo nhắc lịch thiết bị chưa được hỗ trợ; lưu tùy chọn và danh sách thông báo vẫn dùng backend thật. Trên development build, module được nạp khi cần, lỗi khởi tạo có trạng thái báo lỗi/retry.

Sau khi dừng Metro cũ, chạy từ repo:

```powershell
pnpm --filter @event/mobile exec expo start --go --clear
```

Mở lại dự án bằng Expo Go. Remote push cần development build theo [tài liệu Expo](https://docs.expo.dev/versions/latest/sdk/notifications/). Local notifications được Expo mô tả là còn hỗ trợ trong Expo Go, nhưng entry của phiên bản hiện cài có side effect remote gây lỗi; Customer tạm không nạp cả module trong Expo Go Android. Không import private SDK subpaths để vượt qua hạn chế. Android Expo Go AVD QA đã chạy qua khởi tạo/layout mà không lỗi notifications; chưa kiểm tra điện thoại của người dùng; unit tests kiểm tra không nạp SDK trong môi trường bị chặn và vẫn nạp ở native runtime hỗ trợ.

### Xác nhận email và callback

Luồng quên mật khẩu đã thêm `/auth/verify-recovery`: yêu cầu email bằng `resetPasswordForEmail`, nhập OTP và xác thực type `recovery`, sau đó mới hiện hai ô mật khẩu mới/xác nhận tại `/auth/reset`. Repository yêu cầu phiên recovery vừa xác thực trước khi cập nhật mật khẩu; phiên đăng nhập thường hoặc session được khôi phục sau khi đóng app không tự mở bước reset. Gửi lại mã recovery và xác thực khóa chéo khi pending, giữ lỗi server thực; mật khẩu ngắn/không khớp/same_password không báo thành công. Cần owner áp [recovery.html](../supabase/templates/recovery.html) trong template **Reset password** của Dashboard. Đã qua Mobile lint/typecheck, Core typecheck, Core 56/56 và Mobile 60/60; Android export qua với 2.719 modules/61 assets. Chưa thay Dashboard, gửi email thật hoặc kiểm tra UI native cho luồng recovery mới.

Cập nhật cho trường hợp người dùng đọc Gmail trên Windows, chạy Expo Go trong Android emulator: xem [AUTH_EMAIL_SETUP.md](AUTH_EMAIL_SETUP.md). Màn xác nhận hỗ trợ nhập OTP và quay lại đăng nhập sau khi mở email trên thiết bị khác; đăng nhập/verify vẫn dựa phản hồi Supabase, không suy ra thành công từ link được bấm. Gửi lại email xóa mã cũ sau response thành công, chặn xác nhận và resend chạy đồng thời, kiểm email trước resend. Đã thêm template OTP-only tại `supabase/templates/confirmation.html`; owner phải lưu nó trong Confirm signup của Dashboard thì email hosted mới có mã. Chưa thay cấu hình hosted hoặc gửi email kiểm thử production. Backend được người dùng cho phép sửa: register thêm `emailRedirectTo`, thêm `/api/auth/resend-signup`, chuyển callback sang GoTrue và giữ allowlist do Supabase kiểm.

Ảnh người dùng cung cấp có error_code=otp_expired tại localhost:3000. Đây là liên kết bị Supabase từ chối, rồi trình duyệt không tìm được dịch vụ ở địa chỉ redirect. Chưa đọc cấu hình Dashboard để xác nhận allowlist hay email template là nguyên nhân của redirect mặc định.

Đã sửa resendSignup để truyền emailRedirectTo, cùng callback với signup. Linking.createURL dùng path auth/callback không có dấu / đầu để native tạo đúng eventcustomer://auth/callback; Expo Go dùng exp:// và /--/. Callback đọc query/fragment, ưu tiên lỗi provider, không báo xác nhận thành công từ URL lỗi, và giữ cùng promise khi effect chạy lại với cùng payload. UI có yêu cầu email mới/quay về login, phân biệt email chưa xác nhận và giới hạn gửi. Không gửi email test hoặc xác nhận tài khoản bằng quyền admin.

Trong Supabase Dashboard của nhóm, kiểm tra Authentication → URL Configuration → Redirect URLs. Với IP hiện tại và Metro cổng 8081, thêm đường callback development phù hợp:

```text
exp://192.168.1.5:8081/--/auth/callback**
eventcustomer://auth/callback**
```

Dòng exp dùng Expo Go, dòng eventcustomer dùng development/native build. Điều chỉnh theo IP/cổng thực tế; không cần đổi Site URL chung của Portal/Staff chỉ để xử lý Customer. Kiểm tra template Confirm signup nếu vẫn chuyển về localhost: template mặc định dùng ConfirmationURL, template tự sửa cần tôn trọng RedirectTo. Quy tắc allowlist/fallback theo [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

Khởi động lại Expo, vào màn xác nhận email và chọn Gửi lại email. Mở email mới nhất trên điện thoại đang chạy Expo Go. Nếu tài khoản đã xác nhận thì đăng nhập lại; không dùng lại link cũ. Link có thể hết hạn, đã dùng hoặc bị phần mềm kiểm tra email mở trước; chưa xác định nguyên nhân cụ thể của token trong ảnh. Xem [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates). Nếu dùng mã OTP trong app, template cần có Token; không giả tạo mã hoặc tự xác nhận phía client. Chưa chạy thử email/callback native với tài khoản thật sau bản sửa.
