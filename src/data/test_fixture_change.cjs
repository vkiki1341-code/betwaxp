const { getFixtureSet } = require("./fixtureSets.ts");


// Premier League teams (2023/24 example, no images)
const league = {
  name: "Premier League",
  teams: [
    { name: "Arsenal", shortName: "ARS" },
    { name: "Aston Villa", shortName: "AVL" },
    { name: "Bournemouth", shortName: "BOU" },
    { name: "Brentford", shortName: "BRE" },
    { name: "Brighton", shortName: "BHA" },
    { name: "Burnley", shortName: "BUR" },
    { name: "Chelsea", shortName: "CHE" },
    { name: "Crystal Palace", shortName: "CRY" },
    { name: "Everton", shortName: "EVE" },
    { name: "Fulham", shortName: "FUL" },
    { name: "Liverpool", shortName: "LIV" },
    { name: "Luton Town", shortName: "LUT" },
    { name: "Man City", shortName: "MCI" },
    { name: "Man United", shortName: "MUN" },
    { name: "Newcastle", shortName: "NEW" },
    { name: "Nottingham Forest", shortName: "NFO" },
    { name: "Sheffield United", shortName: "SHU" },
    { name: "Spurs", shortName: "TOT" },
    { name: "West Ham", shortName: "WHU" },
    { name: "Wolves", shortName: "WOL" },
  ]
};

console.log(`Robust test: Checking fixture set changes for 10 consecutive seasons using real team names from: ${league.name}\n`);
let lastSeasonHash = null;
let repeated = false;
for (let setIdx = 0; setIdx < 10; setIdx++) {
  const fixtures = getFixtureSet(league, setIdx);
  // Hash all matches for all weeks for this season
  const seasonHash = fixtures.map(
    week => week.matches.map(m => `${m.home.name}-${m.away.name}`).join(",")
  ).join("|");
  if (lastSeasonHash && lastSeasonHash === seasonHash) {
    console.warn(`WARNING: Season ${setIdx} is identical to previous season!`);
    repeated = true;
  }
  lastSeasonHash = seasonHash;
  const week1 = fixtures[0].matches.map(m => `${m.home.name}-${m.away.name}`).join(", ");
  console.log(`SetIdx ${setIdx} - Week 1: ${week1}`);
}
if (!repeated) {
  console.log("\n✅ Robustness test passed: No two consecutive seasons are identical.\n");
} else {
  console.log("\n❌ Robustness test failed: Some seasons are repeating.\n");
}
