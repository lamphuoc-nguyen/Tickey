# Cloudinary — ảnh công khai và ảnh riêng tư

Đã kiểm chứng live ngày 21/10/2026: bốn ảnh cover được upload qua API, lưu vào Supabase qua RPC và đọc lại từ catalog; cả bốn URL ảnh trả HTTP 200. Media Library đã có folder thật theo hai tổ chức, mỗi folder hai ảnh. Chi tiết tại [CATALOG_IMAGES.md](CATALOG_IMAGES.md). Upload private và hiển thị native vẫn chưa được kiểm chứng; các giới hạn “chưa upload live” phía dưới thuộc lượt kiểm tra cấu hình ban đầu.

API .NET lưu ảnh mới lên Cloudinary; Supabase tiếp tục giữ Auth, dữ liệu nghiệp vụ và quyết định quyền truy cập. Mobile/Portal nhận URL từ API, không chứa Cloudinary API secret hoặc tự ký request. Không cần thêm Cloudinary SDK vào Expo.

## Cấu hình trên máy phát triển

Cloudinary Console → Settings → API Keys: lấy Cloud name, API key và API secret của đúng product environment. Không cần bật unsigned upload preset.

Từ thư mục repo, chạy trong PowerShell:

```powershell
.\backend\scripts\configure-cloudinary.ps1
.\backend\scripts\configure-cloudinary.ps1 -CheckOnly
.\backend\scripts\test-cloudinary-connection.ps1
```

Script đầu hỏi Cloud name và nhập ẩn key/secret, dùng stdin để merge vào **user-secrets của EventPlatform.Api**, không sửa Supabase/payment secrets. Chạy dưới cùng tài khoản Windows dùng để chạy backend. `-CheckOnly` chỉ báo có/thiếu trường cấu hình; script test gọi **GET /ping** có xác thực, không upload/xóa ảnh và không in secret. Ping thành công chỉ xác nhận kết nối/xác thực, không thay kiểm thử upload hoặc delivery thật.

Sau khi lưu, dừng rồi chạy lại API để nạp cấu hình:

```powershell
dotnet run --project backend/src/EventPlatform.Api
pnpm dev:mobile
```

Các trường backend:

| Trường | Ý nghĩa |
| --- | --- |
| `MediaStorage:ImageProvider` | `Cloudinary` hoặc `Supabase`; giá trị khác làm startup lỗi. Mặc định repo là Supabase, script cấu hình chọn Cloudinary tường minh. |
| `Cloudinary:CloudName` | Product environment dùng để upload và đọc ảnh. |
| `Cloudinary:ApiKey` | API key của backend. |
| `Cloudinary:ApiSecret` | Chỉ nằm trong user-secrets/secret store. |
| `Cloudinary:PublicIdPrefix` | Mặc định `tickey`; không đổi sau khi đã tạo file mà chưa có kế hoạch chuyển dữ liệu. |

Không thêm `EXPO_PUBLIC_CLOUDINARY_API_SECRET`, `VITE_CLOUDINARY_API_SECRET` hoặc `CLOUDINARY_URL` có secret vào frontend. Expo Image đọc URL HTTPS thật từ catalog như trước.

## Cấu hình server được triển khai

Đặt các biến trong secret/environment settings của dịch vụ API, không commit giá trị thật:

```text
MediaStorage__ImageProvider=Cloudinary
Cloudinary__CloudName=<cloud name>
Cloudinary__ApiKey=<API key>
Cloudinary__ApiSecret=<API secret>
Cloudinary__PublicIdPrefix=tickey
```

Chỉ cấu hình local trong lượt triển khai này; không sửa hosting, deploy hoặc cấu hình account Cloudinary từ xa. Worker không cần Cloudinary để phát hành vé. Nếu bật provider nhưng thiếu/sai định dạng cấu hình, API dừng startup với lỗi cấu hình, không tự dùng nhà cung cấp khác.

## Upload giữ contract hiện có

`POST /api/uploads`, Authorization Bearer là session Supabase của người dùng, multipart:

