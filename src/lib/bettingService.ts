import { supabase } from '@/lib/supabaseClient';
import { logAuditAction } from '@/lib/auditLog';

export interface BetToBePlaced {
  match_id: string;
  bet_type: string;
  selection: string;
  amount: number;
  odds: number;
  complited?: 'yes' | 'no' | boolean;
  status?: 'pending' | 'won' | 'lost' | string;
  is_final?: 'yes' | 'no' | boolean;
}

export interface PlaceBetsResult {
  status: 'ok' | 'insufficient_balance' | 'failed' | 'invalid_bets';
  new_balance?: number;
  bets_placed?: number;
  stake_deducted?: number;
  error?: string;
  current_balance?: number;
  required_stake?: number;
  bets_inserted?: number;
}

/**
 * Place bets using atomic RPC function
 * This ensures either ALL bets are placed or NONE are placed (atomic transaction)
 *
 * @param userId - User ID placing the bets
 * @param bets - Array of bets to place
 * @returns PlaceBetsResult with status and new balance
 */
export async function placeBetsAtomic(
  userId: string,
  bets: BetToBePlaced[]
): Promise<PlaceBetsResult> {
  if (!userId) {
    return {
      status: 'failed',
      error: 'User not authenticated',
    };
  }


  if (!bets || bets.length === 0) {
    return {
      status: 'invalid_bets',
      error: 'No bets to place',
    };
  }

  // Reject any bet with missing, empty, or 'default' bet_type
  const invalidBet = bets.find(bet => {
    const type = (bet.bet_type || '').trim().toLowerCase();
    return !type || type === 'default';
  });
  if (invalidBet) {
    return {
      status: 'invalid_bets',
      error: 'One or more bets have no valid bet type specified',
    };
  }

  // Calculate total stake
  const totalStake = bets.reduce((sum, bet) => sum + bet.amount, 0);

  try {
    // Format bets for RPC (convert to snake_case to match SQL)
    const formattedBets = bets.map((bet) => {
      const obj: any = {
        match_id: bet.match_id,
        bet_type: bet.bet_type,
        selection: bet.selection,
        amount: bet.amount,
        odds: bet.odds,
        complited: 'no',
        is_final: 'no',
        status: 'pending', // Default to pending
      };
      // Only send status as 'won' or 'lost' if explicitly completed
      if (bet.complited === 'yes' && (bet.status === 'won' || bet.status === 'lost')) {
        obj.status = bet.status;
        obj.complited = 'yes';
        obj.is_final = 'yes';
      }
      // Only send required columns
      const allowedColumns = [
        'match_id', 'bet_type', 'selection', 'amount', 'odds', 'complited', 'is_final', 'status'
      ];
      Object.keys(obj).forEach((key) => {
        if (!allowedColumns.includes(key)) {
          delete obj[key];
        }
      });
      return obj;
    });

    // Call the atomic RPC function
    const { data, error } = await supabase.rpc('place_bets_atomic', {
      user_id_param: userId,
      bets_param: formattedBets,
      total_stake_param: totalStake,
    });

    if (error) {
      console.error('RPC Error:', error);
      return {
        status: 'failed',
        error: error.message || 'Failed to place bets',
      };
    }

    // Check if RPC returned an error in the response
    if (data?.error) {
      console.warn('RPC returned error:', data.error);
      return {
        status: data.status || 'failed',
        error: data.error,
        current_balance: data.current_balance,
        required_stake: data.required_stake,
      };
    }

    // Log successful bet placement
    if (data?.status === 'ok') {
      await logAuditAction(userId, {
        action: 'bet_placed',
        details: {
          bet_count: bets.length,
          total_stake: totalStake,
          new_balance: data.new_balance,
        },
        status: 'success',
      });
    }

    return data as PlaceBetsResult;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Bet placement error:', errorMessage);

    // Log failed bet placement
    await logAuditAction(userId, {
      action: 'bet_placed',
      details: {
        bet_count: bets.length,
        total_stake: totalStake,
      },
      status: 'failed',
      errorMessage,
    });

    return {
      status: 'failed',
      error: errorMessage,
    };
  }
}

/**
 * Alternative: Use the validated version that checks all bets before inserting
 */
