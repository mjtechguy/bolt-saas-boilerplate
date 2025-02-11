-- types
CREATE TYPE link_scope AS ENUM ('global', 'organization', 'team');
CREATE TYPE user_role AS ENUM (
  'global_admin',
  'organization_admin',
  'team_admin',
  'user'
);
CREATE TYPE app_type AS ENUM ('ai_chat', 'link_management', 'team_management');
CREATE TYPE auth_provider_type AS ENUM ('oauth', 'oidc');
-- END

-- tables
-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text NOT NULL,
  is_global_admin boolean DEFAULT false,
  has_otp_enabled boolean DEFAULT false NOT NULL,
  last_sign_in_at timestamptz,
  avatar_url text,
  display_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  logo_url text
);
-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, slug)
);
-- Create user_organizations junction table
CREATE TABLE IF NOT EXISTS user_organizations (
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'user',
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, organization_id)
);
-- Create user_teams junction table
CREATE TABLE IF NOT EXISTS user_teams (
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'user',
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, team_id)
);
-- Create app settings table
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- Create available_apps table
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
-- Create links table with foreign key references
CREATE TABLE IF NOT EXISTS links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  url text NOT NULL,
  logo_url text,
  scope link_scope NOT NULL,
  organization_id uuid REFERENCES organizations(id),
  team_id uuid REFERENCES teams(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- Create chat messages table
CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
-- Create organization AI settings table
CREATE TABLE organization_ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  endpoint_url text,
  api_key text ,
  model text,
  enabled boolean NOT NULL DEFAULT false,
  max_output_tokens integer NOT NULL DEFAULT 1024,
  max_total_tokens integer NOT NULL DEFAULT 4096,
  disclaimer_message text DEFAULT 'AI can make mistakes. Consider checking important information.',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id)
);
-- Create organization Auth settings table
CREATE TABLE organization_auth_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  provider auth_provider_type NOT NULL,
  name text NOT NULL,
  client_id text NOT NULL,
  client_secret text NOT NULL,
  issuer text,
  authorization_endpoint text,
  token_endpoint text,
  userinfo_endpoint text,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, name)
);
-- Create Site settings table
CREATE TABLE IF NOT EXISTS site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name text NOT NULL DEFAULT 'My Application',
  logo_url text,
  dark_logo_url text,
  primary_color text DEFAULT '#4F46E5',
  secondary_color text DEFAULT '#6366F1',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- Create topbar links table
CREATE TABLE IF NOT EXISTS topbar_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  icon_name text NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  is_social boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- END

-- Enable Row-Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE available_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_auth_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE topbar_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE links ENABLE ROW LEVEL SECURITY;
-- END


