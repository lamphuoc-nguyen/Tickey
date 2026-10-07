# Final Database — Instructions

What to do with the final database of the multi-tenant event ticketing platform: how to run it, verify it, deploy it, build on it, and change it safely.

Sources: *Mô tả dự án và hướng dẫn phát triển* (MT) and *Phân công công việc GĐ1* (PC), both v1.1. Reference details (migration list, error codes, RPC catalog) are in [`supabase/README.md`](../supabase/README.md). This file covers the steps.

Stack (MT §8, v1.1): **React Native + Expo** for the Customer and Staff apps, **React + Vite** for the Org/Admin portal, **Supabase** (Postgres, Auth, Storage, pg_cron) for data, and a **.NET 10 backend** (`backend/`: ASP.NET Core API + worker service) in place of Supabase Edge Functions. The database itself did not change.

---

## 1. What is where

| Path | Status | Use it for |
| --- | --- | --- |
| `supabase/migrations/20261001000000_init_database.sql` | **Final**, tested | The whole database in **one file**: tables, RLS, RPCs, jobs |
| `supabase/seed.sql` | **Final** | Test accounts and sample data (local only) |
| `supabase/tests/database/*.test.sql` | **Final** | pgTAP tests, run with `supabase test db` |
| `supabase/scripts/smoke_e2e.sql` | **Final** | End-to-end check of every flow (rolls back) |
| `supabase/scripts/concurrency_ac01.sh` | **Final** | AC-01 with real parallel connections |
| `supabase/README.md` | **Final** | Contract: conventions, error codes, RPC list |
| `files/*.docx` | Source documents | Requirements (MT, PC) |

`supabase/` is the database. Copy that folder into the `event-platform` monorepo (MT §9) as `event-platform/supabase/`. The earlier drafts (the v2 proposal and the old incomplete migrations) were merged into it and removed.

---

## 2. First-time local setup (every developer)

Prerequisites (MT §11): Docker Desktop running, Supabase CLI, Node.js LTS + pnpm (`corepack enable`), .NET 10 SDK.

```bash
cd event-platform
supabase init            # only if supabase/config.toml does not exist yet; keeps migrations/
```

Edit `supabase/config.toml` and add or enable:

```toml
[auth.hook.custom_access_token]
enabled = true
uri = "pg-functions://postgres/public/custom_access_token_hook"

[auth.mfa.totp]
enroll_enabled = true
verify_enabled = true
```

Then:

```bash
supabase start           # Postgres, Auth, Storage... in Docker
supabase db reset        # builds the DB from init_database.sql, then runs seed.sql
supabase status          # API URL + anon key -> apps/*/.env.local; service_role key -> .NET user-secrets (MT §14)
```

Log in with any seed account. The password is `Dev@123456`:

| Email | Role |
| --- | --- |
| admin@dev.local | Admin (KYC, finance, dispute, support) |
| admin-2@dev.local | Second admin, for two-person approvals |
| owner-a@dev.local | Owner of Org A. Event "Đêm nhạc Mùa Thu" is on sale. |
| owner-b@dev.local | Owner of Org B. Draft data only, for the isolation test. |
| staff-a@dev.local | Scanner + POS of Org A, assigned to "Đêm 1" at gate G1 |
| customer-1@dev.local, customer-2@dev.local | Customers |
| multi@dev.local | Customer + scanner of Org A (workspace picker) |

> Admin, Owner and Finance accounts must enrol TOTP in the app first. Sensitive RPCs return `MFA_REQUIRED` until the token is `aal2`.

---

## 3. Verify the database (run after every reset and before every PR)

```bash
supabase test db                                                       # 36 pgTAP assertions, all must be "ok"
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
     -f supabase/scripts/smoke_e2e.sql                                 # no line may start with WRONG/UNEXPECTED;
                                                                       # every "check:" line must end with true
bash supabase/scripts/concurrency_ac01.sh                              # must print "AC-01 PASS"
```

`concurrency_ac01.sh` commits test data. Run `supabase db reset` afterwards.

What the tests cover:
- **`01_schema_rules`:** RLS on every table; no client write policies; platform tables have no `tenant_id`; `search_path` on every security-definer function; what `anon` and `authenticated` may execute; private buckets.
- **`02_core_flows`:** the four mandatory tests (MT §26):
  - AC-01: seat contention.
  - AC-06: duplicate IPN.
  - AC-03/04: late payment.
  - AC-15: tenant isolation.
  - Also AC-05 (PAYMENT_PENDING never auto-expires), the state machines and ledger balance.

