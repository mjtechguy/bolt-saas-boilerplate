-- Drop existing function first
DROP FUNCTION IF EXISTS get_organization_ai_settings(uuid);

-- Create new function with upsert support
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
  -- Try to insert default settings if none exist
  INSERT INTO organization_ai_settings (
    organization_id,
    endpoint_url,
    api_key,
    model,
    max_output_tokens,
    max_total_tokens,
    enabled,
    disclaimer_message,
    created_at,
    updated_at
  )
  VALUES (
    org_id,
    '',
    '',
    '',
    4096,
    NULL,
    true,
    'AI can make mistakes. Consider checking important information.',
    now(),
    now()
  )
  ON CONFLICT (organization_id) DO NOTHING;

  -- Return the settings (either existing or newly created)
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
    COALESCE(s.disclaimer_message, 'AI can make mistakes. Consider checking important information.'),
    s.created_at,
    s.updated_at
  FROM organization_ai_settings s
  WHERE s.organization_id = org_id;
END;
$$ LANGUAGE plpgsql;