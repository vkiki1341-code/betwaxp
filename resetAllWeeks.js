// resetAllWeeks.js - Upsert all outcomes for all weeks in all fixture sets for a league
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { leagues } from './src/data/leagues.ts';
import { getFixtureSet } from './src/data/fixtureSets.ts';
import { cleanTeamNameForMatchId } from './src/lib/teamNameUtils.ts';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function resetAllWeeks(leagueCode, fixtureSetIdx) {
  const league = leagues.find(l => l.countryCode === leagueCode);
  if (!league) {
    console.error('League not found:', leagueCode);
    process.exit(1);
  }
  const fixtureSet = getFixtureSet(league, fixtureSetIdx, String(fixtureSetIdx));
  if (!fixtureSet) {
    console.error('Fixture set not found:', fixtureSetIdx);
    process.exit(1);
  }
  for (let weekIdx = 0; weekIdx < fixtureSet.length; weekIdx++) {
    const week = fixtureSet[weekIdx];
    if (!week || !week.matches) continue;
    const upserts = week.matches.map((fixture, matchIdx) => {
      const home = fixture.home.shortName || fixture.home.name;
      const away = fixture.away.shortName || fixture.away.name;
      const match_id = `league-${leagueCode}-week-${week.week}-match-${matchIdx}-${cleanTeamNameForMatchId(home)}-vs-${cleanTeamNameForMatchId(away)}`;
      return {
        match_id,
        home_goals: 0,
        away_goals: 0,
        result: '0-0',
        updated_at: new Date().toISOString(),
        home_team: home,
        away_team: away,
        winner: null,
        bet_1x2: null,
        bet_btts: null,
        bet_ov15: null,
        bet_ov25: null,
        bet_total_goals: null,
        bet_first_goal_time: null,
        bet_goals_odd_even: null,
        bet_correct_score: null,
      };
    });
    console.log(`📤 Upserting week ${week.week} (${upserts.length} matches)...`);
    const { data, error } = await supabase
      .from('fixture_outcomes')
      .upsert(upserts, { onConflict: 'match_id' })
      .select();
    if (error) {
      console.error(`❌ Error upserting week ${week.week}:`, error);
      process.exit(1);
    }
    console.log(`✅ Week ${week.week} done. Rows: ${data?.length || upserts.length}`);
  }
  console.log('🎉 All weeks upserted for league', leagueCode, 'fixture set', fixtureSetIdx);
}

// Usage: node resetAllWeeks.js <leagueCode> <fixtureSetIdx>
const [,, leagueCode, fixtureSetIdxStr] = process.argv;
if (!leagueCode || fixtureSetIdxStr === undefined) {
  console.error('Usage: node resetAllWeeks.js <leagueCode> <fixtureSetIdx>');
  process.exit(1);
}
resetAllWeeks(leagueCode, parseInt(fixtureSetIdxStr, 10)).catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
