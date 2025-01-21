-- Drop all existing policies
DROP POLICY IF EXISTS "teams_access_policy_v4" ON teams;
DROP POLICY IF EXISTS "user_teams_access_policy_v4" ON user_teams;
DROP POLICY IF EXISTS "links_access_policy_v4" ON links;

-- Drop materialized view and related objects
DROP MATERIALIZED VIEW IF EXISTS user_effective_permissions;
DROP FUNCTION IF EXISTS refresh_user_permissions() CASCADE;

-- Create simple, non-recursive policies for teams
CREATE POLICY "teams_simple_access"
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
    -- Organization admins
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

-- Create simple policy for user_teams
CREATE POLICY "user_teams_simple_access"
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
    -- Organization admins managing their org's teams
    EXISTS (
      SELECT 1 FROM teams t
      JOIN user_organizations uo ON uo.organization_id = t.organization_id
      WHERE t.id = user_teams.team_id
      AND uo.user_id = auth.uid()
      AND uo.role = 'organization_admin'
    )
    OR
    -- Team admins managing their team
    EXISTS (
      SELECT 1 FROM user_teams ut
      WHERE ut.user_id = auth.uid()
      AND ut.team_id = user_teams.team_id
      AND ut.role = 'team_admin'
    )
  );

-- Create simple policy for links
CREATE POLICY "links_simple_access"
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
    -- Organization links
    (
      scope = 'organization'
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