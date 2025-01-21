/*
  # Add Default Social Media Links

  1. Changes
    - Add default social media links to topbar_links table
    - Include common platforms like GitHub, LinkedIn, Twitter/X, Instagram
    - Set appropriate Lucide icon names
    - Order links sequentially

  2. Notes
    - Uses Lucide icon names that match each platform
    - Links are set as social media type (is_social = true)
    - URLs are placeholders to be updated by admins
*/

-- Insert default social media links
INSERT INTO topbar_links (name, url, icon_name, "order", is_social)
VALUES 
  ('GitHub', 'https://github.com', 'Github', 0, true),
  ('LinkedIn', 'https://linkedin.com', 'Linkedin', 1, true),
  ('Twitter', 'https://twitter.com', 'Twitter', 2, true),
  ('Instagram', 'https://instagram.com', 'Instagram', 3, true),
  ('YouTube', 'https://youtube.com', 'Youtube', 4, true),
  ('Facebook', 'https://facebook.com', 'Facebook', 5, true),
  ('Discord', 'https://discord.com', 'MessageSquare', 6, true),
  ('RSS Feed', 'https://example.com/feed', 'Rss', 7, true)
ON CONFLICT DO NOTHING;