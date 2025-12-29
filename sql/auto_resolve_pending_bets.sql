-- Scheduled function to auto-resolve all stuck pending bets
CREATE OR REPLACE FUNCTION auto_resolve_pending_bets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bet RECORD;
BEGIN
  FOR v_bet IN
    SELECT b.id, b.match_id
    FROM bets b
    JOIN match_results r ON b.match_id = r.match_id AND r.is_final = 'yes'
    WHERE b.status = 'pending'
  LOOP
    -- Move bet to resolving
    UPDATE bets
    SET status = 'resolving', updated_at = NOW()
    WHERE id = v_bet.id;
  END LOOP;
END;
$$;

-- To run this automatically, schedule with pg_cron or Supabase Edge Functions:
-- SELECT auto_resolve_pending_bets();
-- Or schedule: SELECT cron.schedule('*/1 * * * *', $$SELECT auto_resolve_pending_bets();$$);
