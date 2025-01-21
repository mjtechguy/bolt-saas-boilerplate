/*
  # Update AI Settings with Token Management

  1. Changes
    - Drop existing function to avoid return type conflicts
    - Add max_output_tokens and max_total_tokens columns
    - Update get_organization_ai_settings function with new fields
*/

-- Drop existing function first
DROP FUNCTION IF EXISTS get_organization_ai_settings(uuid);

-- Add new columns for token management
ALTER TABLE organization_ai_settings
ADD COLUMN IF NOT EXISTS max_output_tokens integer NOT NULL DEFAULT 1024,
ADD COLUMN IF NOT EXISTS max_total_tokens integer NOT NULL DEFAULT 4096;

-- Update existing records to use new defaults
UPDATE organization_ai_settings
SET 
  max_output_tokens = 1024,
  max_total_tokens = 4096
WHERE max_output_tokens IS NULL OR max_total_tokens IS NULL;

-- Recreate the function with updated return type
CREATE OR REPLACE FUNCTION get_organization_ai_settings(org_id uuid)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  endpoint_url text,
  api_key text,
  model text,
  context_size integer,
  max_output_tokens integer,
  max_total_tokens integer,
  enabled boolean,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.organization_id,
    s.endpoint_url,
    s.api_key,
    s.model,
    s.context_size,
    s.max_output_tokens,
    s.max_total_tokens,
    s.enabled,
    s.created_at,
    s.updated_at
  FROM organization_ai_settings s
  WHERE s.organization_id = org_id;

  IF NOT FOUND THEN
    -- Return empty settings row with defaults
    RETURN QUERY
    SELECT 
      gen_random_uuid()::uuid,
      org_id,
      ''::text,
      ''::text,
      ''::text,
      4096::integer,
      1024::integer,
      4096::integer,
      false::boolean,
      now()::timestamptz,
      now()::timestamptz;
  END IF;
END;
$$ LANGUAGE plpgsql;