# Xác nhận email Tickey khi dùng Expo Go và Gmail trên máy tính

## Trường hợp đang gặp

App chạy trong Android emulator, Gmail mở trên Windows. Liên kết `exp://...` mở trên Windows không tự mở app trong emulator. Nếu link Supabase còn hợp lệ, server có thể đã xác nhận email rồi mới redirect về trang không chạy. Trang `localhost:3000` không kết nối được không đủ để kết luận email chưa xác nhận. Ngược lại, `error_code=otp_expired` nghĩa là link bị Supabase từ chối: hết hạn, đã dùng hoặc không hợp lệ; không thể khôi phục link đó bằng cách đổi backend .NET.

Code app dùng Supabase Auth SDK qua `@event/core`; backend .NET không gửi email thay Supabase và không tự xác nhận tài khoản bằng service role. Chỉnh code backend không tự cập nhật Dashboard của project hosted.

## Bấm Tạo tài khoản nhưng báo Không thể kết nối sau khi cấu hình Resend

Thông báo cũ không đủ để kết luận thiết bị mất mạng: SDK Auth đang cài bọc cả phản hồi HTTP 500 thành `AuthRetryableFetchError`, còn app trước đây chuyển tất cả lỗi đó thành `NETWORK`. App hiện phân biệt request không có phản hồi với lỗi HTTP từ dịch vụ xác thực. Lỗi `Error sending confirmation email` hiện thành thông báo chưa thể gửi email xác thực; lỗi server khác không tự bị kết luận là lỗi SMTP. Chi tiết SMTP không hiển thị cho người dùng.

Để tìm nguyên nhân trên project hosted:

