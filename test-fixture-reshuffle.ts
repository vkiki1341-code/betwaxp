// test-fixture-reshuffle.ts
// Script to test fixture reshuffling after week 36 (TypeScript)
import { getReshuffleCycle, generateShuffledFixtures } from './src/utils/matchGenerator';
import { leagues } from './src/data/leagues';

async function testFixtureReshuffling() {
  const reshuffleCycle1 = await getReshuffleCycle();
  const allFixtures1: Record<string, any> = {};
  for (const league of leagues) {
    allFixtures1[league.countryCode] = await generateShuffledFixtures(league, 36, reshuffleCycle1);
  }

  // Simulate incrementing the reshuffle cycle (new season)
  const reshuffleCycle2 = reshuffleCycle1 + 1;
  const allFixtures2: Record<string, any> = {};
  for (const league of leagues) {
    allFixtures2[league.countryCode] = await generateShuffledFixtures(league, 36, reshuffleCycle2);
  }

  // Compare fixtures for each league
  let allDifferent = true;
  for (const code of Object.keys(allFixtures1)) {
    const f1 = JSON.stringify(allFixtures1[code]);
    const f2 = JSON.stringify(allFixtures2[code]);
    if (f1 === f2) {
      console.error(`❌ Fixtures repeated for league ${code}`);
      allDifferent = false;
    } else {
      console.log(`✅ Fixtures reshuffled for league ${code}`);
    }
  }
  if (allDifferent) {
    console.log('🎉 All leagues reshuffled fixtures successfully!');
  } else {
    console.error('⚠️ Some leagues did not reshuffle fixtures.');
  }
}

testFixtureReshuffling();
