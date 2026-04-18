-- -----------------------------------------------------------------
-- SALES MODULE
--
-- Migrates the standalone sales-assistant lead generation tool into
-- the CRM. Extends existing companies / company_contacts tables
-- with enrichment columns, and creates 6 new sales-specific tables.
--
-- Follows the exact conventions from migrations 014-016:
--   - division_id on every row, indexed
--   - dual RLS: user_has_page_permission + user_can_access_division
--   - BEFORE INSERT triggers for division inheritance
--   - default-deny for non-admin permission profiles
-- -----------------------------------------------------------------


-- =========================================================
-- 1A. ALTER companies — add sales-enrichment columns
-- =========================================================

alter table public.companies
  add column if not exists domain text,
  add column if not exists employee_count integer,
  add column if not exists description text,
  add column if not exists import_data_notes text,
  add column if not exists current_packaging text,
  add column if not exists opportunity_notes text,
  add column if not exists lead_source text,
  add column if not exists relevancy_score integer,
  add column if not exists relevancy_reason text,
  add column if not exists relevancy_updated_at timestamptz,
  add column if not exists enrichment_status text not null default 'none',
  add column if not exists owner_id uuid references auth.users(id) on delete set null;

-- Constraints
alter table public.companies
  drop constraint if exists companies_enrichment_status_check;
alter table public.companies
  add constraint companies_enrichment_status_check
    check (enrichment_status in ('none','pending','enriched','skipped'));

alter table public.companies
  drop constraint if exists companies_lead_source_check;
alter table public.companies
  add constraint companies_lead_source_check
    check (lead_source is null or lead_source in (
      'apollo','importyeti','referral','inbound','website','tradeshow','manual'
    ));

-- Indexes for sales queries
create index if not exists idx_companies_enrichment
  on public.companies (enrichment_status)
  where enrichment_status != 'none';

create index if not exists idx_companies_relevancy
  on public.companies (relevancy_score desc nulls last)
  where relevancy_score is not null;

create index if not exists idx_companies_owner
  on public.companies (owner_id)
  where owner_id is not null;

create index if not exists idx_companies_domain
  on public.companies (domain)
  where domain is not null;


-- =========================================================
-- 1B. ALTER company_contacts — add sales-enrichment columns
-- =========================================================

alter table public.company_contacts
  add column if not exists linkedin_url text,
  add column if not exists contact_source text,
  add column if not exists apollo_id text,
  add column if not exists email_confidence text;

alter table public.company_contacts
  drop constraint if exists cc_email_confidence_check;
alter table public.company_contacts
  add constraint cc_email_confidence_check
    check (email_confidence is null or email_confidence in ('high','medium','low'));


-- =========================================================
-- 2A. CREATE sales_deals
-- =========================================================

create table if not exists public.sales_deals (
  id              uuid primary key default gen_random_uuid(),
  division_id     uuid not null references public.divisions(id) on delete restrict,

  company_id      uuid not null references public.companies(id) on delete cascade,
  contact_id      uuid references public.company_contacts(id) on delete set null,
  stage           text not null default 'new',
  product_interest text,
  estimated_volume text,
  estimated_value  numeric(14, 2),
  next_action     text,
  next_action_date date,
  close_date      date,
  loss_reason     text,
  notes           text,
  owner_id        uuid references auth.users(id) on delete set null,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint sales_deals_stage_check
    check (stage in (
      'new','researching','contacted','responded',
      'meeting_booked','sample_sent','quoting','negotiating',
      'won','lost','nurture'
    ))
);

create index if not exists idx_sales_deals_division_stage
  on public.sales_deals (division_id, stage);

create index if not exists idx_sales_deals_company
  on public.sales_deals (company_id);

create index if not exists idx_sales_deals_next_action
  on public.sales_deals (next_action_date)
  where stage not in ('won','lost');

-- updated_at trigger
create or replace function public.tg_sales_deals_touch_updated()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_sales_deals_touch on public.sales_deals;
create trigger trg_sales_deals_touch
  before update on public.sales_deals
  for each row execute function public.tg_sales_deals_touch_updated();


-- =========================================================
-- 2B. CREATE sales_activities
-- =========================================================

create table if not exists public.sales_activities (
  id              uuid primary key default gen_random_uuid(),
  division_id     uuid not null references public.divisions(id) on delete restrict,

  company_id      uuid not null references public.companies(id) on delete cascade,
  contact_id      uuid references public.company_contacts(id) on delete set null,
  deal_id         uuid references public.sales_deals(id) on delete set null,
  type            text not null,
  subject         text,
  body            text,
  outcome         text,
  follow_up_date  date,
  created_by      uuid references auth.users(id) on delete set null,

  created_at      timestamptz not null default now(),

  constraint sales_activities_type_check
    check (type in (
      'email_sent','email_received','call','meeting',
      'note','sample_sent','linkedin_message'
    )),
  constraint sales_activities_outcome_check
    check (outcome is null or outcome in (
      'positive','neutral','negative','no_response'
    ))
);

