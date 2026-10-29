# Tickey — một app mobile, hai chế độ

Migration này thực hiện theo yêu cầu sản phẩm mới: người phụ trách Customer làm chức năng Customer và khung tích hợp trong app chung; nghiệp vụ Staff vẫn do đồng đội phụ trách. Các DOCX và cột tên/phân công gốc được giữ nguyên. Những sơ đồ cũ có hai app mobile là khác biệt tài liệu, không phải kiến trúc hiện tại.

## Cấu trúc cuối cùng

```text
apps/mobile/                         @event/mobile, một Expo entry/config/EAS config
  src/app/_layout.tsx                AuthProvider + QueryClientProvider + fonts/safe-area
  src/app/(auth)/                    layout Auth chung; /auth/* và /workspaces
  src/app/(customer)/                layout Customer; /, /search, /events/*, /booking/*,
                                     /payment-result, /orders, /tickets/*, /profile/*, ...
  src/app/(staff)/                   layout Staff có guard; /staff, /staff/workspaces
  src/features/auth/                 session, login/signup/recovery/callback, workspace
  src/features/customer/             toàn bộ feature Customer đã triển khai
  src/features/staff/                landing ca làm, guard, adapter shared, chọn tổ chức
  src/features/forms/                draft trong bộ nhớ và exclusive mutations dùng chung
  src/lib/                           Supabase singleton, repositories, config, session scope
  assets/                            Figma assets/fonts và native assets cũ
apps/portal/                         Org/Admin web giữ nguyên
packages/{core,ui_kit,seat_map}/      repository/client/model và UI/renderer dùng chung
```

Route groups không thêm URL prefix. Customer giữ URL cũ; Staff có segment thật `/staff`. Test cấu trúc kiểm tra không có hai route cùng URL, một Auth/Query provider và đủ 79 frame mapping còn trỏ tới route tồn tại. Route mỏng; Screen → Hook → core repository/API client → Server. Chỉ core import SDK Supabase.

Bottom navigation mới dùng nested `(tabs)` tại `(customer)/(tabs)` và `(staff)/staff/(tabs)`, bên trong Stack/guard cũ. Bốn root tab mỗi giao diện giữ URL, icon và nhãn; trang chi tiết vẫn ở Stack ngoài Tabs. Navigator giữ screen/scroll khi đổi tab và reset scene theo account/workspace. Controller floating chỉ được tạo trên màn có bar; không thêm Auth/Query provider hay bật Staff demo. Cơ chế, danh sách file và giới hạn kiểm chứng ở [FLOATING_NAVIGATION.md](FLOATING_NAVIGATION.md).

Mở rộng theo UX được duyệt 29/10: CustomerBrowseScreen dùng lại bar trên Search/Event/Venue và các list Offline/Refund/Report/Support trong Stack hiện có, không thêm root tab. Support list `/support` tách form `/support/new`; link theo bookingId vẫn giữ context. Action footer của trang duyệt chuyển động cùng progress bar, còn form/checkout/QR giữ giao diện riêng. Xem bảng phạm vi và QA trong FLOATING_NAVIGATION.md.

## Những gì đã chuyển và lựa chọn cấu hình

| Nguồn trước migration | Đích / xử lý |
| --- | --- |
| apps/customer | apps/mobile; package đổi thành @event/mobile; giữ toàn bộ Customer, env local, assets/font, test, script cấu hình API |
| Customer routes | (customer), Auth routes → (auth); giữ URL Auth/payment/order/ticket, nên callback không cần đổi ở backend |
| Customer features | src/features/customer/{account,booking,catalog,notifications,payment,refunds,support,tickets,unsupported}; Auth/forms shared; cập nhật alias/import/asset require |
| Staff landing `/staff` | src/features/staff/screens/staff-entry-screen.tsx theo Figma s-sessions (1:2699) và s-no-assignment (149:1424); ca làm thật từ GET /api/me/staff-assignments; nút mở ca khóa cho đến khi có Chuẩn bị soát vé |
| Staff layout | (staff)/_layout.tsx; giữ ThemeProvider/Stack, bỏ Query provider độc lập và thêm StaffGate |
| Staff Supabase/repositories adapter | src/features/staff/lib; dùng singleton/core wrappers của app chung, không tạo session thứ hai |
| Staff config/assets | EAS profiles/dependency phiên bản và mọi native asset trùng với nền Customer, đã đối chiếu hash; sử dụng bản chung. Cấu hình gốc và file local còn lại có bản sao ngoài repo |
| Root scripts, lockfile, workflow | dev:mobile; dev:customer/dev:staff là alias cùng app; một importer apps/mobile trong pnpm-lock; workflow manual chỉ chọn profile, build directory apps/mobile |

