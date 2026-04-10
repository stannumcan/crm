-- Japan CRM Database Schema
-- Run this in your Supabase SQL editor

-- ─────────────────────────────────────────
-- WORK ORDERS
-- ─────────────────────────────────────────
create table work_orders (
  id uuid primary key default gen_random_uuid(),
  wo_number text unique not null,        -- e.g. JP260045
  region text not null default 'JP',     -- JP, future: CN, CA
  year_code text not null,               -- e.g. 26
  sequence_number int not null,          -- e.g. 45
  company_name text not null,
  project_name text not null,
  status text not null default 'active', -- active | completed | cancelled
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-increment sequence per region+year
create sequence if not exists wo_sequence_jp start 1;

-- ─────────────────────────────────────────
-- QUOTATIONS (one WO → many quotations)
-- ─────────────────────────────────────────
create table quotations (
  id uuid primary key default gen_random_uuid(),
  wo_id uuid not null references work_orders(id) on delete cascade,
  quote_version int not null default 1,
  status text not null default 'draft',
  -- draft | pending_factory | pending_wilfred | pending_natsuki | sent | approved | rejected
  urgency bool not null default false,
  deadline timestamptz,
  mold_type text not null default 'existing', -- existing | new
  mold_number text,                           -- ML-XXXX
  size_dimensions text,
  printing_lid text,
  printing_body text,
  printing_bottom text,
  printing_inner text,
  embossment bool not null default false,
  embossment_components text,               -- e.g. "Lid, Body"
  design_count int default 1,
  shipping_info_required bool not null default false,
  internal_notes text,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- QUOTATION QUANTITY TIERS
-- ─────────────────────────────────────────
create table quotation_quantity_tiers (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references quotations(id) on delete cascade,
  tier_label text not null,              -- A, B, C, D
  quantity_type text not null default 'units', -- units | fcl_20ft | fcl_40ft
  quantity int,                          -- null if FCL (calculated later)
  sort_order int not null default 0
);

-- ─────────────────────────────────────────
-- QUOTATION ATTACHMENTS
-- ─────────────────────────────────────────
create table quotation_attachments (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references quotations(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_type text,
  uploaded_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- FACTORY COST SHEETS
-- ─────────────────────────────────────────
create table factory_cost_sheets (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references quotations(id) on delete cascade,
  factory_ref_no text,                   -- factory's internal NO. e.g. 2500501
  sheet_date date,
  mold_number text,
  product_dimensions text,
  steel_type text,
  steel_thickness decimal(5,3),
  steel_price_per_ton decimal(10,2),
  process text,
  shipping_terms text default 'FOB SZ',
  -- Accessories
  accessories_name text,
  accessories_description text,          -- e.g. "塑胶圈 0.23元, 铁线圈 1.4元"
  -- Packaging (same across tiers)
  outer_carton_qty int,
  outer_carton_config text,              -- e.g. 5x4x6 A=A
  outer_carton_l int,                    -- mm
  outer_carton_w int,
  outer_carton_h int,
  outer_carton_cbm decimal(10,6),
  inner_carton_qty int,
  pallet_type text,                      -- 平卡 | 刀卡
  pallet_l int,
  pallet_w int,
  pallet_h int,
  pallet_config text,                    -- e.g. 3x3x7 layers
  cans_per_pallet int,
  -- Mold costs
  mold_cost_new decimal(10,2),           -- 开模
  mold_cost_modify decimal(10,2),        -- 改模
  mold_lead_time_days int,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- FACTORY COST COMPONENTS (Lid/Body/Bottom/Inner)
-- ─────────────────────────────────────────
create table factory_cost_components (
  id uuid primary key default gen_random_uuid(),
  cost_sheet_id uuid not null references factory_cost_sheets(id) on delete cascade,
  component text not null,               -- lid | body | bottom | inner_lid
  cut_size text,
  layout text,
  steel_unit_price decimal(10,4),
  printing_requirements text,
  printing_cost_per_sheet decimal(10,4),
  printing_unit_price decimal(10,4)
);

-- ─────────────────────────────────────────
-- FACTORY COST TIERS (per quantity tier)
-- ─────────────────────────────────────────
create table factory_cost_tiers (
  id uuid primary key default gen_random_uuid(),
  cost_sheet_id uuid not null references factory_cost_sheets(id) on delete cascade,
  tier_label text not null,              -- A, B, C, D
  quantity int not null,
  -- 总成本合计 components
  steel_cost decimal(10,4),             -- 铁料
  printing_cost decimal(10,4),          -- 印刷
  packaging_cost decimal(10,4),         -- 包装
  shipping_cost decimal(10,4),          -- 运输
  total_subtotal decimal(10,4),         -- 总成本合计 (steel+print+pkg+ship)
  -- Excluded from subtotal
  labor_cost decimal(10,4),             -- 人工
  accessories_cost decimal(10,4),       -- 配件
  -- Packaging details for this tier
  container_info text                   -- e.g. "20GP 10 pallets"
);

-- ─────────────────────────────────────────
-- WILFRED CALCULATIONS
-- ─────────────────────────────────────────
create table wilfred_calculations (
  id uuid primary key default gen_random_uuid(),
  cost_sheet_id uuid not null references factory_cost_sheets(id) on delete cascade,
  tier_label text not null,
  quantity int not null,
  -- Inputs from factory sheet
  total_subtotal decimal(10,4) not null,
  labor_cost decimal(10,4) not null default 0,
  accessories_cost decimal(10,4) not null default 0,
  -- Formula parameters (adjustable per quote)
  overhead_multiplier decimal(5,2) not null default 1.0, -- overhead = labor × this
  margin_rate decimal(5,2) not null default 0.20,        -- 20% default
  -- Result
  -- Formula: (total_subtotal + labor + accessories + labor×overhead) × (1 + margin)
  estimated_cost_rmb decimal(10,4),
  -- Approval
  approved bool not null default false,
  approved_at timestamptz,
  wilfred_notes text,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- ANNIE QUOTATIONS (clean quote to Natsuki)
-- ─────────────────────────────────────────
create table annie_quotations (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references quotations(id) on delete cascade,
  date_generated timestamptz default now(),
  date_sent timestamptz,
  notes text,
  file_url text                          -- stored Excel/PDF export
);

-- ─────────────────────────────────────────
-- NATSUKI DDP CALCULATIONS
-- ─────────────────────────────────────────
create table natsuki_ddp_calculations (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references quotations(id) on delete cascade,
  annie_quotation_id uuid references annie_quotations(id),
  tier_label text not null,
  quantity int not null,                 -- customer order qty
  -- Inputs
  rmb_unit_price decimal(10,4) not null,
  fx_rate_rmb_to_jpy decimal(8,2) not null,
  shipping_type text not null default 'lcl', -- lcl | fcl_20ft | fcl_40ft | multi_container
  shipping_cost_jpy int,                 -- manually entered or calculated
  import_duty_rate decimal(5,4) not null default 0.04,
  consumption_tax_rate decimal(5,4) not null default 0.0,
  -- Calculated logistics
  cartons_ordered int,
  factory_production_qty int,
  pallets int,
  total_cbm decimal(10,4),
  -- Cost breakdown (JPY)
  manufacturing_cost_jpy int,
  total_cost_jpy int,
  -- Margin selection
  selected_margin decimal(5,2),          -- e.g. 0.40 = 40%
  unit_price_jpy int,
  total_revenue_jpy int,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- CUSTOMER QUOTES (お見積書)
-- ─────────────────────────────────────────
create table customer_quotes (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references quotations(id) on delete cascade,
  ddp_calculation_id uuid references natsuki_ddp_calculations(id),
  winhoop_quote_number text,             -- W11028624 format
  customer_name text not null,
  customer_contact text,
  date_sent timestamptz,
  mold_cost_jpy int,
  emboss_cost_jpy int,
  sample_cost_jpy int,
  lead_time_mold text,
  lead_time_sample text,
  lead_time_production text,
  payment_terms_tooling text default 'ご入金確認後に着手いたします',
  payment_terms_production text default 'お届け後、末締めご請求、翌月末お支払にて',
  validity_days int default 30,
  fx_rate_note decimal(8,2),            -- rate shown in quote notes
  notes text,
  file_url text,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────
create index idx_work_orders_region_year on work_orders(region, year_code);
create index idx_quotations_wo_id on quotations(wo_id);
create index idx_quotations_status on quotations(status);
create index idx_factory_cost_sheets_quotation on factory_cost_sheets(quotation_id);
create index idx_wilfred_calc_sheet on wilfred_calculations(cost_sheet_id);
create index idx_ddp_calc_quotation on natsuki_ddp_calculations(quotation_id);

-- ─────────────────────────────────────────
-- UPDATED_AT TRIGGER
-- ─────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger work_orders_updated_at
  before update on work_orders
  for each row execute function update_updated_at();

create trigger quotations_updated_at
  before update on quotations
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY (enable but allow all for now)
-- ─────────────────────────────────────────
alter table work_orders enable row level security;
alter table quotations enable row level security;
alter table quotation_quantity_tiers enable row level security;
alter table quotation_attachments enable row level security;
alter table factory_cost_sheets enable row level security;
alter table factory_cost_components enable row level security;
alter table factory_cost_tiers enable row level security;
alter table wilfred_calculations enable row level security;
alter table annie_quotations enable row level security;
alter table natsuki_ddp_calculations enable row level security;
alter table customer_quotes enable row level security;

-- Allow all operations for authenticated users (tighten later with user roles)
create policy "allow_all" on work_orders for all using (true) with check (true);
create policy "allow_all" on quotations for all using (true) with check (true);
create policy "allow_all" on quotation_quantity_tiers for all using (true) with check (true);
create policy "allow_all" on quotation_attachments for all using (true) with check (true);
create policy "allow_all" on factory_cost_sheets for all using (true) with check (true);
create policy "allow_all" on factory_cost_components for all using (true) with check (true);
create policy "allow_all" on factory_cost_tiers for all using (true) with check (true);
create policy "allow_all" on wilfred_calculations for all using (true) with check (true);
create policy "allow_all" on annie_quotations for all using (true) with check (true);
create policy "allow_all" on natsuki_ddp_calculations for all using (true) with check (true);
create policy "allow_all" on customer_quotes for all using (true) with check (true);
