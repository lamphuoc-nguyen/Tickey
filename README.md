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
