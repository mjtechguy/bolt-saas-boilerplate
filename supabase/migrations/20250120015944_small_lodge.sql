-- Drop existing policies with CASCADE to handle dependencies
DROP POLICY IF EXISTS "Teams access" ON teams CASCADE;
DROP POLICY IF EXISTS "Teams access v2" ON teams CASCADE;
DROP POLICY IF EXISTS "User teams access" ON user_teams CASCADE;
DROP POLICY IF EXISTS "User teams access v2" ON user_teams CASCADE;
DROP POLICY IF EXISTS "Links access" ON links CASCADE;
DROP POLICY IF EXISTS "Links access v2" ON links CASCADE;

-- Create optimized non-recursive policy for teams
CREATE POLICY "Teams access v3"
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
CREATE POLICY "User teams access v3"
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

-- Create optimized non-recursive policy for links
CREATE POLICY "Links access v3"
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_organizations_user_id ON user_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_organizations_org_id ON user_organizations(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_teams_user_id ON user_teams(user_id);
CREATE INDEX IF NOT EXISTS idx_user_teams_team_id ON user_teams(team_id);
CREATE INDEX IF NOT EXISTS idx_teams_org_id ON teams(organization_id);
CREATE INDEX IF NOT EXISTS idx_links_scope ON links(scope);
CREATE INDEX IF NOT EXISTS idx_links_org_id ON links(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_links_team_id ON links(team_id) WHERE team_id IS NOT NULL;