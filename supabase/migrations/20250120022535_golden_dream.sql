-- Drop existing topbar_links table
DROP TABLE IF EXISTS topbar_links;

-- Create new topbar_links table with hierarchical support
CREATE TABLE topbar_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text,
  icon_name text NOT NULL,
  parent_id uuid REFERENCES topbar_links(id) ON DELETE CASCADE,
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

-- Create indexes for performance
CREATE INDEX topbar_links_parent_id_idx ON topbar_links(parent_id);
CREATE INDEX topbar_links_order_idx ON topbar_links("order");

-- Create function to get full link path
CREATE OR REPLACE FUNCTION get_link_path(link_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  url text,
  icon_name text,
  parent_id uuid,
  "order" integer,
  level integer
) AS $$
WITH RECURSIVE link_tree AS (
  -- Base case: start with the given link
  SELECT 
    l.id,
    l.name,
    l.url,
    l.icon_name,
    l.parent_id,
    l."order",
    0 as level
  FROM topbar_links l
  WHERE l.id = link_id

  UNION ALL

  -- Recursive case: get all parents
  SELECT
    p.id,
    p.name,
    p.url,
    p.icon_name,
    p.parent_id,
    p."order",
    t.level + 1
  FROM topbar_links p
  INNER JOIN link_tree t ON t.parent_id = p.id
)
SELECT * FROM link_tree ORDER BY level DESC;
$$ LANGUAGE sql STABLE;

-- Create function to get all children of a link
CREATE OR REPLACE FUNCTION get_link_children(parent_link_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  url text,
  icon_name text,
  parent_id uuid,
  "order" integer,
  level integer
) AS $$
WITH RECURSIVE link_tree AS (
  -- Base case: start with immediate children
  SELECT 
    l.id,
    l.name,
    l.url,
    l.icon_name,
    l.parent_id,
    l."order",
    1 as level
  FROM topbar_links l
  WHERE l.parent_id = parent_link_id

  UNION ALL

  -- Recursive case: get all descendants
  SELECT
    c.id,
    c.name,
    c.url,
    c.icon_name,
    c.parent_id,
    c."order",
    t.level + 1
  FROM topbar_links c
  INNER JOIN link_tree t ON t.id = c.parent_id
)
SELECT * FROM link_tree ORDER BY level, "order";
$$ LANGUAGE sql STABLE;

-- Create function to reorder siblings
CREATE OR REPLACE FUNCTION reorder_siblings()
RETURNS TRIGGER AS $$
BEGIN
  -- Update order of siblings when a link is inserted or updated
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.parent_id IS DISTINCT FROM NEW.parent_id) THEN
    WITH numbered AS (
      SELECT 
        id,
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
          ORDER BY "order", created_at
        ) * 10 as new_order
      FROM topbar_links
      WHERE COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid) = 
            COALESCE(NEW.parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
    )
    UPDATE topbar_links
    SET "order" = numbered.new_order
    FROM numbered
    WHERE topbar_links.id = numbered.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for reordering
CREATE TRIGGER reorder_siblings_trigger
  AFTER INSERT OR UPDATE OF parent_id ON topbar_links
  FOR EACH ROW
  EXECUTE FUNCTION reorder_siblings();

-- Insert some example navigation links
INSERT INTO topbar_links (name, url, icon_name, parent_id, "order", is_social) VALUES
  -- Main navigation items
  ('Documentation', NULL, 'BookOpen', NULL, 10, false),
  ('Resources', NULL, 'Folder', NULL, 20, false),
  ('Community', NULL, 'Users', NULL, 30, false),
  
  -- Documentation sub-items
  ('Getting Started', '/docs/getting-started', 'Play', (SELECT id FROM topbar_links WHERE name = 'Documentation' LIMIT 1), 10, false),
  ('API Reference', '/docs/api', 'Code2', (SELECT id FROM topbar_links WHERE name = 'Documentation' LIMIT 1), 20, false),
  ('Tutorials', '/docs/tutorials', 'GraduationCap', (SELECT id FROM topbar_links WHERE name = 'Documentation' LIMIT 1), 30, false),
  
  -- Resources sub-items
  ('Blog', '/blog', 'FileText', (SELECT id FROM topbar_links WHERE name = 'Resources' LIMIT 1), 10, false),
  ('Case Studies', '/case-studies', 'Briefcase', (SELECT id FROM topbar_links WHERE name = 'Resources' LIMIT 1), 20, false),
  ('Downloads', '/downloads', 'Download', (SELECT id FROM topbar_links WHERE name = 'Resources' LIMIT 1), 30, false),
  
  -- Community sub-items
  ('Forums', '/forums', 'MessageSquare', (SELECT id FROM topbar_links WHERE name = 'Community' LIMIT 1), 10, false),
  ('Discord', 'https://discord.gg/example', 'MessageCircle', (SELECT id FROM topbar_links WHERE name = 'Community' LIMIT 1), 20, false),
  ('GitHub', 'https://github.com/example', 'Github', (SELECT id FROM topbar_links WHERE name = 'Community' LIMIT 1), 30, false);

-- Insert social media links
INSERT INTO topbar_links (name, url, icon_name, "order", is_social) VALUES
  ('GitHub', 'https://github.com', 'Github', 10, true),
  ('Twitter', 'https://twitter.com', 'Twitter', 20, true),
  ('LinkedIn', 'https://linkedin.com', 'Linkedin', 30, true),
  ('Discord', 'https://discord.com', 'MessageSquare', 40, true);