-- First drop all policies that might reference the materialized view
DO $$ 
BEGIN
  -- Drop policies that might reference user_effective_permissions
  DROP POLICY IF EXISTS "teams_access_policy_v4" ON teams;
  DROP POLICY IF EXISTS "user_teams_access_policy_v4" ON user_teams;
  DROP POLICY IF EXISTS "links_access_policy_v4" ON links;
  
  -- Drop other policies that might reference teams
  DROP POLICY IF EXISTS "teams_access_policy" ON teams;
  DROP POLICY IF EXISTS "user_teams_access_policy" ON user_teams;
  DROP POLICY IF EXISTS "Team admins can manage team links" ON links;
  DROP POLICY IF EXISTS "Users can view accessible links" ON links;
  DROP POLICY IF EXISTS "links_access_policy" ON links;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Now drop the materialized view
DROP MATERIALIZED VIEW IF EXISTS user_effective_permissions;

-- Drop tables with CASCADE to handle any remaining dependencies
DROP TABLE IF EXISTS user_teams CASCADE;
DROP TABLE IF EXISTS teams CASCADE;

-- Update links table to remove team functionality
ALTER TABLE links DROP COLUMN IF EXISTS team_id;

-- Create temporary table to preserve links data
CREATE TEMP TABLE temp_links AS SELECT * FROM links;

-- Drop links table and recreate with new enum
DROP TABLE links CASCADE;

-- Recreate links table with new scope enum
CREATE TYPE link_scope AS ENUM ('global', 'organization');

CREATE TABLE links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  url text NOT NULL,
  logo_url text,
  scope link_scope NOT NULL,
  organization_id uuid REFERENCES organizations(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Restore links data with converted scope
INSERT INTO links (id, name, description, url, logo_url, scope, organization_id, created_at, updated_at)
SELECT 
  id, 
  name, 
  description, 
  url, 
  logo_url,
  CASE 
    WHEN scope::text = 'team' THEN 'global'::link_scope
    ELSE scope::text::link_scope
  END,
  organization_id,
  created_at,
  updated_at
FROM temp_links;

-- Drop temporary table
DROP TABLE temp_links;

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