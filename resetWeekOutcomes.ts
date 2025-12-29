// Script to reset (upsert) all fixture outcomes for a given league and week using the new cleanTeamNameForMatchId logic
// Usage: npx ts-node resetWeekOutcomes.ts <leagueCode> <fixtureSetIdx> <weekIdx>

import { createClient } from '@supabase/supabase-js';
import { leagues } from './src/data/leagues.ts';
import { getFixtureSet } from './src/data/fixtureSets.ts';
import { cleanTeamNameForMatchId } from './src/lib/teamNameUtils.ts';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  const [,, leagueCode, fixtureSetIdxStr, weekIdxStr] = process.argv;
  if (!leagueCode || fixtureSetIdxStr === undefined || weekIdxStr === undefined) {
    console.error('Usage: npx ts-node resetWeekOutcomes.ts <leagueCode> <fixtureSetIdx> <weekIdx>');
    process.exit(1);
  }
  const fixtureSetIdx = parseInt(fixtureSetIdxStr, 10);
  const weekIdx = parseInt(weekIdxStr, 10);

  const league = leagues.find(l => l.countryCode === leagueCode);
  if (!league) {
    console.error('League not found:', leagueCode);
    process.exit(1);
  }

  const fixtureSet = getFixtureSet(league, fixtureSetIdx, String(fixtureSetIdx));
  if (!fixtureSet || !fixtureSet[weekIdx]) {
    console.error('Fixture set or week not found:', fixtureSetIdx, weekIdx);
    process.exit(1);
  }

  const week = fixtureSet[weekIdx];
  const upserts = week.matches.map((fixture: any, matchIdx: number) => {
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

  const { data, error } = await supabase
    .from('fixture_outcomes')
    .upsert(upserts, { onConflict: 'match_id' })
    .select();

  if (error) {
    console.error('Error upserting outcomes:', error);
    process.exit(1);
  }
  console.log('Successfully upserted outcomes for week:', week.week, 'league:', leagueCode);
  console.log('Rows:', data?.length);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
