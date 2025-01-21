/*
  # Fix teams policies recursion

  1. Changes
    - Simplify teams access control
    - Remove circular dependencies in team policies
    - Add direct access checks
    - Optimize team membership validation

  2. Security
    - Maintain same security rules
    - Implement more efficient checks
*/

-- Helper function to check team access
CREATE OR REPLACE FUNCTION has_team_access(check_user_id uuid, check_team_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Direct team membership check
  RETURN EXISTS (
    SELECT 1 FROM user_teams
    WHERE user_id = check_user_id
    AND team_id = check_team_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check organization access
CREATE OR REPLACE FUNCTION has_organization_access(check_user_id uuid, check_org_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Direct organization membership check
  RETURN EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = check_user_id
    AND organization_id = check_org_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing team policies
DROP POLICY IF EXISTS "Teams access control" ON teams;

-- Create new simplified team policy
CREATE POLICY "Teams simplified access"
  ON teams
  FOR ALL
  TO authenticated
  USING (
    -- Global admins have full access
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_global_admin = true
    )
    OR
    -- Organization members have access to their org's teams
    has_organization_access(auth.uid(), organization_id)
  );

-- Drop and recreate user_teams policy
DROP POLICY IF EXISTS "User teams access control" ON user_teams;

CREATE POLICY "User teams simplified access"
  ON user_teams
  FOR ALL
  TO authenticated
  USING (
    -- Global admins have full access
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_global_admin = true
    )
    OR
    -- Organization admins can manage teams in their orgs
    EXISTS (
      SELECT 1 FROM user_organizations uo
      WHERE uo.user_id = auth.uid()
      AND uo.role = 'organization_admin'
      AND uo.organization_id = (
        SELECT organization_id FROM teams
        WHERE id = user_teams.team_id
      )
    )
    OR
    -- Users can see their own team memberships
    user_id = auth.uid()
  );