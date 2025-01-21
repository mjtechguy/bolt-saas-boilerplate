/*
  # Enhance profiles with avatar and display name

  1. Changes
    - Add avatar_url column to store profile images
    - Add display_name column for user's display name
    - Set default display names based on email addresses
*/

-- Add new columns to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS display_name text;

-- Update existing profiles to have a display_name based on email
UPDATE profiles 
SET display_name = SPLIT_PART(email, '@', 1)
WHERE display_name IS NULL;