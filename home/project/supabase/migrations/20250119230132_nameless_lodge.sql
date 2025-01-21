/*
  # Links Management System with Foreign Keys

  1. New Tables
    - `links`
      - `id` (uuid, primary key)
      - `name` (text, required)
      - `description` (text)
      - `url` (text, required)
      - `logo_url` (text)
      - `scope` (enum: global, organization, team)
      - `scope_id` (uuid, references organizations or teams)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS
    - Add policies for different access levels
    - Add trigger for scope validation
*/

-- Create scope enum type
CREATE TYPE link_scope AS ENUM ('global', 'organization', 'team');

-- Create links table with foreign key references
CREATE TABLE IF NOT EXISTS links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  url text NOT NULL,
  logo_url text,
  scope link_scope NOT NULL,
  scope_id uuid,
  organization_id uuid REFERENCES organizations(id),
  team_id uuid REFERENCES teams(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create function to validate and set scope references
CREATE OR REPLACE FUNCTION validate_link_scope()
RETURNS TRIGGER AS $$
BEGIN
  -- Reset both foreign keys
  NEW.organization_id = NULL;
  NEW.team_id = NULL;

  -- For global scope, scope_id must be null
  IF NEW.scope = 'global' AND NEW.scope_id IS NOT NULL THEN
    RAISE EXCEPTION 'Global links cannot have a scope_id';
  END IF;

  -- For organization scope, set organization_id
  IF NEW.scope = 'organization' THEN
    IF NEW.scope_id IS NULL THEN
      RAISE EXCEPTION 'scope_id is required for organization-scoped links';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = NEW.scope_id) THEN
      RAISE EXCEPTION 'Invalid organization ID for organization-scoped link';
    END IF;
    
    NEW.organization_id = NEW.scope_id;
  END IF;

  -- For team scope, set team_id
  IF NEW.scope = 'team' THEN
    IF NEW.scope_id IS NULL THEN
      RAISE EXCEPTION 'scope_id is required for team-scoped links';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM teams WHERE id = NEW.scope_id) THEN
      RAISE EXCEPTION 'Invalid team ID for team-scoped link';
    END IF;
    
    NEW.team_id = NEW.scope_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for scope validation
CREATE TRIGGER validate_link_scope
  BEFORE INSERT OR UPDATE ON links
  FOR EACH ROW
  EXECUTE FUNCTION validate_link_scope();

-- Enable RLS
ALTER TABLE links ENABLE ROW LEVEL SECURITY;

-- Create policies
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
    (scope = 'organization' AND
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND organization_id = scope_id
      AND role = 'organization_admin'
    ))
  );

CREATE POLICY "Team admins can manage team links"
  ON links
  FOR ALL
  TO authenticated
  USING (
    (scope = 'team' AND
    EXISTS (
      SELECT 1 FROM user_teams
      WHERE user_id = auth.uid()
      AND team_id = scope_id
      AND role = 'team_admin'
    ))
  );

CREATE POLICY "Users can view accessible links"
  ON links
  FOR SELECT
  TO authenticated
  USING (
    scope = 'global'
    OR (
      scope = 'organization' AND
      EXISTS (
        SELECT 1 FROM user_organizations
        WHERE user_id = auth.uid()
        AND organization_id = scope_id
      )
    )
    OR (
      scope = 'team' AND
      EXISTS (
        SELECT 1 FROM user_teams
        WHERE user_id = auth.uid()
        AND team_id = scope_id
      )
    )
  );