/*
  # Remove Default Social Media Links

  1. Changes
    - Remove default social media links from topbar_links table
    - Keep the table structure intact
*/

-- Remove all existing links
DELETE FROM topbar_links;