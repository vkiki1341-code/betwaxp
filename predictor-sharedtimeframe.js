// predictor-sharedtimeframe.js
// This script syncs with the real fixture, week, fixtureSetIdx, and salt from the app's global state (if available)
// and uses the same logic as SharedTimeframesBetting.tsx for 100% match.

// --- League/team data (copy from app source for accuracy) ---
const leagues = [
  // ... (same as in your app)
];

function cleanTeamNameForMatchId(name) {
  if (!name) return '';
  let cleaned = name.toLowerCase();
  cleaned = cleaned.replace(/[\s\.'"]+/g, "-");
  cleaned = cleaned.replace(/[^a-z0-9-]/g, "");
  cleaned = cleaned.replace(/-+/g, "-");
  cleaned = cleaned.replace(/^-|-$/g, "");
  return cleaned;
}

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
  const homeGoals = Math.floor(rand() * 5);
  const awayGoals = Math.floor(rand() * 5);
  return { homeGoals, awayGoals };
}

function getMatchId(leagueCode, weekIdx, matchIdx, homeShort, awayShort) {
  return `league-${leagueCode}-week-${weekIdx + 1}-match-${matchIdx}-${cleanTeamNameForMatchId(homeShort)}-vs-${cleanTeamNameForMatchId(awayShort)}`;
}

function seededShuffle(array, seed) {
  const arr = array.slice();
  let m = arr.length, t, i;
  let random = createLCG(seed);
  while (m) {
    i = Math.floor(random() * m--);
    t = arr[m];
    arr[m] = arr[i];
    arr[i] = t;
  }
  return arr;
}

function getFixtureSet(league, setIdx = 0, salt = '') {
  const teams = league.teams.slice();
  const seed = hashStringToInt(`${league.name || ''}_${setIdx}_${salt}`);
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
    teamsCopy = [teamsCopy[0], ...teamsCopy.slice(-1), ...teamsCopy.slice(1, -1)];
    weeks.push({ week: round + 1, matches: roundPairs });
  }
  let allWeeks = [];
  while (allWeeks.length < 10000) {
    for (const week of weeks) {
      if (allWeeks.length >= 10000) break;
      allWeeks.push({ week: allWeeks.length + 1, matches: week.matches });
    }
  }
  return allWeeks;
}

// --- Get current global state from Supabase or fallback to defaults ---
async function getCurrentGlobalState() {
  // This should call your Supabase endpoint or API to get the real fixtureSetIdx, salt, and week
  // For demo, fallback to defaults
  return {
    fixtureSetIdx: 0,
    fixtureSalt: '0',
    currentTimeframeIdx: 0,
    selectedCountry: 'en',
  };
}

async function main() {
  const globalState = await getCurrentGlobalState();
  const { fixtureSetIdx, fixtureSalt, currentTimeframeIdx, selectedCountry } = globalState;
  const league = leagues.find(l => l.countryCode === selectedCountry);
  if (!league) {
    console.error('League not found for country code:', selectedCountry);
    return;
  }
  const fixtureSet = getFixtureSet(league, fixtureSetIdx, fixtureSalt);
  const week = fixtureSet[currentTimeframeIdx];
  if (!week) {
    console.error('Week not found:', currentTimeframeIdx + 1);
    return;
  }
  console.log(`Simulated outcomes for ${league.name}, Week ${currentTimeframeIdx + 1}, fixtureSetIdx=${fixtureSetIdx}, salt='${fixtureSalt}'`);
  week.matches.forEach((match, idx) => {
    const matchId = getMatchId(league.countryCode, currentTimeframeIdx, idx, match.home.shortName, match.away.shortName);
    const { homeGoals, awayGoals } = predictOutcome(matchId);
    console.log(`${match.home.shortName} vs ${match.away.shortName}: ${homeGoals} - ${awayGoals} (matchId: ${matchId})`);
  });
}

main();
