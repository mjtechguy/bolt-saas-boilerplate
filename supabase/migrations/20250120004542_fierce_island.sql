/*
  # Organization Auth Provider Settings

  1. New Tables
    - `organization_auth_settings`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `provider` (enum: oauth, oidc)
      - `name` (text, display name)
      - `client_id` (text)
      - `client_secret` (text)
      - `issuer` (text, for OIDC)
      - `authorization_endpoint` (text, for OAuth)
      - `token_endpoint` (text, for OAuth)
      - `userinfo_endpoint` (text, for OAuth)
      - `enabled` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS
    - Add policies for organization admins
*/

-- Create provider type enum
CREATE TYPE auth_provider_type AS ENUM ('oauth', 'oidc');

-- Create organization auth settings table
CREATE TABLE organization_auth_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  provider auth_provider_type NOT NULL,
  name text NOT NULL,
  client_id text NOT NULL,
  client_secret text NOT NULL,
  issuer text,
  authorization_endpoint text,
  token_endpoint text,
  userinfo_endpoint text,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Enable RLS
ALTER TABLE organization_auth_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Global admins can manage all auth settings"
  ON organization_auth_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_global_admin = true
    )
  );

CREATE POLICY "Organization admins can manage their org's auth settings"
  ON organization_auth_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND organization_id = organization_auth_settings.organization_id
      AND role = 'organization_admin'
    )
  );

CREATE POLICY "Organization members can view their org's auth settings"
  ON organization_auth_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND organization_id = organization_auth_settings.organization_id
    )
  );