-- Migration: Add require_manual_approval settings to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS require_manual_approval BOOLEAN DEFAULT TRUE;
