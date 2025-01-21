-- Drop existing policies
DROP POLICY IF EXISTS "team_access_policy" ON teams;
DROP POLICY IF EXISTS "user_team_access_policy" ON user_teams;
DROP POLICY IF EXISTS "link_access_policy" ON links;

-- Create materialized view for user permissions
CREATE MATERIALIZED VIEW user_effective_permissions AS
SELECT DISTINCT
  p.id as user_id,
  p.is_global_admin,
  uo.organization_id,
  ut.team_id,
  CASE 
    WHEN p.is_global_admin THEN 'global_admin'::user_role
    WHEN uo.role = 'organization_admin' THEN 'organization_admin'::user_role
    WHEN ut.role = 'team_admin' THEN 'team_admin'::user_role
    ELSE 'user'::user_role
  END as effective_role
FROM profiles p
LEFT JOIN user_organizations uo ON p.id = uo.user_id
LEFT JOIN user_teams ut ON p.id = ut.user_id;

-- Create a simple unique index first (required for concurrent refresh)
CREATE UNIQUE INDEX user_effective_permissions_unique_idx ON user_effective_permissions (
  user_id, 
  COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), 
  COALESCE(team_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_user_permissions()
RETURNS TRIGGER AS $$
BEGIN
  -- Regular refresh instead of concurrent since we're in a trigger
  REFRESH MATERIALIZED VIEW user_effective_permissions;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to refresh materialized view
DROP TRIGGER IF EXISTS refresh_perms_profiles ON profiles;
CREATE TRIGGER refresh_perms_profiles
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_user_permissions();

DROP TRIGGER IF EXISTS refresh_perms_user_orgs ON user_organizations;
CREATE TRIGGER refresh_perms_user_orgs
  AFTER INSERT OR UPDATE OR DELETE ON user_organizations
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_user_permissions();

DROP TRIGGER IF EXISTS refresh_perms_user_teams ON user_teams;
CREATE TRIGGER refresh_perms_user_teams
  AFTER INSERT OR UPDATE OR DELETE ON user_teams
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_user_permissions();

-- Create simplified policies using materialized view
CREATE POLICY "teams_access_policy_v4"
  ON teams
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_effective_permissions uep
      WHERE uep.user_id = auth.uid()
      AND (
        uep.is_global_admin = true
        OR (uep.organization_id = teams.organization_id AND uep.effective_role = 'organization_admin')
        OR uep.team_id = teams.id
      )
    )
  );

CREATE POLICY "user_teams_access_policy_v4"
  ON user_teams
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_effective_permissions uep
      WHERE uep.user_id = auth.uid()
      AND (
        uep.is_global_admin = true
        OR uep.user_id = user_teams.user_id
        OR (
          uep.effective_role = 'organization_admin'
          AND EXISTS (
            SELECT 1 FROM teams t
            WHERE t.id = user_teams.team_id
            AND t.organization_id = uep.organization_id
          )
        )
        OR (
          uep.effective_role = 'team_admin'
          AND uep.team_id = user_teams.team_id
        )
      )
    )
  );

CREATE POLICY "links_access_policy_v4"
  ON links
  FOR ALL
  TO authenticated
  USING (
    scope = 'global'
    OR EXISTS (
      SELECT 1 FROM user_effective_permissions uep
      WHERE uep.user_id = auth.uid()
      AND (
        uep.is_global_admin = true
        OR (
          scope = 'organization'
          AND organization_id = uep.organization_id
        )
        OR (
          scope = 'team'
          AND team_id = uep.team_id
        )
      )
    )
  );

-- Initial refresh of the materialized view (non-concurrent since it's the first time)
REFRESH MATERIALIZED VIEW user_effective_permissions;