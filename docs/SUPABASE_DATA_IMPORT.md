# Nhập dữ liệu thật của nhóm vào Supabase

Bổ sung theo yêu cầu mới: bộ DEMO đã nhập lên project của nhóm bằng công cụ riêng; xem [SUPABASE_DEMO_DATA.md](SUPABASE_DEMO_DATA.md) để biết số lượng, trạng thái đã công bố và giới hạn. Công cụ/mẫu trong tài liệu này vẫn dành cho dữ liệu thật.

Công cụ: `supabase/scripts/import-platform-data.mjs`. Chạy từ thư mục gốc repo bằng Node >= 22 và pnpm theo `packageManager`. Không cần cài thêm dependency; không cần backend .NET đang chạy vì công cụ gọi Supabase Auth/PostgREST trực tiếp.

Project đích của nhóm là `ddourrslmudoqevqlvpv`, được README đánh dấu **PRODUCTION**. Link Dashboard chỉ xác định nơi nhập, không cung cấp nội dung cần nhập. Hiện nhóm chưa cung cấp file dữ liệu nguồn; mẫu trong repo cố ý để trống, không tạo sự kiện, tài khoản hay giao dịch mẫu. Công cụ đã được kiểm thử cục bộ; **chưa chạy nhập dữ liệu lên project này**.

## Phạm vi toàn nền tảng

| Vùng                                                                      | Dữ liệu có thể chuẩn bị/nhập                                                | Cách thực hiện                                                                                                                                    |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tài khoản chung                                                           | Liên kết UUID tài khoản thật với người thực hiện                            | Tài khoản đã đăng ký và xác nhận email bằng Auth; công cụ không tạo user/password, không tự xác nhận email                                        |
| Portal Org                                                                | Tổ chức, thành viên, địa điểm, layout, sự kiện, suất diễn, hạng vé, gán ghế | Các RPC đang có; server giữ kiểm tra tenant, role, MFA, trạng thái và sinh tồn kho                                                                |
| Mobile Customer                                                           | Danh mục và catalog thật để Home/Search/đặt vé đọc                          | Category được nhập bằng SQL tham chiếu; catalog phải qua quy trình công bố và thời gian bán hợp lệ                                                |
| Mobile Staff                                                              | Thành viên Org, phân công suất/cổng, vùng cổng                              | `set_org_member`, `assign_staff`, `set_session_gate_zones`; không tạo log quét/check-in giả                                                       |
| Portal Admin                                                              | Thành viên platform đầu tiên, hồ sơ KYC/quyết định kiểm duyệt thật          | SQL tham chiếu cấp role đã được nhóm duyệt; RPC kiểm duyệt bởi tài khoản thật                                                                     |
| Tài chính Org/Admin                                                       | Đề nghị tài khoản nhận tiền và quyết định duyệt thật                        | `request_bank_account_change`, `review_bank_account`                                                                                              |
| Đơn, thanh toán, vé, hoàn tiền, ledger, settlement/payout, báo cáo/hỗ trợ | Không nhập lịch sử giả, không tự đánh dấu thành công                        | Phát sinh qua nghiệp vụ thật/worker. Nếu có lịch sử thật cần chuyển hệ thống, phải có mapping và quy trình đối soát riêng; script này chưa hỗ trợ |
| Storage, signing/gateway secrets, P1 B2B/voucher/chuyển nhượng            | Không nhập bằng công cụ này                                                 | Upload tài liệu/ảnh thật qua chức năng đã có; cấu hình secret riêng. Không suy ra quyền ghi chỉ vì có bảng dữ liệu                                |

Không dùng `supabase/seed.sql` cho hosted project: file đó dành cho demo local, có tài khoản/mật khẩu test. Công cụ mới không chạy seed, reset, migration, không sửa backend/schema, không tắt trigger/RLS và không giả claim `aal2`.

## 1. Chuẩn bị nguồn dữ liệu

Cần nhóm chốt các dữ liệu sau, theo phạm vi thực tế cần mở:

- Danh mục: slug, tên, thứ tự.
- Tài khoản đã xác nhận: UUID của Owner/Admin/Staff, email thành viên Org, role được nhóm phê duyệt. Không cần mật khẩu trong file nhập.
- Tổ chức: tên, slug, loại hình; thông tin KYC và đường dẫn chứng từ thật nếu gửi duyệt.
- Địa điểm/layout: địa chỉ, múi giờ, sức chứa, định nghĩa khu/ghế thật; code khu và cổng thực tế.
- Sự kiện/suất: tên, slug, category, nội dung, URL ảnh đã upload, thời gian diễn/mở cửa/mở bán có múi giờ.
- Hạng vé: loại, giá nguyên theo đơn vị contract, quota, thời gian bán, chính sách, mapping khu/ghế cụ thể.
- Phân công: UUID Staff, suất, cổng, permissions và thời hạn thực tế.

