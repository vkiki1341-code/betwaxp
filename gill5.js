// Example: Hardcoded results for specific matches (add more as needed)
const HARDCODED_RESULTS = {
  // 'league-<code>-week-<week>-match-<idx>-<home>-vs-<away>': { home_goals, away_goals, winner }
  // Example:
  // 'league-en-week-1-match-0-arsenal-vs-aston-villa': { home_goals: 2, away_goals: 1, winner: 'home' },
};
// resetAllLeaguesWeeksSimple.js - No project imports, no image dependencies
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// HARDCODED league and teams data (add more leagues as needed)
const LEAGUES = [
  {
    code: 'en',
    name: 'Premier League',
    teams: [
      'Arsenal', 'Aston Villa', 'AFC Bournemouth', 'Brentford', 'Brighton & Hove Albion',
      'Chelsea', 'Crystal Palace', 'Everton', 'Fulham', 'Ipswich Town',
      'Leicester City', 'Liverpool', 'Manchester City', 'Manchester United', 'Newcastle United',
      'Nottingham Forest', 'Southampton', 'Tottenham Hotspur', 'West Ham United', 'Wolverhampton Wanderers'
    ],
    totalWeeks: 10000
  },
  {
    code: 'es',
    name: 'La Liga',
    teams: [
      'Alavés', 'Athletic Bilbao', 'Atlético Madrid', 'Barcelona', 'Cádiz',
      'Celta Vigo', 'Getafe', 'Girona', 'Mallorca', 'Osasuna',
      'Rayo Vallecano', 'Real Betis', 'Real Madrid', 'Real Sociedad', 'Sevilla',
      'Valencia', 'Villarreal', 'Espanyol'
    ],
    totalWeeks: 100000
  },
  {
    code: 'it',
    name: 'Serie A',
    teams: [
      'Atalanta', 'Bologna', 'Cagliari', 'Empoli', 'Fiorentina',
      'Genoa', 'Inter Milan', 'Juventus', 'Lazio', 'Lecce',
      'Monza', 'Napoli', 'Roma', 'Sampdoria', 'Sassuolo',
      'Salernitana', 'Torino', 'Udinese', 'Verona'
    ],
    totalWeeks: 10000
  },
  {
    code: 'de',
    name: 'Bundesliga',
    teams: [
      'Augsburg', 'Bayer Leverkusen', 'Bayern Munich', 'Bochum', 'Borussia Dortmund',
      "Borussia M'gladbach", 'Cologne', 'Eintracht Frankfurt', 'Freiburg', 'Hertha Berlin',
      'Hoffenheim', 'Mainz', 'RB Leipzig', 'Schalke', 'Stuttgart',
      'Union Berlin', 'Werder Bremen', 'Wolfsburg'
    ],
    totalWeeks: 10000
  },
  {
    code: 'ke',
    name: 'Kenyan Premier League',
    teams: [
      'AFC Leopards', 'Bandari', 'Bidco United', 'Gor Mahia', 'Kakamega Homeboyz',
      'Kariobangi Sharks', 'KCB', 'Mathare United', "Murang'a SEAL", 'Nairobi City Stars',
      'Nzoia Sugar', 'Posta Rangers', 'Shabana', 'Sofapaka', 'Tusker',
      'Ulinzi Stars', 'Wazito', 'Zoo Kericho'
    ],
    totalWeeks: 10000
  }
];

function cleanTeamNameForMatchId(name) {
  if (!name) return '';
  let cleaned = String(name).toLowerCase();
  cleaned = cleaned.replace(/[\s\.']+/g, "-");
  cleaned = cleaned.replace(/[^a-z0-9-]/g, "");
  cleaned = cleaned.replace(/-+/g, "-");
  cleaned = cleaned.replace(/^-|-$/g, "");
  return cleaned;
}

async function resetAllLeaguesWeeks() {
  for (const league of LEAGUES) {
      if (league.code === 'en' || league.code === 'es') continue; // Skip Premier League and La Liga
    for (let week = Math.min(6500, league.totalWeeks); week >= 1; week--) {
      const matches = [];
      for (let i = 0; i < league.teams.length; i += 2) {
        if (i + 1 < league.teams.length) {
          matches.push({
            home: league.teams[i],
            away: league.teams[i + 1]
          });
        }
      }
      // Build all matchIds for this week
      const matchIds = matches.map((match, matchIdx) =>
        `league-${league.code}-week-${week}-match-${matchIdx}-${cleanTeamNameForMatchId(match.home)}-vs-${cleanTeamNameForMatchId(match.away)}`
      );
      // Query Supabase for existing outcomes for this week
      const { data: existing, error: fetchError } = await supabase
        .from('fixture_outcomes')
        .select('match_id')
        .in('match_id', matchIds);
      if (fetchError) {
        console.error(`❌ Error checking existing outcomes for ${league.name} week ${week}:`, fetchError);
        process.exit(1);
      }
      if (existing && existing.length === matchIds.length) {
        console.log(`⏩ Skipping ${league.name} week ${week} (all matches already saved)`);
        continue;
      }
      const upserts = [];
      for (let matchIdx = 0; matchIdx < matches.length; matchIdx++) {
        const match = matches[matchIdx];
        const home = match.home;
        const away = match.away;
        const matchId = `league-${league.code}-week-${week}-match-${matchIdx}-${cleanTeamNameForMatchId(home)}-vs-${cleanTeamNameForMatchId(away)}`;
        // Only upsert if not already present
        if (existing && existing.some(e => e.match_id === matchId)) continue;
        const result = HARDCODED_RESULTS[matchId] || { home_goals: 0, away_goals: 0, winner: 'draw' };
        upserts.push({
          match_id: matchId,
          home_goals: result.home_goals,
          away_goals: result.away_goals,
          result: `${result.home_goals}-${result.away_goals}`,
          winner: result.winner,
          home_team: home,
          away_team: away,
          updated_at: new Date().toISOString()
        });
      }
      if (upserts.length === 0) {
        console.log(`⏩ No new matches to upsert for ${league.name} week ${week}`);
        continue;
      }
      console.log(`📤 Upserting ${upserts.length} matches for ${league.name} week ${week}...`);
      const { data, error } = await supabase
        .from('fixture_outcomes')
        .upsert(upserts, { onConflict: 'match_id' })
        .select();
      if (error) {
        console.error(`❌ Error for ${league.name} week ${week}:`, error);
        process.exit(1);
      }
      console.log(`✅ ${league.name} week ${week} done. Rows: ${data?.length || upserts.length}`);
    }
    console.log(`🎉 All weeks upserted for ${league.name}`);
  }
  console.log('🎉 All leagues and weeks upserted!');
}

resetAllLeaguesWeeks().catch(console.error);
