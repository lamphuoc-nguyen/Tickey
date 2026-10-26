# Deploy .NET API lên Render

Blueprint: `render.yaml` (service `tickey-api`, Docker, plan free, region singapore, health check `/health`).
Tài liệu này trả lời đúng một câu hỏi: **Render báo deploy failed thì xem gì.**

## 1. Biến môi trường phải tự điền trong dashboard

`render.yaml` đánh dấu `sync: false` cho những key không được commit — Render **không** tự tạo chúng, người vận hành
phải vào `Dashboard → tickey-api → Environment` điền tay. Dùng đúng tên có **hai dấu gạch dưới** (`__`) vì đó là cách
.NET map biến môi trường sang `Section:Key`.

| Biến | Thiếu thì sao | Giá trị |
| --- | --- | --- |
| `Supabase__AnonKey` | **Container chết lúc boot** | Publishable key `sb_publishable_…` |
| `Supabase__ServiceRoleKey` | **Container chết lúc boot** | Secret key `sb_secret_…`, chỉ backend được biết |
| `Payments__Test__HmacKey` | **Container chết lúc boot** (vì `Payments__Gateway=TEST`) | Chuỗi ngẫu nhiên đủ dài |
| `Api__PublicUrl` | Link quay về sau thanh toán hỏng | `https://tickey-api.onrender.com` (chính service này) |
| `Cors__Origins__0` | Portal bị trình duyệt chặn CORS | Origin của portal Vercel, ví dụ `https://tickey-portal.vercel.app` |
| `Qr__SigningKey` | Không phát được vé QR (booking vẫn PAID) | Seed Ed25519 |

Ba dòng đầu là **chết lúc boot**, qua hai cơ chế khác nhau — biết đúng cơ chế thì đọc stack trace nhanh hơn:
- Hai khoá Supabase: `AddEventPlatformCore` gọi `.ValidateOnStart()` cho 4 nhóm options
  (`backend/src/EventPlatform.Core/ServiceCollectionExtensions.cs:15-43`).
- `Payments__Test__HmacKey`: ctor `TestPaymentGateway` ném thẳng
  (`backend/src/EventPlatform.Core/Payments/IPaymentGateway.cs:68`), và gateway được resolve ngay lúc dựng host
  (`ServiceCollectionExtensions.cs:45-46`), nên ctor chạy lúc boot chứ không đợi request thanh toán đầu tiên.

Cả hai đều ném **trước khi** mở cổng 8080. Không có process nghe cổng → Render gọi `/health` không ai trả lời →
Render kết luận deploy failed, dù image hoàn toàn tốt.

**Trạng thái thực tế 2026-10-26:** dashboard có 9 key và **thiếu `Payments__Test__HmacKey`** — xem B-33.

Ba dòng sau **không** làm chết container: `Qr:SigningKey` có `if` bảo vệ (`Program.cs:68`), `Cors:Origins` và
`Api:PublicUrl` mặc định rỗng trong `appsettings.json`. Chúng chỉ làm hỏng tính năng.

Giá trị mặc định đã commit sẵn trong `render.yaml`, không cần điền: `PORT=8080`, `Supabase__Url`,
`Payments__Gateway=TEST`, `Qr__Kid=hosted-1`.

## 2. Phân biệt Build failed và Deploy failed

Render gộp hai thứ rất khác nhau vào một chữ "failed". Đọc **dòng cuối** của log trước khi đi sửa gì:

- `==> Build failed` → lỗi ở `docker build`. Trên plan free, nguyên nhân hay gặp nhất là hết RAM khi
  `dotnet publish` (exit code 137). Xem mục 3 để dựng lại.
- `==> Build successful` rồi sau đó timeout health check / container exit → **lỗi cấu hình, không phải lỗi code**.
  Hầu như luôn là thiếu một trong ba biến "chết lúc boot" ở mục 1. Mở tab Logs của service, tìm dòng
  `OptionsValidationException` — nó nói thẳng key nào thiếu.

Cả **hai** sự cố ngày 2026-10-26 đều thuộc trường hợp thứ hai, và cả hai đều là env thiếu:
- Lần 1 (sáng): thiếu khoá Supabase.
- Lần 2 (22:17, deploy `7e2d040` và `abc5b32`): thiếu `Payments__Test__HmacKey`. Khoá này **luôn** thiếu từ trước,
  nhưng chỉ thành chí mạng từ commit `7b397a1` — commit đó thêm `?? throw` vào ctor `TestPaymentGateway`. Tức là
  **một thay đổi code có thể biến một env vốn vô hại thành env giết boot**, mà không chạm gì tới `render.yaml`. B-33.

