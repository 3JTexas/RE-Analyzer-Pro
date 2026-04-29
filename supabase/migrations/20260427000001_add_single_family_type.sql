-- Add 'single_family' to the property_type check constraint.
-- Single family rentals reuse the multifamily calc branch with tu=1 — no
-- new fields needed, just the type tag for filtering, display, and future
-- per-type extraction prompts.

ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_property_type_check;

ALTER TABLE properties
  ADD CONSTRAINT properties_property_type_check
  CHECK (property_type IN ('multifamily', 'single_family', 'nnn'));
