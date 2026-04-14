-- ─────────────────────────────────────────────────────────────
-- PAGE-LEVEL PERMISSION HELPER
-- Reads the current user's profile permissions (from user_profiles
-- → permission_profiles) and returns whether the action is allowed
-- for the given page key.
--
-- Rules:
--   - auth.uid() is null (service role / anonymous) → allow (service
--     role bypasses RLS entirely anyway; this just avoids spurious
--     denials in non-user contexts)
--   - user has no user_profiles row → allow (admin default)
--   - user has a row but no profile_id → allow (admin default)
--   - permission field missing in JSON → allow (matches canView()
--     semantics: `pages[page]?.view !== false`)
--   - permission field explicitly false → deny
-- ─────────────────────────────────────────────────────────────
create or replace function public.user_has_page_permission(
  p_page   text,
  p_action text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_profile_id uuid;
  v_value      jsonb;
begin
  if v_uid is null then
    return true; -- non-user context; RLS shouldn't block internal calls
  end if;

  select up.profile_id
    into v_profile_id
  from public.user_profiles up
  where up.user_id = v_uid
  limit 1;

  -- No profile row OR no profile assigned → full access (admin default)
  if v_profile_id is null then
    return true;
  end if;

  select pp.permissions -> 'pages' -> p_page -> p_action
    into v_value
  from public.permission_profiles pp
  where pp.id = v_profile_id
  limit 1;

  -- Missing field defaults to allowed
  if v_value is null then
    return true;
  end if;

  return (v_value)::text::boolean;
end;
$$;

grant execute on function public.user_has_page_permission(text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Replace blanket allow_all policies with permission-gated ones
-- ─────────────────────────────────────────────────────────────

-- quotes_requests → quotations, quotation_quantity_tiers, quotation_attachments
drop policy if exists allow_all on public.quotations;
create policy "select by quotes_requests view" on public.quotations
  for select to authenticated
  using (public.user_has_page_permission('quotes_requests','view'));
create policy "insert by quotes_requests create" on public.quotations
  for insert to authenticated
  with check (public.user_has_page_permission('quotes_requests','create'));
create policy "update by quotes_requests edit" on public.quotations
  for update to authenticated
  using (public.user_has_page_permission('quotes_requests','edit'))
  with check (public.user_has_page_permission('quotes_requests','edit'));
create policy "delete by quotes_requests delete" on public.quotations
  for delete to authenticated
  using (public.user_has_page_permission('quotes_requests','delete'));

drop policy if exists allow_all on public.quotation_quantity_tiers;
create policy "select by quotes_requests view" on public.quotation_quantity_tiers
  for select to authenticated
  using (public.user_has_page_permission('quotes_requests','view'));
create policy "insert by quotes_requests create" on public.quotation_quantity_tiers
  for insert to authenticated
  with check (public.user_has_page_permission('quotes_requests','create'));
create policy "update by quotes_requests edit" on public.quotation_quantity_tiers
  for update to authenticated
  using (public.user_has_page_permission('quotes_requests','edit'))
  with check (public.user_has_page_permission('quotes_requests','edit'));
create policy "delete by quotes_requests delete" on public.quotation_quantity_tiers
  for delete to authenticated
  using (public.user_has_page_permission('quotes_requests','delete'));

drop policy if exists allow_all on public.quotation_attachments;
create policy "select by quotes_requests view" on public.quotation_attachments
  for select to authenticated
  using (public.user_has_page_permission('quotes_requests','view'));
create policy "insert by quotes_requests create" on public.quotation_attachments
  for insert to authenticated
  with check (public.user_has_page_permission('quotes_requests','create'));
create policy "update by quotes_requests edit" on public.quotation_attachments
  for update to authenticated
  using (public.user_has_page_permission('quotes_requests','edit'))
  with check (public.user_has_page_permission('quotes_requests','edit'));
create policy "delete by quotes_requests delete" on public.quotation_attachments
  for delete to authenticated
  using (public.user_has_page_permission('quotes_requests','delete'));

-- quotes_factory_sheet → factory_cost_sheets, factory_cost_tiers, factory_cost_components
drop policy if exists allow_all on public.factory_cost_sheets;
create policy "select by quotes_factory_sheet view" on public.factory_cost_sheets
  for select to authenticated
  using (public.user_has_page_permission('quotes_factory_sheet','view'));
create policy "insert by quotes_factory_sheet edit" on public.factory_cost_sheets
  for insert to authenticated
  with check (public.user_has_page_permission('quotes_factory_sheet','edit'));
create policy "update by quotes_factory_sheet edit" on public.factory_cost_sheets
  for update to authenticated
  using (public.user_has_page_permission('quotes_factory_sheet','edit'))
  with check (public.user_has_page_permission('quotes_factory_sheet','edit'));
create policy "delete by quotes_factory_sheet edit" on public.factory_cost_sheets
  for delete to authenticated
  using (public.user_has_page_permission('quotes_factory_sheet','edit'));

drop policy if exists allow_all on public.factory_cost_tiers;
create policy "select by quotes_factory_sheet view" on public.factory_cost_tiers
  for select to authenticated
  using (public.user_has_page_permission('quotes_factory_sheet','view'));
create policy "insert by quotes_factory_sheet edit" on public.factory_cost_tiers
  for insert to authenticated
  with check (public.user_has_page_permission('quotes_factory_sheet','edit'));
create policy "update by quotes_factory_sheet edit" on public.factory_cost_tiers
  for update to authenticated
  using (public.user_has_page_permission('quotes_factory_sheet','edit'))
  with check (public.user_has_page_permission('quotes_factory_sheet','edit'));
create policy "delete by quotes_factory_sheet edit" on public.factory_cost_tiers
  for delete to authenticated
  using (public.user_has_page_permission('quotes_factory_sheet','edit'));

drop policy if exists allow_all on public.factory_cost_components;
create policy "select by quotes_factory_sheet view" on public.factory_cost_components
  for select to authenticated
  using (public.user_has_page_permission('quotes_factory_sheet','view'));
create policy "insert by quotes_factory_sheet edit" on public.factory_cost_components
  for insert to authenticated
  with check (public.user_has_page_permission('quotes_factory_sheet','edit'));
create policy "update by quotes_factory_sheet edit" on public.factory_cost_components
  for update to authenticated
  using (public.user_has_page_permission('quotes_factory_sheet','edit'))
  with check (public.user_has_page_permission('quotes_factory_sheet','edit'));
create policy "delete by quotes_factory_sheet edit" on public.factory_cost_components
  for delete to authenticated
  using (public.user_has_page_permission('quotes_factory_sheet','edit'));

-- quotes_wilfred_calc → wilfred_calculations
drop policy if exists allow_all on public.wilfred_calculations;
create policy "select by quotes_wilfred_calc view" on public.wilfred_calculations
  for select to authenticated
  using (public.user_has_page_permission('quotes_wilfred_calc','view'));
create policy "insert by quotes_wilfred_calc edit" on public.wilfred_calculations
  for insert to authenticated
  with check (public.user_has_page_permission('quotes_wilfred_calc','edit'));
create policy "update by quotes_wilfred_calc edit" on public.wilfred_calculations
  for update to authenticated
  using (public.user_has_page_permission('quotes_wilfred_calc','edit'))
  with check (public.user_has_page_permission('quotes_wilfred_calc','edit'));
create policy "delete by quotes_wilfred_calc edit" on public.wilfred_calculations
  for delete to authenticated
  using (public.user_has_page_permission('quotes_wilfred_calc','edit'));

-- quotes_ddp_calc → natsuki_ddp_calculations
drop policy if exists allow_all on public.natsuki_ddp_calculations;
create policy "select by quotes_ddp_calc view" on public.natsuki_ddp_calculations
  for select to authenticated
  using (public.user_has_page_permission('quotes_ddp_calc','view'));
create policy "insert by quotes_ddp_calc edit" on public.natsuki_ddp_calculations
  for insert to authenticated
  with check (public.user_has_page_permission('quotes_ddp_calc','edit'));
create policy "update by quotes_ddp_calc edit" on public.natsuki_ddp_calculations
  for update to authenticated
  using (public.user_has_page_permission('quotes_ddp_calc','edit'))
  with check (public.user_has_page_permission('quotes_ddp_calc','edit'));
create policy "delete by quotes_ddp_calc edit" on public.natsuki_ddp_calculations
  for delete to authenticated
  using (public.user_has_page_permission('quotes_ddp_calc','edit'));

-- quotes_customer_quote → customer_quotes
drop policy if exists allow_all on public.customer_quotes;
create policy "select by quotes_customer_quote view" on public.customer_quotes
  for select to authenticated
  using (public.user_has_page_permission('quotes_customer_quote','view'));
create policy "insert by quotes_customer_quote edit" on public.customer_quotes
  for insert to authenticated
  with check (public.user_has_page_permission('quotes_customer_quote','edit'));
create policy "update by quotes_customer_quote edit" on public.customer_quotes
  for update to authenticated
  using (public.user_has_page_permission('quotes_customer_quote','edit'))
  with check (public.user_has_page_permission('quotes_customer_quote','edit'));
create policy "delete by quotes_customer_quote edit" on public.customer_quotes
  for delete to authenticated
  using (public.user_has_page_permission('quotes_customer_quote','edit'));

-- workorders → work_orders
drop policy if exists allow_all on public.work_orders;
create policy "select by workorders view" on public.work_orders
  for select to authenticated
  using (public.user_has_page_permission('workorders','view'));
create policy "insert by workorders create" on public.work_orders
  for insert to authenticated
  with check (public.user_has_page_permission('workorders','create'));
create policy "update by workorders edit" on public.work_orders
  for update to authenticated
  using (public.user_has_page_permission('workorders','edit'))
  with check (public.user_has_page_permission('workorders','edit'));
create policy "delete by workorders delete" on public.work_orders
  for delete to authenticated
  using (public.user_has_page_permission('workorders','delete'));

-- products → molds
drop policy if exists allow_all on public.molds;
create policy "select by products view" on public.molds
  for select to authenticated
  using (public.user_has_page_permission('products','view'));
create policy "insert by products create" on public.molds
  for insert to authenticated
  with check (public.user_has_page_permission('products','create'));
create policy "update by products edit" on public.molds
  for update to authenticated
  using (public.user_has_page_permission('products','edit'))
  with check (public.user_has_page_permission('products','edit'));
create policy "delete by products delete" on public.molds
  for delete to authenticated
  using (public.user_has_page_permission('products','delete'));

-- customers → companies, company_contacts
drop policy if exists allow_all on public.companies;
create policy "select by customers view" on public.companies
  for select to authenticated
  using (public.user_has_page_permission('customers','view'));
create policy "insert by customers create" on public.companies
  for insert to authenticated
  with check (public.user_has_page_permission('customers','create'));
create policy "update by customers edit" on public.companies
  for update to authenticated
  using (public.user_has_page_permission('customers','edit'))
  with check (public.user_has_page_permission('customers','edit'));
create policy "delete by customers delete" on public.companies
  for delete to authenticated
  using (public.user_has_page_permission('customers','delete'));

drop policy if exists allow_all on public.company_contacts;
create policy "select by customers view" on public.company_contacts
  for select to authenticated
  using (public.user_has_page_permission('customers','view'));
create policy "insert by customers create" on public.company_contacts
  for insert to authenticated
  with check (public.user_has_page_permission('customers','create'));
create policy "update by customers edit" on public.company_contacts
  for update to authenticated
  using (public.user_has_page_permission('customers','edit'))
  with check (public.user_has_page_permission('customers','edit'));
create policy "delete by customers delete" on public.company_contacts
  for delete to authenticated
  using (public.user_has_page_permission('customers','delete'));