## 3. Dựng lại y như Render trên máy local

Từ 2026-10-26 repo **đã có `.dockerignore`** (B-32), nên `docker build` ngay tại thư mục repo là trung thực —
không còn cần `git archive` như bản trước của tài liệu này. `.dockerignore` theo kiểu allow-list: `*` loại mọi thứ
ở gốc rồi `!backend/` thêm lại đúng phần `Dockerfile` cần, nên `bin/`, `obj/` của máy dev không lọt vào context.
**Hệ quả:** thêm đường dẫn mới cho `Dockerfile` thì phải thêm dòng `!` tương ứng, nếu không `COPY` fail dù file đã commit.

```bash
MSYS_NO_PATHCONV=1 docker build -f ./Dockerfile -t tickey-api-repro .
```

Dựng lại lỗi boot (thiếu env var) — **đừng** dùng URL Supabase production, `AGENTS.md` mục 5:

```bash
MSYS_NO_PATHCONV=1 docker run --rm \
  -e Supabase__Url=https://example.invalid -e Payments__Gateway=TEST \
  tickey-api-repro
# → OptionsValidationException: Supabase:AnonKey is required; Supabase:ServiceRoleKey is required
```

Đối chứng với bộ biến đầy đủ (giá trị dummy là đủ để boot):

```bash
MSYS_NO_PATHCONV=1 docker run --rm -p 8080:8080 \
  -e Supabase__Url=https://example.invalid \
  -e Supabase__AnonKey=dummy -e Supabase__ServiceRoleKey=dummy \
  -e Payments__Gateway=TEST -e Payments__Test__HmacKey=dummy \
  tickey-api-repro
# → Now listening on: http://[::]:8080 ; curl localhost:8080/health → {"status":"ok"}
```

Trên Git Bash, `MSYS_NO_PATHCONV=1` là **bắt buộc** cho mọi lệnh docker.

Bỏ `-e Payments__Test__HmacKey` khỏi lệnh thứ hai là dựng lại đúng sự cố 2026-10-26 lần 2 (B-33).


## 4. Những gì CI kiểm và những gì CI không bao giờ kiểm được

Từ B-32 (`VERIFIED`, 2026-10-26), `.github/workflows/ci.yml` có 4 job và **đã** che phần build:

| CI có bắt được | CI **không** bắt được |
| --- | --- |
| `docker build -f Dockerfile` hỏng (job `docker`) | Thiếu / sai tên biến môi trường trên Render |
| Cảnh báo chỉ xuất hiện ở cấu hình `Release` (bước `dotnet build -c Release`) | Giá trị env sai (URL sai, khoá sai định dạng) |
| Test backend, TypeScript, pgTAP | Mọi thứ chỉ xảy ra lúc container khởi động thật |

**Đây là ranh giới cần nhớ:** CI xanh giờ bảo đảm Render **build** được, nhưng **không** bảo đảm Render **chạy** được.
Lỗi cấu hình runtime là một lớp lỗi riêng mà không job CI nào chạm tới được, vì CI không có — và không nên có — secret
của production. Sự cố 2026-10-26 lần 2 (B-33) rơi đúng vào ô bên phải: image build sạch trong CI, rồi chết lúc boot
trên Render vì thiếu `Payments__Test__HmacKey`.

Cách duy nhất thu hẹp ô bên phải là **đừng bắt người ta điền tay**: ưu tiên `generateValue: true` trong `render.yaml`
cho những khoá mà giá trị chỉ cần ngẫu nhiên, thay vì `sync: false`. Xem B-33 mục "Đề xuất sửa".


## 5. Ghi chú vận hành

- Plan free ngủ sau một khoảng không có request; request đầu tiên sau đó mất tới một phút (`README.md:138`).
- `render.yaml` chỉ có **một** service: API tự phát vé QR và tự chạy `PaymentQueryJob`, không có host Workers riêng
  (`Program.cs:66-75`, `docs/ARCH.md:166`).
- `render.yaml` thuộc vùng **opencode**, `docs/**` thuộc **claude** (`AGENTS.md` mục 1). Đổi tên hay thêm key
  `sync: false` trong `render.yaml` phải cập nhật bảng ở mục 1 của tài liệu này.
