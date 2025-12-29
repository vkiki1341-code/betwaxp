// ...existing code...

// Move all React usage below imports
// Extend Window interface for global debug/system state
declare global {
  interface Window {
    __GLOBAL_SYSTEM_STATE?: { 
      fixtureSalt?: string;
      fixtureSetIdx?: number;
      currentTimeframeIdx?: number;
    };
  }
}
// TypeScript: Extend window for debug properties
declare global {
  interface Window {
    __DEBUG_CURRENT_WEEK?: number;
    __DEBUG_FIXTURE_SET_IDX?: number;
    __DEBUG_LEAGUE?: any;
    leagues?: any[];
  }
}
export {};
// --- DEBUG: Fixture Uniqueness Test Button ---
function FixtureUniquenessTestButton({ league, getFixtureSet }) {
  const [result, setResult] = React.useState(null);
  const handleTest = () => {
    if (!league || !league.teams || !league.name) {
      setResult('❌ League data is missing or invalid.');
      return;
    }
    const NUM_SEASONS = 20;
    const salt = '';
    const seen = new Set();
    let lastFixtureSet = null;
    let allUnique = true;
    let message = '';
    for (let setIdx = 0; setIdx < NUM_SEASONS; setIdx++) {
      const fixtureSet = getFixtureSet(league, setIdx, salt);
      const hash = JSON.stringify(fixtureSet);
      if (seen.has(hash)) {
        message += `❌ Repeat detected at season ${setIdx + 1}\n`;
        allUnique = false;
        break;
      }
      seen.add(hash);
      if (lastFixtureSet && hash === JSON.stringify(lastFixtureSet)) {
        message += `❌ Fixtures did not change between season ${setIdx} and ${setIdx + 1}\n`;
        allUnique = false;
        break;
      }
      lastFixtureSet = fixtureSet;
      message += `✅ Season ${setIdx + 1} fixtures are unique.\n`;
    }
    if (allUnique) {
      message += `\n🎉 All ${NUM_SEASONS} seasons have unique fixture sets for league: ${league.name}`;
    } else {
      message += '\n❌ Duplicate fixture sets found!';
    }
    setResult(message);
  };
  return (
    <div style={{ margin: '10px 0' }}>
      <button style={{ display: 'none' }}>
        Debug: Test Fixture Uniqueness
      </button>
      {result && (
        <pre style={{ background: '#111', color: '#0f0', padding: '10px', borderRadius: '6px', marginTop: '10px', maxWidth: 600, whiteSpace: 'pre-wrap' }}>{result}</pre>
      )}
    </div>
  );
}
// ...existing code...


// ...existing code...

// Hide '📊 View Match History' button by setting style display: none
// If you have a button like:
// <button>📊 View Match History</button>
// Change to:
// <button style={{ display: 'none' }}>📊 View Match History</button>

// --- Queue-based approach to prevent concurrent writes to match_results ---
class MatchResultQueue {
  queue: Map<string, { homeGoals: number; awayGoals: number; winner: string; week: number }> = new Map();
  processing: boolean = false;

  add(matchId: string, homeGoals: number, awayGoals: number, winner: string, week: number) {
    this.queue.set(matchId, { homeGoals, awayGoals, winner, week });
    if (!this.processing) {
      this.process();
    }
  }

  async process() {
    if (this.processing || this.queue.size === 0) return;
    this.processing = true;
    for (const [matchId, data] of this.queue) {
      try {
        await this.saveToDatabase(matchId, data.homeGoals, data.awayGoals, data.winner, data.week);
        this.queue.delete(matchId);
      } catch (error) {
        console.error(`Failed to save ${matchId}:`, error);
        // Keep in queue for retry
      }
      // Small delay between saves
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    this.processing = false;
    // If more items were added while processing, process again
    if (this.queue.size > 0) {
      setTimeout(() => this.process(), 100);
    }
  }

  async saveToDatabase(matchId: string, homeGoals: number, awayGoals: number, winner: string, week: number) {
    // Ensure winner is valid for database constraint
    let winnerStr = winner;
    if (typeof winnerStr !== 'string') winnerStr = String(winnerStr);
    winnerStr = winnerStr.toLowerCase();
    if (!['home', 'away', 'draw'].includes(winnerStr)) {
      if (homeGoals > awayGoals) winnerStr = 'home';
      else if (awayGoals > homeGoals) winnerStr = 'away';
      else winnerStr = 'draw';
    }
    if (winnerStr.length > 10) winnerStr = winnerStr.slice(0, 10);
    const validWeek = Math.max(1, Math.min(week, 36));
    const now = new Date().toISOString();
    const resultString = `${homeGoals}-${awayGoals}`;
    const payload = {
      match_id: matchId,
      home_goals: homeGoals,
      away_goals: awayGoals,
      result: resultString,
      winner: winnerStr,
      is_final: 'yes',
      complited: 'yes',
      is_locked: true,
      match_duration: 90,
      updated_at: now,
      week: validWeek,
      created_at: now,
      goal_timings: '[]',
      status: 'settled',
      result_version: 0,
      btts_result: (homeGoals > 0 && awayGoals > 0),
      ov15_result: (homeGoals + awayGoals) > 1.5,
      ov25_result: (homeGoals + awayGoals) > 2.5,
      total_goals_result: homeGoals + awayGoals,
      goals_odd_even_result: ((homeGoals + awayGoals) % 2 === 1) ? 'odd' : 'even',
      correct_score_result: resultString,
      bet_type: null,
      amount: null,
      odds: null,
      potential_win: null,
      result_amount: null,
      placed_at: now,
      settled_at: now,
      selection: null,
      stake: null,
      bet_category: null,
      threshold: null,
      first_goal_time: null,
      half_time_home_goals: null,
      half_time_away_goals: null,
      btts_selection: null,
      ov15_selection: null,
      ov25_selection: null,
      total_goals_selection: null,
      first_goal_time_selection: null,
      goals_odd_even_selection: null,
      correct_score_selection: null,
      last_calculated_at: now,
      calculation_count: 1,
      needs_recalculation: false,
      result_changed: false,
      previous_result: null,
      next_recalculation_at: null,
      result_sync_version: 1,
      last_sync_at: now
    };
    // Defensive: ensure is_final and complited are always 'yes'/'no' strings
    if (typeof payload.is_final === 'boolean') payload.is_final = payload.is_final ? 'yes' : 'no';
    if (typeof payload.complited === 'boolean') payload.complited = payload.complited ? 'yes' : 'no';
    // Validation
    const errors = validateMatchData(payload);
    if (errors.length > 0) {
      console.error('Validation errors:', errors);
      return;
    }
    console.log('match_results queue upsertPayload:', JSON.stringify(payload));
    const { error } = await supabase
      .from('match_results')
      .upsert([payload], { onConflict: 'match_id' });
    if (error) throw error;
      console.log(` Queued save completed for ${matchId}`);
    }
}

// Helper: Validate match data before DB write
function validateMatchData(data: any): string[] {
  const errors: string[] = [];
  if (!data.match_id) errors.push('match_id is required');
  if (typeof data.home_goals !== 'number') errors.push('home_goals must be number');
  if (typeof data.away_goals !== 'number') errors.push('away_goals must be number');
  if (data.is_final && !['yes', 'no'].includes(data.is_final)) {
    errors.push('is_final must be "yes" or "no"');
  }
  if (data.complited && !['yes', 'no'].includes(data.complited)) {
    errors.push('complited must be "yes" or "no"');
  }
  if (data.winner && !['home', 'away', 'draw'].includes(data.winner.toLowerCase())) {
    errors.push('winner must be "home", "away", or "draw"');
  }
  if (data.week && (data.week < 1 || data.week > 36)) {
    errors.push('week must be between 1 and 36');
  }
  return errors;
}

// Singleton instance
const matchResultQueue = new MatchResultQueue();
import React, { useEffect, useState, useRef } from "react";

// ...existing code...

// Add this helper function before the component definition or at the top of the file
async function ensureGlobalScheduleSynced() {
  // Example: fetch the global schedule from Supabase and store in localStorage
  // You may need to adjust this logic to match your actual schedule sync requirements
  const { data, error } = await supabase
    .from('global_schedule')
    .select('*')
    .single();
  if (error) {
    console.warn('Failed to sync global schedule:', error);
    return;
  }
  if (data) {
    localStorage.setItem('global_match_schedule', JSON.stringify(data));
    localStorage.setItem('global_match_schedule_initialized', 'true');
    console.log('✅ Global schedule synced and stored in localStorage');
  }
}

function SharedTimeframesBetting(props) {
  // Declare matchState and setMatchState at the top so it's available in all inner scopes
  type MatchState = 'pre-countdown' | 'playing' | 'betting' | 'next-countdown';
  const [matchState, setMatchState] = useState<MatchState>('pre-countdown');
  // Add countdown state
  const [countdown, setCountdown] = useState(PRE_COUNTDOWN_SECONDS);

  // Helper to parse/validate match state from string
  function parseMatchState(state: string): MatchState {
    if (state === 'pre-countdown' || state === 'playing' || state === 'betting' || state === 'next-countdown') {
      return state;
    }
    return 'pre-countdown';
  }

  const [globalStateLoaded, setGlobalStateLoaded] = useState(false);
  // Block all rendering until global schedule is fully synced and local state is loaded
  if (!globalStateLoaded) {
    return <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-500 mb-4 mx-auto"></div>
        <div className="text-lg text-purple-500 font-semibold">Syncing global schedule…</div>
        <div className="mt-2 text-sm text-gray-500">Ensuring all users see the same fixtures and games worldwide.</div>
      </div>
    </div>;
  }
        // DEBUG: Log global schedule on every reload to diagnose time/year desync
        React.useEffect(() => {
          const schedule = getGlobalSchedule();
          console.log('[GLOBAL SCHEDULE DEBUG]', {
            referenceEpoch: schedule.referenceEpoch,
            referenceEpochISO: new Date(schedule.referenceEpoch).toISOString(),
            matchInterval: schedule.matchInterval,
            timezone: schedule.timezone,
            now: new Date().toISOString(),
            nowWithServerOffset: new Date(getNowWithServerOffset()).toISOString(),
          });
        }, []);
    // (removed duplicate declaration)
  React.useEffect(() => {
    let mounted = true;
    async function initializeSystem() {
      // 1. Clear any corrupted local data
      localStorage.removeItem('global_match_schedule');
      localStorage.removeItem('global_match_schedule_initialized');
      // 2. Fetch latest global state FIRST
      let globalState = await getSystemStateFromSupabase();
      console.log('⚡ Initial system state loaded:', globalState);
      if (!mounted || !globalState) {
        console.warn('No global state found in Supabase. Attempting to create default state...');
        // Attempt to create a default state row in Supabase
        const defaultState = {
          currentWeek: 1,
          currentTimeframeIdx: 0,
          fixtureSetIdx: 0,
          fixtureSalt: '0',
          matchState: 'pre-countdown',
          countdown: PRE_COUNTDOWN_SECONDS,
          updated_at: new Date().toISOString(),
          force_update_nonce: Math.random()
        };
        try {
          await saveSystemStateToSupabase(defaultState);
          console.log('✅ Default system state created in Supabase. Retrying load...');
          globalState = await getSystemStateFromSupabase();
        } catch (err) {
          console.error('❌ Failed to create default system state in Supabase:', err);
        }
      }
      if (!mounted || !globalState) {
        // If still no state, fail gracefully
        alert('Critical error: Unable to load or create global system state. Please check your Supabase connection.');
        setGlobalStateLoaded(true);
        return;
      }
      // 3. Set ALL state from Supabase (not just some)
      setFixtureSetIdx(globalState.fixtureSetIdx ?? 0);
      setFixtureSalt(globalState.fixtureSalt ?? '0');
      setCurrentTimeframeIdx(globalState.currentTimeframeIdx ?? 0);
      setMatchState(parseMatchState(globalState.matchState));
      setCountdown(globalState.countdown || PRE_COUNTDOWN_SECONDS);
      // 4. Verify the season is properly loaded
      console.log('✅ System initialized with:', {
        season: globalState.fixtureSetIdx + 1,
        week: globalState.currentTimeframeIdx + 1,
        salt: globalState.fixtureSalt
      });
      // 5. Mark as loaded
      setGlobalStateLoaded(true);
    }
    initializeSystem();
    return () => { mounted = false; };
  }, []);
  // ...existing code...
  // Place this button somewhere in your UI for testing (e.g., above main content)
  // <DebugForceNewSeasonButton />

  // Only initialize from global state, never random or local values
  const [fixtureSetIdx, setFixtureSetIdx] = useState(0);
  const [currentTimeframeIdx, setCurrentTimeframeIdx] = useState(0);
  const [fixtureSalt, setFixtureSalt] = useState('0');

  // ...existing useState declarations...

  // --- Centralized Week 36 reset handler ---
  // --- UNIFIED SEASON RESET MANAGER ---
  const [lastProcessedWeek, setLastProcessedWeek] = useState<number | null>(null);
  React.useEffect(() => {
    async function handleSeasonProgression() {
      const currentWeek = currentTimeframeIdx + 1;
      // Prevent duplicate processing
      if (lastProcessedWeek === currentWeek) return;
      console.log('🎯 Season progression check:', {
        currentWeek,
        lastProcessedWeek,
        fixtureSetIdx,
        week36: currentWeek === 36,
        shouldReset: currentWeek === 36 && lastProcessedWeek !== 36
      });
      // WEEK 36 DETECTED - START NEW SEASON
      if (currentWeek === 36 && lastProcessedWeek !== 36) {
        console.log('🔄 WEEK 36 DETECTED - Starting new season...');
        // Calculate new season parameters
        const newFixtureSetIdx = fixtureSetIdx + 1;
        const newFixtureSalt = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        // 1. FIRST: Save to Supabase (CRITICAL - before any state updates)
        await saveSystemStateToSupabase({
          currentWeek: 1,
          currentTimeframeIdx: 0,
          fixtureSetIdx: newFixtureSetIdx,
          fixtureSalt: newFixtureSalt,
          matchState: 'pre-countdown',
          countdown: PRE_COUNTDOWN_SECONDS,
          updated_at: new Date().toISOString(),
          force_update_nonce: Math.random()
        });
        console.log('✅ Season saved to Supabase:', {
          oldSetIdx: fixtureSetIdx,
          newSetIdx: newFixtureSetIdx,
          newSalt: newFixtureSalt
        });
        // 2. SECOND: Update local state (after successful save)
        setFixtureSetIdx(newFixtureSetIdx);
        setFixtureSalt(newFixtureSalt);
        setCurrentTimeframeIdx(0);
        setMatchState('pre-countdown');
        setCountdown(PRE_COUNTDOWN_SECONDS);
        setLastProcessedWeek(36);
        // 3. THIRD: Force a global state sync
        window.dispatchEvent(new CustomEvent('seasonReset', {
          detail: { newSetIdx: newFixtureSetIdx, newSalt: newFixtureSalt }
        }));
        console.log('🎉 New season started! Season', newFixtureSetIdx + 1);
        return;
      }
      // Update last processed week tracker
      if (currentWeek !== 36 && lastProcessedWeek === 36) {
        setLastProcessedWeek(null);
      } else if (currentWeek !== lastProcessedWeek) {
        setLastProcessedWeek(currentWeek);
      }
    }
    // Only run when we have valid week data
    if (currentTimeframeIdx !== null && globalStateLoaded) {
      handleSeasonProgression();
    }
  }, [currentTimeframeIdx, fixtureSetIdx, globalStateLoaded, lastProcessedWeek]);
  // --- DEBUG: Test Season Persistence Button ---
  const DebugTestSeasonPersistenceButton = () => (
    <button
      onClick={async () => {
        const state = await getSystemStateFromSupabase();
        alert(`Current Supabase State:\nSeason: ${state.fixtureSetIdx + 1}\nWeek: ${state.currentTimeframeIdx + 1}\nSalt: ${state.fixtureSalt}\n\nAfter reload, this should NOT change!`);
        // Also test increment
        const newSetIdx = state.fixtureSetIdx + 1;
        const newSalt = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        await saveSystemStateToSupabase({
          currentWeek: 1,
          currentTimeframeIdx: 0,
          fixtureSetIdx: newSetIdx,
          fixtureSalt: newSalt,
          matchState: 'pre-countdown',
          countdown: PRE_COUNTDOWN_SECONDS
        });
        alert(`✅ Test: Saved Season ${newSetIdx + 1} to Supabase\nNow reload the page to see if it persists`);
      }}
      className="px-4 py-2 mb-3 bg-red-600 text-white rounded"
    >
      🔍 DEBUG: Test Season Persistence
    </button>
  );
  {/* --- DEBUG BUTTON: REMOVE IN PRODUCTION --- */}
  <DebugTestSeasonPersistenceButton />

  // ...existing code...

}
// Utility to check online status
function useNetworkStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  return online;
}

// Utility to check Supabase sync status
function useSupabaseSyncStatus() {
  const [synced, setSynced] = useState(true);
  useEffect(() => {
    const handler = (e) => {
      if (e.detail && e.detail.error) setSynced(false);
      else setSynced(true);
    };
    window.addEventListener('supabase-sync-status', handler);
    return () => window.removeEventListener('supabase-sync-status', handler);
  }, []);
  return synced;
}

// Helper to dispatch sync status events after Supabase calls
async function supabaseWithSyncStatus(promise) {
  try {
    const result = await promise;
    window.dispatchEvent(new CustomEvent('supabase-sync-status', { detail: { error: null } }));
    return result;
  } catch (error) {
    window.dispatchEvent(new CustomEvent('supabase-sync-status', { detail: { error } }));
    throw error;
  }
}
import { betResolutionService } from "@/lib/betResolutionService";
// ...existing code...

// Place this inside your main component (SharedTimeframesBetting):
// (Make sure this is inside the component, not at the top level)
// useEffect(() => {
//   const interval = setInterval(() => {
//     betResolutionService.resolveAllStuckMatches()
//       .then(resolved => {
//         if (resolved > 0) {
//           console.log(`✅ Auto-resolved ${resolved} stuck bets`);
//         }
//       })
//       .catch(err => {
//         console.error('Error auto-resolving stuck matches:', err);
//       });
//   }, 2 * 60 * 1000); // Every 2 minutes
//   return () => clearInterval(interval);
// }, []);
// ...existing code...
// Generate unique betTypes for each match using matchId as seed

// ...existing code...

// Robust periodic sync: ensure UI always advances to the correct match and phase
// Robust periodic sync: ensure UI always advances to the correct match and phase
// (Insert this after all useState declarations in the main component)
// ...existing code...

// Place this effect after all state variables are declared, inside the main component:

// Periodically sync UI state to global schedule (every 5 seconds)
// This must be after all useState declarations so it can access the correct variables
// (Insert this after all useState declarations in the main component)

// ...existing code...



// Place this effect after all state variables are declared, inside the main component:

// Robust sync: ensure UI always advances to the next match after 90, even if effects miss a beat
// (Insert this after all useState declarations in the main component)

// Removed getAdminSettings, saveAdminSettings, checkAndAutoReshuffle: admin outcomes are now global only
import { leagues } from "@/data/leagues";
import { getFixtureSet } from "../data/fixtureSets";

// Helper to get or generate a robust salt for fixture generation
function getGlobalFixtureSalt(globalState) {
  // Use a salt from global state if available, else fallback to fixtureSetIdx as string
  return (globalState && globalState.fixtureSalt) || String(globalState?.fixtureSetIdx || '0');
}
import { supabase } from "@/lib/supabaseClient";
import { useBetSlipHistory } from "@/hooks/useBetSlipHistory";
import { BetSlipHistory } from "@/components/BetSlipHistory";
import { placeBetsAtomic } from "@/lib/bettingService";
import { useRealtimeBalance } from "@/hooks/useRealtimeBalance";
import { resolveBetsForMatch, forceResolveStaleBets } from "@/lib/supabaseBets";
import { getFixtureOutcomesForWeek } from "@/lib/fixtureOutcomes";
import { generateDeterministicGoalTimes, seededRandom as seededRandomNumber } from "@/lib/deterministicTimeline";

// Helper to generate unique matchId for admin outcomes
function getMatchId(leagueCode, weekIdx, matchIdx, homeShort, awayShort) {
  return `league-${leagueCode}-week-${weekIdx + 1}-match-${matchIdx}-${homeShort}-vs-${awayShort}`;
}
// Removed global pool imports to ensure fixture-based, deterministic matches per league/week
import { getGlobalSchedule, getNowWithServerOffset } from "@/lib/matchScheduleService";

// System-wide state: track current week/timeframe globally in Supabase
const SYSTEM_STATE_KEY = "betting_system_state";
const SYSTEM_STATE_ID = '9597122f-1306-4732-aeb8-ff699011c727';

