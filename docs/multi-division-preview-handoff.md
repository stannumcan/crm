# Multi-Division Preview — Handoff

**Branch:** `feat/multi-division`
**Status:** Code complete, awaiting Supabase preview branch + manual testing

This document covers everything you (or anyone testing this) needs to spin
up the multi-division preview without touching the live database.

---

## What got built

### Database (4 new migrations)

| File | What it does |
|---|---|
| [supabase/migrations/012_divisions_setup.sql](../supabase/migrations/012_divisions_setup.sql) | Creates `divisions` (seeded JP + CA), `user_divisions` junction, adds `active_division_id` + `is_super_admin` to `user_profiles`. |
| [supabase/migrations/013_division_id_columns.sql](../supabase/migrations/013_division_id_columns.sql) | Adds denormalized `division_id` column to every scoped table (work_orders, quotations, factory sheets, milestones, workflows, etc.) and backfills all existing data as JP. |
| [supabase/migrations/014_division_rls.sql](../supabase/migrations/014_division_rls.sql) | RLS helpers `user_can_access_division()` + `user_active_division_ids()`. Replaces every existing scoped-table policy with a version that ANDs the page-permission check with the division check. Super-admin bypasses division check. |
| [supabase/migrations/015_division_inherit_triggers.sql](../supabase/migrations/015_division_inherit_triggers.sql) | BEFORE INSERT triggers on every child table that auto-populate `division_id` from the parent FK. Means we don't have to touch 30+ API routes individually — they keep inserting child rows naively and the trigger fills in the right division. |

### App code

- [src/lib/divisions.ts](../src/lib/divisions.ts) — types
- [src/lib/divisions-server.ts](../src/lib/divisions-server.ts) — server helpers (`pickDivisionId`)
- [src/lib/division-context.tsx](../src/lib/division-context.tsx) — React context provider
- [src/components/division/StannumPlaceholder.tsx](../src/components/division/StannumPlaceholder.tsx) — "coming soon" page for CA pricing modules
- [src/app/api/me/permissions/route.ts](../src/app/api/me/permissions/route.ts) — extended to include `division.{accessible_divisions, active_division, is_super_admin}`
- [src/app/api/me/division/route.ts](../src/app/api/me/division/route.ts) — `PATCH` to switch active division
- [src/app/api/workorders/route.ts](../src/app/api/workorders/route.ts) — derives WO prefix from active division (CA → CA260001), per-division sequence
- [src/app/api/companies/route.ts](../src/app/api/companies/route.ts) — sets `division_id` from active division
- [src/app/[locale]/layout.tsx](../src/app/[locale]/layout.tsx) — wraps children in `DivisionProvider`
- [src/components/layout/Sidebar.tsx](../src/components/layout/Sidebar.tsx) — division-aware brand (WINHOOP / STANNUM CAN / ALL DIVISIONS) + switcher dropdown for multi-division users
- [src/components/workorders/WOForm.tsx](../src/components/workorders/WOForm.tsx) — replaces the dead JP-only region select with division context display; super-admin in combined view gets a real picker
- [src/app/[locale]/quotes/[id]/ddp-calc/page.tsx](../src/app/[locale]/quotes/[id]/ddp-calc/page.tsx) + [customer-quote/page.tsx](../src/app/[locale]/quotes/[id]/customer-quote/page.tsx) — render `StannumPlaceholder` when the quote belongs to a CA division

---

## How to spin up the preview

### Step 1 — Create the Supabase branch

The MCP can't create branches automatically (cost confirmation tool isn't
exposed in this environment). Create it via the dashboard:

1. Go to <https://supabase.com/dashboard/project/lwdxvcrvrzlfetelcemt/branches>
2. Click **Create branch**
3. Name it `multi-division-preview`
4. Confirm the cost (~$0.01/hour, ~$10/month while it exists)
5. Wait ~30 seconds for it to provision. The branch will run all existing
   migrations 001–011 from main into the fresh branch DB.

### Step 2 — Apply the new migrations

Once the branch is ready, the four new migration files in this PR will be
applied automatically when they're merged into the branch (or you can
apply them manually via the MCP — give me the branch's project ref and
I'll do it).

The migrations run in order:
1. `012` creates the divisions + junction tables
2. `013` adds `division_id` columns and backfills (no-op on a fresh branch)
3. `014` swaps in division-aware RLS policies
4. `015` adds the inheritance triggers

### Step 3 — Seed test data

On the branch, seed:

