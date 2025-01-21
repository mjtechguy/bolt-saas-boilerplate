-- Drop existing policies with CASCADE to handle dependencies
DROP POLICY IF EXISTS "Teams access" ON teams CASCADE;
DROP POLICY IF EXISTS "User teams access" ON user_teams CASCADE;
DROP POLICY IF EXISTS "Links access" ON links CASCADE;

-- Create optimized non-recursive policy for teams
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
      SELECT 1 FROM user_teams
      WHERE user_id = auth.uid()
      AND team_id = teams.id
    )
  );

-- Create optimized non-recursive policy for user_teams
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
      WHERE uo.user_id = auth.uid()
      AND uo.role = 'organization_admin'
      AND EXISTS (
        SELECT 1 FROM teams t
        WHERE t.id = user_teams.team_id
        AND t.organization_id = uo.organization_id
      )
    )
    OR
    -- Users can see their own team memberships
    user_id = auth.uid()
  );

-- Create optimized non-recursive policy for links
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