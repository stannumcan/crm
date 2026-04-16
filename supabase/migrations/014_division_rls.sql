-- ─────────────────────────────────────────────────────────────
-- MULTI-DIVISION FOUNDATION (Phase 2)
--
-- Layers division-based isolation on top of the existing
-- page-permission RLS. Each scoped table now requires BOTH:
--   1. The user has page permission for the relevant action
--      (existing rule from migration 004 / 008)
--   2. The user has access to the row's division
--      (new rule via user_can_access_division)
--
-- Super-admins (user_profiles.is_super_admin = true) bypass the
-- division check, enabling the combined cross-division dashboard.
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- HELPER: user_can_access_division(uuid)
--
-- Returns true if the current user can act on rows in the given
-- division. Super-admins bypass the check.
--
-- Returns true for non-user contexts (service role) so internal
-- API calls aren't blocked. Service role bypasses RLS anyway,
-- but this matches the convention used in user_has_page_permission.
-- ─────────────────────────────────────────────────────────────
create or replace function public.user_can_access_division(p_division_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_super boolean;
begin
  if v_uid is null then
    return true; -- service role / non-user context
  end if;

  -- p_division_id null = row not yet scoped; allow (shouldn't happen post-migration 013)
  if p_division_id is null then
    return true;
  end if;

  -- Super-admin bypass
  select coalesce(up.is_super_admin, false) into v_super
  from public.user_profiles up
  where up.user_id = v_uid;

  if coalesce(v_super, false) then
    return true;
  end if;

  -- User must have a matching user_divisions row
  return exists (
    select 1 from public.user_divisions ud
    where ud.user_id = v_uid
      and ud.division_id = p_division_id
  );
end;
$$;

grant execute on function public.user_can_access_division(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- HELPER: user_active_division_ids()
--
-- Returns the set of division ids accessible to the current user.
-- Used internally and exposed to API for client-side hints.
-- ─────────────────────────────────────────────────────────────
create or replace function public.user_active_division_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_super boolean;
begin
  if v_uid is null then
    return query select id from public.divisions;
    return;
  end if;

  select coalesce(up.is_super_admin, false) into v_super
  from public.user_profiles up
  where up.user_id = v_uid;

  if coalesce(v_super, false) then
    return query select id from public.divisions;
    return;
  end if;

  return query
    select ud.division_id
    from public.user_divisions ud
    where ud.user_id = v_uid;
end;
$$;

grant execute on function public.user_active_division_ids() to authenticated;

-- ─────────────────────────────────────────────────────────────
-- POLICIES
--
-- For each scoped table, we drop the existing policies and
-- recreate them with a division-access AND clause. The page-
-- permission logic is preserved verbatim from migrations 004 + 008.
-- ─────────────────────────────────────────────────────────────

-- ─── work_orders ─────────────────────────────────────────────
drop policy if exists "select by workorders view" on public.work_orders;
drop policy if exists "insert by workorders create" on public.work_orders;
drop policy if exists "update by workorders edit" on public.work_orders;
drop policy if exists "delete by workorders delete" on public.work_orders;

create policy "wo_select" on public.work_orders
  for select to authenticated
  using (
    public.user_has_page_permission('workorders','view')
    and public.user_can_access_division(division_id)
  );
create policy "wo_insert" on public.work_orders
  for insert to authenticated
  with check (
    public.user_has_page_permission('workorders','create')
    and public.user_can_access_division(division_id)
  );
create policy "wo_update" on public.work_orders
  for update to authenticated
  using (
    public.user_has_page_permission('workorders','edit')
    and public.user_can_access_division(division_id)
  )
  with check (
    public.user_has_page_permission('workorders','edit')
    and public.user_can_access_division(division_id)
  );
create policy "wo_delete" on public.work_orders
  for delete to authenticated
  using (
    public.user_has_page_permission('workorders','delete')
    and public.user_can_access_division(division_id)
  );

-- ─── quotations ──────────────────────────────────────────────
drop policy if exists "select by quotes_requests view or any workflow edit" on public.quotations;
drop policy if exists "insert by quotes_requests create" on public.quotations;
drop policy if exists "update by quotes_requests edit" on public.quotations;
drop policy if exists "delete by quotes_requests delete" on public.quotations;

create policy "q_select" on public.quotations
  for select to authenticated
  using (
    (
      public.user_has_page_permission('quotes_requests','view')
      or public.user_has_page_permission('quotes_factory_sheet','edit')
      or public.user_has_page_permission('quotes_wilfred_calc','edit')
      or public.user_has_page_permission('quotes_ddp_calc','edit')
      or public.user_has_page_permission('quotes_customer_quote','edit')
    )
    and public.user_can_access_division(division_id)
  );
create policy "q_insert" on public.quotations
  for insert to authenticated
  with check (
    public.user_has_page_permission('quotes_requests','create')
    and public.user_can_access_division(division_id)
  );
create policy "q_update" on public.quotations
  for update to authenticated
  using (
    public.user_has_page_permission('quotes_requests','edit')
    and public.user_can_access_division(division_id)
  )
  with check (
    public.user_has_page_permission('quotes_requests','edit')
    and public.user_can_access_division(division_id)
  );
create policy "q_delete" on public.quotations
  for delete to authenticated
  using (
    public.user_has_page_permission('quotes_requests','delete')
    and public.user_can_access_division(division_id)
  );

-- ─── quotation_quantity_tiers ────────────────────────────────
drop policy if exists "select by quotes_requests view or any workflow edit" on public.quotation_quantity_tiers;
drop policy if exists "insert by quotes_requests create" on public.quotation_quantity_tiers;
drop policy if exists "update by quotes_requests edit" on public.quotation_quantity_tiers;
drop policy if exists "delete by quotes_requests delete" on public.quotation_quantity_tiers;

create policy "qt_select" on public.quotation_quantity_tiers
  for select to authenticated
  using (
    (
      public.user_has_page_permission('quotes_requests','view')
      or public.user_has_page_permission('quotes_factory_sheet','edit')
      or public.user_has_page_permission('quotes_wilfred_calc','edit')
      or public.user_has_page_permission('quotes_ddp_calc','edit')
      or public.user_has_page_permission('quotes_customer_quote','edit')
    )
    and public.user_can_access_division(division_id)
  );
create policy "qt_insert" on public.quotation_quantity_tiers
  for insert to authenticated
  with check (
    public.user_has_page_permission('quotes_requests','create')
    and public.user_can_access_division(division_id)
  );
create policy "qt_update" on public.quotation_quantity_tiers
  for update to authenticated
  using (
    public.user_has_page_permission('quotes_requests','edit')
    and public.user_can_access_division(division_id)
  )
  with check (
    public.user_has_page_permission('quotes_requests','edit')
    and public.user_can_access_division(division_id)
  );
create policy "qt_delete" on public.quotation_quantity_tiers
  for delete to authenticated
  using (
    public.user_has_page_permission('quotes_requests','delete')
    and public.user_can_access_division(division_id)
  );

-- ─── quotation_attachments ──────────────────────────────────
drop policy if exists "select by quotes_requests view or any workflow edit" on public.quotation_attachments;
drop policy if exists "insert by quotes_requests create" on public.quotation_attachments;
drop policy if exists "update by quotes_requests edit" on public.quotation_attachments;
drop policy if exists "delete by quotes_requests delete" on public.quotation_attachments;

create policy "qa_select" on public.quotation_attachments
  for select to authenticated
  using (
    (
      public.user_has_page_permission('quotes_requests','view')
      or public.user_has_page_permission('quotes_factory_sheet','edit')
      or public.user_has_page_permission('quotes_wilfred_calc','edit')
      or public.user_has_page_permission('quotes_ddp_calc','edit')
      or public.user_has_page_permission('quotes_customer_quote','edit')
    )
    and public.user_can_access_division(division_id)
  );
create policy "qa_insert" on public.quotation_attachments
  for insert to authenticated
  with check (
    public.user_has_page_permission('quotes_requests','create')
    and public.user_can_access_division(division_id)
  );
create policy "qa_update" on public.quotation_attachments
  for update to authenticated
  using (
    public.user_has_page_permission('quotes_requests','edit')
    and public.user_can_access_division(division_id)
  )
  with check (
    public.user_has_page_permission('quotes_requests','edit')
    and public.user_can_access_division(division_id)
  );
create policy "qa_delete" on public.quotation_attachments
  for delete to authenticated
  using (
    public.user_has_page_permission('quotes_requests','delete')
    and public.user_can_access_division(division_id)
  );

-- ─── factory_cost_sheets ────────────────────────────────────
drop policy if exists "select by factory_sheet view or downstream edit" on public.factory_cost_sheets;
drop policy if exists "insert by quotes_factory_sheet edit" on public.factory_cost_sheets;
drop policy if exists "update by quotes_factory_sheet edit" on public.factory_cost_sheets;
drop policy if exists "delete by quotes_factory_sheet edit" on public.factory_cost_sheets;

create policy "fcs_select" on public.factory_cost_sheets
  for select to authenticated
  using (
    (
      public.user_has_page_permission('quotes_factory_sheet','view')
      or public.user_has_page_permission('quotes_wilfred_calc','edit')
      or public.user_has_page_permission('quotes_ddp_calc','edit')
      or public.user_has_page_permission('quotes_customer_quote','edit')
    )
    and public.user_can_access_division(division_id)
  );
create policy "fcs_insert" on public.factory_cost_sheets
  for insert to authenticated
  with check (
    public.user_has_page_permission('quotes_factory_sheet','edit')
    and public.user_can_access_division(division_id)
  );
create policy "fcs_update" on public.factory_cost_sheets
  for update to authenticated
  using (
    public.user_has_page_permission('quotes_factory_sheet','edit')
    and public.user_can_access_division(division_id)
  )
  with check (
    public.user_has_page_permission('quotes_factory_sheet','edit')
    and public.user_can_access_division(division_id)
  );
create policy "fcs_delete" on public.factory_cost_sheets
  for delete to authenticated
  using (
    public.user_has_page_permission('quotes_factory_sheet','edit')
    and public.user_can_access_division(division_id)
  );

-- ─── factory_cost_tiers ─────────────────────────────────────
drop policy if exists "select by factory_sheet view or downstream edit" on public.factory_cost_tiers;
drop policy if exists "insert by quotes_factory_sheet edit" on public.factory_cost_tiers;
drop policy if exists "update by quotes_factory_sheet edit" on public.factory_cost_tiers;
drop policy if exists "delete by quotes_factory_sheet edit" on public.factory_cost_tiers;

create policy "fct_select" on public.factory_cost_tiers
  for select to authenticated
  using (
    (
      public.user_has_page_permission('quotes_factory_sheet','view')
      or public.user_has_page_permission('quotes_wilfred_calc','edit')
      or public.user_has_page_permission('quotes_ddp_calc','edit')
      or public.user_has_page_permission('quotes_customer_quote','edit')
    )
    and public.user_can_access_division(division_id)
  );
create policy "fct_insert" on public.factory_cost_tiers
  for insert to authenticated
  with check (
    public.user_has_page_permission('quotes_factory_sheet','edit')
    and public.user_can_access_division(division_id)
  );
create policy "fct_update" on public.factory_cost_tiers
  for update to authenticated
  using (
    public.user_has_page_permission('quotes_factory_sheet','edit')
    and public.user_can_access_division(division_id)
  )
  with check (
    public.user_has_page_permission('quotes_factory_sheet','edit')
    and public.user_can_access_division(division_id)
  );
create policy "fct_delete" on public.factory_cost_tiers
  for delete to authenticated
  using (
    public.user_has_page_permission('quotes_factory_sheet','edit')
    and public.user_can_access_division(division_id)
  );

-- ─── factory_cost_components ────────────────────────────────
drop policy if exists "select by factory_sheet view or downstream edit" on public.factory_cost_components;
drop policy if exists "insert by quotes_factory_sheet edit" on public.factory_cost_components;
drop policy if exists "update by quotes_factory_sheet edit" on public.factory_cost_components;
drop policy if exists "delete by quotes_factory_sheet edit" on public.factory_cost_components;

create policy "fcc_select" on public.factory_cost_components
  for select to authenticated
  using (
    (
      public.user_has_page_permission('quotes_factory_sheet','view')
      or public.user_has_page_permission('quotes_wilfred_calc','edit')
      or public.user_has_page_permission('quotes_ddp_calc','edit')
      or public.user_has_page_permission('quotes_customer_quote','edit')
    )
    and public.user_can_access_division(division_id)
  );
create policy "fcc_insert" on public.factory_cost_components
  for insert to authenticated
  with check (
    public.user_has_page_permission('quotes_factory_sheet','edit')
    and public.user_can_access_division(division_id)
  );
create policy "fcc_update" on public.factory_cost_components
  for update to authenticated
  using (
    public.user_has_page_permission('quotes_factory_sheet','edit')
    and public.user_can_access_division(division_id)
  )
  with check (
    public.user_has_page_permission('quotes_factory_sheet','edit')
    and public.user_can_access_division(division_id)
  );
create policy "fcc_delete" on public.factory_cost_components
  for delete to authenticated
  using (
    public.user_has_page_permission('quotes_factory_sheet','edit')
    and public.user_can_access_division(division_id)
  );

-- ─── wilfred_calculations ───────────────────────────────────
drop policy if exists "select by wilfred_calc view or downstream edit" on public.wilfred_calculations;
drop policy if exists "insert by quotes_wilfred_calc edit" on public.wilfred_calculations;
drop policy if exists "update by quotes_wilfred_calc edit" on public.wilfred_calculations;
drop policy if exists "delete by quotes_wilfred_calc edit" on public.wilfred_calculations;

create policy "wc_select" on public.wilfred_calculations
  for select to authenticated
  using (
    (
      public.user_has_page_permission('quotes_wilfred_calc','view')
      or public.user_has_page_permission('quotes_ddp_calc','edit')
      or public.user_has_page_permission('quotes_customer_quote','edit')
    )
    and public.user_can_access_division(division_id)
  );
create policy "wc_insert" on public.wilfred_calculations
  for insert to authenticated
  with check (
    public.user_has_page_permission('quotes_wilfred_calc','edit')
    and public.user_can_access_division(division_id)
  );
create policy "wc_update" on public.wilfred_calculations
  for update to authenticated
  using (
    public.user_has_page_permission('quotes_wilfred_calc','edit')
    and public.user_can_access_division(division_id)
  )
  with check (
    public.user_has_page_permission('quotes_wilfred_calc','edit')
    and public.user_can_access_division(division_id)
  );
create policy "wc_delete" on public.wilfred_calculations
  for delete to authenticated
  using (
    public.user_has_page_permission('quotes_wilfred_calc','edit')
    and public.user_can_access_division(division_id)
  );

-- ─── annie_quotations ───────────────────────────────────────
-- annie_quotations had no explicit policy in earlier migrations beyond the
-- inherited allow_all. We'll add a permissive policy that mirrors the
-- factory-sheet downstream rule + division check.
drop policy if exists "allow_all" on public.annie_quotations;
drop policy if exists "aq_select" on public.annie_quotations;
drop policy if exists "aq_insert" on public.annie_quotations;
drop policy if exists "aq_update" on public.annie_quotations;
drop policy if exists "aq_delete" on public.annie_quotations;

create policy "aq_select" on public.annie_quotations
  for select to authenticated
  using (
    (
      public.user_has_page_permission('quotes_factory_sheet','view')
      or public.user_has_page_permission('quotes_ddp_calc','edit')
      or public.user_has_page_permission('quotes_customer_quote','edit')
    )
    and public.user_can_access_division(division_id)
  );
create policy "aq_insert" on public.annie_quotations
  for insert to authenticated
  with check (
    public.user_has_page_permission('quotes_factory_sheet','edit')
    and public.user_can_access_division(division_id)
  );
create policy "aq_update" on public.annie_quotations
  for update to authenticated
  using (
    public.user_has_page_permission('quotes_factory_sheet','edit')
    and public.user_can_access_division(division_id)
  )
  with check (
    public.user_has_page_permission('quotes_factory_sheet','edit')
    and public.user_can_access_division(division_id)
  );
create policy "aq_delete" on public.annie_quotations
  for delete to authenticated
  using (
    public.user_has_page_permission('quotes_factory_sheet','edit')
    and public.user_can_access_division(division_id)
  );

-- ─── natsuki_ddp_calculations ───────────────────────────────
drop policy if exists "select by ddp_calc view or downstream edit" on public.natsuki_ddp_calculations;
drop policy if exists "insert by quotes_ddp_calc edit" on public.natsuki_ddp_calculations;
drop policy if exists "update by quotes_ddp_calc edit" on public.natsuki_ddp_calculations;
drop policy if exists "delete by quotes_ddp_calc edit" on public.natsuki_ddp_calculations;

create policy "nd_select" on public.natsuki_ddp_calculations
  for select to authenticated
  using (
    (
      public.user_has_page_permission('quotes_ddp_calc','view')
      or public.user_has_page_permission('quotes_customer_quote','edit')
    )
    and public.user_can_access_division(division_id)
  );
create policy "nd_insert" on public.natsuki_ddp_calculations
  for insert to authenticated
  with check (
    public.user_has_page_permission('quotes_ddp_calc','edit')
    and public.user_can_access_division(division_id)
  );
create policy "nd_update" on public.natsuki_ddp_calculations
  for update to authenticated
  using (
    public.user_has_page_permission('quotes_ddp_calc','edit')
    and public.user_can_access_division(division_id)
  )
  with check (
    public.user_has_page_permission('quotes_ddp_calc','edit')
    and public.user_can_access_division(division_id)
  );
create policy "nd_delete" on public.natsuki_ddp_calculations
  for delete to authenticated
  using (
    public.user_has_page_permission('quotes_ddp_calc','edit')
    and public.user_can_access_division(division_id)
  );

-- ─── customer_quotes ────────────────────────────────────────
drop policy if exists "select by quotes_customer_quote view" on public.customer_quotes;
drop policy if exists "insert by quotes_customer_quote edit" on public.customer_quotes;
drop policy if exists "update by quotes_customer_quote edit" on public.customer_quotes;
drop policy if exists "delete by quotes_customer_quote edit" on public.customer_quotes;

create policy "cq_select" on public.customer_quotes
  for select to authenticated
  using (
    public.user_has_page_permission('quotes_customer_quote','view')
    and public.user_can_access_division(division_id)
  );
create policy "cq_insert" on public.customer_quotes
  for insert to authenticated
  with check (
    public.user_has_page_permission('quotes_customer_quote','edit')
    and public.user_can_access_division(division_id)
  );
create policy "cq_update" on public.customer_quotes
  for update to authenticated
  using (
    public.user_has_page_permission('quotes_customer_quote','edit')
    and public.user_can_access_division(division_id)
  )
  with check (
    public.user_has_page_permission('quotes_customer_quote','edit')
    and public.user_can_access_division(division_id)
  );
create policy "cq_delete" on public.customer_quotes
  for delete to authenticated
  using (
    public.user_has_page_permission('quotes_customer_quote','edit')
    and public.user_can_access_division(division_id)
  );

-- ─── companies ──────────────────────────────────────────────
drop policy if exists "select by customers view" on public.companies;
drop policy if exists "insert by customers create" on public.companies;
drop policy if exists "update by customers edit" on public.companies;
drop policy if exists "delete by customers delete" on public.companies;

create policy "co_select" on public.companies
  for select to authenticated
  using (
    public.user_has_page_permission('customers','view')
    and public.user_can_access_division(division_id)
  );
create policy "co_insert" on public.companies
  for insert to authenticated
  with check (
    public.user_has_page_permission('customers','create')
    and public.user_can_access_division(division_id)
  );
create policy "co_update" on public.companies
  for update to authenticated
  using (
    public.user_has_page_permission('customers','edit')
    and public.user_can_access_division(division_id)
  )
  with check (
    public.user_has_page_permission('customers','edit')
    and public.user_can_access_division(division_id)
  );
create policy "co_delete" on public.companies
  for delete to authenticated
  using (
    public.user_has_page_permission('customers','delete')
    and public.user_can_access_division(division_id)
  );

-- ─── company_contacts ───────────────────────────────────────
drop policy if exists "select by customers view" on public.company_contacts;
drop policy if exists "insert by customers create" on public.company_contacts;
drop policy if exists "update by customers edit" on public.company_contacts;
drop policy if exists "delete by customers delete" on public.company_contacts;

create policy "cc_select" on public.company_contacts
  for select to authenticated
  using (
    public.user_has_page_permission('customers','view')
    and public.user_can_access_division(division_id)
  );
create policy "cc_insert" on public.company_contacts
  for insert to authenticated
  with check (
    public.user_has_page_permission('customers','create')
    and public.user_can_access_division(division_id)
  );
create policy "cc_update" on public.company_contacts
  for update to authenticated
  using (
    public.user_has_page_permission('customers','edit')
    and public.user_can_access_division(division_id)
  )
  with check (
    public.user_has_page_permission('customers','edit')
    and public.user_can_access_division(division_id)
  );
create policy "cc_delete" on public.company_contacts
  for delete to authenticated
  using (
    public.user_has_page_permission('customers','delete')
    and public.user_can_access_division(division_id)
  );

-- ─── workorder_milestones ───────────────────────────────────
drop policy if exists "select by workorders view or any workflow edit" on public.workorder_milestones;
drop policy if exists "insert by workorders edit" on public.workorder_milestones;
drop policy if exists "update by workorders edit" on public.workorder_milestones;
drop policy if exists "delete by workorders edit" on public.workorder_milestones;

create policy "wm_select" on public.workorder_milestones
  for select to authenticated
  using (
    (
      public.user_has_page_permission('workorders','view')
      or public.user_has_page_permission('quotes_factory_sheet','edit')
      or public.user_has_page_permission('quotes_wilfred_calc','edit')
      or public.user_has_page_permission('quotes_ddp_calc','edit')
      or public.user_has_page_permission('quotes_customer_quote','edit')
    )
    and public.user_can_access_division(division_id)
  );
create policy "wm_insert" on public.workorder_milestones
  for insert to authenticated
  with check (
    public.user_has_page_permission('workorders','edit')
    and public.user_can_access_division(division_id)
  );
create policy "wm_update" on public.workorder_milestones
  for update to authenticated
  using (
    public.user_has_page_permission('workorders','edit')
    and public.user_can_access_division(division_id)
  )
  with check (
    public.user_has_page_permission('workorders','edit')
    and public.user_can_access_division(division_id)
  );
create policy "wm_delete" on public.workorder_milestones
  for delete to authenticated
  using (
    public.user_has_page_permission('workorders','edit')
    and public.user_can_access_division(division_id)
  );

-- ─── workflow_steps ─────────────────────────────────────────
-- Previously allow_all_authenticated. Now division-scoped: each user sees
-- only their division's workflow configuration.
drop policy if exists "allow_all_authenticated" on public.workflow_steps;
drop policy if exists "ws_select" on public.workflow_steps;
drop policy if exists "ws_write" on public.workflow_steps;

create policy "ws_select" on public.workflow_steps
  for select to authenticated
  using (public.user_can_access_division(division_id));

-- Workflow editing is admin-level; require settings page permission
-- in addition to division access.
create policy "ws_insert" on public.workflow_steps
  for insert to authenticated
  with check (
    public.user_has_page_permission('settings','view')
    and public.user_can_access_division(division_id)
  );
create policy "ws_update" on public.workflow_steps
  for update to authenticated
  using (
    public.user_has_page_permission('settings','view')
    and public.user_can_access_division(division_id)
  )
  with check (
    public.user_has_page_permission('settings','view')
    and public.user_can_access_division(division_id)
  );
create policy "ws_delete" on public.workflow_steps
  for delete to authenticated
  using (
    public.user_has_page_permission('settings','view')
    and public.user_can_access_division(division_id)
  );

-- ─── workflow_email_log ─────────────────────────────────────
drop policy if exists "allow_all_authenticated" on public.workflow_email_log;
drop policy if exists "wel_select" on public.workflow_email_log;
drop policy if exists "wel_insert" on public.workflow_email_log;

-- Read-only audit log for users; service role inserts via admin client
create policy "wel_select" on public.workflow_email_log
  for select to authenticated
  using (public.user_can_access_division(division_id));

create policy "wel_insert" on public.workflow_email_log
  for insert to authenticated
  with check (public.user_can_access_division(division_id));

-- ─── workflow_change_log ────────────────────────────────────
drop policy if exists "allow_all_authenticated" on public.workflow_change_log;
drop policy if exists "wcl_select" on public.workflow_change_log;
drop policy if exists "wcl_insert" on public.workflow_change_log;

create policy "wcl_select" on public.workflow_change_log
  for select to authenticated
  using (public.user_can_access_division(division_id));

create policy "wcl_insert" on public.workflow_change_log
  for insert to authenticated
  with check (public.user_can_access_division(division_id));

-- ─────────────────────────────────────────────────────────────
-- Tables intentionally NOT division-scoped in this migration:
--   - molds: shared catalog, all divisions see all molds
--   - permission_profiles: role definitions are global
--   - app_settings: existing JSONB keys can be per-division
--     (e.g. wo_sequence_start['JP-26'] vs ['CA-26']); table itself global
--   - user_profiles: each row is owned by its user; readable by all
--     authenticated for assignee dropdowns
--   - divisions / user_divisions: handled in migration 012
--   - nm_mold_sequence: global mold numbering counter
-- ─────────────────────────────────────────────────────────────
