# event-platform

Multi-tenant event ticketing platform (Phase 1 MVP).

- **Apps:** React Native (Expo) for the customer and staff apps, React (Vite) for the Org/Admin portal.
- **Data:** Supabase (Postgres, Auth, Storage, pg_cron).
- **Server services:** a .NET 10 backend.

Read first:

- `docs/Mo_ta_du_an_va_huong_dan.docx` (MT): architecture and dev guide.
- `docs/Phan_cong_cong_viec_GD1.docx` (PC): tasks per person.
- `docs/DB_INSTRUCTIONS.md`: database setup.
- `supabase/README.md`: the RPC and error-code contract.

## Where is mobile, where is web

```
event-platform/
├── apps/
│   ├── customer/   MOBILE  React Native (Expo) · Android/iOS app for customers   → APK / AAB
│   ├── staff/      MOBILE  React Native (Expo) · gate scanning, check-in, POS    → APK / AAB
│   └── portal/     WEB     React + Vite · Org and Admin portal in the browser    → static site (dist/)
├── packages/       SHARED  TypeScript used by both mobile and web
│   ├── core/               Supabase client, repositories, models, error codes
│   ├── ui_kit/             colours, spacing, font sizes
│   └── seat_map/           seat layout logic (web + native renderers to come)
├── backend/        SERVER  .NET 10 · payment API, IPN, workers (not shipped to devices)
├── supabase/       SERVER  Postgres schema, RLS, RPCs, seed, pgTAP tests
└── docs/                   MT, PC, DB_INSTRUCTIONS, ERDs
```

Mobile-only files: `apps/customer/` and `apps/staff/`, including `app.json` (name, icon, package id) and `eas.json`
(build profiles). Web-only files: `apps/portal/`, including `vite.config.ts` and `index.html`.

## Layout

| Path                | What                                                                                                            | Owner                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------- |
| `apps/customer`     | Customer app: React Native (Expo Router)                                                                        | FE1 Hiếu              |
| `apps/staff`        | Gate scanning, manual check-in, POS: React Native, development build                                            | FE2 Hùng              |
| `apps/portal`       | Org (`src/features/org`) and Admin (`src/features/admin`) portal: React + Vite                                  | FE3 Giàu, FE2 Hùng    |
| `packages/core`     | Supabase client, repositories, models (zod), error codes, payment API client                                    | FE1 Hiếu (review FE2) |
| `packages/ui_kit`   | Design tokens shared by web and native                                                                          | FE1 Hiếu              |
| `packages/seat_map` | Layout types, validation, spatial index; web/native renderers come from spike S0-FE3-2                          | FE3 Giàu              |
| `backend/`          | .NET solution: `Api` (payment session, IPN, return), `Workers` (ticket issuing, refunds, payouts, jobs), `Core` | BE1 Phước, BE2 Khôi   |
| `supabase/`         | The database: one migration, seed, pgTAP tests, scripts                                                         | BE1, BE2              |

Rules that keep the system safe (MT §7.1):

- Apps **read through RLS and write only through RPCs**.
- Only `packages/core` imports `@supabase/supabase-js`.
- The `service_role` key lives only in the .NET backend's secrets.

## Prerequisites

- Node.js 22+ and pnpm 12. Run `corepack enable`, or use `npx pnpm@12.9.1 <command>` if corepack can't write to the Node install folder.
- .NET 10 SDK.
- Docker Desktop and the Supabase CLI (`npx supabase ...` works too).
- Android Studio / Xcode for the mobile apps.

## First run

```bash
pnpm install

# Database (DB_INSTRUCTIONS §2-3)
supabase start
supabase db reset          # migration + seed; seed accounts use password Dev@123456
supabase test db
supabase status            # API URL, anon key, service_role key

# App env (not committed)
cp apps/customer/.env.example apps/customer/.env.local   # fill the anon key
cp apps/staff/.env.example    apps/staff/.env.local
cp apps/portal/.env.example   apps/portal/.env.local

# Backend secrets (not committed). Use the keys from `supabase status`.
cd backend
dotnet user-secrets --project src/EventPlatform.Api     set "Supabase:AnonKey" "<anon key>"
dotnet user-secrets --project src/EventPlatform.Api     set "Supabase:ServiceRoleKey" "<service_role key>"
dotnet user-secrets --project src/EventPlatform.Workers set "Supabase:AnonKey" "<anon key>"
dotnet user-secrets --project src/EventPlatform.Workers set "Supabase:ServiceRoleKey" "<service_role key>"
# QR signing key: generate and register it as in DB_INSTRUCTIONS §4.1 (Qr:SigningKey, Qr:Kid)
```

## Daily commands

```bash
pnpm dev:portal            # http://localhost:5173
pnpm dev:customer          # Expo: a = Android emulator, i = iOS simulator
pnpm --filter @event/staff android   # development build (camera / SQLCipher do not run in Expo Go)

dotnet run --project backend/src/EventPlatform.Api       # http://0.0.0.0:5080
dotnet run --project backend/src/EventPlatform.Workers

pnpm lint && pnpm typecheck && pnpm test
dotnet test --solution backend/EventPlatform.sln
```

