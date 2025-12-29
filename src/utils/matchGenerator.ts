import { Match, Team, League, AdminSettings } from "@/types/betting";
import { leagues } from "@/data/leagues";
import { supabase } from "@/lib/supabaseClient";

// Persistent reshuffle counter should be stored in Supabase, not localStorage
// These functions should be refactored to use Supabase for global state
// Persistent reshuffle cycle stored in Supabase global state table
const RESHUFFLE_STATE_ID = 'reshuffle-cycle-global';

export const getReshuffleCycle = async (): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from('global_state')
      .select('reshuffle_cycle')
      .eq('id', RESHUFFLE_STATE_ID)
      .single();
    if (error || !data) {
      // If not found, initialize to 0
      await supabase.from('global_state').upsert({ id: RESHUFFLE_STATE_ID, reshuffle_cycle: 0 });
      return 0;
    }
    return typeof data.reshuffle_cycle === 'number' ? data.reshuffle_cycle : 0;
  } catch (err) {
    console.error('Error fetching reshuffle cycle:', err);
    return 0;
  }
};

export const incrementReshuffleCycle = async () => {
  try {
    const current = await getReshuffleCycle();
    const next = current + 1;
    const { error } = await supabase
      .from('global_state')
      .upsert({ id: RESHUFFLE_STATE_ID, reshuffle_cycle: next });
    if (error) {
      console.error('Error incrementing reshuffle cycle:', error);
    } else {
      console.log('✅ Reshuffle cycle incremented to', next);
    }
    return next;
  } catch (err) {
    console.error('Exception incrementing reshuffle cycle:', err);
    return null;
  }
};

// Remove all localStorage keys for fixtures/results

// Admin settings should be fetched from Supabase, not localStorage
export const getAdminSettings = (): AdminSettings => ({
  autoGenerate: true,
  generationInterval: 5,
  manualOutcomes: {},
});
export const saveAdminSettings = (settings: AdminSettings) => {
  // TODO: Save to Supabase
};

export const generateRandomOdds = () => {
  const overOdds = (1.2 + Math.random() * 0.15).toFixed(2);
  const underOdds = (3.4 + Math.random() * 0.9).toFixed(2);
  return { overOdds, underOdds };
};

const generateRandomOutcome = (): "over" | "under" => {
  return Math.random() < 0.5 ? "over" : "under";
};

// Generate shuffled fixtures for a league
// Deterministic shuffle using cycle and week for unique results every season
function seededRandom(seed: number) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}
// Helper: Get a robust random seed for each reshuffle cycle
function getRobustSeed(league: League, reshuffleCycle: number, week: number) {
  // Use league, cycle, week, and a random salt for unpredictability
  const salt = window.crypto.getRandomValues(new Uint32Array(1))[0];
  return (
    reshuffleCycle * 1000003 +
    week * 7919 +
    league.countryCode.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) * 9973 +
    salt
  );
}

// Remove localStorage for previous fixture hashes

// Use this async version for Supabase/global uniqueness
export async function getPreviousFixtureHashesAsync(countryCode: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('fixture_hashes')
    .select('hashes')
    .eq('countrycode', countryCode)
    .single();
  if (error || !data) return new Set();
  try {
    // If already an array, use it directly; if stringified, parse
    const hashesArr = Array.isArray(data.hashes) ? data.hashes : JSON.parse(data.hashes);
    return new Set(hashesArr);
  } catch {
    return new Set();
  }
}
function storePreviousFixtureHashes(countryCode: string, hashes: Set<string>) {
  // Save to Supabase for global uniqueness
  // Table: fixture_hashes (countrycode text, hashes jsonb)
  const hashesArr = Array.from(hashes);
  supabase.from('fixture_hashes').upsert({ countrycode: countryCode, hashes: JSON.stringify(hashesArr) });
}

// Generate a hash for a fixture week
function hashFixtureWeek(weekMatches: Array<{ home: Team; away: Team }>): string {
  return weekMatches.map(m => m.home.shortName + '-' + m.away.shortName).join('|');
}

