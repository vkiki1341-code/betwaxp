// test_betting_page_fixture_uniqueness.cjs
// Node.js script to test fixture uniqueness as used in the betting page logic
// Uses getFixtureSet from fixtureSets.ts and real league/team data

const path = require('path');
const { getFixtureSet } = require(path.resolve(__dirname, 'src/data/fixtureSets'));

// Hardcoded minimal league for test (avoid image imports)
const league = {
  name: 'Premier League',
  countryCode: 'en',
  teams: [
    { name: 'Arsenal', shortName: 'ARS' },
    { name: 'Aston Villa', shortName: 'AVL' },
    { name: 'Bournemouth', shortName: 'BOU' },
    { name: 'Brentford', shortName: 'BRE' },
    { name: 'Brighton', shortName: 'BHA' },
    { name: 'Chelsea', shortName: 'CHE' },
    { name: 'Crystal Palace', shortName: 'CRY' },
    { name: 'Everton', shortName: 'EVE' },
    { name: 'Fulham', shortName: 'FUL' },
    { name: 'Leeds', shortName: 'LEE' },
    { name: 'Leicester', shortName: 'LEI' },
    { name: 'Liverpool', shortName: 'LIV' },
    { name: 'Man City', shortName: 'MCI' },
    { name: 'Man United', shortName: 'MUN' },
    { name: 'Newcastle', shortName: 'NEW' },
    { name: 'Nottingham Forest', shortName: 'NFO' },
    { name: 'Southampton', shortName: 'SOU' },
    { name: 'Tottenham', shortName: 'TOT' },
    { name: 'West Ham', shortName: 'WHU' },
    { name: 'Wolves', shortName: 'WOL' },
  ]
};

const NUM_SEASONS = 20;
const salt = '';

const seen = new Set();
let lastFixtureSet = null;
let allUnique = true;

for (let setIdx = 0; setIdx < NUM_SEASONS; setIdx++) {
  const fixtureSet = getFixtureSet(league, setIdx, salt);
  const hash = JSON.stringify(fixtureSet);
  if (seen.has(hash)) {
    console.error(`❌ Repeat detected at season ${setIdx + 1}`);
    allUnique = false;
    break;
  }
  seen.add(hash);
  if (lastFixtureSet && hash === JSON.stringify(lastFixtureSet)) {
    console.error(`❌ Fixtures did not change between season ${setIdx} and ${setIdx + 1}`);
    allUnique = false;
    break;
  }
  lastFixtureSet = fixtureSet;
  console.log(`✅ Season ${setIdx + 1} fixtures are unique.`);
}

if (allUnique) {
  console.log(`\n🎉 All ${NUM_SEASONS} seasons have unique fixture sets for league: ${league.name}`);
} else {
  console.error('\n❌ Duplicate fixture sets found!');
}