- `file`: JPEG, PNG, WebP hoặc PDF, tối đa 10 MB theo contract cũ.
- `purpose`: `EVENT_ASSET`, `REPORT_EVIDENCE` hoặc `KYC`.
- `orgId`: bắt buộc cho `EVENT_ASSET` và `KYC`.

| Dữ liệu | Ảnh JPEG/PNG/WebP khi chọn Cloudinary | Quyền upload thực |
| --- | --- | --- |
| EVENT_ASSET | Cloudinary `type=upload`, có `public_url` HTTPS | OWNER hoặc EVENT_MANAGER của đúng org |
| KYC | Cloudinary `type=authenticated`, `public_url=null` | OWNER của đúng org |
| REPORT_EVIDENCE | Cloudinary `type=authenticated`, `public_url=null` | Người dùng đã được Supabase Auth xác thực, thư mục theo ID xác thực |
| PDF | Vẫn Supabase Storage theo contract cũ | Storage RLS hiện có |

Response vẫn là `{ bucket, path, public_url }`. Bucket là nhóm dữ liệu logic; khi ảnh ở Cloudinary, **không** dùng bucket/path để ghép URL Supabase.

- Ảnh Cloudinary dùng path dạng `<owner-id>/cloudinary/<uuid>.png`. Prefix `<user-id>/` hoặc `<org-id>/` giữ tương thích `submit_report` và `submit_kyc`, không cần migration.
- Cloudinary public ID là `tickey/<bucket>/<owner-id>/<uuid>`; không phụ thuộc tên file do client gửi.
- Upload đặt `asset_folder=tickey/<bucket>/<owner-id>` tường minh để Media Library có thư mục riêng theo loại dữ liệu và tổ chức/tài khoản, kể cả ở chế độ dynamic folders. `public_id` giữ nguyên để không làm hỏng URL hoặc cách ký truy cập file cũ. Tham số thư mục nằm trong chữ ký backend, không do frontend tự quyết định.

```text
tickey/
  event-assets/<org-id>/
  kyc-private/<org-id>/
  report-evidence/<user-id>/
```

