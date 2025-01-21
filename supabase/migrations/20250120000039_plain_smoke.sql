/*
  # Top Bar Links Management System

  1. New Tables
    - `topbar_links`
      - `id` (uuid, primary key)
      - `name` (text, required)
      - `url` (text, required)
      - `icon_name` (text, required)
      - `order` (integer, required)
      - `is_social` (boolean, required)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS
    - Add policies for viewing and managing links
*/

-- Drop existing objects if they exist
DROP POLICY IF EXISTS "Anyone can view topbar links" ON topbar_links;
DROP POLICY IF EXISTS "Only global admins can manage topbar links" ON topbar_links;
DROP INDEX IF EXISTS topbar_links_order_idx;
DROP TABLE IF EXISTS topbar_links;

-- Create topbar_links table
CREATE TABLE topbar_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  icon_name text NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  is_social boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE topbar_links ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view topbar links"
  ON topbar_links
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only global admins can manage topbar links"
  ON topbar_links
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_global_admin = true
    )
  );

-- Create index for ordering
CREATE INDEX topbar_links_order_idx ON topbar_links("order");