-- functions
-- ensure_organization_ai_settings
CREATE OR REPLACE FUNCTION ensure_organization_ai_settings()
RETURNS trigger AS $$
BEGIN
  INSERT INTO organization_ai_settings (organization_id)
  VALUES (NEW.id)
  ON CONFLICT (organization_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
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
      WHEN type = 'ai_chat' THEN COALESCE(
        (SELECT jsonb_build_object(
          'endpoint_url', endpoint_url,
          'api_key', api_key,
          'model', model,
          'max_output_tokens', max_output_tokens,
          'max_total_tokens', max_total_tokens,
          'disclaimer_message', disclaimer_message
        ) FROM organization_ai_settings WHERE organization_id = org_id),
        jsonb_build_object(
          'endpoint_url', 'https://api.openai.com/v1/chat/completions',
          'api_key', '',
          'model', '',
          'max_output_tokens', 4096,
          'max_total_tokens', NULL,
          'disclaimer_message', 'AI can make mistakes. Consider checking important information.'
        )
      )
      ELSE '{}'::jsonb
    END
  FROM available_apps
  WHERE enabled = true
  ON CONFLICT (organization_id, app_type) DO NOTHING;
END;
$$ LANGUAGE plpgsql;
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
-- Create optimized helper functions
CREATE OR REPLACE FUNCTION get_user_organization_role(user_id uuid, org_id uuid)
RETURNS user_role AS $$
  SELECT role FROM user_organizations
  WHERE user_id = $1 AND organization_id = $2
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;
-- - Create trigger for new organizations
CREATE OR REPLACE FUNCTION handle_new_organization_apps()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM ensure_organization_apps(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Recreate the function with better error handling
-- CREATE OR REPLACE FUNCTION public.handle_new_user()
-- RETURNS trigger AS $$
-- DECLARE
--   default_admin_email text;
-- BEGIN
--   -- Get default admin email from environment variable
--   default_admin_email := current_setting('app.settings.default_admin_email', true);

--   -- Ensure we don't create duplicate profiles
--   IF NOT EXISTS (
--     SELECT 1 FROM public.profiles WHERE id = new.id
--   ) THEN
--     INSERT INTO public.profiles (
--       id,
--       email,
--       display_name,
--       is_global_admin,
--       created_at,
--       updated_at
--     )
--     VALUES (
--       new.id,
--       new.email,
--       SPLIT_PART(new.email, '@', 1),
--       CASE
--         WHEN new.email = default_admin_email THEN true
--         ELSE false
--       END,
--       now(),
--       now()
--     );
--   END IF;

--   RETURN new;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_global_admin)
  VALUES (
    new.id,
    new.email,
    public.is_default_admin_email(new.email::text)  -- Explicit cast to text
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update last sign in time
CREATE OR REPLACE FUNCTION public.handle_user_sign_in()
RETURNS trigger AS $$
BEGIN
  UPDATE public.profiles
  SET last_sign_in_at = now()
  WHERE id = new.id;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to check organization access
CREATE OR REPLACE FUNCTION has_organization_access(check_user_id uuid, check_org_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = check_user_id AND is_global_admin = true
  )
  OR EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = check_user_id
    AND organization_id = check_org_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to check team access
CREATE OR REPLACE FUNCTION has_team_access(check_user_id uuid, check_team_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = check_user_id AND is_global_admin = true
  )
  OR EXISTS (
    SELECT 1 FROM user_organizations uo
    JOIN teams t ON t.id = check_team_id
    WHERE uo.user_id = check_user_id
    AND uo.organization_id = t.organization_id
    AND uo.role = 'organization_admin'
  )
  OR EXISTS (
    SELECT 1 FROM user_teams ut
    WHERE ut.user_id = check_user_id
    AND ut.team_id = check_team_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Is Default admin
CREATE OR REPLACE FUNCTION public.is_default_admin_email(email varchar)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.app_settings
    WHERE key = 'default_admin_email'
    AND value = email
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Helper function to check if user is global admin
CREATE OR REPLACE FUNCTION is_global_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND is_global_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Helper function to check if user is organization admin
CREATE OR REPLACE FUNCTION is_organization_admin(user_id uuid, org_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = user_id
    AND organization_id = org_id
    AND role IN ('organization_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is team admin
CREATE OR REPLACE FUNCTION is_team_admin(user_id uuid, team_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_teams
    WHERE user_id = user_id
    AND team_id = team_id
    AND role IN ('team_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Create a function to check if a user is a global admin without recursion
CREATE OR REPLACE FUNCTION is_user_global_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = user_id
    AND is_global_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- END

-- TRIGGERS
-- Create triggers
 CREATE TRIGGER create_organization_ai_settings
    AFTER INSERT ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION ensure_organization_ai_settings();

CREATE TRIGGER on_organization_created_apps
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_organization_apps();
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
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
-- END



-- Policies

-- Profiles
-- 1
CREATE POLICY "Public profiles access"
  ON profiles
  FOR SELECT
  TO authenticated, ANON
  USING (
  true
  );

-- 2
CREATE POLICY "Global admins can update any profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (is_global_admin = true);
-- 3
CREATE POLICY "Global admins can delete profiles"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (is_global_admin = true);

-- app_settings
-- 1
CREATE POLICY "Anyone can read app settings"
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (true);
-- 2
CREATE POLICY "available_apps_modify_policy"
  ON available_apps
  FOR ALL
  TO authenticated
  USING (
     (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_global_admin = true))))
  );
  -- available_apps_view_policy
  CREATE POLICY "available_apps_view_policy"
  ON available_apps
  FOR SELECT
  TO authenticated
  USING (true);

-- chat message
-- 1
CREATE POLICY "Organization members can view chat messages"
  ON chat_messages
  FOR SELECT
  TO authenticated
  USING (
   (EXISTS ( SELECT 1
   FROM user_organizations
  WHERE ((user_organizations.user_id = auth.uid()) AND (user_organizations.organization_id = chat_messages.organization_id))))
  );
-- 2
CREATE POLICY "Users can manage their own chat messages"
  ON chat_messages
  FOR ALL
  TO authenticated
  USING(
    ((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM user_organizations
  WHERE ((user_organizations.user_id = auth.uid()) AND (user_organizations.organization_id = chat_messages.organization_id) AND (user_organizations.role = ANY (ARRAY['organization_admin'::user_role, 'team_admin'::user_role]))))))
  );

-- links
-- 1
CREATE POLICY "Global admins can manage all links"
  ON links
  FOR ALL
  TO authenticated
  USING (
    (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_global_admin = true))))
  );
