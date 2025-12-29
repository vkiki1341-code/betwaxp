// predictWeekPremierLeague.js
// Usage: node predictWeekPremierLeague.js <weekNumber> [fixtureSetIdx] [salt]
// Prints all match outcomes for Premier League and any week, using the exact math and salt from sharedtimeframesbetting

const premierLeague = {
  name: "Premier League",
  country: "England",
  countryCode: "en",
  flag: "🇬🇧",
  teams: [
    { name: "Arsenal", shortName: "Arsenal" },
    { name: "Aston Villa", shortName: "A.Villa" },
    { name: "AFC Bournemouth", shortName: "Bournemouth" },
    { name: "Brentford", shortName: "Brentford" },
    { name: "Brighton & Hove Albion", shortName: "Brighton" },
    { name: "Chelsea", shortName: "Chelsea" },
    { name: "Crystal Palace", shortName: "C.Palace" },
    { name: "Everton", shortName: "Everton" },
    { name: "Fulham", shortName: "Fulham" },
    { name: "Ipswich Town", shortName: "Ipswich" },
    { name: "Leicester City", shortName: "Leicester" },
    { name: "Liverpool", shortName: "Liverpool" },
    { name: "Manchester City", shortName: "Man City" },
    { name: "Manchester United", shortName: "Man Utd" },
    { name: "Newcastle United", shortName: "Newcastle" },
    { name: "Nottingham Forest", shortName: "N.Forest" },
    { name: "Southampton", shortName: "Southampton" },
    { name: "Tottenham Hotspur", shortName: "Spurs" },
    { name: "West Ham United", shortName: "West Ham" },
    { name: "Wolverhampton Wanderers", shortName: "Wolves" },
  ],
};

function cleanTeamNameForMatchId(name) {
  if (!name) return '';
  let cleaned = name.toLowerCase();
  cleaned = cleaned.replace(/[\s\.'"]+/g, "-");
  cleaned = cleaned.replace(/[^a-z0-9-]/g, "");
  cleaned = cleaned.replace(/-+/g, "-");
  cleaned = cleaned.replace(/^-|-$/g, "");
  return cleaned;
}

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

function getMatchId(leagueCode, weekIdx, matchIdx, homeShort, awayShort) {
  return `league-${leagueCode}-week-${weekIdx + 1}-match-${matchIdx}-${cleanTeamNameForMatchId(homeShort)}-vs-${cleanTeamNameForMatchId(awayShort)}`;
}

function predictOutcome(matchId) {
  let s = hashSeed(matchId);
  function lcg() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  }
  const homeGoals = Math.floor(lcg() * 5);
  const awayGoals = Math.floor(lcg() * 5);
  return { homeGoals, awayGoals };
}

function getFixtureSet(league, setIdx = 0, salt = '') {
  const teams = league.teams.slice();
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

function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log('Usage: node predictWeekPremierLeague.js <weekNumber> [fixtureSetIdx] [salt]');
    process.exit(1);
  }
  const weekNumber = parseInt(args[0], 10);
  const fixtureSetIdx = args[1] ? parseInt(args[1], 10) : 0;
  const salt = args[2] !== undefined ? args[2] : String(fixtureSetIdx);
  const fixtureSet = getFixtureSet(premierLeague, fixtureSetIdx, salt);
  const weekIdx = weekNumber - 1;
  const week = fixtureSet[weekIdx];
  if (!week) {
    console.log('Week not found:', weekNumber);
    process.exit(1);
  }
  console.log(`Premier League - Week ${weekNumber} (fixtureSetIdx=${fixtureSetIdx}, salt='${salt}')`);
  week.matches.forEach((match, idx) => {
    const matchId = getMatchId(premierLeague.countryCode, weekIdx, idx, match.home.shortName, match.away.shortName);
    const { homeGoals, awayGoals } = predictOutcome(matchId);
    console.log(`${match.home.shortName} vs ${match.away.shortName}: ${homeGoals} - ${awayGoals} (matchId: ${matchId})`);
  });
}

main();