export const generateShuffledFixtures = async (league: League, weeks: number = 10000, reshuffleCycle: number) => {
  const fixtures: { [week: number]: Array<{ home: Team; away: Team }> } = {};
  const teams = [...league.teams];
  let previousHashes = await getPreviousFixtureHashesAsync(league.countryCode);
  let attempts = 0;
  const maxAttempts = 100;
  let unique = false;
  let localReshuffleCycle = reshuffleCycle;
  while (!unique && attempts < maxAttempts) {
    unique = true;
    const fixtureHashes: string[] = [];
    for (let week = 1; week <= weeks; week++) {
      const weekMatches = [];
      // Use a robust seeded shuffle for unpredictability
      const shuffledTeams = [...teams];
      for (let i = shuffledTeams.length - 1; i > 0; i--) {
        const seed = getRobustSeed(league, localReshuffleCycle, week + attempts * 1000 + i * 13);
        const rand = Math.abs(Math.sin(seed)) % 1;
        const j = Math.floor(rand * (i + 1));
        [shuffledTeams[i], shuffledTeams[j]] = [shuffledTeams[j], shuffledTeams[i]];
      }
      for (let i = 0; i < shuffledTeams.length - 1; i += 2) {
        weekMatches.push({
          home: shuffledTeams[i],
          away: shuffledTeams[i + 1],
        });
      }
      const hash = hashFixtureWeek(weekMatches);
      fixtureHashes.push(hash);
      if (previousHashes.has(hash)) {
        unique = false;
      }
      fixtures[week] = weekMatches;
    }
    attempts++;
    if (unique) {
      // Store new hashes to prevent repeats in future cycles
      fixtureHashes.forEach(h => previousHashes.add(h));
      storePreviousFixtureHashes(league.countryCode, previousHashes);
      break;
    }
    // If not unique after maxAttempts, force a new reshuffleCycle and retry
    if (attempts === maxAttempts) {
      console.error('❌ Failed to generate unique fixture set after 100 attempts. Forcing new reshuffle cycle and retrying.');
      localReshuffleCycle++;
      attempts = 0;
      previousHashes = await getPreviousFixtureHashesAsync(league.countryCode); // reload hashes in case of race
    }
  }
  return fixtures;
};

// Remove all localStorage for shuffled fixtures
// Ensure leagues are loaded before reshuffling
export function ensureLeaguesLoaded(leagues: League[]): boolean {
  if (!leagues || !Array.isArray(leagues) || leagues.length === 0) {
    console.error('❌ Leagues array is not loaded or empty. Cannot reshuffle fixtures.');
    return false;
  }
  return true;
}
export const storeShuffledFixtures = (countryCode: string, fixtures: any) => {
  // Save all fixtures for this country to Supabase fixtures table
  // Each fixture: { countryCode, week, matchIdx, homeTeam, awayTeam }
  const rows = [];
  for (const week in fixtures) {
    const weekNum = parseInt(week, 10);
    fixtures[week].forEach((fixture: any, matchIdx: number) => {
      // Ensure countrycode and country_code are set and not null
      const countrycode = countryCode || fixture.countryCode || fixture.country_code;
      if (!countrycode) {
        console.error('❌ Missing countrycode for fixture:', fixture);
        return;
      }
      rows.push({
        countrycode,
        country_code: countrycode,
        week: weekNum,
        match_idx: matchIdx,
        home: fixture.home.shortName,
        away: fixture.away.shortName,
        home_team: fixture.home.shortName,
        away_team: fixture.away.shortName,
        created_at: new Date().toISOString(),
      });
    });
  }
  if (rows.length > 0) {
    supabase.from('fixtures').insert(rows).then(({ error }: any) => {
      if (error) {
        console.error('❌ Error inserting new fixtures:', error);
      } else {
        console.log('✅ Inserted new fixtures for', countryCode);
      }
    });
  }
};
export const getStoredShuffledFixtures = (countryCode: string) => {
  // Fetch fixtures from Supabase for the given country code, grouped by week
  return supabase
    .from('fixtures')
    .select('*')
    .eq('countrycode', countryCode)
    .then(({ data, error }) => {
      if (error) {
        console.error('❌ Error fetching stored shuffled fixtures:', error);
        return null;
      }
      if (!data) return null;
      // Group fixtures by week
      const grouped = {};
      for (const row of data) {
        if (!grouped[row.week]) grouped[row.week] = [];
        grouped[row.week].push({
          home: { shortName: row.home, name: row.home_team },
          away: { shortName: row.away, name: row.away_team },
        });
      }
      return grouped;
    });
};
export const clearAllShuffledFixtures = () => {
  // Remove all fixtures from Supabase
  // Only delete where id is a valid integer
  supabase.from('fixtures').delete().neq('id', null).then(({ error }: any) => {
    if (error) {
      console.error('❌ Error deleting old fixtures:', error);
    } else {
      console.log('✅ Deleted all old fixtures');
    }
  });
};