---

## 4. One-time configuration after setup

1. **QR signing key (Ed25519).** The private key lives only in the .NET backend's secrets (it signs in `EventPlatform.Workers`). Only the public key goes into the DB.
   ```bash
   node -e "const {generateKeyPairSync}=require('crypto');const k=generateKeyPairSync('ed25519');console.log('PRIVATE',k.privateKey.export({format:'jwk'}).d);console.log('PUBLIC',k.publicKey.export({format:'jwk'}).x)"
   # PRIVATE = base64url of the 32-byte raw seed (import with NSec KeyBlobFormat.RawPrivateKey)
   dotnet user-secrets --project backend/src/EventPlatform.Workers set "Qr:SigningKey" "<PRIVATE>"
   dotnet user-secrets --project backend/src/EventPlatform.Workers set "Qr:Kid" "dev-1"
   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
        -c "insert into public.signing_keys (kid, public_key) values ('dev-1', '<PUBLIC>')"
   ```
   Until a key exists, `issue_tickets` fails and paid or free bookings stay `PAID`, not `CONFIRMED`.
2. **Payment gateway secrets.** Set them once the gateway is chosen (OQ-02), in the .NET configuration under `Gateway:*` (`dotnet user-secrets` locally, environment variables or a secret store on staging/production).
3. **Scheduled .NET jobs** (payment query every 2 min, daily reconciliation) run inside `EventPlatform.Workers` (Quartz.NET, proposed). pg_cron keeps only the six DB-only jobs listed in section 5; nothing in the DB calls out over HTTP.
4. **Never** put the `service_role` key in an app or in the repo (MT §14). It belongs only in the .NET backend's configuration. `EXPO_PUBLIC_*` and `VITE_*` variables are bundled into the apps, so they hold only URLs and the anon key.

---

## 5. Deploy to staging / production

The project must be **new and empty**: the init file creates everything from scratch. Use either option:

```bash
# Option A: CLI
supabase link --project-ref <ref>
supabase db push                       # runs init_database.sql once; seed.sql is NOT pushed

# Option B: no CLI
# Studio > SQL Editor > paste the whole supabase/migrations/20261001000000_init_database.sql > Run
# (or: psql "<connection string>" -v ON_ERROR_STOP=1 -f supabase/migrations/20261001000000_init_database.sql)
```

If you use Option B and later switch to the CLI, run
`supabase migration repair --status applied 20261001000000` first, so `db push` doesn't run the file a second time.

Then, in the Dashboard of each hosted project:
- Authentication > Hooks > Custom Access Token → `public.custom_access_token_hook`.
- Authentication > MFA → enable TOTP.
- Database > Extensions → confirm `pg_cron` is enabled. `select jobname, schedule from cron.job;` should list 6 jobs: `session-status-transitions`, `release-expired-bookings`, `booking-confirm-alerts`, `session-reminders`, `settlement-cutoffs`, `negative-balances`.
- Insert the production public signing key into `signing_keys` and set the matching secrets.
- Create the real platform admins:
  `insert into public.memberships (user_id, scope, roles) values ('<auth user id>', 'PLATFORM', array['KYC_REVIEWER', ...]);`
  Have at least two `FINANCE_ADMIN` accounts, because payouts need two different approvers.

- Deploy the .NET backend (API + Workers) with its configuration: `Supabase:Url`, `Supabase:AnonKey`, `Supabase:ServiceRoleKey`, `Qr:SigningKey`, `Qr:Kid`, `Gateway:*`. The API needs a public HTTPS URL: the gateway calls `POST /payments/ipn/{gateway}` and returns the customer to `GET /payments/return`.

Staging may be seeded (`supabase db push --include-seed`). Production must never be.

---

## 6. Rules every developer must follow

These come from MT §7.1, §20 and §27.