Folder được tạo khi upload đầu tiên thành công; không đổi folder đồng nghĩa đổi quyền. Ảnh private vẫn dùng `authenticated`. Với dynamic folders, public ID có dấu `/` không đủ tạo folder trong Media Library; xem [Cloudinary asset_folder](https://cloudinary.com/documentation/image_upload_api_reference#optional_parameters).

- `EVENT_ASSET`: lưu **public_url** vào `coverImageUrl`/trường URL hiện có. Không lưu path thay URL ảnh.
- KYC/report: lưu **path** vào `storage_path`/`attachmentPaths`; không lưu URL có hạn hoặc đưa ảnh riêng tư vào URL công khai.
- API gọi Supabase Auth để xác thực JWT thật và các RPC `has_org_role`/`has_platform_role` để áp quyền tương đương Storage policy trong phần 1300 của migration. Không tin role/org/user ID do client tự nhận.
- Upload ký SHA-256 ở backend, giới hạn format, không overwrite và không tự retry/fallback nếu Cloudinary lỗi. Lỗi provider/malformed success trả lỗi, không trả link giả.

## Mở ảnh/file riêng tư

`POST /api/uploads/access` với Authorization Bearer và JSON:

```json
{
  "purpose": "REPORT_EVIDENCE",
  "path": "<path đã lưu từ response upload>"
}
```

Chỉ nhận purpose `REPORT_EVIDENCE` hoặc `KYC`. Server xác thực lại người xem rồi trả `{ url, expires_at }`, có `Cache-Control: no-store` và thời hạn **120 giây**.

| Nhóm | Quyền đọc tương đương Storage RLS |
| --- | --- |
| Report evidence | Chủ thư mục hoặc DISPUTE_ADMIN |
| KYC | OWNER của tổ chức hoặc KYC_REVIEWER |

Ảnh Cloudinary dùng `authenticated` cho cả bản gốc và các biến thể; API tạo liên kết download có hạn tương đương `private_download_url`. Không dùng `type=private` vì biến thể có thể công khai theo cơ chế Cloudinary. Link được cấp là bearer capability: người có link dùng được đến khi hết hạn; sau thu hồi role, yêu cầu cấp link mới bị chặn, link đã cấp có thể còn dùng được trong thời hạn đó.

File cũ không mang segment `cloudinary` được ký qua Supabase Storage bằng JWT người gọi, giữ kiểm tra Storage SELECT RLS. Không tự chuyển file cũ, xóa bucket hoặc thay đường dẫn trong database. Khi đổi provider upload về Supabase, giữ Cloudinary credentials/prefix nếu còn ảnh Cloudinary cần đọc.

`HttpMediaRepository` trong `@event/core` cung cấp `upload(form)` và `privateAccess({purpose,path})`. Gọi privateAccess khi mở file, giữ URL trong bộ nhớ ngắn hạn và bỏ khi đóng/đổi account/workspace; không ghi vào AsyncStorage/database, log hoặc cache chung. Customer `uploadEvidence` hiện có giữ nguyên contract và tự đi qua provider được server chọn.

## Giới hạn tích hợp

- Không thêm UI hoặc dữ liệu giả. Ảnh catalog hiển thị bằng URL server như trước; không tự gán ảnh mẫu cho sự kiện.
- Avatar/profile, venue cover hoặc các trường mới chưa có contract lưu/upload riêng không được tự phát minh. Cloudinary phục vụ những purpose thật đã có.
- Wrapper mới không đồng nghĩa các màn Portal hiện dùng mock đã được nối toàn bộ backend. Việc hiển thị lịch sử attachment/private preview ở các màn chưa có contract vẫn cần công việc frontend/backend riêng.
- Không di chuyển PDF sang Cloudinary trong phạm vi ảnh; PDF vẫn trên Supabase và có thể dùng endpoint access để đọc theo quyền.
- Chưa upload/delivery E2E với tài khoản nghiệp vụ thật, chưa kiểm tra ảnh private trên native hoặc thời điểm link hết hạn bằng mạng thật. Không dùng test fixture để tuyên bố upload live thành công.

## Kiểm tra

```powershell
dotnet test --solution backend/EventPlatform.sln
pnpm --filter @event/core test
pnpm --filter @event/core typecheck
pnpm --filter @event/mobile typecheck
```

Kết quả kiểm tra local ngày 21/10/2026:

| Kiểm tra | Kết quả |
| --- | --- |
| Backend tests | 129/129 qua; HTTP dependency được cô lập, không gọi upload thật. |
| Core tests | 73/73 qua, gồm validation/upload/private-access wrapper. |
| Typecheck core, Mobile, Portal | Qua. |
| Mobile lint | Qua. |
| Cloudinary có xác thực | GET ping thành công bằng cấu hình local; không upload hoặc xóa asset. |
| API startup/local HTTP | Khởi động Development tại cổng 5080; health trả 200; private access không đăng nhập trả 401. |
| Kiểm tra credential | Không có API key/secret đã cấu hình trong file repo thay đổi hoặc env frontend được kiểm tra. |
| Upload/delivery live và native | Chưa kiểm tra. |

Hai chỉnh sửa tương thích frontend: wrapper media dùng khai báo constructor phù hợp `erasableSyntaxOnly` của Portal; bổ sung lại style `ui.secure` mà màn Staff hiện có đang tham chiếu. Không thay đổi nghiệp vụ Staff hoặc thêm thông điệp hướng dẫn vào Customer.

Kiểm thử HTTP dependency dùng handler cô lập, không ghi hosted Supabase/Cloudinary. Bao gồm provider config, signature, authenticated delivery, tenant/user/role isolation, private-link expiry, malformed response, giữ file cũ và không fallback khi upload lỗi.

Nguồn chính thức: [Upload API và xác thực](https://cloudinary.com/documentation/image_upload_api_reference), [chữ ký](https://cloudinary.com/documentation/authentication_signatures), [authenticated assets và private download](https://cloudinary.com/documentation/control_access_to_media), [Admin API ping](https://cloudinary.com/documentation/admin_api#ping), [Supabase signed URL implementation](https://github.com/supabase/storage-js/blob/master/src/packages/StorageFileApi.ts).
