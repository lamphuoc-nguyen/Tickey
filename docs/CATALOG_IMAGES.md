# Bổ sung ảnh catalog

## Kết quả cuối đã kiểm tra

Đã upload thành công bốn ảnh qua backend người dùng chạy ngoài sandbox, lưu cover qua `save_event` và đọc lại bằng public API. Kiểm tra độc lập ngày 21/10/2026 xác nhận 4/4 URL trả HTTP 200, Content-Type image/png; Cloudinary có đúng bốn asset trong hai folder `tickey/event-assets/89ae5967-9a33-456c-bd0b-5057ee22de9d` và `tickey/event-assets/91d68f64-a10c-4d6a-8b66-2d363ae04573`. Mỗi folder có hai ảnh. Receipt của cả bốn event có `saved=true`; báo cáo kiểm tra nằm trong file local bị ignore `supabase/imports/local/catalog-images.live-verification.json`.

Chưa kiểm tra native hoặc upload ảnh private live. Logo, avatar và map vẫn chưa được bổ sung. Mobile hiện cấu hình API ở `http://192.168.1.5:5080`, còn API dùng để nhập ảnh ở `http://127.0.0.1:508`; cần chạy backend ngoài sandbox với địa chỉ/cổng khớp cấu hình thiết bị trước khi xác nhận hiển thị trên app. Không tự sửa env của người dùng trong lượt xác minh này.

Các mục sự cố phía dưới ghi lại những lần thử trước khi upload hoàn tất.

Ngày 21/10/2026: người dùng yêu cầu tạo ảnh còn thiếu, tải Cloudinary và cập nhật Supabase của nhóm. Đã tạo bốn ảnh gốc bằng công cụ built-in `image_gen` và lưu tại `assets/catalog/`; prompt đầy đủ, SHA-256 và mapping event key nằm trong `assets/catalog/manifest.json`.

| Sự kiện trong bộ dữ liệu đã nhập | Ảnh minh họa |
| --- | --- |
| Đêm nhạc Thành phố lên đèn | `dem-nhac-thanh-pho.png` — sân khấu acoustic, thành phố lúc lên đèn |
| Vở kịch Chuyến tàu cuối ngày | `chuyen-tau-cuoi-ngay.png` — mỹ thuật sân khấu nhà ga cuối ngày |
| Ngày hội công nghệ cộng đồng | `ngay-hoi-cong-nghe.png` — hoạt động robot và công nghệ cộng đồng |
| Ngày hội vận động cuối tuần | `ngay-hoi-van-dong.png` — chạy bộ và vận động trong công viên |

Các ảnh là artwork quảng bá được tạo theo yêu cầu, không phải ảnh chụp sự kiện đã diễn ra. Không được dùng làm bằng chứng KYC/report hoặc bản đồ địa điểm. Không thay avatar người dùng, logo tổ chức hay sơ đồ địa điểm bằng ảnh tự suy diễn. Không thêm ảnh vào fallback của app: Customer vẫn đọc URL thật từ server.

## Trạng thái thực tế