create index if not exists idx_sales_activities_company
  on public.sales_activities (company_id, created_at desc);

create index if not exists idx_sales_activities_division
  on public.sales_activities (division_id);

create index if not exists idx_sales_activities_follow_up
  on public.sales_activities (follow_up_date)
  where follow_up_date is not null;


-- =========================================================
-- 2C. CREATE sales_email_drafts
-- =========================================================

create table if not exists public.sales_email_drafts (
  id                  uuid primary key default gen_random_uuid(),
  division_id         uuid not null references public.divisions(id) on delete restrict,

  company_id          uuid not null references public.companies(id) on delete cascade,
  contact_id          uuid references public.company_contacts(id) on delete set null,
  subject             text,
  body                text,
  status              text not null default 'draft',
  personalization_note text,
  ai_generated        boolean not null default false,
  prompt_template     text,
  created_by          uuid references auth.users(id) on delete set null,
  approved_by         uuid references auth.users(id) on delete set null,
  sent_at             timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint sales_email_drafts_status_check
    check (status in ('draft','approved','sent','rejected'))
);

create index if not exists idx_sales_email_drafts_company
  on public.sales_email_drafts (company_id);

create index if not exists idx_sales_email_drafts_division_status
  on public.sales_email_drafts (division_id, status);

-- updated_at trigger
create or replace function public.tg_sales_email_drafts_touch_updated()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_sales_email_drafts_touch on public.sales_email_drafts;
create trigger trg_sales_email_drafts_touch
  before update on public.sales_email_drafts
  for each row execute function public.tg_sales_email_drafts_touch_updated();


-- =========================================================
-- 2D. CREATE sales_company_news
-- =========================================================

create table if not exists public.sales_company_news (
  id              uuid primary key default gen_random_uuid(),
  division_id     uuid not null references public.divisions(id) on delete restrict,

  company_id      uuid not null references public.companies(id) on delete cascade,
  headline        text not null,
  url             text,
  news_source     text,
  published_date  date,
  summary         text,
  added_by        uuid references auth.users(id) on delete set null,

  created_at      timestamptz not null default now()
);

create index if not exists idx_sales_company_news_company
  on public.sales_company_news (company_id);

create index if not exists idx_sales_company_news_division
  on public.sales_company_news (division_id);


-- =========================================================
-- 2E. CREATE sales_competitors
-- =========================================================

create table if not exists public.sales_competitors (
  id              uuid primary key default gen_random_uuid(),
  division_id     uuid not null references public.divisions(id) on delete restrict,

  name            text not null,
  country         text,
  mention_count   integer not null default 0,
  first_seen      timestamptz not null default now(),
  last_seen       timestamptz not null default now(),
  prospect_names  text,
  notes           text,

  created_at      timestamptz not null default now(),

  constraint sales_competitors_division_name_unique
    unique (division_id, name)
);

create index if not exists idx_sales_competitors_division
  on public.sales_competitors (division_id);

create index if not exists idx_sales_competitors_mentions
  on public.sales_competitors (mention_count desc);


-- =========================================================
-- 2F. CREATE sales_audit_log (immutable)
-- =========================================================

create table if not exists public.sales_audit_log (
  id                uuid primary key default gen_random_uuid(),
  division_id       uuid not null references public.divisions(id) on delete restrict,

  table_name        text not null,
  row_id            uuid not null,
  action            text not null,
  before_json       jsonb,
  after_json        jsonb,
  changed_by        uuid references auth.users(id) on delete set null,
  changed_at        timestamptz not null default now(),
  reverted_audit_id uuid references public.sales_audit_log(id) on delete set null,
  transaction_id    text,

  constraint sales_audit_log_action_check
    check (action in ('insert','update','delete','revert'))
);

create index if not exists idx_sales_audit_log_table_row
  on public.sales_audit_log (table_name, row_id);

create index if not exists idx_sales_audit_log_changed_at
  on public.sales_audit_log (changed_at desc);

create index if not exists idx_sales_audit_log_division
  on public.sales_audit_log (division_id);


-- =========================================================
-- 3. DIVISION INHERITANCE TRIGGERS
--
-- Child tables inherit division_id from companies via company_id.
-- sales_competitors and sales_audit_log get division_id
-- explicitly from the caller (no parent FK to inherit from).
-- =========================================================

