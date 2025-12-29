import { chunkArray } from "../utils/chunkArray";


import { supabase } from "./supabaseClient";

export interface FixtureOutcome {
  match_id: string;
  home_goals: number;
  away_goals: number;
  result: string; // e.g. '5-0'
  winner?: string; // 'home' | 'away' | 'draw'
  home_team?: string;
  away_team?: string;
}

/**
 * Save a fixture outcome globally to Supabase
 * This makes it visible to all users
 */
export async function saveFixtureOutcomeGlobal(outcome: FixtureOutcome) {
  try {
    const payload: any = {
      match_id: outcome.match_id,
      home_goals: outcome.home_goals,
      away_goals: outcome.away_goals,
      result: outcome.result,
      updated_at: new Date().toISOString(),
    };
    if (outcome.winner) payload.winner = outcome.winner;
    if (outcome.home_team) payload.home_team = outcome.home_team;
    if (outcome.away_team) payload.away_team = outcome.away_team;

    // Try update first
    const { data: updateData, error: updateError } = await supabase
      .from('fixture_outcomes')
      .update(payload)
      .eq('match_id', outcome.match_id)
      .select();
    if (updateError) {
      console.warn('Update failed:', updateError, 'for match_id:', outcome.match_id);
    }
    if (Array.isArray(updateData) && updateData.length > 0) {
      console.log('✅ Fixture outcome updated globally:', outcome);
      return updateData;
    }

    // If update did not affect any rows, try insert
    const { data: insertData, error: insertError } = await supabase
      .from('fixture_outcomes')
      .insert([payload])
      .select();
    if (insertError) {
      // Check for duplicate key error and handle gracefully
      if (insertError.code === '23505') {
        console.warn('Duplicate match_id, row already exists for match_id:', outcome.match_id);
        return null;
      }
      console.error('❌ Failed to save fixture outcome globally:', insertError, 'for match_id:', outcome.match_id);
      return null;
    }
    console.log('✅ Fixture outcome inserted globally:', outcome);
    return insertData;
  } catch (err) {
    console.error('Exception saving fixture outcome:', err);
    return null;
  }
}

/**
 * Get a fixture outcome from Supabase
 */
export async function getFixtureOutcome(matchId: string) {
  try {
    const { data, error } = await supabase
      .from('fixture_outcomes')
      .select('*')
      .eq('match_id', matchId)
      .single();
    if (error) {
      console.warn('Failed to fetch fixture outcome:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('Exception fetching fixture outcome:', err);
    return null;
  }
}

/**
 * Get all fixture outcomes for a league/week
 */

export async function getFixtureOutcomesForWeek(matchIds: string[]) {
  try {
    console.log('[DEBUG] getFixtureOutcomesForWeek matchIds:', matchIds);
    if (!Array.isArray(matchIds) || matchIds.length === 0 || matchIds.some(id => !id || typeof id !== 'string')) {
      console.warn('⚠️ Empty or invalid matchIds — skipping fetch');
      return [];
    }
    // Use chunking utility and smaller chunk size
    const CHUNK_SIZE = 20;
    const chunks = chunkArray(matchIds, CHUNK_SIZE);
    const results: FixtureOutcome[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const batch = chunks[i];
      try {
        const { data, error, status } = await supabase
          .from('fixture_outcomes')
          .select('*')
          .in('match_id', batch);
        console.log(`[FETCH OUTCOMES] Batch ${i}`, { batch, data, error, status });
        if (error) {
          console.warn(`Chunk ${i} failed:`, error, 'Status:', status);
        } else if (Array.isArray(data)) {
          results.push(...data);
        }
      } catch (err) {
        console.error(`Chunk ${i} error:`, err);
      }
    }
    console.log('[FETCH OUTCOMES] All results:', results);
    return results;
  } catch (err) {
    console.error('Exception fetching fixture outcomes:', err);
    return [];
  }
}

/**
 * Subscribe to fixture outcome changes (realtime)
 * This allows the UI to update immediately when outcomes change
 */
// Realtime subscriptions are not supported with direct REST API fetch
// You may need to reimplement this with polling or use the supabase-js client if needed
export function subscribeToFixtureOutcome() {
  console.warn('subscribeToFixtureOutcome is not supported with hardcoded REST API fetch.');
  return null;
}