-- Function to resolve a single stuck bet
CREATE OR REPLACE FUNCTION resolve_single_bet(bet_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bet RECORD;
  v_match_result RECORD;
BEGIN
  -- Get the bet and its match
  SELECT b.*, m.id as match_id, m.status as match_status
  INTO v_bet
  FROM bets b
  LEFT JOIN matches m ON b.match_id = m.id
  WHERE b.id = bet_id;
  
  IF v_bet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Bet not found');
  END IF;
  
  -- Get match result
  SELECT * INTO v_match_result
  FROM match_results
  WHERE match_id = v_bet.match_id
    AND is_final = 'yes';
  
  -- If no result but match is completed, create a default result
  IF v_match_result IS NULL AND v_bet.match_status = 'completed' THEN
    -- Create a default result (this should be replaced with your actual logic)
    INSERT INTO match_results (match_id, home_goals, away_goals, is_final)
    VALUES (v_bet.match_id, 1, 1, true)
    RETURNING * INTO v_match_result;
  END IF;
  
  IF v_match_result IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No result available');
  END IF;
  
  -- Update the bet based on result (simplified logic)
  -- You should replace this with your actual bet resolution logic
  UPDATE bets
  SET 
    status = 'won', -- This should be determined by actual bet rules
    updated_at = NOW()
  WHERE id = bet_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Bet resolved',
    'bet_id', bet_id,
    'new_status', 'won'
  );
END;
$$;