-- ─── sales_deals ← companies ────────────────���───────────
create or replace function public.tg_inherit_division_sd()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if new.division_id is null and new.company_id is not null then
    select c.division_id into new.division_id
    from public.companies c where c.id = new.company_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_inherit_division on public.sales_deals;
create trigger trg_inherit_division
  before insert on public.sales_deals
  for each row execute function public.tg_inherit_division_sd();

-- ─── sales_activities ← companies ──────────────────────
create or replace function public.tg_inherit_division_sa()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if new.division_id is null and new.company_id is not null then
    select c.division_id into new.division_id
    from public.companies c where c.id = new.company_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_inherit_division on public.sales_activities;
create trigger trg_inherit_division
  before insert on public.sales_activities
  for each row execute function public.tg_inherit_division_sa();

-- ─── sales_email_drafts ← companies ────────────────────
create or replace function public.tg_inherit_division_sed()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if new.division_id is null and new.company_id is not null then
    select c.division_id into new.division_id
    from public.companies c where c.id = new.company_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_inherit_division on public.sales_email_drafts;
create trigger trg_inherit_division
  before insert on public.sales_email_drafts
  for each row execute function public.tg_inherit_division_sed();

-- ─── sales_company_news ��� companies ────────────────────
create or replace function public.tg_inherit_division_scn()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if new.division_id is null and new.company_id is not null then
    select c.division_id into new.division_id
    from public.companies c where c.id = new.company_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_inherit_division on public.sales_company_news;
create trigger trg_inherit_division
  before insert on public.sales_company_news
  for each row execute function public.tg_inherit_division_scn();


-- =========================================================
-- 4. RLS POLICIES
--
-- Page key: 'sales_pipeline'
-- All tables use the dual-check pattern from migration 014.
-- sales_audit_log is immutable: select + insert only.
-- =========================================================

-- ─── sales_deals ────────────────────────────────────────
alter table public.sales_deals enable row level security;

drop policy if exists "sd_select" on public.sales_deals;
drop policy if exists "sd_insert" on public.sales_deals;
drop policy if exists "sd_update" on public.sales_deals;
drop policy if exists "sd_delete" on public.sales_deals;

create policy "sd_select" on public.sales_deals
  for select to authenticated
  using (
    public.user_has_page_permission('sales_pipeline','view')
    and public.user_can_access_division(division_id)
  );

create policy "sd_insert" on public.sales_deals
  for insert to authenticated
  with check (
    public.user_has_page_permission('sales_pipeline','create')
    and public.user_can_access_division(division_id)
  );

create policy "sd_update" on public.sales_deals
  for update to authenticated
  using (
    public.user_has_page_permission('sales_pipeline','edit')
    and public.user_can_access_division(division_id)
  )
  with check (
    public.user_has_page_permission('sales_pipeline','edit')
    and public.user_can_access_division(division_id)
  );

create policy "sd_delete" on public.sales_deals
  for delete to authenticated
  using (
    public.user_has_page_permission('sales_pipeline','delete')
    and public.user_can_access_division(division_id)
  );

-- ─── sales_activities ───────────────────────────────────
alter table public.sales_activities enable row level security;

drop policy if exists "sa_select" on public.sales_activities;
drop policy if exists "sa_insert" on public.sales_activities;
drop policy if exists "sa_update" on public.sales_activities;
drop policy if exists "sa_delete" on public.sales_activities;

create policy "sa_select" on public.sales_activities
  for select to authenticated
  using (
    public.user_has_page_permission('sales_pipeline','view')
    and public.user_can_access_division(division_id)
  );

create policy "sa_insert" on public.sales_activities
  for insert to authenticated
  with check (
    public.user_has_page_permission('sales_pipeline','create')
    and public.user_can_access_division(division_id)
  );

create policy "sa_update" on public.sales_activities
  for update to authenticated
  using (
    public.user_has_page_permission('sales_pipeline','edit')
    and public.user_can_access_division(division_id)
  )
  with check (
    public.user_has_page_permission('sales_pipeline','edit')
    and public.user_can_access_division(division_id)
  );

create policy "sa_delete" on public.sales_activities
  for delete to authenticated
  using (
    public.user_has_page_permission('sales_pipeline','delete')
    and public.user_can_access_division(division_id)
  );

-- ─── sales_email_drafts ────────────────────────────────
alter table public.sales_email_drafts enable row level security;

drop policy if exists "sed_select" on public.sales_email_drafts;
drop policy if exists "sed_insert" on public.sales_email_drafts;
drop policy if exists "sed_update" on public.sales_email_drafts;
drop policy if exists "sed_delete" on public.sales_email_drafts;

