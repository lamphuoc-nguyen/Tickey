# BUG-002: Production không có nơi chạy `RefundWorker`, refund sẽ nằm mãi ở `REQUESTED`

- Trạng thái: VERIFIED (claude, 2026-11-01, nhánh `fix/e2e-findings`, chưa commit)
- Phía: backend
- Giao cho: claude (chủ dự án yêu cầu claude sửa toàn bộ)
- Mức độ: high
- Luồng: huỷ/hoàn tiền
- Người phát hiện: claude (E2E 2026-11-01)

## Tái hiện
1. Deploy theo `render.yaml` (một service API, không có Workers).
2. Huỷ Session đã bán vé, hai Admin duyệt.
3. Xem `refunds` và outbox `PROCESS_SESSION_REFUNDS`.

## Kỳ vọng / Thực tế
- Kỳ vọng: refund tự xử lý như local khi có Workers (`SUCCEEDED`, vé `REFUNDED`).
- Thực tế (suy luận từ cấu hình): API không đăng ký `RefundWorker`, nên không ai tiêu thụ job. Khách đã bị huỷ vé nhưng không được hoàn tiền.

## Bằng chứng
- `backend/src/EventPlatform.Api/Program.cs:72,83`: API chỉ chạy `IssueTicketsWorker`, `PaymentQueryJob`.
- `backend/src/EventPlatform.Workers/Program.cs:14`: `RefundWorker` chỉ có ở Workers.
- `render.yaml:33`: "no separate Workers host"; `docs/DEPLOY_RENDER.md:119`: chỉ có một service.
- Hosted (đọc 2026-11-01): chưa có dòng `refunds` nào, nên chưa quan sát được lỗi thật. Chưa xác nhận liệu có Workers chạy ở nơi khác.
- Local: có Workers thì refund 3.300.000đ `SUCCEEDED`.

## Nguyên nhân
Khi gom worker vào API cho host miễn phí, `RefundWorker` bị bỏ sót.

## Đề xuất sửa
Đăng ký `RefundWorker` trong `backend/src/EventPlatform.Api/Program.cs` với điều kiện như `PaymentQueryJob`, hoặc thêm service Workers vào `render.yaml`. Kiểm tra không chạy trùng khi cả API và Workers cùng bật (outbox dùng SKIP LOCKED). Thêm test đăng ký hosted service. Sau khi sửa, chạy lại `docs/ARCH.md` mục 4.6 trên staging.

## Đã sửa
`backend/src/EventPlatform.Api/Program.cs`: đăng ký `RefundWorker` cùng điều kiện với `PaymentQueryJob`. Chạy song song với Workers vẫn an toàn vì `claim_outbox` dùng SKIP LOCKED.

## Kiểm thử
`dotnet test` 224/224, build Release, `pnpm lint`, `typecheck`, `test` (mobile 163, core 93, portal 42), build portal, `supabase test db` 135 (local).
Mới: `Api_hosts_refund_and_payment_query_jobs_when_a_gateway_is_configured`.
Chạy thật (local, không có Workers): huỷ Session, hai Admin duyệt, refund `SUCCEEDED`, Booking và vé `REFUNDED`. Chưa kiểm trên production vì chưa deploy.
