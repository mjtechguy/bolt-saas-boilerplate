-- Create function to ensure default organization exists
CREATE OR REPLACE FUNCTION ensure_default_organization()
RETURNS uuid AS $$
DECLARE
  org_id uuid;
BEGIN
  -- Try to get existing default organization
  SELECT id INTO org_id
  FROM organizations
  WHERE is_default = true
  LIMIT 1;

  -- If no default organization exists, create one
  IF org_id IS NULL THEN
    INSERT INTO organizations (name, slug, is_default)
    VALUES ('Default Organization', 'default', true)
    RETURNING id INTO org_id;
  END IF;

  RETURN org_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to ensure user has organization
CREATE OR REPLACE FUNCTION ensure_user_organization(user_uuid uuid)
RETURNS void AS $$
DECLARE
  default_org_id uuid;
BEGIN
  -- Check if user already has any organization
  IF NOT EXISTS (
    SELECT 1 FROM user_organizations WHERE user_id = user_uuid
  ) THEN
    -- Get or create default organization
    default_org_id := ensure_default_organization();

    -- Add user to default organization
    INSERT INTO user_organizations (user_id, organization_id, role)
    VALUES (user_uuid, default_org_id, 'user')
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to ensure organization has AI settings
CREATE OR REPLACE FUNCTION ensure_organization_ai_settings(org_uuid uuid)
RETURNS void AS $$
BEGIN
  -- Create AI settings if they don't exist
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
    org_uuid,
    'https://api.openai.com/v1/chat/completions',
    '',
    '',
    4096,
    NULL,
    true,
    'AI can make mistakes. Consider checking important information.'
  )
  ON CONFLICT (organization_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to ensure new users get organization
CREATE OR REPLACE FUNCTION handle_new_user_organization()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM ensure_user_organization(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to ensure new organizations get AI settings
CREATE OR REPLACE FUNCTION handle_new_organization_settings()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM ensure_organization_ai_settings(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS on_auth_user_created_org ON auth.users;
CREATE TRIGGER on_auth_user_created_org
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_organization();

DROP TRIGGER IF EXISTS on_organization_created ON organizations;
CREATE TRIGGER on_organization_created
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_organization_settings();

-- Ensure existing users have organizations
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM auth.users
  LOOP
    PERFORM ensure_user_organization(user_record.id);
  END LOOP;
END;
$$;

-- Ensure existing organizations have AI settings
DO $$
DECLARE
  org_record RECORD;
BEGIN
  FOR org_record IN SELECT id FROM organizations
  LOOP
    PERFORM ensure_organization_ai_settings(org_record.id);
  END LOOP;
END;
$$;