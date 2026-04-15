-- ─────────────────────────────────────────────────────────────
-- Workflow pipeline read-cascade
--
-- Downstream workflow steps inherently need to READ upstream steps:
--   - Cost Calc editor needs to see the Factory Sheet
--   - DDP editor needs to see Factory Sheet + Cost Calc
--   - Customer Quote editor needs to see Factory Sheet + Cost Calc + DDP
--
-- Previously the SELECT policies required view permission on the table's
-- own page, which made Natsuki's 'DDP Calc' profile unable to read the
-- approved wilfred_calculations rows she needs to do her job.
--
-- New rule: a user can SELECT a workflow table's rows if they either
-- have view permission on its own page OR edit permission on any
-- DOWNSTREAM workflow page. INSERT/UPDATE/DELETE policies are unchanged
-- (those still require edit permission on the specific step).
-- ─────────────────────────────────────────────────────────────

-- quotations: any workflow editor needs to read the underlying quote
drop policy if exists "select by quotes_requests view" on public.quotations;
create policy "select by quotes_requests view or any workflow edit" on public.quotations
  for select to authenticated
  using (
    public.user_has_page_permission('quotes_requests','view')
    or public.user_has_page_permission('quotes_factory_sheet','edit')
    or public.user_has_page_permission('quotes_wilfred_calc','edit')
    or public.user_has_page_permission('quotes_ddp_calc','edit')
    or public.user_has_page_permission('quotes_customer_quote','edit')
  );

drop policy if exists "select by quotes_requests view" on public.quotation_quantity_tiers;
create policy "select by quotes_requests view or any workflow edit" on public.quotation_quantity_tiers
  for select to authenticated
  using (
    public.user_has_page_permission('quotes_requests','view')
    or public.user_has_page_permission('quotes_factory_sheet','edit')
    or public.user_has_page_permission('quotes_wilfred_calc','edit')
    or public.user_has_page_permission('quotes_ddp_calc','edit')
    or public.user_has_page_permission('quotes_customer_quote','edit')
  );

drop policy if exists "select by quotes_requests view" on public.quotation_attachments;
create policy "select by quotes_requests view or any workflow edit" on public.quotation_attachments
  for select to authenticated
  using (
    public.user_has_page_permission('quotes_requests','view')
    or public.user_has_page_permission('quotes_factory_sheet','edit')
    or public.user_has_page_permission('quotes_wilfred_calc','edit')
    or public.user_has_page_permission('quotes_ddp_calc','edit')
    or public.user_has_page_permission('quotes_customer_quote','edit')
  );

-- factory_cost_sheets + children: readable by factory_sheet viewers + downstream editors
drop policy if exists "select by quotes_factory_sheet view" on public.factory_cost_sheets;
create policy "select by factory_sheet view or downstream edit" on public.factory_cost_sheets
  for select to authenticated
  using (
    public.user_has_page_permission('quotes_factory_sheet','view')
    or public.user_has_page_permission('quotes_wilfred_calc','edit')
    or public.user_has_page_permission('quotes_ddp_calc','edit')
    or public.user_has_page_permission('quotes_customer_quote','edit')
  );

drop policy if exists "select by quotes_factory_sheet view" on public.factory_cost_tiers;
create policy "select by factory_sheet view or downstream edit" on public.factory_cost_tiers
  for select to authenticated
  using (
    public.user_has_page_permission('quotes_factory_sheet','view')
    or public.user_has_page_permission('quotes_wilfred_calc','edit')
    or public.user_has_page_permission('quotes_ddp_calc','edit')
    or public.user_has_page_permission('quotes_customer_quote','edit')
  );

drop policy if exists "select by quotes_factory_sheet view" on public.factory_cost_components;
create policy "select by factory_sheet view or downstream edit" on public.factory_cost_components
  for select to authenticated
  using (
    public.user_has_page_permission('quotes_factory_sheet','view')
    or public.user_has_page_permission('quotes_wilfred_calc','edit')
    or public.user_has_page_permission('quotes_ddp_calc','edit')
    or public.user_has_page_permission('quotes_customer_quote','edit')
  );

-- wilfred_calculations: readable by cost_calc viewers + DDP / customer-quote editors
drop policy if exists "select by quotes_wilfred_calc view" on public.wilfred_calculations;
create policy "select by wilfred_calc view or downstream edit" on public.wilfred_calculations
  for select to authenticated
  using (
    public.user_has_page_permission('quotes_wilfred_calc','view')
    or public.user_has_page_permission('quotes_ddp_calc','edit')
    or public.user_has_page_permission('quotes_customer_quote','edit')
  );

-- natsuki_ddp_calculations: readable by ddp_calc viewers + customer-quote editors
drop policy if exists "select by quotes_ddp_calc view" on public.natsuki_ddp_calculations;
create policy "select by ddp_calc view or downstream edit" on public.natsuki_ddp_calculations
  for select to authenticated
  using (
    public.user_has_page_permission('quotes_ddp_calc','view')
    or public.user_has_page_permission('quotes_customer_quote','edit')
  );

-- customer_quotes: last step, no downstream — unchanged pattern
-- (policy already exists as "select by quotes_customer_quote view")
