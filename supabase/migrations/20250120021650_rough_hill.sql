-- Drop all existing policies
DROP POLICY IF EXISTS "minimal_teams_access" ON teams;
DROP POLICY IF EXISTS "minimal_user_teams_access" ON user_teams;
DROP POLICY IF EXISTS "minimal_links_access" ON links;

-- Create the absolute simplest policy for teams
CREATE POLICY "basic_teams_policy"
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
    -- Direct team membership only
    EXISTS (
      SELECT 1 FROM user_teams
      WHERE user_id = auth.uid()
      AND team_id = teams.id
    )
  );

-- Create the absolute simplest policy for user_teams
CREATE POLICY "basic_user_teams_policy"
  ON user_teams
  FOR ALL
  TO authenticated
  USING (
    -- Only allow users to see their own memberships
    user_id = auth.uid()
  );

-- Create the absolute simplest policy for links
CREATE POLICY "basic_links_policy"
  ON links
  FOR ALL
  TO authenticated
  USING (
    -- Global links only
    scope = 'global'
    OR
    -- Global admin check (direct)
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() 
      AND is_global_admin = true
    )
  );

-- Create minimal required indexes
CREATE INDEX IF NOT EXISTS idx_profiles_admin ON profiles(id) WHERE is_global_admin = true;
CREATE INDEX IF NOT EXISTS idx_user_teams_basic ON user_teams(user_id, team_id);