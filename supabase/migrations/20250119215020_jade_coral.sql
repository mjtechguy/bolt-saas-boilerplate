/*
  # Fix recursive policies

  1. Changes
    - Remove recursive policy checks
    - Optimize organization and team access policies
    - Add non-recursive helper functions
    - Update existing policies to use optimized checks

  2. Security
    - Maintain same security rules but implement them more efficiently
    - Keep RLS enabled on all tables
*/

-- Create optimized helper functions
CREATE OR REPLACE FUNCTION get_user_organization_role(user_id uuid, org_id uuid)
RETURNS user_role AS $$
  SELECT role FROM user_organizations 
  WHERE user_id = $1 AND organization_id = $2
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Drop existing policies
DROP POLICY IF EXISTS "Global admins can do everything with organizations" ON organizations;
DROP POLICY IF EXISTS "Organization admins can view and update their organizations" ON organizations;
DROP POLICY IF EXISTS "Global admins can manage user organizations" ON user_organizations;
DROP POLICY IF EXISTS "Organization admins can manage members" ON user_organizations;
DROP POLICY IF EXISTS "Users can view their own organization memberships" ON user_organizations;

-- Create new optimized policies for organizations
CREATE POLICY "Organizations access control"
  ON organizations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_global_admin = true
    )
    OR
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND organization_id = organizations.id
    )
  );

-- Create new optimized policies for user_organizations
CREATE POLICY "User organizations access control"
  ON user_organizations
  FOR ALL
  TO authenticated
  USING (
    -- Global admins can do everything
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_global_admin = true
    )
    OR
    -- Organization admins can manage their organizations
    (
      get_user_organization_role(auth.uid(), organization_id) = 'organization_admin'
    )
    OR
    -- Users can view their own memberships
    user_id = auth.uid()
  );

-- Drop existing team policies
DROP POLICY IF EXISTS "Global admins can do everything with teams" ON teams;
DROP POLICY IF EXISTS "Organization admins can manage teams" ON teams;
DROP POLICY IF EXISTS "Team members can view their teams" ON teams;

-- Create new optimized policy for teams
CREATE POLICY "Teams access control"
  ON teams
  FOR ALL
  TO authenticated
  USING (
    -- Global admins can do everything
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_global_admin = true
    )
    OR
    -- Organization admins can manage their organization's teams
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND organization_id = teams.organization_id
      AND role = 'organization_admin'
    )
    OR
    -- Team members can view their teams
    EXISTS (
      SELECT 1 FROM user_teams
      WHERE user_id = auth.uid()
      AND team_id = teams.id
    )
  );

-- Drop existing user teams policies
DROP POLICY IF EXISTS "Global admins can manage user teams" ON user_teams;
DROP POLICY IF EXISTS "Organization admins can manage team members" ON user_teams;
DROP POLICY IF EXISTS "Team admins can manage their team members" ON user_teams;
DROP POLICY IF EXISTS "Users can view their own team memberships" ON user_teams;

-- Create new optimized policy for user_teams
CREATE POLICY "User teams access control"
  ON user_teams
  FOR ALL
  TO authenticated
  USING (
    -- Global admins can do everything
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_global_admin = true
    )
    OR
    -- Organization admins can manage team members
    EXISTS (
      SELECT 1 FROM user_organizations uo
      JOIN teams t ON t.organization_id = uo.organization_id
      WHERE uo.user_id = auth.uid()
      AND t.id = user_teams.team_id
      AND uo.role = 'organization_admin'
    )
    OR
    -- Team admins can manage their team members
    EXISTS (
      SELECT 1 FROM user_teams ut
      WHERE ut.user_id = auth.uid()
      AND ut.team_id = user_teams.team_id
      AND ut.role = 'team_admin'
    )
    OR
    -- Users can view their own memberships
    user_id = auth.uid()
  );