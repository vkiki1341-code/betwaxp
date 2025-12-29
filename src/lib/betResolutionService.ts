import { supabase } from "@/lib/supabaseClient";
import { calculateBetResult, BetData } from "../betResolution";

export interface MatchResult {
  match_id: string;
  home_goals: number;
  away_goals: number;
  is_final: 'yes' | 'no';
}

export interface BetResolutionResult {
  bet_id: string;
  match_id: string;
  status: 'won' | 'lost';
  winnings: number;
  user_id: string;
}

export class BetResolutionService {
  private static instance: BetResolutionService;
  private resolvingMatches = new Set<string>();

  static getInstance(): BetResolutionService {
    if (!BetResolutionService.instance) {
      BetResolutionService.instance = new BetResolutionService();
    }
    return BetResolutionService.instance;
  }

  // Public method: Force resolve a match (create result if missing, then resolve bets)
  async forceResolveMatch(matchId: string): Promise<BetResolutionResult[]> {
    // Try to get a final result
    let matchResult = await this.getMatchResult(matchId);
    if (!matchResult) {
      // Try to get match data
      const { data: matchData } = await supabase
        .from('matches')
        .select('status, home_score, away_score')
        .eq('id', matchId)
        .single();
      if (matchData?.status === 'completed' || matchData?.status === 'finished') {
        // Insert a final result with full schema
        const now = new Date().toISOString();
        const homeGoals = matchData.home_score || 0;
        const awayGoals = matchData.away_score || 0;
        const resultString = `${homeGoals}-${awayGoals}`;
        const insertPayload = {
          match_id: matchId,
          home_goals: homeGoals,
          away_goals: awayGoals,
          result: resultString,
          winner: homeGoals > awayGoals ? 'home' : homeGoals < awayGoals ? 'away' : 'draw',
          is_final: 'yes', // string per schema
          complited: 'yes', // string per schema
          is_locked: true,
          match_duration: 90,
          created_at: now,
          updated_at: now,
        };
        // Only send required columns
        const allowedColumns = [
          'match_id', 'home_goals', 'away_goals', 'result', 'winner', 'is_final', 'complited', 'is_locked', 'match_duration', 'created_at', 'updated_at'
        ];
        Object.keys(insertPayload).forEach((key) => {
          if (!allowedColumns.includes(key)) {
            delete insertPayload[key];
          }
        });
        const { error: insertError } = await supabase
          .from('match_results')
          .insert(insertPayload);
        if (insertError) {
          console.error('Failed to insert final result for force resolve:', insertError);
          return [];
        }
        // Fetch the new result
        matchResult = await this.getMatchResult(matchId);
      } else {
        console.warn('Cannot force resolve: match is not completed/finished');
        return [];
      }
    }
    // Now resolve all bets
    return this.resolveMatchImmediately(matchId);
  }

  // Main resolution function - call this when a match has results
  async resolveMatchImmediately(matchId: string): Promise<BetResolutionResult[]> {
    if (this.resolvingMatches.has(matchId)) {
      console.log(`⏳ Match ${matchId} already being resolved`);
      return [];
    }

    this.resolvingMatches.add(matchId);
    const results: BetResolutionResult[] = [];

    try {
      console.log(`⚡ [IMMEDIATE RESOLUTION] Starting for match ${matchId}`);
      
      // 1. Get the match result
      const matchResult = await this.getMatchResult(matchId);
      if (!matchResult) {
        console.log(`❌ No result found for match ${matchId}`);
        return [];
      }

      console.log(`✅ Match ${matchId} result: ${matchResult.home_goals}-${matchResult.away_goals}`);

      // 2. Get all pending bets for this match
      const pendingBets = await this.getPendingBetsForMatch(matchId);
      if (pendingBets.length === 0) {
        console.log(`✅ No pending bets for match ${matchId}`);
        return [];
      }

      console.log(`📊 Resolving ${pendingBets.length} bets for match ${matchId}`);

      // 3. Resolve each bet
      for (const bet of pendingBets) {
        const resolution = await this.resolveSingleBet(bet, matchResult);
        if (resolution) {
          results.push(resolution);
        }
      }

      // 4. Update user balances
      if (results.length > 0) {
        await this.updateUserBalances(results);
      }

      console.log(`🎉 Successfully resolved ${results.length} bets for match ${matchId}`);

    } catch (error) {
      console.error(`❌ Error resolving match ${matchId}:`, error);
    } finally {
      this.resolvingMatches.delete(matchId);
    }

    return results;
  }

  // Helper: Get match result
  private async getMatchResult(matchId: string): Promise<MatchResult | null> {
    try {
      const { data, error } = await supabase
        .from('match_results')
        .select('*')
        .eq('match_id', matchId)
        .eq('is_final', 'yes')
        .single();

      if (error) {
        // If no final result, check if match is marked as completed
        const { data: matchData } = await supabase
          .from('matches')
          .select('status, home_score, away_score')
          .eq('id', matchId)
          .single();

        if (matchData?.status === 'completed' || matchData?.status === 'finished') {
          // Create a result from match data
          return {
            match_id: matchId,
            home_goals: matchData.home_score || 0,
            away_goals: matchData.away_score || 0,
            is_final: 'yes'
          };
        }
        return null;
      }

      return data as MatchResult;
    } catch (err) {
      console.error('Error getting match result:', err);
      return null;
    }
  }

