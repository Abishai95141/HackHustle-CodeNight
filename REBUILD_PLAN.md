# HackHustle ERP — Rebuild, Redesign & Architecture Plan

> Source app analyzed: `/Users/abishaikc/HackHustle-ERP` (Vite + React 18 + TS + shadcn/ui + Supabase, "Batman" black/yellow theme).
> Target root: `/Users/abishaikc/HackHustle-ERP/NewERP`.
> Target stack: Vite + React 18 + TS + shadcn/ui + TanStack Query + Supabase — but with a **monochrome (black & white)**, premium-minimalist aesthetic and a **modular, swap-friendly business-logic layer**.

---

## 0. Core Principles Driving the Rebuild

1. **Logic ≠ UI ≠ Data.** Rules live in a `domain/` layer of pure functions. UI and DB never decide outcomes; they only render or persist what `domain` returns. → A meal/attendance/scoring rule change is one file, not a sweep.
2. **Server-authoritative writes.** Every mutation that touches scoring, attendance, meal claims, role changes goes through a Supabase Edge Function (or Postgres RPC) — never raw `supabase.from(x).insert()` from the client. → RLS becomes "read-mostly," and rules can be updated without UI redeploy.
3. **Typed contracts.** Generated DB types + zod schemas at the boundary. The UI never sees `as any`.
4. **Monochrome, content-first UI.** Black & white only, with one accent (`--accent: #FFFFFF` on inverted blocks). Hierarchy comes from **typography weight, spacing, and a single 1px hairline** — not from color.
5. **Real-time by default.** Supabase Realtime channels piped through TanStack Query cache, not bolt-on `useEffect`s.

---

## Phase 1 — DB & Schema Blueprint

### 1.1 What we port over (verbatim)

The existing DB (analyzed from `supabase/migrations/20251211141213_*.sql` + `20251214102939_*.sql`) is sound. Port these objects to the **new** Supabase project as-is:

| Object | Type | Purpose |
|---|---|---|
| `app_role` | enum | `super_admin \| participant \| volunteer \| judge` |
| `scan_type` | enum | `entry \| exit` |
| `query_status` | enum | `open \| in_progress \| resolved` |
| `query_category` | enum | `wifi \| bug \| mentor_help \| logistics \| other` |
| `teams` | table | `id, team_name, team_code (unique), table_number, total_score` |
| `profiles` | table | 1:1 with `auth.users`; holds `qr_token`, `is_inside_venue`, `checked_in_day1`, `tshirt_size`, `dietary_restrictions`, `team_id` |
| `user_roles` | table | (user_id, role) — kept separate from `profiles` for security |
| `attendance_logs` | table | append-only audit of every scan |
| `meal_sessions` | table | `meal_type` (unique), `display_name`, `is_active`, optional time window |
| `meal_transactions` | table | unique on `(user_id, meal_type)` — enforces "one claim per meal" at DB level |
| `judge_assignments` | table | (judge_id, team_id, round_name) |
| `judge_scores` | table | per-rubric ints + STORED `total_score` |
| `queries` | table | participant support tickets |
| `has_role(uid, role)` | SECURITY DEFINER fn | RLS predicate |
| `get_user_role(uid)` | SECURITY DEFINER fn | initial-load helper |
| `handle_new_user()` | trigger fn | auto-creates profile + default `participant` role |
| `update_team_score()` | trigger fn | recomputes `teams.total_score = AVG(judge_scores.total_score)` |
| Realtime publications | — | `attendance_logs`, `meal_transactions`, `judge_scores`, `teams` |

### 1.2 What we change / add

