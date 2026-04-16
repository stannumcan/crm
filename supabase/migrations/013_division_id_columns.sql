-- ─────────────────────────────────────────────────────────────
-- MULTI-DIVISION FOUNDATION (Phase 1b)
--
-- Adds denormalized division_id column to every scoped table.
-- Denormalization (vs joining up to the parent in RLS) is a
-- deliberate choice — division_id is invisible to users, never
-- entered manually, and denormalized lookups keep RLS policies
-- single-column (fast, no joins). Decided 2026-04-16.
--
-- All existing rows are backfilled to JP (Winhoop). Stannum Can
-- starts with zero rows in every table.
-- ─────────────────────────────────────────────────────────────

-- Helper: pull the JP division id once into a variable for backfill
do $$
declare
  jp_id uuid;
begin
  select id into jp_id from public.divisions where code = 'JP';
  if jp_id is null then
    raise exception 'Migration 012 must run before 013 (divisions table not seeded)';
  end if;

  -- ─── work_orders ─────────────────────────────────────────
  alter table public.work_orders
    add column if not exists division_id uuid references public.divisions(id);
  update public.work_orders set division_id = jp_id where division_id is null;
  alter table public.work_orders alter column division_id set not null;
  create index if not exists idx_work_orders_division on public.work_orders(division_id);

  -- ─── companies ───────────────────────────────────────────
  alter table public.companies
    add column if not exists division_id uuid references public.divisions(id);
  update public.companies set division_id = jp_id where division_id is null;
  alter table public.companies alter column division_id set not null;
  create index if not exists idx_companies_division on public.companies(division_id);

  -- ─── company_contacts ───────────────────────────────────
  alter table public.company_contacts
    add column if not exists division_id uuid references public.divisions(id);
  update public.company_contacts cc
     set division_id = c.division_id
    from public.companies c
   where cc.company_id = c.id
     and cc.division_id is null;
  alter table public.company_contacts alter column division_id set not null;
  create index if not exists idx_company_contacts_division on public.company_contacts(division_id);

  -- ─── quotations ──────────────────────────────────────────
  alter table public.quotations
    add column if not exists division_id uuid references public.divisions(id);
  update public.quotations q
     set division_id = wo.division_id
    from public.work_orders wo
   where q.wo_id = wo.id
     and q.division_id is null;
  -- Any quotations without a parent WO (shouldn't exist) → JP fallback
  update public.quotations set division_id = jp_id where division_id is null;
  alter table public.quotations alter column division_id set not null;
  create index if not exists idx_quotations_division on public.quotations(division_id);

  -- ─── quotation_quantity_tiers ────────────────────────────
  alter table public.quotation_quantity_tiers
    add column if not exists division_id uuid references public.divisions(id);
  update public.quotation_quantity_tiers t
     set division_id = q.division_id
    from public.quotations q
   where t.quotation_id = q.id
     and t.division_id is null;
  update public.quotation_quantity_tiers set division_id = jp_id where division_id is null;
  alter table public.quotation_quantity_tiers alter column division_id set not null;
  create index if not exists idx_quotation_tiers_division on public.quotation_quantity_tiers(division_id);

  -- ─── quotation_attachments ───────────────────────────────
  alter table public.quotation_attachments
    add column if not exists division_id uuid references public.divisions(id);
  update public.quotation_attachments a
     set division_id = q.division_id
    from public.quotations q
   where a.quotation_id = q.id
     and a.division_id is null;
  update public.quotation_attachments set division_id = jp_id where division_id is null;
  alter table public.quotation_attachments alter column division_id set not null;
  create index if not exists idx_quotation_attachments_division on public.quotation_attachments(division_id);

  -- ─── factory_cost_sheets ─────────────────────────────────
  alter table public.factory_cost_sheets
    add column if not exists division_id uuid references public.divisions(id);
  update public.factory_cost_sheets fcs
     set division_id = q.division_id
    from public.quotations q
   where fcs.quotation_id = q.id
     and fcs.division_id is null;
  update public.factory_cost_sheets set division_id = jp_id where division_id is null;
  alter table public.factory_cost_sheets alter column division_id set not null;
  create index if not exists idx_factory_cost_sheets_division on public.factory_cost_sheets(division_id);

  -- ─── factory_cost_components ─────────────────────────────
  alter table public.factory_cost_components
    add column if not exists division_id uuid references public.divisions(id);
  update public.factory_cost_components fcc
     set division_id = fcs.division_id
    from public.factory_cost_sheets fcs
   where fcc.cost_sheet_id = fcs.id
     and fcc.division_id is null;
  update public.factory_cost_components set division_id = jp_id where division_id is null;
  alter table public.factory_cost_components alter column division_id set not null;
  create index if not exists idx_factory_cost_components_division on public.factory_cost_components(division_id);

  -- ─── factory_cost_tiers ──────────────────────────────────
  alter table public.factory_cost_tiers
    add column if not exists division_id uuid references public.divisions(id);
  update public.factory_cost_tiers fct
     set division_id = fcs.division_id
    from public.factory_cost_sheets fcs
   where fct.cost_sheet_id = fcs.id
     and fct.division_id is null;
  update public.factory_cost_tiers set division_id = jp_id where division_id is null;
  alter table public.factory_cost_tiers alter column division_id set not null;
  create index if not exists idx_factory_cost_tiers_division on public.factory_cost_tiers(division_id);

  -- ─── wilfred_calculations ────────────────────────────────
  alter table public.wilfred_calculations
    add column if not exists division_id uuid references public.divisions(id);
  update public.wilfred_calculations wc
     set division_id = fcs.division_id
    from public.factory_cost_sheets fcs
   where wc.cost_sheet_id = fcs.id
     and wc.division_id is null;
  update public.wilfred_calculations set division_id = jp_id where division_id is null;
  alter table public.wilfred_calculations alter column division_id set not null;
  create index if not exists idx_wilfred_calculations_division on public.wilfred_calculations(division_id);

  -- ─── annie_quotations ────────────────────────────────────
  alter table public.annie_quotations
    add column if not exists division_id uuid references public.divisions(id);
  update public.annie_quotations aq
     set division_id = q.division_id
    from public.quotations q
   where aq.quotation_id = q.id
     and aq.division_id is null;
  update public.annie_quotations set division_id = jp_id where division_id is null;
  alter table public.annie_quotations alter column division_id set not null;
  create index if not exists idx_annie_quotations_division on public.annie_quotations(division_id);

  -- ─── natsuki_ddp_calculations ────────────────────────────
  alter table public.natsuki_ddp_calculations
    add column if not exists division_id uuid references public.divisions(id);
  update public.natsuki_ddp_calculations nd
     set division_id = q.division_id
    from public.quotations q
   where nd.quotation_id = q.id
     and nd.division_id is null;
  update public.natsuki_ddp_calculations set division_id = jp_id where division_id is null;
  alter table public.natsuki_ddp_calculations alter column division_id set not null;
  create index if not exists idx_natsuki_ddp_division on public.natsuki_ddp_calculations(division_id);

  -- ─── customer_quotes ─────────────────────────────────────
  alter table public.customer_quotes
    add column if not exists division_id uuid references public.divisions(id);
  update public.customer_quotes cq
     set division_id = q.division_id
    from public.quotations q
   where cq.quotation_id = q.id
     and cq.division_id is null;
  update public.customer_quotes set division_id = jp_id where division_id is null;
  alter table public.customer_quotes alter column division_id set not null;
  create index if not exists idx_customer_quotes_division on public.customer_quotes(division_id);

  -- ─── workorder_milestones ────────────────────────────────
  alter table public.workorder_milestones
    add column if not exists division_id uuid references public.divisions(id);
  update public.workorder_milestones wm
     set division_id = wo.division_id
    from public.work_orders wo
   where wm.workorder_id = wo.id
     and wm.division_id is null;
  update public.workorder_milestones set division_id = jp_id where division_id is null;
  alter table public.workorder_milestones alter column division_id set not null;
  create index if not exists idx_workorder_milestones_division on public.workorder_milestones(division_id);

  -- ─── workflow_steps ──────────────────────────────────────
  -- Currently global (one set of workflow configs). Adding division_id
  -- so each division can have its own workflow if needed in future.
  -- For now, all existing steps are JP-scoped; CA workflow steps will
  -- be created when CA users start using the system.
  alter table public.workflow_steps
    add column if not exists division_id uuid references public.divisions(id);
  update public.workflow_steps set division_id = jp_id where division_id is null;
  alter table public.workflow_steps alter column division_id set not null;
  create index if not exists idx_workflow_steps_division on public.workflow_steps(division_id);

  -- step_key was previously unique globally; now scoped per division
  -- so JP and CA can each have their own 'pending_factory' step etc.
  alter table public.workflow_steps drop constraint if exists workflow_steps_step_key_key;
  -- Drop existing unique index if it was created via the constraint
  drop index if exists workflow_steps_step_key_key;
  create unique index if not exists ux_workflow_steps_division_key
    on public.workflow_steps(division_id, step_key);

  -- ─── workflow_email_log ──────────────────────────────────
  alter table public.workflow_email_log
    add column if not exists division_id uuid references public.divisions(id);
  update public.workflow_email_log wel
     set division_id = q.division_id
    from public.quotations q
   where wel.quotation_id = q.id
     and wel.division_id is null;
  update public.workflow_email_log set division_id = jp_id where division_id is null;
  alter table public.workflow_email_log alter column division_id set not null;
  create index if not exists idx_workflow_email_log_division on public.workflow_email_log(division_id);

  -- ─── workflow_change_log ─────────────────────────────────
  -- Audit log — division derived from the underlying entity. We just
  -- backfill all existing rows to JP since that's the only division
  -- with historical data.
  alter table public.workflow_change_log
    add column if not exists division_id uuid references public.divisions(id);
  update public.workflow_change_log set division_id = jp_id where division_id is null;
  alter table public.workflow_change_log alter column division_id set not null;
  create index if not exists idx_workflow_change_log_division on public.workflow_change_log(division_id);

end $$;

-- ─────────────────────────────────────────────────────────────
-- Notes for follow-up (NOT enforced in this migration):
--   - molds: STAYS GLOBAL (no division_id) — shared catalog
--   - permission_profiles: STAYS GLOBAL — role definitions are
--     division-agnostic (e.g. "Sales Rep" is the same role in JP and CA)
--   - app_settings: existing JSONB structure already supports
--     per-division keys (e.g. wo_sequence_start['JP-26'], wo_sequence_start['CA-26'])
--     — no schema change needed
--   - nm_mold_sequence: global counter for NM-XXXX mold numbering, stays global
-- ─────────────────────────────────────────────────────────────
