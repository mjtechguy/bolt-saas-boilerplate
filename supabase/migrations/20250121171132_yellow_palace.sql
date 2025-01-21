-- Drop existing policies
DROP POLICY IF EXISTS "teams_access_policy" ON teams;
DROP POLICY IF EXISTS "user_teams_access_policy" ON user_teams;
DROP POLICY IF EXISTS "links_access_policy" ON links;

-- Create non-recursive policy for teams
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

-- Create non-recursive policy for user_teams
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
    -- Organization admin check (using direct join)
    EXISTS (
      SELECT 1 
      FROM teams t
      INNER JOIN user_organizations uo ON uo.organization_id = t.organization_id
      WHERE uo.user_id = auth.uid()
      AND t.id = user_teams.team_id
      AND uo.role = 'organization_admin'
    )
  );

-- Create non-recursive policy for links
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
CREATE INDEX IF NOT EXISTS idx_user_teams_lookup ON user_teams(user_id, team_id);
CREATE INDEX IF NOT EXISTS idx_user_orgs_lookup ON user_organizations(user_id, organization_id, role);
CREATE INDEX IF NOT EXISTS idx_links_scope_lookup ON links(scope, organization_id, team_id);