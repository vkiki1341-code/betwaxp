// Standalone script: Predict all simulated outcomes for Premier League (England) for any week
// Usage: node predictWeekStandalone.cjs <weekNumber>

const league = {
  name: "Premier League",
  country: "England",
  countryCode: "en",
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

// Simple round-robin fixture generator (same as your app)
function getFixtureSet(league, setIdx = 0, salt = '') {
  const teams = league.teams.slice();
  const n = teams.length;
  const rounds = n - (n % 2 === 0 ? 1 : 0);
  const weeks = [];
  let teamsCopy = teams.slice();
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
  // Repeat to reach 10000 weeks if needed
  let allWeeks = [];
  while (allWeeks.length < 10000) {
    for (const week of weeks) {
      if (allWeeks.length >= 10000) break;
      allWeeks.push({ week: allWeeks.length + 1, matches: week.matches });
    }
  }
  return allWeeks;
}

if (require.main === module) {
  const weekNumber = parseInt(process.argv[2], 10);
  if (isNaN(weekNumber)) {
    console.log('Usage: node predictWeekStandalone.cjs <weekNumber>');
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
    const matchId = getMatchId(league.countryCode, weekIdx, idx, match.home.shortName, match.away.shortName);
    const { homeGoals, awayGoals } = predictOutcome(matchId);
    console.log(`${match.home.shortName} vs ${match.away.shortName}: ${homeGoals} - ${awayGoals} (matchId: ${matchId})`);
  });
}
