import { calculateBetResult } from "../src/betResolution.ts";

type BetData = {
  selection?: string;
  bet_type?: string;
  home_goals?: number;
  away_goals?: number;
  first_goal_time?: number;
  half_time_home_goals?: number;
  half_time_away_goals?: number;
  is_final?: boolean;
};

const testCases: { name: string; bet: BetData; expected: string }[] = [
  // Over/Under
  { name: "Over 1.5 Won", bet: { selection: "Over 1.5", home_goals: 2, away_goals: 1, is_final: true }, expected: "won" },
  { name: "Over 1.5 Lost", bet: { selection: "Over 1.5", home_goals: 1, away_goals: 0, is_final: true }, expected: "lost" },
  { name: "Under 2.5 Won", bet: { selection: "Under 2.5", home_goals: 1, away_goals: 1, is_final: true }, expected: "won" },
  { name: "Under 2.5 Lost", bet: { selection: "Under 2.5", home_goals: 2, away_goals: 2, is_final: true }, expected: "lost" },
  // BTTS
  { name: "BTTS Yes Won", bet: { selection: "BTTS Yes", home_goals: 2, away_goals: 1, is_final: true }, expected: "won" },
  { name: "BTTS Yes Lost", bet: { selection: "BTTS Yes", home_goals: 2, away_goals: 0, is_final: true }, expected: "lost" },
  { name: "BTTS No Won", bet: { selection: "BTTS No", home_goals: 2, away_goals: 0, is_final: true }, expected: "won" },
  { name: "BTTS No Lost", bet: { selection: "BTTS No", home_goals: 2, away_goals: 1, is_final: true }, expected: "lost" },
  // Odd/Even
  { name: "Goals Odd Won", bet: { selection: "Odd", home_goals: 2, away_goals: 1, is_final: true }, expected: "won" },
  { name: "Goals Odd Lost", bet: { selection: "Odd", home_goals: 2, away_goals: 2, is_final: true }, expected: "lost" },
  { name: "Goals Even Won", bet: { selection: "Even", home_goals: 2, away_goals: 2, is_final: true }, expected: "won" },
  { name: "Goals Even Lost", bet: { selection: "Even", home_goals: 2, away_goals: 1, is_final: true }, expected: "lost" },
  // 1X2
  { name: "Home Win", bet: { selection: "1", home_goals: 2, away_goals: 1, is_final: true }, expected: "won" },
  { name: "Draw", bet: { selection: "X", home_goals: 1, away_goals: 1, is_final: true }, expected: "won" },
  { name: "Away Win", bet: { selection: "2", home_goals: 1, away_goals: 2, is_final: true }, expected: "won" },
  // Double Chance
  { name: "Double Chance 1X Won", bet: { selection: "1X", home_goals: 1, away_goals: 1, is_final: true }, expected: "won" },
  { name: "Double Chance 12 Won", bet: { selection: "12", home_goals: 2, away_goals: 1, is_final: true }, expected: "won" },
  { name: "Double Chance X2 Won", bet: { selection: "X2", home_goals: 1, away_goals: 2, is_final: true }, expected: "won" },
  // Correct Score
  { name: "Correct Score Won", bet: { selection: "CS 2-1", home_goals: 2, away_goals: 1, is_final: true }, expected: "won" },
  { name: "Correct Score Lost", bet: { selection: "CS 2-1", home_goals: 1, away_goals: 2, is_final: true }, expected: "lost" },
];

let failed = 0;
testCases.forEach(({ name, bet, expected }) => {
  const result = calculateBetResult(bet as any);
  if (result !== expected) {
    console.error(`❌ ${name}: expected ${expected}, got ${result}`);
    failed++;
  } else {
    console.log(`✅ ${name}`);
  }
});

if (failed === 0) {
  console.log("All test cases passed!");
} else {
  console.error(`${failed} test cases failed.`);
}
