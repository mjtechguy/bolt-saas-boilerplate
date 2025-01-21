-- Function to ensure default organization exists and return its ID
CREATE OR REPLACE FUNCTION ensure_default_organization()
RETURNS uuid AS $$
DECLARE
  default_org_id uuid;
BEGIN
  -- Try to get existing default organization
  SELECT id INTO default_org_id
  FROM organizations
  WHERE is_default = true
  LIMIT 1;

  -- If no default organization exists, create one
  IF default_org_id IS NULL THEN
    INSERT INTO organizations (name, slug, is_default)
    VALUES ('Default Organization', 'default', true)
    RETURNING id INTO default_org_id;
  END IF;

  RETURN default_org_id;
END;
$$ LANGUAGE plpgsql;

-- Function to ensure user is in default organization
CREATE OR REPLACE FUNCTION ensure_user_in_default_org(user_uuid uuid)
RETURNS void AS $$
DECLARE
  default_org_id uuid;
  is_admin boolean;
BEGIN
  -- Get default organization ID
  default_org_id := ensure_default_organization();
  
  -- Check if user is global admin
  SELECT is_global_admin INTO is_admin
  FROM profiles
  WHERE id = user_uuid;

  -- Add user to default organization if not already a member
  INSERT INTO user_organizations (
    user_id,
    organization_id,
    role,
    created_at
  )
  VALUES (
    user_uuid,
    default_org_id,
    CASE WHEN is_admin THEN 'organization_admin'::user_role ELSE 'user'::user_role END,
    now()
  )
  ON CONFLICT (user_id, organization_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user_default_org()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure user is in default organization
  PERFORM ensure_user_in_default_org(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new users
DROP TRIGGER IF EXISTS on_auth_user_created_default_org ON auth.users;
CREATE TRIGGER on_auth_user_created_default_org
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_default_org();

-- Ensure all existing users are in default organization
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN 
    SELECT id 
    FROM auth.users 
    WHERE NOT EXISTS (
      SELECT 1 
      FROM user_organizations uo 
      WHERE uo.user_id = users.id
    )
  LOOP
    PERFORM ensure_user_in_default_org(user_record.id);
  END LOOP;
END;
$$;

-- Ensure default admin is in default org as admin
DO $$
DECLARE
  admin_id uuid;
  default_org_id uuid;
BEGIN
  -- Get default admin ID
  SELECT id INTO admin_id
  FROM auth.users
  WHERE email = current_setting('app.settings.default_admin_email', true);

  IF admin_id IS NOT NULL THEN
    -- Get default org ID
    default_org_id := ensure_default_organization();

    -- Ensure admin is organization admin
    INSERT INTO user_organizations (
      user_id,
      organization_id,
      role,
      created_at
    )
    VALUES (
      admin_id,
      default_org_id,
      'organization_admin',
      now()
    )
    ON CONFLICT (user_id, organization_id) 
    DO UPDATE SET role = 'organization_admin';
  END IF;
END;
$$;