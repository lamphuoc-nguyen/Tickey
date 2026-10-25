# Frontend Bugs (F-NN)

**Phía:** frontend  
**Người phát hiện:** claude, antigravity  
**Ngày:** 2026-10-25  

---

## F-01: Portal Session Time Input Uses Browser Timezone Not Venue Timezone

### Trạng thái
OPEN

### Mức độ
Thấp

### Giao cho
antigravity

### Luồng
tìm suất

### Tái hiện
1. Đặt múi giờ máy là UTC (hoặc khác ICT). Đăng nhập `owner-a@dev.local`.
2. Tạo Session với "Bắt đầu" 19:00, "Mở bán" 09:00.
3. Xem lại trên portal (danh sách nhân sự/ca) và trên mobile.

### Kỳ vọng / Thực tế
- Kỳ vọng: 19:00 nghĩa là 19:00 giờ địa điểm.
- Thực tế: `toIso` / `toLocalInput` đổi theo múi giờ trình duyệt. Mobile và `formatDateTime` của portal lại hiển thị theo `venues.timezone`. Kết quả: giờ diễn và giờ mở/đóng bán lệch đúng bằng chênh lệch múi giờ. Cửa sổ bán (`sales_start_at`/`sales_end_at`) do `create_booking` kiểm bằng `now()` cũng lệch theo.

### Bằng chứng
`apps/portal/src/features/org/events/datetime.ts`, `apps/portal/src/features/org/events/EventCreationWizard.tsx:60-64,235-238`

### Nguyên nhân
Portal dùng múi giờ trình duyệt thay vì múi giờ venue.

### Đề xuất sửa
Chuyển đổi theo `venue.timezone` của Session (không theo trình duyệt), và hiển thị rõ múi giờ cạnh ô nhập.

### Kiểm thử
Chưa chạy. Thêm unit test Vitest cho `toIso`/`toLocalInput` với múi giờ địa điểm khác múi giờ máy.

---

## F-02: Portal API URL Misconfiguration Risk

### Trạng thái
OPEN

### Mức độ
Thấp

### Giao cho
antigravity

### Luồng
khác

### Tái hiện
1. Build portal không có `VITE_API_URL` (Vercel chưa đặt env, hoặc `.env.local` thiếu biến).
2. Đăng nhập Org, mở bất kỳ trang dữ liệu nào.

### Kỳ vọng / Thực tế
- Kỳ vọng: thiếu cấu hình thì báo lỗi rõ ràng.
- Thực tế:
  - `resolveApiUrl` rơi về `window.location.origin`.
  - Trên Vercel, `vercel.json` rewrite mọi đường dẫn về `index.html`, nên `/api/*` trả HTML. `HttpClient` parse JSON thất bại và báo lỗi `UNKNOWN` khó hiểu.
  - Khi dev, `vite.config.ts` proxy `/api` tới `https://tickey-api.onrender.com` (API nối DB production), nên dev vô tình ghi vào dữ liệu thật.

### Bằng chứng
`apps/portal/src/lib/api.ts:9-16`, `apps/portal/vercel.json` (`rewrites`), `apps/portal/vite.config.ts`

### Nguyên nhân
Fallback URL và proxy config sai.

### Đề xuất sửa
Bỏ fallback, báo lỗi cấu hình khi thiếu `VITE_API_URL`. Proxy dev trỏ `http://localhost:5080`.

### Kiểm thử
Chưa chạy. Vitest cho `resolveApiUrl` khi thiếu env.

---

## F-03: Agent Dashboard Lint Fails (Missing ESLint Config)

### Trạng thái
OPEN

### Mức độ
Thấp

### Giao cho
antigravity

### Luồng
khác

### Người phát hiện
claude

### Tái hiện
1. Ở thư mục gốc chạy `pnpm lint` (hoặc `pnpm --filter @event/agent-dashboard lint`).

### Kỳ vọng / Thực tế
- Kỳ vọng: lint chạy và xanh như portal/mobile.
- Thực tế: `ESLint couldn't find an eslint.config.* file.`, exit 2. `turbo run lint` của cả repo đỏ, nên
  `pnpm lint && pnpm typecheck && pnpm test` (AGENTS.md §6) không bao giờ qua.

### Bằng chứng
`apps/agent-dashboard/package.json:10` (`"lint": "eslint ."`), thư mục `apps/agent-dashboard/` không có
`eslint.config.*`. Các devDependency cần thiết (`@eslint/js`, `globals`, `typescript-eslint`,
`eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`) đã có ở `apps/agent-dashboard/package.json:24-34`.
Baseline ngày 2026-10-25 trên `e0a713a`: `turbo run lint typecheck test --continue` → 15/16 xanh, chỉ
`@event/agent-dashboard#lint` đỏ.

### Nguyên nhân
Tạo app nhưng thiếu file cấu hình flat config cho ESLint 10.

### Đề xuất sửa
Thêm `apps/agent-dashboard/eslint.config.js` theo mẫu `apps/portal/eslint.config.js` (ignore `dist`). Không thêm
dependency. Nếu lint báo lỗi trong `src/`, sửa luôn trong cùng mục này.

### Kiểm thử
Chưa chạy. `pnpm --filter @event/agent-dashboard lint`, `typecheck`, `build`.

---

## Summary by Severity

| Severity | Count | Bugs |
|----------|-------|------|
| Nghiêm trọng (Critical) | 0 | — |
| Cao (High) | 0 | — |
| Trung bình (Medium) | 0 | — |
| Thấp (Low) | 3 | F-01, F-02, F-03 |