1. **Read through RLS, write through RPC.** Never `.insert()/.update()/.delete()` business tables from the React / React Native apps. They have no write policies, so the call silently does nothing or errors.
2. **Never send `user_id`, prices or statuses from the client.** The server uses `auth.uid()` and computes prices.
3. **Idempotency key per user action.** Generate one UUID when the user taps "Đặt vé". Reuse it on retry, and make a new one for a new attempt.
4. **Status changes must be legal.** The DB rejects illegal transitions with `INVALID_STATE` (MT §6). Don't try to "fix" a status by hand.
5. **Ledger is immutable.** Correct mistakes with a reversing entry (`post_ledger_transaction(..., p_reversal_of)`), never with UPDATE/DELETE.
6. **Times:** store UTC and display in `venues.timezone`. For the hold countdown, use `lock_expires_at - server_now` from the RPC response, not the device clock.

---

## 7. For Frontend developers (FE1, FE2, FE3)

### 7.1 Login and workspace (MT §4)
1. Sign in with Supabase Auth.
2. `rpc('list_my_workspaces')` returns CUSTOMER + ORG / STAFF / ADMIN entries. Show the picker if there is more than one.
3. `rpc('set_active_workspace', {p_kind, p_org_id})`, then `supabase.auth.refreshSession()`. The new JWT carries `active_workspace`.
4. If an entry has `requires_mfa: true`, enrol or verify TOTP first. Otherwise you get `MFA_REQUIRED`.

### 7.2 Customer booking flow
```
get_session_layout(session)           -> draw seat_map once, cache it
get_session_availability(session)     -> unavailable seats + remaining per zone / ticket type (poll or Realtime)
create_booking(session, items, key)   -> PENDING, lock_expires_at, server_now
POST {API}/payments/sessions          -> .NET calls begin_payment with the user's JWT (PAYMENT_PENDING),
                                         builds and returns the gateway URL
   ...gateway -> GET {API}/payments/return -> app deep link (do not trust its parameters)...
get_booking(booking) until PAID / CONFIRMED / EXPIRED / REFUND_PENDING   (MT §24)
```
Free tickets go straight to `PAID` from `create_booking`, with no payment step.

Example (TypeScript, inside `packages/core`):
```ts
const { data, error } = await supabase.rpc('create_booking', {
  p_session_id: sessionId,
  p_items: [{ ticket_type_id: vipId, seat_id: seatId }, { ticket_type_id: gaId, quantity: 2 }],
  p_idempotency_key: idempotencyKey,
});
if (error) throw ApiError.fromPostgrest(error); // error.message = code, error.details = JSON
```

### 7.3 Error handling
Read `error.message` (supabase-js `PostgrestError`) as the code and parse `error.details` as JSON (MT §20.4, §21.2). Full table: `supabase/README.md`.
- `SEAT_CONFLICT`: `details.seat_ids` — colour those seats red and keep the others.
- `SOLD_OUT`, `LIMIT_EXCEEDED`: show the remaining amount or the limit.
- `SESSION_NOT_ON_SALE`: return to the event page.
- `BOOKING_EXPIRED`: back to seat selection.
- `MFA_REQUIRED`: ask for TOTP.
- `OTP_REQUIRED`: run the OTP screen, then retry `submit_refund_bank_info`.
- `DEVICE_REVOKED` (Staff app): wipe local data immediately.

### 7.4 Which RPCs each app uses
Listed in `supabase/README.md` → "RPC theo ứng dụng". Notes:
- **Org portal:**
  - Invitation tickets: `issue_comp_tickets`.
  - Hold or block seats: `set_session_seat_status`.
  - Revenue dashboard: `get_org_finance_summary`.
  - Bank account change: `request_bank_account_change`. It has a 72h cooldown; show this.
- **Staff app:**
  - Manifest: `get_session_manifest(p_since => null)` gives the full list, `p_since => last server_now` gives the delta. Sync every 30 s.
  - Offline log: `sync_offline_scans`, with First-Write-Wins and `DUPLICATE_ENTRY` alerts.
  - POS: `create_booking(..., p_options => {"booking_type":"POS"})`, then `POST /payments/sessions` on the .NET API.
- **Admin portal:** every two-person action goes through `vote_approval(approval_id, 'APPROVE'|'REJECT')`. The same admin cannot vote twice.

---

## 8. For Backend developers (BE1, BE2): .NET services to build

The database is done. The .NET backend (`backend/`, MT §9 and §20.9) is not. It has three projects:

- `EventPlatform.Api`: ASP.NET Core Minimal API (payment session, IPN, gateway return, health).
- `EventPlatform.Workers`: `BackgroundService` workers and scheduled jobs.
- `EventPlatform.Core`: `SupabaseRpcClient`, Ed25519 signing, gateway adapters.

