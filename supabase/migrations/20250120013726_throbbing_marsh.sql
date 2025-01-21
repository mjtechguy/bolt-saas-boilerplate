-- Drop existing function first
DROP FUNCTION IF EXISTS get_organization_ai_settings(uuid);

-- Add disclaimer message column to organization_ai_settings
ALTER TABLE organization_ai_settings 
ADD COLUMN IF NOT EXISTS disclaimer_message text DEFAULT 'AI can make mistakes. Consider checking important information.';

-- Create new function with updated return type
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
  disclaimer_message text,
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
    s.disclaimer_message,
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
      NULL::integer,
      false::boolean,
      'AI can make mistakes. Consider checking important information.'::text,
      now()::timestamptz,
      now()::timestamptz;
  END IF;
END;
$$ LANGUAGE plpgsql;