# BUG-005: `smoke_e2e.sql` vẫn kỳ vọng `MFA_REQUIRED` nên dừng ở dòng 56

- Trạng thái: VERIFIED (claude, 2026-11-01, nhánh `fix/e2e-findings`, chưa commit)
- Phía: backend
- Giao cho: claude (chủ dự án yêu cầu claude sửa toàn bộ)
- Mức độ: low
- Luồng: khác (kiểm thử)
- Người phát hiện: claude (E2E 2026-11-01)

## Tái hiện
`psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/scripts/smoke_e2e.sql` sau `supabase db reset` (local).

## Kỳ vọng / Thực tế
- Kỳ vọng: chạy hết script.
- Thực tế: dòng 54 in `UNEXPECTED_SUCCESS expected MFA_REQUIRED` vì KYC đã được duyệt thật, nên dòng 56 lỗi `INVALID_STATE` và script dừng, exit 3.

## Bằng chứng
- `supabase/scripts/smoke_e2e.sql:54,357`: hai kiểm tra `MFA_REQUIRED`.
- `supabase/migrations/20261026000006_drop_mfa_requirement.sql`: đã bỏ yêu cầu MFA (C-10).

## Nguyên nhân
Script không được cập nhật theo C-10, và CI không chạy script này (`.github/workflows/ci.yml`).

## Đề xuất sửa
Xoá hai dòng trên trong `supabase/scripts/smoke_e2e.sql`. Cân nhắc thêm script vào CI.

## Đã sửa
Xoá hai kiểm tra `MFA_REQUIRED` trong `supabase/scripts/smoke_e2e.sql`. Không thêm vào CI.

## Kiểm thử
`smoke_e2e.sql` chạy hết, exit 0, không có dòng `WRONG `, `UNEXPECTED` hay `ERROR` (local).
