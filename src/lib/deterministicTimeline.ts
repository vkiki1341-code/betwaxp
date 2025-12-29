// Deterministic seeded PRNG (Mulberry32)
export function seededRandom(seed: number) {
  let t = seed += 0x6D2B79F5;
  return function() {
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Generate deterministic goal times for a match
// totalGoals: number of goals to distribute
// matchLength: total match seconds (default 90*60)
// seed: unique per match (e.g., hash of matchId+week)
export function generateDeterministicGoalTimes(totalGoals: number, matchLength = 5400, seed = 0): number[] {
  if (totalGoals <= 0) return [];
  const rand = seededRandom(seed);
  const times = new Set<number>();
  while (times.size < totalGoals) {
    // Avoid 0 and last second
    const t = Math.floor(rand() * (matchLength - 2)) + 1;
    times.add(t);
  }
  return Array.from(times).sort((a, b) => a - b);
}

// Example: generateDeterministicGoalTimes(3, 5400, 12345)
