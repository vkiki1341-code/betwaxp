/**
 * Global Match Schedule Service
 * Manages a universal reference time for all matches
 * All matches are scheduled based on this reference epoch
 * This allows users to predict matches at any future time
 */

import { Match } from '@/types/betting';
import { supabase } from '@/lib/supabaseClient';

export interface GlobalSchedule {
  referenceEpoch: number; // Unix timestamp of reference time
  matchInterval: number; // Minutes between each match (e.g., 30, 45, 60)
  timezone: string; // Reference timezone
  lastUpdated: number;
}

export interface ScheduledMatch {
  matchId: string;
  scheduleIndex: number; // Which match in the sequence (0, 1, 2, ...)
  scheduledStartTime: number; // Unix timestamp
  homeTeam: string;
  awayTeam: string;
}

const STORAGE_KEY = 'global_match_schedule';
const DEFAULT_INTERVAL = 2; // 2 minutes between matches (quick match rotation)
const SUPABASE_SCHEDULE_TABLE = 'global_schedule_config';
const SUPABASE_SCHEDULE_ID = 1;
const SERVER_TIME_OFFSET_KEY = 'server_time_offset_ms';

/**
 * Server time offset utilities
 * Attempts to align client clock with database server time.
 * If RPC is unavailable, gracefully falls back to local time.
 */
let cachedServerTimeOffsetMs: number | null = null;

/** Load cached offset from localStorage */
const loadServerTimeOffset = (): number | null => {
  if (cachedServerTimeOffsetMs !== null) return cachedServerTimeOffsetMs;
  const raw = localStorage.getItem(SERVER_TIME_OFFSET_KEY);
  if (!raw) return null;
  const val = Number(raw);
  cachedServerTimeOffsetMs = Number.isFinite(val) ? val : null;
  return cachedServerTimeOffsetMs;
};

/** Save cached offset */
const saveServerTimeOffset = (offsetMs: number): void => {
  cachedServerTimeOffsetMs = offsetMs;
  localStorage.setItem(SERVER_TIME_OFFSET_KEY, String(offsetMs));
};

/**
 * Refresh server time offset by calling an RPC.
 * Expects a Postgres function `server_time` returning current server timestamp (ms).
 * If not present, this silently no-ops and retains previous offset.
 */
export const refreshServerTimeOffset = async (): Promise<number | null> => {
  try {
    // Try RPC first (recommended). User may define in DB:
    // CREATE OR REPLACE FUNCTION server_time() RETURNS bigint AS $$ SELECT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint; $$ LANGUAGE SQL STABLE;
    const { data, error } = await supabase.rpc('server_time');
    if (error) {
      console.warn('Server time RPC unavailable:', error.message || error);
      return loadServerTimeOffset();
    }
    if (typeof data === 'number' && Number.isFinite(data)) {
      const clientNow = Date.now();
      const offset = data - clientNow;
      saveServerTimeOffset(offset);
      return offset;
    }
    return loadServerTimeOffset();
  } catch (e) {
    console.warn('Failed to refresh server time offset:', e);
    return loadServerTimeOffset();
  }
};

/** Get Date.now adjusted with server offset if available */
export const getNowWithServerOffset = (): number => {
  const offset = loadServerTimeOffset();
  return Date.now() + (offset || 0);
};

/**
 * Initialize or get the global schedule
 * This should be called once when the system starts
 */
export const initializeGlobalSchedule = (
  referenceTime?: Date,
  matchInterval: number = DEFAULT_INTERVAL,
  timezone: string = 'UTC'
): GlobalSchedule => {
  // Prefer Supabase-backed schedule. Fall back to localStorage.
  const stored = localStorage.getItem(STORAGE_KEY);

  if (stored) {
    return JSON.parse(stored);
  }

  const schedule: GlobalSchedule = {
    referenceEpoch: referenceTime ? referenceTime.getTime() : Date.now(),
    matchInterval,
    timezone,
    lastUpdated: Date.now(),
  };

  // Attempt to persist to Supabase; ignore errors and still use local
  // This avoids per-user divergence when the backend is available.
  void saveGlobalScheduleToSupabase(schedule);
  saveGlobalSchedule(schedule);
  return schedule;
};

/**
 * Get current global schedule
 * IMPORTANT: This should ONLY be used after ensureGlobalScheduleSynced() has been called
 * to guarantee all users have the same reference epoch
 */
export const getGlobalSchedule = (): GlobalSchedule => {
  // Always prefer localStorage cache (populated by Supabase sync)
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  // Fallback: initialize with default (but this should be rare)
  console.warn('⚠️ getGlobalSchedule() called before sync - using fallback');
  return initializeGlobalSchedule();
};

/**
 * Save global schedule
 */
export const saveGlobalSchedule = (schedule: GlobalSchedule): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schedule));
};

/**
 * Supabase-backed schedule retrieval.
 * Caches to localStorage for sync access.
 * CRITICAL: This is the source of truth for all users
 */