1. Mở [Auth Logs](https://supabase.com/dashboard/project/ddourrslmudoqevqlvpv/logs/auth-logs), chọn request `/signup` đúng thời điểm lỗi và đọc trường `error`. Nếu là lỗi database/trigger, xử lý database thay vì đổi SMTP. Chỉ gửi phần lỗi cần thiết khi nhờ hỗ trợ; che email, token, mật khẩu và API key.
2. Trong Supabase → Emails → SMTP Settings, đối chiếu Resend: Host `smtp.resend.com` (không thêm `https://`), Port `465`, Username `resend`, Password là API key Resend còn hiệu lực. Sender email phải thuộc domain đã xác minh trên Resend; không dùng địa chỉ Gmail làm sender cho domain riêng. Bấm Save sau khi chỉnh.
3. Trong Resend → Domains, kiểm tra domain dùng cho sender có trạng thái Verified và DNS theo yêu cầu. Nếu chỉ dùng `onboarding@resend.dev`, chỉ gửi thử đến email của chính tài khoản Resend; muốn gửi cho người dùng khác cần domain đã xác minh. Kiểm tra log gửi email của Resend nếu có.
4. Thử lại sau khi sửa cấu hình. Nếu Supabase báo tài khoản đã tồn tại hoặc email chưa xác nhận, dùng đăng nhập / gửi lại email xác nhận thay vì tạo tài khoản liên tiếp. Giữ xác nhận email bật.

Nguồn: [Resend SMTP cho Supabase](https://resend.com/docs/send-with-supabase-smtp), [lỗi domain và giới hạn gửi thử của Resend](https://resend.com/docs/api-reference/errors), [Supabase Auth error codes](https://supabase.com/docs/guides/auth/debugging/error-codes).

Kiểm tra chỉ đọc trong phiên xử lý này: URL trong cấu hình mobile trỏ đến project `ddourrslmudoqevqlvpv`; `/auth/v1/health` và `/auth/v1/settings` trả HTTP 200 từ máy phát triển, signup/email provider bật và xác nhận email vẫn bật. Kết quả này không kiểm tra mạng emulator hoặc chứng minh SMTP hoạt động; chưa đọc Auth Logs và chưa đăng ký/gửi email thật trong phiên này.

Ảnh log Resend do người dùng cung cấp sau đó xác nhận HTTP 403 `Domain not verified` cho sender `noreply@Tickey.com`. Khi chưa sở hữu domain, đổi **Sender email address** trên Supabase thành `onboarding@resend.dev`, giữ Sender name `Tickey` và thông số SMTP Resend. Chỉ đăng ký thử bằng email gắn với tài khoản Resend đó. Để gửi cho người nhận khác qua Resend, cần domain sở hữu hoặc được cấp quyền quản lý DNS và xác minh trên Resend; domain gửi email không yêu cầu app phải có website hoặc đổi callback Expo.

Kiểm thử bổ sung cho phân loại lỗi: Core 42/42 test qua, Core và Mobile typecheck qua. Test dùng phản hồi HTTP giả qua SDK Supabase đang cài để kiểm lỗi gửi email và lỗi database không bị gộp thành lỗi mạng, không gọi hosted signup hoặc gửi email thật.

## Cách thử ngay với email hiện có

1. Nếu vừa mở được link xác nhận không báo `otp_expired`, quay lại app → màn xác nhận email → **Quay lại đăng nhập**. Đăng nhập bằng email/mật khẩu đã đăng ký. Kết quả server quyết định tài khoản đã xác nhận hay chưa.
2. Nếu link báo hết hạn, vào màn xác nhận trong app → **Gửi lại email**. Chỉ dùng email mới nhất, không bấm gửi nhiều lần liên tiếp vì mã/link cũ có thể bị thay thế và Supabase có giới hạn gửi.
3. Nếu app vẫn báo email chưa xác nhận, dùng cách OTP dưới đây sau khi người có quyền cập nhật mẫu email. Không tắt Confirm email hoặc đánh dấu confirmed bằng Admin API để bỏ qua xác thực.

## Chưa nhập OTP nhưng vẫn đăng nhập được

Quy tắc là email phải được Supabase xác nhận trước lần đăng nhập đầu tiên, không phải nhập OTP lại sau mỗi lần đăng xuất. Nhập mã, mở link xác nhận hợp lệ hoặc một luồng xác thực khác được server chấp nhận có thể khiến tài khoản đã có trạng thái xác nhận. Theo [tài liệu cấu hình Supabase](https://supabase.com/docs/guides/auth/general-configuration), tắt Confirm Email cũng ngầm xác nhận email trong database; bật lại không chứng minh tài khoản cũ chưa xác nhận.

Kiểm tra chỉ đọc trong phiên xử lý báo cáo này: mobile vẫn trỏ đến project `ddourrslmudoqevqlvpv`, `/auth/v1/settings` trả HTTP 200 với `mailer_autoconfirm=false`, signup và email provider bật. Người dùng cho biết thử bằng email mới, nhưng chưa có dữ liệu `email_confirmed_at` của tài khoản đó để xác định vì sao server cho đăng nhập. Không kết luận Confirm Email đang tắt và không sửa cấu hình hosted từ việc nhìn thấy `enable_confirmations=false` trong file local.

Repository nay bổ sung kiểm tra `user.email_confirmed_at` (không lấy cờ trong `user_metadata`):

- Đăng nhập có phản hồi thành công nhưng email chưa xác nhận: đăng xuất phiên hiện tại bằng `scope: 'local'`, trả lỗi `EMAIL_NOT_CONFIRMED` để màn hình hiển thị yêu cầu xác nhận / gửi lại email.
- Đăng ký nhận phiên chưa xác nhận: xóa phiên đó và vẫn đưa người dùng đến màn xác nhận.
- Session lưu trên máy hoặc nhận từ Auth event thiếu trạng thái xác nhận: không đưa vào trạng thái đăng nhập của app. Đọc session không thêm request mạng, giữ khả năng dùng phiên đã xác nhận khi offline.

Đây là kiểm tra bổ sung trong app; Supabase Confirm Email và kiểm tra quyền server vẫn là nơi thực thi bảo mật. Nếu server đã gán `email_confirmed_at`, app coi tài khoản đã xác nhận. Để chẩn đoán lần thử thực tế, mở Authentication → Users → đúng email vừa thử, xem thời điểm xác nhận email và đối chiếu Auth Logs. Không xóa tài khoản hoặc sửa timestamp để ép thử nghiệm trên project production.

Kiểm thử phiên này: Core 49/49, Mobile 59/59 và typecheck cả hai qua. Có kiểm thử với SDK đang cài cho HTTP 400 `email_not_confirmed`, phản hồi thành công nhưng chưa xác nhận, đăng ký và khôi phục session chưa xác nhận, cùng đăng nhập đã xác nhận. Chưa tái hiện bằng tài khoản mới trên hosted project và chưa kiểm tra UI native thật.

## Cách phù hợp cho Gmail Windows + Android emulator: nhập OTP trong app

Không cần thêm deep link để nhập OTP. Cần mẫu email hiển thị mã `{{ .Token }}` do Supabase tạo. Tuy nhiên project Free tạo từ **03/06/2026** đang dùng dịch vụ email mặc định bị hạn chế chỉnh template: phải cấu hình SMTP riêng trước khi áp mẫu OTP. SMTP riêng vẫn dùng được với project Free; không phải cứ thấy nhãn Free là không bật SMTP được. Xem [thay đổi chính thức của Supabase](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier).

1. Đăng nhập tài khoản **Supabase Dashboard** được mời vào tổ chức của nhóm; đây là tài khoản quản trị project, khác tài khoản người dùng đăng ký trong Tickey. Không dùng anon key hoặc service-role key để đăng nhập Dashboard.
2. Mở project **Event Ticket Booking**, ref `ddourrslmudoqevqlvpv`: [Dashboard project](https://supabase.com/dashboard/project/ddourrslmudoqevqlvpv).
3. Vào **Authentication → Email Templates / Emails → Confirm signup**. Tên nhóm menu có thể thay đổi theo Dashboard.
   Nếu editor bị khóa vì project Free dùng default email provider, nhờ người quản trị cấu hình **Emails → SMTP Settings** bằng thông số host/port/username/password của dịch vụ gửi email rồi quay lại **Templates**. Không nhập Supabase API key vào thông tin SMTP. Đây là cấu hình gửi email chung của project; mẫu HTML trong repo không tự cấu hình dịch vụ gửi.
4. Lưu bản sao mẫu đang dùng để có thể hoàn tác. Subject: `Xác nhận email Tickey`. Body: copy toàn bộ [supabase/templates/confirmation.html](../supabase/templates/confirmation.html). Mẫu chỉ có OTP, không có link tự dùng token khi bị trình quét email mở trước. Không đổi các mẫu recovery/magic link khác trong bước này.
5. Save, sau đó vào app chọn **Gửi lại email**. Email cũ không đổi nội dung sau khi sửa template.
6. Đọc mã trong Gmail trên Windows, nhập vào **Mã xác nhận email** trong app emulator rồi **Xác nhận email**. App gọi `verifyOtp({email, token, type:'email'})`; chỉ đi tiếp sau khi Supabase trả thành công và đọc lại session.

Nếu không thấy project hoặc không thể Save, nhờ chủ project mời đúng tài khoản Dashboard / kiểm tra quyền chỉnh Authentication và điều kiện SMTP của gói Free nói trên. Theo [Access Control](https://supabase.com/docs/guides/platform/access-control), Developer không được đổi project settings; nên nhờ Owner/Administrator thực hiện cấu hình thay vì suy ra quyền quản trị từ việc đọc được API key. Có API key hoặc đăng ký được tài khoản Tickey không đồng nghĩa có quyền chỉnh project. Không cần đưa service-role key vào mobile hoặc gửi token/mật khẩu cho người khác.

Trong **SMTP Settings**, switch màu xám có thể chỉ là trạng thái Off; ảnh tĩnh không xác định được quyền hiện tại. Nếu bấm không phản hồi, kiểm tra tooltip khi rê chuột và role của tài khoản tại Organization → Team. Không kết luận SMTP bị chặn chỉ vì project Free. OTP template được sửa ở tab **Templates**, còn SMTP Settings dùng để nhập dịch vụ gửi email thực.

Supabase hosted chỉ nhận template sau thao tác lưu trên Dashboard (hoặc Management API được cấp quyền). File trong repo không tự được áp dụng lên hosted project. Phiên sửa code này **chưa đọc hoặc thay đổi cấu hình hosted**, chưa gửi email kiểm thử hoặc xác nhận tài khoản production.

## Nếu cần bấm link để quay về app

Mở [Authentication → URL Configuration](https://supabase.com/dashboard/project/ddourrslmudoqevqlvpv/auth/url-configuration), thêm callback thực vào **Redirect URLs**, không thay Site URL chung của Portal chỉ để test app.

- Development/native build giữ scheme `eventcustomer`: callback signup `eventcustomer://auth/callback?type=signup`; recovery tương ứng `type=recovery`.
- Expo Go: callback có dạng `exp://<host-Metro>:<port>/--/auth/callback?type=signup` (recovery dùng `type=recovery`). Dùng đúng host/cổng của phiên Expo đang chạy, không dùng `<host-Metro>` nguyên văn. Có thể xem giá trị trong development debugger tại `Linking.createURL('auth/callback', {queryParams:{type:'signup'}})`; không log session, mã OTP hoặc full link trong email.
- Để tự mở app qua link, mở email trên chính thiết bị chạy app. Với Gmail Windows + emulator, dùng OTP hoặc quay lại đăng nhập; thêm redirect URL không làm Windows tự mở Android emulator.

Giữ callback chính xác trong allowlist; không mở wildcard cho mọi website. Sau khi sửa allowlist phải yêu cầu email mới. Callback `otp_expired` vẫn cần email mới, không biến thành thành công chỉ vì route tồn tại.

## Contract backend đã bổ sung

| Endpoint | Request / hành vi |
| --- | --- |
| `POST /api/auth/register` | Thêm tùy chọn camelCase `emailRedirectTo`; mã hóa thành một giá trị `redirect_to` trong URL GoTrue `/signup`. Thiếu trường này giữ hành vi Site URL cũ cho caller hiện hữu. |
| `POST /api/auth/resend-signup` | `{email, emailRedirectTo?}` → GoTrue `/resend`, body `{type:'signup',email}`. Không phải passwordless signup, không tự tạo tài khoản hoặc confirm bằng admin. |
| `POST /api/auth/otp/verify` | Contract cũ `{email,token}` → GoTrue `/verify`, type `email`; dùng được cho mã xác nhận email. Giữ response session/lỗi thật, không tạo mã hoặc session riêng. |

Callback phải là URI tuyệt đối http/https/exp/exps/eventcustomer, không credential/fragment/control character; Supabase vẫn kiểm allowlist project. API không tự thêm redirect URL lên Dashboard. Mobile tiếp tục dùng repository Auth SDK, không đổi sang relay để tránh phụ thuộc backend local cho đăng nhập. Cả hai đường dùng cùng Supabase Auth.

## Local và kiểm thử

Mẫu HTML có thể dùng cho Supabase local bằng cấu hình dưới đây trong `supabase/config.toml` nếu nhóm muốn test gửi email local:

```toml
[auth.email.template.confirmation]
subject = "Xác nhận email Tickey"
content_path = "./supabase/templates/confirmation.html"
```

Local hiện `enable_confirmations=false`; cần bật xác nhận trên **local** nếu muốn kiểm thử flow này. Không chạy reset/seed/test DB vào hosted project PRODUCTION. File config local không thay cấu hình hosted. Không tự khởi động lại stack local hoặc thay policy xác nhận của nhóm trong phiên này.

```powershell
pnpm --filter @event/mobile lint
pnpm --filter @event/mobile typecheck
pnpm --filter @event/mobile test
pnpm --filter @event/core test
# Isolate build output if the normal API executable is currently running.
$authTestArtifacts = Join-Path $env:TEMP "TickeyAuthEmailTests"
dotnet build backend/tests/EventPlatform.Tests/EventPlatform.Tests.csproj --artifacts-path $authTestArtifacts
dotnet "$authTestArtifacts/bin/EventPlatform.Tests/debug/EventPlatform.Tests.dll" --progress off
```

Backend tests dùng TestServer + handler riêng ở địa chỉ `.test`, không gọi Supabase nhóm. Chúng kiểm callback signup/resend, compatibility caller cũ, reject URI không hợp lệ, public credentials và giữ lỗi rate-limit/OTP hết hạn. Core/mobile tests kiểm mã nhập tay có khoảng trắng ngoài, sai định dạng và lỗi xác thực server. Kết quả email thật chỉ được kết luận sau khi owner lưu template và người dùng xác nhận thử bằng email mới.

Test project bật `UseMicrosoftTestingPlatformRunner` theo runner đã khai báo trong `global.json`, không nâng package/framework. Trên môi trường agent, `dotnet test` vẫn lỗi handshake và chạy 0 test; không báo lệnh đó thành công. Chạy trực tiếp assembly MTP như trên thực sự chạy các test. Không tắt API đang chạy của người dùng; build/test sử dụng output riêng.

Kết quả phiên sửa này: Mobile lint/typecheck qua, Core typecheck qua; Mobile 59/59, Core 33/33; backend build output riêng qua với 0 warning/error và MTP assembly trực tiếp chạy 56/56. Chưa gửi email/nhập OTP thật hoặc kiểm tra lại UI native của thay đổi email này; không dùng các unit fixture để tuyên bố xác nhận tài khoản đã hoạt động trên hosted project.

Nguồn chính thức: [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [resend](https://supabase.com/docs/reference/javascript/auth-resend), [template local](https://supabase.com/docs/guides/local-development/customizing-email-templates).
