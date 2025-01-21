/*
  # Add OTP Support

  1. Changes
    - Add `has_otp_enabled` column to profiles table
    - Set default value to false for existing profiles
    - Make column non-nullable

  2. Security
    - No changes to RLS policies needed as this column is protected by existing profile policies
*/

-- Add OTP column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS has_otp_enabled boolean DEFAULT false;

-- Update existing profiles to have OTP disabled
UPDATE profiles
SET has_otp_enabled = false
WHERE has_otp_enabled IS NULL;

-- Make the column non-nullable after setting defaults
ALTER TABLE profiles
ALTER COLUMN has_otp_enabled SET NOT NULL;