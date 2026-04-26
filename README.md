# HackHustle ERP

Event-operations platform for a hackathon: auth, role-based portals, QR scanning, RSVP attendance, judging, problem statements, notifications, and an activity log. Built on Vite + React + Supabase.

## Stack
- Vite 5 + React 18 + TypeScript (strict)
- Tailwind 3 + shadcn/ui (monochrome with Tailwind Typography)
- Supabase — Postgres + Auth + Storage + Realtime + Edge Functions
- TanStack Query, React Router 6, react-hook-form + zod
- html5-qrcode, qrcode.react, react-markdown + remark-gfm

## Deploy to Vercel (60 seconds)

1. **Import** the repo into Vercel (Add New → Project → pick this repo). Framework auto-detects as **Vite**; leave build command and output dir on defaults.
2. Under **Environment Variables**, add the three from `.env.example`:
   - `VITE_SUPABASE_PROJECT_ID`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Click **Deploy**.
4. After the first deploy, in **Supabase Dashboard → Authentication → URL Configuration**, add the Vercel URL to **Site URL** and **Redirect URLs** so password-reset emails point at the deployed origin instead of localhost.

`vercel.json` already ships with the SPA rewrite to `/index.html` so deep links like `/admin/logs` survive a refresh.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase project values
npm run dev                  # http://localhost:5173
npm run typecheck            # strict TS pass
npm run build                # production bundle into dist/
```

Node 20 is pinned via `.nvmrc`.

## Provisioning a fresh Supabase project

If you're standing up a new Supabase project (instead of reusing an existing one):

```bash
# 1. Get a personal access token from supabase.com/dashboard/account/tokens
export SUPABASE_ACCESS_TOKEN=sbp_...

# 2. Link the CLI to the project
npx supabase link --project-ref YOUR_PROJECT_REF

# 3. Apply every migration in supabase/migrations/ in order
npx supabase db push --include-all

# 4. Deploy the three edge functions
npx supabase functions deploy create-user
npx supabase functions deploy delete-user
npx supabase functions deploy purge-users
```

Migrations are numbered (`0001_init.sql` → `0009_fix_scanner_fk_on_delete.sql`) and apply cleanly to an empty project.

## First admin (one-time bootstrap)

The `handle_new_user` trigger makes every fresh sign-up a `participant`. To grant yourself admin:

1. Supabase Studio → **Authentication → Users → Add User**, enter your email + password.
2. SQL Editor:
   ```sql
   UPDATE public.user_roles
      SET role = 'super_admin'
    WHERE user_id = (SELECT id FROM auth.users WHERE email = 'you@example.com');
   ```
3. Sign in at `/auth/sign-in`. You land at `/admin`.

## Roles

| Role | Lands at | Can do |
|---|---|---|
| `super_admin` | `/admin` | Everything: users, teams, RSVP, meals, judging, queries, problem statements, notifications, activity logs, purge actions |
| `participant` | `/me` | View own QR, team, problem brief, notifications, file queries, manage team submission |
| `volunteer` | `/scan` | QR-scan attendance + meals, draft notifications |
| `judge` | `/judge` | View assigned teams (by domain), score on the 7-criteria rubric |
| `rsvp` | `/rsvp` | Mark participants checked-in / checked-out / absent |
| `query_team` | `/queries` | Triage and answer participant queries |

## Feature surface

- **Volunteer scanner** (`/scan`) — QR-based entry/exit + meal redemption with a 4s cooldown and absent-blocking trigger
- **RSVP roster** (`/rsvp`, `/admin/rsvp`) — bulk check-in / check-out / absent with realtime updates
- **Notifications** (`/admin/notifications`, `/scan/notify`, `/me/notifications`) — admin direct-publish, volunteer drafts requiring admin approval; targets All / Teams / Domains / Individuals / Role
- **Problem Statements** (`/admin/problems`, `/me/problems`) — Markdown authoring with live preview, lock/unlock per statement, RLS-scoped to participant's team domain
- **Submissions** (`/me/team`) — per-team deck (PDF/PPT) + GitHub URL with private storage bucket
- **Judging** (`/judge`, `/admin/judging`) — domain-tabbed assignments, 7-criteria scoring matching the official eval sheet, per-domain rankings, reset-all-scores
- **Activity logs** (`/admin/logs`) — every meaningful click + route change + auth event + DB mutation, filterable + purgeable
- **Admin dashboard** (`/admin`) — people / attendance / operations stat strip with realtime metrics

## Repo layout

```
src/
  app/              providers, routes, role shells
  domain/           pure business logic (auth roles, scoring rubric)
  data/             supabase adapter — queries/rpc/realtime
  features/         UI per feature, grouped by role
  components/
    ui/             shadcn primitives
    composite/      reusable cross-feature components
  lib/              cn, csv, logger
supabase/
  migrations/       0001 → 0009 (apply in order)
  functions/        purge-users (create-user / delete-user are deployed but live in cloud)
public/             sample CSV + favicon
```

## Email (SMTP) — required for password reset at scale

The Supabase built-in mail server is rate-limited (~2 msgs/hour per project). For real events, wire a custom SMTP provider:

1. Sign up for [Resend](https://resend.com) (or SendGrid / Mailgun / SES).
2. In Supabase Studio → **Project Settings → Auth → SMTP Settings**, paste host/port/username/password.
3. Set **Site URL** to your deployed Vercel origin.
4. (Optional) Customize the password-recovery template under **Auth → Email Templates**.

Until SMTP is wired, the credentials-CSV download after a successful CSV import on `/admin/users` is the only password delivery channel.
