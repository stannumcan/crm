-- Allow null quantity on factory_cost_tiers.
--
-- FCL tiers (quantity_type = fcl_20ft / fcl_40ft) legitimately have null
-- quantity at the cost-entry stage because the factory determines the
-- final per-container count downstream. The previous NOT NULL constraint
-- caused the entire tier batch insert to fail silently whenever a quote
-- contained an FCL tier, losing all the cost information the user had
-- just entered.

alter table public.factory_cost_tiers
  alter column quantity drop not null;

comment on column public.factory_cost_tiers.quantity is
  'Tier quantity. Null is allowed for FCL (20GP/40GP) tiers where quantity is calculated downstream by the factory.';