Không khởi tạo Expo project mới hoặc nâng framework. Customer dependencies bao phủ toàn bộ Staff dependencies, cùng phiên bản. Giữ expo-notifications, seat-map/Skia và Expo Go loader hiện có. Camera/SQLCipher chưa được cài/chốt trong scaffold Staff; không tự thêm plugin hoặc xin camera lúc login. Expo dùng cấu hình Metro/Babel mặc định như trước; tsconfig giữ strict, alias và typed routes. Không cần đổi turbo.json/pnpm-workspace globs; đã đọc docs bundled của turbo trước điều chỉnh workspace.

| Identity/config | Quyết định |
| --- | --- |
| Tên hiển thị | Tickey |
| Slug | event-customer giữ nguyên, chưa tạo/link EAS project mới |
| Scheme | eventcustomer giữ nguyên |
| Android/iOS application ID | vn.eventplatform.customer giữ nguyên ở cả hai nền tảng |
| Staff identity cũ | eventstaff / vn.eventplatform.staff thuộc scaffold thứ hai đã loại khỏi entry đóng gói; không tạo store identity mới |
| Auth callback | eventcustomer://auth/callback; Expo Go dùng exp://HOST:PORT/--/auth/callback |
| Payment callback | eventcustomer://payment-result; backend config giữ nguyên; kết quả thực vẫn hỏi getBooking |

Không thay tên application ID/store identity theo tên thư mục mới. EAS workflow chỉ được sửa cấu hình file; chưa chạy workflow, build APK, submit hoặc deploy.

## Đăng nhập và phân giao diện theo quyền

Guest vẫn mở Home/Search/Event theo quyền catalog hiện có. Login/register/OTP/forgot/reset/callback là một flow chung. Theo xác nhận sản phẩm mới, nút chuyển role trong Figma chỉ phục vụ prototype, không xuất hiện trong app thật. Sau xác thực, `/workspaces` là điểm phân luồng tự động, không phải màn chọn role. Membership STAFF hợp lệ từ `listMyWorkspaces` → Staff; không có STAFF và có CUSTOMER → Customer. Return path chỉ được giữ trong giao diện phù hợp. Không tự mở scanner hoặc chọn tổ chức đầu tiên.

Customer không có nút chuyển Staff hoặc chọn role; Staff không có nút về Customer. Có STAFF với orgId và role SCANNER/POS/GATE_MANAGER thì STAFF được ưu tiên dù RPC đồng thời trả CUSTOMER. Staff chỉ chọn/đổi tổ chức được server phân quyền, sử dụng `setActiveWorkspace` và refresh JWT cũ. Mutation đọc lại session/membership trước khi ghi, từ chối chọn khác loại giao diện hoặc tổ chức không được phân quyền; sau refresh vẫn kiểm user/kind/orgId/roles. Chọn workspace không tự cấp quyền.

Customer layout chặn render trước khi xác nhận quyền cho tài khoản đã đăng nhập; link Customer, payment return và vé offline của Staff đều chuyển về Staff, không ghi CUSTOMER. Customer mở link Staff được đưa về Customer. Layout đang nằm trong back stack không tự đổi workspace. Customer được phép khôi phục workspace CUSTOMER từ workspace web khi membership phù hợp, không phải lựa chọn role của người dùng. Giữ form/selection khi quay lại trong cùng tài khoản; clear khi đổi tài khoản/logout. Thao tác gửi vẫn khóa lúc request pending.

Staff guard bao cả direct/deep link, phân biệt loading, lỗi xác nhận quyền, chưa login, chưa có quyền, chọn tổ chức và quyền bị thu hồi. Membership được kiểm lại khi mount/foreground và mỗi 30 giây cho tài khoản đã đăng nhập, để phát hiện cả cấp thêm Staff lẫn thu hồi quyền. Lỗi refetch chặn giao diện với retry, không chuyển thành Customer hoặc dùng dữ liệu cũ để khẳng định quyền. Staff bị thu hồi workspace hiện tại được chọn tổ chức Staff còn hợp lệ hoặc đăng xuất/liên hệ quản lý; không có nút đổi sang Customer. Chỉ guest sau đăng xuất được khám phá catalog.

**Giới hạn contract:** `list_my_workspaces` hiện luôn trả CUSTOMER, `set_active_workspace('CUSTOMER')` hiện được backend cho phép cho mọi tài khoản. Quy tắc Staff ưu tiên và không đổi role hiện được app thực thi; chưa có loại tài khoản mobile độc quyền do server cung cấp hoặc policy backend cấm Staff mua vé. Cần BE chốt/triển khai nếu muốn cấm cả request ngoài app. Không sửa backend/migration trong thay đổi này. Khi offline, các route server vẫn cần xác nhận quyền. Riêng `/tickets/offline` cho đọc snapshot tài khoản đã tải nếu không có session/membership Staff đã biết hoặc lỗi từ chối quyền; không kích hoạt CUSTOMER, không mở chức năng ghi. Không thể xác minh thay đổi quyền hoặc hiệu lực vé khi mất mạng; UI hiển thị cảnh báo và thời điểm snapshot. Xem kiểm thử/giới hạn ở CUSTOMER_BACKEND_AUDIT.md.

