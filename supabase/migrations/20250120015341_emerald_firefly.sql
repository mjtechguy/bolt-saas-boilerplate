-- Drop existing recursive policies
DROP POLICY IF EXISTS "Teams access policy" ON teams;
DROP POLICY IF EXISTS "View team memberships" ON user_teams;
DROP POLICY IF EXISTS "Manage team memberships" ON user_teams;
DROP POLICY IF EXISTS "Delete team memberships" ON user_teams;
DROP POLICY IF EXISTS "Links access policy" ON links;

-- Create non-recursive policy for teams
CREATE POLICY "Teams access"
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
    -- Organization admins have access to their org's teams
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND organization_id = teams.organization_id
      AND role = 'organization_admin'
    )
    OR
    -- Team members have access to their teams
    EXISTS (
      SELECT 1 FROM user_teams ut
      WHERE ut.user_id = auth.uid()
      AND ut.team_id = teams.id
    )
  );

-- Create non-recursive policy for user_teams
CREATE POLICY "User teams access"
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
      JOIN teams t ON t.id = user_teams.team_id
      WHERE uo.user_id = auth.uid()
      AND uo.organization_id = t.organization_id
      AND uo.role = 'organization_admin'
    )
    OR
    -- Team admins can manage their teams
    EXISTS (
      SELECT 1 FROM user_teams ut
      WHERE ut.user_id = auth.uid()
      AND ut.team_id = user_teams.team_id
      AND ut.role = 'team_admin'
    )
    OR
    -- Users can see their own team memberships
    user_id = auth.uid()
  );

-- Create non-recursive policy for links
CREATE POLICY "Links access"
  ON links
  FOR ALL
  TO authenticated
  USING (
    -- Global links are accessible to all
    scope = 'global'
    OR
    -- Global admins have full access
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_global_admin = true
    )
    OR
    -- Organization links are accessible to org members
    (
      scope = 'organization'
      AND organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM user_organizations
        WHERE user_id = auth.uid()
        AND organization_id = links.organization_id
      )
    )
    OR
    -- Team links are accessible to team members
    (
      scope = 'team'
      AND team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM user_teams
        WHERE user_id = auth.uid()
        AND team_id = links.team_id
      )
    )
  );

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