# Floating navigation — Customer và Staff

Phạm vi được người dùng duyệt: cả hai giao diện trong một Expo app, giữ URL/tab/icon/quyền và nghiệp vụ. Chưa có ảnh tham khảo đính kèm trong lượt này; thực hiện theo mô tả floating pill, translucent, active capsule, scroll hide/show. Không bật Staff demo hoặc tạo dữ liệu nghiệp vụ để kiểm tra.

Cập nhật theo yêu cầu tiếp theo: bỏ nhãn chữ hiển thị trên cả Customer và Staff, chỉ giữ icon căn giữa; thanh cao 60dp, vùng chạm mỗi tab vẫn tối thiểu 44×48dp. Tên tab còn trong accessibilityLabel và navigation metadata. Lint/typecheck qua, Vitest 124/124 sau bỏ test chiều cao cho nhãn chữ không còn áp dụng. Chưa chạy lại native sau lần đổi sang icon-only; ảnh và kiểm tra native bên dưới ghi nhận bản có nhãn trước đó.

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
- `nextScrollDirection`: tích lũy cùng hướng 12dp rồi đổi target, reset phần tích lũy khi đảo hướng. Offset trong 24dp đầu trang luôn show. Bỏ qua rubber-band ở đáy và normalize content inset ở đầu iOS; scroll phát sinh ngoài drag/momentum không đổi target. Khi đứng yên giữ trạng thái. Nội dung không dài hơn viewport ngoài phần padding dành cho bar luôn show.
- `FloatingNavigationBar`: pill cao 60dp, cách hai bên 16dp, đáy `safeArea.bottom + 12dp`, icon 24dp, target tối thiểu 44×48dp; active capsule trượt giữa bốn vị trí. Chỉ hiển thị icon; giữ tên cho trình đọc màn hình. Có tab accessibility role/label/selected; lúc hidden bỏ hit testing và ẩn các tab khỏi accessibility tree.
- Hide 250ms, show 290ms, ease-out cubic; translateY bằng chiều cao + khoảng đáy + 40dp để cả shadow rời viewport, đồng thời opacity về 0. Animation dùng Reanimated trên UI thread và `ReduceMotion.System`. Keyboard mở ẩn bar, đóng hiện lại; không đổi layout hoặc padding theo progress nên nội dung không giật do thanh ẩn/hiện.
- Surface/tint tự theo system Light/Dark. iOS dùng GlassView khi cả hai availability check cho phép và Reduce Transparency đang tắt; nền tảng khác dùng nền translucent. Chưa thêm blur library hoặc hứa có blur native trên Android.
- `PersistentTabLayout`: lazy Tabs, freeze background scene, không animation chuyển screen; `router.navigate` thay cho replace khi bấm tab. Tab state gắn với account/workspace; đổi scope unmount scene để không giữ UI riêng tư của scope cũ. Giữ một AuthProvider và QueryClientProvider hiện có. Không đổi role, workspace contract, callback scheme hay API.
- `Screen` chỉ bọc controller nếu có `bottomNavigation`; `StaffFrame` dùng cùng controller/bar. Nội dung chừa khoảng đáy bằng bar + inset + gap + 16dp, không che mục cuối. Các fixed action footer/modal/horizontal scroll giữ nguyên.

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
