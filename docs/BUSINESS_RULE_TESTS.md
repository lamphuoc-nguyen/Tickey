# Business rule tests

How the business rules in `Mo_ta_du_an_va_huong_dan.docx` (MT) are checked: what the automated suites cover, and a manual script for the Staff APK. Result of the last full run is at the end.

## Automated coverage

| Rule (MT §) | Where it is tested |
| --- | --- |
| AC-01 one seat, 50 parallel bookings: 1 wins, 49 `SEAT_CONFLICT` (§26) | `supabase/tests/database/02_core_flows.test.sql` (sequential) and `supabase/scripts/concurrency_ac01.sh` (50 real connections) |
| AC-06 duplicate IPN: tickets issued once, one ledger entry (§26) | `02_core_flows.test.sql` |
| AC-03 / AC-04 late IPN: seat still free → same seat, seat sold → 100% refund (§26) | `02_core_flows.test.sql` |
| AC-05 `PAYMENT_PENDING` never expires on its own (§6) | `02_core_flows.test.sql` |
| AC-15 tenant isolation: Org A reads/writes nothing of Org B (§26) | `02_core_flows.test.sql`; live check below |
| AC-15 the refusal is recorded as a security event (§26) | `ApiEndpointTests.Forbidden_is_logged_as_a_security_event` (API logs `SECURITY.FORBIDDEN user=… METHOD /path` on every 403 `FORBIDDEN` / `DEVICE_REVOKED`; on Render it is in the service logs) |
| Price and booking owner come from the server; client price / `user_id` ignored (§7.1) | `03_business_rules.test.sql`, `ApiEndpointTests.Create_booking_never_forwards_a_client_price_or_user_id` |
| IPN with the wrong amount: rejected, booking flagged, no tickets (§5) | `03_business_rules.test.sql` |
| Ticket issuing is idempotent (§7.1) | `03_business_rules.test.sql` |
| Staff can scan only when assigned to the Session, on a registered device of the same org (§23) | `03_business_rules.test.sql`, `ApiEndpointTests.Online_check_in_runs_as_the_staff_user_and_forbidden_is_403` |
| Assigning staff: only OWNER / GATE_MANAGER of that org; target must be staff; POS permission needs POS role (§23) | `03_business_rules.test.sql` |
| Online scan: `ISSUED → USED` once, `ALREADY_USED`, `WRONG_SESSION`, `VOID → REVOKED`, `client_scan_id` replay (§6, §23.3) | `03_business_rules.test.sql` |
| Offline sync: First Write Wins, `DUPLICATE_ENTRY` + gate alert, re-sync is a no-op (§23.2) | `03_business_rules.test.sql` |
| Session end: `ENDED`, unused tickets `NO_SHOW`, settlement cutoff +72 h, late offline log turns `NO_SHOW` into `USED` (§5, §6) | `03_business_rules.test.sql` |
| Revoked device / assignment cannot scan (§23) | `03_business_rules.test.sql`, `ApiEndpointTests.Revoked_device_is_403` |
| Staff app shows only the caller's active shifts | `ApiEndpointTests.Staff_assignments_are_the_callers_active_ones`, `apps/mobile` staff tests |
| State machines never go backwards (§6) | `02_core_flows.test.sql`, `03_business_rules.test.sql` |
| Staff/Customer interface chosen by server membership, no role switch | `apps/mobile/src/features/staff/staff-access.test.ts`, `mobile-structure.test.ts` |

Run them:

```bash
pnpm lint && pnpm typecheck && pnpm test          # apps + packages (Vitest)
cd backend && dotnet test                           # .NET API (xUnit)
npx supabase db start && npx supabase test db       # pgTAP, needs Docker
bash supabase/scripts/concurrency_ac01.sh           # AC-01 with 50 real connections (local DB only)
```

The database also writes `SECURITY.FORBIDDEN` to the Postgres log (`raise log` in `assert_org_role`); it cannot insert a row because the refused transaction rolls back. Reads that RLS hides return empty results rather than an error, so they are not security events.

## Manual script: Staff APK

Build: EAS profile `preview` (live data). Backend: `https://tickey-api.onrender.com` (free plan: the first request after ~15 min idle can take ~50 s). Data: hosted Supabase, organization "Trung tâm Âm Sắc".

