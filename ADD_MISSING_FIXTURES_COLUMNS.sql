-- Add missing columns to fixtures table if they do not exist
ALTER TABLE fixtures
ADD COLUMN IF NOT EXISTS country_code VARCHAR(16),
ADD COLUMN IF NOT EXISTS week INTEGER,
ADD COLUMN IF NOT EXISTS match_idx INTEGER,
ADD COLUMN IF NOT EXISTS home_team VARCHAR(64),
ADD COLUMN IF NOT EXISTS away_team VARCHAR(64),
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
-- id column is usually the primary key, add if missing
ALTER TABLE fixtures
ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid() PRIMARY KEY;