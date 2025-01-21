-- Add dark_logo_url column to site_settings table
ALTER TABLE site_settings
ADD COLUMN IF NOT EXISTS dark_logo_url text;

-- Update existing site settings to have null dark_logo_url
UPDATE site_settings
SET dark_logo_url = NULL
WHERE dark_logo_url IS NULL;