## Staff thực tế và phần tiếp theo của đồng đội

Checkout trước migration có đúng bốn file Staff source: home placeholder, layout, Supabase adapter, repositories adapter. Không có camera/scanner, SQLite/SQLCipher, manifest store, scan queue hoặc sync implementation. Không có chức năng hoạt động nào bị thay bằng placeholder, cũng không có hàng đợi đang dùng bị xóa.

Đã nối home scaffold vào entry chung, dùng tài khoản/tổ chức/role thật và logout chung; không chuyển role. Chọn tổ chức đã có code. Chọn Session/gate/device, scanner, manual check-in, analytics/POS và offline sync còn chưa được triển khai: nút khóa, giải thích bằng ngôn ngữ người dùng, không event/gate/manifest/QR mẫu và không mô phỏng kết quả.

Contract đã đối chiếu: memberships và list_my_workspaces cấp quyền tổ chức; staff_assignments cấp Session/gate/permissions/time window. RLS cho đọc assignment phù hợp; CheckInEndpoints có device registration, manifest, check-in/sync/manual/attendees/gate analytics. Repo chưa có wrapper/list UI assignment. Không suy luận quyền check-in chỉ từ membership và không đăng ký thiết bị từ điểm vào. Đồng đội bổ sung wrapper/model trong core và feature Staff theo các contract đó, QR encoding đã chốt với BE, native spike/storage/sync. Camera chỉ xin khi vào chức năng camera.

Private query keys có user/kind/orgId; cache cancel/clear khi scope đổi, không để kết quả muộn của user/workspace trước được đọc trong scope mới. Customer offline Ticket cache giữ key account đã có, chỉ xóa namespace Customer khi đổi account/logout, không clear toàn bộ AsyncStorage. Route vé đã tải chỉ đọc theo tài khoản với ngoại lệ offline giới hạn ở trên, không buộc ghi workspace khi offline; che snapshot trong lúc đổi/xác nhận tài khoản. Các mutation nghiệp vụ kiểm tra lại session trước request và sau response; thao tác upload nhiều bước có checkpoint để không tiếp tục dưới account/workspace khác. Không thêm/xóa namespace queue Staff. Khi Staff có storage/queue thực, đồng đội cần nối khóa dữ liệu và chính sách xử lý pending queue khi logout/device revoked; không được xóa âm thầm.

## Kiểm tra và giới hạn

Kết quả mới nhất ngày 21/10/2026 tại [CUSTOMER_BACKEND_AUDIT.md](CUSTOMER_BACKEND_AUDIT.md): Mobile 76/76, Core 61/61, backend 81/81; native Home/Search lỗi mạng và Staff guest guard. Bảng sau ghi kết quả của lần migration trước, không phải xác nhận đã chạy lại toàn bộ trong lần audit mới.

| Kiểm tra | Kết quả migration |
| --- | --- |
| Mobile lint/typecheck | Qua |
| Mobile Vitest | 58/58, 19 files sau bỏ chuyển role: Staff ưu tiên dù có CUSTOMER, chặn chọn khác role/tổ chức không có quyền, lỗi membership không thành Customer, thu hồi quyền, cache scopes, callback và cấu trúc 79 frame/route/assets |
| Core test/typecheck | 31/31; typecheck qua |
| Seat-map test/typecheck; ui-kit typecheck | 8/8; typecheck qua |
| Portal typecheck/build | Qua; build có cảnh báo chunk lớn hơn 500 kB, không thay Portal |
| Android Hermes export | Qua: 2.715 modules, 61 assets. Chỉ bundle build |
| Web Edge 390×844 | Guest Home → Search, Staff link chưa login → login chung có next, validation local, callback lỗi hết hạn, payment return thiếu ID → orders được bảo vệ; không page error và không request ghi dữ liệu |
| Catalog thật trong web QA | API LAN hiện trả lỗi kết nối; không điền dữ liệu giả. Có request bị hủy do điều hướng và GET connection refused; không xác nhận data flow catalog live |
| Android native smoke | Đã chạy Expo Go 57.0.9 trên AVD QA riêng Android 36 x86_64: cold start Customer, Home → Search, Staff deep link guest → login chung, Auth callback thiếu tham số, payment return thiếu ID → orders guard; keyboard/scroll/validation/footer. Đã sửa initial route và keyboard che footer sau kiểm tra |
| Staff account/live nghiệp vụ/iOS | Chưa chạy phân giao diện bằng tài khoản thật, booking/payment/check-in/offline sync hoặc iOS; không đăng nhập/tạo đơn/quét/ghi hosted PRODUCTION |

