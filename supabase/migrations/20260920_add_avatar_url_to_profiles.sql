-- Add avatar_url to profiles table to support profile image upload
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