| Change | Why |
|---|---|
| **Add `events` table** (`id, name, slug, start_at, end_at, is_active`) and FK most rows to `event_id`. | Lets the app be reused for the next hackathon without nuking data. Optional in v1, scaffold the column now. |
| **Add `meal_sessions.event_id`, `start_time`, `end_time`, `max_claims_per_user` (default 1).** | Future flex: snacks vs. dinner. Logic still defaults to 1. |
| **Add `judge_rounds` table** (`name, weight, max_score_per_rubric, is_active`). | Today "Round 1" is a string literal; tomorrow there's a finals round with different weights. |
| **Add `score_rubrics` table** (`key, label, max_score, weight, round_id`). | Today rubrics are 4 hard-coded INT columns. New design stores `judge_scores.scores JSONB` keyed by rubric `key`. → Adding a "design" rubric = `INSERT score_rubrics`, no migration. |
| **Add `audit_log` table** (actor_id, action, entity, entity_id, before, after, ts). | Required for any post-event dispute. |
| **`profiles.qr_token` → `profiles.qr_secret` (HMAC-signed JWT-style).** | Today the QR is a raw UUID stored plaintext. New: signed token with `iat`/`exp` so leaked photos go stale. Edge function verifies on scan. |
| **`scan_attendance(qr, staff_id)` Postgres RPC** (SECURITY DEFINER). | Atomic: validate token → toggle `is_inside_venue` → insert log. No client-side flip. |
| **`claim_meal(qr, meal_type, staff_id)` RPC.** | Atomic claim with friendly error codes. |
| **`submit_score(team_id, round_id, scores jsonb)` RPC.** | Validates `scores` against active rubrics. |
| **Drop "Anyone can view teams" public SELECT on `teams`.** | Replace with a `leaderboard_view` (materialized or filtered RLS) so the leaderboard is a curated read, not a raw table dump. |
| **Tighten profile SELECT.** | Today *judge* can read every profile column including `email`, `phone`, `dietary_restrictions`. Replace with a `profile_public` view exposing only what each role needs. |

### 1.3 RLS model (target)

| Table | participant | volunteer | judge | super_admin |
|---|---|---|---|---|
| `profiles` | own row R/W (whitelisted cols) | R-all (id/name/team/qr_state) | R-assigned-teams only | R/W all |
| `teams` | R-own + via leaderboard view | R-all | R-assigned | R/W |
| `attendance_logs` | own R | R + INSERT-via-RPC | — | R/W |
| `meal_transactions` | own R | R + INSERT-via-RPC | — | R/W |
| `meal_sessions` | R | R | — | R/W |
| `judge_assignments` | — | — | own R | R/W |
| `judge_scores` | — | — | own R/W via RPC | R/W |
| `queries` | own R/W | — | — | R/W |
| `audit_log` | — | — | — | R |

→ All `INSERT/UPDATE` policies for write-sensitive tables (attendance_logs, meal_transactions, judge_scores) become `WITH CHECK (false)` for client; RPCs do the writes.

---

## Phase 2 — Feature Matrix & User Journeys

### 2.1 Roles & primary jobs-to-be-done

| Role | Primary job |
|---|---|
| **super_admin** | "Set up the event in <30min, monitor it live, resolve anomalies, export results." |
| **volunteer** | "Scan fast. See instantly if it worked. Recover from edge cases without leaving the camera." |
| **judge** | "Score my assigned teams in <2min each. Save state if I leave." |
| **participant** | "Show my QR. Find my team. See where I rank. Get help fast." |

### 2.2 Feature matrix (what's kept, improved, or added)

