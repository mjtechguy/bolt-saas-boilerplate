/*
  # Role-Based Access Control Schema

  1. New Tables
    - `roles`
      - System-wide roles (global_admin, organization_admin, team_admin, user)
    - `organizations`
      - Organizations that users can belong to
    - `teams`
      - Teams within organizations
    - `user_organizations`
      - Junction table for user-organization relationships
    - `user_teams`
      - Junction table for user-team relationships
    - `organization_roles`
      - User roles within organizations
    - `team_roles`
      - User roles within teams

  2. Security
    - Enable RLS on all tables
    - Add policies for data access based on user roles
*/

-- Create roles enum
CREATE TYPE user_role AS ENUM (
  'global_admin',
  'organization_admin',
  'team_admin',
  'user'
);

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
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

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_teams ENABLE ROW LEVEL SECURITY;

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

-- Organizations Policies
CREATE POLICY "Global admins can do everything with organizations"
  ON organizations
  FOR ALL
  TO authenticated
  USING (is_global_admin(auth.uid()));

CREATE POLICY "Organization admins can view and update their organizations"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND organization_id = organizations.id
    )
  );

-- Teams Policies
CREATE POLICY "Global admins can do everything with teams"
  ON teams
  FOR ALL
  TO authenticated
  USING (is_global_admin(auth.uid()));

CREATE POLICY "Organization admins can manage teams"
  ON teams
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND organization_id = teams.organization_id
      AND role = 'organization_admin'
    )
  );

CREATE POLICY "Team members can view their teams"
  ON teams
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_teams
      WHERE user_id = auth.uid()
      AND team_id = teams.id
    )
  );

-- User Organizations Policies
CREATE POLICY "Global admins can manage user organizations"
  ON user_organizations
  FOR ALL
  TO authenticated
  USING (is_global_admin(auth.uid()));

CREATE POLICY "Organization admins can manage members"
  ON user_organizations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations org_admin
      WHERE org_admin.user_id = auth.uid()
      AND org_admin.organization_id = user_organizations.organization_id
      AND org_admin.role = 'organization_admin'
    )
  );

CREATE POLICY "Users can view their own organization memberships"
  ON user_organizations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- User Teams Policies
CREATE POLICY "Global admins can manage user teams"
  ON user_teams
  FOR ALL
  TO authenticated
  USING (is_global_admin(auth.uid()));

CREATE POLICY "Organization admins can manage team members"
  ON user_teams
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND organization_id = (
        SELECT organization_id FROM teams
        WHERE id = user_teams.team_id
      )
      AND role = 'organization_admin'
    )
  );

CREATE POLICY "Team admins can manage their team members"
  ON user_teams
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_teams admin_teams
      WHERE admin_teams.user_id = auth.uid()
      AND admin_teams.team_id = user_teams.team_id
      AND admin_teams.role = 'team_admin'
    )
  );

CREATE POLICY "Users can view their own team memberships"
  ON user_teams
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());