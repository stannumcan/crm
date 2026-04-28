-- Persist the buffer percentage that was used to compute cartons / factory
-- production qty for each DDP tier. Without this column the buffer field on
-- the DDP calc form would re-initialise to its default (5%) on every reload,
-- making it look like the value didn't save.
ALTER TABLE natsuki_ddp_calculations
  ADD COLUMN IF NOT EXISTS buffer_pct numeric;