| Area | Today | New version |
|---|---|---|
| **Auth** | Email/password Tabs (Sign In / Sign Up) on `/auth` | Sign-in only by default. Self-signup is **disabled** for events; admin bulk-imports participants. Magic-link option added. |
| **Admin Dashboard** | 5 stat cards + 3 recent-activity panels | KPI strip + 3 swappable widgets (Attendance gauge, Meal claim funnel, Query SLA). Date-range scoped. CSV export for each panel. |
| **Admin Users** | CSV import → creates auth user + profile via edge fn; downloads passwords CSV; role edit + delete | Same flow + (a) **dry-run preview** before import, (b) **resend credentials** button, (c) **ban/restore** instead of hard-delete (audit-friendly), (d) per-row activity drawer. |
| **Admin Teams** | CRUD + member list | CRUD + bulk reassign-table + drag to merge teams + lock teams (no further changes after Round 1 starts). |
| **Admin Meals** | Create session, toggle active, claimed/total counts | Same + per-meal time window (auto-disable outside window), max-claims-per-user, stockout alert at 90%. |
| **Admin Queries** | List + status + admin notes | Add: assignee, SLA timer, category-grouped Kanban view, mark-as-public-FAQ. |
| **Scanner (volunteer)** | Mode toggle (attendance/food) + camera + result screen | Persistent camera (no full-page mode switch), **head-up overlay** with live status pill, audible cue, last-5 scans tray, "undo last scan" within 30s, offline queue with retry. |
| **Judge Panel** | List of all teams with 4 sliders + total | Only **assigned** teams; inline rubric (configurable from `score_rubrics`); auto-save on slider release; "compare to my median" inline; locked once round closes. |
| **Participant Dashboard** | Profile + QR (toggle reveal) + team + queries | QR is the **hero**: full-screen one-tap show, brightness boost, signed token with countdown. Team + leaderboard rank + meal status + day timeline below. |
| **Leaderboard** | Realtime top-3 podium + table | Adds per-round breakdown, anonymized mode (toggle by admin), share-link snapshot, public read-only `/board/[event-slug]`. |
| **Help/Queries (participant)** | Modal | Full sidebar conversation thread, attachments, status notifications via toast + browser notification. |

### 2.3 User journey deltas (the UX overhaul, not just re-skin)

**Volunteer / Scanner — biggest win**
*Today:* Tap mode → tap "Start Scanner" → scan → modal result → tap "Reset" → repeat. **5 taps per scan loop.**
*New:* Open scanner → camera is already running → scan → 600ms toast at the top edge ("✓ Riya — Lunch claimed") → camera stays on → next scan. **0 taps between scans.** Mode is a segmented control sticky in the header. Errors inline at the toast level.

**Participant — QR friction**
*Today:* `/participant` → scroll → "Show My QR" button → renders 200px SVG.
*New:* `/me` is the QR. Tapping anywhere maximizes it. Brightness goes to 100%, dark UI inverts to white background for camera readability. Token has a visible 10-min refresh timer.

**Judge — long-form scoring**
*Today:* All teams in one scrollable list, sliders default to 5, "Submit" button per card.
*New:* Two-pane on desktop (team list ▸ score sheet). On mobile, swipe between teams. Auto-save on blur. "Drafts" badge on incomplete teams. Submit Round when all complete.

**Admin — first-run setup**
*New flow:* `Setup wizard` (Event details → Import participants CSV → Define meal sessions → Assign judges) — collapses what is currently 4 separate page visits into a 4-step flow accessible from `/admin/setup`. Re-runnable.

---

## Phase 3 — UI/UX Architecture

> Use the installed **`ui-ux-pro-max`** skill (`.claude/skills/ui-ux-pro-max/`) to derive concrete component specs for each screen. The principles below are what the skill should be steered with.

### 3.1 Visual language: monochrome premium

| Token | Value | Notes |
|---|---|---|
| `--background` | `#FFFFFF` (light) / `#0A0A0A` (dark) | Pure white / near-black; never tinted. |
| `--foreground` | `#0A0A0A` / `#FAFAFA` | High contrast — WCAG AAA on body text. |
| `--muted` | `#F4F4F5` / `#161616` | Cards & elevated surfaces. |
| `--muted-foreground` | `#52525B` / `#A1A1AA` | Secondary text. |
| `--border` | `#E4E4E7` / `#27272A` | 1px hairline only. No shadows except on overlays. |
| `--accent` (single) | `#000000` / `#FFFFFF` | Inverted blocks for primary CTAs. |
| `--destructive` | `#0A0A0A` on `#FCA5A5` (1 use only) | Reserved exclusively for irreversible-action confirms. |
| `--success` / `--warning` | encoded as **icons + text**, not color | Status communicated by glyph + label, e.g. `✓ Entered` `! Already claimed`. |

**Typography**
- Display: **Geist** or **Inter Display** (700/500). Sentence case headings. No all-caps except micro-labels.
- Body: **Inter** (400/500), 15/22 base on desktop, 16/24 mobile.
- Mono: **JetBrains Mono** for codes (team_code, qr_token preview).
- Type scale: `12 / 13 / 15 / 18 / 24 / 32 / 48`. Stop. No 14px, no 20px.

