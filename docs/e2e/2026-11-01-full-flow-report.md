# E2E report: sell, buy, scan, refund (2026-11-01)

**Result: the core flow works end to end on web and Android.** An event was created on the portal, approved, bought in the app, admitted at the gate and refunded after cancellation. Five issues were filed; the two that matter before a public launch are that production gives away paid tickets while it stays on the TEST gateway ([BUG-001](../bugs/BUG-001-test-checkout-free-tickets.md)) and that production has nothing to process refunds ([BUG-002](../bugs/BUG-002-refund-worker-not-hosted.md)).

| | |
| --- | --- |
| Commits tested | `5127395` (full run), then `7658d5a` = `origin/main` (buy and scan re-run, TS suites, Android) |
| Merge impact | `7658d5a` changes mobile, `packages/core` and docs only; no backend, migration or native dependency. API and database results from `5127395` still apply |
| Environment | Local Supabase, API, Workers, portal, Expo web, Android 36 emulator. Production: anonymous and read-only |

Results key: PASS means UI or API result agreed with the database. "API" means driven by script against the local API rather than by tapping the UI.

> **Update:** all five bugs were fixed on branch `fix/e2e-findings`. See each bug file for what changed and how it was tested. This report still describes the behaviour found during the run.

## Automated suites

| Suite | Commit | Result |
| --- | --- | --- |
| `pnpm lint`, `typecheck` | both | PASS |
| `pnpm test` | `7658d5a` | PASS: mobile 162, core 93, portal 38, agent-manager 17, seat-map 8 |
| `pnpm --filter @event/portal build` | `5127395` | PASS |
| `dotnet test` | `5127395` | PASS: 220 of 220 |
| `supabase test db` (pgTAP) | `5127395` | PASS: 131 |
| `concurrency_ac01.sh` | `5127395` | PASS: 1 winner, 49 `SEAT_CONFLICT`, 0 other |
| `smoke_e2e.sql` | `5127395` | **FAIL** as committed: aborts at line 56, [BUG-005](../bugs/BUG-005-smoke-script-expects-mfa.md). PASS with its 2 stale MFA lines removed in a scratch copy |

## Isolation from production

`Supabase:Url` in API user-secrets and both apps' `.env.local` point at production. The run overrode them per process and edited nothing. A random row inserted only in the local database came back through the API; browser traffic had no production requests; API and Workers logs showed only `127.0.0.1`. No production data was written.

## Sell (portal)

| ID | Scenario | How | Result |
| --- | --- | --- | --- |
| S2.1 | New owner signs up, creates Org, uploads KYC, submits | API | PASS |
| S2.2 | Admin approves KYC; customer refused; KYC file stays private | API | PASS |
| S2.3 | Venue and 152-seat layout, published | UI | PASS |
| S2.4 | Gates G1, G2 with zone mapping | UI | PASS. Gates can only be created after an event exists |
| S2.5 | 4-step wizard, submit for review | UI | PASS, but see [BUG-003](../bugs/BUG-003-free-tier-no-seats.md) |
| S2.5b-d | Poster readable; non-image refused; other Org refused | API | PASS |
| S2.6 | Admin approves; `ON_SALE` by cron in about 30s | UI | PASS |
| S2.7 | Assign staff | UI | PASS, but re-assigning duplicates: [BUG-004](../bugs/BUG-004-duplicate-staff-assignment.md) |
| S2.8 | Stored times match venue timezone (F-01 regression) | UI + DB | PASS |

## Buy

| ID | Scenario | How | Result |
| --- | --- | --- | --- |
| S3.1 | Catalog shows new event, hides draft | Web | PASS |
| S3.2 | Pick 3 seats, pay, QR | Web, old checkout | PASS |
| S3.2 | Pick 2 seats, one-tap pay, QR | Web, merged | PASS |
| S3.2 | Skia map seats, one-tap pay, QR | Android, merged | PASS |
| S3.3 | Standing quantity 2 | API | PASS |
| S3.4 | Free ticket skips payment | API | PASS (standing zone) |
| S3.5 | Seat conflict all-or-nothing; idempotency key | API | PASS |
| S3.6 | Failed payment: retry succeeds; expires and frees seat after lock and 15-minute session | API | PASS. Seat stays held up to about 20 minutes, by design (C-01). The lock was backdated locally to reach this |
| S3.7 | Cancel while `PENDING`; refused while `PAYMENT_PENDING` | API | PASS |
| S3.8 | Unpaid hold expires, seat freed | API | PASS |
| S3.9 | Replayed payment idempotent; tampered amount rejected | API | PASS |
| S3.10 | Other customer and anonymous cannot read booking, ticket or QR | API | PASS |

## Scan

