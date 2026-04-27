-- Add property_type to support both Multifamily and NNN (triple-net) deals.
-- Existing rows default to 'multifamily'. Future types: office, industrial,
-- self_storage, etc. — gated by the check constraint below.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS property_type text NOT NULL DEFAULT 'multifamily';

ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_property_type_check;

ALTER TABLE properties
  ADD CONSTRAINT properties_property_type_check
  CHECK (property_type IN ('multifamily', 'nnn'));