Nếu nguồn là CSV/Excel, cần map cột sang manifest JSON dưới đây trước khi nhập. Công cụ **không tự đoán mapping CSV**, chọn zone đầu tiên, sinh tên/giá/ngày sự kiện hay bổ sung dữ liệu còn thiếu. `plan` chỉ kiểm cấu trúc manifest và tên/tham số RPC; validation nghiệp vụ, foreign key, quota và quyền vẫn do server kiểm tra.

Tạo bản làm việc được Git bỏ qua; lệnh copy sẽ dừng nếu file đã tồn tại:

```powershell
New-Item -ItemType Directory -Force supabase/imports/local
if (Test-Path supabase/imports/local/platform-data.local.json) {
  throw 'File dữ liệu đã tồn tại; mở file đó để sửa, không ghi đè.'
}
Copy-Item supabase/imports/platform-data.example.json supabase/imports/local/platform-data.local.json

# Mẫu trống chỉ kiểm cấu trúc offline, không gọi Supabase
pnpm data:plan --file supabase/imports/local/platform-data.local.json
```

Không commit dữ liệu nhập, hồ sơ KYC/bank, kết quả SQL hoặc nhật ký import. `.gitignore` đã bỏ qua `supabase/imports/local/` và file `*.import-state.json`/lock/temp. File ngoài các đường dẫn này không tự được bảo vệ.

## 2. Cấu trúc manifest và tham chiếu

Các giá trị trong dấu `<...>` dưới đây là chỗ cần thay bằng dữ liệu thật, **không phải bộ dữ liệu chạy sẵn**:

```json
{
  "formatVersion": 1,
  "projectRef": "ddourrslmudoqevqlvpv",
  "actors": {
    "owner": {
      "userId": "<UUID Auth của Owner>",
      "tokenEnv": "TICKEY_IMPORT_OWNER_TOKEN"
    }
  },
  "referenceData": {
    "categories": [],
    "platformMemberships": [],
    "gates": []
  },
  "steps": [
    {
      "id": "org",
      "actor": "owner",
      "kind": "rpc",
      "rpc": "create_organization",
      "args": {
        "p_name": "<Tên tổ chức thật>",
        "p_slug": "<slug-thật>"
      }
    },
    {
      "id": "venue",
      "actor": "owner",
      "kind": "rpc",
      "rpc": "save_venue",
      "args": {
        "p": {
          "tenant_id": { "$ref": "org" },
          "name": "<Tên địa điểm thật>",
          "address_line": "<Địa chỉ thật>",
          "city": "<Thành phố thật>",
          "timezone": "Asia/Ho_Chi_Minh"
        }
      }
    },
    {
      "id": "layout",
      "actor": "owner",
      "kind": "rpc",
      "rpc": "create_layout",
      "args": {
        "p_venue_id": { "$ref": "venue" },
        "p_name": "<Tên layout thật>"
      }
    }
  ]
}
```

Ví dụ trên chỉ mô tả cú pháp; chưa có định nghĩa layout/suất/vé nên chưa đủ để mở bán. Với tổ chức hoặc địa điểm đã có, dùng UUID thật hoặc bước `select` thay vì tạo lại. Tên actor không phải role: server kiểm quyền dựa trên tài khoản thật.

- UUID trả trực tiếp: `{ "$ref": "venue" }`.
- Trường trong response: `{ "$ref": "layout", "path": ["layout_version_id"] }`.
- Danh sách ID từ kết quả đọc: `{ "$ref": "zone-list", "path": ["*", "id"] }`.
- Chỉ được tham chiếu step đã khai báo trước, không chạy biểu thức/code từ file dữ liệu.

Bước đọc để lấy đúng khu sau khi publish layout:

```json
{
  "id": "zone",
  "actor": "owner",
  "kind": "select",
  "table": "zones",
  "columns": ["id"],
  "filters": {
    "layout_version_id": { "$ref": "layout", "path": ["layout_version_id"] },
    "code": "<code khu đã publish>"
  },
  "expect": "one"
}
```

