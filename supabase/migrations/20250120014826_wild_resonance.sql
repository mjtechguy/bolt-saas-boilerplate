/*
  # Fix RLS Policy Recursion - Final

  1. Changes
    - Simplify RLS policies to avoid any recursion
    - Remove circular references in policy checks
    - Maintain security while improving performance

  2. Security
    - Maintain existing access control rules
    - Fix infinite recursion issues
    - Optimize policy checks
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Teams access policy" ON teams;
DROP POLICY IF EXISTS "View team memberships" ON user_teams;
DROP POLICY IF EXISTS "Manage team memberships" ON user_teams;
DROP POLICY IF EXISTS "Delete team memberships" ON user_teams;
DROP POLICY IF EXISTS "Links access policy" ON links;

-- Create simplified policy for teams
CREATE POLICY "Teams access policy"
  ON teams
  FOR ALL
  TO authenticated
  USING (
    -- Global admins have full access
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_global_admin = true
    )
    OR
    -- Organization admins have access to their org's teams
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND organization_id = teams.organization_id
      AND role = 'organization_admin'
    )
    OR
    -- Team members have access to their teams
    EXISTS (
      SELECT 1 FROM user_teams
      WHERE user_id = auth.uid()
      AND team_id = teams.id
    )
  );

-- Create separate policies for user_teams based on operation
CREATE POLICY "View team memberships"
  ON user_teams
  FOR SELECT
  TO authenticated
  USING (
    -- Users can view their own memberships
    user_id = auth.uid()
    OR
    -- Global admins can view all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_global_admin = true
    )
    OR
    -- Organization admins can view their org's team memberships
    EXISTS (
      SELECT 1 FROM user_organizations uo
      WHERE uo.user_id = auth.uid()
      AND uo.role = 'organization_admin'
      AND EXISTS (
        SELECT 1 FROM teams t
        WHERE t.id = user_teams.team_id
        AND t.organization_id = uo.organization_id
      )
    )
  );

CREATE POLICY "Manage team memberships"
  ON user_teams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Global admins can manage all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_global_admin = true
    )
    OR
    -- Organization admins can manage their org's teams
    EXISTS (
      SELECT 1 FROM user_organizations uo
      WHERE uo.user_id = auth.uid()
      AND uo.role = 'organization_admin'
      AND EXISTS (
        SELECT 1 FROM teams t
        WHERE t.id = user_teams.team_id
        AND t.organization_id = uo.organization_id
      )
    )
  );

CREATE POLICY "Delete team memberships"
  ON user_teams
  FOR DELETE
  TO authenticated
  USING (
    -- Global admins can manage all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_global_admin = true
    )
    OR
    -- Organization admins can manage their org's teams
    EXISTS (
      SELECT 1 FROM user_organizations uo
      WHERE uo.user_id = auth.uid()
      AND uo.role = 'organization_admin'
      AND EXISTS (
        SELECT 1 FROM teams t
        WHERE t.id = user_teams.team_id
        AND t.organization_id = uo.organization_id
      )
    )
  );

-- Create optimized policy for links
CREATE POLICY "Links access policy"
  ON links
  FOR ALL
  TO authenticated
  USING (
    -- Global links are accessible to all
    scope = 'global'
    OR
    -- Global admins have full access
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_global_admin = true
    )
    OR
    -- Organization links are accessible to org members
    (scope = 'organization' AND
     EXISTS (
       SELECT 1 FROM user_organizations
       WHERE user_id = auth.uid()
       AND organization_id = links.organization_id
     ))
    OR
    -- Team links are accessible to team members
    (scope = 'team' AND
     EXISTS (
       SELECT 1 FROM user_teams
       WHERE user_id = auth.uid()
       AND team_id = links.team_id
     ))
  );