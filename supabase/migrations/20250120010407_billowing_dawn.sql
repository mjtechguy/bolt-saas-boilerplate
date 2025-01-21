-- Update organization_ai_settings table to handle missing settings
CREATE OR REPLACE FUNCTION get_organization_ai_settings(org_id uuid)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  endpoint_url text,
  api_key text,
  model text,
  context_size integer,
  enabled boolean,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM organization_ai_settings
  WHERE organization_id = org_id;

  IF NOT FOUND THEN
    -- Return empty settings row
    RETURN QUERY
    SELECT 
      gen_random_uuid()::uuid,
      org_id,
      ''::text,
      ''::text,
      ''::text,
      4096::integer,
      false::boolean,
      now()::timestamptz,
      now()::timestamptz;
  END IF;
END;
$$ LANGUAGE plpgsql;