CI (`.github/workflows/ci.yml`) runs the same checks plus `supabase test db`.

## Hosted Supabase project

The shared hosted project is **`ddourrslmudoqevqlvpv`** ("Event Ticket Booking"). The Dashboard labels its `main`
branch **PRODUCTION**: do not run `seed.sql`, `supabase test db`, `smoke_e2e.sql` or `concurrency_ac01.sh` against
it. Use the local stack (`supabase start`) for that.

| Item | Value |
| --- | --- |
| API URL | `https://ddourrslmudoqevqlvpv.supabase.co` |
| Publishable key (public, safe in apps) | `sb_publishable_qkth_w6D3OU7rXmQ_lSTZA_q7uKKM-F` |
| Dashboard | https://supabase.com/dashboard/project/ddourrslmudoqevqlvpv |

### What is already set up (2026-10-07)

- **Schema:** `supabase/migrations/20261001000000_init_database.sql` is fully applied (66 tables with RLS, RPCs,
  6 pg_cron jobs). It was run through the SQL editor, so the migration history is **empty**. Before the first
  `supabase db push`, run once:
  ```bash
  supabase link --project-ref ddourrslmudoqevqlvpv
  supabase migration repair --status applied 20261001000000
  ```
  Otherwise `db push` runs the init file again and fails.
- **Auth hook:** Authentication → Hooks → Custom Access Token → `public.custom_access_token_hook` (enabled).
- **MFA:** TOTP enabled. Admin, Owner and Finance accounts must enrol TOTP, or sensitive RPCs return `MFA_REQUIRED`.
- **QR signing key:** kid `hosted-1` (Ed25519, ACTIVE) is in `public.signing_keys`. The private seed is in the
  Workers user-secrets of the machine that generated it only (see below).
- **Security advisor:** the `SECURITY DEFINER` RPC warnings, the `org_public` view and `rls_auto_enable` are
  expected. RPCs check permissions inside the function, `org_public` exposes only public columns of approved Orgs,
  and `rls_auto_enable` is Supabase's own event trigger.

### API keys: what goes where

| Key | Where it may live | Never |
| --- | --- | --- |
| Publishable `sb_publishable_…` | `apps/*/.env.local` (`EXPO_PUBLIC_SUPABASE_ANON_KEY`, `VITE_SUPABASE_ANON_KEY`), EAS env, backend `Supabase:AnonKey` | n/a, it is public |
| Secret `sb_secret_…` | Backend only: `Supabase:ServiceRoleKey` in user-secrets, or env var `Supabase__ServiceRoleKey` on a server | Apps, `EXPO_PUBLIC_*` / `VITE_*`, `appsettings*.json`, git, chat |

Secret keys bypass RLS. One named secret key per developer, so one can be revoked without breaking the others:

| Name | Who |
| --- | --- |
| `default` | Project owner's backend |
| `dev_2` | Second developer, .NET backend user-secrets only |

To revoke: Dashboard → Settings → API Keys → delete that row. Add a new one with **New secret key**
(name: lowercase letters, digits, underscores). Share values through a password manager, not chat or email.

### New teammate: getting access

1. The project owner invites you: Supabase Dashboard → Organization → Team → **Invite**, role **Developer**
   (Read-only cannot see secret keys). Accept the email invite.
2. In the Dashboard open "Event Ticket Booking" → Settings → API Keys and copy **your** secret key (e.g. `dev_2`).
   If you don't have one yet, ask the owner to create one named after you.
3. `git pull`, `pnpm install`, then follow "Connecting a dev machine" below with that key.
4. You will not have the QR signing key, so tickets are issued only by the Workers instance that holds
   `hosted-1` (see "QR signing key"). Everything else works.

### Connecting a dev machine to the hosted project

```bash
# Apps: apps/customer/.env.local, apps/staff/.env.local (EXPO_PUBLIC_*), apps/portal/.env.local (VITE_*)
#   *_SUPABASE_URL      = https://ddourrslmudoqevqlvpv.supabase.co
#   *_SUPABASE_ANON_KEY = the publishable key above
#   *_API_URL stays the local .NET API (http://10.0.2.2:5080 for the Android emulator, http://localhost:5080 for web)

# Backend: run these three commands for src/EventPlatform.Api, then again with src/EventPlatform.Workers
dotnet user-secrets --project backend/src/EventPlatform.Api set "Supabase:Url"            "https://ddourrslmudoqevqlvpv.supabase.co"
dotnet user-secrets --project backend/src/EventPlatform.Api set "Supabase:AnonKey"        "<publishable key>"
dotnet user-secrets --project backend/src/EventPlatform.Api set "Supabase:ServiceRoleKey" "<your own secret key>"
```

User-secrets override the `127.0.0.1:54321` URL in `appsettings.Development.json`. To go back to the local stack,
remove them: `dotnet user-secrets --project <project> remove "Supabase:Url"` (and the two keys).

