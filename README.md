# House of Rivana

Artificial fashion jewellery e-commerce — Next.js 16 storefront, Better Auth, Prisma / Postgres, manual UPI (Razorpay-ready), and a full admin panel.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4 + Motion + Lenis
- Prisma 7 against Postgres (local Docker or Supabase)
- Better Auth (email/password, optional Google)
- Payments: `manual_upi` now, `razorpay` behind the same provider interface
- Resend + WhatsApp Cloud API notifications

## Quick start

```bash
# 1. Install
npm install

# 2. Environment
cp .env.example .env
cp .env.example .env.local
# Fill BETTER_AUTH_SECRET (openssl rand -base64 32). Local Docker DB URLs are prefilled.

# 3. Database
npm run db:up
npm run db:migrate
npm run db:seed

# 4. Dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Seeded admin (override via env):

- Email: `admin@houseofrivana.com`
- Password: `ChangeMe!2026`

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` / `start` | Production build |
| `npm run db:up` / `db:down` | Local Postgres via Docker Compose |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:seed` | Brand data, demo catalog, admin user |
| `npm run test` | Vitest unit tests (pricing, UPI, order transitions) |
| `npm run test:e2e` | Playwright smoke tests |
| `npm run storage:check` | Verify Supabase env keys are present (payment proofs only) |
| `npm run storage:setup` | Create private payment-proofs bucket via the Supabase API |
| `npm run lint` / `typecheck` | ESLint / `tsc --noEmit` |

## Product photographs (Postgres)

Product, hero and review images are stored as `BYTEA` in the `StoredImage` table and served from `/api/media/[id]`. No Supabase Storage credentials are required for the Photographs panel.

1. Ensure Postgres is up (`npm run db:up`) and migrations are applied (`npm run db:migrate`).
2. Save a product draft at `/admin/products/new`, then open **Photographs** on `/admin/products/[id]` and upload.

## Payment proof screenshots (optional Supabase Storage)

Manual UPI payment screenshots still use a private Supabase bucket when credentials are set. Without them, buyers can submit the UTR alone.

1. Create a free project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. **Project Settings → API** — copy into both `.env` and `.env.local`:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` `secret` → `SUPABASE_SERVICE_ROLE_KEY` (server only)
3. `npm run storage:setup` then run [`supabase/storage-setup.sql`](supabase/storage-setup.sql) once for RLS.
4. Bucket name defaults to `payment-proofs` (`SUPABASE_PROOF_BUCKET`).

## Shiprocket (delivery ETA + tracking)

Live courier integration for PIN-code ETAs, AWB creation, and tracking sync.

1. In Shiprocket → **Settings → API**, create an API user and set in `.env` / `.env.local`:
   - `SHIPROCKET_EMAIL`
   - `SHIPROCKET_PASSWORD` (API user password / key)
   - `SHIPROCKET_PICKUP_LOCATION` — exact pickup nickname from the panel
   - `SHIPROCKET_PICKUP_PINCODE` — warehouse PIN (default Jaipur `302001`)
   - `SHIPROCKET_WEBHOOK_TOKEN` — any long random string
2. Webhook URL (Settings → API → Webhooks): `{APP_URL}/api/webhooks/fulfillment` with the same token as `x-api-key`.
3. Restart the app. On an paid order → **Ship with Shiprocket**. Product/checkout pages expose **Check delivery** by PIN.
4. Cron `/api/cron/sync-shipments` refreshes open AWBs every 30 minutes as a backup to webhooks.

## Payments

`SiteSetting.activePaymentProvider` selects the adapter at runtime:

1. **Manual UPI** — builds `upi://pay` + QR; buyer submits UTR (+ optional screenshot). Orders sit in `PAYMENT_UNDER_REVIEW` until an admin verifies them at `/admin/payments/review`.
2. **Razorpay** — set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, switch the provider in `/admin/settings`, and point the Razorpay webhook at `/api/webhooks/razorpay`. Uses Standard Checkout with UPI Intent/QR (Collect is deprecated).

Stock is held for 45 minutes on order create. Vercel cron `/api/cron/release-holds` releases expired holds.

## Accounts & admin

- Customer: `/account` — orders, wishlist, addresses, verified-purchase reviews
- Admin: `/admin` — dashboard, payment queue, catalog, inventory, coupons, reviews, shipments, content, settings, audit log
- Route gate: `src/proxy.ts` (session cookie). Every admin action also calls `requireStaff` / `requireAdmin`.

## Deploy (Vercel)

`vercel.json` sets region `bom1`, cron jobs, and build command `npm run vercel-build`
(`prisma generate` → `prisma migrate deploy` → `next build`). Pending migrations in
`prisma/migrations` are applied automatically on every deploy.

### 1. Database

Create a hosted Postgres (Supabase or Neon recommended for India / serverless).

| Variable | Use |
| --- | --- |
| `DATABASE_URL` | **Pooled** URL for the running app (Supabase port `6543` + `pgbouncer=true`, or Neon `-pooler` host) |
| `DIRECT_URL` | **Direct** URL for migrations (port `5432` / non-pooler). Required on Vercel. |

Copy both into Vercel → Project → Settings → Environment Variables for **Production**.
Prefer a second database (or Neon/Supabase branch) for **Preview** so PR deploys do not migrate production.

### 2. Required app env vars

Set at least:

- `NEXT_PUBLIC_APP_URL` — `https://your-domain.vercel.app` (or custom domain)
- `BETTER_AUTH_SECRET` — `openssl rand -base64 32`
- `BETTER_AUTH_URL` — same origin as `NEXT_PUBLIC_APP_URL`
- `CRON_SECRET` — shared bearer for `/api/cron/*` (Vercel Cron sends it automatically when set)
- `DATABASE_URL` + `DIRECT_URL` (above)

Optional: Razorpay, Resend, WhatsApp, Shiprocket, Google OAuth, Supabase Storage for payment-proof screenshots. Full list: [`.env.example`](.env.example).

### 3. First deploy

1. Import the Git repo in Vercel (framework: Next.js; build command comes from `vercel.json`).
2. Paste env vars → Deploy.
3. After the first successful build, seed once against production:

   ```bash
   # with Production DIRECT_URL in your shell
   DIRECT_URL="postgresql://…" DATABASE_URL="postgresql://…" npm run db:seed
   ```

4. Sign in at `/admin/login`, then replace seed UPI VPA / contact details under `/admin/settings`.

Product photos live in Postgres (`StoredImage`); no object-storage bucket is required for the catalogue.

## Project layout

```
src/app/(storefront)   Storefront pages
src/app/(auth)         Login / register / password reset
src/app/admin          Admin panel
src/app/actions        Server actions
src/components         UI, motion, cart, checkout, admin
src/lib                Auth, cart, catalog, payments, notifications
prisma/                Schema, migrations, seed
e2e/                   Playwright specs
```

Brand seed input lives in `project-details.json`.