```sql
-- 1. Verify both divisions exist (created by migration 012)
select * from public.divisions;
-- Expect: JP (Winhoop) and CA (Stannum Can)

-- 2. Create test users via the Supabase Auth admin UI:
--    - jp-test@example.com (single-division: JP)
--    - ca-test@example.com (single-division: CA)
--    - cross-test@example.com (both divisions, e.g. accounting)
--    - admin-test@example.com (both + super-admin)

-- 3. Wire each user to their divisions (replace the UIDs):
insert into public.user_divisions (user_id, division_id, is_primary) values
  ('<jp-test-uid>',    (select id from divisions where code='JP'), true),
  ('<ca-test-uid>',    (select id from divisions where code='CA'), true),
  ('<cross-test-uid>', (select id from divisions where code='JP'), true),
  ('<cross-test-uid>', (select id from divisions where code='CA'), false),
  ('<admin-test-uid>', (select id from divisions where code='JP'), true),
  ('<admin-test-uid>', (select id from divisions where code='CA'), false);

update public.user_profiles
   set is_super_admin = true
 where user_id = '<admin-test-uid>';

-- 4. Set everyone's active_division_id to their primary
update public.user_profiles up
   set active_division_id = ud.division_id
  from public.user_divisions ud
 where ud.user_id = up.user_id
   and ud.is_primary;

-- 5. Create a sample JP work order (will get JP260001)
--    and a sample CA work order (will get CA260001)
--    via the UI logged in as each test user.
```

### Step 4 — Point Vercel preview at the branch

1. Push `feat/multi-division` to GitHub: `git push -u origin feat/multi-division`
2. Vercel will auto-create a preview deployment for the branch
3. In the Vercel project settings → environment variables → "Preview"
   environment, override:
   - `NEXT_PUBLIC_SUPABASE_URL` → branch URL (visible on the Supabase
     branch detail page)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → branch anon key
   - `SUPABASE_SERVICE_ROLE_KEY` → branch service role key
4. Redeploy the preview so it picks up the new env vars

The preview URL stays separate from production (which keeps
talking to live Supabase). Live and preview never share a database.

### Step 5 — Test the isolation

Sign in to the preview with each test user and verify:

- **JP-only user**: sees only JP data; sidebar brand says "WINHOOP"; no division switcher
- **CA-only user**: sees only CA data; sidebar brand says "STANNUM CAN"; no division switcher
- **Cross-division user**: sees switcher in sidebar; can flip between JP and CA; data filters accordingly
- **Super-admin**: sees switcher with extra "★ All Divisions (combined)" option; in combined mode, lists show data from both with a division badge per row (badge UI is TBD — admin currently sees raw merged list)
- **WO creation**:
  - JP user → next WO is `JP26000X`
  - CA user → next WO is `CA260001`, then `CA260002`, etc.
  - Super-admin in combined mode → must pick division in the form
- **Stannum Can DDP calc / customer quote**: shows the "Coming soon" placeholder instead of Winhoop's form

### Step 6 — When ready to ship

1. Merge `feat/multi-division` to `master` → triggers production Vercel deploy
2. Apply migrations 012–015 to the live Supabase project (via MCP or CLI)
3. Existing JP data backfills correctly (every row gets the JP `division_id`)
4. Add CA users to `user_divisions` for the Stannum Can team
5. **Change the production subdomain to `crm.stannumcan.ca`** — see [stannumcan_subdomain.md memory](../../.claude/projects/c--Users-wilfr-OneDrive-Desktop-Claude-japan-crm/memory/stannumcan_subdomain.md) for the steps

---

## Things deliberately NOT in this build

These were scoped out and will be follow-ups:

1. **Stannum Can DDP calc + customer quote modules** — placeholders only. Build after multi-division foundation is live.
2. **Financial module** — still blocked on factory statement sample + accounting team. When unblocked, all financial tables get `division_id` from day one + multi-currency `currency` field per row.
3. **Combined dashboard polish** — super-admin "All Divisions" mode currently just shows the merged raw lists. Division badges per row, currency-aware totals, breakdown tooltips — all worth adding later.
4. **User management UI for `user_divisions`** — for now, division memberships are managed via SQL. The Settings → Users page should grow checkboxes for division assignment.
5. **DingTalk per-division test mode** — the test mode toggle still needs to be made per-division (so toggling test for CA doesn't affect JP).
6. **Combined statement handling** — the factory issues separate statements per division, so this is fine, but if accounting wants a unified view across divisions for one factory, that's a separate UI.

---

## Risk notes

- **Workflow steps had a unique constraint on `step_key` globally.** Migration 013 drops it and replaces with `(division_id, step_key)` unique. This means each division can have its own copy of the same step. When CA users start using the system, you'll need to seed CA-specific workflow_steps rows (or copy the JP ones with the CA `division_id`).
- **Service role bypasses RLS.** Any API route using the admin client (`@/lib/supabase/admin`) bypasses division checks. Most of those are user-management endpoints which are fine. Audit if you add new admin routes.
- **`molds`, `permission_profiles`, `app_settings` stay global.** This is intentional — molds are a shared catalog, permission profiles are role definitions, and `app_settings` uses per-division JSONB keys for things like `wo_sequence_start['JP-26']`.
- **Triggers are SECURITY DEFINER.** They bypass RLS while looking up the parent's division_id. This is correct (a child insert needs to read the parent's division to inherit it) but worth knowing.
