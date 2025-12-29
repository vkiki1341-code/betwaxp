-- Backfill the 'result' column in bets using the match_results table
-- This will update all bets that have a NULL result but a matching final match result

UPDATE bets b
SET result = mr.result
FROM match_results mr
WHERE b.match_id = mr.match_id
  AND b.result IS NULL
  AND mr.result IS NOT NULL
  AND mr.is_final = 'yes';

-- Optionally, fallback to home_goals-away_goals if result is still null but goals are present
UPDATE bets b
SET result = CONCAT(mr.home_goals, '-', mr.away_goals)
FROM match_results mr
WHERE b.match_id = mr.match_id
  AND b.result IS NULL
  AND mr.is_final = 'yes'
  AND mr.home_goals IS NOT NULL
  AND mr.away_goals IS NOT NULL;