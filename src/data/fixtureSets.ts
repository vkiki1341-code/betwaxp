// 10,000 fixture sets, each with 10,000 matches (placeholder structure)
// Each set is an array of 10,000 weeks, each week is an object { week, matches: [{ home, away }] }
// Each team is a minimal object with name and shortName for compatibility

// Deterministic shuffle using a seed (now uses a hash of setIdx and league name)
function hashSeed(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return Math.abs(hash);
}

function seededShuffle(array, seed) {
  const result = array.slice();
  let m = result.length, t, i;
  let s = seed;
  while (m) {
    s = (s * 9301 + 49297) % 233280;
    i = Math.floor((s / 233280) * m--);
    t = result[m];
    result[m] = result[i];
    result[i] = t;
  }
  return result;
}

// Generate a round-robin fixture for a given league and setIdx (as seed), with a robust salt for non-repeating seasons
// salt should be a unique string per season (e.g., random string, timestamp, or global cycle id)
// Supports up to 10,000 unique fixture sets (setIdx: 0-9999)
export function getFixtureSet(league, setIdx, salt = '') {
  const teams = league.teams.slice();
  // Use a hash of setIdx, league name, and salt for the seed
  const seed = hashSeed(`${league.name || ''}_${setIdx}_${salt}`);
  const shuffledTeams = seededShuffle(teams, seed);
  const n = shuffledTeams.length;
  const rounds = n - (n % 2 === 0 ? 1 : 0);
  const weeks = [];
  let teamsCopy = shuffledTeams.slice();
  for (let round = 0; round < rounds; round++) {
    const roundPairs = [];
    for (let i = 0; i < n / 2; i++) {
      const home = teamsCopy[i];
      const away = teamsCopy[n - 1 - i];
      roundPairs.push({ home, away });
    }
    // Rotate teams except the first
    teamsCopy = [teamsCopy[0], ...teamsCopy.slice(-1), ...teamsCopy.slice(1, -1)];
    weeks.push({ week: round + 1, matches: roundPairs });
  }
  // Repeat to reach 10,000 weeks if needed
  let allWeeks = [];
  while (allWeeks.length < 10000) {
    for (const week of weeks) {
      if (allWeeks.length >= 10000) break;
      allWeeks.push({ week: allWeeks.length + 1, matches: week.matches });
    }
  }
  return allWeeks;
}
