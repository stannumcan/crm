-- ─────────────────────────────────────────────────────────────
-- MULTI-DIVISION FOUNDATION (Phase 1a)
--
-- Adds support for multiple business divisions sharing one
-- database with RLS isolation:
--   - Winhoop (JP) — existing data, all rows backfilled here
--   - Stannum Can (CA) — new, starts clean
--
-- This migration creates:
--   1. divisions table (lookup, seeded with JP + CA)
--   2. user_divisions junction (supports cross-division users)
--   3. user_profiles extensions (active_division_id, is_super_admin)
--
-- Subsequent migrations:
--   013 → adds division_id columns to scoped tables + backfill
--   014 → RLS policies enforcing division isolation
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- 1. divisions: lookup table for business divisions
-- ─────────────────────────────────────────────────────────────
create table if not exists public.divisions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                       -- 'JP' | 'CA'
  name text not null,                              -- 'Winhoop' | 'Stannum Can'
  country text not null,                           -- 'JP' | 'CA'
  default_customer_currency text not null,         -- 'JPY' | 'USD'
  default_factory_currency text not null,          -- 'CNY' | 'USD'
  wire_currency text not null,                     -- 'CNY' | 'USD'
  wo_prefix text not null,                         -- 'JP' | 'CA' (used in wo_number formatting)
  created_at timestamptz not null default now()
);

comment on table public.divisions is
  'Business divisions sharing the CRM. Used as a tenant/isolation boundary via RLS.';

-- Seed both divisions
insert into public.divisions (code, name, country, default_customer_currency, default_factory_currency, wire_currency, wo_prefix)
values
  ('JP', 'Winhoop',     'JP', 'JPY', 'CNY', 'CNY', 'JP'),
  ('CA', 'Stannum Can', 'CA', 'USD', 'USD', 'USD', 'CA')
on conflict (code) do nothing;

-- ─────────────────────────────────────────────────────────────
-- 2. user_divisions: which divisions each user can access
--
-- Most users belong to exactly one division. Cross-division users
-- (accounting team Lynn Yip + LY Zhang, super-admin Wilfred) have
-- multiple rows. The is_primary flag picks their default UI division.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.user_divisions (
  user_id uuid not null references auth.users(id) on delete cascade,
  division_id uuid not null references public.divisions(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, division_id)
);

create index if not exists idx_user_divisions_user on public.user_divisions(user_id);
create index if not exists idx_user_divisions_division on public.user_divisions(division_id);

-- Only one division can be marked primary per user
create unique index if not exists ux_user_divisions_one_primary
  on public.user_divisions(user_id)
  where is_primary;

comment on table public.user_divisions is
  'Junction: which divisions each user can access. Primary row picks their default UI scope.';

-- ─────────────────────────────────────────────────────────────
-- 3. user_profiles: track active division + super-admin flag
-- ─────────────────────────────────────────────────────────────
alter table public.user_profiles
  add column if not exists active_division_id uuid references public.divisions(id),
  add column if not exists is_super_admin boolean not null default false;

comment on column public.user_profiles.active_division_id is
  'Currently selected division for UI filtering. Defaults to user_divisions.is_primary on session load. Super-admins can set this to NULL to view combined data across divisions.';

comment on column public.user_profiles.is_super_admin is
  'Bypasses division isolation when true (e.g. Wilfred). Combined dashboard shows merged data from all divisions.';

-- ─────────────────────────────────────────────────────────────
-- 4. Backfill: assign all existing users to Winhoop (JP)
--    On a fresh branch this is a no-op. On production it ensures
--    no user is left without a division.
-- ─────────────────────────────────────────────────────────────
do $$
declare
  jp_id uuid;
begin
  select id into jp_id from public.divisions where code = 'JP';

  -- Insert one membership row per existing user (JP + primary)
  insert into public.user_divisions (user_id, division_id, is_primary)
  select up.user_id, jp_id, true
  from public.user_profiles up
  on conflict do nothing;

  -- Set active_division_id on user_profiles
  update public.user_profiles
     set active_division_id = jp_id
   where active_division_id is null;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 5. Enable RLS on the new tables (policies added in migration 014)
-- ─────────────────────────────────────────────────────────────
alter table public.divisions enable row level security;
alter table public.user_divisions enable row level security;

-- Allow authenticated users to read the divisions lookup (needed
-- for header dropdowns, division names on rows, etc.)
create policy "divisions_read_all" on public.divisions
  for select to authenticated using (true);

-- Users can read their own division memberships
create policy "user_divisions_own_read" on public.user_divisions
  for select to authenticated
  using (user_id = auth.uid());

-- Service role / admin write paths bypass RLS; UI uses an admin
-- API endpoint (added in Phase 3) to manage memberships.
