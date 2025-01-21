-- Create function to ensure organization exists
CREATE OR REPLACE FUNCTION ensure_organization_exists(org_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organizations WHERE id = org_id
  );
END;
$$ LANGUAGE plpgsql;

-- Create function to ensure AI settings exist
CREATE OR REPLACE FUNCTION ensure_ai_settings(org_id uuid)
RETURNS void AS $$
BEGIN
  -- Only create settings if organization exists
  IF ensure_organization_exists(org_id) THEN
    INSERT INTO organization_ai_settings (
      organization_id,
      endpoint_url,
      api_key,
      model,
      max_output_tokens,
      max_total_tokens,
      enabled,
      disclaimer_message
    )
    VALUES (
      org_id,
      'https://api.openai.com/v1/chat/completions',
      '',
      '',
      4096,
      NULL,
      true,
      'AI can make mistakes. Consider checking important information.'
    )
    ON CONFLICT (organization_id) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new organizations
CREATE OR REPLACE FUNCTION handle_new_organization()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM ensure_ai_settings(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_organization_created ON organizations;

-- Create trigger for new organizations
CREATE TRIGGER on_organization_created
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_organization();

-- Ensure AI settings exist for all current organizations
DO $$
DECLARE
  org_record RECORD;
BEGIN
  FOR org_record IN SELECT id FROM organizations
  LOOP
    PERFORM ensure_ai_settings(org_record.id);
  END LOOP;
END;
$$;

-- Create policy for AI settings
DROP POLICY IF EXISTS "ai_settings_access" ON organization_ai_settings;
CREATE POLICY "ai_settings_access"
  ON organization_ai_settings
  FOR ALL
  TO authenticated
  USING (
    -- Global admins can access all settings
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_global_admin = true
    )
    OR
    -- Organization admins can access their org's settings
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND organization_id = organization_ai_settings.organization_id
      AND role = 'organization_admin'
    )
    OR
    -- Organization members can view settings
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND organization_id = organization_ai_settings.organization_id
    )
  );

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_ai_settings_org ON organization_ai_settings(organization_id);