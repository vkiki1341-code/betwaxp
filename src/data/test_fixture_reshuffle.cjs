const { leagues } = require("./leagues");
const { getFixtureSet } = require("./fixtureSets");

// Pick a league to test (first league in the array)
const league = leagues[0];

console.log("Testing fixture reshuffle after 36 weeks\n");

const fixtureSet0 = getFixtureSet(league, 0);
const fixtureSet1 = getFixtureSet(league, 1);

console.log("Fixture Set 0 (first week):");
console.log(JSON.stringify(fixtureSet0[0], null, 2));
console.log("Fixture Set 0 (last week):");
console.log(JSON.stringify(fixtureSet0[35], null, 2));

console.log("\nFixture Set 1 (first week):");
console.log(JSON.stringify(fixtureSet1[0], null, 2));
console.log("Fixture Set 1 (last week):");
console.log(JSON.stringify(fixtureSet1[35], null, 2));

console.log("\nAre the first weeks different?", JSON.stringify(fixtureSet0[0]) !== JSON.stringify(fixtureSet1[0]));
console.log("Are the last weeks different?", JSON.stringify(fixtureSet0[35]) !== JSON.stringify(fixtureSet1[35]));
