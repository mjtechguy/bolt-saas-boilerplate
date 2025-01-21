-- Drop all dependent objects with CASCADE
DROP MATERIALIZED VIEW IF EXISTS user_effective_permissions CASCADE;
DROP TABLE IF EXISTS user_teams CASCADE;
DROP TABLE IF EXISTS teams CASCADE;

-- Update links table to remove team functionality
ALTER TABLE links DROP COLUMN IF EXISTS team_id;

-- Handle enum type change
DO $$
BEGIN
  -- Create new enum if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'link_scope_new') THEN
    CREATE TYPE link_scope_new AS ENUM ('global', 'organization');
  END IF;
END$$;

-- Update existing links to use new scope
UPDATE links SET scope = 'global' WHERE scope::text = 'team';

-- Alter table to use new enum
ALTER TABLE links 
  ALTER COLUMN scope TYPE link_scope_new 
  USING (scope::text::link_scope_new);

-- Drop old enum type if it exists
DO $$
BEGIN
  DROP TYPE IF EXISTS link_scope;
EXCEPTION
  WHEN dependent_objects_still_exist THEN
    NULL;
END $$;

-- Rename new enum to final name
ALTER TYPE link_scope_new RENAME TO link_scope;

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