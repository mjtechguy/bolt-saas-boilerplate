/*
  # Set up admin configuration

  1. New Tables
    - `app_settings` table to store application configuration
    - Stores default admin email for reference by trigger function

  2. Security
    - Enable RLS on app_settings table
    - Add policy for authenticated users to read settings
    - Add function to check admin email
*/

-- Create app settings table
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read settings
CREATE POLICY "Anyone can read app settings"
  ON app_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert default admin email setting
INSERT INTO app_settings (key, value)
VALUES ('default_admin_email', 'admin@example.com')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;

-- Create function to check if email is admin
-- CREATE OR REPLACE FUNCTION is_default_admin_email(email text)
-- RETURNS boolean AS $$
-- BEGIN
--   RETURN EXISTS (
--     SELECT 1
--     FROM app_settings
--     WHERE key = 'default_admin_email'
--     AND value = email
--   );
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

--updated function

CREATE OR REPLACE FUNCTION public.is_default_admin_email(email varchar)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.app_settings
    WHERE key = 'default_admin_email'
    AND value = email
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Update handle_new_user function to use the new check
-- CREATE OR REPLACE FUNCTION public.handle_new_user()
-- RETURNS trigger AS $$
-- BEGIN
--   INSERT INTO public.profiles (id, email, is_global_admin)
--   VALUES (
--     new.id,
--     new.email,
--     is_default_admin_email(new.email)
--   );
--   RETURN new;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

--upadted function

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_global_admin)
  VALUES (
    new.id,
    new.email,
    public.is_default_admin_email(new.email::text)  -- Explicit cast to text
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;