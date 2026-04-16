alter table public.work_orders
  add column if not exists mould_flow text not null default 'existing';

comment on column public.work_orders.mould_flow is
  'new | existing | modification — determines which milestone phases apply to this WO.';

create table if not exists public.workorder_milestones (
  id uuid primary key default gen_random_uuid(),
  workorder_id uuid not null references public.work_orders(id) on delete cascade,
  milestone_key text not null,
  sort_order int not null default 0,
  status text not null default 'pending',
  completed_at timestamptz,
  completed_by uuid,
  notes text,
  details jsonb not null default '{}',
  attachments jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workorder_id, milestone_key)
);

alter table public.workorder_milestones enable row level security;

create policy "select by workorders view or any workflow edit" on public.workorder_milestones
  for select to authenticated
  using (
    public.user_has_page_permission('workorders','view')
    or public.user_has_page_permission('quotes_factory_sheet','edit')
    or public.user_has_page_permission('quotes_wilfred_calc','edit')
    or public.user_has_page_permission('quotes_ddp_calc','edit')
    or public.user_has_page_permission('quotes_customer_quote','edit')
  );

create policy "insert by workorders edit" on public.workorder_milestones
  for insert to authenticated
  with check (public.user_has_page_permission('workorders','edit'));

create policy "update by workorders edit" on public.workorder_milestones
  for update to authenticated
  using (public.user_has_page_permission('workorders','edit'))
  with check (public.user_has_page_permission('workorders','edit'));

create policy "delete by workorders edit" on public.workorder_milestones
  for delete to authenticated
  using (public.user_has_page_permission('workorders','edit'));