- Ảnh đã tạo, xem và lưu trong repo; không còn phụ thuộc đường dẫn generated_images của Codex.
- Sau khi khởi động lại Codex và cấp quyền mạng bằng công cụ của phiên, audit hosted đã chạy thành công: 4/4 sự kiện công khai thiếu cover, 2/2 tổ chức thiếu logo, 2/2 địa điểm thiếu map, 13/13 hồ sơ thiếu avatar. Không tự tạo map/ảnh cá nhân hoặc bằng chứng.
- Lệnh apply đã dừng trước upload vì không giải mã được journal Windows DPAPI trong sandbox (`CryptographicException`). Đã thử cấp quyền đọc kho khóa nhưng vẫn không giải mã được. Chưa upload Cloudinary hoặc cập nhật cover Supabase; không thể nói đã đồng bộ. Chạy lệnh bằng PowerShell thông thường dưới tài khoản Windows đã tạo journal; không xuất credential plaintext để xử lý lỗi này.
- Thử cấu hình Codex permission profile mới gây lỗi `failed to load workspace requirements: invalid input parameter`; người dùng xác nhận đã gỡ khối vừa thêm. Chưa xác định nguyên nhân lỗi chỉ từ thông báo này. Không thay đổi cấu hình bảo mật của máy bằng script dự án.
- Công cụ bổ sung hiện có 14 test local qua. Backend đã thêm `asset_folder` có chữ ký để tách `tickey/event-assets/<org-id>`, `tickey/kyc-private/<org-id>` và `tickey/report-evidence/<user-id>`; 129/129 test backend qua sau cập nhật folder. Chưa kiểm thử upload/delivery live hay hiển thị trên native với bộ artwork này.
- Trong sandbox Windows hiện tại, test host không ghi được Event Log. Chạy lại với `Logging__EventLog__LogLevel__Default=None` trong môi trường tiến trình kiểm thử thì 129/129 qua; không sửa cấu hình logging production hoặc bỏ kiểm tra quyền upload. Có một API đang giữ cổng 5080; cần dừng/chạy lại từ terminal của người dùng để chắc chắn nạp thay đổi `asset_folder` trước khi upload.
- Lượt người dùng chạy ngoài sandbox đã giải mã journal được nhưng lỗi kết nối tới API local. Đối chiếu sau lỗi: cổng 5080 chưa có API lắng nghe, Cloudinary không có asset trong hai prefix tổ chức, bốn cover Supabase vẫn null. Đã sao lưu receipt lỗi vào thư mục local bị ignore, ghi bằng chứng đối chiếu và khôi phục đúng một upload intent chưa gửi thành công. Không xóa toàn bộ receipt hoặc tạo lại dataset. Backend đã khởi động lại và health trả `status=ok`; chờ người dùng chạy lại lệnh ngoài sandbox.
- Sau lần thử tiếp theo, log API chạy trong sandbox cho thấy Windows Schannel không lấy được TLS credentials khi gọi Supabase Auth, trước bước gọi Cloudinary. Event Log bị từ chối làm phản hồi request bị đứt, để lại intent chưa rõ. Đã đối chiếu Cloudinary lần nữa (không có asset dưới hai prefix) và cover Supabase vẫn null, sao lưu rồi khôi phục đúng receipt đó. API phải được chạy trong terminal Windows thông thường; không tắt kiểm tra chứng chỉ TLS hoặc đổi quyền tài khoản. `/health` đơn thuần không chứng minh backend truy cập Supabase được.
- Kiểm tra lại bộ test nhập dữ liệu trong sandbox: 27/28 qua, một test Windows DPAPI round-trip không chạy thành công do hạn chế crypto của môi trường. Không bỏ bảo vệ mã hóa hoặc đánh dấu test đó đã qua.

## Chạy từ PowerShell thông thường

Backend cần cấu hình Supabase và Cloudinary như [CLOUDINARY_SETUP.md](CLOUDINARY_SETUP.md). Dừng API cũ nếu đang chạy và mở một terminal để nạp bản có cấu hình thư mục mới:

```powershell
cd D:\Tickey
dotnet run --project backend/src/EventPlatform.Api
```

Ở terminal thứ hai, kiểm tra thiếu ảnh trước; lệnh `plan` chỉ đọc dữ liệu:

```powershell
cd D:\Tickey
node supabase/scripts/complete-catalog-images.mjs plan
```

Lệnh `apply` kiểm tra `/health` và `/api/categories` trước khi giải mã journal hoặc ghi upload intent, xác nhận cả tiến trình lẫn khả năng đọc Supabase. Giữ terminal backend đang chạy trong lúc nhập ảnh. Nếu kết nối bị từ chối, script báo rõ cần khởi động backend; lỗi từ chối kết nối được xác nhận không gửi tới API sẽ không khóa replay. Timeout, mất phản hồi hoặc lỗi HTTP vẫn giữ trạng thái chưa rõ để đối chiếu, không tự upload lại.

Nếu cổng 5080 đang có API sandbox không sử dụng được TLS, chạy API trong PowerShell thông thường trên cổng riêng, rồi truyền URL tường minh:

```powershell
# Terminal 1: giữ tiến trình chạy; cần cùng tài khoản Windows có backend user-secrets.
cd D:\Tickey
dotnet run --no-restore --project backend/src/EventPlatform.Api -- --urls http://127.0.0.1:5081

# Terminal 2
cd D:\Tickey
node supabase/scripts/complete-catalog-images.mjs apply --confirm-project ddourrslmudoqevqlvpv --api-url http://127.0.0.1:5081
```

`--api-url` chỉ chấp nhận HTTP trên `127.0.0.1` hoặc `localhost`, không chấp nhận host bên ngoài, user/password, query hoặc path để tránh gửi JWT nhầm nơi. Không thay đổi env Mobile hoặc tự fallback sang API khác. Sau bảo trì, chạy backend dùng cho app từ terminal thông thường với địa chỉ/cổng khớp cấu hình app.