**Spacing**
- 4px grid only. Section gutters are 32px / 48px / 64px (S/M/L).
- Cards: 24px padding desktop, 16px mobile. 1px border, **no shadow** at rest, 0–4px shadow on hover/focus.

**Motion**
- 120ms ease-out for state changes, 240ms ease-in-out for layout. Nothing over 300ms.
- Skeletons over spinners. Spinners only when work is server-blocked >400ms.

### 3.2 Layout strategy per role

| Role | Shell | Why |
|---|---|---|
| **super_admin** | **Persistent left sidebar** (collapsible to icons) + top breadcrumb + content | Many sections, deep navigation, desk-bound. Sidebar matches data-density of admin work. |
| **volunteer** | **No chrome** — full-bleed scanner + sticky bottom bar (mode + last-5 scans) | Single-task, mobile, hands-busy. Every pixel is camera. |
| **judge** | **Two-pane** (teams list 320px / score sheet) on desktop; **swipeable cards** on mobile | Rapid context switching between teams. |
| **participant** | **Mobile-first single-column** with bottom tab bar (`Me / Team / Board / Help`) | They live on phones. Bottom nav beats hamburger. |
| **public `/board/:slug`** | Centered content, no nav, projector-friendly (`?display=tv` mode) | Often shown on a screen at venue. |

### 3.3 Routing structure

```
/                                    → role-based redirect (same as today)
/auth/sign-in                        → split out from tabs
/auth/forgot
/auth/magic                          → magic link

# Admin (sidebar shell)
/admin                               → KPI dashboard
/admin/setup                         → wizard (NEW)
/admin/users                         → list + drawer
/admin/users/import                  → CSV import flow w/ dry-run
/admin/teams
/admin/teams/:id                     → drawer / sub-route
/admin/meals
/admin/queries                       → kanban
/admin/judging                       → assignments + rounds (NEW)
/admin/audit                         → audit_log viewer (NEW)

# Volunteer (no-chrome shell)
/scan                                → unified scanner (mode in header)

# Judge (two-pane shell)
/judge                               → assigned teams list
/judge/:teamId                       → score sheet

# Participant (bottom-nav shell)
/me                                  → QR-first profile
/me/team
/me/board                            → mobile-formatted leaderboard
/me/help                             → queries thread

# Public
/board/:eventSlug                    → public leaderboard, projector-mode
```

### 3.4 Component architecture (target tree)

```
src/
  app/                                 # routing, providers, error boundaries
    providers/{Query,Auth,Theme,Realtime}.tsx
    routes.tsx
    shells/{AdminShell,ScanShell,JudgeShell,ParticipantShell,PublicShell}.tsx
  domain/                              # PURE business logic, zero React, zero supabase
    attendance/{rules.ts,types.ts,index.ts}
    meals/{rules.ts,types.ts,index.ts}
    scoring/{rules.ts,rubrics.ts,types.ts,index.ts}
    queries/{rules.ts,types.ts}
    auth/{roles.ts,permissions.ts}
    qr/{token.ts,verify.ts}            # HMAC sign/verify
  data/                                # supabase adapter — only place that imports @supabase/supabase-js
    client.ts
    rpc/{scanAttendance.ts,claimMeal.ts,submitScore.ts,...}
    queries/{teams.ts,profiles.ts,...} # TanStack Query hooks
    realtime/{attendance.ts,meals.ts,scores.ts}
    schemas/                           # zod parsers from generated DB types
    types.gen.ts                       # supabase gen types output
  features/                            # UI per feature, calls data/* + domain/*
    admin-dashboard/...
    admin-users/...
    scanner/{ScannerView,LastScansTray,ScanFeedback}.tsx
    judging/{TeamList,ScoreSheet,RubricSlider}.tsx
    participant/{QrHero,TeamCard,QueryThread}.tsx
    leaderboard/{Podium,RankTable,ProjectorMode}.tsx
  components/
    ui/                                # shadcn primitives (only)
    composite/                         # KpiCard, EmptyState, DataTable, Drawer, StatusPill...
  lib/{cn,date,csv,toast}.ts
  styles/{tokens.css,typography.css}
  config/                              # FEATURE-FLAGGED RULE BUNDLES
    rules.scoring.v1.ts                # active set
    rules.scoring.v2.ts                # ready-to-swap
    rules.meals.ts
    rules.attendance.ts
```

