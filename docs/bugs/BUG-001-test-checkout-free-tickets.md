# BUG-001: Môi trường đang dùng cổng TEST: một chạm là có vé trả phí, không thu tiền nhưng vẫn ghi doanh thu

- Trạng thái: VERIFIED (claude, 2026-11-01, nhánh `fix/e2e-findings`, chưa commit)
- Phía: shared
- Giao cho: claude (chủ dự án yêu cầu claude sửa toàn bộ)
- Mức độ: high
- Luồng: thanh toán
- Người phát hiện: claude (E2E 2026-11-01, commit `7658d5a`)

## Tái hiện
1. Chạy API với `Payments__Gateway=TEST` (cấu hình hiện tại của `render.yaml`).
2. Trên app khách, chọn ghế, mở Thanh toán, bấm Thanh toán một lần.

## Kỳ vọng / Thực tế
- Kỳ vọng: vé trả phí chỉ được phát sau khi có tiền thật, hoặc app production không mở được luồng thử.
- Thực tế: app tự gửi `result=success`; Booking lên `CONFIRMED`, có QR dùng được ở cổng. Sổ cái ghi doanh thu: Org thấy "Số dư khả dụng" 9.690.000đ trên local dù không có khoản thu nào.

## Bằng chứng
- `apps/mobile/src/features/customer/payment/payment-configuration.ts:8-9`: `gateway: 'TEST'`, `isTest: true` cố định.
- `apps/mobile/src/features/customer/payment/hooks/use-payment.ts:24`: luôn gọi `confirmTestPayment`.
- `packages/core/src/api/payment-api.ts:83`: `result: 'success'`.
- `render.yaml:28-29`: production đặt `Payments__Gateway=TEST`.
- `apps/mobile/PAYMENT_TESTING.md`: ghi rõ mobile không còn chặn theo hostname production.
- Local: Booking `479BBAAE8A`, `FD87BF85A4` `CONFIRMED`, payment `SUCCEEDED`, gateway `TEST`.
- Không chạy trên production; suy ra từ cấu hình trên.

## Nguyên nhân
Luồng một chạm (C-13) được chủ đích thêm theo yêu cầu sản phẩm, trong khi cổng thật chưa chọn (OQ-02). Nên đây là rủi ro khi mở bán công khai, không phải lỗi lập trình.

## Đề xuất sửa
Claude chốt contract trước khi có khách thật:
- Không mở bán công khai khi API còn TEST: chặn `begin_payment` hoặc app theo cấu hình server, không theo cờ phía client.
- Khi có cổng thật: `isTest` và `gateway` cố định sẽ gãy, vì `confirmTestPayment` từ chối URL không phải `/payments/test` (`payment-api.ts:75`). App cần lấy luồng thanh toán từ server.
- Xem lại việc bỏ ô đồng ý điều khoản thanh toán.
- Đánh dấu hoặc loại giao dịch TEST khỏi số dư và đối soát.

## Đã sửa
- Quyết định: thêm `Payments:Test:AllowCheckout`, mặc định tắt. Tắt thì `POST /payments/sessions`, `POST /api/bookings/{id}/payment` và trang `/payments/test/*` trả 503 `PAYMENT_UNAVAILABLE`, không gọi `begin_payment`, Booking không đổi.
- `render.yaml` bật rõ ràng vì hosted hiện chỉ có tester. **Đặt `false` trước khi có khách thật.** `appsettings.Development.json` bật cho local.
- Server tự chọn gateway (`gateway.Name`), bỏ qua giá trị client gửi. Response có `mode` (`TEST`, `REDIRECT`); app đi theo `mode`, nên cổng thật sẽ mở `paymentUrl` thay vì gửi form thử.
- Gateway chưa cấu hình cũng trả 503 trước khi ghi DB, thay vì lỗi 500 sau `begin_payment`.
- Chưa làm: giao dịch `TEST` vẫn tính vào số dư Org khi checkout đang mở (cổng thử tắt thì không phát sinh). Ô đồng ý điều khoản vẫn bỏ theo yêu cầu C-13.

## Kiểm thử
`dotnet test` 224/224, build Release, `pnpm lint`, `typecheck`, `test` (mobile 163, core 93, portal 42), build portal, `supabase test db` 135 (local).
Mới: 3 test trong `TestPaymentTests`, 1 test trong `use-payment.test.ts`.
Chạy thật (local, chỉ API): mở checkout thì `mode=TEST`, gateway lưu `TEST` dù client gửi `VNPAY`, Booking `CONFIRMED`. Tắt checkout thì 503 cả ba đường, Booking vẫn `PENDING`, không có dòng `payments`.