export const getGlobalScheduleFromSupabase = async (): Promise<GlobalSchedule | null> => {
  try {
    const { data, error } = await supabase
      .from(SUPABASE_SCHEDULE_TABLE)
      .select('*')
      .eq('id', SUPABASE_SCHEDULE_ID)
      .single();

    if (error) {
      console.error('❌ Failed to fetch global schedule from Supabase:', error);
      return null;
    }

    const schedule: GlobalSchedule = {
      referenceEpoch: data.reference_epoch,
      matchInterval: data.match_interval,
      timezone: data.timezone || 'UTC',
      lastUpdated: Date.now(),
    };

    saveGlobalSchedule(schedule);
    console.log('✅ Global schedule synced from Supabase:', {
      referenceTime: new Date(schedule.referenceEpoch).toISOString(),
      interval: schedule.matchInterval + ' minutes'
    });
    return schedule;
  } catch (err) {
    console.error('❌ Exception fetching global schedule:', err);
    return null;
  }
};

/**
 * Ensure global schedule is synced before using it
 * This MUST be called on app initialization to ensure all users share the same reference
 */
export const ensureGlobalScheduleSynced = async (): Promise<GlobalSchedule> => {
  try {
    // Try to get from Supabase first (source of truth)
    const supabaseSchedule = await getGlobalScheduleFromSupabase();
    
    if (supabaseSchedule) {
      console.log('✅ Using Supabase schedule:', supabaseSchedule);
      // Best-effort: align client time with server time
      void refreshServerTimeOffset();
      return supabaseSchedule;
    }
    
    // If Supabase fails, check if we have a local cache
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      console.warn('⚠️ Using cached schedule (Supabase unavailable)');
      return JSON.parse(stored);
    }
    
    // Last resort: initialize a new schedule
    console.warn('⚠️ No global schedule found - creating local schedule');
    const newSchedule = initializeGlobalSchedule();
    
    // Try to save to Supabase for other users (don't wait for it)
    saveGlobalScheduleToSupabase(newSchedule).catch(() => {
      console.warn('Could not save to Supabase - table may not exist yet');
    });
    // Attempt to fetch offset even if schedule is local
    void refreshServerTimeOffset();
    
    return newSchedule;
  } catch (err) {
    console.error('❌ ensureGlobalScheduleSynced failed:', err);
    // Always return something valid
    return initializeGlobalSchedule();
  }
};

/**
 * Persist schedule to Supabase and update local cache.
 */
export const saveGlobalScheduleToSupabase = async (schedule: GlobalSchedule): Promise<boolean> => {
  try {
    const payload = {
      id: SUPABASE_SCHEDULE_ID,
      reference_epoch: schedule.referenceEpoch,
      match_interval: schedule.matchInterval,
      timezone: schedule.timezone,
    };

    const { error } = await supabase
      .from(SUPABASE_SCHEDULE_TABLE)
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      return false;
    }
    saveGlobalSchedule(schedule);
    return true;
  } catch {
    return false;
  }
};

/**
 * Update reference time (if needed to adjust globally)
 */
export const updateReferenceTime = (newTime: Date): GlobalSchedule => {
  const schedule = getGlobalSchedule();
  schedule.referenceEpoch = newTime.getTime();
  schedule.lastUpdated = Date.now();
  saveGlobalSchedule(schedule);
  void saveGlobalScheduleToSupabase(schedule);
  return schedule;
};

/**
 * Update match interval (minutes between matches)
 */
export const updateMatchInterval = (minutes: number): GlobalSchedule => {
  const schedule = getGlobalSchedule();
  schedule.matchInterval = minutes;
  schedule.lastUpdated = Date.now();
  saveGlobalSchedule(schedule);
  void saveGlobalScheduleToSupabase(schedule);
  return schedule;
};

/**
 * Calculate the scheduled start time for a match given its index
 * Schedule Index 0 = referenceEpoch
 * Schedule Index 1 = referenceEpoch + matchInterval
 * Schedule Index N = referenceEpoch + (N * matchInterval)
 */
export const calculateScheduledTime = (
  scheduleIndex: number,
  schedule?: GlobalSchedule
): Date => {
  const sched = schedule || getGlobalSchedule();
  const milliseconds = sched.referenceEpoch + scheduleIndex * sched.matchInterval * 60000;
  return new Date(milliseconds);
};

/**
 * Find which schedule index a given time falls into
 * Returns the schedule index that is currently active or upcoming
 */
export const findScheduleIndexForTime = (
  time: Date,
  schedule?: GlobalSchedule
): number => {
  const sched = schedule || getGlobalSchedule();
  const timeDiff = time.getTime() - sched.referenceEpoch;
  const indexDiff = timeDiff / (sched.matchInterval * 60000);
  
  // Round down to get the current/most recent schedule index
  return Math.floor(indexDiff);
};

/**
 * Convenience: get the schedule index for "now", adjusted by server offset when available.
 */
