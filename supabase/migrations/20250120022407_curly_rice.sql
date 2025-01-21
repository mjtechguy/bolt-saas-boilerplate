-- Drop all existing policies first
DROP POLICY IF EXISTS "hierarchical_teams_access" ON teams;
DROP POLICY IF EXISTS "hierarchical_user_teams_access" ON user_teams;
DROP POLICY IF EXISTS "hierarchical_links_access" ON links;
DROP POLICY IF EXISTS "team_access_policy" ON teams;
DROP POLICY IF EXISTS "user_team_access_policy" ON user_teams;
DROP POLICY IF EXISTS "link_access_policy" ON links;
DROP POLICY IF EXISTS "teams_access" ON teams;
DROP POLICY IF EXISTS "user_teams_access" ON user_teams;
DROP POLICY IF EXISTS "links_access" ON links;

-- Ensure team names are unique within organizations
ALTER TABLE teams 
DROP CONSTRAINT IF EXISTS teams_org_name_unique;

ALTER TABLE teams
ADD CONSTRAINT teams_org_name_unique UNIQUE (organization_id, name);

-- Function to create default team
CREATE OR REPLACE FUNCTION create_default_team()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default "General" team for new organization
  INSERT INTO teams (name, organization_id, slug)
  VALUES ('General', NEW.id, NEW.slug || '-general');

  -- Add the organization admin to the default team
  INSERT INTO user_teams (user_id, team_id, role)
  SELECT 
    uo.user_id,
    t.id,
    'team_admin'
  FROM user_organizations uo
  CROSS JOIN (
    SELECT id FROM teams 
    WHERE organization_id = NEW.id 
    AND name = 'General'
  ) t
  WHERE uo.organization_id = NEW.id
  AND uo.role = 'organization_admin';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for default team
DROP TRIGGER IF EXISTS create_default_team_trigger ON organizations;
CREATE TRIGGER create_default_team_trigger
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION create_default_team();

-- Create hierarchical policy for teams
CREATE POLICY "org_based_teams_access"
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
CREATE POLICY "org_based_user_teams_access"
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
CREATE POLICY "org_based_links_access"
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

-- Create default teams for existing organizations
DO $$
DECLARE
  org RECORD;
BEGIN
  FOR org IN SELECT * FROM organizations WHERE NOT EXISTS (
    SELECT 1 FROM teams WHERE organization_id = organizations.id AND name = 'General'
  )
  LOOP
    -- Create default team
    INSERT INTO teams (name, organization_id, slug)
    VALUES ('General', org.id, org.slug || '-general');

    -- Add organization admins to the team
    INSERT INTO user_teams (user_id, team_id, role)
    SELECT 
      uo.user_id,
      t.id,
      'team_admin'
    FROM user_organizations uo
    CROSS JOIN (
      SELECT id FROM teams 
      WHERE organization_id = org.id 
      AND name = 'General'
    ) t
    WHERE uo.organization_id = org.id
    AND uo.role = 'organization_admin';
  END LOOP;
END;
$$;