### 3.5 The "swap a rule without breaking the UI" pattern

```ts
// domain/scoring/types.ts
export type ScoreContext = { round: Round; rubrics: Rubric[]; existing?: ScoreSheet };
export type ScoreRule = (ctx: ScoreContext, input: ScoreInput) =>
  | { ok: true; sheet: ScoreSheet }
  | { ok: false; code: 'OUT_OF_RANGE' | 'ROUND_LOCKED' | 'MISSING_RUBRIC'; message: string };

// domain/scoring/rules.ts
export const v1ScoreRule: ScoreRule = (ctx, input) => { /* ... */ };
export const v2ScoreRule: ScoreRule = (ctx, input) => { /* weighted, with veto */ };

// config/rules.scoring.v1.ts
import { v1ScoreRule } from '@/domain/scoring/rules';
export const activeScoreRule = v1ScoreRule;

// features/judging/ScoreSheet.tsx
import { activeScoreRule } from '@/config/rules.scoring.v1';
const result = activeScoreRule(ctx, input); // UI renders error.code → friendly copy via i18n map
```

→ Switching v1 → v2 is changing one import in `config/`. UI receives the same `{ ok, sheet | code }` shape. The Edge Function on the server imports the same `activeScoreRule` to enforce server-side.

---

## Phase 4 — Execution Steps

> **Each step lists what we run, what you (the user) do, and the artifact produced.**
> Stops marked **🛑 NEED YOU** are points where I will pause for confirmation/credentials.

### Step 0 — Inventory & decisions (now)
- ✅ Codebase analyzed (this doc).
- ✅ `uipro-cli@2.2.3` installed at `~/.npm-global/bin/uipro`. `--global` flag is unsupported in this version; skill copied to both `NewERP/.claude/skills/ui-ux-pro-max/` (project) and `~/.claude/skills/ui-ux-pro-max/` (global).
- ✅ Verified Matrix_Maven org has one Supabase project (`gyopozvfmggumidptmjr`, "Abishai95141's Project", `ap-northeast-1`, ACTIVE_HEALTHY) — **its `public` schema is empty.**
- 🛑 **NEED YOU:** Pick one:
  - **(A)** Use the empty `gyopozvfmggumidptmjr` as the new instance (zero cost, fastest).
  - **(B)** Create a brand-new Supabase project (e.g. `hackhustle-erp-v2`) under Matrix_Maven (incurs cost confirmation prompt). I'll need region (`ap-northeast-1` recommended).
  - **(C)** You already have a different new project — share its ref + anon key.