Đọc qua RLS bằng JWT của actor. `expect: "one"` yêu cầu đúng một record; 0 record không bị coi là thành công. `expect: "many"` trả array, có thể rỗng; `limit` tối đa 1000. Yêu cầu tổng số record chính xác, dừng nếu server cắt trang; chia nhỏ filters để đọc đủ. Không hỗ trợ `select *`, join tùy ý hoặc raw SQL trong bước nhập.

### RPC được hỗ trợ

Tên/tham số dưới đây đối chiếu implementation SQL trong checkout, không phải REST camelCase của .NET. `p` và `p_definition` là JSON **snake_case/định nghĩa layout đúng contract**, không đổi cả payload sang camelCase.

| RPC                           | Tham số bắt buộc                                                  | Tham số tùy chọn                             |
| ----------------------------- | ----------------------------------------------------------------- | -------------------------------------------- |
| `create_organization`         | `p_name`, `p_slug`                                                | `p_business_type`                            |
| `set_org_member`              | `p_org_id`, `p_email`, `p_roles`                                  | —                                            |
| `submit_kyc`                  | `p_org_id`, `p_legal_info`, `p_identity_number`, `p_documents`    | —                                            |
| `review_kyc`                  | `p_submission_id`, `p_decision`                                   | `p_note`                                     |
| `save_venue`                  | `p`                                                               | —                                            |
| `create_layout`               | `p_venue_id`, `p_name`                                            | —                                            |
| `save_layout_draft`           | `p_layout_version_id`, `p_definition`                             | —                                            |
| `publish_layout_version`      | `p_layout_version_id`                                             | —                                            |
| `save_event`                  | `p`                                                               | —                                            |
| `save_session`                | `p`                                                               | —                                            |
| `save_ticket_type`            | `p`                                                               | —                                            |
| `assign_seats_ticket_type`    | `p_session_id`, `p_seat_ids`, `p_ticket_type_id`                  | —                                            |
| `submit_event_for_review`     | `p_event_id`                                                      | —                                            |
| `review_event`                | `p_event_id`, `p_decision`                                        | `p_note`                                     |
| `set_session_gate_zones`      | `p_session_id`, `p_config`                                        | —                                            |
| `assign_staff`                | `p_session_id`, `p_user_id`, `p_permissions`                      | `p_gate_id`, `p_valid_from`, `p_valid_until` |
| `request_bank_account_change` | `p_org_id`, `p_bank_code`, `p_account_number`, `p_account_holder` | —                                            |
| `review_bank_account`         | `p_bank_account_id`, `p_decision`                                 | `p_note`                                     |

Thứ tự nghiệp vụ thường dùng:

1. Chuẩn bị Auth users thật; SQL tham chiếu cho category và Admin đã được nhóm duyệt nếu chưa có.
2. Tạo Org/thành viên; gửi hồ sơ KYC thật. Người có quyền kiểm duyệt xử lý hồ sơ thật, không thêm bước duyệt tự động chỉ để có catalog.
3. Tạo venue → layout → lưu định nghĩa thật → publish. Server tạo zones/seats; không tự insert chúng hoặc dùng ID khu trong draft thay UUID sau publish.
4. Tạo event nháp → session với layout đã publish → hạng vé/mapping zone/ghế. `save_session`/`save_ticket_type` tạo tồn kho phía server; không tự nhập `session_seats` hay bộ đếm sold/locked.
5. Gửi duyệt event; chỉ gọi `review_event` khi thật sự `PENDING_REVIEW` và có quyết định phù hợp. RPC dùng `APPROVED` / `CHANGES_REQUESTED` / `REJECTED`, khác alias `APPROVE` của REST. Có trường hợp server tự công bố theo quy tắc, không gọi review thêm.
6. Tạo cổng tham chiếu sau khi có UUID venue thật; lấy đúng gate/zone IDs, cấu hình cổng và phân công Staff. `p_config` là array `{gate_id, zone_ids}` và **thay toàn bộ mapping cổng của suất**, không chỉ thêm từng dòng.

`set_org_member` cần email của user đã có; không tự cấp Staff bằng email suy đoán. Role thành viên như `SCANNER`/`POS` khác permissions phân công như `SCAN`/`MANUAL_CHECKIN`/`POS`. Giữ nguyên role/permission đúng schema và quyền được nhóm phê duyệt.

`save_session.p` cần ít nhất quan hệ `event_id`, `venue_id`, `layout_version_id` và các trường bắt buộc trong schema; thời điểm là ISO 8601 có offset. `save_ticket_type.p` chứa `session_id`, loại/giá/quota/thời gian bán và `zone_ids` thực. Không mặc định giá hoặc quota của nhóm. Backend quyết định liệu tổ chức/event/session có đủ điều kiện bán và hiển thị công khai; import thành công không đồng nghĩa đã mở bán.