| ID | Scenario | How | Result |
| --- | --- | --- | --- |
| S4.1 | Device registers, ready | Web | PASS |
| S4.2 | Admit 2 of 3; "Đã vào 2/3 · Còn 1 lượt" | Web | PASS |
| S4.2 | Admit group on merged code | Web, Android | PASS |
| S4.3 | Same scan id replays, nobody extra | API | PASS |
| S4.4 | Over-count and count 0 rejected, nothing written | API | PASS |
| S4.5 | Fully used QR rejected | API | PASS |
| S4.6 | Wrong gate names the right gate; staff cannot use unassigned gate | API | PASS |
| S4.7 | Tampered, garbage, unknown key, forged key: `INVALID_SIGNATURE`, nobody admitted | API + web | PASS |
| S4.8 | Ticket for another session | API | PASS |
| S4.9 | Outside shift refused; outside door hours rejected | API | PASS. The shift window was widened locally to reach the door check |
| S4.10 | Attendee search with masked phone, manual check-in | API | PASS |
| S4.11 | Offline sync: duplicate flagged, replay ignored | API | PASS |
| S4.12 | POS free and paid | API | PASS. Paid POS needs a separate payment session, as the POS screen states |
| S4.13 | Gate analytics match tickets | API | PASS |
| S4.14 | Customer and other Org refused | API | PASS |

## After-sale and refund

| ID | Scenario | How | Result |
| --- | --- | --- | --- |
| S5.1 | Orders and finance match DB: 9,690,000đ is 95% of 10,200,000đ | UI + DB | PASS |
| S5.2 | Tenant isolation, QR credentials private, no direct client writes | API | PASS |
| S5.3 | Audit log records actions | UI | PASS. Reconciliation is empty because no settlement period exists yet |
| S5.4 | Cancel request pauses sales, cancels nothing yet | UI | PASS |
| S5.5 | Customer cannot vote; same Admin cannot vote twice; second Admin executes | UI + API | PASS |
| S5.6 | Refund 3,300,000đ succeeds; free booking `VOID`; pending released | DB, Workers running | PASS |
| S5.7 | Refunded QR shows `REVOKED` | API | PASS |
| S5.8 | Customer sees refund | Web | PASS |
| - | Ledger entries sum to zero | DB | PASS |

## Android (merged code, emulator)

| ID | Scenario | Result |
| --- | --- | --- |
| S6.1 | Skia map renders availability; tap selects | PASS |
| S6.2 | Payment deep link | Superseded: the merged flow no longer leaves the app |
| S6.3 | QR renders; decoded screenshot equals the server's code; saved QR shows with backend unreachable | PASS |
| S6.4 | Camera permission and live preview | PASS |
| S6.4 | Scan a real QR through the camera | **NOT RUN**: needs a physical phone. The code decoded from the screenshot was typed into the staff app instead |

## Production (anonymous, read-only)

| ID | Check | Result |
| --- | --- | --- |
| S7.1 | API health | PASS |
| S7.2 | Public catalog, session, layout, availability, pricing | PASS |
| S7.3 | Portal loads; points at production API; no dev credentials or secret keys in the bundle | PASS. A `sb_secret_` match is only supabase-js's prefix check |
| S7.4 | Schema | PASS: expected RPCs exist. `list_migrations` is empty, so this was checked in the catalog. The "hosted is missing migrations" note in `docs/BOOKING_ADMISSION_FLOW.md:115` is out of date |
| S7.5 | Security advisor | No new class of issue. Known `SECURITY DEFINER` warnings remain. Leaked password protection is off |
| S7.6 | Deployed commit matches `main` | **NOT VERIFIED**: Vercel requires team authorization; Render was not inspected |
| S7.7 | Refund processing | [BUG-002](../bugs/BUG-002-refund-worker-not-hosted.md) |
| - | Confirmed bookings without QR | 4 of 6, all on ended sessions, which the C-11 backfill skips by design. Not a problem |

Signed-in production flows were **not run**: the agent does not enter credentials on production, and test rows there cannot be cleanly removed.

## Minor items, not filed

All fixed on `fix/e2e-findings`. Each was checked on screen: the zoom buttons and seat taps on Android, the rest on the web builds. The first zoom button fix in `f297abe` hid the buttons behind the map; a later change on the branch corrects it.

- `apps/portal/src/features/auth/LoginPage.tsx:257`: dev hint names `admin-a@dev.local`; the seed account is `admin@dev.local`.
- Mobile seat map: zoom buttons cover seats A5 and A6 until the map is moved.
- Staff check-in: the permissions text runs off the screen.
- Seat list orders A1, A10, A2.
- Audit log shows a truncated user id rather than a name.

## Docs out of date

Fixed on `fix/e2e-findings`.

- `docs/ARCH.md:144,259`: `EXPO_PUBLIC_PAYMENT_GATEWAY` is no longer used.
- `docs/ARCH.md:160`: failed payments are later expired by `PaymentQueryJob`.
- `docs/ARCH.md:199,201`: `RefundWorker` and `PaymentQueryJob` both exist.
- `README.md:133,139,153`, `supabase/README.md:34`: MFA is no longer required; checkout no longer opens a test page.
- `docs/BOOKING_ADMISSION_FLOW.md:115`: see S7.4.

## Coverage limits

- No committed E2E suite came out of this run. Results are from a one-off run; test scripts stayed outside the repo.
- Failed payment cannot be triggered in the merged app, so that path was covered only at API level.
- Not covered: iOS, real gateway, load, notification delivery, agent-dashboard.
- `apps/mobile/android` (git-ignored) was regenerated with `expo prebuild` to pick up the camera plugin.
