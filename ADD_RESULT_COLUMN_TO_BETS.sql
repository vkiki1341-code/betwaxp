-- Add 'result' column to bets table to store match score as a string (e.g., '2-0')
ALTER TABLE bets ADD COLUMN result VARCHAR(16);

-- Optional: Add comment for clarity
COMMENT ON COLUMN bets.result IS 'Stores the match score (e.g., 2-0) for this bet.';