How the backend calls the database:
- **Server-only RPCs** go to PostgREST (`POST {SUPABASE_URL}/rest/v1/rpc/<name>`) with the `service_role` key in both the `apikey` and `Authorization: Bearer` headers. `service_role` can already execute them, so no migration is needed.
- **RPCs on behalf of a user** (`begin_payment`) forward the user's JWT as `Authorization: Bearer` and send the anon key as `apikey`, so `auth.uid()` and RLS stay correct. Validate the JWT first (JwtBearer against the Supabase Auth JWKS).

| Component | Owner | Calls |
| --- | --- | --- |
| `POST /payments/sessions` (Api) | Phước | `begin_payment` (customer's JWT), then build the gateway URL |
| `POST /payments/ipn/{gateway}` (Api) | Phước | verify signature/amount → `apply_payment_success` / `apply_payment_failure`; always return 200 after recording |
| `GET /payments/return` (Api) | Phước | no RPC; redirect to the app deep link (`myapp://payment-result?booking_id=...`) |
| `PaymentQueryJob` (Workers, every 2 min) | Phước | `list_payment_pending_to_query` → ask gateway → `apply_payment_success` or `expire_unpaid_booking` |
| `IssueTicketsWorker` (Workers) | Phước | `claim_outbox('ISSUE_TICKETS')` → `issue_tickets` → sign → `attach_ticket_credentials` → `complete_outbox` |
| `RefundWorker` (Workers) | Phước | `claim_outbox('PROCESS_REFUND' / 'PROCESS_SESSION_REFUNDS')` → `start_refund_processing` → gateway refund (idempotency key = refund id) → `apply_refund_result` |
| `PayoutWorker` (Workers) | Khôi | `claim_outbox('PROCESS_PAYOUT')` → `mark_payout_sent` → gateway → `confirm_payout` |
| `ReconciliationJob` (Workers, daily) | Khôi | `import_gateway_statement` |
| `NotificationsWorker` (Workers) | Khôi | send `notifications` rows with status QUEUED, plus outbox `NOTIFY_*`, `ADMIN_ALERT`, `GATE_ALERT`, `BOOKING_CONFIRM_ALERT` |

The QR public keys need no endpoint: the Staff app reads `signing_keys` (RLS allows it), and the manifest includes them.

Worker pattern (retry with backoff is handled in the DB):
```csharp
var jobs = await _rpc.CallAsync<List<OutboxJob>>("claim_outbox",
    new { p_topic = "ISSUE_TICKETS", p_worker = "issue-1", p_limit = 20 }, ct);
foreach (var job in jobs)
{
    try
    {
        var toSign = await _rpc.CallAsync<List<TicketToSign>>("issue_tickets",
            new { p_booking_id = job.AggregateId, p_kid = _signer.Kid }, ct);
        var items = toSign.Select(t => new {
            ticket_id = t.TicketId, kid = _signer.Kid, payload = t.Payload, signature = _signer.Sign(t.Payload) });
        await _rpc.CallAsync("attach_ticket_credentials", new { p_booking_id = job.AggregateId, p_items = items }, ct);
        await _rpc.CallAsync("complete_outbox", new { p_id = job.Id, p_error = (string?)null }, ct);
    }
    catch (RpcException e) // PostgREST error JSON: message = error code (supabase/README.md)
    {
        await _rpc.CallAsync("complete_outbox", new { p_id = job.Id, p_error = e.Message }, ct);
    }
}
```
- The QR content is the signed payload, for example `base64url(payload) + "." + base64url(signature)`. Agree the exact format with FE2 (S2-BE1-4).
- The payload contains ids only, no personal data.
- `PROCESS_SESSION_REFUNDS` carries the session id. The worker processes that session's `REQUESTED` refunds at a controlled rate.

---

## 9. Changing the database later

1. **Before the first deployment**, you may still edit `20261001000000_init_database.sql` directly. Run section 3 after every edit.
   **After it is deployed anywhere** (staging included), never edit it again (MT §13). Put every change in a new file that runs after it:
   ```bash
   supabase migration new <short_description>      # e.g. add_voucher_tables
   ```
2. Every new table: `alter table ... enable row level security` in the same migration, read policies only, and `tenant_id` if it is Org data (`org_id` if it is platform data).
3. Every new status column: add a `tg_guard_status('{...}')` trigger with the allowed transitions.
4. Every new RPC:
   - `security definer` + `set search_path = ''`.
   - Check permissions first (`assert_authenticated` / `assert_org_role` / `assert_platform_role`).
   - Raise errors with `app_error('<CODE>')`.
   - Grant explicitly: `grant execute on function ... to authenticated`. Nothing is executable by default.
5. If you add a function `anon` may call, update the whitelist in `01_schema_rules.test.sql`.
6. Add a pgTAP test (an IDOR test for every new tenant table), then run section 3.
7. Update `supabase/README.md` (error codes, RPC list) **before** FE needs it (contract-first, PC §2).
8. Money-touching migrations must be reviewed by the other backend developer (Phước ↔ Khôi, MT §25.2).

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Query returns an empty list, no error | RLS: wrong user/workspace, or data not published | Check with the service role in Studio. If data exists, it's a permission issue, not a data issue. |
| `MFA_REQUIRED` | Token is `aal1` | Enrol/verify TOTP, then refresh the session |
| JWT has no `active_workspace` | Access token hook not enabled | Section 2 config or the Dashboard hook, then refresh the session |
| .NET API returns 401 on `POST /payments/sessions` | Expired JWT, or wrong issuer/JWKS in the .NET config | Refresh the session in the app; check `Supabase:Url` in the .NET configuration |
| Session stays `SCHEDULED` | Event not approved, or pg_cron not running | Admin `review_event`. Check `cron.job`. Locally you can run `select public.run_session_status_transitions();` |
| Seat still shows LOCKED after expiry | Normal; the cleanup job hasn't run yet | The expired lock already counts as free. Don't edit it by hand. |
| Booking stuck in `PAID` | No signing key, or `IssueTicketsWorker` (.NET) isn't running | Section 4.1. Check `outbox` rows with `topic = 'ISSUE_TICKETS'`. An alert appears after 5 min. |
| `PAYMENT_PENDING` never ends | `PaymentQueryJob` (.NET) not running | Run / deploy `EventPlatform.Workers` (section 8). It never auto-expires by design. |
| `INVALID_STATE` on an update | Illegal status transition | Follow the state machine in MT §6. Look at `details.from/to`. |
| `IMMUTABLE_ROW` | Tried to edit or delete ledger, audit, scan log or a published layout | Use a reversing entry, or a new layout version |
| Seed users cannot log in | Old Supabase CLI / GoTrue | Update the CLI, then `supabase db reset` |
| `supabase db reset` wiped your data | Expected behaviour | Put data you want to keep in `seed.sql` |

---

## 11. Decisions to confirm in Sprint 0

These were judgment calls made while aligning the DB with the documents. Confirm them or change them via new migrations:

1. Platform-level tables (payments, refunds, chargebacks, ledger, reports, disputes, approvals, audit) use `org_id` instead of `tenant_id` (MT §1.1).
2. Venue / zone / seat data is public only when used by a published session.
3. Whoever proposes a payout, suspension or admin-initiated cancellation counts as the first approval vote. One more admin completes it.
4. Tickets voided by a chargeback stay void even if the chargeback is won (MT: never edit issued tickets).
5. `admin-2@dev.local` was added to the seed so two-person approvals can be tested locally.
6. The P1 items are modelled but have no RPCs yet: postpone, ticket transfer, customer self-refund, vouchers, cash/offline POS, automatic chargeback, appeals, STANDARD/TRUSTED tiers (PC §8).

---

## 12. Checklist

- [ ] `supabase/` copied into the monorepo
- [ ] `config.toml`: access token hook + TOTP enabled
- [ ] `supabase db reset` succeeds
- [ ] `supabase test db`: all ok
- [ ] `smoke_e2e.sql`: no WRONG/UNEXPECTED, all checks true
- [ ] `concurrency_ac01.sh`: AC-01 PASS
- [ ] Signing key generated (secret + `signing_keys` row)
- [ ] `apps/*/.env.local` and .NET user-secrets filled from `supabase status` (not committed)
- [ ] Staging linked, `db push`, hook + MFA + pg_cron verified, admins created
- [ ] .NET services from section 8 assigned, deployed (public HTTPS for IPN) and scheduled
- [ ] Section 11 decisions reviewed by the team