### Step 1 — New Supabase instance ready
- I run `mcp__Supabase__create_project` (option B) or skip (A).
- I capture: `project_ref`, `anon_key`, `service_role_key`, `db_host`.
- 🛑 **NEED YOU** (if option B): Approve the cost confirmation.
- Artifact: `NewERP/.env.local` populated with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PROJECT_ID`.

### Step 2 — Schema migration
- Apply v1 migration (port of existing schema, lightly cleaned):
  - enums, tables, RLS, `has_role`, `get_user_role`, `handle_new_user`, `update_team_score`, realtime publications.
- Apply v2 migration (new design):
  - `events`, `judge_rounds`, `score_rubrics`, `audit_log`.
  - `judge_scores.scores jsonb` column (kept alongside legacy 4 cols, populated from them).
  - RPCs: `scan_attendance`, `claim_meal`, `submit_score`.
  - Tighten RLS: drop client write paths on attendance/meals/scores.
- Seed: 1 default `event`, 1 default `Round 1` with 4 rubrics matching today's columns. → existing UI keeps working.
- Artifact: `supabase/migrations/{0001_init.sql, 0002_v2_extensions.sql, 0003_seed_defaults.sql}`.

### Step 3 — Frontend bootstrap (`NewERP/`)
- `npm create vite@latest . -- --template react-ts` inside `NewERP/`.
- Add: tailwind, shadcn/ui (init), TanStack Query, React Router, zod, react-hook-form, sonner, html5-qrcode, qrcode.react, papaparse, date-fns, lucide-react.
- Drop in `tsconfig.app.json` paths, `components.json`, `tailwind.config.ts` (with monochrome tokens from §3.1), `src/styles/tokens.css`.
- Wire providers (`QueryClient`, `AuthProvider`, `ThemeProvider` for light/dark mono, `RealtimeProvider`).
- Generate types: `supabase gen types typescript --project-id ... > src/data/types.gen.ts`.

### Step 4 — Domain layer first
- Implement `domain/{auth, qr, attendance, meals, scoring, queries}` as pure modules with **unit tests** (vitest). No UI yet.
- Set `config/rules.*.ts` to v1 implementations.
- Artifact: green `npm test` before any screen exists.

### Step 5 — Data layer
- `data/client.ts` (single Supabase client).
- `data/queries/*` → TanStack Query hooks (`useTeams`, `useProfile(id)`, `useMyAssignments`, etc.).
- `data/rpc/*` → typed wrappers around the new RPCs.
- `data/realtime/*` → realtime channels that **invalidate** TanStack queries (no parallel state).

### Step 6 — Shells & routing
- Build the 5 shells (`AdminShell`, `ScanShell`, `JudgeShell`, `ParticipantShell`, `PublicShell`) with the monochrome tokens in place.
- Wire role-based redirect + `ProtectedRoute`.
- Artifact: clickable empty app, every route reachable, role gating works.

### Step 7 — Feature builds (in this order, each shipped before next starts)
1. **Auth** (`/auth/sign-in` + magic link). → unblocks everything.
2. **Participant `/me`** (QR hero + team + queries + leaderboard rank). → easiest, validates monochrome aesthetic.
3. **Volunteer `/scan`** (persistent camera + RPCs). → validates RPC + realtime path.
4. **Admin `/admin/users`** (CSV import + edge fn). → validates write path + admin shell.
5. **Admin teams + meals + queries**.
6. **Judge** `/judge` two-pane.
7. **Public `/board/:slug`** + projector mode.
8. **Admin dashboard** (KPI strip, last; depends on data accumulated).

For each feature I will invoke the **`ui-ux-pro-max`** skill before coding, to generate the spec (component breakdown, states, edge cases, a11y) per screen, then implement against that spec.

### Step 8 — Edge functions
- Port `create-user` + `delete-user` (with audit logging).
- New: `scan-attendance`, `claim-meal`, `submit-score` (call the corresponding RPCs but apply rate limits + better error mapping).
- Deploy via `mcp__Supabase__deploy_edge_function`.

### Step 9 — Hardening
- a11y pass (axe), keyboard-only run-through every screen.
- Lighthouse mobile ≥ 90 on `/me` and `/scan`.
- Offline test for scanner (queue + retry).
- Smoke test with seed data: 50 fake users / 12 teams / 2 judges / 4 meal sessions.

### Step 10 — Cutover
- Export production data from old project (CSV) if needed.
- Import into new instance via the same admin CSV path.
- Update DNS / Vercel project to point at new build.
- Old repo archived; new repo lives under `NewERP/`.

---

## What I need from you to proceed

1. **Supabase choice** (A/B/C in Step 0 above).
2. **Event metadata** for seeding: event name, slug, dates. (Default: "HackHustle 2026 Spring", `hackhustle-2026-spring`, today + 2 days.)
3. **Should self-signup stay enabled** or be admin-only (default: admin-only)?
4. **Light or Dark default?** Monochrome works in both — I'll build both, but I need a default. (Recommendation: **dark** for participant/scanner, **light** for admin/judge — auto by role, user-overridable.)
5. **GitHub repo** — should `NewERP/` be a separate repo, a sibling, or replace `HackHustle-ERP` after cutover?

Once those are answered, I start at Step 1 immediately. Steps 2–6 are non-interactive and ship in one work block; Step 7 is iterative and you'll see each feature land before the next begins.
