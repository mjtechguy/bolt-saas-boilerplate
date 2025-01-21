/*
  # Site Settings Schema

  1. New Tables
    - `site_settings`
      - Stores global site configuration
      - Includes theme, logo URL, site name
    
  2. Security
    - Enable RLS
    - Only global admins can modify settings
    - All authenticated users can read settings
*/

CREATE TABLE IF NOT EXISTS site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name text NOT NULL DEFAULT 'My Application',
  logo_url text,
  primary_color text DEFAULT '#4F46E5',
  secondary_color text DEFAULT '#6366F1',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can read site settings"
  ON site_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only global admins can modify site settings"
  ON site_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_global_admin = true
    )
  );

-- Insert default settings
INSERT INTO site_settings (site_name, logo_url)
VALUES ('My Application', NULL)
ON CONFLICT DO NOTHING;