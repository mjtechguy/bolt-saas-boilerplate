-- Add logo_url column to organizations table
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS logo_url text;

-- Update existing organizations to have null logo_url
UPDATE organizations
SET logo_url = NULL
WHERE logo_url IS NULL;