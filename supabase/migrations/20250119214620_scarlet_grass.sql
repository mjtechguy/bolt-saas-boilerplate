/*
  # Fix profile policies to prevent recursion

  1. Changes
    - Drop existing policies
    - Create new policies with non-recursive conditions
    - Add direct user check for global admin status
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Global admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Global admins can update any profile" ON profiles;

-- Create a function to check if a user is a global admin without recursion
CREATE OR REPLACE FUNCTION is_user_global_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = user_id
    AND is_global_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new policies with non-recursive conditions
CREATE POLICY "Public profiles access"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Users can always read their own profile
    auth.uid() = id
    OR
    -- Global admins can read all profiles (using direct check)
    is_user_global_admin(auth.uid())
  );

CREATE POLICY "Profiles update access"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    -- Users can update their own profile
    auth.uid() = id
    OR
    -- Global admins can update any profile (using direct check)
    is_user_global_admin(auth.uid())
  );