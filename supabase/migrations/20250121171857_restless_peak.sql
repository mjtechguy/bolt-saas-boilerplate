-- Drop materialized view first since it depends on multiple tables
DROP MATERIALIZED VIEW IF EXISTS user_effective_permissions;

-- Drop all policies that depend on teams or user_teams
DROP POLICY IF EXISTS "teams_access_policy" ON teams;
DROP POLICY IF EXISTS "teams_access_policy_v4" ON teams;
DROP POLICY IF EXISTS "user_teams_access_policy" ON user_teams;
DROP POLICY IF EXISTS "Team admins can manage team links" ON links;
DROP POLICY IF EXISTS "Users can view accessible links" ON links;
DROP POLICY IF EXISTS "links_access_policy" ON links;
DROP POLICY IF EXISTS "links_access_policy_v4" ON links;

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

-- Now we can safely drop the tables
DROP TABLE IF EXISTS user_teams;
DROP TABLE IF EXISTS teams;

-- Update links table to remove team functionality
ALTER TABLE links DROP COLUMN IF EXISTS team_id;

-- Create new enum type without team value
CREATE TYPE link_scope_new AS ENUM ('global', 'organization');

-- Update existing links to use new scope
UPDATE links SET scope = 'global' WHERE scope = 'team';

-- Alter table to use new enum
ALTER TABLE links 
  ALTER COLUMN scope TYPE link_scope_new 
  USING (scope::text::link_scope_new);

-- Drop old enum and rename new one
DROP TYPE link_scope;
ALTER TYPE link_scope_new RENAME TO link_scope;

-- Create simplified policy for links
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