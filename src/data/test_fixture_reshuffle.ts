
import { getFixtureSet } from "./fixtureSets.ts";

// Pick a league to test (first league in the array)
// Premier League teams (name, shortName, icon only)
const premierLeague = {
	name: "Premier League",
	country: "England",
	countryCode: "en",
	flag: "🇬🇧",
	teams: [
		{ name: "Arsenal", shortName: "Arsenal", icon: "🔴" },
		{ name: "Aston Villa", shortName: "A.Villa", icon: "🦁" },
		{ name: "AFC Bournemouth", shortName: "Bournemouth", icon: "🍒" },
		{ name: "Brentford", shortName: "Brentford", icon: "🐝" },
		{ name: "Brighton & Hove Albion", shortName: "Brighton", icon: "⚪" },
		{ name: "Chelsea", shortName: "Chelsea", icon: "💙" },
		{ name: "Crystal Palace", shortName: "C.Palace", icon: "🦅" },
		{ name: "Everton", shortName: "Everton", icon: "🔵" },
		{ name: "Fulham", shortName: "Fulham", icon: "⚫" },
		{ name: "Ipswich Town", shortName: "Ipswich", icon: "🔵" },
		{ name: "Leicester City", shortName: "Leicester", icon: "🦊" },
		{ name: "Liverpool", shortName: "Liverpool", icon: "🔴" },
		{ name: "Manchester City", shortName: "Man City", icon: "💙" },
		{ name: "Manchester United", shortName: "Man Utd", icon: "😈" },
		{ name: "Newcastle United", shortName: "Newcastle", icon: "⚫" },
		{ name: "Nottingham Forest", shortName: "N.Forest", icon: "🌲" },
		{ name: "Southampton", shortName: "Southampton", icon: "⚪" },
		{ name: "Tottenham Hotspur", shortName: "Spurs", icon: "⚪" },
		{ name: "West Ham United", shortName: "West Ham", icon: "⚒️" },
		{ name: "Wolverhampton Wanderers", shortName: "Wolves", icon: "🐺" },
	]
};
// Use the real Premier League for the test
const league = premierLeague;

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
