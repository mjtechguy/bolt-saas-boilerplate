/*
  # Add last sign in tracking

  1. Changes
    - Add last_sign_in_at column to profiles table
    - Create function to update last_sign_in_at
    - Create trigger to automatically update last_sign_in_at on sign in

  2. Security
    - Function runs with security definer to ensure it can always update profiles
    - Trigger attached to auth.users table
*/

-- Add last_sign_in_at column to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz;

-- Update existing profiles to use auth.users last_sign_in_at
UPDATE profiles
SET last_sign_in_at = users.last_sign_in_at
FROM auth.users
WHERE profiles.id = users.id;

-- Create function to update last sign in time
CREATE OR REPLACE FUNCTION public.handle_user_sign_in()
RETURNS trigger AS $$
BEGIN
  UPDATE public.profiles
  SET last_sign_in_at = now()
  WHERE id = new.id;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for sign in tracking
DROP TRIGGER IF EXISTS on_auth_user_sign_in ON auth.users;
CREATE TRIGGER on_auth_user_sign_in
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION public.handle_user_sign_in();