// Get global system state from Supabase (all users see the same)
async function getSystemStateFromSupabase() {
  try {
    const { data, error, status, statusText } = await supabase
      .from('betting_system_state')
      .select('*')
      .eq('id', SYSTEM_STATE_ID)
      .single();
    // Log full response for debugging
    console.log('Supabase betting_system_state fetch:', { data, error, status, statusText });
    
    if (error || !data) {
      console.warn('No system state in DB');
      return null;
    }
    
    // Always recalculate countdown based on global state and local time
    const now = Date.now();
    const updatedAt = data.updated_at ? new Date(data.updated_at).getTime() : now;
    let countdown = typeof data.countdown === 'number' ? data.countdown : 10;
    let matchState = data.match_state || 'pre-countdown';
    if (matchState === 'pre-countdown' || matchState === 'betting') {
      const elapsed = Math.floor((now - updatedAt) / 1000);
      countdown = Math.max(0, countdown - elapsed);
    }
    // Fallback: if countdown is undefined, NaN, or negative, reset to PRE_COUNTDOWN_SECONDS
    if (typeof countdown !== 'number' || isNaN(countdown) || countdown < 0) {
      countdown = PRE_COUNTDOWN_SECONDS;
      matchState = 'pre-countdown';
    }
    // Ensure fixtureSalt always exists and fallback is robust
    let fixtureSalt = data.fixture_salt;
    if (!fixtureSalt) {
      if (typeof data.fixture_set_idx !== 'undefined') {
        fixtureSalt = String(data.fixture_set_idx);
      } else {
        fixtureSalt = 'default_salt';
      }
    }
    return {
      currentWeek: data.current_week || 1,
      currentTimeframeIdx: data.current_timeframe_idx || 0,
      fixtureSetIdx: data.fixture_set_idx || 0,
      fixtureSalt,
      matchState,
      countdown,
      lastUpdated: data.updated_at || new Date().toISOString(),
    };
  } catch (err) {
    console.error('Failed to fetch system state from DB:', err);
    return null;
  }
}

// Save global system state to Supabase (syncs all users)
async function saveSystemStateToSupabase(state: any) {
  try {
    // Defensive: convert any boolean to string for all string columns
    const upsertPayload = {
      id: SYSTEM_STATE_ID,
      current_week: state.currentWeek,
      current_timeframe_idx: state.currentTimeframeIdx,
      fixture_set_idx: state.fixtureSetIdx,
      fixture_salt: state.fixtureSalt, // Always persist salt
      match_state: state.matchState,
      countdown: state.countdown,
      updated_at: new Date().toISOString(),
      force_update_nonce: Math.random(),
    };
    Object.keys(upsertPayload).forEach((key) => {
      if (typeof upsertPayload[key] === 'boolean') {
        upsertPayload[key] = upsertPayload[key] ? 'yes' : 'no';
      }
    });
    const { error, status, statusText } = await supabase
      .from('betting_system_state')
      .upsert(upsertPayload, { onConflict: 'id' });
    // Log full response for debugging
    console.log('Supabase betting_system_state upsert:', { error, status, statusText });
    if (error) {
      console.error('Failed to save system state to DB:', error);
      return;
    }
    console.log('✓ System state saved to DB:', state);
  } catch (err) {
    console.error('Exception saving system state:', err);
  }
}

