# Dữ liệu mẫu đã công bố

Project: `ddourrslmudoqevqlvpv`. Việc duyệt/công bố được người dùng xác nhận sau đợt nhập nháp. Không sửa schema/migration/backend hoặc dữ liệu tài khoản có trước.

## Trạng thái hiện tại đã đọc lại

| Nhóm           | Kết quả                                                                       |
| -------------- | ----------------------------------------------------------------------------- |
| Tổ chức        | 2 APPROVED, qua submit_kyc/review_kyc bằng tài khoản mẫu có MFA thật          |
| Sự kiện        | 4 PUBLISHED, Customer chưa đăng nhập đọc được                                 |
| Home           | 4 sự kiện, 2 nổi bật; cả hai API trả 200                                      |
| Danh mục       | 4: Âm nhạc, Sân khấu, Hội thảo, Thể thao                                      |
| Suất           | 5 ON_SALE theo trạng thái server/cron                                         |
| Hạng vé        | 12, đã bỏ tiền tố khỏi tên                                                    |
| Chỉnh nội dung | 35 bản ghi: tổ chức/danh mục/venue/layout name/cổng/event/session/ticket type |

Tên sự kiện hiện tại:

- Đêm nhạc Thành phố lên đèn.
- Vở kịch Chuyến tàu cuối ngày.
- Ngày hội công nghệ cộng đồng.
- Ngày hội vận động cuối tuần.

Tên/slug/mô tả/điều khoản sự kiện, danh mục, venue, suất, hạng vé và tên/code cổng đã bỏ chữ DEMO. Nội dung mô tả vẫn nói rõ là dữ liệu mẫu khi phù hợp. UUID/quan hệ tenant, giá/quota/tồn kho giữ nguyên. Hai sự kiện Đêm nhạc và Ngày hội công nghệ được đánh dấu nổi bật.

Tài liệu dùng trong bước duyệt là bản khai thử nghiệm loại `OTHER` trong bucket riêng tư, ghi rõ không phải giấy phép, giấy tờ cá nhân hoặc chứng cứ xác minh pháp lý. Review note và legal_info giữ dấu nhận diện dữ liệu mẫu. Không tạo giấy phép/chứng minh thư giả, không giả claim MFA, không gán thẳng trạng thái để vượt RPC.

## Chữ DEMO còn lại và giới hạn

- **5 tên khu, section của 60 ghế và definition của 2 layout version đã publish còn chữ DEMO.** Database khóa các bản ghi này bằng trigger bất biến. Chưa sửa, không tắt trigger và không đổi ID ghế/kho để lách khóa. Vì vậy màn sơ đồ/chọn khu vẫn có thể hiện tiền tố. Muốn loại bỏ hoàn toàn cần phiên bản sơ đồ mới và quy trình chuyển các suất/kho tương ứng; contract hiện tại không hỗ trợ sửa layout của suất đang bán qua save_session.
- **7 tài khoản mẫu giữ tên/email đăng nhập hiện có.** Bước đổi danh tính tài khoản bị phê duyệt tự động chặn; đã loại phần đó khỏi thao tác thực thi. Các metadata xác thực và nhãn MFA chưa bị thay đổi.
- Lịch sử audit/KYC, dataset tag trong app_metadata và manifest nguồn giữ thông tin nhận diện mẫu; không xóa lịch sử hoặc đổi raw manifest làm lệch hash journal.

Không kết luận đã xóa mọi chữ DEMO trong toàn database. Phần giao diện danh sách/chi tiết sự kiện, danh mục, suất, hạng vé và venue đã được kiểm qua API; sơ đồ còn giới hạn nêu trên.

## Tài khoản và bảo vệ thông tin

7 user được tạo ở đợt trước: Owner A/B, Staff A/B, Customer A/B, reviewer. Email vẫn là `tickey-demo-<alias>@example.com`. Hai Owner và reviewer đã enroll/verify TOTP thật để gọi RPC cần MFA. Role và mật khẩu không đổi trong đợt dọn nhãn.

Nhật ký chứa mật khẩu ngẫu nhiên và secret MFA được mã hóa toàn bộ bằng Windows DPAPI CurrentUser: `supabase/imports/local/platform-demo.import-state.json`. Đã chuyển an toàn từ Windows principal của sandbox sang tài khoản Windows người dùng bằng RSA-OAEP/AES-GCM rồi mã hóa lại DPAPI; không xuất plaintext, các file handoff mã hóa tạm đã xóa. File chỉ giải mã được dưới đúng Windows user, không phải backup portable. Thư mục được Git ignore.

Không đưa credential vào app, chat, Git hoặc CSV/Markdown. Không thay email/mật khẩu/quyền của người dùng có trước.

## Chạy và kiểm tra

```powershell
pnpm data:test
dotnet run --project backend/src/EventPlatform.Api
pnpm dev:mobile
```

Bộ dữ liệu đã nhập/công bố, không cần import lại. Giữ journal, không xóa hoặc chọn --state mới để chạy lại RPC tạo dữ liệu. Importer kiểm trạng thái PUBLISHED khi journal đã có receipt công bố, không yêu cầu dữ liệu quay về DRAFT.

Manifest nguồn: [platform-demo.dataset.json](../supabase/imports/platform-demo.dataset.json). Công cụ nhập ban đầu: [import-demo-data.mjs](../supabase/scripts/import-demo-data.mjs). Nhập dữ liệu thật theo [SUPABASE_DATA_IMPORT.md](SUPABASE_DATA_IMPORT.md).

Kịch bản bảo trì nằm trong `supabase/scripts/publish-demo-data.mjs` và `clean-demo-labels.mjs`; không đóng gói vào app. Lệnh `pnpm data:demo:publish --confirm-project ddourrslmudoqevqlvpv` công bố theo RPC, còn `pnpm data:demo:labels --confirm-project ddourrslmudoqevqlvpv` dọn nhãn mutable. Hai lệnh dùng cùng journal và bỏ qua bước đã thành công. `pnpm data:test` chạy đủ 28 tests. Đã kiểm 23 tests importer + 5 tests bảo trì; đã gọi GET qua API .NET cho Home/categories/detail/sessions/ticket-types và xác nhận HTTP 200 với dữ liệu thật. Không dùng fixtures để khẳng định UI native đã chạy.

Chưa chạy UI native sau cập nhật này, chưa đặt vé/check-in/phát hành/thanh toán/hoàn tiền hoặc tạo QR/gateway result giả. Không push/merge/deploy hoặc phát hành app. Sau cập nhật dữ liệu, kéo xuống Home hoặc Reload Expo Go để tải lại query cache.
