// resetWeek9783.js - No dependencies, just fix Week 9783
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

// FIXED cleanTeamNameForMatchId function
function cleanTeamNameForMatchId(name) {
  if (!name) return '';
  let cleaned = String(name).toLowerCase();
  cleaned = cleaned.replace(/[\s\."]+/g, "-");
  cleaned = cleaned.replace(/[^a-z0-9-]/g, "");
  cleaned = cleaned.replace(/-+/g, "-");
  cleaned = cleaned.replace(/^-|-$/g, "");
  return cleaned;
}

async function resetWeek9783() {
  console.log('🚀 Resetting Week 9783 outcomes...');
  
  // English Premier League teams
  const teams = [
    'Arsenal', 'Aston Villa', 'Bournemouth', 'Brentford', 'Brighton',
    'Chelsea', 'Crystal Palace', 'Everton', 'Fulham', 'Liverpool',
    'Luton', 'Manchester City', 'Manchester United', 'Newcastle',
    'Nottingham Forest', 'Sheffield United', 'Tottenham', 'West Ham',
    'Wolves', 'Burnley'
  ];
  
  const weekNumber = 9783;
  const league = 'en';
  
  // Create matches (home vs away pairs)
  const matches = [];
  for (let i = 0; i < teams.length; i += 2) {
    if (i + 1 < teams.length) {
      matches.push({
        home: teams[i],
        away: teams[i + 1]
      });
    }
  }
  
  console.log(`📊 ${matches.length} matches for Week ${weekNumber}`);
  
  const upserts = [];
  
  for (let matchIdx = 0; matchIdx < matches.length; matchIdx++) {
    const match = matches[matchIdx];
    const home = match.home;
    const away = match.away;
    
    const matchId = `league-${league}-week-${weekNumber}-match-${matchIdx}-${cleanTeamNameForMatchId(home)}-vs-${cleanTeamNameForMatchId(away)}`;
    
    const homeGoals = Math.floor(Math.random() * 4);
    const awayGoals = Math.floor(Math.random() * 4);
    let winner = 'draw';
    if (homeGoals > awayGoals) winner = 'home';
    if (awayGoals > homeGoals) winner = 'away';
    
    console.log(`   ${matchIdx}: ${home} ${homeGoals}-${awayGoals} ${away}`);
    
    upserts.push({
      match_id: matchId,
      home_goals: homeGoals,
      away_goals: awayGoals,
      result: `${homeGoals}-${awayGoals}`,
      winner: winner,
      home_team: home,
      away_team: away,
      updated_at: new Date().toISOString()
    });
  }
  
  console.log('📤 Upserting to database...');
  
  const { data, error } = await supabase
    .from('fixture_outcomes')
    .upsert(upserts, { onConflict: 'match_id' })
    .select();
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log(`✅ Successfully upserted ${data?.length || upserts.length} outcomes for Week ${weekNumber}`);
  console.log('🎉 Done! Refresh your betting page to see the outcomes.');
}

resetWeek9783().catch(console.error);