-- 2
CREATE POLICY "Organization admins can manage org links"
  ON links
  FOR ALL
  TO authenticated
  USING (
    ((organization_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM user_organizations
  WHERE ((user_organizations.user_id = auth.uid()) AND (user_organizations.organization_id = links.organization_id) AND (user_organizations.role = 'organization_admin'::user_role)))))
  );
-- 3
CREATE POLICY "Team admins can manage team links"
  ON links
  FOR ALL
  TO authenticated
  USING (
    ((team_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM user_teams
  WHERE ((user_teams.user_id = auth.uid()) AND (user_teams.team_id = links.team_id) AND (user_teams.role = 'team_admin'::user_role)))))
  );
-- 4
CREATE POLICY "Users can view accessible links"
  ON links
  FOR SELECT
  TO authenticated
  USING (
    ((scope = 'global'::link_scope) OR ((organization_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM user_organizations
  WHERE ((user_organizations.user_id = auth.uid()) AND (user_organizations.organization_id = links.organization_id))))) OR ((team_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM user_teams
  WHERE ((user_teams.user_id = auth.uid()) AND (user_teams.team_id = links.team_id))))))
  );
-- 5
CREATE POLICY "Links access policy"
  ON links
  FOR ALL
  TO authenticated
  USING (
      ((scope = 'global'::link_scope) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_global_admin = true)))) OR ((scope = 'organization'::link_scope) AND (EXISTS ( SELECT 1
   FROM user_organizations
  WHERE ((user_organizations.user_id = auth.uid()) AND (user_organizations.organization_id = links.organization_id))))) OR ((scope = 'team'::link_scope) AND (EXISTS ( SELECT 1
   FROM user_teams
  WHERE ((user_teams.user_id = auth.uid()) AND (user_teams.team_id = links.team_id))))))
  );

-- Organizations AI Settings
-- 1
CREATE POLICY "Global admins can manage all AI settings"
  ON organization_ai_settings
  FOR ALL
  TO authenticated
  USING (
    (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_global_admin = true))))
  );
-- 2
CREATE POLICY "Organization admins can manage their org's AI settings"
  ON organization_ai_settings
  FOR ALL
  TO authenticated
  USING (
   (EXISTS ( SELECT 1
   FROM user_organizations
  WHERE ((user_organizations.user_id = auth.uid()) AND (user_organizations.organization_id = organization_ai_settings.organization_id) AND (user_organizations.role = 'organization_admin'::user_role))))
  );