Fixtures chỉ nằm trong tests. Native smoke dùng session trống, dữ liệu/lỗi/loading thật; không tạo dữ liệu nghiệp vụ mẫu. Phân giao diện theo membership và quyền bị thu hồi được kiểm tra logic, chưa chạy với tài khoản live. Kiểm tra web/export và native guest smoke không xác nhận E2E Staff. Không kết luận UI/UX 79 frame đã hoàn thành kiểm chứng; giữ trạng thái từng frame ở [CUSTOMER_FRAME_MATRIX.md](CUSTOMER_FRAME_MATRIX.md).

Kiểm tra lại sau bỏ chuyển role: Mobile lint/typecheck và 58 tests qua; web guest Home → Search → Staff guard → login chung, validation và Auth/payment error return qua, không lỗi JavaScript hoặc request ghi. Android Expo Go trên AVD TickeyMobileQA: System UI lúc đầu không phản hồi, sau chọn Wait app đã chạy; xác nhận Home guest, deep link Staff bị chặn và mở login chung. Chưa đăng nhập bằng tài khoản Customer/Staff thật để kiểm chứng phân giao diện; API LAN vẫn từ chối kết nối. Kết quả native trước đó về keyboard/callback vẫn là kiểm tra của phiên migration, không tự coi đã kiểm tra lại mọi trạng thái sau thay đổi này.

## Chạy và cấu hình

```powershell
pnpm install --frozen-lockfile
# File .env.local cũ đã chuyển cùng Customer sang mobile, không cần ghi đè.
if (-not (Test-Path apps/mobile/.env.local)) {
    Copy-Item apps/mobile/.env.example apps/mobile/.env.local
}
pnpm dev:mobile
# Expo Go:
pnpm --filter @event/mobile exec expo start --go --clear

pnpm --filter @event/mobile lint
pnpm --filter @event/mobile typecheck
pnpm --filter @event/mobile test
pnpm --filter @event/core test
pnpm --filter @event/seat-map test
```

Giữ Node >=22, pnpm@12.9.1. Env chung: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY (publishable/anon), EXPO_PUBLIC_API_URL; gateway để trống khi chưa sẵn sàng. Scheme/allowlist callback giữ nguyên; chỉnh host/cổng Expo Go theo mạng máy. Script cấu hình API chuyển sang `apps/mobile/scripts/configure-local-api.ps1`; chưa chạy script ghi user-secrets trong migration này. Không đưa backend/QR/gateway secrets vào app.

Dừng Metro của đường dẫn cũ, chạy từ app mới. Lệnh `pnpm dev:customer`/`pnpm dev:staff` giữ làm alias; filter package mới là @event/mobile. Portal giữ lệnh riêng. Native cần development build phù hợp khi scanner/storage thực được bổ sung; migration không chạy EAS hoặc phát hành.


### Ghi nhận native QA

SDK không nằm trong PATH nhưng đã tìm thấy SDK/AVD qua kiểm tra chỉ đọc. QA dùng một AVD mới dưới thư mục audit, đọc system image Android 36 của SDK, không copy userdata/scan queue/tài khoản từ Pixel_5/Pixel_9 hoặc điện thoại. Expo Go lấy từ APK cache hiện có; không build APK Tickey/EAS. Sau QA dừng emulator QA và Metro QA; dữ liệu/ảnh kiểm tra giữ ngoài repo.

Native đã phát hiện và sửa hai lỗi: root không có path chọn nhóm Auth theo thứ tự mặc định; đã đặt Customer là initialRouteName ở root. Keyboard Android che footer form; Screen dùng KeyboardAvoidingView height trên Android, giữ padding trên iOS. Screenshot xác nhận footer trên IME và cuộn tới password/validation khi keyboard mở. Safe area/header/footer và ảnh/font Auth đã xem trên Android; không suy rộng kết quả này sang mọi màn hoặc thiết bị.

Metro online trong môi trường agent trả manifest HTTP 500 UnexpectedServerError trước khi chạy JS. QA khắc phục bằng flag CLI --offline và adb reverse cổng Metro; manifest trả 200 và app chạy thực tế. Flag này chỉ bỏ bước mạng Expo CLI, không thay repository/data mode hoặc URL API. Catalog vẫn dùng URL thật và chưa tải được nội dung; không mock/fake success. Không sửa node_modules hoặc cấu hình Expo Cloud/EAS.

Các tùy chọn tách userdata/datadir và bỏ snapshot được đối chiếu với [Android Emulator command line](https://developer.android.com/studio/run/emulator-commandline). Không wipe dữ liệu AVD gốc.
