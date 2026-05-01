-- Persist the emboss-plate lead time on the customer quote. Until now there
-- was no field for it on the form — only mold / sample / production lead times.
ALTER TABLE customer_quotes
  ADD COLUMN IF NOT EXISTS lead_time_emboss text;
