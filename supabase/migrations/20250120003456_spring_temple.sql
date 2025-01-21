/*
  # Add Default Site Settings

  1. Changes
    - Insert default site settings if none exist
    - Update site settings policies to allow public access
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can read site settings" ON site_settings;
DROP POLICY IF EXISTS "Only global admins can modify site settings" ON site_settings;

-- Create new policies
CREATE POLICY "Public can read site settings"
  ON site_settings
  FOR SELECT
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

-- Insert default settings if none exist
INSERT INTO site_settings (site_name, primary_color, secondary_color)
SELECT 'My Application', '#4F46E5', '#6366F1'
WHERE NOT EXISTS (SELECT 1 FROM site_settings);