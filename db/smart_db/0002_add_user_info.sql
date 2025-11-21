-- Migration: Add user info fields to users table
-- Created: 2025-11-20

-- Add email, first_name, and last_name to users table
ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN first_name TEXT;
ALTER TABLE users ADD COLUMN last_name TEXT;
