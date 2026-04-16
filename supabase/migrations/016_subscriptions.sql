-- ─────────────────────────────────────────────────────────────
-- SUBSCRIPTIONS MODULE
--
-- Tracks recurring software/service subscriptions (SaaS tools,
-- hosting, domains, insurance, etc.) per division. Admin-only:
-- gated via the new 'subscriptions' page permission, scoped by
-- division via user_can_access_division().
--
-- Renewal alerts are surfaced as an in-app banner on the list
-- page and a dashboard card (read from next_renewal_on).
-- Multi-currency: cost stored in the billing currency; no FX
-- conversion is performed.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.subscriptions (
  id                uuid primary key default gen_random_uuid(),
  division_id       uuid not null references public.divisions(id) on delete restrict,

  service_name      text not null,
  vendor            text,
  category          text,           -- software / hosting / domain / insurance / other
  cost_amount       numeric(14, 2) not null,
  cost_currency     text not null,  -- JPY / CAD / USD / CNY / etc.
  billing_cycle     text not null,  -- monthly / quarterly / annual / one_time
  started_on        date,
  next_renewal_on   date,
  auto_renew        boolean not null default true,
  payment_method    text,           -- free-text: "Visa ••1234", "GoDaddy M365 card", etc.
  owner_id          uuid references auth.users(id) on delete set null,
  status            text not null default 'active',  -- active / trial / canceled
  cancel_url        text,
  notes             text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint subscriptions_billing_cycle_check
    check (billing_cycle in ('monthly','quarterly','annual','one_time')),
  constraint subscriptions_status_check
    check (status in ('active','trial','canceled'))
);

create index if not exists subscriptions_division_renewal_idx
  on public.subscriptions (division_id, next_renewal_on)
  where status = 'active';

create index if not exists subscriptions_division_status_idx
  on public.subscriptions (division_id, status);

-- updated_at maintenance
create or replace function public.tg_subscriptions_touch_updated()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_subscriptions_touch on public.subscriptions;
create trigger trg_subscriptions_touch
  before update on public.subscriptions
  for each row execute function public.tg_subscriptions_touch_updated();

-- ─────────────────────────────────────────────────────────────
-- RLS: admin-only via 'subscriptions' page permission + division
-- ─────────────────────────────────────────────────────────────
alter table public.subscriptions enable row level security;

drop policy if exists "sub_select" on public.subscriptions;
drop policy if exists "sub_insert" on public.subscriptions;
drop policy if exists "sub_update" on public.subscriptions;
drop policy if exists "sub_delete" on public.subscriptions;

create policy "sub_select" on public.subscriptions
  for select to authenticated
  using (
    public.user_has_page_permission('subscriptions','view')
    and public.user_can_access_division(division_id)
  );

create policy "sub_insert" on public.subscriptions
  for insert to authenticated
  with check (
    public.user_has_page_permission('subscriptions','create')
    and public.user_can_access_division(division_id)
  );

create policy "sub_update" on public.subscriptions
  for update to authenticated
  using (
    public.user_has_page_permission('subscriptions','edit')
    and public.user_can_access_division(division_id)
  )
  with check (
    public.user_has_page_permission('subscriptions','edit')
    and public.user_can_access_division(division_id)
  );

create policy "sub_delete" on public.subscriptions
  for delete to authenticated
  using (
    public.user_has_page_permission('subscriptions','delete')
    and public.user_can_access_division(division_id)
  );

-- ─────────────────────────────────────────────────────────────
-- Default-deny 'subscriptions' for non-admin permission profiles.
-- user_has_page_permission() defaults missing keys to TRUE (admin
-- default), so existing profiles without this key would leak.
-- Patch each profile's JSON to explicitly set view=false etc.
-- Admins (no profile_id) keep full access via the default-true path.
-- ─────────────────────────────────────────────────────────────
update public.permission_profiles
set permissions = jsonb_set(
  coalesce(permissions, '{}'::jsonb),
  '{pages,subscriptions}',
  '{"view":false,"create":false,"edit":false,"delete":false}'::jsonb,
  true
)
where not (permissions -> 'pages' ? 'subscriptions');
