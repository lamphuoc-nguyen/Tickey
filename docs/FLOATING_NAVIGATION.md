# Floating navigation — Customer và Staff

Phạm vi được người dùng duyệt: cả hai giao diện trong một Expo app, giữ URL/tab/icon/quyền và nghiệp vụ. Chưa có ảnh tham khảo đính kèm trong lượt này; thực hiện theo mô tả floating pill, translucent, active capsule, scroll hide/show. Không bật Staff demo hoặc tạo dữ liệu nghiệp vụ để kiểm tra.

Cập nhật theo yêu cầu tiếp theo: bỏ nhãn chữ hiển thị trên cả Customer và Staff, chỉ giữ icon căn giữa; thanh cao 60dp, vùng chạm mỗi tab vẫn tối thiểu 44×48dp. Tên tab còn trong accessibilityLabel và navigation metadata. Lint/typecheck qua, Vitest 124/124 sau bỏ test chiều cao cho nhãn chữ không còn áp dụng. Bản icon-only đã mở lại trên Android trong lần bổ sung chuyển cảnh ở cuối tài liệu; bảng QA floating ban đầu bên dưới vẫn ghi nhận bản có nhãn trước đó.

## Kế hoạch

- [x] Đọc route/layout/scroll containers và dependency đã cài.
- [x] Tạo controller hướng cuộn và animation dùng chung, có hysteresis, bounce/short-list/keyboard/Reduce Motion.
- [x] Đổi bốn root tab mỗi giao diện sang nested Tabs, giữ URL và state theo tài khoản/workspace.
- [x] Nối đúng một primary animated scroll container trên các màn có bar; giữ nguyên modal và horizontal scroll.
- [x] Kiểm thử logic, lint/typecheck và Android Expo Go; ghi rõ các nhánh chưa chạy ở dưới.

## Hiện trạng và lựa chọn

Customer dùng `Screen` với footer TabBar ở Home, TicketHub, Notifications, Profile; các flow checkout/detail không có bar. Staff dùng `StaffFrame` với StaffTabBar riêng; live StaffLanding và các guard không có bottom tabs. Giữ sự khác biệt này, không mở thêm chức năng Staff đang bị khóa.

Hiện không có FlatList/SectionList trong source mobile: các primary containers là ScrollView, còn danh mục/banner/zone và modal dùng scroll riêng. Hook mới nhận metrics giống nhau từ Animated.ScrollView/FlatList/SectionList; chỉ gắn vào container chính để tránh hai stream tranh chấp.

Thư viện hiện có: Reanimated 4.5.1, Worklets 0.10.1, Expo Router 57, safe-area-context 5.7 và expo-glass-effect 57. Không thêm package hoặc nâng phiên bản.

