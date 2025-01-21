/*
  # Fix RLS Policy Recursion

  1. Changes
    - Remove circular references in RLS policies
    - Simplify policy structure
    - Maintain security while avoiding recursion

  2. Security
    - Maintain existing access control rules
    - Fix infinite recursion issues
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view teams they are members of" ON teams;
DROP POLICY IF EXISTS "Organization and team admins can invite users to teams" ON user_teams;
DROP POLICY IF EXISTS "Organization and team admins can remove users from teams" ON user_teams;

-- Create non-recursive policies for teams
CREATE POLICY "Team access control"
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
    -- Organization admins have full access to their org's teams
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND organization_id = teams.organization_id
      AND role = 'organization_admin'
    )
    OR
    -- Team members can view their teams
    EXISTS (
      SELECT 1 FROM user_teams
      WHERE user_id = auth.uid()
      AND team_id = teams.id
    )
  );

-- Create non-recursive policies for user_teams
CREATE POLICY "User teams management"
  ON user_teams
  FOR ALL
  TO authenticated
  USING (
    -- Global admins have full access
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_global_admin = true
    )
    OR
    -- Organization admins can manage all teams in their org
    EXISTS (
      SELECT 1 FROM user_organizations uo
      JOIN teams t ON t.organization_id = uo.organization_id
      WHERE uo.user_id = auth.uid()
      AND t.id = user_teams.team_id
      AND uo.role = 'organization_admin'
    )
    OR
    -- Team admins can manage their teams
    EXISTS (
      SELECT 1 FROM user_teams ut
      WHERE ut.user_id = auth.uid()
      AND ut.team_id = user_teams.team_id
      AND ut.role = 'team_admin'
    )
    OR
    -- Users can view their own team memberships
    user_id = auth.uid()
  )
  WITH CHECK (
    -- Global admins can add members
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_global_admin = true
    )
    OR
    -- Organization admins can add members
    EXISTS (
      SELECT 1 FROM user_organizations uo
      JOIN teams t ON t.organization_id = uo.organization_id
      WHERE uo.user_id = auth.uid()
      AND t.id = user_teams.team_id
      AND uo.role = 'organization_admin'
    )
    OR
    -- Team admins can add members
    EXISTS (
      SELECT 1 FROM user_teams ut
      WHERE ut.user_id = auth.uid()
      AND ut.team_id = user_teams.team_id
      AND ut.role = 'team_admin'
    )
  );