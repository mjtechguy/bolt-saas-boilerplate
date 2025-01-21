/*
  # Multi-Organization and Team Support

  1. Changes
    - Update RLS policies for organizations and teams
    - Add policies for viewing all accessible organizations and teams
    - Add policies for managing organization and team memberships

  2. Security
    - Maintain existing RLS policies
    - Add new policies for multi-org/team access
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view organizations they are members of" ON organizations;
DROP POLICY IF EXISTS "Users can view teams they are members of" ON teams;
DROP POLICY IF EXISTS "Organization admins can invite users" ON user_organizations;
DROP POLICY IF EXISTS "Organization admins can remove users" ON user_organizations;
DROP POLICY IF EXISTS "Organization and team admins can invite users to teams" ON user_teams;
DROP POLICY IF EXISTS "Organization and team admins can remove users from teams" ON user_teams;

-- Update organization policies to allow viewing all accessible organizations
CREATE POLICY "Users can view organizations they are members of"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND organization_id = organizations.id
    )
    OR
    is_default = true
  );

-- Update team policies to allow viewing all accessible teams
CREATE POLICY "Users can view teams they are members of"
  ON teams
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_teams
      WHERE user_id = auth.uid()
      AND team_id = teams.id
    )
    OR
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND organization_id = teams.organization_id
      AND role = 'organization_admin'
    )
  );

-- Update user_organizations policies
CREATE POLICY "Organization admins can invite users"
  ON user_organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND organization_id = user_organizations.organization_id
      AND role = 'organization_admin'
    )
  );

CREATE POLICY "Organization admins can remove users"
  ON user_organizations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND organization_id = user_organizations.organization_id
      AND role = 'organization_admin'
    )
  );

-- Update user_teams policies
CREATE POLICY "Organization and team admins can invite users to teams"
  ON user_teams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND organization_id = (
        SELECT organization_id FROM teams
        WHERE id = user_teams.team_id
      )
      AND role = 'organization_admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM user_teams
      WHERE user_id = auth.uid()
      AND team_id = user_teams.team_id
      AND role = 'team_admin'
    )
  );

CREATE POLICY "Organization and team admins can remove users from teams"
  ON user_teams
  FOR DELETE
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
    OR
    EXISTS (
      SELECT 1 FROM user_teams
      WHERE user_id = auth.uid()
      AND team_id = user_teams.team_id
      AND role = 'team_admin'
    )
  );

-- Add helper function to get user's organizations
CREATE OR REPLACE FUNCTION get_user_organizations(user_id uuid)
RETURNS TABLE (
  organization_id uuid,
  role user_role
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    uo.organization_id,
    uo.role
  FROM user_organizations uo
  WHERE uo.user_id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helper function to get user's teams
CREATE OR REPLACE FUNCTION get_user_teams(user_id uuid)
RETURNS TABLE (
  team_id uuid,
  organization_id uuid,
  role user_role
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ut.team_id,
    t.organization_id,
    ut.role
  FROM user_teams ut
  JOIN teams t ON t.id = ut.team_id
  WHERE ut.user_id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;