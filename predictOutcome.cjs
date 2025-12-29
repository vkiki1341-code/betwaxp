// Predict the simulated outcome for a match using BetXyPes logic
// Usage: node predictOutcome.cjs "league-en-week-310-match-0-leicester-vs-newcastle"

function hashStringToInt(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createLCG(seed) {
  let state = (seed || 1) >>> 0;
  return function rand() {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function predictOutcome(matchId) {
  const rand = createLCG(hashStringToInt(matchId));
  const homeGoals = Math.floor(rand() * 5); // 0–4
  const awayGoals = Math.floor(rand() * 5); // 0–4
  return { homeGoals, awayGoals };
}

// CLI usage
if (require.main === module) {
  const matchId = process.argv[2];
  if (!matchId) {
    console.log('Usage: node predictOutcome.cjs <matchId>');
    process.exit(1);
  }
  const result = predictOutcome(matchId);
  console.log(`Predicted outcome for ${matchId}: ${result.homeGoals} - ${result.awayGoals}`);
}

module.exports = predictOutcome;