  // Helper: Get pending bets
  private async getPendingBetsForMatch(matchId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('bets')
      .select('*')
      .eq('match_id', matchId)
      .eq('status', 'pending');

    if (error) {
      console.error('Error fetching pending bets:', error);
      return [];
    }

    return data || [];
  }

  // Helper: Resolve a single bet
  private async resolveSingleBet(bet: any, matchResult: MatchResult): Promise<BetResolutionResult | null> {
    try {
      const isWon = this.determineBetOutcome(bet, matchResult);
      const status = isWon ? 'won' : 'lost';
      const winnings = isWon ? this.calculateWinnings(bet) : 0;

      // Only set status to 'won' or 'lost' if complited is 'yes' and is_final is 'yes'
      const updateFields: any = {
        resolved_at: new Date().toISOString(),
        is_final: 'yes',
        complited: 'yes',
      };
      if (status === 'won' || status === 'lost') {
        updateFields.status = status;
      }
      // Only send required columns
      const allowedColumns = [
        'resolved_at', 'is_final', 'complited', 'status'
      ];
      Object.keys(updateFields).forEach((key) => {
        if (!allowedColumns.includes(key)) {
          delete updateFields[key];
        }
      });
      console.log('[bets UPDATE payload]', updateFields);
      const { error } = await supabase
        .from('bets')
        .update(updateFields)
        .eq('id', bet.id);

      if (error) {
        console.error(`❌ Failed to update bet ${bet.id}:`, error);
        return null;
      }

      console.log(`✅ Bet ${bet.id} resolved as ${status}`);

      return {
        bet_id: bet.id,
        match_id: matchResult.match_id,
        status: status,
        winnings: winnings,
        user_id: bet.user_id
      };

    } catch (err) {
      console.error(`Error resolving bet ${bet.id}:`, err);
      return null;
    }
  }

  // Helper: Determine if bet is won (now supports all bet types via calculateBetResult)
  private determineBetOutcome(bet: any, matchResult: MatchResult): boolean {
    // Compose BetData for calculateBetResult
    const betData: BetData = {
      selection: bet.selection,
      bet_type: bet.bet_type,
      home_goals: matchResult.home_goals,
      away_goals: matchResult.away_goals,
      // Add more fields if needed (e.g., first_goal_time, half_time_home_goals, etc.)
      first_goal_time: bet.first_goal_time,
      half_time_home_goals: bet.half_time_home_goals,
      half_time_away_goals: bet.half_time_away_goals,
      is_final: matchResult.is_final === 'yes',
    };
    const result = calculateBetResult(betData);
    return result === 'won';
  }

  // Helper: Calculate winnings
  private calculateWinnings(bet: any): number {
    const odds = parseFloat(bet.odds) || 1;
    const stake = parseFloat(bet.stake) || 0;
    return Math.round(odds * stake * 100) / 100; // Round to 2 decimal places
  }

  // Helper: Update user balances
  private async updateUserBalances(resolutions: BetResolutionResult[]): Promise<void> {
    const userId = resolutions[0]?.user_id;
    if (!userId) return;

    // Calculate total winnings
    const totalWinnings = resolutions
      .filter(r => r.status === 'won')
      .reduce((sum, r) => sum + r.winnings, 0);

    if (totalWinnings > 0) {
      // Update user balance
      const { error } = await supabase.rpc('increment_user_balance', {
        user_id: userId,
        amount: totalWinnings
      });

      if (error) {
        console.error('Error updating user balance:', error);
      } else {
        console.log(`💰 Updated user ${userId} balance by +${totalWinnings}`);
      }
    }
  }

  // Public method to check and resolve all stuck matches
  async resolveAllStuckMatches(): Promise<number> {
    try {
      console.log('🔄 Checking for matches with pending bets...');
      
      // Get all matches with pending bets
      const { data: pendingMatches } = await supabase
        .from('bets')
        .select('match_id')
        .eq('status', 'pending')
        .not('match_id', 'is', null);

      // Deduplicate match_ids
      const uniqueMatches = pendingMatches
        ? Array.from(new Set(pendingMatches.map((row: any) => row.match_id))).map(match_id => ({ match_id }))
        : [];

      if (!uniqueMatches || uniqueMatches.length === 0) {
        console.log('✅ No matches with pending bets found');
        return 0;
      }

      console.log(`🔍 Found ${uniqueMatches.length} matches with pending bets`);

      let totalResolved = 0;
      
      // Resolve each match
      for (const { match_id } of uniqueMatches) {
        const results = await this.resolveMatchImmediately(match_id);
        totalResolved += results.length;
      }

      console.log(`🎉 Resolved ${totalResolved} bets across ${uniqueMatches.length} matches`);
      return totalResolved;

    } catch (error) {
      console.error('Error resolving stuck matches:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const betResolutionService = BetResolutionService.getInstance();
