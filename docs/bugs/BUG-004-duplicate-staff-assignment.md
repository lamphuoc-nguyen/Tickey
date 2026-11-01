# BUG-004: Phân công lại nhân sự tạo thêm dòng trùng, Staff thấy hai ca giống nhau khác quyền

- Trạng thái: VERIFIED (claude, 2026-11-01, nhánh `fix/e2e-findings`, chưa commit)
- Phía: backend
- Giao cho: claude (chủ dự án yêu cầu claude sửa toàn bộ)
- Mức độ: medium
- Luồng: khác (phân công Staff)
- Người phát hiện: claude (E2E 2026-11-01)

## Tái hiện
1. Portal `/org/staff`: phân công `staff-a` vào Session + cổng G1, chỉ quyền Quét vé.
2. Phân công lại đúng người, Session, cổng đó, thêm quyền check-in thủ công và POS.

## Kỳ vọng / Thực tế
- Kỳ vọng: cập nhật dòng cũ, hoặc báo đã có phân công.
- Thực tế: hai dòng `ACTIVE`, quyền khác nhau. Portal liệt kê trùng. App Staff hiện hai ca gần như giống hệt nhau, ca đầu thiếu quyền, nên dễ chọn nhầm.

## Bằng chứng
- `supabase/migrations/20261001000000_init_database.sql:5443`: `assign_staff` luôn `insert`, không `on conflict`.
- Local, session `fb2385e0`: `{SCAN}` và `{SCAN,MANUAL_CHECKIN,POS,VIEW_ANALYTICS}`, đều `ACTIVE`, đều G1.

## Nguyên nhân
Không có ràng buộc duy nhất hoặc logic cập nhật cho (session, user, gate) đang `ACTIVE`.

## Đề xuất sửa
Migration mới: `assign_staff` cập nhật dòng `ACTIVE` đã có của cùng (session, user, gate), kèm unique index một phần. Cần xử lý dữ liệu trùng sẵn có trước khi tạo index. Thêm pgTAP. Portal có thể cần sửa nhãn nút, phần đó giao antigravity nếu contract đổi.

## Đã sửa
Migration `20261102000000_assign_staff_upsert.sql`: thu hồi dòng trùng đang có (giữ dòng mới nhất), thêm unique index một phần trên (session, user, cổng), `assign_staff` dùng `on conflict do update`. **Cần áp lên hosted**; dữ liệu trùng trên hosted sẽ giữ dòng mới nhất, kể cả khi dòng đó ít quyền hơn.

## Kiểm thử
`dotnet test` 224/224, build Release, `pnpm lint`, `typecheck`, `test` (mobile 163, core 93, portal 42), build portal, `supabase test db` 135 (local).
Mới: 4 test pgTAP trong `04_portal_rpcs`.
Chạy thật (local): gọi API hai lần trả cùng id, một dòng `SCAN+POS`. Bước dọn dòng trùng đã chạy thử trong transaction rồi rollback: còn một dòng, là dòng mới nhất.