Test accounts (passwords are not in the repo; ask the project owner):

| Account | Roles | Shifts |
| --- | --- | --- |
| `staff.test01@tickey.test` | SCANNER, POS | one live until 28/10 22:00 (VN time), 31/10, 04/11 (scan only) |
| `staff.test02@tickey.test` | SCANNER | none |

Run each row on a real Android phone and mark pass/fail.

| # | Rule | Steps | Expected |
| --- | --- | --- | --- |
| S1 | Server picks the interface | Log in as `staff.test01` | Lands on the Staff screen "Ca làm của bạn"; no way to switch to Customer |
| S2 | Only own, active shifts | Look at the list | 3 cards, all in "Trung tâm Âm Sắc"; live shift first, then by start time |
| S3 | Live shift | Live card | "Đang trong ca" in the accent colour |
| S4 | Upcoming shift | Other cards | "Ca bắt đầu …" with the start time |
| S5 | Venue timezone | Compare the times with the event (19:00 VN) | Times shown in Vietnam time, not the phone's timezone |
| S6 | Permissions shown | 31/10 vs 04/11 cards | "Quét vé, Check-in thủ công, Bán vé POS" vs "Quét vé" |
| S7 | Scanning not opened from the landing | Tap "Mở …" | Button disabled with the reason "Chuẩn bị soát vé trên thiết bị chưa khả dụng…" |
| S8 | No assignment → empty state | Log out, log in as `staff.test02` | "Chưa có ca làm", notice that an account does not grant scan/POS rights, button "Cập nhật phân công" |
| S9 | Refresh | Pull down / "Cập nhật phân công" | List reloads, no duplicates |
| S10 | Offline | Airplane mode, pull down | Error with a retry, app does not crash or show another user's data |
| S11 | Assignment revoked | Owner revokes the live shift (`DELETE /api/staff-assignments/{id}` with an OWNER/GATE_MANAGER token, or set `status = 'REVOKED'` in SQL); pull down | The live shift disappears |
| S12 | Membership revoked | Set the test01 membership to `REVOKED` in SQL; wait ≤ 30 s or reopen the app | "Quyền nhân viên đã thay đổi", only "Chọn tổ chức khác" / "Đăng xuất"; restore `ACTIVE` afterwards |
| S13 | Customer cannot open Staff | Log in with a customer account, open `eventcustomer://staff` | Sent back to the Customer home |
| S14 | Logged out | Log out, open `eventcustomer://staff` | "Đăng nhập để tiếp tục" |
| S15 | Logout | "Đăng xuất" | Back to the login screen |

The `staff-demo` APK (`EXPO_PUBLIC_STAFF_DEMO=true`) skips the Staff guard and shows hardcoded data. Use it only to review the check-in / POS / tickets screens; it proves no business rule.

## Not testable by hand yet

- **Portal (Org/Admin):** the pages under `/org/*` and `/admin/*` (events, venues, gates, staff assignment, KYC, approvals, payouts, reports) read and write a local mock store (`apps/portal/src/lib/mock-store.ts`, saved in `localStorage`), not the API. Only login and workspace selection are live. Rules such as "staff assignment needs OWNER/GATE_MANAGER" or "Org A cannot see Org B" hold in the database but cannot be checked through the portal until those pages call `/api`.
- **Scanning, manual check-in, POS in the app:** the screens exist only in the demo build; the live app has no scanner yet (MT §23, S0-FE2-2).
- **Payments:** `EXPO_PUBLIC_PAYMENT_GATEWAY` is empty, so the app does not start real payments; payment rules are covered by pgTAP only.

## Last run (21/10/2026, `main` 88f6c0b + branch `test/business-rules`)

| Suite | Result |
| --- | --- |
| pgTAP (`01`, `02`, `03`) | 79/79 pass |
| AC-01 with 50 real connections | 1 success, 49 `SEAT_CONFLICT`, `locked = 1`: pass |
| .NET API (xUnit) | 85/85 pass |
| Mobile (Vitest) | 76/76 pass |
| Core (Vitest) | 65/65 pass |
| Lint, typecheck | pass after the `ui.secure` fix in this branch (failing on `main` since #14) |
| Live checks against Render + hosted Supabase (16) | 16/16 pass |