Nguồn API đối chiếu với code đã cài và [Reanimated scroll handler](https://docs.swmansion.com/react-native-reanimated/docs/scroll/useAnimatedScrollHandler/), [Reduce Motion](https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility/), [Expo GlassEffect](https://docs.expo.dev/versions/latest/sdk/glass-effect/), [Expo Router tabs](https://docs.expo.dev/router/advanced/tabs/).

## Cơ chế cuối cùng

- `FloatingNavigationProvider`: controller riêng từng screen có bar. Screen đang focus mới nhận keyboard listener; cleanup khi blur. Focus/show reset bộ tích lũy nhưng giữ offset. Shared values điều khiển visibility, tiến trình animation và focus/keyboard; không set React state trong scroll callback.
- `useFloatingNavigationScroll`: worklet nhận drag/momentum của một primary Animated.ScrollView. Có thể spread cùng handler lên Animated.FlatList/SectionList nếu sau này dùng; hiện chưa có container loại đó để QA thực tế. `FloatingScrollView` ghép layout/content-size callback; callback cuộn bổ sung cần compose từ hook, tránh ghi đè controller.
- `nextScrollDirection`: tích lũy cùng hướng 12dp rồi đổi target, reset phần tích lũy khi đảo hướng. Offset trong 24dp đầu trang luôn show. Bỏ qua rubber-band ở đáy và normalize content inset ở đầu iOS; scroll phát sinh ngoài drag/momentum không đổi target. Khi đứng yên giữ trạng thái. Trang không có scroll range thật luôn show; khoảng cuộn ngắn hơn padding của bar vẫn được nhận (sửa theo phản hồi Home 29/10).
- `FloatingNavigationBar`: pill cao 60dp, cách hai bên 16dp, đáy `safeArea.bottom + 12dp`, icon 24dp, target tối thiểu 44×48dp; active capsule trượt giữa bốn vị trí. Chỉ hiển thị icon; giữ tên cho trình đọc màn hình. Có tab accessibility role/label/selected; lúc hidden bỏ hit testing và ẩn các tab khỏi accessibility tree.
- Hide 250ms, show 290ms, ease-out cubic; translateY bằng chiều cao + khoảng đáy + 40dp để cả shadow rời viewport, đồng thời opacity về 0. Animation dùng Reanimated trên UI thread và `ReduceMotion.System`. Keyboard mở ẩn bar, đóng hiện lại; không đổi layout hoặc padding theo progress nên nội dung không giật do thanh ẩn/hiện.
- Surface/tint tự theo system Light/Dark. iOS dùng GlassView khi cả hai availability check cho phép và Reduce Transparency đang tắt; nền tảng khác dùng nền translucent. Chưa thêm blur library hoặc hứa có blur native trên Android.
- `PersistentTabLayout`: lazy Tabs, freeze background scene, chuyển cảnh trượt ngang 280ms; `router.navigate` thay cho replace khi bấm tab. Tab state gắn với account/workspace; đổi scope unmount scene để không giữ UI riêng tư của scope cũ. Giữ một AuthProvider và QueryClientProvider hiện có. Không đổi role, workspace contract, callback scheme hay API.
- `Screen` chỉ bọc controller nếu có `bottomNavigation`; `StaffFrame` dùng cùng controller/bar. Nội dung chừa khoảng đáy bằng bar + inset + gap + 16dp, không che mục cuối. Khi có cả action footer và bar, footer dùng overlay dịch lên/xuống cùng progress; các footer của checkout/form không có bar, modal và horizontal scroll giữ nguyên.

## File/module

| Vùng | Thay đổi |
| --- | --- |
| `apps/mobile/src/components/navigation/` | Thêm floating-navigation-bar/context, scroll-direction + test, use-floating-scroll, floating-scroll-view, persistent-tab-layout |
| `src/components/tab-bar.tsx`, `ui.tsx` | Customer adapter giữ icon/nhãn cũ; Screen hỗ trợ floating overlay riêng với action footer |
| `src/features/staff/components/staff-ui.tsx` | StaffFrame/StaffTabBar dùng component/scroll chung, giữ bốn nhãn/icon/path |
| `src/features/customer/{catalog,tickets,notifications,account}/screens/` | Home/TicketHub/Notifications/Profile truyền bottomNavigation thay footer |
| `src/app/(customer)/(tabs)/` | Chuyển bốn root routes vào đây, thêm layout; profile/edit và preferences ở Stack bên ngoài |
| `src/app/(staff)/staff/(tabs)/` | Chuyển bốn root routes và thêm layout; giữ nguyên staffDemoOnly wrappers |
| `src/app/(customer)/_layout.tsx`, `(staff)/staff/_layout.tsx` | Initial Tabs bên trong Stack hiện có, không đổi outer guards |
| `src/features/auth/mobile-structure.test.ts` | Kiểm tra các URL tab/detail sau di chuyển, vẫn đủ 79 frame/asset và một Auth/Query provider |
| `docs/MOBILE_ARCHITECTURE.md`, `CUSTOMER_FRAME_MATRIX.md` | Ghi nested groups; URL/frame không đổi |

Không sửa backend, migration, package chung, package manifest, lockfile hoặc identity/config Expo. Không bật Staff demo, mock hay chức năng đang khóa; live StaffLanding vẫn giữ màn thật và action footer hiện có, không thêm tab dẫn tới màn demo vào đó.

## Kiểm chứng 28/10/2026

| Kiểm tra | Kết quả thực tế |
| --- | --- |
| Mobile lint | Exit 0 |
| Mobile typecheck | Exit 0, gồm typed routes sau Metro regenerate |
| Mobile Vitest | 33 file, 125/125; thêm 10 test hysteresis, fling, idle/programmatic restoration, bounce/insets, short content và safe-area/font geometry. Các test role/scope/callback/79 frame đã có vẫn qua |
| Android Hermes export | Qua với code cuối, 2.769 modules / 62 assets; đây là kiểm tra bundle riêng, không thay thế native smoke |
| Android Expo Go 57.0.9 | Chạy trên Pixel_5 AVD Android 36 x86_64, API local 5083; đọc catalog và session Customer thật, không tạo/cập nhật dữ liệu nghiệp vụ |
| Normal size / short Home | 393dp, font 100%: Home hiện có nội dung vừa viewport nếu trừ padding bar nên thanh luôn show; không nhầm khoảng cuộn của bottom clearance thành long list |
| Long Home | 320dp, font 150%: drag xuống chậm và fling xuống ẩn toàn bộ capsule; drag/fling ngược hiện lại khi chưa ở đầu; về gần đầu show; đến đáy vẫn hidden sau cuộn xuống |
| Chuyển tab / giữ scroll | Home → Vé của tôi → Home giữ vị trí (bounds tiêu đề trước/sau trùng); mở `/orders` khi Home hidden thấy bar bình thường; không reset về đầu Home |
| Empty state | Thông báo thật rỗng, bar vẫn show sau swipe; không tạo notification mẫu hay mark-read |
| Safe area / màu | Quan sát trên Android ba nút và gesture navigation; Light/Dark capsule/icon/nhãn; font 150% nhãn hai dòng, tăng chiều cao để đủ padding |
| Detail và input | Mở `/profile/edit` thật: không có bottom tabs; quay lại thấy bar. Không gửi form/lưu hồ sơ |
| Runtime errors | Không thấy ReactNativeJS/AndroidRuntime error và Metro error trong lần smoke; không biến kiểm tra này thành cam kết toàn app không có lỗi |

Ảnh/XML QA để ở `.expo/floating-navigation-qa` (ignored, có thể chứa thông tin tài khoản), không commit. Các capture tên có “loading” hoặc được chụp ngay sau đổi cấu hình hệ thống không được coi là kết quả màn đã tải xong. Bằng chứng hide/show rõ: `large-font-down/up`, `fast-down-actual`, `fast-up-visible`, `bottom-hidden`, `near-top-visible`; chuyển tab `orders-from-hidden`, `home-from-hidden-retained`; empty `notifications-real`, `empty-scroll-visible`.

## Giới hạn và kiểm tra tiếp

- Chưa có iOS simulator/thiết bị: chưa kiểm tra native GlassView, Home Indicator, Reduce Transparency và bounce iOS. Unit tests chỉ xác nhận cách xử lý metrics/insets, không thay thế iOS runtime.
- Chưa có phiên Staff hợp lệ. Staff dùng chung code đã lint/typecheck/bundle, nhưng màn Staff chưa kiểm tra runtime bằng dữ liệu thật; các route preview đang bị guard giữ nguyên. Không bật demo hoặc bypass quyền để chụp QA.
- Các root tab Customer hiện không có input. Keyboard hide/show của controller đã viết nhưng chưa thực nghiệm với input trên một tab có bar; kiểm tra profile/edit chỉ xác nhận screen ngoài Tabs không có bar. Cần kiểm tra lại khi Staff có input live và quyền hợp lệ.
- Reduce Motion truyền vào cả progress và capsule animation; chưa xác minh thay đổi setting đó trên thiết bị thật. Chưa chạy TalkBack/VoiceOver; accessibility tree Android đã quan sát có bốn tab khi hiện và không còn tab khi ẩn.
- Chưa đo FPS trên device/release build, không tuyên bố đạt 60FPS hoặc hoàn tất QA animation iOS. Dao động nhỏ liên tục được test logic; các gesture ADB không thay thế thử cảm giác vuốt tay.
- FlatList/SectionList chưa có trong app, adapter hook chưa được kiểm tra native trên hai loại container này.

Chạy: `pnpm dev:mobile`; kiểm tra lại bằng `pnpm --filter @event/mobile lint`, `typecheck`, `test`. Không cần env/dependency mới. Không thay đổi dữ liệu production.

## Kiểm tra trước commit/push (F-11)

Theo yêu cầu tiếp theo của người dùng, commit/push trên `giaunh-cusmobile` qua tài khoản GitHub HwZau. Đã fetch; nhánh remote tương ứng chưa có commit mới so với HEAD trước commit này. Không tự merge `origin/main` trong lần bàn giao này.

- `pnpm lint`: 3/3 task thành công (2 cache).
- `pnpm typecheck`: 7/7 task thành công (6 cache).
- `pnpm test`: 6/6 task thành công (5 cache); Mobile chạy mới 124/124. Package ui-kit chỉ có script báo chưa có test, không coi là test UI native.
- `pnpm --filter @event/portal build`: qua, còn cảnh báo chunk >500 kB.
- `dotnet test --solution backend/EventPlatform.sln`: 212/212, không skipped.
- `dotnet build --configuration Release backend/EventPlatform.sln`: qua, 0 warning/error.
- `git diff --check`: qua. Đối chiếu tám route chuyển thư mục: nội dung giữ nguyên, gồm wrappers Staff đang có.
- Docker image và pgTAP: chưa chạy local do chưa cài Docker/Supabase CLI; không chạy lên hosted project. Kết quả trên không phải xác nhận các job GitHub Actions đã chạy.

## Bổ sung chuyển cảnh giữa tab (28/10/2026)

Theo yêu cầu tiếp theo, PersistentTabLayout dùng animation shift và sceneStyleInterpolator của Tabs hiện có: progress -1/0/1 thành translateX -width/0/width. Chọn tab ở bên phải thì scene mới từ phải vào; quay về bên trái thì từ trái vào. Timing 280ms, ease-out cubic, chiều rộng cập nhật theo cửa sổ và clamp biên. Bar hiện nằm trong screen nên đi cùng scene khi chuyển cảnh.

Navigator Expo Router 57.0.25 dùng RN Animated native driver trên Android/iOS (đã đọc implementation đang cài). Không thêm navigator/dependency hoặc listener JS từng frame. Motion của bar/capsule vẫn dùng Reanimated. Đọc Reduce Motion trước khi bật animation, theo dõi reduceMotionChanged và cleanup; khi bật/chưa đọc được preference dùng duration 0 / animation none. Không đổi key, URL, thứ tự tab hoặc remount scene vì animation.

Kiểm tra mới: Mobile lint/typecheck qua, Vitest 124/124; Android Hermes export 2.769 modules / 62 assets qua. Android Expo Go / Pixel_5 Android 36 mở icon-only Home và thông báo thật rỗng; chuyển qua lại, chụp được frame scene bên phải đi vào. Home sau cuộn giữ nguyên bounds tiêu đề trước/sau đổi tab [55,510][1025,579]. Thử Reduce Motion bằng animator_duration_scale=0 rồi chuyển Home/Thông báo, không thấy ReactNativeJS/AndroidRuntime error; đã khôi phục setting về trạng thái ban đầu. Không xem screenshot cuối chuyển cảnh là bằng chứng FPS.

Máy ảo có System UI ANR lúc khởi động; đã chọn Wait trước kiểm tra app. Chưa kiểm tra iOS, Staff với phiên hợp lệ hoặc FPS release/device. Ảnh/XML tại .expo/tab-slide-qa (ignored). Các tiến trình API/Metro/emulator do QA mở đã dừng. Không sửa backend, bật demo hoặc ghi dữ liệu nghiệp vụ production.

Nguồn đối chiếu: [React Navigation tab animations](https://reactnavigation.org/docs/bottom-tab-navigator/#animations) và code navigator được bundle trong Expo Router đang cài.

## Giữ thanh hiện khi đổi tab (29/10/2026)

Theo yêu cầu mới, mất focus không còn đưa progress về 0. Scene cũ giữ capsule ở vị trí đang có khi trượt ra, đồng thời vẫn khóa touch/accessibility ở scene không focus. Scene mới hiện bar ngay khi focus, không chạy slide-up/fade-in vì chuyển tab. Chỉ thay đổi hướng scroll mới chạy hide/show animation; ngoại lệ keyboard vẫn ẩn tức thì để không che input và hiện lại khi đóng.

Tách policy worklet navigationVisibilityTransition để kiểm tra các chuỗi blur/focus/idle/scroll/keyboard. Thêm bốn regression tests: blur không hide; tab cũ từng hidden hiện ngay khi trở lại; chỉ scroll mới animate; keyboard không làm phát sinh slide khi đổi focus. Mobile lint/typecheck qua; tổng 35 file / 131 test qua (bao gồm thay đổi timeout API đang có trong working tree).

Android Expo Go đang chạy Metro của người dùng: Home → Thông báo → Home, màn Thông báo thật rỗng và vẫn thấy bốn icon tab sau khi chuyển. Không restart/clear data/đăng xuất hoặc gửi mutation. Chưa đo frame-by-frame cho toàn bộ chuyển cảnh, chưa iOS hay runtime Staff có quyền; Staff dùng cùng controller. Giữ thay đổi timeout API có trước, không commit/push trong lượt sửa này.

## Sửa Home cuộn xuống nhưng bar vẫn hiện (29/10/2026)

Phản hồi tiếp theo chỉ ra trường hợp Home có scroll range thật nhưng ngắn hơn khoảng đệm bar. Reducer và layout reaction trước đó cùng trừ reservedBottom, ép visible=true nên đã bỏ qua gesture Home. Bỏ phép trừ này ở cả hai nơi: chỉ coi trang không cuộn được khi content không vượt viewport (dung sai 1dp). Giữ padding layout để không che mục cuối, threshold 12dp/top reveal 24dp, focus không hide và xử lý bounce/keyboard hiện có.

Thêm regression dùng metrics Home content 870dp / viewport 745dp: cuộn xuống từng bước làm hidden, tiếp tục xuống giữ hidden, đảo lên 14dp hiện lại. Test trang không cuộn được vẫn visible. Mobile lint/typecheck qua; 35 file / 132 test qua.

Đã thử trực tiếp Android Expo Go tại kích thước/cỡ chữ đang có, không thay system settings: Home đầu trang có bốn tab; swipe lên để cuộn xuống thì XML không còn tab và screenshot xác nhận capsule rời viewport; swipe ngược lại hiện bốn tab. Bounds tiêu đề lần lượt [55,832][1025,901] → [55,510][1025,579] → [55,628][1025,697], xác nhận có scroll thật và không cần về đầu mới show. Bằng chứng ignored tại .expo/home-bar-scroll/home-top, home-down, home-up (XML/PNG). Không ghi nghiệp vụ production; chưa iOS/Staff runtime có quyền. Các hàng QA cũ về padding-only Home mô tả bản trước sửa, không phải hành vi hiện tại.

## Mở rộng trang duyệt và footer đồng bộ (29/10/2026)

Phạm vi người dùng đã duyệt: giữ bốn icon và mở thanh sang trang duyệt, tách form hỗ trợ; sau đó yêu cầu action footer hạ xuống khi bar ẩn. Không thêm tab, role switch hoặc API mới.

| Trang | Tab được chọn | UI |
| --- | --- | --- |
| `/search`, `/events/[eventId]`, `/events/[eventId]/venue` | Khám phá | CustomerBrowseScreen chung; Search giữ draft/bàn phím, event/venue có action footer chuyển động |
| `/tickets/[ticketId]/venue` | Vé của tôi | Cùng component địa điểm, guard và dữ liệu vé cũ |
| `/tickets/offline` | Vé của tôi | Danh sách bản tải có bar; mở một đơn chuyển tới cùng URL với bookingId, vùng vé/QR không có bar |
| `/refunds`, `/reports`, `/support` | Tài khoản | List/loading/empty/error thật, cùng controller scroll |
| `/support/new` | Không có bar | Form riêng, cùng memory draft support theo bookingId và validation/mutation thật |

`CustomerBrowseScreen` gom cấu hình chrome để không lặp controller hoặc animation theo trang. `TabBar` có onReselect khi đang ở trang con: chạm icon được chọn quay về root nhóm; chạm tab tại root tiếp tục giữ scroll/params. Không tạo lại navigator cho trang con, giữ URL Stack và 79 frame.

SupportScreen hiện là danh sách; SupportRequestScreen giữ phần form cũ. Các link hỗ trợ có bookingId từ đơn/vé/payment-status mở thẳng `/support/new`; link cũ `/support?bookingId=...` vẫn giữ context khi bấm Gửi yêu cầu mới. Không đổi gửi request/response, khóa gửi lặp hoặc điều kiện thành công. Không thêm bar vào Auth/OTP, chọn suất/ghế, checkout, QR, form hồ sơ/ngân hàng/report và thread trả lời hỗ trợ.

### Sửa action footer bị treo khi bar ẩn

`FloatingActionFooter` đặt overlay, translateY theo cùng shared progress của bar: visible thì nâng nút lên trên capsule với gap, hidden thì trở về safe-area đáy. `actionFooterLayout` tính lift từ clearance/inset và dự phòng kích thước trước onLayout; chiều cao footer được đo lại khi nội dung/font thay đổi. ScrollView giữ viewport và khoảng đệm theo chiều cao đo được, không set React state từng frame hoặc thay đổi viewport trong animation, tránh tự phát sinh scroll ngược làm bar nhấp nháy. Chỉ màn có cả bottomNavigation và footer mới dùng cơ chế này; checkout/forms cũ giữ footer thường.

### Kết quả và giới hạn

- Mobile lint/typecheck: qua. Vitest 36 files / 137 tests qua; thêm năm case footer/safe-area/measured height. Kiểm tra routes có `/support/new`, `/support/[requestId]`, không trùng URL và đủ 79 frame vẫn qua.
- Android Hermes export sau sửa footer: qua, 2.776 modules / 62 assets; đây là kiểm tra bundle, không thay thế các bước native ở dưới.
- Android Expo Go, Metro đang chạy của người dùng: Search, event thật từ catalog, event venue theo session thật; refund/report/support/offline list rỗng thật. Mỗi trang có bốn icon và tab highlight đúng nhóm. Không gán record giả để mở màn.
- Native reselect: Search → Khám phá, Support → Tài khoản, Offline → Vé của tôi đều về đúng root và có bốn icon. Support list → form không có bar, gõ nháp cục bộ → back → mở lại giữ nội dung; đã xóa phần nháp QA, không gửi form.
- Event footer sau bổ sung gap 12dp theo phản hồi: khi bar hiện, chữ Đặt vé ở [476,1869][604,1924]; khi ẩn, chữ xuống [476,2078][604,2133] (209px / 76dp); cuộn ngược trở lại vị trí ban đầu. Gap tăng thêm 33px/12dp phía trên vùng hệ thống so với lần đầu sửa footer, vị trí khi bar hiện giữ nguyên. Capsule biến mất/hiện đồng thời, không cần về đầu. Ảnh/XML `footer-visible`, `footer-hidden`, `footer-restored` trong `.expo/browse-navigation-qa` ignored. Lint/typecheck và 137 tests đã chạy lại và qua sau chỉnh padding.
- Một lượt thao tác gặp LogBox “Cannot connect to Expo CLI”; kiểm tra Metro vẫn running, dismiss cảnh báo và reload từ Expo Go để nhận đủ module mới rồi kiểm tra lại. Không sửa node_modules hoặc tắt LogBox toàn app.
- Chưa có dữ liệu vé tải xuống trên tài khoản QA: chưa chạy runtime trang QR offline/địa điểm từ vé. Code đã dựng, không tạo/cache vé mẫu. Chưa gửi support, tạo booking/payment hoặc ghi nghiệp vụ hosted PRODUCTION. Chưa iOS/Staff runtime hợp lệ, TalkBack hoặc đo FPS release/device.

File bổ sung: `components/customer-browse-screen.tsx`, `navigation/action-footer-layout.ts` + test, `navigation/floating-action-footer.tsx`, `support/screens/support-request-screen.tsx`, route `support/new.tsx`. Sửa Screen/TabBar, các screen trong bảng, các link support theo bookingId và tài liệu. Giữ thay đổi timeout/focus/Home trước đó; không commit/push trong lượt này.

## Bàn giao commit/push theo yêu cầu tiếp theo (29/10/2026)

Gom các thay đổi đang có của F-11 (mở rộng điều hướng/footer, giữ bar khi chuyển tab, sửa Home scroll) và F-12 (timeout Render riêng Mobile). Giữ cả các merge commit đã pull từ main. Chỉ đưa source Mobile và tài liệu vào commit; `.env.local`, ảnh/XML, script chẩn đoán và bundle `.expo` đều ignored.

Kiểm tra trước commit: `pnpm lint` 3/3 task qua (2 cached), `pnpm typecheck` 7/7 qua (6 cached), `pnpm test` 6/6 qua (5 cached), Mobile chạy mới 137/137; Portal build qua với cảnh báo chunk >500 kB. Backend test 212/212, không skipped; Release build 0 warnings/errors. UI-kit không có test files, không tính là test UI/native. Docker image/pgTAP chưa chạy vì thiếu Docker và Supabase CLI trên máy, không chạy lên hosted production. Không tuyên bố GitHub Actions đã xanh từ các kiểm tra local này.
