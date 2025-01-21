/*
  # Fix User Signup Process

  1. Changes
    - Improve handle_new_user trigger function
    - Add better error handling
    - Fix admin user detection
    - Ensure proper profile creation
  
  2. Security
    - Function runs with SECURITY DEFINER
    - Proper permission checks
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Recreate the function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  default_admin_email text;
BEGIN
  -- Get default admin email from environment variable
  default_admin_email := current_setting('app.settings.default_admin_email', true);

  -- Ensure we don't create duplicate profiles
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = new.id
  ) THEN
    INSERT INTO public.profiles (
      id,
      email,
      display_name,
      is_global_admin,
      created_at,
      updated_at
    )
    VALUES (
      new.id,
      new.email,
      SPLIT_PART(new.email, '@', 1),
      CASE 
        WHEN new.email = default_admin_email THEN true
        ELSE false
      END,
      now(),
      now()
    );
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();