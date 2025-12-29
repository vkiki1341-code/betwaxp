// Utility to fetch a match result from match_results table for a given matchId
// Returns { homeGoals, awayGoals, winner } or null if not found
import { supabase } from "@/lib/supabaseClient";

export async function getMatchResultFromResultsTable(matchId) {
  const { data, error } = await supabase
    .from("match_results")
    .select("home_goals, away_goals, winner")
    .eq("match_id", matchId)
    .single();
  if (error || !data) return null;
  return {
    homeGoals: data.home_goals,
    awayGoals: data.away_goals,
    winner: data.winner,
  };
}
