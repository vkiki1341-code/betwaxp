import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fixResultColumn() {
  // Fetch all rows where result does not match home_goals-away_goals
  const { data, error } = await supabase
    .from('fixture_outcomes')
    .select('match_id, home_goals, away_goals, result');

  if (error) {
    console.error('Error fetching rows:', error);
    return;
  }

  const updates = [];
  for (const row of data) {
    // Skip rows with null goals
    if (row.home_goals === null || row.away_goals === null) continue;
    const correctResult = `${row.home_goals}-${row.away_goals}`;
    if (row.result !== correctResult) {
      updates.push({
        match_id: row.match_id,
        result: correctResult
      });
    }
  }

  if (updates.length === 0) {
    console.log('No mismatches found.');
    return;
  }

  let totalFixed = 0;
  let round = 1;
  while (updates.length > 0) {
    let fixedCount = 0;
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('fixture_outcomes')
        .update({ result: update.result })
        .eq('match_id', update.match_id);
      if (updateError) {
        console.error('Error updating match_id', update.match_id, updateError);
      } else {
        fixedCount++;
      }
    }
    totalFixed += fixedCount;
    console.log(`Round ${round}: Fixed ${fixedCount} rows.`);
    if (fixedCount === 0) break;
    round++;
    // Fetch again to check for new mismatches
    const { data: newData, error: newError } = await supabase
      .from('fixture_outcomes')
      .select('match_id, home_goals, away_goals, result');
    if (newError) {
      console.error('Error fetching rows:', newError);
      break;
    }
    updates.length = 0;
    for (const row of newData) {
      if (row.home_goals === null || row.away_goals === null) continue;
      const correctResult = `${row.home_goals}-${row.away_goals}`;
      if (row.result !== correctResult) {
        updates.push({
          match_id: row.match_id,
          result: correctResult
        });
      }
    }
  }
  console.log(`All done. Total fixed: ${totalFixed}`);
}

fixResultColumn();
