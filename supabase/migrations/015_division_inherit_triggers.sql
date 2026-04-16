-- ─────────────────────────────────────────────────────────────
-- MULTI-DIVISION FOUNDATION (Phase 1c)
--
-- Auto-populate division_id on INSERT for child tables by
-- inheriting from the parent. This avoids touching 30+ API
-- routes — they keep inserting child rows without specifying
-- division_id, and the trigger fills it in from the parent FK.
--
-- The trigger runs BEFORE INSERT, so the row is correctly
-- division-scoped when RLS WITH CHECK runs afterwards.
--
-- If the API explicitly provides division_id, the trigger
-- respects it (doesn't overwrite).
-- ─────────────────────────────────────────────────────────────

-- ─── quotations ← work_orders.division_id ───────────────────
create or replace function public.tg_inherit_division_quotations()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if new.division_id is null and new.wo_id is not null then
    select wo.division_id into new.division_id
    from public.work_orders wo where wo.id = new.wo_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_inherit_division on public.quotations;
create trigger trg_inherit_division
  before insert on public.quotations
  for each row execute function public.tg_inherit_division_quotations();

-- ─── quotation_quantity_tiers ← quotations ──────────────────
create or replace function public.tg_inherit_division_qt()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if new.division_id is null and new.quotation_id is not null then
    select q.division_id into new.division_id
    from public.quotations q where q.id = new.quotation_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_inherit_division on public.quotation_quantity_tiers;
create trigger trg_inherit_division
  before insert on public.quotation_quantity_tiers
  for each row execute function public.tg_inherit_division_qt();

-- ─── quotation_attachments ← quotations ─────────────────────
create or replace function public.tg_inherit_division_qa()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if new.division_id is null and new.quotation_id is not null then
    select q.division_id into new.division_id
    from public.quotations q where q.id = new.quotation_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_inherit_division on public.quotation_attachments;
create trigger trg_inherit_division
  before insert on public.quotation_attachments
  for each row execute function public.tg_inherit_division_qa();

-- ─── factory_cost_sheets ← quotations ───────────────────────
create or replace function public.tg_inherit_division_fcs()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if new.division_id is null and new.quotation_id is not null then
    select q.division_id into new.division_id
    from public.quotations q where q.id = new.quotation_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_inherit_division on public.factory_cost_sheets;
create trigger trg_inherit_division
  before insert on public.factory_cost_sheets
  for each row execute function public.tg_inherit_division_fcs();

-- ─── factory_cost_components ← factory_cost_sheets ──────────
create or replace function public.tg_inherit_division_fcc()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if new.division_id is null and new.cost_sheet_id is not null then
    select fcs.division_id into new.division_id
    from public.factory_cost_sheets fcs where fcs.id = new.cost_sheet_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_inherit_division on public.factory_cost_components;
create trigger trg_inherit_division
  before insert on public.factory_cost_components
  for each row execute function public.tg_inherit_division_fcc();

-- ─── factory_cost_tiers ← factory_cost_sheets ───────────────
create or replace function public.tg_inherit_division_fct()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if new.division_id is null and new.cost_sheet_id is not null then
    select fcs.division_id into new.division_id
    from public.factory_cost_sheets fcs where fcs.id = new.cost_sheet_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_inherit_division on public.factory_cost_tiers;
create trigger trg_inherit_division
  before insert on public.factory_cost_tiers
  for each row execute function public.tg_inherit_division_fct();

-- ─── wilfred_calculations ← factory_cost_sheets ─────────────
create or replace function public.tg_inherit_division_wc()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if new.division_id is null and new.cost_sheet_id is not null then
    select fcs.division_id into new.division_id
    from public.factory_cost_sheets fcs where fcs.id = new.cost_sheet_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_inherit_division on public.wilfred_calculations;
create trigger trg_inherit_division
  before insert on public.wilfred_calculations
  for each row execute function public.tg_inherit_division_wc();

-- ─── annie_quotations ← quotations ──────────────────────────
create or replace function public.tg_inherit_division_aq()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if new.division_id is null and new.quotation_id is not null then
    select q.division_id into new.division_id
    from public.quotations q where q.id = new.quotation_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_inherit_division on public.annie_quotations;
create trigger trg_inherit_division
  before insert on public.annie_quotations
  for each row execute function public.tg_inherit_division_aq();

-- ─── natsuki_ddp_calculations ← quotations ──────────────────
create or replace function public.tg_inherit_division_nd()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if new.division_id is null and new.quotation_id is not null then
    select q.division_id into new.division_id
    from public.quotations q where q.id = new.quotation_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_inherit_division on public.natsuki_ddp_calculations;
create trigger trg_inherit_division
  before insert on public.natsuki_ddp_calculations
  for each row execute function public.tg_inherit_division_nd();

-- ─── customer_quotes ← quotations ───────────────────────────
create or replace function public.tg_inherit_division_cq()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if new.division_id is null and new.quotation_id is not null then
    select q.division_id into new.division_id
    from public.quotations q where q.id = new.quotation_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_inherit_division on public.customer_quotes;
create trigger trg_inherit_division
  before insert on public.customer_quotes
  for each row execute function public.tg_inherit_division_cq();

-- ─── company_contacts ← companies ───────────────────────────
create or replace function public.tg_inherit_division_cc()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if new.division_id is null and new.company_id is not null then
    select c.division_id into new.division_id
    from public.companies c where c.id = new.company_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_inherit_division on public.company_contacts;
create trigger trg_inherit_division
  before insert on public.company_contacts
  for each row execute function public.tg_inherit_division_cc();

-- ─── workorder_milestones ← work_orders ─────────────────────
create or replace function public.tg_inherit_division_wm()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if new.division_id is null and new.workorder_id is not null then
    select wo.division_id into new.division_id
    from public.work_orders wo where wo.id = new.workorder_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_inherit_division on public.workorder_milestones;
create trigger trg_inherit_division
  before insert on public.workorder_milestones
  for each row execute function public.tg_inherit_division_wm();

-- ─── workflow_email_log ← quotations ────────────────────────
create or replace function public.tg_inherit_division_wel()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if new.division_id is null and new.quotation_id is not null then
    select q.division_id into new.division_id
    from public.quotations q where q.id = new.quotation_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_inherit_division on public.workflow_email_log;
create trigger trg_inherit_division
  before insert on public.workflow_email_log
  for each row execute function public.tg_inherit_division_wel();

-- ─── workflow_change_log ────────────────────────────────────
-- The audit log row's division depends on the entity_type/entity_id.
-- We resolve the division for the most common entity types (quotation,
-- factory_cost_sheet, etc.). If unknown, division_id stays null and
-- the application/service-role insert can supply it explicitly.
create or replace function public.tg_inherit_division_wcl()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if new.division_id is not null or new.entity_id is null then
    return new;
  end if;

  case new.entity_type
    when 'quotation' then
      select q.division_id into new.division_id
      from public.quotations q where q.id = new.entity_id;
    when 'factory_cost_sheet' then
      select fcs.division_id into new.division_id
      from public.factory_cost_sheets fcs where fcs.id = new.entity_id;
    when 'wilfred_calculation' then
      select wc.division_id into new.division_id
      from public.wilfred_calculations wc where wc.id = new.entity_id;
    when 'natsuki_ddp_calculation' then
      select nd.division_id into new.division_id
      from public.natsuki_ddp_calculations nd where nd.id = new.entity_id;
    when 'customer_quote' then
      select cq.division_id into new.division_id
      from public.customer_quotes cq where cq.id = new.entity_id;
    when 'work_order' then
      select wo.division_id into new.division_id
      from public.work_orders wo where wo.id = new.entity_id;
    else
      -- unknown entity type — leave null; service role can supply explicitly
      null;
  end case;

  return new;
end $$;

drop trigger if exists trg_inherit_division on public.workflow_change_log;
create trigger trg_inherit_division
  before insert on public.workflow_change_log
  for each row execute function public.tg_inherit_division_wcl();