Trong lần chạy do người dùng mở sau đó, backend thực tế lắng nghe tại `127.0.0.1:508` (không phải 5081). Đã xác nhận `GET http://127.0.0.1:508/api/categories` trả bốn danh mục từ Supabase. Khi dùng đúng tiến trình này, truyền `--api-url http://127.0.0.1:508` cho lệnh apply. Không coi việc chỉ thấy dòng “Now listening” hoặc health thành công là upload đã hoàn tất.

Khi muốn thực hiện yêu cầu bổ sung ảnh đã được cho phép:

```powershell
node supabase/scripts/complete-catalog-images.mjs apply --confirm-project ddourrslmudoqevqlvpv
```

Công cụ đọc cấu hình backend local, không nhận secret qua tham số hoặc in token. Chỉ bổ sung bốn event thuộc bộ dữ liệu đã nhập và journal mã hóa hiện có; kiểm tra project, dataset hash, event ID, slug/title, tenant và checksum PNG trước khi ghi. Không tạo thêm dữ liệu nghiệp vụ, đổi trạng thái sự kiện, sửa migration hoặc cập nhật tài khoản.

Upload dùng `POST /api/uploads` với JWT chủ tổ chức đã được tạo bởi đợt nhập trước; endpoint thực hiện kiểm tra quyền và chọn Cloudinary. Sau khi upload trả URL hợp lệ, script gọi RPC `save_event` bằng JWT đó, chỉ gửi `id` và `cover_image_url`; không PATCH trực tiếp bảng bằng service key. Service key chỉ được dùng cho audit tổng hợp các nhóm ảnh, không xuất dữ liệu hồ sơ cá nhân.

Ảnh đã có được giữ nguyên, kể cả khi phát hiện người khác vừa bổ sung trong lúc upload. RPC hiện chưa có compare-and-set theo giá trị ảnh cũ: không chạy song song chỉnh ảnh của cùng event trong thời gian bảo trì. Có lock local chống chạy hai bản script trên cùng máy; lock không bảo vệ được một người sửa trên máy khác.

Receipt `supabase/imports/local/catalog-images.receipt.json` nằm trong thư mục bị Git ignore. Nó ghi nhận trước khi upload và lưu URL đã nhận. Nếu mất phản hồi upload, script dừng thay vì tự tạo asset trùng; cần đối chiếu Cloudinary và receipt trước khi tiếp tục. Không xóa lock khi còn một tiến trình đang chạy. Nếu upload đã xác nhận nhưng lưu event lỗi, lần sau dùng lại URL; nếu server đã lưu ảnh dù mất phản hồi, script đọc lại và giữ ảnh đó.

Sau lưu, công cụ đọc lại event bằng khóa public và kiểm tra HEAD URL ảnh. Chỉ báo hoàn tất nếu các bước thực sự trả kết quả tương ứng. Refresh app để tải lại catalog; không hardcode artwork trong app.

## Upload tự lưu Cloudinary tới đâu?

Với backend hiện tại nạp `MediaStorage:ImageProvider=Cloudinary`, JPEG/PNG/WebP qua `POST /api/uploads` tự vào Cloudinary: event asset công khai; KYC/report dùng authenticated delivery. PDF vẫn Supabase. Cấu hình này chỉ áp dụng backend đã nạp secret, chưa tự triển khai lên server khác.

Upload trả file URL/path; nó **không tự lưu mọi liên kết vào Supabase**. Flow lưu event/report/KYC cần gửi URL/path cho endpoint/RPC lưu dữ liệu tương ứng. Việc thay đổi provider không tự chuyển ảnh cũ, không nối các màn Portal còn dùng mock và không tự sửa ảnh thiếu. Công cụ bảo trì này nối hai bước upload và lưu cover cho đúng bốn event đã kiểm tra.

## Kiểm thử

```powershell
node --test supabase/scripts/complete-catalog-images.test.mjs
```

14 test local: giữ ảnh cũ, intent trước upload, chặn upload trùng khi chưa rõ kết quả, tiếp tục URL đã xác nhận, giữ ảnh người khác vừa thêm, không lưu khi upload lỗi, xác nhận server sau lưu, trạng thái không cho sửa, kiểm tra provider/tenant/delivery URL, phân biệt kết nối bị từ chối với timeout, readiness đọc Supabase thật, chặn API chỉ healthy ở cấp tiến trình nhưng lỗi kết nối upstream và giới hạn API URL ở loopback. Fixtures chỉ phục vụ kiểm thử, không phải dữ liệu runtime.
