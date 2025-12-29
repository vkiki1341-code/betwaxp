import React, { useEffect, useState } from 'react';
import { leagues } from "./src/data/leagues";
import { getFixtureSet } from "./src/data/fixtureSets";
import { supabase } from "./src/lib/supabaseClient";
import { getFixtureOutcomesForWeek } from "./src/lib/fixtureOutcomes";
import { cleanTeamNameForMatchId } from "./src/lib/teamNameUtils";

// Helper to generate matchId using the same logic as betting page
function getMatchId(leagueCode: string, weekIdx: number, matchIdx: number, homeShort: string, awayShort: string): string {
  return `league-${leagueCode}-week-${weekIdx + 1}-match-${matchIdx}-${cleanTeamNameForMatchId(homeShort)}-vs-${cleanTeamNameForMatchId(awayShort)}`;
}

// Deterministic PRNG utilities - same as betting page
function hashStringToInt(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createLCG(seed: number) {
  let state = (seed || 1) >>> 0;
  return function rand() {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// Simulate match function - same as betting page
function simulateMatch(matchId: string, duration = 40, adminOverride: any = null) {
  let versionedMatchId = matchId;
  if (adminOverride && adminOverride.updated_at) {
    versionedMatchId = matchId + '-' + new Date(adminOverride.updated_at).getTime();
  }
  
  const seed = hashStringToInt(String(versionedMatchId));
  const rand = createLCG(seed);

  if (adminOverride && typeof adminOverride.homeGoals === 'number' && typeof adminOverride.awayGoals === 'number') {
    const totalGoals = adminOverride.homeGoals + adminOverride.awayGoals;
    let events = [];
    
    if (totalGoals > 0) {
      let goalTimes: number[] = [];
      if (adminOverride.goal_times && Array.isArray(adminOverride.goal_times) && adminOverride.goal_times.length === totalGoals) {
        goalTimes = adminOverride.goal_times.slice().map((t: number) => Math.floor((t / 90) * duration) || 1);
      } else {
        const baseInterval = duration / (totalGoals + 1);
        for (let i = 1; i <= totalGoals; i++) {
          const randomOffset = (rand() * baseInterval * 0.5) - (baseInterval * 0.25);
          const time = Math.max(1, Math.min(duration - 1, Math.floor(baseInterval * i + randomOffset)));
          goalTimes.push(time);
        }
        goalTimes.sort((a, b) => a - b);
      }

      const shuffledGoalTimes = goalTimes.slice();
      for (let i = shuffledGoalTimes.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [shuffledGoalTimes[i], shuffledGoalTimes[j]] = [shuffledGoalTimes[j], shuffledGoalTimes[i]];
      }
      
      const homeGoalCount = adminOverride.homeGoals;
      const awayGoalCount = adminOverride.awayGoals;
      const homeGoalTimes = shuffledGoalTimes.slice(0, homeGoalCount).sort((a, b) => a - b);
      const awayGoalTimes = shuffledGoalTimes.slice(homeGoalCount).sort((a, b) => a - b);
      
      const goalEvents = [
        ...homeGoalTimes.map(t => ({ time: t, team: 'home' })),
        ...awayGoalTimes.map(t => ({ time: t, team: 'away' }))
      ].sort((a, b) => a.time - b.time);
      
      let goalIdx = 0;
      let homeGoals = 0;
      let awayGoals = 0;
      
      for (let t = 1; t <= duration; t++) {
        while (goalIdx < goalEvents.length && t === goalEvents[goalIdx].time) {
          const event = { time: t, team: goalEvents[goalIdx].team };
          events.push(event);
          if (event.team === 'home') homeGoals++;
          else awayGoals++;
          goalIdx++;
        }
      }
    }
    
    let winner = adminOverride.winner;
    if (!winner) {
      if (adminOverride.homeGoals > adminOverride.awayGoals) winner = "home";
      else if (adminOverride.awayGoals > adminOverride.homeGoals) winner = "away";
      else winner = "draw";
    }
    
    return {
      homeGoals: adminOverride.homeGoals,
      awayGoals: adminOverride.awayGoals,
      winner,
      events,
      finalScore: { home: adminOverride.homeGoals, away: adminOverride.awayGoals },
      isAdminSet: true
    };
  }

  // Fallback: deterministic PRNG for random matches
  const homeGoals = Math.floor(rand() * 4);
  const awayGoals = Math.floor(rand() * 4);
  const totalGoals = homeGoals + awayGoals;
  let events = [];
  
  if (totalGoals > 0) {
    let goalTimes = [];
    const baseInterval = duration / (totalGoals + 1);
    for (let i = 1; i <= totalGoals; i++) {
      const randomOffset = (rand() * baseInterval * 0.5) - (baseInterval * 0.25);
      const time = Math.max(1, Math.min(duration - 1, Math.floor(baseInterval * i + randomOffset)));
      goalTimes.push(time);
    }
    goalTimes.sort((a, b) => a - b);
    
    const shuffledGoalTimes = goalTimes.slice();
    for (let i = shuffledGoalTimes.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffledGoalTimes[i], shuffledGoalTimes[j]] = [shuffledGoalTimes[j], shuffledGoalTimes[i]];
    }
    
    const homeGoalTimes = shuffledGoalTimes.slice(0, homeGoals).sort((a, b) => a - b);
    const awayGoalTimes = shuffledGoalTimes.slice(homeGoals).sort((a, b) => a - b);
    
    const goalEvents = [
      ...homeGoalTimes.map(t => ({ time: t, team: 'home' })),
      ...awayGoalTimes.map(t => ({ time: t, team: 'away' }))
    ].sort((a, b) => a.time - b.time);
    
    let goalIdx = 0;
    let h = 0, a = 0;
    for (let t = 1; t <= duration; t++) {
      while (goalIdx < goalEvents.length && t === goalEvents[goalIdx].time) {
        if (goalEvents[goalIdx].team === 'home' && h < homeGoals) {
          events.push({ time: t, team: 'home' });
          h++;
        } else if (goalEvents[goalIdx].team === 'away' && a < awayGoals) {
          events.push({ time: t, team: 'away' });
          a++;
        }
        goalIdx++;
      }
    }
  }
  
  let winner = null;
  if (homeGoals > awayGoals) winner = "home";
  else if (awayGoals > homeGoals) winner = "away";
  else winner = "draw";
  
  return {
    homeGoals,
    awayGoals,
    winner,
    events,
    finalScore: { home: homeGoals, away: awayGoals },
    isAdminSet: false
  };
}

// Helper to save admin outcome
async function saveAdminOutcome(matchId: string, homeGoals: number, awayGoals: number, homeTeam: string, awayTeam: string) {
  try {
    const winner = homeGoals > awayGoals ? 'home' : awayGoals > homeGoals ? 'away' : 'draw';
    const result = `${homeGoals}-${awayGoals}`;
    
    const upsertPayload = {
      match_id: matchId,
      home_goals: homeGoals,
      away_goals: awayGoals,
      result: result,
      winner: winner,
      home_team: homeTeam,
      away_team: awayTeam,
      updated_at: new Date().toISOString(),
    };
    
    const { error } = await supabase
      .from('fixture_outcomes')
      .upsert([upsertPayload], { onConflict: 'match_id' });
    
    if (error) {
      console.error('Error saving admin outcome:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Exception saving admin outcome:', error);
    return false;
  }
}

const AdminFixturesPage = () => {
  const [selectedCountry, setSelectedCountry] = useState(leagues[0].countryCode);
  const [fixtureSetIdx, setFixtureSetIdx] = useState(0);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [fixtureSchedule, setFixtureSchedule] = useState<any[]>([]);
  const [adminOutcomes, setAdminOutcomes] = useState<Record<string, any>>({});
  const [matchResults, setMatchResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // Generate fixture salt (same logic as betting page)
  const getGlobalFixtureSalt = (globalState: any) => {
    return (globalState && globalState.fixtureSalt) || String(globalState?.fixtureSetIdx || '0');
  };

  // Load fixtures for selected country
  useEffect(() => {
    const league = leagues.find((l: any) => l.countryCode === selectedCountry);
    if (!league) return;
    
    const salt = getGlobalFixtureSalt({ fixtureSetIdx });
    const schedule = getFixtureSet(league, fixtureSetIdx, salt);
    setFixtureSchedule(schedule);
    
    // Load admin outcomes for all matches
    loadAdminOutcomes(schedule);
  }, [selectedCountry, fixtureSetIdx]);

  // Load admin outcomes for all matches in the fixture schedule
  const loadAdminOutcomes = async (schedule: any[]) => {
    if (!schedule || !Array.isArray(schedule)) return;
    
    const allMatchIds: string[] = [];
    schedule.forEach((week, weekIdx) => {
      (week.matches || []).forEach((fixture: any, i: number) => {
        const matchId = getMatchId(
          selectedCountry,
          week.week - 1,
          i,
          fixture.home.shortName,
          fixture.away.shortName
        );
        allMatchIds.push(matchId);
      });
    });
    
    if (allMatchIds.length === 0) return;
    
    try {
      const outcomes = await getFixtureOutcomesForWeek(allMatchIds);
      const map: Record<string, any> = {};
      
      (outcomes || []).forEach((o: any) => {
        map[o.match_id] = {
          homeGoals: Number(o.home_goals ?? 0),
          awayGoals: Number(o.away_goals ?? 0),
          winner: o.result ?? '',
          homeTeam: o.home_team ?? '',
          awayTeam: o.away_team ?? '',
          updated_at: o.updated_at,
          isAdminSet: true
        };
      });
      
      setAdminOutcomes(map);
      
      // Generate simulated results for matches without admin outcomes
      const simulatedResults: Record<string, any> = {};
      schedule.forEach((week, weekIdx) => {
        (week.matches || []).forEach((fixture: any, i: number) => {
          const matchId = getMatchId(
            selectedCountry,
            week.week - 1,
            i,
            fixture.home.shortName,
            fixture.away.shortName
          );
          
          if (!map[matchId]) {
            // Generate simulated result using the same logic as betting page
            const simulated = simulateMatch(matchId, 40, null);
            simulatedResults[matchId] = {
              ...simulated,
              isAdminSet: false,
              homeTeam: fixture.home.shortName,
              awayTeam: fixture.away.shortName
            };
          } else {
            simulatedResults[matchId] = {
              ...map[matchId],
              homeTeam: fixture.home.shortName,
              awayTeam: fixture.away.shortName
            };
          }
        });
      });
      
      setMatchResults(simulatedResults);
      setLoading(false);
    } catch (error) {
      console.error('Error loading admin outcomes:', error);
      setLoading(false);
    }
  };

  // Handle setting admin outcome
  const handleSetOutcome = async (matchId: string, homeTeam: string, awayTeam: string) => {
    const homeGoals = parseInt(prompt(`Enter goals for ${homeTeam}:`) || '0');
    const awayGoals = parseInt(prompt(`Enter goals for ${awayTeam}:`) || '0');
    
    if (isNaN(homeGoals) || isNaN(awayGoals)) {
      alert('Please enter valid numbers');
      return;
    }
    
    const success = await saveAdminOutcome(matchId, homeGoals, awayGoals, homeTeam, awayTeam);
    if (success) {
      alert('Outcome saved successfully!');
      // Reload outcomes
      loadAdminOutcomes(fixtureSchedule);
    } else {
      alert('Failed to save outcome');
    }
  };

  // Handle clearing admin outcome
  const handleClearOutcome = async (matchId: string) => {
    if (!confirm('Are you sure you want to clear this outcome?')) return;
    
    try {
      const { error } = await supabase
        .from('fixture_outcomes')
        .delete()
        .eq('match_id', matchId);
      
      if (error) {
        console.error('Error clearing outcome:', error);
        alert('Failed to clear outcome');
        return;
      }
      
      alert('Outcome cleared successfully!');
      // Reload outcomes
      loadAdminOutcomes(fixtureSchedule);
    } catch (error) {
      console.error('Exception clearing outcome:', error);
      alert('Failed to clear outcome');
    }
  };

  // Navigate to specific week
  const handleWeekChange = (weekNumber: number) => {
    setCurrentWeek(weekNumber);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white">Loading fixtures...</div>
      </div>
    );
  }

  // Filter to show current week and surrounding weeks
  const startWeek = Math.max(1, currentWeek - 2);
  const endWeek = Math.min(fixtureSchedule.length, currentWeek + 2);
  const visibleWeeks = fixtureSchedule.slice(startWeek - 1, endWeek);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Admin Fixtures Management</h1>
        
        {/* Country Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Select League:</label>
          <div className="flex flex-wrap gap-2">
            {leagues.map((league: typeof leagues[number]) => (
              <button
                key={league.countryCode}
                onClick={() => setSelectedCountry(league.countryCode)}
                className={`px-4 py-2 rounded-lg font-medium ${
                  selectedCountry === league.countryCode
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {league.flag} {league.country}
              </button>
            ))}
          </div>
        </div>
        
        {/* Week Navigation */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Current Week: {currentWeek}</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleWeekChange(Math.max(1, currentWeek - 5))}
              className="px-3 py-1 bg-gray-800 rounded hover:bg-gray-700"
            >
              ← Previous 5
            </button>
            {[1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(week => (
              <button
                key={week}
                onClick={() => handleWeekChange(week)}
                className={`px-3 py-1 rounded ${
                  currentWeek === week
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 hover:bg-gray-700'
                }`}
              >
                Week {week}
              </button>
            ))}
            <button
              onClick={() => handleWeekChange(Math.min(fixtureSchedule.length, currentWeek + 5))}
              className="px-3 py-1 bg-gray-800 rounded hover:bg-gray-700"
            >
              Next 5 →
            </button>
          </div>
        </div>
        
        {/* Fixture Set Navigation */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Fixture Set: {fixtureSetIdx + 1}</label>
          <div className="flex gap-2">
            <button
              onClick={() => setFixtureSetIdx(Math.max(0, fixtureSetIdx - 1))}
              className="px-3 py-1 bg-gray-800 rounded hover:bg-gray-700"
            >
              Previous Set
            </button>
            <button
              onClick={() => setFixtureSetIdx(fixtureSetIdx + 1)}
              className="px-3 py-1 bg-gray-800 rounded hover:bg-gray-700"
            >
              Next Set
            </button>
          </div>
        </div>
        
        {/* Fixtures Display */}
        <div className="space-y-8">
          {visibleWeeks.map((week) => (
            <div key={week.week} className="bg-gray-800 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-blue-400">
                  📅 Week {week.week} ({selectedCountry.toUpperCase()})
                </h2>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  week.week === currentWeek
                    ? 'bg-green-600 text-white'
                    : week.week < currentWeek
                    ? 'bg-gray-700 text-gray-300'
                    : 'bg-yellow-600 text-white'
                }`}>
                  {week.week === currentWeek ? 'CURRENT' : week.week < currentWeek ? 'PAST' : 'UPCOMING'}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {week.matches.map((match: any, matchIdx: number) => {
                  const matchId = getMatchId(
                    selectedCountry,
                    week.week - 1,
                    matchIdx,
                    match.home.shortName,
                    match.away.shortName
                  );
                  
                  const result = matchResults[matchId] || simulateMatch(matchId, 40, null);
                  const isAdminSet = result.isAdminSet;
                  
                  return (
                    <div
                      key={matchIdx}
                      className={`border rounded-lg p-4 ${
                        isAdminSet
                          ? 'border-green-500 bg-green-900/20'
                          : 'border-gray-700 bg-gray-900/50'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-400">
                            Match {matchIdx + 1}
                          </span>
                          {isAdminSet && (
                            <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                              ADMIN SET
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-400">
                          {new Date().toLocaleDateString()}
                        </div>
                      </div>
                      
                      {/* Teams */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-center flex-1">
                          <div className="font-bold text-lg">{match.home.shortName}</div>
                          <div className="text-sm text-gray-400">{match.home.name}</div>
                        </div>
                        
                        <div className="mx-4">
                          <div className="text-3xl font-bold">
                            {result.homeGoals} - {result.awayGoals}
                          </div>
                          <div className="text-xs text-center text-gray-400 mt-1">
                            {result.winner === 'home' ? '🏆' : 
                             result.winner === 'away' ? '🏆' : 
                             '🤝'}
                          </div>
                        </div>
                        
                        <div className="text-center flex-1">
                          <div className="font-bold text-lg">{match.away.shortName}</div>
                          <div className="text-sm text-gray-400">{match.away.name}</div>
                        </div>
                      </div>
                      
                      {/* Goal Timeline */}
                      {result.events && result.events.length > 0 && (
                        <div className="mb-4">
                          <div className="text-sm font-medium text-gray-400 mb-2">Goal Timeline:</div>
                          <div className="flex flex-wrap gap-1">
                            {result.events.map((event: any, idx: number) => (
                              <div
                                key={idx}
                                className={`px-2 py-1 rounded text-xs ${
                                  event.team === 'home'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-red-600 text-white'
                                }`}
                              >
                                {event.team === 'home' ? match.home.shortName : match.away.shortName} {event.time}'
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Admin Controls */}
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => handleSetOutcome(
                            matchId,
                            match.home.shortName,
                            match.away.shortName
                          )}
                          className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
                        >
                          Set Outcome
                        </button>
                        
                        {isAdminSet && (
                          <button
                            onClick={() => handleClearOutcome(matchId)}
                            className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-medium"
                          >
                            Clear
                          </button>
                        )}
                        
                        <button
                          onClick={() => {
                            // Regenerate simulated outcome
                            const newResult = simulateMatch(matchId, 40, null);
                            setMatchResults(prev => ({
                              ...prev,
                              [matchId]: {
                                ...newResult,
                                isAdminSet: false,
                                homeTeam: match.home.shortName,
                                awayTeam: match.away.shortName
                              }
                            }));
                          }}
                          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium"
                          title="Regenerate simulated outcome"
                        >
                          ↻
                        </button>
                      </div>
                      
                      {/* Match Details */}
                      <div className="mt-3 pt-3 border-t border-gray-700">
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                          <div>
                            <span className="font-medium">Match ID:</span>
                            <div className="truncate font-mono" title={matchId}>
                              {matchId.substring(0, 20)}...
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-medium">Status:</span>
                            <div className={isAdminSet ? 'text-green-400' : 'text-yellow-400'}>
                              {isAdminSet ? 'Admin Set' : 'Simulated'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Week Summary */}
              <div className="mt-6 pt-4 border-t border-gray-700">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-sm text-gray-400">Total Matches:</span>
                    <span className="ml-2 font-bold">{week.matches.length}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-400">Admin Set:</span>
                    <span className="ml-2 font-bold">
                      {week.matches.filter((match: any, idx: number) => {
                        const matchId = getMatchId(
                          selectedCountry,
                          week.week - 1,
                          idx,
                          match.home.shortName,
                          match.away.shortName
                        );
                        return matchResults[matchId]?.isAdminSet;
                      }).length}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-400">Simulated:</span>
                    <span className="ml-2 font-bold">
                      {week.matches.filter((match: any, idx: number) => {
                        const matchId = getMatchId(
                          selectedCountry,
                          week.week - 1,
                          idx,
                          match.home.shortName,
                          match.away.shortName
                        );
                        return !matchResults[matchId]?.isAdminSet;
                      }).length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Bulk Actions */}
        <div className="mt-8 p-6 bg-gray-800 rounded-lg">
          <h3 className="text-xl font-bold mb-4">Bulk Actions</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                if (confirm('Generate simulated outcomes for all matches in current week?')) {
                  visibleWeeks.forEach((week) => {
                    week.matches.forEach((match: any, matchIdx: number) => {
                      const matchId = getMatchId(
                        selectedCountry,
                        week.week - 1,
                        matchIdx,
                        match.home.shortName,
                        match.away.shortName
                      );
                      const newResult = simulateMatch(matchId, 40, null);
                      setMatchResults(prev => ({
                        ...prev,
                        [matchId]: {
                          ...newResult,
                          isAdminSet: false,
                          homeTeam: match.home.shortName,
                          awayTeam: match.away.shortName
                        }
                      }));
                    });
                  });
                  alert('All matches regenerated!');
                }
              }}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded font-medium"
            >
              Regenerate All Simulated
            </button>
            
            <button
              onClick={async () => {
                if (confirm('Clear all admin outcomes for current week?')) {
                  try {
                    const matchIds = visibleWeeks.flatMap((week) =>
                      week.matches.map((match: any, matchIdx: number) =>
                        getMatchId(
                          selectedCountry,
                          week.week - 1,
                          matchIdx,
                          match.home.shortName,
                          match.away.shortName
                        )
                      )
                    );
                    
                    const { error } = await supabase
                      .from('fixture_outcomes')
                      .delete()
                      .in('match_id', matchIds);
                    
                    if (error) throw error;
                    
                    alert('All admin outcomes cleared for current week!');
                    loadAdminOutcomes(fixtureSchedule);
                  } catch (error) {
                    console.error('Error clearing outcomes:', error);
                    alert('Failed to clear outcomes');
                  }
                }
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-medium"
            >
              Clear All Admin Outcomes
            </button>
            
            <button
              onClick={() => {
                // Export all outcomes to JSON
                const exportData = Object.entries(matchResults).map(([matchId, result]) => ({
                  matchId,
                  ...result
                }));
                
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `fixture-outcomes-${selectedCountry}-week${currentWeek}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-medium"
            >
              Export Outcomes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminFixturesPage;