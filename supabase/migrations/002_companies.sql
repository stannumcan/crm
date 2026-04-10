-- Companies Module
-- Run this in your Supabase SQL editor AFTER 001_initial_schema.sql

-- ─────────────────────────────────────────
-- COMPANIES
-- ─────────────────────────────────────────
create table companies (
  id uuid primary key default gen_random_uuid(),
  -- Names in all three languages
  name text not null,                    -- primary name (often English or romanised)
  name_ja text,                          -- Japanese name e.g. ユニバーサル・スタジオ・ジャパン
  name_zh text,                          -- Chinese name
  -- Classification
  country text not null default 'JP',    -- JP | CN | CA | other
  region text,                           -- e.g. 大阪, 東京, 広島
  industry text,                         -- e.g. Retail, Food, Theme Park
  -- Address
  postal_code text,
  address_line1 text,
  address_line2 text,
  city text,
  prefecture text,                       -- Japan: prefecture, CN: province
  -- Contact info (general)
  phone text,
  fax text,
  website text,
  email text,
  -- Internal
  notes text,
  is_active bool not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- COMPANY CONTACTS (individual people)
-- ─────────────────────────────────────────
create table company_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  -- Name in multiple forms
  name text not null,                    -- Display name (romanised or default)
  name_ja text,                          -- Japanese name 田中様
  name_zh text,                          -- Chinese name
  title text,                            -- 部長, Manager, 課長, etc.
  department text,
  email text,
  phone text,
  phone_direct text,                     -- Direct line
  is_primary bool not null default false,
  notes text,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- Link work_orders to companies (optional — keeps backwards compat)
-- ─────────────────────────────────────────
alter table work_orders add column if not exists company_id uuid references companies(id) on delete set null;

-- ─────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────
create index idx_companies_name on companies using gin(to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(name_ja,'') || ' ' || coalesce(name_zh,'')));
create index idx_companies_country on companies(country);
create index idx_companies_is_active on companies(is_active);
create index idx_company_contacts_company on company_contacts(company_id);

-- ─────────────────────────────────────────
-- UPDATED_AT TRIGGER
-- ─────────────────────────────────────────
create trigger companies_updated_at
  before update on companies
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────
alter table companies enable row level security;
alter table company_contacts enable row level security;

create policy "allow_all" on companies for all using (true) with check (true);
create policy "allow_all" on company_contacts for all using (true) with check (true);
