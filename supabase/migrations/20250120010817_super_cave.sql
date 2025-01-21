/*
  # Update AI Settings Schema

  1. Changes
    - Add default values for required fields
    - Create trigger for automatic settings creation
    - Add missing settings for existing organizations

  2. Security
    - Maintain existing RLS policies
*/

-- Add default values to existing table if it exists
DO $$ 
BEGIN
  -- Update column defaults if table exists
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'organization_ai_settings') THEN
    ALTER TABLE organization_ai_settings 
      ALTER COLUMN endpoint_url SET DEFAULT '',
      ALTER COLUMN api_key SET DEFAULT '',
      ALTER COLUMN model SET DEFAULT '';
  END IF;
END $$;

-- Create function to ensure AI settings exist for organizations
CREATE OR REPLACE FUNCTION ensure_organization_ai_settings()
RETURNS trigger AS $$
BEGIN
  INSERT INTO organization_ai_settings (organization_id)
  VALUES (NEW.id)
  ON CONFLICT (organization_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to create AI settings when organization is created
DO $$ 
BEGIN
  -- Drop trigger if it exists
  DROP TRIGGER IF EXISTS create_organization_ai_settings ON organizations;
  
  -- Create new trigger
  CREATE TRIGGER create_organization_ai_settings
    AFTER INSERT ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION ensure_organization_ai_settings();
END $$;

-- Create default AI settings for existing organizations
INSERT INTO organization_ai_settings (organization_id)
SELECT id FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM organization_ai_settings WHERE organization_id = organizations.id
)
ON CONFLICT (organization_id) DO NOTHING;