export async function placeBetsValidated(
  userId: string,
  bets: BetToBePlaced[]
): Promise<PlaceBetsResult> {
  if (!userId) {
    return {
      status: 'failed',
      error: 'User not authenticated',
    };
  }

  if (!bets || bets.length === 0) {
    return {
      status: 'invalid_bets',
      error: 'No bets to place',
    };
  }

  const totalStake = bets.reduce((sum, bet) => sum + bet.amount, 0);

  try {
    const formattedBets = bets.map((bet) => {
      // Always send is_final and complited as 'yes'/'no' strings
      let isFinalStr: 'yes' | 'no' = 'no';
      if (bet.is_final === true || bet.is_final === 'yes') isFinalStr = 'yes';
      else if (bet.is_final === false || bet.is_final === 'no') isFinalStr = 'no';
      else if (typeof bet.is_final === 'string') isFinalStr = bet.is_final === 'yes' ? 'yes' : 'no';

      let complitedStr: 'yes' | 'no' = 'no';
      if (bet.complited === true || bet.complited === 'yes') complitedStr = 'yes';
      else if (bet.complited === false || bet.complited === 'no') complitedStr = 'no';
      else if (typeof bet.complited === 'string') complitedStr = bet.complited === 'yes' ? 'yes' : 'no';

      const obj: any = {
        match_id: bet.match_id,
        bet_type: bet.bet_type,
        selection: bet.selection,
        amount: bet.amount,
        odds: bet.odds,
        complited: complitedStr,
        is_final: isFinalStr,
      };
      // Only send status if complited is 'yes'
      if (complitedStr === 'yes' && (bet.status === 'won' || bet.status === 'lost')) {
        obj.status = bet.status;
        obj.complited = 'yes';
        obj.is_final = 'yes';
      } else if (bet.status === 'won' || bet.status === 'lost') {
        // If not completed, do not allow 'won' or 'lost' status
        obj.status = 'pending';
      }
      // Only send required columns
      const allowedColumns = [
        'match_id', 'bet_type', 'selection', 'amount', 'odds', 'complited', 'is_final', 'status'
      ];
      Object.keys(obj).forEach((key) => {
        if (!allowedColumns.includes(key)) {
          delete obj[key];
        }
      });
      return obj;
    });

    // Call the validated RPC function
    const { data, error } = await supabase.rpc('place_bets_validated', {
      user_id_param: userId,
      bets_param: formattedBets,
      total_stake_param: totalStake,
      min_stake_param: 50, // Minimum stake
    });

    if (error) {
      console.error('RPC Error:', error);
      return {
        status: 'failed',
        error: error.message || 'Failed to place bets',
      };
    }

    if (data?.error) {
      return {
        status: data.status || 'failed',
        error: data.error,
      };
    }

    if (data?.status === 'success') {
      await logAuditAction(userId, {
        action: 'bet_placed',
        details: {
          bet_count: bets.length,
          total_stake: totalStake,
          new_balance: data.new_balance,
        },
        status: 'success',
      });
    }

    return data as PlaceBetsResult;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Bet placement error:', errorMessage);

    await logAuditAction(userId, {
      action: 'bet_placed',
      details: { bet_count: bets.length, total_stake: totalStake },
      status: 'failed',
      errorMessage,
    });

    return {
      status: 'failed',
      error: errorMessage,
    };
  }
}

/**
 * Validate bet array before placement
 */
export function validateBetsBeforePlacement(bets: BetToBePlaced[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!Array.isArray(bets) || bets.length === 0) {
    errors.push('No bets to place');
    return { valid: false, errors };
  }

  bets.forEach((bet, index) => {
    // Check required fields
    if (!bet.match_id) {
      errors.push(`Bet ${index}: Missing match ID`);
    }
    if (!bet.bet_type) {
      errors.push(`Bet ${index}: Missing bet type`);
    }
    if (!bet.selection) {
      errors.push(`Bet ${index}: Missing selection`);
    }

    // Check amounts
    if (typeof bet.amount !== 'number' || bet.amount <= 0) {
      errors.push(`Bet ${index}: Invalid amount`);
    }
    if (bet.amount < 50) {
      errors.push(`Bet ${index}: Minimum stake is 50 KES`);
    }

    // Check odds
    if (typeof bet.odds !== 'number' || bet.odds <= 0) {
      errors.push(`Bet ${index}: Invalid odds`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format bets for display
 */
export function formatBet(bet: BetToBePlaced): string {
  return `${bet.selection} @ ${bet.odds.toFixed(2)} (${bet.amount} KES)`;
}
