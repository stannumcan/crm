-- Quote form redesign: multi-mold, unified printing, tier notes
-- Run after 001 and 002

-- Replace single mold_type + mold_number with a JSONB array of mold entries
-- Each entry: { "type": "existing" | "new", "value": "ML-1004B" }
alter table quotations add column if not exists molds jsonb;

-- Unified printing notes (replaces per-component fields)
alter table quotations add column if not exists printing_notes text;

-- Embossment as free text (blank = none), replacing bool + components
alter table quotations add column if not exists embossment_notes text;

-- Per-tier notes on quantity tiers
alter table quotation_quantity_tiers add column if not exists tier_notes text;

-- Old columns are kept (nullable) so existing data is not lost.
-- mold_type, mold_number, printing_lid/body/bottom/inner, embossment bool, embossment_components
-- can be dropped in a future cleanup migration once data is migrated.