// Save match result to local history (for UI/history display)
const MATCH_HISTORY_KEY = "betting_match_history";
function saveMatchResult(result: any) {
  const history = JSON.parse(localStorage.getItem(MATCH_HISTORY_KEY) || "[]");
  // Prevent duplicate entries by match id and updated_at
  const exists = history.some((r: any) => r.id === result.id && r.updated_at === result.updated_at);
  if (!exists) {
    // Keep only the last 10
    const newHistory = [result, ...history].slice(0, 10);
    localStorage.setItem(MATCH_HISTORY_KEY, JSON.stringify(newHistory));
  }
}
function getMatchHistory() {
  return JSON.parse(localStorage.getItem(MATCH_HISTORY_KEY) || "[]");
}
// Helper to simulate live match events
// Progressive match simulation: generates a timeline of goal events
// Deterministic PRNG utilities to ensure identical simulations across devices
function hashStringToInt(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function createLCG(seed: number) {
  let state = (seed || 1) >>> 0;
  return function rand() {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// Weighted random goal timing helper
function weightedGoalMinute(rand, duration) {
  // Weighted buckets: early (10-30%), mid (30-70%), late (70-100%)
  const r = rand();
  if (r < 0.25) return Math.floor(1 + rand() * (duration * 0.3)); // Early
  if (r < 0.75) return Math.floor(duration * 0.3 + rand() * (duration * 0.4)); // Mid
  return Math.floor(duration * 0.7 + rand() * (duration * 0.3)); // Late
}

// Deterministic, time-driven match simulation
function simulateMatch(matchId: string, duration = 40, adminOverride: any = null) {
  // Use admin override if present
  let versionedMatchId = matchId;
  if (adminOverride && adminOverride.updated_at) {
    versionedMatchId = matchId + '-' + new Date(adminOverride.updated_at).getTime();
  }
  // Generate deterministic seed
  const seed = hashStringToInt(String(versionedMatchId));
  const rand = createLCG(seed);

  // If admin override exists and has goal times, use them
  if (adminOverride && typeof adminOverride.homeGoals === 'number' && typeof adminOverride.awayGoals === 'number') {
    const totalGoals = adminOverride.homeGoals + adminOverride.awayGoals;
    let events = [];
    if (totalGoals > 0) {
      let goalTimes: number[] = [];
      if (adminOverride.goal_times && Array.isArray(adminOverride.goal_times) && adminOverride.goal_times.length === totalGoals) {
        // Use provided goal times
        goalTimes = adminOverride.goal_times.slice();
        // Convert from 90-minute scale to simulation duration
        goalTimes = goalTimes.map(t => Math.floor((t / 90) * duration) || 1);
      } else {
        // Generate progressive goal times spread throughout the match
        goalTimes = [];
        const baseInterval = duration / (totalGoals + 1);
        for (let i = 1; i <= totalGoals; i++) {
          const randomOffset = (rand() * baseInterval * 0.5) - (baseInterval * 0.25);
          const time = Math.max(1, Math.min(duration - 1, Math.floor(baseInterval * i + randomOffset)));
          goalTimes.push(time);
        }
        // Sort goal times
        goalTimes.sort((a, b) => a - b);
      }

      // Assign goals to teams so that the number of home/away goals matches the admin outcome exactly
      // Shuffle goalTimes deterministically, then pick first N for home, rest for away
      const shuffledGoalTimes = goalTimes.slice();
      // Fisher-Yates shuffle using deterministic rand
      for (let i = shuffledGoalTimes.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [shuffledGoalTimes[i], shuffledGoalTimes[j]] = [shuffledGoalTimes[j], shuffledGoalTimes[i]];
      }
      const homeGoalCount = adminOverride.homeGoals;
      const awayGoalCount = adminOverride.awayGoals;
      const homeGoalTimes = shuffledGoalTimes.slice(0, homeGoalCount).sort((a, b) => a - b);
      const awayGoalTimes = shuffledGoalTimes.slice(homeGoalCount).sort((a, b) => a - b);
      const goalEvents = [
        ...homeGoalTimes.map(t => ({ time: t, team: 'home' })),
        ...awayGoalTimes.map(t => ({ time: t, team: 'away' }))
      ].sort((a, b) => a.time - b.time);
      // Build progressive events timeline
      let goalIdx = 0;
      let homeGoals = 0;
      let awayGoals = 0;
      for (let t = 1; t <= duration; t++) {
        while (goalIdx < goalEvents.length && t === goalEvents[goalIdx].time) {
          const event = { time: t, team: goalEvents[goalIdx].team };
          events.push(event);
          if (event.team === 'home') homeGoals++;
          else awayGoals++;
          goalIdx++;
        }
      }
    }
    let winner = adminOverride.winner;
    if (!winner) {
      if (adminOverride.homeGoals > adminOverride.awayGoals) winner = "home";
      else if (adminOverride.awayGoals > adminOverride.homeGoals) winner = "away";
      else winner = "draw";
    }
    return {
      homeGoals: adminOverride.homeGoals,
      awayGoals: adminOverride.awayGoals,
      winner,
      events,
      finalScore: { home: adminOverride.homeGoals, away: adminOverride.awayGoals }
    };
  }

  // Fallback: deterministic PRNG for random matches
  const homeGoals = Math.floor(rand() * 4); // 0-3
  const awayGoals = Math.floor(rand() * 4); // 0-3
  const totalGoals = homeGoals + awayGoals;
  let events = [];
  if (totalGoals > 0) {
    // Generate progressive goal times
    let goalTimes = [];
    const baseInterval = duration / (totalGoals + 1);
    for (let i = 1; i <= totalGoals; i++) {
      const randomOffset = (rand() * baseInterval * 0.5) - (baseInterval * 0.25);
      const time = Math.max(1, Math.min(duration - 1, Math.floor(baseInterval * i + randomOffset)));
      goalTimes.push(time);
    }
    goalTimes.sort((a, b) => a - b);
    // Assign goals to teams: shuffle goalTimes, assign first homeGoals to home, rest to away
    const shuffledGoalTimes = goalTimes.slice();
    for (let i = shuffledGoalTimes.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffledGoalTimes[i], shuffledGoalTimes[j]] = [shuffledGoalTimes[j], shuffledGoalTimes[i]];
    }
    const homeGoalTimes = shuffledGoalTimes.slice(0, homeGoals).sort((a, b) => a - b);
    const awayGoalTimes = shuffledGoalTimes.slice(homeGoals).sort((a, b) => a - b);
    const goalEvents = [
      ...homeGoalTimes.map(t => ({ time: t, team: 'home' })),
      ...awayGoalTimes.map(t => ({ time: t, team: 'away' }))
    ].sort((a, b) => a.time - b.time);
    // Build events timeline
    let goalIdx = 0;
    let h = 0, a = 0;
    for (let t = 1; t <= duration; t++) {
      while (goalIdx < goalEvents.length && t === goalEvents[goalIdx].time) {
        if (goalEvents[goalIdx].team === 'home' && h < homeGoals) {
          events.push({ time: t, team: 'home' });
          h++;
        } else if (goalEvents[goalIdx].team === 'away' && a < awayGoals) {
          events.push({ time: t, team: 'away' });
          a++;
        }
        goalIdx++;
      }
    }
  }
  let winner = null;
  if (homeGoals > awayGoals) winner = "home";
  else if (awayGoals > homeGoals) winner = "away";
  else winner = "draw";
  return {
    homeGoals,
    awayGoals,
    winner,
    events,
    finalScore: { home: homeGoals, away: awayGoals }
  };
}

// Helper to get progressive score at a given match minute
function getProgressiveScore(events: any[], matchMinute: number, duration = 40) {
  // Map matchMinute (0-90) to simulation second (1-40)
  const simSecond = Math.floor((matchMinute / 90) * duration);
  let home = 0, away = 0;
  // Count goals up to the current simulation second
  for (const ev of events) {
    if (ev.time <= simSecond) {
      if (ev.team === "home") home++;
      else away++;
    }
  }
  return { home, away };
}

// Helper to get final score for betting phase
function getFinalScore(matchId: string, adminOutcomes: Record<string, any>, matchSimCache: Record<string, any>) {
  const adminOutcome = adminOutcomes[matchId];
  if (adminOutcome) {
    return {
      home: adminOutcome.homeGoals || 0,
      away: adminOutcome.awayGoals || 0,
      isAdminSet: true
    };
  }
  // Fallback to simulated final score
  const sim = matchSimCache[matchId];
  if (sim && sim.finalScore) {
    return {
      home: sim.finalScore.home,
      away: sim.finalScore.away,
      isAdminSet: false
    };
  }
  return { home: 0, away: 0, isAdminSet: false };
}
// Helper to randomize goal outcomes
const randomGoals = () => Math.floor(Math.random() * 5);

// Function to calculate dynamic odds based on match result
const calculateDynamicOdds = (homeGoals: number, awayGoals: number) => {
  const totalGoals = homeGoals + awayGoals;
  
  // 1X2 odds based on final result
  let odds_1 = 2.10, odds_X = 3.20, odds_2 = 2.80;
  if (homeGoals > awayGoals) {
    odds_1 = 2.20; // Home already won, low odds
    odds_X = 3.65;
    odds_2 = 3.80;
  } else if (awayGoals > homeGoals) {
    odds_1 = 2.00;
    odds_X = 2.65;
    odds_2 = 1.20; // Away already won, low odds
  } else {
    odds_1 = 3.00;
    odds_X = 2.15; // Draw already happened, very low odds
    odds_2 = 4.00;
  }
  
  // BTTS odds
  const btts_yes = (homeGoals > 0 && awayGoals > 0) ? 1.10 : 2.50;
  const btts_no = (homeGoals > 0 && awayGoals > 0) ? 4.00 : 1.20;
  
  // Over/Under 1.5
  const ov15 = totalGoals > 1.5 ? 1.15 : 3.20;
  const un15 = totalGoals < 1.5 ? 1.15 : 3.20;
  
  // Over/Under 2.5
  const ov25 = totalGoals > 2.5 ? 1.30 : 2.50;
  const un25 = totalGoals < 2.5 ? 1.30 : 2.50;
  
  // Total Goals - multiple brackets
  const ov35 = totalGoals > 3.5 ? 1.40 : 2.20;
  const un35 = totalGoals < 3.5 ? 1.40 : 2.20;
  const ov45 = totalGoals > 4.5 ? 2.00 : 1.80;
  const un45 = totalGoals < 4.5 ? 1.80 : 2.00;
  
  // Time of First Goal - already happened, so only current or past times are valid
  // We'll use a placeholder since we don't track exact goal times in this simple version
  const tofg_odds = ["1.05", "1.05", "1.05", "2.50", "3.50", "4.00"];
  
  // Odd/Even goals
  const oddGoals = totalGoals % 2 === 1;
  const odd_odds = oddGoals ? 1.10 : 3.00;
  const even_odds = oddGoals ? 3.00 : 1.10;
  
  return {
    "1X2": { 
      selections: ["1", "X", "2"], 
      odds: [odds_1.toFixed(2), odds_X.toFixed(2), odds_2.toFixed(2)] 
    },
    "BTTS": { 
      selections: ["Yes", "No"], 
      odds: [btts_yes.toFixed(2), btts_no.toFixed(2)] 
    },
    "OV/UN 1.5": { 
      selections: ["Over 1.5", "Under 1.5"], 
      odds: [ov15.toFixed(2), un15.toFixed(2)] 
    },
    "OV/UN 2.5": { 
      selections: ["Over 2.5", "Under 2.5"], 
      odds: [ov25.toFixed(2), un25.toFixed(2)] 
    },
    "Total Goals": { 
      selections: ["Over 2.5", "Over 3.5", "Over 4.5", "Under 2.5", "Under 3.5", "Under 4.5"], 
      odds: ["1.85", ov35.toFixed(2), ov45.toFixed(2), un25.toFixed(2), un35.toFixed(2), un45.toFixed(2)] 
    },
    "Time of First Goal": { 
      selections: ["0-15 min", "16-30 min", "31-45 min", "46-60 min", "61-75 min", "76-90 min"], 
      odds: tofg_odds 
    },
    "Total Goals Odd/Even": { 
      selections: ["Odd", "Even"], 
      odds: [odd_odds.toFixed(2), even_odds.toFixed(2)] 
    },
  };
};

import { generateMatches } from "@/utils/matchGenerator";
import BettingHeader from "@/components/BettingHeader";
import NavigationTabs from "@/components/NavigationTabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getMatchAtTime } from "@/utils/globalTimeMatchSystem";
import { calculateScheduledTime } from "@/lib/matchScheduleService";

// Helper to generate seeded random numbers for consistent per-match odds
function seededRandomString(seed: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function () {
    h += h << 13; h ^= h >>> 7;
    h += h << 3; h ^= h >>> 17;
    h += h << 5;
    return (h >>> 0) / 4294967295;
  };
}

function randomOddsArraySeeded(length: number, min: number, max: number, rand: () => number, decimals = 2) {
  return Array.from({ length }, () => (min + rand() * (max - min)).toFixed(decimals));
}



// Correct score options (all possible match results)
const correctScoreOptions = [
  { score: "0-0", odds: "8.50" },
  { score: "1-0", odds: "6.50" },
  { score: "0-1", odds: "10.00" },
  { score: "1-1", odds: "5.50" },
  { score: "2-0", odds: "9.00" },
  { score: "0-2", odds: "15.00" },
  { score: "2-1", odds: "7.50" },
  { score: "1-2", odds: "12.00" },
  { score: "2-2", odds: "8.00" },
  { score: "3-0", odds: "14.00" },
  { score: "0-3", odds: "20.00" },
  { score: "3-1", odds: "11.00" },
  { score: "1-3", odds: "18.00" },
  { score: "3-2", odds: "13.00" },
  { score: "2-3", odds: "16.00" },
  { score: "3-3", odds: "18.50" },
];

// Generate unique betTypes for each match using matchId as seed
function getRandomBetTypesForMatch(matchId: string) {
  const rand = seededRandomString(matchId);
  return [
    { type: "1X2", selections: ["1", "X", "2"], odds: randomOddsArraySeeded(3, 1.80, 3.80, rand) },
    { type: "BTTS", selections: ["Yes", "No"], odds: randomOddsArraySeeded(2, 1.60, 2.50, rand) },
    { type: "OV/UN 1.5", selections: ["Over 1.5", "Under 1.5"], odds: randomOddsArraySeeded(2, 1.40, 2.80, rand) },
    { type: "OV/UN 2.5", selections: ["Over 2.5", "Under 2.5"], odds: randomOddsArraySeeded(2, 1.60, 2.80, rand) },
    { type: "Total Goals", selections: ["Over 2.5", "Over 3.5", "Over 4.5", "Under 2.5", "Under 3.5", "Under 4.5"], odds: randomOddsArraySeeded(6, 1.20, 4.00, rand) },
    { type: "Time of First Goal", selections: ["0-15 min", "16-30 min", "31-45 min", "46-60 min", "61-75 min", "76-90 min"], odds: randomOddsArraySeeded(6, 2.00, 5.00, rand) },
    { type: "Total Goals Odd/Even", selections: ["Odd", "Even"], odds: randomOddsArraySeeded(2, 1.50, 2.50, rand) },
    { type: "Correct Score", selections: correctScoreOptions.map(cs => cs.score), odds: correctScoreOptions.map(cs => cs.odds) },
  ];
}

// Default betTypes for UI fallback (not used for actual match odds)
const betTypes = getRandomBetTypesForMatch('default');

// Example usage in your match rendering (replace this in your match list rendering):
// matches.forEach((match) => {
//   const betTypesForThisMatch = getRandomBetTypesForMatch(match.id);
//   // Use betTypesForThisMatch to render odds for this match
// });

// In your JSX, for each match row, use:
// const betTypesForThisMatch = getRandomBetTypesForMatch(match.id);
// ... then use betTypesForThisMatch instead of betTypes


// Timeframes
const USE_FIXTURES = true; // Use weekly fixtures for each timeframe/week
const PRE_COUNTDOWN_SECONDS = 5;
const MATCH_SIM_SECONDS = 90; // wall-clock seconds to simulate 90'
const BETTING_WINDOW_SECONDS = 30;
const NEXT_COUNTDOWN_SECONDS = 1;

const isGlobalTimeEnabled = (): boolean => {
  const initialized = localStorage.getItem('global_match_schedule_initialized') !== null;
  return initialized && !USE_FIXTURES;
};
// Generate deterministic time slots around the current index using the global schedule
// Returns an array of Date objects for simplicity with existing state typing
const getTimeSlots = (windowSize = 120): Date[] => {
  const schedule = getGlobalSchedule();
  const nowMs = getNowWithServerOffset();
  const currentIdx = Math.floor((nowMs - schedule.referenceEpoch) / (schedule.matchInterval * 60000));
  const half = Math.floor(windowSize / 2);
  const startIdx = Math.max(0, currentIdx - half);
  const endIdx = currentIdx + half;
  const slots: Date[] = [];
    for (let i = startIdx; i < endIdx; i++) {
    slots.push(calculateScheduledTime(i, schedule));
  }
  return slots;
};

// Get visible time slots: 2 past + current + 3 upcoming
const getVisibleTimeSlots = (allSlots: Date[], currentIdx: number) => {
  const TIMEFRAMES_TO_SHOW = 10; // Show 10 timeframes (current + 9 upcoming)
  let startIdx = currentIdx;
  let endIdx = Math.min(allSlots.length, currentIdx + TIMEFRAMES_TO_SHOW);
  let visibleSlots = allSlots.slice(startIdx, endIdx);
  // Ensure the live frame is always included
  if (!visibleSlots.includes(allSlots[currentIdx])) {
    visibleSlots = [allSlots[currentIdx], ...visibleSlots.filter(slot => slot !== allSlots[currentIdx])];
    // If this makes the array too long, trim from the end
    if (visibleSlots.length > TIMEFRAMES_TO_SHOW) {
      visibleSlots = visibleSlots.slice(0, TIMEFRAMES_TO_SHOW);
    }
    startIdx = allSlots.indexOf(visibleSlots[0]);
  }
  console.log(`🎯 Visible slots: ${visibleSlots.length} (from index ${startIdx} to ${endIdx})`);
  return { visibleSlots, startIdx };
};

// Helper to get logo path, fallback to default
const getLogoPath = (team: any) => {
  // First check if team has a logo property (properly imported)
  if (team.logo) {
    return team.logo;
  }
  // Fallback to default if no logo property
  return defaultLogo;
};

const defaultLogo = "/src/assets/teams/default.png";

// Helper: Get current timeframe index based on global time system
// IMPORTANT: This calculates which match ALL users should be seeing right now
// based on the shared global reference epoch from Supabase
const getCurrentTimeframeIdx = (): number => {
  const schedule = getGlobalSchedule();
  const now = new Date(getNowWithServerOffset());
  const timeSinceEpoch = now.getTime() - schedule.referenceEpoch;
  const currentIndex = Math.floor(timeSinceEpoch / (schedule.matchInterval * 60000));
  
  console.log('📊 Match calculation:', {
    now: now.toISOString(),
    referenceEpoch: new Date(schedule.referenceEpoch).toISOString(),
    timeSinceEpoch: Math.floor(timeSinceEpoch / 1000) + ' seconds',
    matchInterval: schedule.matchInterval + ' minutes',
    currentIndex: currentIndex
  });
  
  return currentIndex;
};

// Helper: Find which slot index a given time falls into
const getSlotIndexForTime = (time: Date, slots: Date[]): number => {
  return slots.findIndex(slot => 
    Math.abs(slot.getTime() - time.getTime()) < 60000 // Within 1 minute
  );
};
// Helper: Find the slot currently playing (start <= now < start + interval)
const getCurrentPlayingSlot = (schedule: any): { start: Date; index: number } => {
  const nowMs = getNowWithServerOffset();
  const idx = Math.floor((nowMs - schedule.referenceEpoch) / (schedule.matchInterval * 60000));
  return { start: calculateScheduledTime(idx, schedule), index: idx };
};

// Helper: Filter matches by country/league
// No filtering needed - matches are already loaded per country
const getMatchesByCountry = (matches: any[], countryCode: string): any[] => {
  // Since we load matches per country, just return all matches
  return matches || [];
};

const BetXPesa = () => {
      // Match state and timers must be declared before any use
      type MatchState = 'pre-countdown' | 'playing' | 'betting' | 'next-countdown';
      const [matchState, setMatchState] = useState<MatchState>('pre-countdown');

      // Helper to parse/validate match state from string
      function parseMatchState(state: string): MatchState {
        if (state === 'pre-countdown' || state === 'playing' || state === 'betting' || state === 'next-countdown') {
          return state;
        }
        return 'pre-countdown';
      }
      const [bettingTimer, setBettingTimer] = useState(30); // 30s betting window
    // --- GLOBAL SYSTEM STATE: fixtureSetIdx and fixtureSalt ---
    // These must be defined at the top of the component, before any use
    const [fixtureSetIdx, setFixtureSetIdx] = useState(0);
    const [fixtureSalt, setFixtureSalt] = useState('0');
    const [currentTimeframeIdx, setCurrentTimeframeIdx] = useState(0);
    const [liveTimeframeIdx, setLiveTimeframeIdx] = useState<number | null>(null);
    const [loadingWeek, setLoadingWeek] = useState(true);
    const [globalStateLoaded, setGlobalStateLoaded] = useState(false);
    const [isProcessingWeek36, setIsProcessingWeek36] = useState(false);
    const lastProcessedWeekRef = useRef<number | null>(null);

    useEffect(() => {
      async function handleWeek36Reset() {
        if (isProcessingWeek36) return;
        const currentWeek = currentTimeframeIdx + 1;
        if (currentWeek === 36 && lastProcessedWeekRef.current !== 36) {
          setIsProcessingWeek36(true);
          lastProcessedWeekRef.current = 36;
          console.log('🎯 WEEK 36 DETECTED - Starting season reset...');
          const newFixtureSetIdx = fixtureSetIdx + 1;
          const newFixtureSalt = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
          console.log('🔄 New Season Details:', {
            oldSetIdx: fixtureSetIdx,
            newSetIdx: newFixtureSetIdx,
            oldSalt: fixtureSalt,
            newSalt: newFixtureSalt,
            week: currentWeek
          });
          await saveSystemStateToSupabase({
            currentWeek: 1,
            currentTimeframeIdx: 0,
            fixtureSetIdx: newFixtureSetIdx,
            fixtureSalt: newFixtureSalt,
            matchState: 'pre-countdown',
            countdown: PRE_COUNTDOWN_SECONDS
          });
          setFixtureSetIdx(newFixtureSetIdx);
          setFixtureSalt(newFixtureSalt);
          setCurrentTimeframeIdx(0);
          setMatchState('pre-countdown');
          setCountdown(PRE_COUNTDOWN_SECONDS);
          console.log('✅ Season reset complete! New fixture set:', newFixtureSetIdx);
          setTimeout(() => setIsProcessingWeek36(false), 2000);
        }
        if (currentWeek !== 36 && lastProcessedWeekRef.current === 36) {
          lastProcessedWeekRef.current = null;
        }
      }
      handleWeek36Reset();
    }, [currentTimeframeIdx, fixtureSetIdx, fixtureSalt, isProcessingWeek36]);

    // --- Betting phase auto-advance including week 36 detection ---
    useEffect(() => {
      if (matchState !== 'betting') return;
      let timer: any = null;
      const advanceToNextWeek = async () => {
        if (lastProcessedWeekRef.current === currentTimeframeIdx) return;
        lastProcessedWeekRef.current = currentTimeframeIdx;
        let newWeekIdx = currentTimeframeIdx + 1;
        let newSetIdx = fixtureSetIdx;
        let newSalt = fixtureSalt;
        const isMovingFromWeek36 = (currentTimeframeIdx + 1) === 36;
        if (isMovingFromWeek36) {
          newSetIdx = fixtureSetIdx + 1;
          newWeekIdx = 0;
          newSalt = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
          console.log('🎉 WEEK 36 COMPLETED - Starting new season with fixture set:', newSetIdx);
        }
        await saveSystemStateToSupabase({
          currentWeek: newWeekIdx + 1,
          currentTimeframeIdx: newWeekIdx,
          fixtureSetIdx: newSetIdx,
          fixtureSalt: newSalt,
          matchState: 'pre-countdown',
          countdown: PRE_COUNTDOWN_SECONDS,
        });
        setFixtureSetIdx(newSetIdx);
        setFixtureSalt(newSalt);
        setCurrentTimeframeIdx(newWeekIdx);
        setMatchState('pre-countdown');
        setCountdown(PRE_COUNTDOWN_SECONDS);
        console.log(`📅 Advanced to Week ${newWeekIdx + 1}, Season ${newSetIdx + 1}`);
      };
      if (bettingTimer > 0) {
        timer = setInterval(() => {
          setBettingTimer(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              advanceToNextWeek();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        advanceToNextWeek();
      }
      return () => {
        if (timer) clearInterval(timer);
      };
    }, [matchState, bettingTimer, currentTimeframeIdx, fixtureSetIdx, fixtureSalt]);

    // Debug button to manually trigger a new season (for testing)
    const DebugForceNewSeasonButton = () => (
      <button
        onClick={async () => {
          const newFixtureSetIdx = fixtureSetIdx + 1;
          const newFixtureSalt = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
          console.log('🧪 DEBUG: Forcing new season:', {
            oldSetIdx: fixtureSetIdx,
            newSetIdx: newFixtureSetIdx,
            newSalt: newFixtureSalt
          });
          await saveSystemStateToSupabase({
            currentWeek: 1,
            currentTimeframeIdx: 0,
            fixtureSetIdx: newFixtureSetIdx,
            fixtureSalt: newFixtureSalt,
            matchState: 'pre-countdown',
            countdown: PRE_COUNTDOWN_SECONDS,
          });
          setFixtureSetIdx(newFixtureSetIdx);
          setFixtureSalt(newFixtureSalt);
          setCurrentTimeframeIdx(0);
          setMatchState('pre-countdown');
          setCountdown(PRE_COUNTDOWN_SECONDS);
          alert(`✅ New season started! Season ${newFixtureSetIdx + 1}`);
        }}
        className="px-4 py-2 rounded-lg bg-gradient-to-r from-red-600 to-orange-600 text-white font-bold shadow-lg border border-red-400/40 mb-2"
        title="Force new season (debug)"
      >
        🧪 Force New Season (Debug)
      </button>
    );
  // --- Sync Status Indicator State ---
  const isOnline = useNetworkStatus();
  const isSupabaseSynced = useSupabaseSyncStatus();
  // --- Sync Status Indicator UI ---
  const SyncStatusIndicator = () => (
    <div style={{ position: 'fixed', top: 10, right: 10, zIndex: 1000, background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: '6px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
      <span style={{ marginRight: 12 }}>
        <span style={{ color: isOnline ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </span>
      <span>
        <span style={{ color: isSupabaseSynced ? '#22c55e' : '#f59e42', fontWeight: 600 }}>
          {isSupabaseSynced ? 'Synced' : 'Not Synced'}
        </span>
      </span>
    </div>
  );
  // Place all hooks at the top level of the component
  const lastAdvancedWeekRef = React.useRef<number | null>(null);

  // Betslip UI state
  const [betslipOpen, setBetslipOpen] = useState(true);
  // Betslip state: array of bets
  const [betslip, setBetslip] = useState<any[]>([]);
  // User and balance state
  const [user, setUser] = useState<any>(null);
  const [balance, setBalance] = useState<number>(0);
  // History modal state
  const [showHistory, setShowHistory] = useState(false);
  const [matchHistory, setMatchHistory] = useState([]);
  const [loadingMatchHistory, setLoadingMatchHistory] = useState(false);
  // Filter/search state for match history modal
  const [historyFilter, setHistoryFilter] = useState({
    team: '',
    date: '',
    outcome: '',
  });

  // Only one matchTimer declaration should exist in the component!
  const [matchTimer, setMatchTimer] = useState(0); // 0-90 for match minutes

  // Fetch last 10 global matches from Supabase when modal opens
  useEffect(() => {
    if (!showHistory) return;
    setLoadingMatchHistory(true);
    const fetchMatches = async () => {
      const { data, error } = await supabase
        .from('match_results')
        .select('home_team, away_team, home_score, away_score, status, updated_at')
        .order('updated_at', { ascending: false })
        .limit(10);
      if (!error && data) {
        setMatchHistory(data);
      } else {
        setMatchHistory([]);
      }
      setLoadingMatchHistory(false);
    };
    fetchMatches();
  }, [showHistory]);
  // Track if we've already saved results for current betting phase (prevent duplicate saves)
  const [resultsSavedForPhase, setResultsSavedForPhase] = useState(false);
  // Correct Score modal state removed (now inline)
  const [waitingGlobalState, setWaitingGlobalState] = useState<boolean>(false);
  const didGlobalSyncRef = useRef<boolean>(false);

  // Store final match result when match ends and write to Supabase only
  async function saveFinalMatchResult(matchId: string, homeGoals: number, awayGoals: number, winner: string) {
    try {
      // --- Write final result to Supabase match_results table ---
      // Extract week from matchId pattern: "league-xx-week-12-match-0-..."
      let week = 1;
      const weekMatch = matchId.match(/week-(\d+)/);
      if (weekMatch && weekMatch[1]) {
        week = parseInt(weekMatch[1]);
      }
      // Determine result string
      const resultString = `${homeGoals}-${awayGoals}`;
      // Ensure winner is valid (home, away, or draw)
      let winnerStr = winner;
      if (typeof winnerStr !== 'string') winnerStr = String(winnerStr);
      winnerStr = winnerStr.toLowerCase();
      if (!['home', 'away', 'draw'].includes(winnerStr)) {
        if (homeGoals > awayGoals) winnerStr = 'home';
        else if (awayGoals > homeGoals) winnerStr = 'away';
        else winnerStr = 'draw';
      }
      if (winnerStr.length > 10) winnerStr = winnerStr.slice(0, 10);
      const now = new Date().toISOString();
      // Always send is_final and complited as string ('yes'/'no') only
      const upsertPayload = {
        match_id: matchId,
        home_goals: homeGoals,
        away_goals: awayGoals,
        result: resultString,
        winner: winnerStr,
        is_final: 'yes', // Always string
        complited: 'yes', // Always string
        is_locked: true,
        match_duration: 90,
        week: Math.max(1, Math.min(week, 36)),
        updated_at: now,
        created_at: now,
        goal_timings: '[]',
        status: 'settled',
        result_version: 0,
        btts_result: (homeGoals > 0 && awayGoals > 0),
        ov15_result: (homeGoals + awayGoals) > 1.5,
        ov25_result: (homeGoals + awayGoals) > 2.5,
        total_goals_result: homeGoals + awayGoals,
        goals_odd_even_result: ((homeGoals + awayGoals) % 2 === 1) ? 'odd' : 'even',
        correct_score_result: resultString,
        bet_type: null,
        amount: null,
        odds: null,
        potential_win: null,
        result_amount: null,
        placed_at: now,
        settled_at: now,
        selection: null,
        stake: null,
        bet_category: null,
        threshold: null,
        first_goal_time: null,
        half_time_home_goals: null,
        half_time_away_goals: null,
        btts_selection: null,
        ov15_selection: null,
        ov25_selection: null,
        total_goals_selection: null,
        first_goal_time_selection: null,
        goals_odd_even_selection: null,
        correct_score_selection: null,
        last_calculated_at: now,
        calculation_count: 1,
        needs_recalculation: false,
        result_changed: false,
        previous_result: null,
        next_recalculation_at: null,
        result_sync_version: 1,
        last_sync_at: now
      };
      // Validate before DB write
      const errors = validateMatchData(upsertPayload);
      if (errors.length > 0) {
        console.error('Validation errors:', errors);
        return false;
      }
      // Log payload for debugging
      console.log('match_results upsertPayload:', JSON.stringify(upsertPayload));
      const { data: upserted, error: upsertError } = await supabase
        .from('match_results')
        .upsert([upsertPayload], { onConflict: 'match_id' })
        .select();
      if (upsertError) {
        console.error('Error writing final result to Supabase (upsert):', upsertError);
        // Fallback: try update
        // No boolean conversion needed: is_final and complited are always 'yes'/'no' strings
        const { error: updateError } = await supabase
          .from('match_results')
          .update(upsertPayload)
          .eq('match_id', String(matchId));
        if (updateError) {
          console.error('Error writing final result to Supabase (update fallback):', updateError);
        } else {
          console.log('✅ Final match result updated via fallback for', matchId);
        }
      } else {
        console.log('✅ Final match result written to Supabase for', matchId, upserted);
        // Immediately resolve all pending bets for this match
        try {
          const { resolved, error: resolveError } = await resolveBetsForMatch(matchId, homeGoals, awayGoals);
          if (resolveError) {
            console.error('Error resolving bets after final result:', resolveError);
          } else {
            console.log(`✅ Resolved ${resolved} bets for match ${matchId}`);
          }
        } catch (resolveException) {
          console.error('Exception resolving bets after final result:', resolveException);
        }
      }
      window.dispatchEvent(new CustomEvent('match-final-result', {
        detail: { matchId, homeGoals, awayGoals, winner: winnerStr, isFinal: true }
      }));
      return true;
    } catch (error) {
      console.error('Error saving final result:', error);
      return false;
    }
  }
  // Declare these states BEFORE any effect that uses them
  const [stake, setStake] = useState("");
  const [betPlaced, setBetPlaced] = useState(false);
  const [timeSlots, setTimeSlots] = useState([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [selectedMatchup, setSelectedMatchup] = useState(null);
  // Dynamic bet types state - will update when match finishes
  const [dynamicBetTypes, setDynamicBetTypes] = useState(betTypes);
  const [selectedBetType, setSelectedBetType] = useState(betTypes[0]);
  const [selectedSelection, setSelectedSelection] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState(leagues[0].countryCode);
  const [matchupsByTimeframe, setMatchupsByTimeframe] = useState({});
  const [matchResultsById, setMatchResultsById] = useState<Record<string, { home_goals: number; away_goals: number; winner: 'home' | 'away' | 'draw'; is_final: 'yes' | 'no' }>>({});
  const [selectedBetTypesByMatch, setSelectedBetTypesByMatch] = useState({});
  const [selectedBetTypeForMatch, setSelectedBetTypeForMatch] = useState<string | null>(null);
  // Cache for match simulations: { [matchId]: { homeGoals, awayGoals, winner, events } }
  const [matchSimCache, setMatchSimCache] = useState({});
  const [showModal, setShowModal] = useState(false);
  // Removed duplicate betSlip/setBetSlip declaration to fix redeclaration error

  // Declare matchTimer BEFORE any effect that uses it
  // (Declaration moved below to avoid redeclaration)

  // ...existing code...

    // In the match playing effect, update scores in real-time
    React.useEffect(() => {
      if (matchState === 'playing' && selectedTimeSlot) {
        const matches = matchupsByTimeframe[selectedTimeSlot.toISOString()];
        if (matches) {
          matches.forEach((match: any) => {
            const sim = matchSimCache[match.id];
            if (sim) {
              // Calculate progressive score at current match minute
              const progressiveScore = getProgressiveScore(Array.isArray(sim?.events) ? sim.events : [], matchTimer) || { home: 0, away: 0 };
              // Save to localStorage every 5 match minutes
              if (matchTimer % 5 === 0) {
                saveFinalMatchResult(
                  match.id,
                  progressiveScore.home,
                  progressiveScore.away,
                  // For live (not final), winner can be determined as follows:
                  progressiveScore.home > progressiveScore.away
                    ? 'home'
                    : progressiveScore.home < progressiveScore.away
                    ? 'away'
                    : 'draw'
                );
              }
              // Save final result when match ends
              if (matchTimer >= 90) {
                saveFinalMatchResult(
                  match.id,
                  sim.homeGoals,
                  sim.awayGoals,
                  sim?.winner ?? 'draw'
                );
              }
            }
          });
        }
      }
    }, [matchState, matchTimer, selectedTimeSlot, matchupsByTimeframe, matchSimCache]);

    // Also update when entering betting phase
    React.useEffect(() => {
      if (matchState === 'betting' && selectedTimeSlot) {
        const matches = matchupsByTimeframe[selectedTimeSlot.toISOString()];
        if (matches) {
          matches.forEach((match: any) => {
            const sim = matchSimCache[match.id];
            if (sim) {
              // Ensure final results are saved
              saveFinalMatchResult(
                match.id,
                sim.homeGoals,
                sim.awayGoals,
                sim.winner
              );
            }
          });
        }
      }
    }, [matchState, selectedTimeSlot, matchupsByTimeframe, matchSimCache]);
  // Full-page guard: show neutral loading until global sync completes
  const LoadingGuard = () => (
    <div className="flex items-center justify-center h-[60vh] text-center">
      <div>
        <div className="animate-pulse text-xl font-semibold">Syncing global schedule…</div>
        <div className="mt-2 text-sm text-gray-500">Ensuring everyone sees the same matches worldwide.</div>
      </div>
    </div>
  );
  const [isPlacingBet, setIsPlacingBet] = useState<boolean>(false);

  // Fetch user data with realtime balance updates
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Get current user from session
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log("No user session found");
          return;
        }

        setUser(user);
        console.log("User session established:", user.id);

        // Fetch user balance from users table
        const { data: userData, error: balanceError } = await supabase
          .from("users")
          .select("balance")
          .eq("id", user.id);

        if (balanceError) {
          console.error("Error fetching balance:", balanceError);
        } else if (userData && userData.length > 0) {
          setBalance(userData[0].balance || 0);
          console.log("Balance loaded:", userData[0].balance);
        } else {
          console.warn("No user record found in users table");
          setBalance(0);
        }
      } catch (error) {
        console.error("Error in fetchUserData:", error);
      }
    };

    fetchUserData();
  }, []);

  // Subscribe to realtime balance updates via Supabase
  const { balance: realtimeBalance } = useRealtimeBalance({
    userId: user?.id,
    onBalanceChange: (newBalance) => {
      console.log("✨ Balance updated in real-time:", newBalance);
      setBalance(newBalance);
    },
    onError: (error) => {
      console.error("Balance subscription error:", error);
    }
  });

  // Use realtime balance if available, otherwise fall back to local state
  useEffect(() => {
    if (realtimeBalance !== null && realtimeBalance !== undefined) {
      setBalance(realtimeBalance);
    }
  }, [realtimeBalance]);

  // Sync global system state with Supabase - all users see the same thing
  // Sync global system state with Supabase on mount
  useEffect(() => {
    let unsubscribe: any = null;

    const setupRealtimeSync = async () => {
      try {
        // CHECK: Only setup Supabase sync if global time system is NOT active
        const isGlobalTimeActive = localStorage.getItem('global_match_schedule_initialized') !== null;
        
        if (isGlobalTimeActive) {
          console.log('✅ Global time system is active - SKIPPING Supabase realtime sync');
          return;
        }

        // Subscribe to realtime changes
        unsubscribe = supabase
          .channel('betting_system_state_changes')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'betting_system_state' },
            (payload) => {
              const newData = (payload.new || {}) as any;
              const newState = {
                currentWeek: newData?.current_week || 1,
                currentTimeframeIdx: newData?.current_timeframe_idx || 0,
                matchState: newData?.match_state || 'pre-countdown',
                countdown: newData?.countdown || 10,
                lastUpdated: new Date().toISOString(),
              };
              console.log('✨ System state changed globally:', newState);
              // Don't save to localStorage - we always recalculate on reload
              // Dispatch event for component to listen to
              window.dispatchEvent(new CustomEvent('systemStateChanged', { detail: newState }));
            }
          )
          .subscribe();
      } catch (err) {
        console.error('Failed to setup realtime sync:', err);
      }
    };

    setupRealtimeSync();

    return () => {
      if (unsubscribe) {
        unsubscribe.unsubscribe();
      }
    };
  }, []);

        // Fixture set cycling logic
        // Use a very large number to avoid cycling/repeating fixture sets
        const totalFixtureSets = 10000; // Support up to 10,000 unique fixture sets
        const totalWeeks = 36;
        // Track current fixture set and week (timeframe)
  // --- GLOBAL SYSTEM STATE: fixtureSetIdx and fixtureSalt ---
  // These must be defined at the top of the component, before any use
  // ...existing code...
        // Number of games per timeframe
        const gamesPerTimeframe = 5;
        const [selectedFixtureCountry, setSelectedFixtureCountry] = useState(leagues[0].countryCode);
        const [fixtureSchedule, setFixtureSchedule] = useState<any[]>([]);
    // Fixture modal state


        const [showFixture, setShowFixture] = useState(false);


        // --- Week 36 reset and reshuffle logic ---
        // On app startup and every hour, check if week 36 is completed, then reshuffle fixtures using only the static generator
  // Only generate fixture schedule after globalStateLoaded is true
  React.useEffect(() => {
    if (!globalStateLoaded) return;
    // Calculate correct week from global time
    const schedule = getGlobalSchedule();
    const now = new Date(getNowWithServerOffset());
    const globalIdx = Math.floor((now.getTime() - schedule.referenceEpoch) / (schedule.matchInterval * 60000));
    const weekIdx = ((globalIdx % totalWeeks) + totalWeeks) % totalWeeks;
    setCurrentTimeframeIdx(weekIdx);
    setLiveTimeframeIdx(weekIdx);
    setLoadingWeek(false);
    // Set the fixture schedule to the correct league's fixture set
    const leagueIdx = leagues.findIndex(l => l.countryCode === selectedFixtureCountry);
    const salt = getGlobalFixtureSalt({fixtureSetIdx, fixtureSalt});
    const newSchedule = leagueIdx !== -1 ? getFixtureSet(leagues[leagueIdx], fixtureSetIdx, salt) : getFixtureSet(leagues[0], fixtureSetIdx, salt);
    setFixtureSchedule(newSchedule);
  }, [selectedFixtureCountry, fixtureSetIdx, fixtureSalt, globalStateLoaded]);

  // Set globalStateLoaded to true after initial load (or when appropriate)
  React.useEffect(() => {
    // You may want to add more robust logic here to check if all global state is loaded
    setGlobalStateLoaded(true);
  }, []);

        // ...existing code...

    // Listen for global system state changes and update component state
    useEffect(() => {
      const handleSystemStateChange = (event: any) => {
        const newState = event.detail;
        console.log('📡 [ROBUST SYNC] Updating UI state from global state:', newState);
        // Always sync to global state
        setCurrentTimeframeIdx(newState.currentTimeframeIdx);
        setLiveTimeframeIdx(newState.currentTimeframeIdx);
        setFixtureSetIdx(newState.fixtureSetIdx);
        setMatchState(parseMatchState(String(newState.matchState)));
        setFixtureSalt(newState.fixtureSalt || String(newState.fixtureSetIdx || '0'));
        // Always recalculate countdown based on global state and local time
        let safeCountdown = typeof newState.countdown === 'number' ? newState.countdown : PRE_COUNTDOWN_SECONDS;
        if (typeof safeCountdown !== 'number' || isNaN(safeCountdown) || safeCountdown < 0) {
          safeCountdown = PRE_COUNTDOWN_SECONDS;
        }
        setCountdown(safeCountdown);
        if (timeSlots && timeSlots.length > 0) {
          const schedule = getGlobalSchedule();
          const targetTime = calculateScheduledTime(newState.currentTimeframeIdx, schedule).getTime();
          const slotIdx = timeSlots.findIndex(slot => Math.abs(slot.getTime() - targetTime) < 60000);
          if (slotIdx !== -1) {
            setSelectedTimeSlot(timeSlots[slotIdx]);
          } else {
            let minDiff = Infinity, minIdx = 0;
            for (let i = 0; i < timeSlots.length; i++) {
              const diff = Math.abs(timeSlots[i].getTime() - targetTime);
              if (diff < minDiff) {
                minDiff = diff;
                minIdx = i;
              }
            }
            setSelectedTimeSlot(timeSlots[minIdx]);
          }
        }
        if (newState.matchState === 'pre-countdown') {
          setMatchTimer(0);
          setBettingTimer(BETTING_WINDOW_SECONDS);
        } else if (newState.matchState === 'playing') {
          setMatchTimer(newState.matchTimer || 0);
          setBettingTimer(BETTING_WINDOW_SECONDS);
        } else if (newState.matchState === 'betting') {
          setMatchTimer(90);
          // Always use safe fallback for betting timer
          let safeBettingTimer = typeof newState.countdown === 'number' ? newState.countdown : BETTING_WINDOW_SECONDS;
          if (typeof safeBettingTimer !== 'number' || isNaN(safeBettingTimer) || safeBettingTimer < 0) {
            safeBettingTimer = BETTING_WINDOW_SECONDS;
          }
          setBettingTimer(safeBettingTimer);
        }
        setWaitingGlobalState(false);
      };

      window.addEventListener('systemStateChanged', handleSystemStateChange);
      return () => {
        window.removeEventListener('systemStateChanged', handleSystemStateChange);
      };
    }, []);

  // Note: avoid early return here to preserve consistent hook order.
  // The LoadingGuard will be rendered conditionally within the main JSX.

    // Generate fixture schedule for all leagues, weeks 1-36
    // No longer needed: generateLeagueFixtures

    // Deterministic pseudo-random from string (matchId) for consistent odds
    function seededNumberFromString(str: string) {
      let hash = 2166136261;
      for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = (hash * 16777619) >>> 0;
      }
      // Normalize to [0,1)
      return (hash % 100000) / 100000;
    }

    function getDeterministicOdds(matchId: string) {
      const base = seededNumberFromString(matchId);
      // Spread two values deterministically
      const overSeed = seededNumberFromString(matchId + ':over');
      const underSeed = seededNumberFromString(matchId + ':under');
      const over = (1.20 + overSeed * 0.15);
      const under = (3.40 + underSeed * 0.90);
      return { overOdds: over.toFixed(2), underOdds: under.toFixed(2) };
    }

  // Duplicate declaration removed here
    const [betSlip, setBetSlip] = useState<any>(null);
    // New states for countdown and transitions
  // Robust countdown: always sync with global state
  const [countdown, setCountdown] = useState(PRE_COUNTDOWN_SECONDS);
  const countdownRef = useRef(PRE_COUNTDOWN_SECONDS);
  useEffect(() => { countdownRef.current = countdown; }, [countdown]);
      // Robust sync: ensure UI always advances to the next match after 90, even if effects miss a beat
      // Removed local effect that advanced week/slot during betting phase based on current time.
      // The UI now only uses the global state from Supabase for week/slot during the betting phase.
  // Only one matchTimer declaration should exist in the component!
  // (Moved above to ensure it's declared before use)
  // ...existing code...

  // Effect: Handle pre-countdown phase (5s countdown before match starts)
  // Always allow countdown and transition to playing, even if admin outcome is present
  // Robust countdown effect: always sync with global state, avoid drift
  React.useEffect(() => {
    let timer: any = null;
    if (matchState === 'pre-countdown' && currentTimeframeIdx === liveTimeframeIdx) {
      timer = setInterval(() => {
        setCountdown(prev => {
          // Always check if global state has changed the countdown
          const globalCountdown = typeof prev === 'number' ? prev : PRE_COUNTDOWN_SECONDS;
          // If countdown is 0 or less, transition
          if (globalCountdown <= 1) {
            clearInterval(timer);
            setMatchState('playing');
            setCountdown(0);
            setMatchTimer(0);
            return 0;
          }
          // If global state has updated countdown (e.g., via Supabase), use it
          if (countdownRef.current !== prev) {
            return countdownRef.current;
          }
          // Otherwise, decrement locally
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [matchState, currentTimeframeIdx, liveTimeframeIdx]);

  // --- Fallback: Auto-recover stuck countdown or phase ---
  React.useEffect(() => {
    // If in pre-countdown or betting, but countdown is not running, force a sync/reset
    // This effect runs every 3 seconds
    const fallbackInterval = setInterval(() => {
      // Only run if not loading and global state is loaded
      if (!loadingWeek && globalStateLoaded) {
        // If in pre-countdown or betting, and countdown is stuck (not decrementing)
        if ((matchState === 'pre-countdown' || matchState === 'betting') && countdown <= 0) {
          // Force a sync from global state (simulate event)
          console.warn('[FALLBACK] Countdown stuck, forcing global state sync/reset.');
          // Option 1: Force a local reset
          setCountdown(PRE_COUNTDOWN_SECONDS);
          if (matchState === 'pre-countdown') {
            setMatchState('playing');
            setMatchTimer(0);
          } else if (matchState === 'betting') {
            setMatchState('pre-countdown');
            setCountdown(PRE_COUNTDOWN_SECONDS);
            setMatchTimer(0);
          }
        }
      }
    }, 3000);
    return () => clearInterval(fallbackInterval);
  }, [matchState, countdown, loadingWeek, globalStateLoaded]);

  // Global progression guard: only one client drives updates
  const [isLeader, setIsLeader] = useState<boolean>(false);
// Effect: Handle live match timer during 'playing' phase
React.useEffect(() => {
  let timer: any = null;
  if (matchState === 'playing' && currentTimeframeIdx === liveTimeframeIdx) {
    timer = setInterval(() => {
      setMatchTimer(prev => {
        if (prev >= 89) {
          clearInterval(timer);
          setMatchState('betting');
          setBettingTimer(BETTING_WINDOW_SECONDS);
          return 90;
        }
        return prev + 1;
      });
    }, 1000);
  }
  return () => { if (timer) clearInterval(timer); };
}, [matchState, matchTimer, currentTimeframeIdx, liveTimeframeIdx]);
  // Admin control states
  const [adminMode, setAdminMode] = useState(false);
  // Global admin outcomes for ALL matches in the fixture set, fetched from Supabase
  const [adminOutcomes, setAdminOutcomes] = useState<Record<string, { homeGoals: number; awayGoals: number; winner?: string }>>({});
  // Fetch global admin outcomes for all matches in the fixture set whenever fixtureSchedule or country changes

  // Always listen for admin outcome changes in real time
  useEffect(() => {
    let channel: any = null;
    async function fetchAndSubscribeAdminOutcomes() {
      if (!fixtureSchedule || !Array.isArray(fixtureSchedule)) return;
      // Gather ALL matchIds for all weeks in the fixture set
      const allMatchIds: string[] = [];
      fixtureSchedule.forEach((week, weekIdx) => {
        (week.matches || []).forEach((fixture, i) => {
          allMatchIds.push(getMatchId(selectedCountry, weekIdx, i, fixture.home.shortName, fixture.away.shortName));
        });
      });
      if (allMatchIds.length === 0) return;
      const updateAdminOutcomes = async () => {
        const outcomes = await getFixtureOutcomesForWeek(allMatchIds);
        const map: Record<string, { homeGoals: number; awayGoals: number; winner?: string; updated_at?: string }> = {};
        (outcomes || []).forEach((o: any) => {
          map[o.match_id] = {
            homeGoals: o.home_goals,
            awayGoals: o.away_goals,
            winner: o.result,
            updated_at: o.updated_at,
          };
        });
        setAdminOutcomes(map);
      };
      await updateAdminOutcomes();
      // Subscribe to changes in the outcomes table
      channel = supabase
        .channel('admin_outcomes_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'fixture_outcomes' }, async (payload) => {
          // Only update if the match is in our current fixture set
          if (payload.new && typeof payload.new === 'object' && 'match_id' in payload.new && allMatchIds.includes(payload.new.match_id)) {
            await updateAdminOutcomes();
          }
        })
        .subscribe();
    }
    fetchAndSubscribeAdminOutcomes();
    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [fixtureSchedule, selectedCountry]);

  // Re-fetch admin outcomes when slot/timeframe changes (for late joiners or admin updates)
  useEffect(() => {
    async function refetchOnSlotChange() {
      if (!fixtureSchedule || !Array.isArray(fixtureSchedule)) return;
      const allMatchIds: string[] = [];
      fixtureSchedule.forEach((week, weekIdx) => {
        (week.matches || []).forEach((fixture, i) => {
          allMatchIds.push(getMatchId(selectedCountry, weekIdx, i, fixture.home.shortName, fixture.away.shortName));
        });
      });
      if (allMatchIds.length === 0) return;
      const outcomes = await getFixtureOutcomesForWeek(allMatchIds);
      const map: Record<string, { homeGoals: number; awayGoals: number; winner?: string; updated_at?: string }> = {};
      (outcomes || []).forEach((o: any) => {
        map[o.match_id] = {
          homeGoals: o.home_goals,
          awayGoals: o.away_goals,
          winner: o.result,
          updated_at: o.updated_at,
        };
      });
      setAdminOutcomes(map);
    }
    refetchOnSlotChange();
  }, [currentTimeframeIdx, selectedTimeSlot]);
  const [showCorrectScoreForMatch, setShowCorrectScoreForMatch] = useState<string | null>(null);
  // Bet slip history state
  const { saveBetSlip } = useBetSlipHistory();
  const [showBetSlipHistory, setShowBetSlipHistory] = useState(false);
  const [betSlipName, setBetSlipName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Admin: Initialize global backend state row if missing
  const initializeGlobalBackendState = async () => {
    try {
      const defaultState = {
        currentWeek: 1,
        currentTimeframeIdx: 0,
        matchState: 'pre-countdown',
        countdown: PRE_COUNTDOWN_SECONDS,
      };
      const { error } = await supabase
        .from('betting_system_state')
        .upsert({
          id: SYSTEM_STATE_ID,
          current_week: defaultState.currentWeek,
          current_timeframe_idx: defaultState.currentTimeframeIdx,
          match_state: defaultState.matchState,
          countdown: defaultState.countdown,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
      if (error) {
        return;
      }
      console.log('✅ Global backend state initialized');
      setWaitingGlobalState(false);
      setCurrentTimeframeIdx(defaultState.currentTimeframeIdx);
      setLiveTimeframeIdx(defaultState.currentTimeframeIdx);
      setMatchState(parseMatchState(defaultState.matchState));
      setCountdown(defaultState.countdown);
      // Broadcast locally so any listeners update
      window.dispatchEvent(new CustomEvent('systemStateChanged', { detail: defaultState }));
    } catch (e) {
      console.error('Exception initializing global state:', e);
    }
  };

  // Always use the correct fixture set and week for the main match display
  const league = leagues.find(l => l.countryCode === selectedCountry);
  const countryFixtureSchedule = React.useMemo(() => {
    if (!league) return [];
    return getFixtureSet(league, fixtureSetIdx, fixtureSalt);
  }, [league, fixtureSetIdx, fixtureSalt]);
  const teams = league ? league.teams : [];


  // The matches for the current global week
  const currentWeekMatches =
    currentTimeframeIdx !== null && countryFixtureSchedule[currentTimeframeIdx]?.matches
      ? countryFixtureSchedule[currentTimeframeIdx].matches
      : [];
  // Combine loading states
  const isLoading = loadingWeek || currentTimeframeIdx === null || !globalStateLoaded;
  // ...existing code...
        // In main JSX return below, add:
        // {isLoading && (
        //   <div className="flex flex-col items-center justify-center h-96">
        //     <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-500 mb-4"></div>
        //     <div className="text-lg text-purple-500">Loading correct match week...</div>
        //   </div>
        // )}

  // Remove generateAllMatchups and shuffleArray, not needed for fixture-based scheduling

  // Real-time update every 2 minutes (will be replaced by new flow)
  React.useEffect(() => {
    // When country, week, fixture set, or global state changes, always use the correct fixture set for that country
    // Use ONLY the static generator for fixtures
    const leagueIdx = leagues.findIndex(l => l.countryCode === selectedCountry);
    const salt = getGlobalFixtureSalt({fixtureSetIdx});
    const newSchedule = leagueIdx !== -1 ? getFixtureSet(leagues[leagueIdx], fixtureSetIdx, salt) : getFixtureSet(leagues[0], fixtureSetIdx, salt);
    setFixtureSchedule(newSchedule);

    // --- AUTO-ADVANCE FIXTURE SET LOGIC ---
    // If week exceeds 35, advance to next fixture set (global, not per-league)
    let newSetIdx = fixtureSetIdx;
    let newWeekIdx = currentTimeframeIdx;
    if (currentTimeframeIdx >= totalWeeks) {
      // Instead of cycling, always increment fixtureSetIdx (never repeat)
      newSetIdx = fixtureSetIdx + 1;
      newWeekIdx = 0;
      saveSystemStateToSupabase({
        currentWeek: newWeekIdx + 1,
        currentTimeframeIdx: newWeekIdx,
        fixtureSetIdx: newSetIdx,
        matchState,
        countdown,
      });
      // Immediately update local state to reflect the new season
      setFixtureSetIdx(newSetIdx);
      setCurrentTimeframeIdx(newWeekIdx);
      // Load the new fixture set for the new season
      const updatedSchedule = leagueIdx !== -1 ? getFixtureSet(leagues[leagueIdx], newSetIdx, salt) : getFixtureSet(leagues[0], newSetIdx, salt);
      setFixtureSchedule(updatedSchedule);
      return;
    }

    const slots = getTimeSlots(120);
    setTimeSlots(slots);

    // Set selectedTimeSlot to the current real-time timeframe slot
    if (!waitingGlobalState && slots.length > 0) {
      const now = new Date(getNowWithServerOffset());
      const nearestIdx = getSlotIndexForTime(now, slots);
      const safeIdx = nearestIdx >= 0 ? nearestIdx : Math.floor(slots.length / 2);
      setSelectedTimeSlot(slots[safeIdx]);
      console.log('📍 Selected time slot set to nearest-now index:', safeIdx);
    }

    // Load matches using TRUE global time system - all users see SAME match at SAME time
    const loadGlobalTimeMatches = async (scheduleForLeague: any[], slotsList: Date[]) => {
      const newMatchups = {} as Record<string, any>;
      const newSimCache = {} as Record<string, any>;

      // For each slot, show only matches from the current global week, in fixture order
      // Always use the correct fixture set, salt, and week index
      const weekIdx = currentTimeframeIdx;
      const matches = countryFixtureSchedule[weekIdx]?.matches || [];
      slotsList.forEach((slot) => {
        const matchesForSlot = [];
        for (let matchIdx = 0; matchIdx < Math.min(matches.length, 9); matchIdx++) {
          const fixture = matches[matchIdx];
          if (!fixture) continue;
          const homeTeam = fixture.home;
          const awayTeam = fixture.away;
          const matchId = getMatchId(selectedCountry, weekIdx, matchIdx, homeTeam.shortName, awayTeam.shortName);
          // Debug: Log matchId and all parameters used to generate it
          if (window && window.console) {
            const matchIdParams = {
              league: selectedCountry,
              weekIdx,
              matchIdx,
              homeShort: homeTeam.shortName,
              awayShort: awayTeam.shortName
            };
            if (adminOutcomes && adminOutcomes[matchId]) {
              console.log('[BetXPesa ]', matchId, 'params:', matchIdParams, adminOutcomes[matchId]);
            } else {
              console.warn('[BetXPesa ]', matchId, 'params:', matchIdParams);
            }
          }
          // Always use admin outcome if present (with versioning)
          // Fallback: if no admin outcome for this matchId, try to find one with same league, week, home, away
          let adminOutcome = adminOutcomes && adminOutcomes[matchId] ? adminOutcomes[matchId] : null;
          if (!adminOutcome && adminOutcomes) {
            const matchIdPattern = new RegExp(`^league-${selectedCountry}-week-${weekIdx + 1}-match-\\d+-${homeTeam.shortName}-vs-${awayTeam.shortName}$`);
            for (const key in adminOutcomes) {
              if (matchIdPattern.test(key)) {
                adminOutcome = adminOutcomes[key];
                break;
              }
            }
          }
          const simResult = simulateMatch(matchId, 40, adminOutcome);
          newSimCache[matchId] = simResult;
          // Deterministic odds from matchId (consistent across devices)
          const { overOdds, underOdds } = getDeterministicOdds(matchId);
          matchesForSlot.push({
            id: matchId,
            homeTeam,
            awayTeam,
            kickoffTime: slot,
            overOdds,
            underOdds,
            outcome: null,
          });
        }
        newMatchups[slot.toISOString()] = matchesForSlot;
      });
      setMatchupsByTimeframe(newMatchups);
      setMatchSimCache(newSimCache);
    };

    loadGlobalTimeMatches(countryFixtureSchedule, slots);
    console.log('🌐 Global sync active - all users worldwide seeing same matches at ' + new Date().toISOString());
  }, [selectedCountry, currentTimeframeIdx, fixtureSetIdx, fixtureSalt, waitingGlobalState]);

  // Elect a leader client (admin or first viewer) to drive global progression
  React.useEffect(() => {
    const leaderKey = 'global_state_leader';
    const existing = localStorage.getItem(leaderKey);
    if (!existing) {
      localStorage.setItem(leaderKey, (user?.id || Date.now().toString()));
    }
    const isMeLeader = localStorage.getItem(leaderKey) === (user?.id || localStorage.getItem(leaderKey));
    setIsLeader(!!isMeLeader);
    const onStorage = (e: StorageEvent) => {
      if (e.key === leaderKey) {
        const nowLeader = localStorage.getItem(leaderKey) === (user?.id || localStorage.getItem(leaderKey));
        setIsLeader(!!nowLeader);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [user?.id]);

  // Leader heartbeat: persist current global state every second (no local mutations)
  React.useEffect(() => {
    if (waitingGlobalState) return;
    if (!isLeader) return;
    const interval = setInterval(() => {
      const state = {
        currentWeek: ((currentTimeframeIdx % totalWeeks) + 1),
        currentTimeframeIdx,
        fixtureSetIdx,
        matchState,
        countdown,
      };
      console.debug('🫧 Leader heartbeat persist:', state);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      saveSystemStateToSupabase(state);
    }, 1000);
    return () => clearInterval(interval);
  }, [waitingGlobalState, isLeader, currentTimeframeIdx, fixtureSetIdx, matchState, countdown]);
  
  // Update liveTimeframeIdx based on global time system (every 5 seconds)
  React.useEffect(() => {
    // Only sync live timeframe from global time when global time is enabled
    if (!isGlobalTimeEnabled()) {
      return;
    }
    const updateLiveIdx = () => {
      const schedule = getGlobalSchedule();
      const nowIdx = Math.floor((getNowWithServerOffset() - schedule.referenceEpoch) / (schedule.matchInterval * 60000));
      const weekIdx = ((nowIdx % totalWeeks) + totalWeeks) % totalWeeks;
      setLiveTimeframeIdx(weekIdx);
      console.log('🔄 Updated liveTimeframeIdx to week:', weekIdx);
    };
    updateLiveIdx();
    const interval = setInterval(updateLiveIdx, 5000);
    return () => clearInterval(interval);
  }, []);



  // Separate effect for betting and auto-advance week
  // Unified betting phase auto-advance with robust week 36 detection
  React.useEffect(() => {
    if (matchState !== 'betting') return;
    let timer: any = null;
    const advanceToNextWeek = async () => {
      if (lastAdvancedWeekRef.current === currentTimeframeIdx) return;
      lastAdvancedWeekRef.current = currentTimeframeIdx;
      let newWeekIdx = currentTimeframeIdx + 1;
      let newSetIdx = fixtureSetIdx;
      let newSalt = fixtureSalt;
      // Check if we're moving FROM week 36 (not TO week 36)
      const isMovingFromWeek36 = (currentTimeframeIdx + 1) === 36;
      if (isMovingFromWeek36) {
        newSetIdx = fixtureSetIdx + 1;
        newWeekIdx = 0;
        newSalt = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        setFixtureSalt(newSalt);
        // Optionally clear old data here if needed
        // ...
        console.log('🎉 WEEK 36 COMPLETED - Starting new season with fixture set:', newSetIdx);
      }
      await saveSystemStateToSupabase({
        currentWeek: newWeekIdx + 1,
        currentTimeframeIdx: newWeekIdx,
        fixtureSetIdx: newSetIdx,
        fixtureSalt: newSalt,
        matchState: 'pre-countdown',
        countdown: PRE_COUNTDOWN_SECONDS,
      });
      setFixtureSetIdx(newSetIdx);
      setCurrentTimeframeIdx(newWeekIdx);
      setResultsSavedForPhase(false);
    };
    if (bettingTimer > 0) {
      timer = setInterval(() => {
        setBettingTimer(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            advanceToNextWeek();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      advanceToNextWeek();
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [matchState, bettingTimer, currentTimeframeIdx, fixtureSetIdx, fixtureSalt]);

  // UPDATE ODDS WHEN ENTERING BETTING PHASE - calculate dynamic odds based on match result
    // Fallback: If in 'betting' but selectedTimeSlot does not match the current global match, force update
    React.useEffect(() => {
      if (matchState !== 'betting' || !timeSlots || timeSlots.length === 0) return;
      const schedule = getGlobalSchedule();
      const now = getNowWithServerOffset();
      const nowIdx = Math.floor((now - schedule.referenceEpoch) / (schedule.matchInterval * 60000));
      const weekIdx = ((nowIdx % totalWeeks) + totalWeeks) % totalWeeks;
      const upcomingStart = calculateScheduledTime(nowIdx, schedule);
      // If UI is not showing the correct match, force update
      if (
        currentTimeframeIdx < weekIdx ||
        !selectedTimeSlot ||
        (selectedTimeSlot && Math.abs(selectedTimeSlot.getTime() - upcomingStart.getTime()) > 60000)
      ) {
        setCurrentTimeframeIdx(weekIdx);
        setLiveTimeframeIdx(weekIdx);
        setSelectedTimeSlot(upcomingStart);
        setMatchTimer(90);
        setBettingTimer(BETTING_WINDOW_SECONDS);
        console.log('[FALLBACK SYNC] Forced UI to correct match in betting phase.');
      }
    }, [matchState, currentTimeframeIdx, selectedTimeSlot, timeSlots, liveTimeframeIdx]);
  React.useEffect(() => {
    // Only update dynamic odds if we're viewing the timeframe that just finished
    if (matchState === 'betting' && selectedTimeSlot && matchupsByTimeframe[selectedTimeSlot.toISOString()] && currentTimeframeIdx === liveTimeframeIdx) {
      console.log('💰 [ODDS UPDATE] Entering betting phase - recalculating odds based on match results');
      
      // Get the matches for this timeframe
      const matches = matchupsByTimeframe[selectedTimeSlot.toISOString()];
      
      // Calculate odds for each match and store in cache
      const updatedBetTypes: any = {};
      
      matches.forEach((match: any) => {
        const sim = matchSimCache[match.id];
        if (sim) {
          const homeGoals = sim.homeGoals;
            // Only update odds after the match has finished (after 90 minutes)
            if (matchTimer < 90) {
              // Don't show results or odds yet, mark as pending
                // Set complited to 'yes' if match reached 90 minutes, else 'no' (always string)
                updatedBetTypes[match.id] = null;
                const complitedStr: 'yes' | 'no' = matchTimer >= 90 ? 'yes' : 'no';
                supabase
                  .from('match_results')
                  .update({ complited: complitedStr })
                  .eq('match_id', String(match.id))
                  .then(({ error }) => {
                    if (error) {
                      console.error('Failed to update complited status:', error);
                    }
                  });
              return;
            }
            if (matchTimer < 90) return;
            const awayGoals = sim.awayGoals;

            // Ensure match results are sent to Supabase after 90', even for draws
            if (matchTimer >= 90 && sim && typeof sim.homeGoals === "number" && typeof sim.awayGoals === "number") {
            // Update the match_results table with completed status "yes"
            // Ensure "complited" is set to "yes" only after 90 minutes
            if (matchTimer >= 90) {
              saveFinalMatchResult(
              match.id,
              sim.homeGoals,
              sim.awayGoals,
              sim.winner ?? (
                sim.homeGoals > sim.awayGoals ? "home" :
                sim.awayGoals > sim.homeGoals ? "away" : "draw"
              )
              );
            }
            // Defensive: always send complited as string
            supabase
              .from('match_results')
              .update({ complited: 'yes' })
              .eq('match_id', String(match.id))
              .then(({ error }) => {
                if (error) {
                  console.error('Failed to update complited status:', error);
                }
              });
            }
          
          console.log(`⚡ Updating odds for ${match.homeTeam.shortName} vs ${match.awayTeam.shortName}: ${homeGoals}-${awayGoals}`);
          
          // Calculate dynamic odds for this match
          const dynamicOdds = calculateDynamicOdds(homeGoals, awayGoals);
          updatedBetTypes[match.id] = dynamicOdds;
        }
      });
      
      // Update the dynamic bet types state with calculated odds
      if (Object.keys(updatedBetTypes).length > 0) {
        // Store per-match odds in a way we can access them
        setSelectedBetTypesByMatch(updatedBetTypes);
        
        // Update default bet types to show the first match's odds
        const firstMatchId = matches[0]?.id;
        if (firstMatchId && updatedBetTypes[firstMatchId]) {
          const firstMatchOdds = updatedBetTypes[firstMatchId]['1X2'];
          setDynamicBetTypes(prev => [
            { type: "1X2", ...firstMatchOdds },
            { type: "BTTS", ...updatedBetTypes[firstMatchId]['BTTS'] },
            { type: "OV/UN 1.5", ...updatedBetTypes[firstMatchId]['OV/UN 1.5'] },
            { type: "OV/UN 2.5", ...updatedBetTypes[firstMatchId]['OV/UN 2.5'] },
            { type: "Total Goals", ...updatedBetTypes[firstMatchId]['Total Goals'] },
            { type: "Time of First Goal", ...updatedBetTypes[firstMatchId]['Time of First Goal'] },
            { type: "Total Goals Odd/Even", ...updatedBetTypes[firstMatchId]['Total Goals Odd/Even'] },
          ]);
          setSelectedBetType({ type: "1X2", ...firstMatchOdds });
        }
        
        console.log('✅ [ODDS UPDATE] Dynamic odds calculated and updated');
      }
    }
  }, [matchState, selectedTimeSlot, matchupsByTimeframe, matchSimCache, currentTimeframeIdx, liveTimeframeIdx]);

  // Load history on mount
  React.useEffect(() => {
    setMatchHistory(getMatchHistory());
  }, []);

  // Fetch finalized results for past timeframes and cache by match_id
  React.useEffect(() => {
    const slotKey = selectedTimeSlot?.toISOString();
    if (!slotKey) return;
    const matches = matchupsByTimeframe[slotKey];
    if (!matches || !Array.isArray(matches)) return;
    // Past timeframe if current index is less than live index
    const isPastTimeframe = currentTimeframeIdx < liveTimeframeIdx;
    if (!isPastTimeframe) return;

    const matchIds = matches.map((m: any) => m.id);
    if (matchIds.length === 0) return;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('match_results')
          .select('match_id, home_goals, away_goals, winner, is_final')
          .in('match_id', matchIds);
        if (error) {
          console.error('Failed to fetch match_results:', error.message);
          return;
        }
        const map: Record<string, { home_goals: number; away_goals: number; winner: 'home' | 'away' | 'draw'; is_final: 'yes' | 'no' }> = {};
        (data || []).forEach((r: any) => {
          // Accept both boolean and string for is_final, but always map to 'yes'/'no'
          let is_final: 'yes' | 'no' = 'no';
          if (r.is_final === true || r.is_final === 'yes') is_final = 'yes';
          else if (r.is_final === false || r.is_final === 'no') is_final = 'no';
          else if (typeof r.is_final === 'string') is_final = r.is_final === 'yes' ? 'yes' : 'no';
          else is_final = 'no';
          map[r.match_id] = {
            home_goals: Number(r.home_goals ?? 0),
            away_goals: Number(r.away_goals ?? 0),
            winner: (r.winner as 'home' | 'away' | 'draw') ?? 'draw',
            is_final,
          };
        });
        setMatchResultsById(map);
      } catch (e) {
        console.error('Exception loading past results:', e);
      }
    })();
  }, [selectedTimeSlot, matchupsByTimeframe, currentTimeframeIdx, liveTimeframeIdx]);

  // Save results after each match simulation (when match ends) and robustly auto-advance UI
  React.useEffect(() => {
    if (matchState === 'betting' && selectedTimeSlot && matchupsByTimeframe[selectedTimeSlot.toISOString()] && !resultsSavedForPhase) {
      // ...existing match result handler logic...
      const handleMatchResults = async () => {
        // Save results for all matches in this timeframe to local history
        if (selectedTimeSlot && matchupsByTimeframe[selectedTimeSlot.toISOString()]) {
          const matches = matchupsByTimeframe[selectedTimeSlot.toISOString()];
          matches.forEach((match: any) => {
            const sim = matchSimCache[match.id];
            if (sim) {
              const result = {
          id: match.id,
          home_team: match.homeTeam.shortName,
          away_team: match.awayTeam.shortName,
          homeGoals: sim.homeGoals,
          awayGoals: sim.awayGoals,
          winner: sim.winner,
          updated_at: new Date().toISOString(),
          // Store full match object for local reference
          match: {
            ...match,
            sim,
          },
              };
              saveMatchResult(result);
            }
          });
        }
        // (copy-paste from previous effect, unchanged)
        // ...existing code...
        setMatchHistory(getMatchHistory());
        setResultsSavedForPhase(true);
        // Save match results locally for history
        if (selectedTimeSlot && matchupsByTimeframe[selectedTimeSlot.toISOString()]) {
          const matches = matchupsByTimeframe[selectedTimeSlot.toISOString()];
          matches.forEach((match: any) => {
            const sim = matchSimCache[match.id];
            if (sim) {
              const result = {
          id: match.id,
          home_team: match.homeTeam.shortName,
          away_team: match.awayTeam.shortName,
          homeGoals: sim.homeGoals,
          awayGoals: sim.awayGoals,
          winner: sim.winner,
          updated_at: new Date().toISOString(),
              };
              saveMatchResult(result);
            }
          });
        }
        // Save results for all matches in this timeframe to local history (again, for bets page resolution)
        if (selectedTimeSlot && matchupsByTimeframe[selectedTimeSlot.toISOString()]) {
          const matches = matchupsByTimeframe[selectedTimeSlot.toISOString()];
          matches.forEach((match: any) => {
            const sim = matchSimCache[match.id];
            if (sim) {
              const result = {
          id: match.id,
          home_team: match.homeTeam.shortName,
          away_team: match.awayTeam.shortName,
          homeGoals: sim.homeGoals,
          awayGoals: sim.awayGoals,
          winner: sim.winner,
          updated_at: new Date().toISOString(),
          // Store full match object for local reference
          match: {
            ...match,
            sim,
          },
              };
              // Save to localStorage for bets page resolution
              saveMatchResult(result);
            }
          });
        }
        // --- Robust auto-advance logic ---
        // After saving results, always recalculate the current global index and update UI state
        const schedule = getGlobalSchedule();
        const now = new Date(getNowWithServerOffset());
        const timeSinceEpoch = now.getTime() - schedule.referenceEpoch;
        const matchIntervalMs = schedule.matchInterval * 60000;
        const currentIdx = Math.floor(timeSinceEpoch / matchIntervalMs);
        const weekIdx = ((currentIdx % 36) + 36) % 36;

        // If global time says we should be ahead, advance
        if (weekIdx > currentTimeframeIdx) {
          console.log(`⏩ [AUTO-ADVANCE] Global time indicates we should be at Week ${weekIdx + 1}`);
          saveSystemStateToSupabase({
            currentWeek: weekIdx + 1,
            currentTimeframeIdx: weekIdx,
            fixtureSetIdx: fixtureSetIdx,
            matchState: 'pre-countdown',
            countdown: PRE_COUNTDOWN_SECONDS,
          });
          setCurrentTimeframeIdx(weekIdx);
          setLiveTimeframeIdx(weekIdx);
        } else {
          setCurrentTimeframeIdx(weekIdx);
          setLiveTimeframeIdx(weekIdx);
        }

        // Find the next available slot (if current is empty)
        if (timeSlots && timeSlots.length > 0) {
          const targetTime = schedule.referenceEpoch + currentIdx * matchIntervalMs;
          let slotIdx = timeSlots.findIndex(slot => Math.abs(slot.getTime() - targetTime) < 60000);
          if (slotIdx === -1) {
            // Fallback: pick the closest slot
            let minDiff = Infinity, minIdx = 0;
            for (let i = 0; i < timeSlots.length; i++) {
              const diff = Math.abs(timeSlots[i].getTime() - targetTime);
              if (diff < minDiff) {
                minDiff = diff;
                minIdx = i;
              }
            }
            slotIdx = minIdx;
          }
          setSelectedTimeSlot(timeSlots[slotIdx]);
        }
      };
      handleMatchResults();
    }
    // Reset flag when leaving betting phase
    if (matchState !== 'betting') {
      setResultsSavedForPhase(false);
    }
  }, [matchState, selectedTimeSlot, matchupsByTimeframe, matchSimCache, selectedCountry, resultsSavedForPhase, timeSlots]);

  // Poll system state every 2 seconds to detect when admin changes timeframe
  React.useEffect(() => {
    // CHECK: Skip polling if global time system is active
    const isGlobalTimeActive = localStorage.getItem('global_match_schedule_initialized') !== null;
    if (isGlobalTimeActive) {
      console.log('✅ Global time system is active - SKIPPING system state polling');
      return;
    }

    const pollInterval = setInterval(async () => {
      // Retrieve the current system state from Supabase
      const { data: systemState, error } = await supabase
        .from('betting_system_state')
        .select('current_timeframe_idx, fixture_set_idx')
        .eq('id', SYSTEM_STATE_ID)
        .single();

      if (
        systemState &&
        (systemState.current_timeframe_idx !== currentTimeframeIdx || systemState.fixture_set_idx !== fixtureSetIdx)
      ) {
        setCurrentTimeframeIdx(systemState.current_timeframe_idx);
        setLiveTimeframeIdx(systemState.current_timeframe_idx);
        setFixtureSetIdx(systemState.fixture_set_idx);
        if (timeSlots[systemState.current_timeframe_idx]) {
          setSelectedTimeSlot(timeSlots[systemState.current_timeframe_idx]);
          setSelectedMatchup(null);
        }
      }
    }, 2000);
    return () => clearInterval(pollInterval);
  }, [currentTimeframeIdx, timeSlots]);

  const handlePlaceBet = () => {
    const stakeNum = Number(stake);
    if (!user) {
      alert("You must be logged in to place a bet.");
      return;
    }
    if (!stake || isNaN(stakeNum) || stakeNum < 50) {
      alert("Minimum stake is 10 KES.");
      return;
    }
    if (stakeNum > balance) {
      alert("Insufficient balance.");
      return;
    }
    if (!selectedMatchup || !selectedBetType || selectedSelection === null) return;
    setBetSlip({
      match: selectedMatchup,
      betType: selectedBetType.type,
      selection: selectedBetType.selections[selectedSelection],
      odds: selectedBetType.odds[selectedSelection],
      stake: stakeNum,
      potentialWin: (stakeNum * Number(selectedBetType.odds[selectedSelection])).toFixed(2)
    });
    setShowModal(true);
  };
  const confirmBet = async () => {
    // Check if we're in single-bet mode (modal) or multi-bet mode (betslip array)
    const betsToPlace = betslip && betslip.length > 0 ? betslip : betSlip ? [betSlip] : null;
    
    if (!betsToPlace || betsToPlace.length === 0) {
      alert("Bet slip is empty. Please create a bet first.");
      return;
    }
    
    // Validate user is logged in
    if (!user) {
      alert("You must be logged in to place a bet.");
      return;
    }

    try {
      console.log("🎯 Placing bets atomically, count:", betsToPlace.length);
      // Calculate total stake
      const totalStake = betsToPlace.reduce((sum, bet) => sum + (bet.stake || 0), 0);
      console.log("💰 Total stake:", totalStake);
      // Transform bets to the format expected by placeBetsAtomic
      const formattedBets = betsToPlace.map(bet => {
        // Get match ID - handle both formats
        const matchId = bet.match?.id || bet.match_id;
        if (!matchId) {
          throw new Error("Bet missing match_id");
        }
        return {
          match_id: matchId,
          selection: bet.selection,
          amount: bet.stake,
          odds: bet.odds,
          bet_type: bet.bet_type || 'default', // Provide a default or actual type
        };
      });
      console.log("📦 Formatted bets:", formattedBets);
      // Use atomic RPC function to place all bets in a single transaction
      // This prevents race conditions and ensures balance consistency
      const response = await placeBetsAtomic(user.id, formattedBets);
      if (response.status === 'ok') {
        console.log("✅ All bets placed atomically!", response);
        // Clear bets and show success
        setBetslip([]);
        setStake("");
        setShowModal(false);
        setBetslipOpen(false);
        setBetPlaced(true);
        setTimeout(() => setBetPlaced(false), 2000);
        // Trigger a refresh event for bets/results pages
        window.dispatchEvent(new Event('refresh-bets-data'));
        // Balance will update automatically via realtime subscription
        console.log("✓ Waiting for realtime balance update...");
      } else {
        console.error("❌ Atomic bet placement failed:", response.error);
        // Handle specific error cases
        if (response.error?.includes("insufficient balance")) {
          alert("Insufficient balance. Please reduce your stake.");
        } else if (response.error?.includes("validation")) {
          alert("Invalid bet. Please check your selections.");
        } else {
          alert(`Failed to place bet: ${response.error || 'Unknown error'}`);
        }
      }
    } catch (err) {
      console.error("❌ Exception during atomic bet placement:", err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      alert("Failed to place bet: " + errorMsg);
    }
  };

  // Circular countdown component
    const CircularCountdown = ({ seconds, label }: { seconds: number; label?: string }) => {
      const radius = 40;
      const stroke = 6;
      const normalizedRadius = radius - stroke * 1;
      const circumference = normalizedRadius * 2 * Math.PI;
      const percent = seconds / 3;
      const strokeDashoffset = circumference - percent * circumference;
      return (
        <div className="flex flex-col items-center justify-center">
          <div className="relative flex items-center justify-center" style={{ width: radius * 2, height: radius * 2 }}>
            <svg height={radius * 2} width={radius * 2}>
              <circle
                stroke="#e5e7eb"
                fill="transparent"
                strokeWidth={stroke}
                r={normalizedRadius}
                cx={radius}
                cy={radius}
              />
              <circle
                stroke="#22c55e"
                fill="transparent"
                strokeWidth={stroke}
                strokeDasharray={circumference + ' ' + circumference}
                style={{ strokeDashoffset, transition: 'stroke-dashoffset 1s linear' }}
                r={normalizedRadius}
                cx={radius}
                cy={radius}
              />
            </svg>
            <span className="absolute left-1/2 top-1/2 text-4xl font-bold text-primary" style={{ transform: 'translate(-50%, -50%)' }}>{seconds}</span>
          </div>
          {/* Render label if provided */}
          {label && (
            <span className="mt-2 text-lg text-muted-foreground font-semibold">{label}</span>
          )}
        </div>
      );
    };

  if (waitingGlobalState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="flex flex-col items-center justify-center">
          <div className="relative w-20 h-20 mb-6">
            <div className="absolute inset-0 border-4 border-blue-500/30 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
            <div className="absolute inset-2 border-4 border-purple-500/30 rounded-full"></div>
            <div className="absolute inset-2 border-4 border-transparent border-t-purple-500 rounded-full animate-spin animation-delay-150"></div>
          </div>
          <h2 className="text-2xl font-bold text-center text-white">
            🌍 BetXPesa
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Success Toast Message */}
      {betPlaced && (
        <div className="fixed top-2 sm:top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 sm:px-0">
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 sm:px-8 py-2 sm:py-4 rounded-lg shadow-2xl flex items-center gap-2 sm:gap-3 font-bold text-sm sm:text-lg border-2 border-green-300 animate-pulse">
            <span className="text-lg sm:text-2xl">✓</span>
            <span>Bet placed successfully!</span>
          </div>
        </div>
      )}
      <BettingHeader />
      
      {/* Global Sync Indicator */}
      <div className="bg-gradient-to-r from-green-600/20 via-emerald-600/20 to-green-600/20 border-y border-green-500/30 py-2 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-400 font-bold text-sm">🌍 Live Bets</span>
          </div>
          <span className="hidden sm:inline text-green-300/70 text-xs">
            You can Always place bets on upcoming matches!
          </span>
          <div className="hidden md:flex items-center gap-2 text-xs text-green-300/50">
            <span>Match #Week {((currentTimeframeIdx % 36) + 1)}</span>
            <span>•</span>
            <span>{new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
      
      <NavigationTabs />
      {/* DEBUG: Fixture Uniqueness Test Button (remove after testing) */}
      {/* DebugForceNewSeasonButton: Add this component for debugging new season */}
      <button
        onClick={() => {
          // Force new season by incrementing fixtureSetIdx and resetting week
          saveSystemStateToSupabase({
            currentWeek: 1,
            currentTimeframeIdx: 0,
            fixtureSetIdx: fixtureSetIdx + 1,
            matchState: 'pre-countdown',
            countdown: PRE_COUNTDOWN_SECONDS,
          });
          setFixtureSetIdx(fixtureSetIdx + 1);
          setCurrentTimeframeIdx(0);
        }}
        className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold shadow-lg border border-blue-400/40 mb-2"
        title="Force new season (debug)"
      >
        🧪 Force New Season (Debug)
      </button>
      <FixtureUniquenessTestButton league={league} getFixtureSet={getFixtureSet} />
      <div className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 max-w-7xl mx-auto">
        {/* Admin panel - Disabled */}

        {/* History button */}
        {/* Removed View Match History button */}

        {/* History Modal */}
        <Dialog open={showHistory} onOpenChange={setShowHistory}>
          <DialogContent className="max-w-lg mx-auto bg-gradient-to-br from-slate-900 to-slate-950 border-2 border-blue-500/30 text-white backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle className="text-xl sm:text-2xl bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">📜 Match History</DialogTitle>
            </DialogHeader>
            {/* Filter/Search UI */}
            <div className="flex flex-col gap-2 mb-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Team name"
                  value={historyFilter.team}
                  onChange={e => setHistoryFilter(f => ({ ...f, team: e.target.value }))}
                  className="flex-1 px-2 py-1 rounded bg-slate-800 text-white border border-blue-500/30 text-xs"
                />
                <input
                  type="date"
                  value={historyFilter.date}
                  onChange={e => setHistoryFilter(f => ({ ...f, date: e.target.value }))}
                  className="px-2 py-1 rounded bg-slate-800 text-white border border-blue-500/30 text-xs"
                />
                <select
                  value={historyFilter.outcome}
                  onChange={e => setHistoryFilter(f => ({ ...f, outcome: e.target.value }))}
                  className="px-2 py-1 rounded bg-slate-800 text-white border border-blue-500/30 text-xs"
                >
                  <option value="">All</option>
                  <option value="home">Home Win</option>
                  <option value="away">Away Win</option>
                  <option value="draw">Draw</option>
                </select>
              </div>
            </div>
            <div className="space-y-2 sm:space-y-3 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-blue-500/30 scrollbar-track-slate-700/20">
              {loadingMatchHistory ? (
                <div className="text-center py-6 sm:py-8 text-slate-400 text-sm sm:text-base">Loading match history...</div>
              ) : matchHistory.length === 0 ? (
                <div className="text-center py-6 sm:py-8 text-slate-400 text-sm sm:text-base">No match history yet.</div>
              ) : (
                matchHistory.map((mh, idx) => (
                  <div key={idx} className="border border-blue-500/30 rounded-lg p-2 sm:p-3 flex flex-col bg-gradient-to-br from-slate-800/50 to-slate-900/50 hover:border-blue-400/50 transition-all duration-300">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-bold text-cyan-300 text-sm sm:text-base">{mh.home_team} vs {mh.away_team}</div>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center text-xs sm:text-sm mb-1">
                      <span className="text-slate-300">Score: <span className="font-bold text-yellow-400">{mh.home_score} - {mh.away_score}</span></span>
                      <span className="text-slate-300">Status: <span className="font-bold text-green-400">{mh.status}</span></span>
                      <span className="text-slate-400">{new Date(mh.updated_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setShowHistory(false)} className="bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white font-bold">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Country selection tabs */}
        <div className="flex gap-3 mb-6 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-blue-500/30 scrollbar-track-slate-700/20">
          {leagues.map(league => {
            const isCountrySelected = selectedCountry === league.countryCode;
            const countryBtnClass = isCountrySelected 
              ? "px-5 py-3 rounded-lg font-bold text-sm whitespace-nowrap transition-all duration-200 shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-cyan-400 bg-gradient-to-r from-cyan-600 to-blue-600 text-white border-2 border-cyan-300 shadow-cyan-500/50"
              : "px-5 py-3 rounded-lg font-bold text-sm whitespace-nowrap transition-all duration-200 shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-cyan-400 bg-gradient-to-r from-slate-700 to-slate-800 text-slate-200 hover:from-slate-600 hover:to-slate-700 border-2 border-slate-600/30";
            return (
            <React.Fragment key={league.countryCode}>
              <button 
                onClick={() => {
                  setSelectedCountry(league.countryCode);
                  setSelectedMatchup(null);
                  // Always use the globalIdx and totalWeeks for all leagues
                  const schedule = getGlobalSchedule();
                  const now = new Date(getNowWithServerOffset());
                  const globalIdx = Math.floor((now.getTime() - schedule.referenceEpoch) / (schedule.matchInterval * 60000));
                  const weekIdx = ((globalIdx % totalWeeks) + totalWeeks) % totalWeeks;
                  setCurrentTimeframeIdx(weekIdx);
                  setLiveTimeframeIdx(weekIdx);
                  // Set the fixture schedule to the correct league's fixture set
                  const leagueIdx = leagues.findIndex(l => l.countryCode === league.countryCode);
                  if (leagueIdx !== -1) {
                    // Use ONLY the static generator for fixtures
                    setFixtureSchedule(getFixtureSet(leagues[leagueIdx], fixtureSetIdx, fixtureSalt));
                  }
                  // Update teams and matchups for the selected country
                  // This will trigger the useEffect that loads matches for the new country
                  if (timeSlots.length > weekIdx && weekIdx >= 0) {
                    setSelectedTimeSlot(timeSlots[weekIdx]);
                  }
                  // Do NOT setCountdown here; countdown is managed by global sync only
                }}
                className={countryBtnClass}
                aria-pressed={isCountrySelected}
              >
                <span className="text-lg mr-2">{league.flag}</span>{league.country}
              </button>
              {league.countryCode === "ke" && (
                <button
                  onClick={() => setShowFixture(true)}
                  className="px-5 py-3 rounded-lg font-bold text-sm whitespace-nowrap bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white ml-2 shadow-lg hover:shadow-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all duration-200"
                >
                  📋 Fixture
                </button>
              )}
            </React.Fragment>
            );
          })}
        </div>


              {/* Fixture Modal */}
              {showFixture && (
                <Dialog open={showFixture} onOpenChange={setShowFixture}>
                  <DialogContent className="max-w-4xl w-[95vw] sm:w-auto mx-auto overflow-y-auto max-h-[90vh] bg-gradient-to-br from-slate-900 to-slate-950 border-2 border-purple-500/30 text-white backdrop-blur-xl">
                    <DialogHeader>
                      <DialogTitle className="text-xl sm:text-2xl bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">🏆 League Fixtures (Week {currentTimeframeIdx + 1} of 36)</DialogTitle>
                    </DialogHeader>
                    {/* Country selection tabs for fixture modal */}
                    <div className="flex gap-1 sm:gap-2 mb-3 sm:mb-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-purple-500/30">
                      {leagues.map(league => {
                        const isFixtureCountrySelected = selectedFixtureCountry === league.countryCode;
                        const fixtureBtnClass = isFixtureCountrySelected
                          ? "px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-bold text-xs sm:text-sm whitespace-nowrap transition-all duration-300 shadow-lg focus:outline-none bg-gradient-to-r from-purple-600 to-pink-600 text-white border-2 border-purple-300 shadow-purple-500/50"
                          : "px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-bold text-xs sm:text-sm whitespace-nowrap transition-all duration-300 shadow-lg focus:outline-none bg-gradient-to-r from-slate-700 to-slate-800 text-slate-200 hover:from-slate-600 hover:to-slate-700 border-2 border-slate-600/30";
                        return (
                        <button
                          key={league.countryCode}
                          onClick={() => setSelectedFixtureCountry(league.countryCode)}
                          className={fixtureBtnClass}
                          aria-pressed={isFixtureCountrySelected}
                        >
                          <span className="text-lg mr-1">{league.flag}</span>{league.country}
                        </button>
                        );
                      })}
                    </div>
                    <div className="space-y-6">
                      {leagues.filter(l => l.countryCode === selectedFixtureCountry).map(league => (
                        <div key={league.countryCode}>
                          <div className="font-bold text-xl mb-4 text-cyan-300">{league.country} - {league.name}</div>
                          {(() => {
                            // Find the fixture schedule for the selected country
                            const leagueIdx = leagues.findIndex(l => l.countryCode === selectedFixtureCountry);
                            const countryFixtureSchedule = leagueIdx !== -1 ? getFixtureSet(leagues[leagueIdx], fixtureSetIdx, fixtureSalt) : [];
                            // Show all 36 weeks, highlight the current global week
                            if (!countryFixtureSchedule || countryFixtureSchedule.length === 0) {
                              return (
                                <div className="mb-5 text-red-400 font-bold">No fixture schedule found for this league/country. (Debug: fixtureSetIdx={fixtureSetIdx}, salt={fixtureSalt})</div>
                              );
                            }
                            return countryFixtureSchedule.map((week, weekIdx) => (
                              <div key={week.week} className={`mb-5 ${weekIdx === currentTimeframeIdx ? 'border-2 border-yellow-400 bg-yellow-100/10' : ''}`}>
                                <div className={`font-semibold mb-2 text-lg ${weekIdx === currentTimeframeIdx ? 'text-yellow-300' : 'text-purple-300'}`}>📅 Week {week.week} {weekIdx === currentTimeframeIdx ? '(Current)' : ''}</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {week.matches.map((m, idx) => (
                                    <div key={idx} className="flex items-center gap-2 bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-lg px-3 py-2 border border-slate-700/50 hover:border-purple-500/50 transition-all duration-300">
                                      <img src={getLogoPath(typeof m.home === 'object' ? m.home : { name: m.home, shortName: m.home })} alt={typeof m.home === 'object' ? (m.home.shortName || m.home.name) : m.home} className="w-6 h-6 object-contain rounded-full border border-slate-600 bg-slate-800" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = defaultLogo; }} />
                                      <span className="font-bold text-sm text-cyan-300">{typeof m.home === 'object' ? (m.home.shortName || m.home.name) : m.home}</span>
                                      <span className="mx-2 text-xs text-slate-400">vs</span>
                                      <img src={getLogoPath(typeof m.away === 'object' ? m.away : { name: m.away, shortName: m.away })} alt={typeof m.away === 'object' ? (m.away.shortName || m.away.name) : m.away} className="w-6 h-6 object-contain rounded-full border border-slate-600 bg-slate-800" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = defaultLogo; }} />
                                      <span className="font-bold text-sm text-cyan-300">{typeof m.away === 'object' ? (m.away.shortName || m.away.name) : m.away}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      ))}
                    </div>
                    <DialogFooter className="flex gap-2 justify-end mt-4">
                      <Button onClick={() => setShowFixture(false)} className="bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white font-bold">Close</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
        {/* Dynamic Time Slots - Show only 2 past + current + 3 upcoming */}
        <div className="flex gap-3 mb-6 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-green-500/30 scrollbar-track-slate-700/20">
          {(() => {
            const now = new Date(getNowWithServerOffset());
            const nearestIdx = getSlotIndexForTime(now, timeSlots);
            const currentLocalIdx = nearestIdx >= 0 ? nearestIdx : Math.floor(Math.max(1, timeSlots.length) / 2);
            const { visibleSlots, startIdx } = getVisibleTimeSlots(timeSlots, currentLocalIdx);
            const liveSlotTime = getCurrentPlayingSlot(getGlobalSchedule()).start.getTime();
            // Ensure live slot is always present
            let slotsToRender = [...visibleSlots].filter(Boolean);
            const liveSlot = timeSlots.find(slot => slot && slot.getTime && slot.getTime() === liveSlotTime);
            if (liveSlot && !slotsToRender.some(slot => slot && slot.getTime && slot.getTime() === liveSlotTime)) {
              slotsToRender = [liveSlot, ...slotsToRender];
            }
            // Remove duplicates and filter out undefined/null
            slotsToRender = slotsToRender.filter((slot, idx, arr) => slot && slot.getTime && arr.findIndex(s => s && s.getTime && s.getTime() === slot.getTime()) === idx);
            return slotsToRender
              .filter(Boolean)
              .map((slot, relativeIdx) => {
                if (!slot || !slot.getTime) return null;
                const actualIdx = timeSlots.findIndex(s => s && s.getTime && s.getTime() === slot.getTime());
                const isLive = slot.getTime() === liveSlotTime;
                const isPast = actualIdx < currentLocalIdx;
                // Always show the live slot, even if it is in the past
                if (isPast && !isLive) return null;
                const isSelected = selectedTimeSlot ? (slot.getTime() === selectedTimeSlot.getTime()) : false;
                let slotBtnClass = "";
                if (isLive) {
                  slotBtnClass = isSelected
                    ? "px-5 py-3 rounded-lg font-bold text-sm whitespace-nowrap transition-all duration-200 shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-green-400 bg-gradient-to-r from-red-600 to-pink-600 text-white border-2 border-red-300 shadow-red-500/50 ring-4 ring-red-400"
                    : "px-5 py-3 rounded-lg font-bold text-sm whitespace-nowrap transition-all duration-200 shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 bg-gradient-to-r from-red-600 to-pink-600 text-white border-2 border-red-300 shadow-red-500/50";
                } else if (isSelected) {
                  slotBtnClass = "px-5 py-3 rounded-lg font-bold text-sm whitespace-nowrap transition-all duration-200 shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-green-400 bg-gradient-to-r from-green-600 to-emerald-600 text-white border-2 border-green-300 shadow-green-500/50";
                } else {
                  slotBtnClass = "px-5 py-3 rounded-lg font-bold text-sm whitespace-nowrap transition-all duration-200 shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 bg-gradient-to-r from-purple-700/50 to-purple-800/50 text-purple-200 hover:from-purple-600/60 hover:to-purple-700/60 border-2 border-purple-500/30";
                }
                return (
                  <button
                    key={slot.toISOString()}
                    onClick={() => {
                      const isGlobalTimeActive = localStorage.getItem('global_match_schedule_initialized') !== null;
                      setSelectedTimeSlot(slot);
                      setSelectedMatchup(null);
                      const schedule = getGlobalSchedule();
                      const globalIdx = Math.floor((slot.getTime() - schedule.referenceEpoch) / (schedule.matchInterval * 60000));
                      const weekIdx = ((globalIdx % totalWeeks) + totalWeeks) % totalWeeks;
                      setCurrentTimeframeIdx(weekIdx);
                      // Do NOT setCountdown here; countdown is managed by global sync only
                      if (!isGlobalTimeActive) {
                        const newSystemState = {
                          currentTimeframeIdx: weekIdx,
                          currentWeek: weekIdx + 1,
                          fixtureSetIdx: fixtureSetIdx,
                          matchState: matchState,
                          countdown: countdown,
                        };
                        saveSystemStateToSupabase(newSystemState);
                      }
                    }}
                    className={slotBtnClass}
                    aria-pressed={isSelected}
                  >
                    {isLive ? (
                      <>
                        🔴 LIVE
                      </>
                    ) : (
                      <>
                        {slot.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        <span className="ml-2 px-2 py-0.5 bg-purple-500/30 text-purple-200 rounded text-xs">Next</span>
                      </>
                    )}
                  </button>
                );
              });
          })()}
        </div>
        {/* Bet Type Selection & Correct Score Button - Only for upcoming matches */}
        {currentTimeframeIdx > liveTimeframeIdx && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-cyan-500/30 scrollbar-track-slate-700/20 flex-wrap">
            {betTypes.map((bt) => {
              const isBetTypeSelected = selectedBetType.type === bt.type;
              const betTypeBtnClass = isBetTypeSelected
                ? "px-4 py-2 rounded-lg font-bold text-xs sm:text-sm whitespace-nowrap transition-all duration-200 shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 bg-gradient-to-r from-cyan-600 to-blue-600 text-white border-2 border-cyan-300 shadow-cyan-500/50"
                : "px-4 py-2 rounded-lg font-bold text-xs sm:text-sm whitespace-nowrap transition-all duration-200 shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 bg-gradient-to-r from-slate-700 to-slate-800 text-slate-200 hover:from-slate-600 hover:to-slate-700 border-2 border-slate-600/30";
              return (
                <button
                  key={bt.type}
                  onClick={() => setSelectedBetType(bt)}
                  className={betTypeBtnClass}
                  aria-pressed={isBetTypeSelected}
                >
                  {bt.type}
                </button>
              );
            })}
          </div>
        )}
        {/* Bet Slip Preview & Confirmation Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-sm mx-auto bg-gradient-to-br from-slate-900 to-slate-950 border-2 border-cyan-500/30 text-white backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle className="text-2xl bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">✓ Confirm Your Bet</DialogTitle>
            </DialogHeader>
            {betSlip && (
              <div className="space-y-3">
                <div className="flex justify-between bg-slate-800/50 p-2 rounded-lg"><span className="text-slate-300">Match:</span> <span className="font-bold text-cyan-300">{betSlip.match.homeTeam.shortName} vs {betSlip.match.awayTeam.shortName}</span></div>
                <div className="flex justify-between bg-slate-800/50 p-2 rounded-lg"><span className="text-slate-300">Bet Type:</span> <span className="font-bold text-cyan-300">{betSlip.betType}</span></div>
                <div className="flex justify-between bg-slate-800/50 p-2 rounded-lg"><span className="text-slate-300">Selection:</span> <span className="font-bold text-cyan-300">{betSlip.selection}</span></div>
                <div className="flex justify-between bg-slate-800/50 p-2 rounded-lg"><span className="text-slate-300">Odds:</span> <span className="font-bold text-yellow-400">{betSlip.odds}</span></div>
                <div className="flex justify-between bg-slate-800/50 p-2 rounded-lg"><span className="text-slate-300">Stake:</span> <span className="font-bold text-purple-400">KES {betSlip.stake}</span></div>
                <div className="flex justify-between bg-gradient-to-r from-green-900/30 to-emerald-900/30 p-3 rounded-lg border border-green-500/50"><span className="text-green-300">Potential Win:</span> <span className="font-bold text-green-400 text-lg">KES {betSlip.potentialWin}</span></div>
              </div>
            )}
            <DialogFooter className="flex gap-2 justify-end mt-6">
              <Button variant="outline" onClick={() => setShowModal(false)} className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-100">Cancel</Button>
              <Button onClick={confirmBet} className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold shadow-lg hover:shadow-green-500/50">Confirm Bet</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Show current match week on top of match section */}
        <div className="w-full flex justify-center items-center mb-3 sm:mb-4">
          <span className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 bg-clip-text text-transparent">🏟️ Match Week {currentTimeframeIdx + 1}</span>
        </div>
        
        {/* Show upcoming/past matches when viewing non-live timeframe */}
        {currentTimeframeIdx !== liveTimeframeIdx && selectedTimeSlot && (
          <div className="flex flex-col items-center justify-center py-6 sm:py-10">
            <div className="w-full">
              {selectedTimeSlot && matchupsByTimeframe[selectedTimeSlot.toISOString()] && matchupsByTimeframe[selectedTimeSlot.toISOString()].length > 0 ? (
                <div className="bg-gradient-to-br from-slate-800/30 to-slate-900/30 p-4 sm:p-6 rounded-xl mb-3 sm:mb-4 border-2 border-blue-500/30 shadow-lg">
                  <div className="text-center mb-4 sm:mb-6">
                    <p className="text-sm sm:text-lg font-bold text-blue-300">
                      {currentTimeframeIdx < liveTimeframeIdx ? '📅 BetXPesa wins' : '📊 Final Results'}
                    </p>
                  </div>
                  {/* Filter matches by selected country */}
                  {(() => {
                    const allMatches = matchupsByTimeframe[selectedTimeSlot.toISOString()];
                    const filteredMatches = getMatchesByCountry(allMatches, selectedCountry);
                    
                    if (filteredMatches.length === 0) {
                      return <div className="text-center text-slate-400 py-4">🏟️ Matches loading for {selectedCountry.toUpperCase()}...</div>;
                    }
                    
                    return filteredMatches.map((match, idx) => {
                      const isPast = currentTimeframeIdx < liveTimeframeIdx;
                      const result = isPast ? matchResultsById[match.id] : undefined;
                    // Show results only for past matches, betting options for upcoming matches
                    // Use ONLY global admin outcome from Supabase for this match
                    const manualOutcome = adminOutcomes[match.id];
                    
                    // For past matches, ALWAYS show a result
                    let homeGoals, awayGoals, winner;
                    if (currentTimeframeIdx < liveTimeframeIdx) {
                      // Past match - get result by priority: stored > database > manual > simulated
                      const storedResult = matchHistory.find(mh => mh.id === match.id);
                      const dbResult = matchResultsById[match.id];
                      if (storedResult) {
                        // Priority 1: Stored in local history
                        homeGoals = storedResult.homeGoals;
                        awayGoals = storedResult.awayGoals;
                        winner = storedResult.winner;
                      } else if (dbResult && dbResult.is_final === 'yes') {
                        // Priority 2: Database has final result
                        homeGoals = dbResult.home_goals;
                        awayGoals = dbResult.away_goals;
                        winner = dbResult.winner;
                      } else if (manualOutcome) {
                        // Priority 3: Admin set manual outcome
                        homeGoals = manualOutcome.homeGoals || 0;
                        awayGoals = manualOutcome.awayGoals || 0;
                        winner = manualOutcome.winner || (homeGoals > awayGoals ? 'home' : homeGoals < awayGoals ? 'away' : 'draw');
                      } else {
                        // Priority 4: Simulate deterministically (always same result for same match ID)
                        // Always use admin outcome if present
                        const simResult = simulateMatch(match.id, 40, adminOutcomes && adminOutcomes[match.id] ? adminOutcomes[match.id] : null);
                        homeGoals = simResult.homeGoals;
                        awayGoals = simResult.awayGoals;
                        winner = simResult.winner;
                        console.log(`📊 Generated result for past match ${match.id}: ${homeGoals}-${awayGoals} (${winner})`);
                      }
                    } else {
                      // Current/Future match - use simulation for display purposes only, but use override for final if set
                      const result = simulateMatch(match.id, 40, manualOutcome);
                      homeGoals = result.homeGoals;
                      awayGoals = result.awayGoals;
                      winner = result.winner;
                    }
                    
                    return currentTimeframeIdx > liveTimeframeIdx ? (
                      // Show BETTING OPTIONS for upcoming matches
                      <div key={match.id} className="flex flex-col sm:flex-row gap-2 sm:gap-3 bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-3 sm:p-4 mb-2 sm:mb-3 shadow-lg border border-slate-700/50 hover:border-blue-500/50 transition-all duration-300 w-full">
                        <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4 flex-1">
                          {/* LEFT SIDE: Teams */}
                          <div className="flex flex-col gap-1 sm:gap-2 min-w-max">
                            <div className="flex items-center gap-2 sm:gap-3 bg-gradient-to-r from-slate-900 to-slate-950 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-700/50">
                              <img src={getLogoPath(match.homeTeam)} alt={match.homeTeam.shortName} className="w-6 h-6 sm:w-8 sm:h-8 object-contain rounded-full border border-slate-600 bg-slate-800" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = defaultLogo; }} />
                              <span className="font-bold text-sm sm:text-lg text-cyan-300">{match.homeTeam.shortName}</span>
                            </div>
                            <span className="text-xs text-slate-400 font-semibold text-center">vs</span>
                            <div className="flex items-center gap-2 sm:gap-3 bg-gradient-to-r from-slate-900 to-slate-950 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-700/50">
                              <img src={getLogoPath(match.awayTeam)} alt={match.awayTeam.shortName} className="w-6 h-6 sm:w-8 sm:h-8 object-contain rounded-full border border-slate-600 bg-slate-800" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = defaultLogo; }} />
                              <span className="font-bold text-sm sm:text-lg text-cyan-300">{match.awayTeam.shortName}</span>
                            </div>
                          </div>
                          
                          {/* RIGHT SIDE: Outcomes */}
                          <div className="flex gap-1 sm:gap-2 flex-wrap flex-1 justify-end sm:justify-start">
                            {(() => {
                              // Use unique odds for this match
                              const betTypesForThisMatch = getRandomBetTypesForMatch(match.id);
                              if (selectedBetType.type === 'Correct Score') {
                                return (
                                  <div className="grid grid-cols-4 gap-1 mt-2">
                                    {correctScoreOptions.map((cs, idx) => (
                                      <button
                                        key={cs.score}
                                        className="bg-gradient-to-br from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white px-2 py-1 rounded text-xs font-bold"
                                        onClick={() => {
                                          setBetslip(prev => {
                                            const filtered = prev.filter(b => !(b.match.id === match.id && b.betType === "Correct Score"));
                                            return [
                                              ...filtered,
                                              {
                                                match,
                                                betType: "Correct Score",
                                                selection: cs.score,
                                                odds: cs.odds,
                                                stake: 50,
                                              }
                                            ];
                                          });
                                        }}
                                      >
                                        {cs.score} <span className="text-orange-200">@{cs.odds}</span>
                                      </button>
                                    ))}
                                  </div>
                                );
                              } else {
                                const matchOdds = betTypesForThisMatch.find(bt => bt.type === selectedBetType.type) || betTypesForThisMatch[0];
                                return matchOdds.selections.map((sel, selIdx) => {
                                  const btnTitle = "Add " + matchOdds.type + ": " + sel + " @ " + matchOdds.odds[selIdx];
                                  return (
                                    <button
                                      key={sel}
                                      className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-2 sm:px-3 py-1 sm:py-2 rounded-lg font-bold text-xs sm:text-sm transition-all duration-200 shadow-lg hover:shadow-cyan-500/50 border border-cyan-400/30"
                                      onClick={() => {
                                        setBetslip(prev => {
                                          const filtered = prev.filter(b => !(b.match.id === match.id && b.betType === matchOdds.type));
                                          return [
                                            ...filtered,
                                            {
                                              match,
                                              betType: matchOdds.type,
                                              selection: sel,
                                              odds: matchOdds.odds[selIdx],
                                              stake: 50,
                                            }
                                          ];
                                        });
                                      }}
                                      title={btnTitle}
                                    >
                                      {sel} <span className="text-yellow-300">@{matchOdds.odds[selIdx]}</span>
                                    </button>
                                  );
                                });
                              }
                            })()}
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Show FINAL RESULTS for past matches - ALWAYS DISPLAY OUTCOMES
                      <div key={match.id} className="flex flex-col gap-2 bg-gradient-to-br from-blue-900/30 to-indigo-900/30 rounded-xl p-4 mb-3 shadow-lg border-2 border-blue-500/40 hover:border-blue-400/60 transition-all duration-300 w-full">
                        {/* Result Badge */}
                        <div className="flex items-center justify-between">
                          <span className="px-3 py-1 bg-blue-600/40 text-blue-200 rounded-lg text-xs font-bold border border-blue-500/50">
                            ✓ FINAL RESULT
                          </span>
                          <span className="px-3 py-1 bg-green-600/30 text-green-300 rounded-lg text-xs font-bold border border-green-500/40">
                            {winner === 'home' ? `🏆 ${match.homeTeam.shortName}` : 
                             winner === 'away' ? `🏆 ${match.awayTeam.shortName}` : 
                             '🤝 Draw'}
                          </span>
                        </div>
                        
                        {/* Match Display */}
                        <div className="flex items-center justify-between gap-3">
                          {/* Home Team */}
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <img src={getLogoPath(match.homeTeam)} alt={match.homeTeam.shortName} className="w-8 h-8 sm:w-10 sm:h-10 object-contain rounded-full border-2 border-slate-600 bg-slate-800 flex-shrink-0" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = defaultLogo; }} />
                            <span className="font-bold text-sm sm:text-base text-cyan-300 truncate">{match.homeTeam.shortName}</span>
                          </div>
                          
                          {/* Score */}
                          <div className="text-center flex-shrink-0">
                            <div className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-yellow-600 to-amber-600 text-white rounded-lg text-xl sm:text-2xl font-bold border-2 border-yellow-400/70 shadow-xl">
                              {homeGoals} - {awayGoals}
                            </div>
                            <div className="text-xs text-yellow-300 mt-1 font-semibold">Full Time</div>
                          </div>
                          
                          {/* Away Team */}
                          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                            <span className="font-bold text-sm sm:text-base text-cyan-300 truncate">{match.awayTeam.shortName}</span>
                            <img src={getLogoPath(match.awayTeam)} alt={match.awayTeam.shortName} className="w-8 h-8 sm:w-10 sm:h-10 object-contain rounded-full border-2 border-slate-600 bg-slate-800 flex-shrink-0" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = defaultLogo; }} />
                          </div>
                        </div>
                      </div>
                    );
                    });
                    })()}
                  
                  {/* Floating Betslip for non-live timeframe */}
                  {betslip.length > 0 && betslipOpen ? (
                    <div className="fixed md:bottom-6 md:right-6 bottom-2 left-1/2 md:left-auto transform md:translate-x-0 -translate-x-1/2 z-50 bg-gradient-to-br from-slate-900 to-slate-950 border-2 border-purple-500/50 rounded-xl shadow-2xl p-3 sm:p-5 w-[95vw] sm:w-full max-w-xs md:max-w-sm md:w-96 backdrop-blur-xl">
                        <div className="flex justify-between items-center mb-2 sm:mb-4">
                          <div className="font-bold text-sm sm:text-xl bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">🎫 Bet Slip</div>
                          <button className="text-xl sm:text-2xl text-red-500 font-bold px-1 sm:px-2 hover:text-red-400 transition" onClick={() => setBetslipOpen(false)} title="Hide betslip">×</button>
                        </div>
                        <div className="space-y-2 sm:space-y-3 max-h-48 sm:max-h-64 overflow-y-auto pr-1 sm:pr-2 scrollbar-thin scrollbar-thumb-purple-500/30 scrollbar-track-slate-700/20">
                          {betslip.map((bet, idx) => (
                            <div key={idx} className="flex flex-col border-b border-slate-700/50 pb-2 sm:pb-3 mb-1 sm:mb-2">
                              <div className="flex justify-between text-slate-300 font-semibold text-xs sm:text-sm"><span>Match:</span> <span className="text-cyan-300 text-xs sm:text-sm">{bet.match.homeTeam.shortName} vs {bet.match.awayTeam.shortName}</span></div>
                              <div className="flex justify-between text-slate-300 font-semibold text-xs sm:text-sm"><span>Selection:</span> <span className="text-cyan-300 text-xs sm:text-sm">{bet.selection}</span></div>
                              <div className="flex justify-between text-slate-300 font-semibold text-xs sm:text-sm"><span>Odds:</span> <span className="text-yellow-400 font-bold">{bet.odds}</span></div>
                              {/* Show outcome/result if available */}
                              {bet.status && (
                                <div className={`flex justify-between text-xs font-bold ${bet.status === 'won' ? 'text-green-500' : bet.status === 'lost' ? 'text-red-500' : 'text-yellow-400'}`}><span>Outcome:</span> <span>{bet.status.charAt(0).toUpperCase() + bet.status.slice(1)}</span></div>
                              )}
                              {bet.result && (
                                <div className="flex justify-between text-xs text-blue-400"><span>Result:</span> <span>{bet.result}</span></div>
                              )}
                              <div className="flex justify-between items-center text-slate-300 font-semibold gap-1 sm:gap-2 text-xs sm:text-sm"><span>Stake:</span> <input type="number" min="10" max="1000000" value={bet.stake} onChange={(e) => { const updated = [...betslip]; updated[idx].stake = Number(e.target.value); setBetslip(updated); }} className="border-2 border-slate-600 rounded-lg px-1.5 sm:px-2 py-0.5 sm:py-1 w-16 sm:w-20 text-xs text-slate-200 bg-slate-800/50 focus:border-purple-500 focus:outline-none" /> KES</div>
                              <div className="flex justify-between items-center text-green-300 font-semibold gap-1 sm:gap-2 text-xs sm:text-sm"><span>Potential Win:</span> <span className="font-bold text-green-400">KES {Number((Number(bet.stake) || 0) * (Number(bet.odds) || 0)).toFixed(2)}</span></div>
                              <button className="text-xs text-red-500 hover:text-red-400 mt-1 sm:mt-2 self-end font-bold transition" onClick={() => setBetslip(betslip.filter((_, i) => i !== idx))}>🗑️ Remove</button>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 sm:mt-4 border-t border-slate-700/50 pt-2 sm:pt-3 flex justify-between font-bold text-slate-300 text-xs sm:text-sm">
                          <span>Total Stake:</span>
                          <span className="text-purple-400">KES {betslip.reduce((sum, b) => sum + (Number(b.stake) || 0), 0)}</span>
                        </div>
                        <div className="flex justify-between items-center mt-1 sm:mt-2 text-xs sm:text-sm">
                          <span className="text-green-300">Total Potential Win:</span>
                          <span className="font-bold text-green-400">KES {betslip.reduce((sum, b) => sum + ((Number(b.stake) || 0) * (Number(b.odds) || 0)), 0).toFixed(2)}</span>
                        </div>
                        <div className="flex gap-1 sm:gap-2 justify-end mt-2 sm:mt-4">
                          <Button variant="outline" onClick={() => setShowBetSlipHistory(true)} className="border-slate-600 text-slate-300 hover:bg-slate-800 text-xs px-2 sm:px-3 py-1 sm:py-2">📋 History</Button>
                          <Button variant="outline" onClick={() => setShowSaveDialog(true)} className="border-slate-600 text-slate-300 hover:bg-slate-800 text-xs px-2 sm:px-3 py-1 sm:py-2">💾 Save</Button>
                          <Button variant="outline" onClick={() => setBetslipOpen(false)} className="border-slate-600 text-slate-300 hover:bg-slate-800 text-xs px-2 sm:px-3 py-1 sm:py-2">Close</Button>
                          <Button
                            onClick={async () => {
                              if (isPlacingBet) return;
                              setIsPlacingBet(true);
                              if (!user) {
                                window.location.href = "/login";
                                setIsPlacingBet(false);
                                return;
                              }
                              const totalStake = betslip.reduce((sum, b) => sum + b.stake, 0);
                              if (totalStake > balance) {
                                alert("Insufficient balance.");
                                setIsPlacingBet(false);
                                return;
                              }
                              if (betslip.some(b => b.stake < 10)) {
                                alert("Minimum stake per bet is 10 KES.");
                                setIsPlacingBet(false);
                                return;
                              }
                              if (betslip.some(b => b.stake > 1000000)) {
                                alert("Maximum stake per bet is 1,000,000 KES.");
                                setIsPlacingBet(false);
                                return;
                              }
                              // Proceed with bet placement
                              try {
                                await confirmBet();
                              } finally {
                                setIsPlacingBet(false);
                              }
                            }}
                            className={`text-white font-bold px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm ${isPlacingBet ? 'bg-green-400 cursor-not-allowed' : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500'}`}
                            disabled={isPlacingBet}
                          >
                            {isPlacingBet ? 'Placing…' : 'Place Bets'}
                          </Button>
                        </div>
                      </div>
                  ) : betslip.length > 0 ? (
                    <button
                      onClick={() => setBetslipOpen(true)}
                      className="fixed md:bottom-6 md:right-6 bottom-2 right-2 sm:bottom-4 sm:right-4 md:left-auto z-50 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold px-2 sm:px-4 py-1.5 sm:py-3 rounded-full shadow-lg hover:shadow-purple-500/50 transition-all text-xs sm:text-sm"
                    >
                      🎫 {betslip.length} Bets
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="text-center py-10 text-slate-400">⏳ Check back soon for upcoming matches</div>
              )}
            </div>
          </div>
        )}


        {/* Inline Correct Score selection is now handled directly in the match row rendering above. */}





        {/* Match state UI logic - only shows for LIVE timeframe */}
        {currentTimeframeIdx === liveTimeframeIdx && matchState === 'pre-countdown' && countdown > 0 && (
          <div className="flex flex-col items-center justify-center py-12 bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-xl border-2 border-blue-500/30 mb-4">
            <CircularCountdown seconds={countdown} />
            <span className="text-xl text-slate-300 mt-4 font-semibold">⏱️ Match starts in</span>
          </div>
        )}
        {matchState === 'playing' && (
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-4 sm:p-6 rounded-xl mb-4 border-2 border-green-500/30 shadow-lg" style={{ willChange: 'contents' }}>
            <div className="w-full flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 mb-4" style={{ willChange: 'contents' }}>
                <span className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">⚽ Match Time: {matchTimer}'</span>
                <div className="w-full sm:w-40 h-3 bg-slate-700 rounded-full overflow-hidden border border-slate-600">
                  <div className="h-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-1000" style={{ width: ((matchTimer / 90) * 100) + "%", willChange: 'width' }}></div>
                </div>
              </div>
              {/* Only show matches for the selected timeframe and country */}
              {selectedTimeSlot && matchupsByTimeframe[selectedTimeSlot.toISOString()] && (() => {
                const allMatches = matchupsByTimeframe[selectedTimeSlot.toISOString()];
                const filteredMatches = getMatchesByCountry(allMatches, selectedCountry);
                // Always render matches for the week, even if admin outcomes are present
                if (!filteredMatches || filteredMatches.length === 0) {
                  return <div className="text-center text-slate-400 py-4">⚽ No matches scheduled for this week.</div>;
                }
                return filteredMatches.map((match, idx) => {
                  // Use only global adminOutcomes for outcome logic
                  const outcome = adminOutcomes[match.id] || null;
                  const sim = matchSimCache[match.id] || { homeGoals: 0, awayGoals: 0, winner: null, events: [] };
                  // Progressive score for current match minute
                  const progressiveScore = getProgressiveScore(sim.events, matchTimer);
                  // Is this an admin-set outcome?
                  const isAdminSet = outcome && (typeof outcome.homeGoals === 'number' || typeof outcome.awayGoals === 'number');
                  // Show goal events as they occur
                  const goalsSoFar = sim.events.filter(ev => ev.time <= matchTimer);
                  // For display, use progressive score always (admin outcomes are simulated progressively)
                  const displayScore = progressiveScore;
                  return (
                    <div key={match.id} className="flex flex-col gap-3 mb-3">
                      <div className="flex items-center gap-2 sm:gap-4 justify-center bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-3 sm:p-4 shadow-lg border border-cyan-500/20 hover:border-cyan-400/50 transition-all duration-300" style={{ willChange: 'contents' }}>
                        {/* Home Team - Left */}
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-start">
                          <div className="flex flex-col items-end flex-1">
                            <span className="font-bold text-sm sm:text-lg text-cyan-300 truncate">{match.homeTeam.shortName}</span>
                          </div>
                          <img src={getLogoPath(match.homeTeam)} alt={match.homeTeam.shortName} className="w-8 h-8 sm:w-10 sm:h-10 object-contain rounded-full border border-slate-600 bg-slate-800 flex-shrink-0" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = defaultLogo; }} />
                        </div>

                        {/* Score - Middle */}
                        <div className="relative flex flex-col items-center justify-center">
                          <div className="px-4 sm:px-8 py-2 sm:py-3 bg-gradient-to-r from-yellow-600/80 to-amber-600/80 text-white rounded-lg text-xl sm:text-3xl font-bold border-2 border-yellow-400/50 shadow-lg flex-shrink-0" style={{ willChange: 'contents' }}>
                            {displayScore.home} - {displayScore.away}
                          </div>
                          {/* Removed admin icon for admin-set matches */}
                        </div>

                        {/* Away Team - Right */}
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-end">
                          <img src={getLogoPath(match.awayTeam)} alt={match.awayTeam.shortName} className="w-8 h-8 sm:w-10 sm:h-10 object-contain rounded-full border border-slate-600 bg-slate-800 flex-shrink-0" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = defaultLogo; }} />
                          <div className="flex flex-col items-start flex-1">
                            <span className="font-bold text-sm sm:text-lg text-cyan-300 truncate">{match.awayTeam.shortName}</span>
                          </div>
                        </div>
                      </div>
                      {/* Modern goal timeline: show goal minutes as pills under each team */}
                      <div className="flex flex-row items-stretch justify-center gap-8 mt-1">
                        {/* Home goals */}
                        <div className="flex flex-col items-end flex-1 gap-1">
                          {(() => {
                            const homeGoals = displayScore.home;
                            const homeEvents = goalsSoFar.filter(ev => ev.team === 'home').slice(0, homeGoals);
                            if (homeEvents.length === 0) {
                              return <span className="text-xs text-slate-400">—</span>;
                            }
                            return (
                              <div className="flex flex-wrap gap-1 justify-end">
                                {homeEvents.map((ev, i) => (
                                  <span key={i} className="text-xs px-2 py-0.5 rounded-full font-bold bg-cyan-500/80 text-white shadow border border-cyan-300/40">{ev.time}'</span>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                        {/* Away goals */}
                        <div className="flex flex-col items-start flex-1 gap-1">
                          {(() => {
                            const awayGoals = displayScore.away;
                            const awayEvents = goalsSoFar.filter(ev => ev.team === 'away').slice(0, awayGoals);
                            if (awayEvents.length === 0) {
                              return <span className="text-xs text-slate-400">—</span>;
                            }
                            return (
                              <div className="flex flex-wrap gap-1 justify-start">
                                {awayEvents.map((ev, i) => (
                                  <span key={i} className="text-xs px-2 py-0.5 rounded-full font-bold bg-pink-500/80 text-white shadow border border-pink-300/40">{ev.time}'</span>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
        {matchState === 'betting' && bettingTimer > 0 && (
          <div className="flex flex-col items-center justify-center py-10">
            <CircularCountdown seconds={bettingTimer} label="Place your bets" />
            <div className="w-full mt-8">
              {/* Betting UI - 1X2 Only */}
              {selectedTimeSlot && matchupsByTimeframe[selectedTimeSlot.toISOString()] && (
                <div className="bg-gradient-to-br from-slate-800/30 to-slate-900/30 p-6 rounded-xl mb-4 border-2 border-cyan-500/30 shadow-lg">
                  {/* Bet Type Selection - Top Bar */}
                  <div className="flex gap-2 flex-wrap mb-6 pb-4 border-b border-slate-700/50 overflow-x-auto scrollbar-thin scrollbar-thumb-cyan-500/30 scrollbar-track-slate-700/20">
                    {betTypes.map((bt) => {
                      const isBetTypeSelected2 = selectedBetType.type === bt.type;
                      const betTypeBtnClass2 = isBetTypeSelected2
                        ? "px-3 py-2 rounded-lg font-bold text-xs sm:text-sm transition-all duration-200 shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 whitespace-nowrap flex-shrink-0 bg-gradient-to-r from-cyan-600 to-blue-600 text-white border-2 border-cyan-300 shadow-cyan-500/50"
                        : "px-3 py-2 rounded-lg font-bold text-xs sm:text-sm transition-all duration-200 shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 whitespace-nowrap flex-shrink-0 bg-gradient-to-r from-slate-700 to-slate-800 text-slate-200 hover:from-slate-600 hover:to-slate-700 border-2 border-slate-600/30";
                      return (
                      <button
                        key={bt.type}
                        onClick={() => setSelectedBetType(bt)}
                        className={betTypeBtnClass2}
                        aria-pressed={isBetTypeSelected2}
                      >
                        {bt.type}
                      </button>
                      );
                    })}
                  </div>

                  {selectedTimeSlot && matchupsByTimeframe[selectedTimeSlot.toISOString()] && (() => {
                    const allMatches = matchupsByTimeframe[selectedTimeSlot.toISOString()];
                    const filteredMatches = getMatchesByCountry(allMatches, selectedCountry);
                    if (filteredMatches.length === 0) {
                      return <div className="text-center text-slate-400 py-4">💰 Place your bets on upcoming matches</div>;
                    }
                    return filteredMatches.map((match, idx) => {
                      const isPast = currentTimeframeIdx < liveTimeframeIdx;
                      const result = isPast ? matchResultsById[match.id] : undefined;
                      let rightSection;
                      if (isPast && result?.is_final === 'yes') {
                        const finalScore = getFinalScore(match.id, adminOutcomes, matchSimCache);
                        rightSection = (
                          <div className="flex flex-col items-center gap-1 p-3 rounded-lg border border-green-500/40 bg-green-900/20 relative">
                            <div className="text-xs font-semibold text-green-300 flex items-center gap-1">
                              FT
                              {finalScore.isAdminSet && (
                                <span className="ml-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-[10px] px-1.5 py-0.5 rounded shadow font-bold flex items-center gap-1" title="BetXPesa">
                                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2c-.6 0-1.1.3-1.4.8l-7 12c-.3.5-.3 1.1 0 1.6.3.5.8.8 1.4.8h14c.6 0 1.1-.3 1.4-.8.3-.5.3-1.1 0-1.6l-7-12C13.1 2.3 12.6 2 12 2zm0 3.2L17.3 15H6.7L12 5.2zM12 17c-.8 0-1.5.7-1.5 1.5S11.2 20 12 20s1.5-.7 1.5-1.5S12.8 17 12 17z"/></svg>
                                  Admin
                                </span>
                              )}
                            </div>
                            <div className="text-lg sm:text-2xl font-bold text-green-400">
                              {finalScore.home} - {finalScore.away}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Winner: {result.winner}
                            </div>
                          </div>
                        );
                      } else {
                        rightSection = (selectedBetType.selections || []).map((sel, idx) => (
                          <button
                            key={sel}
                            onClick={() => {
                              setBetslip(prev => {
                                const filtered = prev.filter(b => b.match.id !== match.id);
                                return [
                                  ...filtered,
                                  {
                                    match,
                                    betType: selectedBetType.type,
                                    selection: sel,
                                    odds: selectedBetType.odds[idx],
                                    stake: 10,
                                  }
                                ];
                              });
                            }}
                            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-3 py-2 sm:px-4 sm:py-3 rounded-lg font-bold text-xs sm:text-sm transition-all duration-200 shadow-lg hover:shadow-cyan-500/50 border border-cyan-400/30 flex flex-col items-center gap-0.5"
                            title={sel + " @ " + selectedBetType.odds[idx]}
                          >
                            <div className="font-bold text-xs sm:text-sm">{sel}</div>
                            <div className="text-yellow-300 font-bold text-xs">@{selectedBetType.odds[idx]}</div>
                          </button>
                        ));
                      }
                      return (
                        <div key={match.id} className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-4 sm:p-6 mb-4 shadow-lg border border-cyan-500/20 hover:border-cyan-500/50 transition-all duration-300">
                          {/* Two Sections Layout: Teams (Left) | Odds (Right) */}
                          <div className="grid grid-cols-2 gap-4 sm:gap-6">
                            {/* LEFT SECTION - Teams */}
                            <div className="flex flex-col gap-3 justify-center">
                              {/* Home Team */}
                              <div className="flex items-center gap-2 sm:gap-3 p-3 bg-gradient-to-r from-slate-900 to-slate-950 rounded-lg border border-slate-700/50">
                                <img src={getLogoPath(match.homeTeam)} alt={match.homeTeam.shortName} className="w-8 h-8 sm:w-10 sm:h-10 object-contain rounded-full border border-slate-600 bg-slate-800 flex-shrink-0" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = defaultLogo; }} />
                                <span className="font-bold text-xs sm:text-sm text-cyan-300 truncate">{match.homeTeam.shortName}</span>
                              </div>
                              {/* Away Team */}
                              <div className="flex items-center gap-2 sm:gap-3 p-3 bg-gradient-to-r from-slate-900 to-slate-950 rounded-lg border border-slate-700/50">
                                <img src={getLogoPath(match.awayTeam)} alt={match.awayTeam.shortName} className="w-8 h-8 sm:w-10 sm:h-10 object-contain rounded-full border border-slate-600 bg-slate-800 flex-shrink-0" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = defaultLogo; }} />
                                <span className="font-bold text-xs sm:text-sm text-cyan-300 truncate">{match.awayTeam.shortName}</span>
                              </div>
                            </div>
                            {/* RIGHT SECTION - Betting Odds or Final Result */}
                            <div className="flex flex-col gap-2 justify-center">
                              {rightSection}
                            </div>
                          </div>
                          {/* Correct Score Button - Below Main Betting */}
                          <div className="mt-4 pt-4 border-t border-slate-700/50">
                            <button
                              onClick={() => setShowCorrectScoreForMatch(match.id)}
                              className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition-all duration-200 shadow-lg hover:shadow-orange-500/50 border border-orange-400/30"
                            >
                              📊 Correct Score
                            </button>
                          </div>
                        </div>
                      );
                    });
                  })()}

// Removed duplicate and misplaced block
                      {/* Floating Betslip - responsive, compressible, icon toggle, team names and odds in black */}
                      {betslip.length > 0 && (
                        betslipOpen ? (
                          <div className="fixed bottom-4 left-4 right-4 md:bottom-6 md:right-6 md:left-auto md:w-96 z-50 bg-gradient-to-br from-slate-900 to-slate-950 border-2 border-purple-500/50 rounded-xl shadow-2xl p-4 sm:p-5 w-auto backdrop-blur-xl max-h-[60vh] flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                              <div className="font-bold text-lg sm:text-xl bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">🎫 Bet Slip</div>
                              <button className="text-2xl text-red-500 font-bold px-2 hover:text-red-400 transition" onClick={() => setBetslipOpen(false)} title="Hide betslip">×</button>
                            </div>
                            <div className="space-y-3 max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-purple-500/30 scrollbar-track-slate-700/20 flex-1">
                              {betslip.map((bet, idx) => (
                                <div key={idx} className="flex flex-col border-b border-slate-700/50 pb-3 mb-2 text-xs sm:text-sm">
                                  <div className="flex justify-between text-slate-300 font-semibold"><span>Match:</span> <span className="text-cyan-300 text-right">{bet.match.homeTeam.shortName} vs {bet.match.awayTeam.shortName}</span></div>
                                  <div className="flex justify-between text-slate-300 font-semibold"><span>Selection:</span> <span className="text-cyan-300">{bet.selection}</span></div>
                                  <div className="flex justify-between text-slate-300 font-semibold"><span>Odds:</span> <span className="text-yellow-400 font-bold">{bet.odds}</span></div>
                                  <div className="flex justify-between items-center text-slate-300 font-semibold gap-2"><span>Stake:</span> <input type="number" min="10" max="1000000" value={bet.stake} onChange={(e) => { const updated = [...betslip]; updated[idx].stake = Number(e.target.value); setBetslip(updated); }} className="border-2 border-slate-600 rounded-lg px-2 py-1 w-16 sm:w-20 text-xs text-slate-200 bg-slate-800/50 focus:border-purple-500 focus:outline-none" /> KES</div>
                                  <div className="flex justify-between items-center text-green-300 font-semibold gap-2"><span>Potential Win:</span> <span className="font-bold text-green-400">KES {Number((Number(bet.stake) || 0) * (Number(bet.odds) || 0)).toFixed(2)}</span></div>
                                  <button className="text-xs text-red-500 hover:text-red-400 mt-2 self-end font-bold transition" onClick={() => setBetslip(betslip.filter((_, i) => i !== idx))}>🗑️ Remove</button>
                                </div>
                              ))}
                            </div>
                            <div className="mt-4 border-t border-slate-700/50 pt-3 flex justify-between font-bold text-slate-300 text-xs sm:text-sm">
                              <span>Total Stake:</span>
                              <span className="text-purple-400">KES {betslip.reduce((sum, b) => sum + (Number(b.stake) || 0), 0)}</span>
                            </div>
                            <div className="flex justify-between items-center mt-2">
                              <span className="text-green-300">Total Potential Win:</span>
                              <span className="font-bold text-green-400">KES {betslip.reduce((sum, b) => sum + ((Number(b.stake) || 0) * (Number(b.odds) || 0)), 0).toFixed(2)}</span>
                            </div>
                            <div className="flex gap-2 justify-end mt-4 flex-wrap">
                              <Button
                                onClick={async () => {
                                  if (!user) {
                                    window.location.href = "/login";
                                    return;
                                  }
                                  const totalStake = betslip.reduce((sum, b) => sum + b.stake, 0);
                                  if (totalStake > balance) {
                                    alert("Insufficient balance.");
                                    return;
                                  }
                                  if (betslip.some(b => b.stake < 10)) {
                                    alert("Minimum stake per bet is 10 KES.");
                                    return;
                                  }
                                  if (betslip.some(b => b.stake > 1000000)) {
                                    alert("Maximum stake per bet is 1,000,000 KES.");
                                    return;
                                  }
                                  const { saveBetToSupabase } = await import("@/lib/supabaseBets");
                                  let saveErrors = false;
                                  for (const bet of betslip) {
                                    // --- ENFORCE TEAM NAMES (robust extraction) ---
                                    const match = bet.match || {};
                                    // Helper to extract team name from any structure
                                    const getTeamName = (obj) => {
                                      if (!obj) return undefined;
                                      if (typeof obj === 'string') return obj;
                                      if (typeof obj === 'object') {
                                        return obj.shortName || obj.name || obj.displayName || obj.fullName || obj.teamName || undefined;
                                      }
                                      return undefined;
                                    };
                                    // Try all possible fields/structures for home/away
                                    const extractTeams = (m) => {
                                      let home = getTeamName(m.homeTeam) || getTeamName(m.home) || getTeamName(m.participants?.[0]) || getTeamName(m.teams?.[0]) || getTeamName(m.competitors?.[0]) || getTeamName(m.sides?.[0]);
                                      let away = getTeamName(m.awayTeam) || getTeamName(m.away) || getTeamName(m.participants?.[1]) || getTeamName(m.teams?.[1]) || getTeamName(m.competitors?.[1]) || getTeamName(m.sides?.[1]);
                                      // Fallback: parse from label
                                      if ((!home || !away) && m.label) {
                                        const label = m.label;
                                        const separators = [' vs ', ' v ', ' - ', ' vs. ', '\u2013', '\u2014'];
                                        for (const sep of separators) {
                                          if (label.includes(sep)) {
                                            const parts = label.split(sep).map((s) => s.trim()).filter(Boolean);
                                            if (parts.length >= 2) {
                                              home = home || parts[0];
                                              away = away || parts[1];
                                              break;
                                            }
                                          }
                                        }
                                      }
                                      return { home, away };
                                    };
                                    // Always force team names from match object if possible
                                    const teams = extractTeams(match);
                                    // Debug log for troubleshooting
                                    console.log('[BET DEBUG] Saving bet:', { bet, match, teams });
                                    const betToSave = {
                                      ...bet,
                                      homeTeam: teams.home || 'Unknown',
                                      awayTeam: teams.away || 'Unknown',
                                    };
                                    const error = await saveBetToSupabase(betToSave, user.id);
                                    if (error) {
                                      console.error("Error saving bet:", error);
                                      saveErrors = true;
                                    }
                                  }
                                  
                                  if (!saveErrors) {
                                    const { supabase } = await import("@/lib/supabaseClient");
                                    await supabase.from("users").update({ balance: balance - totalStake }).eq("id", user.id);
                                    setBalance(balance - totalStake);
                                    setBetslip([]);
                                    setBetslipOpen(false);
                                    setBetPlaced(true);
                                    setTimeout(() => setBetPlaced(false), 2000);
                                  } else {
                                    alert("Some bets failed to save. Please try again.");
                                  }
                                }}
                                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold px-4 sm:px-6 py-2 rounded-lg shadow-lg hover:shadow-green-500/50 transition-all duration-300 transform hover:scale-105 text-sm"
                              >💰 Place Bet</Button>
                            </div>
                          </div>
                        ) : (
                          <button
                            className="fixed bottom-2 right-2 sm:bottom-4 sm:right-4 md:bottom-6 md:right-6 z-50 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-full shadow-2xl flex items-center justify-center font-bold transition-all duration-300 transform hover:scale-110 hover:shadow-purple-500/50"
                            style={{ width: '48px', height: '48px' }}
                            onClick={() => setBetslipOpen(true)}
                            title="Open betslip"
                            aria-label="Open betslip"
                          >
                            <span className="text-lg sm:text-2xl">🧾</span>
                          </button>
                        )
                      )}
                </div>
              )}
            </div>
          </div>
        )}
        {matchState === 'next-countdown' && countdown > 0 && (
          <div className="flex flex-col items-center justify-center py-8 sm:py-12 px-4 bg-gradient-to-br from-indigo-900/20 to-purple-900/20 rounded-xl border-2 border-indigo-500/30 mb-4">
            <CircularCountdown seconds={countdown} />
            <span className="text-lg sm:text-xl text-slate-300 mt-3 sm:mt-4 font-semibold text-center">⏱️ Next match starts in</span>
          </div>
        )}

        {/* Bet Slip History Dialog */}
        <BetSlipHistory 
          open={showBetSlipHistory} 
          onOpenChange={setShowBetSlipHistory}
          onLoadBetSlip={(savedSlip) => {
            setBetslip(savedSlip.bets);
            setBetslipOpen(true);
          }}
        />

        {/* Save Bet Slip Dialog */}
        {showSaveDialog && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-xl p-4 sm:p-6 w-full max-w-xs sm:max-w-sm shadow-2xl">
              <h3 className="text-base sm:text-lg font-bold text-foreground mb-3 sm:mb-4">Save Bet Slip</h3>
              <input
                type="text"
                placeholder="Enter a name for this bet slip"
                value={betSlipName}
                onChange={(e) => setBetSlipName(e.target.value)}
                className="w-full border border-input rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-foreground bg-background mb-3 sm:mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowSaveDialog(false);
                    setBetSlipName('');
                  }}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-border hover:bg-muted transition text-xs sm:text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (betslip.length > 0) {
                      saveBetSlip(betslip, betSlipName || undefined);
                      alert('Bet slip saved!');
                      setShowSaveDialog(false);
                      setBetSlipName('');
                    }
                  }}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition font-bold text-xs sm:text-sm"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BetXPesa;