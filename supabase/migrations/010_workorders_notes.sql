alter table public.work_orders
  add column if not exists notes text;

comment on column public.work_orders.notes is 'Free-text internal notes about the workorder.';
