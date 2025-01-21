-- Drop existing policies
DROP POLICY IF EXISTS "flat_teams_access" ON teams;
DROP POLICY IF EXISTS "flat_user_teams_access" ON user_teams;
DROP POLICY IF EXISTS "flat_links_access" ON links;

-- Create cached permissions table
CREATE TABLE IF NOT EXISTS user_permissions (
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  resource_type text NOT NULL CHECK (resource_type IN ('team', 'organization')),
  resource_id uuid NOT NULL,
  permission text NOT NULL CHECK (permission IN ('view', 'manage')),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, resource_type, resource_id)
);

-- Enable RLS on permissions table
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Create policy for permissions table
CREATE POLICY "permissions_access"
  ON user_permissions
  FOR ALL
  TO authenticated
  USING (
    -- Users can view their own permissions
    user_id = auth.uid()
    OR
    -- Global admins can manage all permissions
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_global_admin = true
    )
  );

-- Function to update user permissions
CREATE OR REPLACE FUNCTION update_user_permissions()
RETURNS TRIGGER AS $$
BEGIN
  -- Clear existing permissions for the user
  DELETE FROM user_permissions WHERE user_id = NEW.user_id;
  
  -- Insert organization permissions
  INSERT INTO user_permissions (user_id, resource_type, resource_id, permission)
  SELECT 
    NEW.user_id,
    'organization',
    organization_id,
    CASE WHEN role = 'organization_admin' THEN 'manage' ELSE 'view' END
  FROM user_organizations
  WHERE user_id = NEW.user_id;
  
  -- Insert team permissions
  INSERT INTO user_permissions (user_id, resource_type, resource_id, permission)
  SELECT 
    NEW.user_id,
    'team',
    team_id,
    CASE WHEN role = 'team_admin' THEN 'manage' ELSE 'view' END
  FROM user_teams
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to update permissions
CREATE TRIGGER update_user_permissions_on_org_change
  AFTER INSERT OR UPDATE OR DELETE ON user_organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_user_permissions();

CREATE TRIGGER update_user_permissions_on_team_change
  AFTER INSERT OR UPDATE OR DELETE ON user_teams
  FOR EACH ROW
  EXECUTE FUNCTION update_user_permissions();

-- Create simple policies using cached permissions
CREATE POLICY "teams_access"
  ON teams
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_global_admin = true
    )
    OR
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid()
      AND (
        (resource_type = 'organization' AND resource_id = teams.organization_id)
        OR
        (resource_type = 'team' AND resource_id = teams.id)
      )
    )
  );

CREATE POLICY "user_teams_access"
  ON user_teams
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_global_admin = true
    )
    OR
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid()
      AND permission = 'manage'
      AND (
        (resource_type = 'organization' AND resource_id = (
          SELECT organization_id FROM teams WHERE id = user_teams.team_id
        ))
        OR
        (resource_type = 'team' AND resource_id = user_teams.team_id)
      )
    )
  );

CREATE POLICY "links_access"
  ON links
  FOR ALL
  TO authenticated
  USING (
    scope = 'global'
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_global_admin = true
    )
    OR
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid()
      AND (
        (resource_type = 'organization' AND resource_id = links.organization_id)
        OR
        (resource_type = 'team' AND resource_id = links.team_id)
      )
    )
  );

-- Create indexes for performance
CREATE INDEX idx_user_permissions_lookup 
  ON user_permissions (user_id, resource_type, resource_id);

CREATE INDEX idx_user_permissions_resource 
  ON user_permissions (resource_type, resource_id);

-- Populate initial permissions
INSERT INTO user_permissions (user_id, resource_type, resource_id, permission)
SELECT DISTINCT
  uo.user_id,
  'organization',
  uo.organization_id,
  CASE WHEN uo.role = 'organization_admin' THEN 'manage' ELSE 'view' END
FROM user_organizations uo;

INSERT INTO user_permissions (user_id, resource_type, resource_id, permission)
SELECT DISTINCT
  ut.user_id,
  'team',
  ut.team_id,
  CASE WHEN ut.role = 'team_admin' THEN 'manage' ELSE 'view' END
FROM user_teams ut;