export const getCurrentScheduleIndex = (schedule?: GlobalSchedule): number => {
  const sched = schedule || getGlobalSchedule();
  const nowMs = getNowWithServerOffset();
  const timeDiff = nowMs - sched.referenceEpoch;
  const indexDiff = timeDiff / (sched.matchInterval * 60000);
  return Math.floor(indexDiff);
};

/**
 * Get all matches scheduled for a specific date
 */
export const getMatchesForDate = (
  date: Date,
  allMatches: Match[],
  schedule?: GlobalSchedule
): ScheduledMatch[] => {
  const sched = schedule || getGlobalSchedule();
  
  // Calculate start and end of day
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);
  
  const startIndex = findScheduleIndexForTime(dayStart, sched);
  const endIndex = findScheduleIndexForTime(dayEnd, sched);
  
  const matchesOnDate: ScheduledMatch[] = [];
  
  for (let i = 0; i < allMatches.length; i++) {
    const match = allMatches[i];
    const scheduleIndex = i % 1000; // Cycle through indices
    const scheduledTime = calculateScheduledTime(scheduleIndex, sched);
    
    if (scheduledTime >= dayStart && scheduledTime <= dayEnd) {
      matchesOnDate.push({
        matchId: match.id,
        scheduleIndex,
        scheduledStartTime: scheduledTime.getTime(),
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
      });
    }
  }
  
  return matchesOnDate.sort((a, b) => a.scheduledStartTime - b.scheduledStartTime);
};

/**
 * Get match scheduled for a specific time slot
 * Returns which match is playing at this exact time
 */
export const getMatchAtTime = (
  time: Date,
  allMatches: Match[],
  schedule?: GlobalSchedule
): ScheduledMatch | null => {
  const sched = schedule || getGlobalSchedule();
  
  // Find which schedule index this time falls into
  const scheduleIndex = findScheduleIndexForTime(time, sched);
  
  if (scheduleIndex < 0) {
    return null; // Time is before schedule start
  }
  
  // Map schedule index to match index
  const matchIndex = scheduleIndex % allMatches.length;
  const match = allMatches[matchIndex];
  
  if (!match) {
    return null;
  }
  
  const scheduledTime = calculateScheduledTime(scheduleIndex, sched);
  
  return {
    matchId: match.id,
    scheduleIndex,
    scheduledStartTime: scheduledTime.getTime(),
    homeTeam: match.homeTeam.name,
    awayTeam: match.awayTeam.name,
  };
};

/**
 * Get next N matches from a given time
 */
export const getUpcomingMatches = (
  fromTime: Date,
  count: number,
  allMatches: Match[],
  schedule?: GlobalSchedule
): ScheduledMatch[] => {
  const sched = schedule || getGlobalSchedule();
  
  const upcoming: ScheduledMatch[] = [];
  let currentIndex = findScheduleIndexForTime(fromTime, sched);
  
  for (let i = 0; i < count; i++) {
    const scheduleIndex = currentIndex + i;
    if (scheduleIndex < 0) continue;
    
    const matchIndex = scheduleIndex % allMatches.length;
    const match = allMatches[matchIndex];
    
    if (!match) continue;
    
    const scheduledTime = calculateScheduledTime(scheduleIndex, sched);
    
    upcoming.push({
      matchId: match.id,
      scheduleIndex,
      scheduledStartTime: scheduledTime.getTime(),
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
    });
  }
  
  return upcoming;
};

/**
 * Get previous N matches from a given time
 */
export const getPastMatches = (
  fromTime: Date,
  count: number,
  allMatches: Match[],
  schedule?: GlobalSchedule
): ScheduledMatch[] => {
  const sched = schedule || getGlobalSchedule();
  
  const past: ScheduledMatch[] = [];
  let currentIndex = findScheduleIndexForTime(fromTime, sched);
  
  for (let i = 1; i <= count; i++) {
    const scheduleIndex = currentIndex - i;
    if (scheduleIndex < 0) continue;
    
    const matchIndex = scheduleIndex % allMatches.length;
    const match = allMatches[matchIndex];
    
    if (!match) continue;
    
    const scheduledTime = calculateScheduledTime(scheduleIndex, sched);
    
    past.unshift({
      matchId: match.id,
      scheduleIndex,
      scheduledStartTime: scheduledTime.getTime(),
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
    });
  }
  
  return past;
};

/**
 * Format scheduled time for display
 */
export const formatScheduledTime = (timestamp: number, locale?: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleString(locale || 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

/**
 * Get schedule statistics
 */
export const getScheduleStats = (
  schedule?: GlobalSchedule
): { referenceTime: string; interval: string; timezone: string } => {
  const sched = schedule || getGlobalSchedule();
  return {
    referenceTime: new Date(sched.referenceEpoch).toISOString(),
    interval: `${sched.matchInterval} minutes`,
    timezone: sched.timezone,
  };
};
