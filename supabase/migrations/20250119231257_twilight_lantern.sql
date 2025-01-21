/*
  # Fix Links Table Structure and Relations

  1. Changes
    - Drop existing links table and related objects
    - Recreate links table with proper foreign key relationships
    - Add proper indexes for performance
    - Update RLS policies

  2. Security
    - Enable RLS
    - Add optimized policies for different access levels
    - Add trigger for scope validation
*/

-- Drop existing objects if they exist
DROP TABLE IF EXISTS links;
DROP TYPE IF EXISTS link_scope;
DROP FUNCTION IF EXISTS validate_link_scope();

-- Create scope enum type
CREATE TYPE link_scope AS ENUM ('global', 'organization', 'team');

-- Create links table with proper foreign key references
CREATE TABLE links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  url text NOT NULL,
  logo_url text,
  scope link_scope NOT NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for foreign keys and frequently queried columns
CREATE INDEX links_organization_id_idx ON links(organization_id);
CREATE INDEX links_team_id_idx ON links(team_id);
CREATE INDEX links_scope_idx ON links(scope);

-- Enable RLS
ALTER TABLE links ENABLE ROW LEVEL SECURITY;

-- Create optimized policies
CREATE POLICY "Global admins can manage all links"
  ON links
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_global_admin = true
    )
  );

CREATE POLICY "Organization admins can manage org links"
  ON links
  FOR ALL
  TO authenticated
  USING (
    organization_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND organization_id = links.organization_id
      AND role = 'organization_admin'
    )
  );

CREATE POLICY "Team admins can manage team links"
  ON links
  FOR ALL
  TO authenticated
  USING (
    team_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM user_teams
      WHERE user_id = auth.uid()
      AND team_id = links.team_id
      AND role = 'team_admin'
    )
  );

CREATE POLICY "Users can view accessible links"
  ON links
  FOR SELECT
  TO authenticated
  USING (
    scope = 'global'
    OR (
      organization_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM user_organizations
        WHERE user_id = auth.uid()
        AND organization_id = links.organization_id
      )
    )
    OR (
      team_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM user_teams
        WHERE user_id = auth.uid()
        AND team_id = links.team_id
      )
    )
  );