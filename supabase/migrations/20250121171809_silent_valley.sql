-- Drop team-related policies first
DROP POLICY IF EXISTS "teams_access_policy" ON teams;
DROP POLICY IF EXISTS "user_teams_access_policy" ON user_teams;

-- Drop team-related foreign key constraints
ALTER TABLE links DROP CONSTRAINT IF EXISTS links_team_id_fkey;
ALTER TABLE user_teams DROP CONSTRAINT IF EXISTS user_teams_team_id_fkey;

-- Drop team-related indexes
DROP INDEX IF EXISTS idx_teams_org_id;
DROP INDEX IF EXISTS idx_user_teams_lookup;
DROP INDEX IF EXISTS idx_user_teams_team_id;
DROP INDEX IF EXISTS idx_user_teams_user_id;
DROP INDEX IF EXISTS idx_teams_lookup;
DROP INDEX IF EXISTS idx_links_team_id;

-- Drop team-related tables
DROP TABLE IF EXISTS user_teams;
DROP TABLE IF EXISTS teams;

-- Update links table to remove team functionality
ALTER TABLE links DROP COLUMN IF EXISTS team_id;
ALTER TYPE link_scope DROP VALUE IF EXISTS 'team';

-- Create simplified policy for links
DROP POLICY IF EXISTS "links_access_policy" ON links;
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
  );

-- Create optimized indexes for remaining functionality
CREATE INDEX IF NOT EXISTS idx_user_orgs_lookup ON user_organizations(user_id, organization_id, role);
CREATE INDEX IF NOT EXISTS idx_links_org_lookup ON links(scope, organization_id);

-- Update organization_apps to remove team management
UPDATE organization_apps 
SET enabled = false 
WHERE app_type = 'team_management';

-- Update available_apps to disable team management
UPDATE available_apps 
SET enabled = false 
WHERE type = 'team_management';