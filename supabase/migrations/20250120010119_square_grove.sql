/*
  # AI Chat Configuration

  1. New Tables
    - `organization_ai_settings`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `endpoint_url` (text)
      - `api_key` (text)
      - `model` (text)
      - `context_size` (integer)
      - `enabled` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for organization admins and members
*/

-- Create organization AI settings table
CREATE TABLE organization_ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  endpoint_url text NOT NULL,
  api_key text NOT NULL,
  model text NOT NULL,
  context_size integer NOT NULL DEFAULT 4096,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id)
);

-- Enable RLS
ALTER TABLE organization_ai_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Global admins can manage all AI settings"
  ON organization_ai_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_global_admin = true
    )
  );

CREATE POLICY "Organization admins can manage their org's AI settings"
  ON organization_ai_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND organization_id = organization_ai_settings.organization_id
      AND role = 'organization_admin'
    )
  );

CREATE POLICY "Organization members can view their org's AI settings"
  ON organization_ai_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND organization_id = organization_ai_settings.organization_id
    )
  );

-- Create chat messages table
CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own chat messages"
  ON chat_messages
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND organization_id = chat_messages.organization_id
      AND role IN ('organization_admin', 'team_admin')
    )
  );

CREATE POLICY "Organization members can view chat messages"
  ON chat_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND organization_id = chat_messages.organization_id
    )
  );