Ảnh và chứng từ không được upload bởi công cụ. Upload file thật trước bằng chức năng hiện có; dùng URL/path trả về. `submit_kyc` kiểm đường dẫn tài liệu thuộc Org; không gửi đường dẫn giả. Việc duyệt KYC/bank/event phải là quyết định thật của người có thẩm quyền.

## 3. Dữ liệu tham chiếu và SQL để review

`referenceData` chỉ hỗ trợ ba nhóm chưa có RPC tạo tương ứng trong checkout:

| Nhóm                  | Trường mỗi dòng                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| `categories`          | `slug`, `name`, `sort_order` tùy chọn                                                                       |
| `platformMemberships` | `user_id` UUID thật, `roles` gồm role đã duyệt: `KYC_REVIEWER`, `FINANCE_ADMIN`, `DISPUTE_ADMIN`, `SUPPORT` |
| `gates`               | `tenant_id`, `venue_id` UUID thật, `code`, `name`                                                           |

`data:import` **chỉ chạy steps**, không tự ghi `referenceData`. Sau khi điền dữ liệu tham chiếu thật:

```powershell
pnpm data:bootstrap --file supabase/imports/local/platform-data.local.json --confirm-project ddourrslmudoqevqlvpv --out supabase/imports/local/reference-data.local.sql
```

Lệnh này **chỉ tạo file SQL**, không kết nối hoặc chạy database. File output phải chưa tồn tại. Người quản trị review nội dung và kiểm đúng project/connection trước khi thực thi; project ref trong chú thích không phải cơ chế xác minh kết nối database. Mọi lần ghi hosted vẫn cần được nhóm cho phép riêng.

SQL dùng transaction, kiểm user Auth đã xác nhận/profile, tenant của venue và không ghi đè dữ liệu/quyền đang có nếu khác. Không ghi Auth users/password/secret hoặc nâng MFA. Khối payload base64 dùng để tách dữ liệu khỏi cú pháp SQL, **không mã hóa bảo mật**; file SQL vẫn chứa dữ liệu thật.

Nếu có cả category/Admin và gate chưa có venue: dùng các manifest tham chiếu riêng theo từng giai đoạn. Nhập category/Admin trước; tạo venue bằng RPC rồi điền UUID venue thật vào manifest gate. Transaction tham chiếu sẽ rollback nếu bất cứ dòng nào không hợp lệ. Không sửa manifest RPC đã chạy chỉ để thêm gate vì journal ràng buộc hash toàn manifest.

## 4. Xác thực bằng tài khoản thật

Không dùng service_role/`sb_secret_...` để thay quyền người dùng. Công cụ yêu cầu publishable/anon key và access token Supabase của từng actor đúng project. Không đặt token/refresh token/password trong JSON hoặc tham số CLI. Không lấy token từ phiên người khác.

Nhóm cần có luồng đăng nhập/MFA thực để lấy access token của người thực hiện, ví dụ phiên Portal đã đăng nhập. Không phải token Dashboard hay khóa API. Token hết hạn thì đăng nhập/refresh hợp lệ rồi cập nhật biến môi trường, không sửa claims. RPC nhạy cảm vẫn yêu cầu MFA thực; `data:check` không vượt qua hay chứng minh toàn bộ quyền nghiệp vụ.

Nhập trong PowerShell để giá trị không xuất hiện trong lịch sử lệnh:

```powershell
$importPublicKey = Read-Host -AsSecureString 'Supabase publishable/anon key'
$env:SUPABASE_IMPORT_ANON_KEY = [System.Net.NetworkCredential]::new('', $importPublicKey).Password
$importOwnerToken = Read-Host -AsSecureString 'Owner access token từ phiên đăng nhập thật'
$env:TICKEY_IMPORT_OWNER_TOKEN = [System.Net.NetworkCredential]::new('', $importOwnerToken).Password
# Làm tương tự cho từng tokenEnv đã khai báo, ví dụ TICKEY_IMPORT_ADMIN_TOKEN

pnpm data:check --file supabase/imports/local/platform-data.local.json
```

`check` chỉ GET `/auth/v1/user`, xác minh UUID/email confirmed của từng actor trên server. JWT decode cục bộ chỉ giúp phát hiện sai tài khoản/hết hạn; server mới xác minh chữ ký. `apply` cũng kiểm lại Auth trước khi chạy steps; role, tenant, MFA và quyền đọc/ghi do RLS/RPC thực thi.

