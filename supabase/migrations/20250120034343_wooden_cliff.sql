-- Create app types enum
CREATE TYPE app_type AS ENUM ('ai_chat', 'link_management', 'team_management');

-- Create table for available apps
CREATE TABLE IF NOT EXISTS available_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type app_type NOT NULL,
  name text NOT NULL,
  description text,
  enabled boolean DEFAULT false,
  requires_setup boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(type)
);

-- Create table for organization app settings
CREATE TABLE IF NOT EXISTS organization_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  app_type app_type NOT NULL,
  enabled boolean DEFAULT false,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, app_type)
);

-- Enable RLS
ALTER TABLE available_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_apps ENABLE ROW LEVEL SECURITY;

-- Create policies for available_apps
CREATE POLICY "available_apps_view_policy"
  ON available_apps
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "available_apps_modify_policy"
  ON available_apps
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_global_admin = true
    )
  );

-- Create policies for organization_apps
CREATE POLICY "organization_apps_view_policy"
  ON organization_apps
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND organization_id = organization_apps.organization_id
    )
  );

CREATE POLICY "organization_apps_modify_policy"
  ON organization_apps
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_global_admin = true
    )
    OR
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND organization_id = organization_apps.organization_id
      AND role = 'organization_admin'
    )
  );

-- Insert default available apps
INSERT INTO available_apps (type, name, description, enabled, requires_setup)
VALUES 
  ('ai_chat', 'AI Chat', 'AI-powered chat assistant for your organization', true, true),
  ('link_management', 'Link Management', 'Centralized link management system', true, false),
  ('team_management', 'Team Management', 'Team and member management system', true, false)
ON CONFLICT (type) DO UPDATE
SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- Function to ensure organization apps exist
CREATE OR REPLACE FUNCTION ensure_organization_apps(org_id uuid)
RETURNS void AS $$
BEGIN
  -- Create app entries for all available apps
  INSERT INTO organization_apps (
    organization_id,
    app_type,
    enabled,
    settings
  )
  SELECT 
    org_id,
    type,
    CASE 
      WHEN type = 'team_management' THEN true  -- Team management is always enabled
      ELSE false                               -- Other apps start disabled
    END,
    CASE
      WHEN type = 'ai_chat' THEN jsonb_build_object(
        'endpoint_url', 'https://api.openai.com/v1/chat/completions',
        'api_key', '',
        'model', '',
        'max_output_tokens', 4096,
        'max_total_tokens', NULL,
        'disclaimer_message', 'AI can make mistakes. Consider checking important information.'
      )
      ELSE '{}'::jsonb
    END
  FROM available_apps
  WHERE enabled = true
  ON CONFLICT (organization_id, app_type) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new organizations
CREATE OR REPLACE FUNCTION handle_new_organization_apps()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM ensure_organization_apps(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS on_organization_created_apps ON organizations;
CREATE TRIGGER on_organization_created_apps
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_organization_apps();

-- Ensure apps exist for all current organizations
DO $$
DECLARE
  org_record RECORD;
BEGIN
  FOR org_record IN SELECT id FROM organizations
  LOOP
    PERFORM ensure_organization_apps(org_record.id);
  END LOOP;
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_apps_lookup 
ON organization_apps(organization_id, app_type);

-- Migrate existing AI settings to new app settings
INSERT INTO organization_apps (
  organization_id,
  app_type,
  enabled,
  settings
)
SELECT 
  organization_id,
  'ai_chat'::app_type,
  enabled,
  jsonb_build_object(
    'endpoint_url', endpoint_url,
    'api_key', api_key,
    'model', model,
    'max_output_tokens', max_output_tokens,
    'max_total_tokens', max_total_tokens,
    'disclaimer_message', disclaimer_message
  )
FROM organization_ai_settings
ON CONFLICT (organization_id, app_type) 
DO UPDATE SET
  enabled = EXCLUDED.enabled,
  settings = EXCLUDED.settings;