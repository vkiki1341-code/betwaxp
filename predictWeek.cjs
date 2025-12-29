// Script to print all simulated outcomes for a given league and week
// Usage: node predictWeek.cjs <countryCode> <weekNumber>

const { leagues } = require('./src/data/leagues');
const { getFixtureSet } = require('./src/data/fixtureSets');
const { cleanTeamNameForMatchId } = require('./src/lib/teamNameUtils');

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

if (require.main === module) {
  const countryCode = process.argv[2];
  const weekNumber = parseInt(process.argv[3], 10);
  if (!countryCode || isNaN(weekNumber)) {
    console.log('Usage: node predictWeek.cjs <countryCode> <weekNumber>');
    process.exit(1);
  }
  const league = leagues.find(l => l.countryCode === countryCode);
  if (!league) {
    console.log('League not found for country code:', countryCode);
    process.exit(1);
  }
  const fixtureSet = getFixtureSet(league, 0, '0');
  const weekIdx = weekNumber - 1;
  const week = fixtureSet[weekIdx];
  if (!week) {
    console.log('Week not found:', weekNumber);
    process.exit(1);
  }
  console.log(`Simulated outcomes for ${league.name}, Week ${weekNumber}`);
  week.matches.forEach((match, idx) => {
    const matchId = getMatchId(countryCode, weekIdx, idx, match.home.shortName, match.away.shortName);
    const { homeGoals, awayGoals } = predictOutcome(matchId);
    console.log(`${match.home.shortName} vs ${match.away.shortName}: ${homeGoals} - ${awayGoals} (matchId: ${matchId})`);
  });
}
