/*
  # Default Organization Setup

  1. New Tables
    - None (using existing tables)

  2. Changes
    - Add default_org column to organizations table
    - Create default organization if it doesn't exist
    - Create function to auto-assign users to default org
    - Create trigger for auto-assignment

  3. Security
    - Maintain existing RLS policies
    - Add policy for viewing default org
*/

-- Add default_org column to organizations
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;

-- Create unique constraint to ensure only one default org
CREATE UNIQUE INDEX IF NOT EXISTS organizations_default_idx 
ON organizations ((is_default IS TRUE)) 
WHERE is_default IS TRUE;

-- Create the default organization if it doesn't exist
INSERT INTO organizations (name, slug, is_default, created_at, updated_at)
SELECT 
  'Default Organization',
  'default',
  true,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM organizations WHERE is_default = true
);

-- Function to assign user to default organization
CREATE OR REPLACE FUNCTION assign_user_to_default_org()
RETURNS trigger AS $$
DECLARE
  default_org_id uuid;
BEGIN
  -- Get the default organization ID
  SELECT id INTO default_org_id
  FROM organizations
  WHERE is_default = true
  LIMIT 1;

  -- If default org exists and user isn't already a member of any org
  IF default_org_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM user_organizations WHERE user_id = NEW.id
  ) THEN
    -- Add user to default organization as regular user
    INSERT INTO user_organizations (
      user_id,
      organization_id,
      role,
      created_at
    ) VALUES (
      NEW.id,
      default_org_id,
      'user',
      now()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto-assignment
DROP TRIGGER IF EXISTS on_auth_user_created_assign_org ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_org
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION assign_user_to_default_org();

-- Add policy for viewing default org
CREATE POLICY "Anyone can view default organization"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (is_default = true);

-- Assign existing users without an org to the default org
DO $$
DECLARE
  default_org_id uuid;
BEGIN
  -- Get default org ID
  SELECT id INTO default_org_id
  FROM organizations
  WHERE is_default = true
  LIMIT 1;

  -- If default org exists, assign users
  IF default_org_id IS NOT NULL THEN
    INSERT INTO user_organizations (user_id, organization_id, role, created_at)
    SELECT 
      p.id,
      default_org_id,
      'user',
      now()
    FROM profiles p
    WHERE NOT EXISTS (
      SELECT 1 
      FROM user_organizations uo 
      WHERE uo.user_id = p.id
    );
  END IF;
END $$;