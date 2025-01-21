-- Drop existing function first
DROP FUNCTION IF EXISTS get_organization_ai_settings(uuid);

-- Update max_total_tokens to allow NULL (unlimited)
ALTER TABLE organization_ai_settings 
ALTER COLUMN max_total_tokens DROP NOT NULL,
ALTER COLUMN max_total_tokens DROP DEFAULT;

-- Update existing records to use NULL for unlimited context
UPDATE organization_ai_settings
SET max_total_tokens = NULL;

-- Recreate the function with updated return type
CREATE OR REPLACE FUNCTION get_organization_ai_settings(org_id uuid)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  endpoint_url text,
  api_key text,
  model text,
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
      1024::integer,
      NULL::integer,  -- NULL means unlimited total tokens
      false::boolean,
      now()::timestamptz,
      now()::timestamptz;
  END IF;
END;
$$ LANGUAGE plpgsql;