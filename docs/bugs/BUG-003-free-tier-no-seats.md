# BUG-003: Wizard cho tạo hạng miễn phí trong khu đã có hạng trả phí, nhưng hạng đó không có ghế nào để bán

- Trạng thái: VERIFIED (claude, 2026-11-01, nhánh `fix/e2e-findings`, chưa commit)
- Phía: frontend
- Giao cho: claude (chủ dự án yêu cầu claude sửa toàn bộ)
- Mức độ: medium
- Luồng: khác (tạo sự kiện)
- Người phát hiện: claude (E2E 2026-11-01)

## Tái hiện
1. Portal, wizard bước 3: hạng `Thuong` có phí và hạng `Mien phi` quota 10, cùng Khu B có ghế.
2. Gửi duyệt, Admin duyệt.
3. Khách đặt một ghế Khu B với hạng miễn phí.

## Kỳ vọng / Thực tế
- Kỳ vọng: wizard báo hạng này không có ghế, hoặc dẫn sang màn gán hạng vé theo ghế.
- Thực tế: wizard báo sẵn sàng, tính vào "Tổng sức chứa: 120 vé". `get_session_seat_pricing` không trả ghế nào cho hạng này. API từ chối: `VALIDATION_FAILED`, `seat not sold with this ticket type`.

## Bằng chứng
- Local, session `fb2385e0`: VIP 80 ghế, Thuong 72 ghế, Mien phi không có ghế.
- `supabase/migrations/20261026000003_fix_save_ticket_type_seat_pricing.sql:8`: "if PAID exists in zone, FREE PUBLIC does not auto-assign" (đúng thiết kế C-05).
- `apps/portal/src/features/org/events/EventCreationWizard.tsx:1180`: checklist chỉ cộng quota.

## Nguyên nhân
Luật C-05 ở DB là đúng, nhưng wizard không biết hậu quả của nó.

## Đề xuất sửa
Trong `apps/portal/src/features/org/events/`: cảnh báo ở bước 3 và trong checklist khi hạng FREE dùng chung khu có ghế với hạng PAID, kèm liên kết "Gán hạng vé theo ghế". Không đổi DB.

## Đã sửa
`wizard-tickets.ts`: thêm `freeTiersWithoutSeats`. `EventCreationWizard.tsx`: cảnh báo ở bước 3 và trong checklist bước 4. Chỉ cảnh báo, không chặn gửi duyệt, vì Org có thể gán ghế bằng tay sau khi lưu. DB giữ nguyên luật C-05.

## Kiểm thử
`dotnet test` 224/224, build Release, `pnpm lint`, `typecheck`, `test` (mobile 163, core 93, portal 42), build portal, `supabase test db` 135 (local).
Mới: 4 test `freeTiersWithoutSeats`. Chưa bấm thử cảnh báo trên trình duyệt.
