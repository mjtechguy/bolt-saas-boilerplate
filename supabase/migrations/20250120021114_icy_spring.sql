-- Drop existing policies
DROP POLICY IF EXISTS "teams_access" ON teams;
DROP POLICY IF EXISTS "user_teams_access" ON user_teams;
DROP POLICY IF EXISTS "links_access" ON links;

-- Create simple, direct policy for teams
CREATE POLICY "direct_teams_access"
  ON teams
  FOR ALL
  TO authenticated
  USING (
    -- Global admins
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() 
      AND is_global_admin = true
    )
    OR
    -- Organization admins (direct check)
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND organization_id = teams.organization_id
      AND role = 'organization_admin'
    )
    OR
    -- Team members (direct check)
    EXISTS (
      SELECT 1 FROM user_teams
      WHERE user_id = auth.uid()
      AND team_id = teams.id
    )
  );

-- Create simple policy for user_teams
CREATE POLICY "direct_user_teams_access"
  ON user_teams
  FOR ALL
  TO authenticated
  USING (
    -- Own membership
    user_id = auth.uid()
    OR
    -- Global admins
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() 
      AND is_global_admin = true
    )
    OR
    -- Organization admins (direct join)
    EXISTS (
      SELECT 1 FROM teams t
      INNER JOIN user_organizations uo ON uo.organization_id = t.organization_id
      WHERE t.id = user_teams.team_id
      AND uo.user_id = auth.uid()
      AND uo.role = 'organization_admin'
    )
  );

-- Create simple policy for links
CREATE POLICY "direct_links_access"
  ON links
  FOR ALL
  TO authenticated
  USING (
    -- Global links
    scope = 'global'
    OR
    -- Global admins
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() 
      AND is_global_admin = true
    )
    OR
    -- Organization links (direct check)
    (
      scope = 'organization'
      AND EXISTS (
        SELECT 1 FROM user_organizations
        WHERE user_id = auth.uid()
        AND organization_id = links.organization_id
      )
    )
    OR
    -- Team links (direct check)
    (
      scope = 'team'
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