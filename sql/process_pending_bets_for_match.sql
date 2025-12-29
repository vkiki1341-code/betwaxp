-- Function to process all pending bets for a match
CREATE OR REPLACE FUNCTION process_pending_bets_for_match(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_match_result RECORD;
  v_bets_to_process UUID[];
BEGIN
  -- Get the match result
  SELECT * INTO v_match_result
  FROM match_results
  WHERE match_id = p_match_id
    AND is_final = 'yes';
  
  IF v_match_result IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No final result found for match',
      'processed', 0
    );
  END IF;
  
  -- Get all pending bets for this match
  SELECT array_agg(id) INTO v_bets_to_process
  FROM bets
  WHERE match_id = p_match_id
    AND status = 'pending';
  
  -- Update bets to resolving status
  UPDATE bets
  SET 
    status = 'resolving',
    updated_at = NOW()
  WHERE id = ANY(v_bets_to_process);
  
  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Bets marked for resolution',
    'processed', array_length(v_bets_to_process, 1),
    'match_result', jsonb_build_object(
      'home_goals', v_match_result.home_goals,
      'away_goals', v_match_result.away_goals
    )
  );
END;
$$;
