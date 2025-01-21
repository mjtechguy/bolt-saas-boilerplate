-- Drop all existing policies
DROP POLICY IF EXISTS "teams_access_policy" ON teams;
DROP POLICY IF EXISTS "user_teams_access_policy" ON user_teams;
DROP POLICY IF EXISTS "links_access_policy" ON links;

-- Create the absolute simplest policy for teams
CREATE POLICY "teams_access_policy"
  ON teams
  FOR ALL
  TO authenticated
  USING (
    -- Global admin check (direct)
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() 
      AND is_global_admin = true
    )
    OR
    -- Organization admin check (direct)
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND organization_id = teams.organization_id
      AND role = 'organization_admin'
    )
    OR
    -- Team member check (direct)
    EXISTS (
      SELECT 1 FROM user_teams
      WHERE user_id = auth.uid()
      AND team_id = teams.id
    )
  );

-- Create the absolute simplest policy for user_teams
CREATE POLICY "user_teams_access_policy"
  ON user_teams
  FOR ALL
  TO authenticated
  USING (
    -- Direct user check
    user_id = auth.uid()
    OR
    -- Global admin check (direct)
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() 
      AND is_global_admin = true
    )
  );

-- Create the absolute simplest policy for links
CREATE POLICY "links_access_policy"
  ON links
  FOR ALL
  TO authenticated
  USING (
    -- Global links
    scope = 'global'
    OR
    -- Global admin check (direct)
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() 
      AND is_global_admin = true
    )
    OR
    -- Organization links (direct)
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
    -- Team links (direct)
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

-- Create minimal required indexes
CREATE INDEX IF NOT EXISTS idx_profiles_admin ON profiles(id) WHERE is_global_admin = true;
CREATE INDEX IF NOT EXISTS idx_user_orgs_admin ON user_organizations(user_id, organization_id) WHERE role = 'organization_admin';
CREATE INDEX IF NOT EXISTS idx_user_teams_member ON user_teams(user_id, team_id);