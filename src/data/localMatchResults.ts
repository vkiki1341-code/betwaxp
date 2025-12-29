// Local storage for match results by week
// Usage: import { saveLocalMatchResult, getLocalMatchResultsForWeek } from './localMatchResults';

const LOCAL_RESULTS_KEY = 'local_match_results';

export function saveLocalMatchResult(week: number, matchId: string, result: { home_goals: number, away_goals: number, is_final: boolean }) {
  const allResults = JSON.parse(localStorage.getItem(LOCAL_RESULTS_KEY) || '{}');
  if (!allResults[week]) allResults[week] = {};
  allResults[week][matchId] = result;
  localStorage.setItem(LOCAL_RESULTS_KEY, JSON.stringify(allResults));
}

export function getLocalMatchResultsForWeek(week: number): Record<string, { home_goals: number, away_goals: number, is_final: boolean }> {
  const allResults = JSON.parse(localStorage.getItem(LOCAL_RESULTS_KEY) || '{}');
  return allResults[week] || {};
}

export function getAllLocalMatchResults() {
  return JSON.parse(localStorage.getItem(LOCAL_RESULTS_KEY) || '{}');
}

export function clearLocalMatchResults() {
  localStorage.removeItem(LOCAL_RESULTS_KEY);
}
