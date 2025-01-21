-- Drop existing policies
DROP POLICY IF EXISTS "Teams access v3" ON teams;
DROP POLICY IF EXISTS "User teams access v3" ON user_teams;
DROP POLICY IF EXISTS "Links access v3" ON links;

-- Create non-recursive policy for teams
CREATE POLICY "team_access_policy"
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
    -- Direct team membership
    EXISTS (
      SELECT 1 FROM user_teams
      WHERE user_id = auth.uid()
      AND team_id = teams.id
    )
  );

-- Create non-recursive policy for user_teams
CREATE POLICY "user_team_access_policy"
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
    -- Direct team membership
    user_id = auth.uid()
    OR
    -- Organization admins can manage their org's teams
    EXISTS (
      SELECT 1 FROM user_organizations uo
      INNER JOIN teams t ON t.organization_id = uo.organization_id
      WHERE uo.user_id = auth.uid()
      AND t.id = user_teams.team_id
      AND uo.role = 'organization_admin'
    )
  );

-- Create non-recursive policy for links
CREATE POLICY "link_access_policy"
  ON links
  FOR ALL
  TO authenticated
  USING (
    -- Global links and admin access
    scope = 'global'
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_global_admin = true
    )
    OR
    -- Organization links
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
    -- Team links
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

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_teams_org_id ON teams(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_teams_team_id ON user_teams(team_id);
CREATE INDEX IF NOT EXISTS idx_user_teams_user_id ON user_teams(user_id);
CREATE INDEX IF NOT EXISTS idx_user_orgs_org_id ON user_organizations(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_orgs_user_id ON user_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_links_scope ON links(scope);
CREATE INDEX IF NOT EXISTS idx_links_org_id ON links(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_links_team_id ON links(team_id) WHERE team_id IS NOT NULL;