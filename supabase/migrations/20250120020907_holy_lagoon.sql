-- Drop existing policies
DROP POLICY IF EXISTS "teams_simple_access" ON teams;
DROP POLICY IF EXISTS "user_teams_simple_access" ON user_teams;
DROP POLICY IF EXISTS "links_simple_access" ON links;

-- Create flat, non-recursive policy for teams
CREATE POLICY "flat_teams_access"
  ON teams
  FOR ALL
  TO authenticated
  USING (
    -- Global admins have full access
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() 
      AND p.is_global_admin = true
    )
    OR
    -- Organization admins have access to their org's teams
    EXISTS (
      SELECT 1 FROM user_organizations uo
      WHERE uo.user_id = auth.uid()
      AND uo.organization_id = teams.organization_id
      AND uo.role = 'organization_admin'
    )
    OR
    -- Direct team membership check
    EXISTS (
      SELECT 1 FROM user_teams ut
      WHERE ut.user_id = auth.uid()
      AND ut.team_id = teams.id
    )
  );

-- Create flat policy for user_teams
CREATE POLICY "flat_user_teams_access"
  ON user_teams
  FOR ALL
  TO authenticated
  USING (
    -- Direct user access
    user_id = auth.uid()
    OR
    -- Global admin access
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() 
      AND p.is_global_admin = true
    )
    OR
    -- Organization admin access (using direct join)
    EXISTS (
      SELECT 1 
      FROM teams t
      INNER JOIN user_organizations uo ON uo.organization_id = t.organization_id
      WHERE t.id = user_teams.team_id
      AND uo.user_id = auth.uid()
      AND uo.role = 'organization_admin'
    )
  );

-- Create flat policy for links
CREATE POLICY "flat_links_access"
  ON links
  FOR ALL
  TO authenticated
  USING (
    -- Global links
    scope = 'global'
    OR
    -- Global admin access
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() 
      AND p.is_global_admin = true
    )
    OR
    -- Organization links
    (
      scope = 'organization'
      AND EXISTS (
        SELECT 1 FROM user_organizations uo
        WHERE uo.user_id = auth.uid()
        AND uo.organization_id = links.organization_id
      )
    )
    OR
    -- Team links
    (
      scope = 'team'
      AND EXISTS (
        SELECT 1 FROM user_teams ut
        WHERE ut.user_id = auth.uid()
        AND ut.team_id = links.team_id
      )
    )
  );

-- Create optimized indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_global_admin ON profiles(id) WHERE is_global_admin = true;
CREATE INDEX IF NOT EXISTS idx_user_orgs_user_role ON user_organizations(user_id, organization_id) WHERE role = 'organization_admin';
CREATE INDEX IF NOT EXISTS idx_user_teams_lookup ON user_teams(user_id, team_id);
CREATE INDEX IF NOT EXISTS idx_teams_org_lookup ON teams(id, organization_id);