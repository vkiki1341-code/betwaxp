// Node.js script to print the real fixture and simulated outcomes for any week using your app's fixture logic
// Usage: node predictWeekRealFixture.cjs <weekNumber>

// --- Premier League teams (from your app) ---
const leagues = [
  {
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
  },
  {
    name: "La Liga",
    country: "Spain",
    countryCode: "es",
    teams: [
      { name: "Alavés", shortName: "Alaves" },
      { name: "Athletic Bilbao", shortName: "Bilbao" },
      { name: "Atlético Madrid", shortName: "Atletico" },
      { name: "Barcelona", shortName: "Barcelona" },
      { name: "Cádiz", shortName: "Cadiz" },
      { name: "Celta Vigo", shortName: "Celta" },
      { name: "Getafe", shortName: "Getafe" },
      { name: "Girona", shortName: "Girona" },
      { name: "Mallorca", shortName: "Mallorca" },
      { name: "Osasuna", shortName: "Osasuna" },
      { name: "Rayo Vallecano", shortName: "Rayo" },
      { name: "Real Betis", shortName: "Betis" },
      { name: "Real Madrid", shortName: "Real Madrid" },
      { name: "Real Sociedad", shortName: "Sociedad" },
      { name: "Sevilla", shortName: "Sevilla" },
      { name: "Valencia", shortName: "Valencia" },
      { name: "Villarreal", shortName: "Villarreal" },
      { name: "Espanyol", shortName: "Espanyol" },
    ],
  },
  {
    name: "Bundesliga",
    country: "Germany",
    countryCode: "de",
    teams: [
      { name: "Augsburg", shortName: "Augsburg" },
      { name: "Bayer Leverkusen", shortName: "Leverkusen" },
      { name: "Bayern Munich", shortName: "Bayern" },
      { name: "Bochum", shortName: "Bochum" },
      { name: "Borussia Dortmund", shortName: "Dortmund" },
      { name: "Borussia M'gladbach", shortName: "Gladbach" },
      { name: "Cologne", shortName: "Cologne" },
      { name: "Eintracht Frankfurt", shortName: "Frankfurt" },
      { name: "Freiburg", shortName: "Freiburg" },
      { name: "Hertha Berlin", shortName: "Hertha" },
      { name: "Hoffenheim", shortName: "Hoffenheim" },
      { name: "Mainz", shortName: "Mainz" },
      { name: "RB Leipzig", shortName: "Leipzig" },
      { name: "Schalke", shortName: "Schalke" },
      { name: "Stuttgart", shortName: "Stuttgart" },
      { name: "Union Berlin", shortName: "Union" },
      { name: "Werder Bremen", shortName: "Bremen" },
      { name: "Wolfsburg", shortName: "Wolfsburg" },
    ],
  },
  {
    name: "Kenyan Premier League",
    country: "Kenya",
    countryCode: "ke",
    teams: [
      { name: "AFC Leopards", shortName: "Leopards" },
      { name: "Bandari", shortName: "Bandari" },
      { name: "Bidco United", shortName: "Bidco" },
      { name: "Gor Mahia", shortName: "Gor Mahia" },
      { name: "Kakamega Homeboyz", shortName: "Homeboyz" },
      { name: "Kariobangi Sharks", shortName: "Sharks" },
      { name: "KCB", shortName: "KCB" },
      { name: "Mathare United", shortName: "Mathare" },
      { name: "Murang'a SEAL", shortName: "Murang'a" },
      { name: "Nairobi City Stars", shortName: "City Stars" },
      { name: "Nzoia Sugar", shortName: "Nzoia" },
      { name: "Posta Rangers", shortName: "Rangers" },
      { name: "Shabana", shortName: "Shabana" },
      { name: "Sofapaka", shortName: "Sofapaka" },
      { name: "Tusker", shortName: "Tusker" },
      { name: "Ulinzi Stars", shortName: "Ulinzi" },
      { name: "Wazito", shortName: "Wazito" },
      { name: "Zoo Kericho", shortName: "Zoo" },
    ],
  },
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

// --- Real fixture generator from your app (getFixtureSet) ---
function getFixtureSet(league, setIdx = 0, salt = '') {
  const teams = league.teams.slice();
  // Use a hash of setIdx, league name, and salt for the seed
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
    // Rotate teams except the first
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

// --- Deterministic shuffle (same as your app) ---
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

if (require.main === module) {
  const countryCode = process.argv[2];
  const weekNumber = parseInt(process.argv[3], 10);
  const fixtureSetIdx = process.argv[4] ? parseInt(process.argv[4], 10) : 0;
  const salt = process.argv[5] !== undefined ? process.argv[5] : String(fixtureSetIdx);
  if (!countryCode || isNaN(weekNumber) || isNaN(fixtureSetIdx)) {
    console.log('Usage: node predictWeekRealFixture.cjs <countryCode> <weekNumber> [fixtureSetIdx] [salt]');
    process.exit(1);
  }
  const league = leagues.find(l => l.countryCode === countryCode);
  if (!league) {
    console.log('League not found for country code:', countryCode);
    process.exit(1);
  }
  const fixtureSet = getFixtureSet(league, fixtureSetIdx, salt);
  const weekIdx = weekNumber - 1;
  const week = fixtureSet[weekIdx];
  if (!week) {
    console.log('Week not found:', weekNumber);
    process.exit(1);
  }
  console.log(`Simulated outcomes for ${league.name}, Week ${weekNumber}, fixtureSetIdx=${fixtureSetIdx}, salt='${salt}'`);
  week.matches.forEach((match, idx) => {
    const matchId = getMatchId(league.countryCode, weekIdx, idx, match.home.shortName, match.away.shortName);
    const { homeGoals, awayGoals } = predictOutcome(matchId);
    console.log(`${match.home.shortName} vs ${match.away.shortName}: ${homeGoals} - ${awayGoals} (matchId: ${matchId})`);
  });
}
