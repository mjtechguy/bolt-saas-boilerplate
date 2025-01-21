-- Drop existing policies
DROP POLICY IF EXISTS "basic_teams_policy" ON teams;
DROP POLICY IF EXISTS "basic_user_teams_policy" ON user_teams;
DROP POLICY IF EXISTS "basic_links_policy" ON links;

-- Add composite unique constraint for team names within orgs
ALTER TABLE teams 
DROP CONSTRAINT IF EXISTS teams_org_name_unique;

ALTER TABLE teams
ADD CONSTRAINT teams_org_name_unique UNIQUE (organization_id, name);

-- Create hierarchical policy for teams
CREATE POLICY "hierarchical_teams_access"
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
    -- Organization level check first
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND organization_id = teams.organization_id
    )
  );

-- Create policy for user_teams
CREATE POLICY "hierarchical_user_teams_access"
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
CREATE POLICY "hierarchical_links_access"
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
    -- Organization links (check org access first)
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
    -- Team links (check org access first, then team)
    (
      scope = 'team'
      AND team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM user_organizations uo
        JOIN teams t ON t.organization_id = uo.organization_id
        WHERE uo.user_id = auth.uid()
        AND t.id = links.team_id
      )
    )
  );

-- Create optimized indexes
CREATE INDEX IF NOT EXISTS idx_teams_org_name ON teams(organization_id, name);
CREATE INDEX IF NOT EXISTS idx_user_orgs_user ON user_organizations(user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_user_teams_user ON user_teams(user_id, team_id);