Hosted URL cố định theo project ref; URL tùy chỉnh khác project bị chặn. Để kiểm thử môi trường local thực, đặt `projectRef: "local"`, dùng key/token của local và tùy chọn `SUPABASE_IMPORT_URL` trỏ loopback (mặc định `http://127.0.0.1:54321`). Không dùng token của hosted cho local hay ngược lại.

## 5. Nhập và theo dõi kết quả

Chỉ chạy sau khi dữ liệu, quyền người thực hiện và việc ghi project đích đã được nhóm cho phép:

```powershell
pnpm data:plan --file supabase/imports/local/platform-data.local.json
pnpm data:check --file supabase/imports/local/platform-data.local.json
pnpm data:import --file supabase/imports/local/platform-data.local.json --confirm-project ddourrslmudoqevqlvpv
```

`plan` không gọi mạng; `check` chỉ đọc; **`data:import` ghi dữ liệu thật**. Manifest trống không được import. Không tự chuyển lỗi sang mock, không tự retry HTTP.

Nhật ký mặc định là `<manifest>.import-state.json`; có thể đặt `--state <path>`. Cần giữ **cùng file manifest và journal** khi tiếp tục. Journal ràng buộc hash manifest/project, lưu kết quả từng step và bỏ qua step đã thành công; không lưu token/args yêu cầu. Kết quả đọc có thể có dữ liệu cá nhân, không chia sẻ journal công khai.

- RPC có transaction riêng; **toàn bộ import không phải một transaction**. Nếu bước sau lỗi, các bước trước vẫn tồn tại.
- Trước request ghi, lưu trạng thái `started`. HTTP 4xx JSON hợp lệ ghi `rejected`; sửa nguyên nhân quyền/token/dữ liệu phù hợp rồi mới xem xét chạy tiếp. Nếu sửa manifest đã chạy, không tạo journal mới tùy tiện: cần đối chiếu record thật và chuẩn bị đợt tiếp theo bằng UUID hiện có.
- Mất phản hồi, HTTP 5xx, response sai contract hoặc crash giữa thao tác sẽ giữ `started`/`uncertain`; công cụ chặn replay. Người quản trị phải kiểm record/audit thật để xác định thao tác đã commit chưa, rồi mới quyết định cách phục hồi journal. Không đoán là thất bại để gửi lại.
- Lock chỉ bảo vệ **cùng đường dẫn state**. Không chạy đồng thời bằng state khác, không xóa/đổi tên journal để nhập lại, vì RPC tạo mới không có idempotency chung. Sau crash chỉ xóa lock cũ khi chắc chắn tiến trình đã dừng; vẫn phải xử lý trạng thái chưa rõ trong journal.
- SQL tham chiếu không có journal RPC; bản thân SQL kiểm dữ liệu trùng/khác và không ghi đè âm thầm.

Sau khi thao tác xong, xóa biến môi trường chứa token khỏi terminal hiện tại:

```powershell
Remove-Item Env:SUPABASE_IMPORT_ANON_KEY, Env:TICKEY_IMPORT_OWNER_TOKEN -ErrorAction SilentlyContinue
# Xóa cả các tokenEnv khác đã đặt, ví dụ Env:TICKEY_IMPORT_ADMIN_TOKEN
```

## Kiểm thử và giới hạn bàn giao

```powershell
pnpm data:test
pnpm data:plan --file supabase/imports/platform-data.example.json
```

14 tests Node kiểm tra contract với migration trong checkout, manifest rỗng/sai, target/key/actor, reference IDs, SQL generation, Auth preflight, HTTP payload thật, MFA rejection, journal/lock trên đĩa, resume, phản hồi mất/sai và kết quả đọc bị cắt trang. HTTP chạy qua server kiểm thử cục bộ; fixtures chỉ ở file test, không phải dữ liệu nhập runtime.

Chưa thực thi SQL sinh ra trên PostgreSQL, chưa kiểm RLS/RPC/trigger của deployment hosted, chưa nhập dữ liệu nhóm hoặc xác nhận catalog trên các app sau import. Không có `psql`/Docker khả dụng trong phiên kiểm tra này. Kiểm cấu trúc/tests không thay thế đợt kiểm thử database thực và đối chiếu migration đang được deploy. Cần dữ liệu nguồn thật cùng quyền thực hiện phù hợp trước khi chạy nhập.
