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

Ba dòng đầu là **chết lúc boot**: `AddEventPlatformCore` gọi `.ValidateOnStart()` cho 4 nhóm options
(`backend/src/EventPlatform.Core/ServiceCollectionExtensions.cs:15-43`), nên thiếu bất kỳ cái nào thì host ném
`OptionsValidationException` **trước khi** mở cổng 8080. Không có process nghe cổng → Render gọi `/health` không ai
trả lời → Render kết luận deploy failed, dù image hoàn toàn tốt.

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

Sự cố ngày 2026-10-26 thuộc trường hợp thứ hai.

## 3. Dựng lại y như Render trên máy local

Render clone sạch từ git. Repo **không có `.dockerignore`** (xem `docs/bugs/backend.md` mục B-32), nên `docker build`
ngay tại thư mục repo sẽ copy `backend/**/obj` và `bin` của máy dev vào context — build local kiểu đó **không trung
thực**. Phải đi qua `git archive`:

```bash
SP=<thư mục scratchpad, viết kiểu POSIX: /c/Users/...>
mkdir -p "$SP/renderbuild"
git archive HEAD | tar -x -C "$SP/renderbuild"
cd "$SP/renderbuild"
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

## 4. Những gì CI không kiểm

`.github/workflows/ci.yml` chỉ chạy `dotnet test` (cấu hình Debug) cho backend — **không** `dotnet publish -c Release`,
**không** `docker build`. CI xanh **không** bảo đảm Render build được. Đã ghi thành bug B-32 trong
`docs/bugs/backend.md`, giao opencode.

## 5. Ghi chú vận hành

- Plan free ngủ sau một khoảng không có request; request đầu tiên sau đó mất tới một phút (`README.md:138`).
- `render.yaml` chỉ có **một** service: API tự phát vé QR và tự chạy `PaymentQueryJob`, không có host Workers riêng
  (`Program.cs:66-75`, `docs/ARCH.md:166`).
- `render.yaml` thuộc vùng **opencode**, `docs/**` thuộc **claude** (`AGENTS.md` mục 1). Đổi tên hay thêm key
  `sync: false` trong `render.yaml` phải cập nhật bảng ở mục 1 của tài liệu này.