export const generateMatches = (league: League, count: number = 10): Match[] => {
  const matches: Match[] = [];
  const teams = [...league.teams];
  const now = new Date();
  const settings = getAdminSettings();
  for (let i = 0; i < count; i++) {
    if (teams.length < 2) break;
    const homeIndex = Math.floor(Math.random() * teams.length);
    const homeTeam = teams.splice(homeIndex, 1)[0];
    const awayIndex = Math.floor(Math.random() * teams.length);
    const awayTeam = teams.splice(awayIndex, 1)[0];
    const kickoffTime = new Date(now.getTime() + (i * 2 + Math.random() * 3) * 60000);
    const { overOdds, underOdds } = generateRandomOdds();
    const id = `${league.countryCode}-${Date.now()}-${i}`;
    let outcome: "over" | "under" = generateRandomOutcome();
    if (
      settings.manualOutcomes &&
      settings.manualOutcomes[id] &&
      typeof settings.manualOutcomes[id] === "object" &&
      settings.manualOutcomes[id]["over"]
    ) {
      outcome = settings.manualOutcomes[id]["over"] as "over" | "under";
    }
    matches.push({
      id,
      homeTeam,
      awayTeam,
      kickoffTime,
      overOdds,
      underOdds,
      outcome,
    });
  }
  return matches;
};

// Remove all localStorage for matches
export const getStoredMatches = (countryCode: string): Match[] | null => {
  // TODO: Fetch from Supabase
  return null;
};
export const storeMatches = (countryCode: string, matches: Match[]) => {
  // TODO: Save to Supabase
};

export const regenerateMatchesIfNeeded = (countryCode: string): Match[] => {
  const league = leagues.find((l) => l.countryCode === countryCode);
  if (!league) return [];

  const settings = getAdminSettings();
  const stored = getStoredMatches(countryCode);

  // If auto-generation is disabled, keep existing matches or generate once
  if (!settings.autoGenerate) {
    if (stored && stored.length > 0) {
      return stored;
    }
    const matches = generateMatches(league);
    storeMatches(countryCode, matches);
    return matches;
  }

  // When auto-generation is enabled, always rotate matches to keep them fresh
  const newMatches = generateMatches(league);
  storeMatches(countryCode, newMatches);
  return newMatches;
};

// ==========================================
// AUTO-RESHUFFLE ON WEEK 36
// ==========================================

// Remove localStorage for reshuffle tracker
export const getLastReshuffleWeek = (): number => 0;
export const setLastReshuffleWeek = (week: number) => {};

// Check if week 36 has been reached and auto-reshuffle if needed
export const checkAndAutoReshuffle = async (currentWeek: number): Promise<boolean> => {
  const lastReshuffle = getLastReshuffleWeek();
  // If we've reached week 10000 and haven't reshuffled for this season yet
  if (currentWeek >= 10000 && lastReshuffle < 10000) {
    console.log("🔄 Week 10000 reached! Auto-reshuffling fixtures for next season...");
    // Increment reshuffle cycle for new entropy
    await incrementReshuffleCycle();
    // Generate new shuffled fixtures for all leagues
    await Promise.all(
      leagues.map(async league => {
        const reshuffleCycle = await getReshuffleCycle();
        const shuffledFixtures = await generateShuffledFixtures(league, 10000, reshuffleCycle);
        storeShuffledFixtures(league.countryCode, shuffledFixtures);
      })
    );
    // Clear fixture overrides
    const adminSettings = getAdminSettings();
    saveAdminSettings({
      ...adminSettings,
      fixtureOverrides: {}
    });
    // Mark that we've reshuffled for this season
    setLastReshuffleWeek(10000);
    return true;
  }
  return false;
};

// Manually trigger reshuffle (called by admin button)
export const triggerManualReshuffle = async () => {
  console.log("🔄 Manual reshuffle triggered by admin");
  await incrementReshuffleCycle();
  for (const league of leagues) {
    const reshuffleCycle = await getReshuffleCycle();
    const shuffledFixtures = await generateShuffledFixtures(league, 10000, reshuffleCycle);
    storeShuffledFixtures(league.countryCode, shuffledFixtures);
  }
  // Clear fixture overrides
  const adminSettings = getAdminSettings();
  saveAdminSettings({
    ...adminSettings,
    fixtureOverrides: {}
  });
  return true;
};