-- 3
CREATE POLICY "Organization members can view their org's AI settings"
  ON organization_ai_settings
  FOR SELECT
  TO authenticated
  USING (
   (EXISTS ( SELECT 1
   FROM user_organizations
  WHERE ((user_organizations.user_id = auth.uid()) AND (user_organizations.organization_id = organization_ai_settings.organization_id))))
  );

-- Organization Apps
-- 1
CREATE POLICY "organization_apps_view_policy"
  ON organization_apps
  FOR SELECT
  TO authenticated
  USING (
    (EXISTS ( SELECT 1
   FROM user_organizations
  WHERE ((user_organizations.user_id = auth.uid()) AND (user_organizations.organization_id = organization_apps.organization_id))))
  );
-- 2
CREATE POLICY "organization_apps_modify_policy"
  ON organization_apps
  FOR ALL
  TO authenticated
  USING (
   ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_global_admin = true)))) OR (EXISTS ( SELECT 1
   FROM user_organizations
  WHERE ((user_organizations.user_id = auth.uid()) AND (user_organizations.organization_id = organization_apps.organization_id) AND (user_organizations.role = 'organization_admin'::user_role)))))
  );

-- Organization Auth Settings
-- 1
CREATE POLICY "Allow unauthenticated read access for organization auth setting"
ON organization_auth_settings
TO public
USING (
  true
);
-- 2
CREATE POLICY "Global admins can manage all auth settings"
  ON organization_auth_settings
  FOR ALL
  TO authenticated
  USING (
    (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_global_admin = true))))
  );
-- 3
CREATE POLICY "Organization admins can manage their org's auth settings"
  ON organization_auth_settings
  FOR ALL
  TO authenticated
  USING (
    (EXISTS ( SELECT 1
   FROM user_organizations
  WHERE ((user_organizations.user_id = auth.uid()) AND (user_organizations.organization_id = organization_auth_settings.organization_id) AND (user_organizations.role = 'organization_admin'::user_role))))
  );
-- 4
CREATE POLICY "Organization members can view their org's auth settings"
  ON organization_auth_settings
  FOR SELECT
  TO authenticated
  USING (
    (EXISTS ( SELECT 1
   FROM user_organizations
  WHERE ((user_organizations.user_id = auth.uid()) AND (user_organizations.organization_id = organization_auth_settings.organization_id))))
  );

-- Organizations Policies
-- 1
CREATE policy "Allow unauthenticated read access"
ON organizations
TO public
using (
  true
);
-- 2
CREATE POLICY "Organizations access control"
ON organizations
TO authenticated
using (
((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_global_admin = true)))) OR (EXISTS ( SELECT 1
   FROM user_organizations
  WHERE ((user_organizations.user_id = auth.uid()) AND (user_organizations.organization_id = organizations.id)))))
);
-- Site Settings
-- 1
CREATE POLICY "Anyone can read site settings"
  ON site_settings
  FOR SELECT
  TO authenticated
  USING (true);
-- 2
CREATE POLICY "Only global admins can modify site settings"
  ON site_settings
  FOR ALL
  TO authenticated
  USING (
   (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_global_admin = true))))
  );

-- -- Teams
-- -- 1
-- CREATE POLICY "Global admins can do everything with teams"
--   ON teams
--   FOR ALL
--   TO authenticated
--   USING (is_global_admin(auth.uid()));
-- -- 2
-- CREATE POLICY "Organization admins can manage teams"
--   ON teams
--   FOR ALL
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM user_organizations
--       WHERE user_id = auth.uid()
--       AND organization_id = teams.organization_id
--       AND role = 'organization_admin'
--     )
--   );
-- -- 3
-- CREATE POLICY "Team members can view their teams"
--   ON teams
--   FOR SELECT
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM user_teams
--       WHERE user_id = auth.uid()
--       AND team_id = teams.id
--     )
--   );

-- top bar link
-- 1
CREATE POLICY "Anyone can view topbar links"
  ON topbar_links
  FOR SELECT
  TO authenticated
  USING (true);
