-- Supabase RLS policy: Allow read for all users on fixture_outcomes
-- Run this SQL in the Supabase SQL editor

-- Enable RLS if not already enabled
ALTER TABLE fixture_outcomes ENABLE ROW LEVEL SECURITY;

-- Create policy to allow select for all users
CREATE POLICY "Allow read for all users" ON fixture_outcomes
FOR SELECT
USING (true);