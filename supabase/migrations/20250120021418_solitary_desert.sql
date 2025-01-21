-- Drop all existing policies
DROP POLICY IF EXISTS "basic_teams_access" ON teams;
DROP POLICY IF EXISTS "basic_user_teams_access" ON user_teams;
DROP POLICY IF EXISTS "basic_links_access" ON links;

-- Drop all existing indexes to recreate them optimally
DROP INDEX IF EXISTS idx_teams_org_id;
DROP INDEX IF EXISTS idx_user_teams_team_id;
DROP INDEX IF EXISTS idx_user_teams_user_id;
DROP INDEX IF EXISTS idx_user_orgs_org_id;
DROP INDEX IF EXISTS idx_user_orgs_user_id;
DROP INDEX IF EXISTS idx_links_scope;
DROP INDEX IF EXISTS idx_links_org_id;
DROP INDEX IF EXISTS idx_links_team_id;
DROP INDEX IF EXISTS idx_profiles_admin;
DROP INDEX IF EXISTS idx_user_orgs_lookup;
DROP INDEX IF EXISTS idx_user_teams_lookup;
DROP INDEX IF EXISTS idx_teams_lookup;
DROP INDEX IF EXISTS idx_links_lookup;

-- Create optimized indexes first
CREATE INDEX IF NOT EXISTS idx_profiles_admin ON profiles(id) WHERE is_global_admin = true;
CREATE INDEX IF NOT EXISTS idx_user_orgs_lookup ON user_organizations(user_id, organization_id, role);
CREATE INDEX IF NOT EXISTS idx_user_teams_lookup ON user_teams(user_id, team_id, role);
CREATE INDEX IF NOT EXISTS idx_teams_lookup ON teams(id, organization_id);
CREATE INDEX IF NOT EXISTS idx_links_lookup ON links(scope, organization_id, team_id);

-- Create the simplest possible policy for teams
CREATE POLICY "basic_teams_access"
  ON teams
  FOR ALL
  TO authenticated
  USING (
    -- Global admin check
    (SELECT is_global_admin FROM profiles WHERE id = auth.uid())
    OR
    -- Organization admin check
    EXISTS (
      SELECT 1 
      FROM user_organizations 
      WHERE user_id = auth.uid()
      AND organization_id = teams.organization_id
      AND role = 'organization_admin'
    )
    OR
    -- Team member check
    EXISTS (
      SELECT 1 
      FROM user_teams 
      WHERE user_id = auth.uid()
      AND team_id = teams.id
    )
  );

-- Create the simplest possible policy for user_teams
CREATE POLICY "basic_user_teams_access"
  ON user_teams
  FOR ALL
  TO authenticated
  USING (
    -- Own membership
    user_id = auth.uid()
    OR
    -- Global admin check
    (SELECT is_global_admin FROM profiles WHERE id = auth.uid())
    OR
    -- Organization admin check
    EXISTS (
      SELECT 1 
      FROM teams t
      JOIN user_organizations uo ON uo.organization_id = t.organization_id
      WHERE t.id = user_teams.team_id
      AND uo.user_id = auth.uid()
      AND uo.role = 'organization_admin'
    )
  );

-- Create the simplest possible policy for links
CREATE POLICY "basic_links_access"
  ON links
  FOR ALL
  TO authenticated
  USING (
    -- Global links
    scope = 'global'
    OR
    -- Global admin check
    (SELECT is_global_admin FROM profiles WHERE id = auth.uid())
    OR
    -- Organization links
    (
      scope = 'organization'
      AND EXISTS (
        SELECT 1 
        FROM user_organizations 
        WHERE user_id = auth.uid()
        AND organization_id = links.organization_id
      )
    )
    OR
    -- Team links
    (
      scope = 'team'
      AND EXISTS (
        SELECT 1 
        FROM user_teams 
        WHERE user_id = auth.uid()
        AND team_id = links.team_id
      )
    )
  );

-- Add comments to explain the approach
COMMENT ON POLICY "basic_teams_access" ON teams IS 'Simple policy for team access with no recursion';
COMMENT ON POLICY "basic_user_teams_access" ON user_teams IS 'Simple policy for user team membership with no recursion';
COMMENT ON POLICY "basic_links_access" ON links IS 'Simple policy for link access with no recursion';