-- 2
CREATE POLICY "Only global admins can manage topbar links"
  ON topbar_links
  FOR ALL
  TO authenticated
  USING (
    (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_global_admin = true))))
  );

-- User Organizations Policies
CREATE POLICY "User organizations access control"
  ON user_organizations
  FOR ALL
  TO authenticated
  USING (
     ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_global_admin = true)))) OR (get_user_organization_role(auth.uid(), organization_id) = 'organization_admin'::user_role) OR (user_id = auth.uid()))
  );


-- User Teams Policies
-- 1
CREATE POLICY "Delete team memberships"
  ON user_teams
  FOR DELETE
  TO authenticated
  USING (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_global_admin = true)))) OR (EXISTS ( SELECT 1
   FROM (user_organizations uo
     JOIN teams t ON ((t.id = user_teams.team_id)))
  WHERE ((uo.user_id = auth.uid()) AND (uo.organization_id = t.organization_id) AND (uo.role = 'organization_admin'::user_role)))))
  );
-- 2
CREATE POLICY "Manage team memberships"
  ON user_teams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_global_admin = true)))) OR (EXISTS ( SELECT 1
   FROM (user_organizations uo
     JOIN teams t ON ((t.id = user_teams.team_id)))
  WHERE ((uo.user_id = auth.uid()) AND (uo.organization_id = t.organization_id) AND (uo.role = 'organization_admin'::user_role)))))
  );
--3
CREATE POLICY "View team memberships"
  ON user_teams
  FOR SELECT
  TO authenticated
  USING (
    ((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_global_admin = true)))) OR (EXISTS ( SELECT 1
   FROM (user_organizations uo
     JOIN teams t ON ((t.id = user_teams.team_id)))
  WHERE ((uo.user_id = auth.uid()) AND (uo.organization_id = t.organization_id) AND (uo.role = 'organization_admin'::user_role)))))
  );




-- Update existing organizations to have null logo_url
UPDATE organizations
SET logo_url = NULL
WHERE logo_url IS NULL;
-- Update existing profiles to set default values
UPDATE profiles
SET
  display_name = SPLIT_PART(email, '@', 1),
  has_otp_enabled = false
WHERE
  display_name IS NULL OR
  has_otp_enabled IS NULL;
-- Insert default admin email setting
INSERT INTO app_settings (key, value)
VALUES ('default_admin_email', 'admin@example.com')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;

-- First create a unique index on the email field if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON auth.users (email);

-- Create the admin user
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@example.com',
  crypt('Admin123!@#', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  '',
  '',
  '',
  ''
)
ON CONFLICT (email) DO NOTHING;
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
-- Insert default settings
-- Insert default settings if none exist
INSERT INTO site_settings (site_name, primary_color, secondary_color)
SELECT 'My Application', '#4F46E5', '#6366F1'
WHERE NOT EXISTS (SELECT 1 FROM site_settings);

INSERT INTO organizations (name, slug, created_at, updated_at)
SELECT
  'Default Organization',
  true,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM organizations
);


-- Create avatars bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create logos bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Set up security policies for avatars bucket
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload avatar images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their own avatar image"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid() = owner
  );

CREATE POLICY "Users can delete their own avatar image"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid() = owner
  );

-- Set up security policies for logos bucket
CREATE POLICY "Logo images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');

CREATE POLICY "Only global admins can manage logos"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'logos'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_global_admin = true
    )
  );
UPDATE profiles
SET display_name = SPLIT_PART(email, '@', 1)
WHERE display_name IS NULL;
UPDATE profiles
SET last_sign_in_at = users.last_sign_in_at
FROM auth.users
WHERE profiles.id = users.id;

CREATE OR REPLACE FUNCTION public.handle_user_sign_in()
RETURNS trigger AS $$
BEGIN
  UPDATE public.profiles
  SET last_sign_in_at = now()
  WHERE id = new.id;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER on_auth_user_sign_in
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION public.handle_user_sign_in();
  -- UNIQUE INDEXES