### QR signing key (`hosted-1`)

- Only a Workers instance with `Qr:SigningKey` + `Qr:Kid = hosted-1` can issue tickets. Without it, bookings stay
  `PAID` and never reach `CONFIRMED`.
- Run Workers in one place (ideally a server, env vars `Qr__SigningKey` / `Qr__Kid`) instead of copying the seed to
  every laptop. Keep a backup of the seed in a password manager.
- If the seed is lost or leaks, do not reuse the kid: generate a new pair (DB_INSTRUCTIONS §4.1), insert it as
  `hosted-2`, switch Workers to it, then
  `update public.signing_keys set status = 'RETIRED', retired_at = now() where kid = 'hosted-1';`
  Tickets already signed with `hosted-1` still verify against its public key.

### Gotchas

- **"Forbidden use of secret API key in browser" (401):** Supabase rejects secret keys sent with a browser-like
  `User-Agent`, and that includes PowerShell's `Invoke-WebRequest`. Test with `curl.exe` instead. The .NET
  `HttpClient` sends no browser User-Agent, so the backend is not affected. The key itself has not leaked.
- **Platform admins:** none exist yet. After they sign up:
  `insert into public.memberships (user_id, scope, roles) values ('<auth user id>', 'PLATFORM', array['KYC_REVIEWER', ...]);`
  Keep at least two `FINANCE_ADMIN` accounts, because payouts need two different approvers.
- **Phones** cannot reach `localhost`/`10.0.2.2`. Preview and production builds need a public HTTPS URL for the
  .NET API, which the payment gateway also needs for `POST /payments/ipn/{gateway}`.

### Still open

- Install the .NET 10 SDK (10.0.100, see `global.json`) and the Supabase CLI, then do the `migration repair` above.
- Create the platform admin accounts and memberships.
- Payment gateway secrets (`Gateway:*`) once OQ-02 is decided.
- Host the .NET API + Workers with a public HTTPS URL.

## Building an Android APK (EAS)

Builds run on Expo's servers (EAS Build). Profiles live in `apps/<app>/eas.json`:

| Profile       | Output                            | Use                                                          |
| ------------- | --------------------------------- | ------------------------------------------------------------ |
| `development` | APK with the dev client           | Daily development on a real phone (needed for the Staff app) |
| `preview`     | APK                               | Testers and sprint demos: install the file directly          |
| `production`  | AAB, version code auto-increments | Google Play (internal track first, PC §7)                    |

One-time setup:

1. Create an account on expo.dev, then run `npm i -g eas-cli` and `eas login`.
2. Link each app to an EAS project. This writes `extra.eas.projectId` into `app.json`; commit that change.
   ```bash
   cd apps/customer && eas init
   cd ../staff && eas init
   ```
3. Set the URLs the app will call, per EAS environment (`development`, `preview`, `production`). A phone cannot
   reach `10.0.2.2` or `localhost`, so preview and production builds need the **staging / production** Supabase
   and a public URL for the .NET API.
   ```bash
   eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL      --value https://<ref>.supabase.co --visibility plaintext
   eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key> --visibility plaintext
   eas env:create --environment preview --name EXPO_PUBLIC_API_URL           --value https://<api host> --visibility plaintext
   ```
   These are public values that get bundled into the app. Never put `service_role` here.

Build:

```bash
cd apps/customer
pnpm build:apk      # preview APK; EAS prints a link / QR code to download and install it
pnpm build:dev      # development client APK
pnpm build:store    # production AAB for Google Play
```

From GitHub instead: add the repo secret `EXPO_TOKEN` (expo.dev → Access tokens). Then go to Actions →
**Mobile build (EAS)** → Run workflow, and pick the app and profile.

## Status of the skeleton

Working now:

- Workspace wiring and the shared `core` repositories (booking, workspace, payment session).
- Portal login → workspace picker → Org/Admin route guards.
- .NET RPC client, Ed25519 QR signer, and the `IssueTicketsWorker` (claim → issue → sign → attach → complete).
- `POST /payments/sessions`, `/payments/ipn/{gateway}` and `/payments/return`, built against `IPaymentGateway`.

Open (Sprint 0 decisions, see PC §7):

- **Payment gateway (OQ-02):** `UnconfiguredPaymentGateway` throws until a real adapter is registered.
- **Spikes:**
  - Staff QR scanning and encrypted local DB (S0-FE2-2).
  - seat_map renderers (S0-FE3-2).
- **Not yet scheduled:**
  - Quartz.NET jobs: `PaymentQueryJob`, `ReconciliationJob`.
  - Workers: `RefundWorker`, `PayoutWorker`, `NotificationsWorker`.
- **JWT check:** the API forwards the user's JWT and lets PostgREST validate it. Add JwtBearer validation once the Auth signing-key setup is fixed.
- **Hosting** for the .NET services.

dev_2
Second developer - .NET backend user-secrets only : not stored here. Copy it from Dashboard → Settings → API Keys (needs the Developer role in the Supabase org, see "Hosted Supabase project").
