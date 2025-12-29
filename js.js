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



async function fetchOutcomesByWeek() {
  for (const league of LEAGUES) {
    for (let week = 1; week <= Math.min(10000, league.totalWeeks); week++) {
      const { data, error } = await supabase
        .from('fixture_outcomes')
        .select('*')
        .eq('league_code', league.code)
        .eq('week', week);
      if (error) {
        console.error(`❌ Error fetching outcomes for ${league.name} week ${week}:`, error);
        process.exit(1);
      }
      console.log(`✅ ${league.name} week ${week}: Fetched ${data.length} outcomes.`);
      if (data.length > 0) {
        console.log(data);
      }
    }
    console.log(`🎉 All weeks fetched for ${league.name}`);
  }
  console.log('🎉 All leagues and weeks fetched!');
}

fetchOutcomesByWeek().catch(console.error);