create policy "sed_select" on public.sales_email_drafts
  for select to authenticated
  using (
    public.user_has_page_permission('sales_pipeline','view')
    and public.user_can_access_division(division_id)
  );

create policy "sed_insert" on public.sales_email_drafts
  for insert to authenticated
  with check (
    public.user_has_page_permission('sales_pipeline','create')
    and public.user_can_access_division(division_id)
  );

create policy "sed_update" on public.sales_email_drafts
  for update to authenticated
  using (
    public.user_has_page_permission('sales_pipeline','edit')
    and public.user_can_access_division(division_id)
  )
  with check (
    public.user_has_page_permission('sales_pipeline','edit')
    and public.user_can_access_division(division_id)
  );

create policy "sed_delete" on public.sales_email_drafts
  for delete to authenticated
  using (
    public.user_has_page_permission('sales_pipeline','delete')
    and public.user_can_access_division(division_id)
  );

-- ─── sales_company_news ────────────────────────────────
alter table public.sales_company_news enable row level security;

drop policy if exists "scn_select" on public.sales_company_news;
drop policy if exists "scn_insert" on public.sales_company_news;
drop policy if exists "scn_update" on public.sales_company_news;
drop policy if exists "scn_delete" on public.sales_company_news;

create policy "scn_select" on public.sales_company_news
  for select to authenticated
  using (
    public.user_has_page_permission('sales_pipeline','view')
    and public.user_can_access_division(division_id)
  );

create policy "scn_insert" on public.sales_company_news
  for insert to authenticated
  with check (
    public.user_has_page_permission('sales_pipeline','create')
    and public.user_can_access_division(division_id)
  );

create policy "scn_update" on public.sales_company_news
  for update to authenticated
  using (
    public.user_has_page_permission('sales_pipeline','edit')
    and public.user_can_access_division(division_id)
  )
  with check (
    public.user_has_page_permission('sales_pipeline','edit')
    and public.user_can_access_division(division_id)
  );

create policy "scn_delete" on public.sales_company_news
  for delete to authenticated
  using (
    public.user_has_page_permission('sales_pipeline','delete')
    and public.user_can_access_division(division_id)
  );

-- ─── sales_competitors ─────────────────────────────────
alter table public.sales_competitors enable row level security;

drop policy if exists "sc_select" on public.sales_competitors;
drop policy if exists "sc_insert" on public.sales_competitors;
drop policy if exists "sc_update" on public.sales_competitors;
drop policy if exists "sc_delete" on public.sales_competitors;

create policy "sc_select" on public.sales_competitors
  for select to authenticated
  using (
    public.user_has_page_permission('sales_pipeline','view')
    and public.user_can_access_division(division_id)
  );

create policy "sc_insert" on public.sales_competitors
  for insert to authenticated
  with check (
    public.user_has_page_permission('sales_pipeline','create')
    and public.user_can_access_division(division_id)
  );

create policy "sc_update" on public.sales_competitors
  for update to authenticated
  using (
    public.user_has_page_permission('sales_pipeline','edit')
    and public.user_can_access_division(division_id)
  )
  with check (
    public.user_has_page_permission('sales_pipeline','edit')
    and public.user_can_access_division(division_id)
  );

create policy "sc_delete" on public.sales_competitors
  for delete to authenticated
  using (
    public.user_has_page_permission('sales_pipeline','delete')
    and public.user_can_access_division(division_id)
  );

-- ─── sales_audit_log (immutable: select + insert only) ─
alter table public.sales_audit_log enable row level security;

drop policy if exists "sal_select" on public.sales_audit_log;
drop policy if exists "sal_insert" on public.sales_audit_log;

create policy "sal_select" on public.sales_audit_log
  for select to authenticated
  using (
    public.user_has_page_permission('sales_pipeline','view')
    and public.user_can_access_division(division_id)
  );

create policy "sal_insert" on public.sales_audit_log
  for insert to authenticated
  with check (
    public.user_can_access_division(division_id)
  );


-- =========================================================
-- 5. DEFAULT-DENY for ALL permission profiles
--
-- user_has_page_permission() defaults missing keys to TRUE
-- (admin default), so we must explicitly deny on every profile.
-- This covers all users who have a profile_id assigned.
--
-- NOTE: Admin users without a profile_id bypass the permission
-- system entirely and will still see the Sales nav item.
-- The owner will enable access manually via Settings.
-- =========================================================

update public.permission_profiles
set permissions = jsonb_set(
  coalesce(permissions, '{}'::jsonb),
  '{pages,sales_pipeline}',
  '{"view":false,"create":false,"edit":false,"delete":false}'::jsonb,
  true
);
