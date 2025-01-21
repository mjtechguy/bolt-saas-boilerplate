-- Drop existing policies
DROP POLICY IF EXISTS "team_access_policy" ON teams;
DROP POLICY IF EXISTS "user_team_access_policy" ON user_teams;
DROP POLICY IF EXISTS "link_access_policy" ON links;

-- Create simplified policies for teams
CREATE POLICY "teams_access_policy"
  ON teams
  FOR ALL
  TO authenticated
  USING (
    -- Global admin check
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() 
      AND is_global_admin = true
    )
    OR
    -- Organization admin check
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND organization_id = teams.organization_id
      AND role = 'organization_admin'
    )
    OR
    -- Team member check
    EXISTS (
      SELECT 1 FROM user_teams
      WHERE user_id = auth.uid()
      AND team_id = teams.id
    )
  );

-- Create policy for user_teams
CREATE POLICY "user_teams_access_policy"
  ON user_teams
  FOR ALL
  TO authenticated
  USING (
    -- Own membership
    user_id = auth.uid()
    OR
    -- Global admin check
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() 
      AND is_global_admin = true
    )
    OR
    -- Organization admin check
    EXISTS (
      SELECT 1 FROM user_organizations uo
      JOIN teams t ON t.organization_id = uo.organization_id
      WHERE uo.user_id = auth.uid()
      AND t.id = user_teams.team_id
      AND uo.role = 'organization_admin'
    )
  );

-- Create policy for links
CREATE POLICY "links_access_policy"
  ON links
  FOR ALL
  TO authenticated
  USING (
    -- Global links
    scope = 'global'
    OR
    -- Global admin check
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() 
      AND is_global_admin = true
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

-- Create optimized indexes
CREATE INDEX IF NOT EXISTS idx_teams_org_id ON teams(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_teams_team_id ON user_teams(team_id);
CREATE INDEX IF NOT EXISTS idx_user_teams_user_id ON user_teams(user_id);
CREATE INDEX IF NOT EXISTS idx_user_orgs_org_id ON user_organizations(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_orgs_user_id ON user_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_links_scope ON links(scope);
CREATE INDEX IF NOT EXISTS idx_links_org_id ON links(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_links_team_id ON links(team_id) WHERE team_id IS NOT NULL;