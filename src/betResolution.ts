// Utility for bet resolution logic extracted from MyBets.tsx
export type BetData = {
  selection?: string;
  bet_type?: string;
  home_goals?: number;
  away_goals?: number;
  first_goal_time?: number;
  half_time_home_goals?: number;
  half_time_away_goals?: number;
  is_final?: boolean;
};

export function calculateBetResult(bet: BetData): 'won' | 'lost' | 'pending' {
  const homeGoals = typeof bet.home_goals === 'number' ? bet.home_goals : undefined;
  const awayGoals = typeof bet.away_goals === 'number' ? bet.away_goals : undefined;
  if (typeof homeGoals !== 'number' || typeof awayGoals !== 'number') {
    return 'pending';
  }
  const totalGoals = homeGoals + awayGoals;
  const homeWins = homeGoals > awayGoals;
  const awayWins = awayGoals > homeGoals;
  const isDraw = homeGoals === awayGoals;

  // --- BULLETPROOF NORMALIZATION ---
  const normalize = (v: string) => String(v || '').trim().replace(/\s+/g, ' ').replace(/[_-]+/g, ' ').toUpperCase();
  // Use bet_type if present, fallback to inferBetType
  let marketKey = '';
  if (bet.bet_type && bet.bet_type.trim()) {
    marketKey = normalize(bet.bet_type);
  } else {
    marketKey = normalize(inferBetType(bet.selection || ''));
  }
    let selectionKey = normalize(bet.selection || '');

  // Debug logging
  if (typeof window !== 'undefined' && (window as any).DEBUG_BET_RESOLUTION) {
    // Only log in browser if DEBUG_BET_RESOLUTION is set
    // eslint-disable-next-line no-console
    console.log('[BET RESOLUTION]', {
      selection: bet.selection,
      bet_type: bet.bet_type,
      marketKey,
      selectionKey,
      homeGoals,
      awayGoals,
      totalGoals
    });
  }

  // --- OVER/UNDER PARSER ---
  function parseOverUnder(sel: string) {
    // Accepts: OVER 1.5, OVER1.5, OVER_1.5, UNDER 2, etc.
    const match = sel.match(/(OVER|UNDER)[ _]?(\d+(\.\d+)?)/i);
    if (!match) return null;
    return {
      type: match[1].toUpperCase(),
      line: parseFloat(match[2])
    };
  }
  function resolveOverUnder(sel: string, totalGoals: number) {
    const parsed = parseOverUnder(sel);
    if (typeof window !== 'undefined' && (window as any).DEBUG_BET_RESOLUTION) {
      console.log('[BET RESOLUTION][OU]', { sel, totalGoals, parsed });
    }
    if (!parsed) return 'lost';
    if (parsed.type === 'OVER') {
      const res = totalGoals > parsed.line ? 'won' : 'lost';
      if (typeof window !== 'undefined' && (window as any).DEBUG_BET_RESOLUTION) {
        console.log(`[BET RESOLUTION][OU] OVER: totalGoals(${totalGoals}) > line(${parsed.line}) = ${res}`);
      }
      return res;
    }
    if (parsed.type === 'UNDER') {
      const res = totalGoals < parsed.line ? 'won' : 'lost';
      if (typeof window !== 'undefined' && (window as any).DEBUG_BET_RESOLUTION) {
        console.log(`[BET RESOLUTION][OU] UNDER: totalGoals(${totalGoals}) < line(${parsed.line}) = ${res}`);
      }
      return res;
    }
    return 'lost';
  }

  // --- FINAL SWITCH ---
  switch (marketKey) {
    // 1. MATCH RESULT (1X2)
    case '1X2':
    case 'MATCH RESULT': {
      if (selectionKey === '1' || selectionKey === 'HOME') return homeWins ? 'won' : 'lost';
      if (selectionKey === '2' || selectionKey === 'AWAY') return awayWins ? 'won' : 'lost';
      if (selectionKey === 'X' || selectionKey === 'DRAW') return isDraw ? 'won' : 'lost';
      return 'lost';
    }
    // 2. DOUBLE CHANCE
    case 'DOUBLE CHANCE': {
      if (selectionKey === '1X') return (homeWins || isDraw) ? 'won' : 'lost';
      if (selectionKey === '12') return !isDraw ? 'won' : 'lost';
      if (selectionKey === 'X2') return (awayWins || isDraw) ? 'won' : 'lost';
      return 'lost';
    }
    // 3. OVER / UNDER
    case 'OVER UNDER':
    case 'TOTAL GOALS':
    case 'OV/UN':
      case 'OVUN':
      case 'OVUN1.5':
      case 'OVUN2.5':
      case 'OVUN3.5':
      case 'OVUN4.5':
      case 'OVUN5.5':
      case 'OVUN6.5':
      case 'OVUN7.5':
      case 'OVUN8.5':
      case 'OVUN9.5':
      return resolveOverUnder(selectionKey, totalGoals);
    // 4. BOTH TEAMS TO SCORE
    case 'BTTS':
    case 'BOTH TEAMS TO SCORE': {
      const bothScored = homeGoals > 0 && awayGoals > 0;
      if (typeof window !== 'undefined' && (window as any).DEBUG_BET_RESOLUTION) {
        console.log('[BET RESOLUTION][BTTS]', { selectionKey, homeGoals, awayGoals, bothScored });
      }
      if (selectionKey === 'YES' || selectionKey === 'BTTS YES') return bothScored ? 'won' : 'lost';
      if (selectionKey === 'NO' || selectionKey === 'BTTS NO') return !bothScored ? 'won' : 'lost';
      return 'lost';
    }
    // 5. CORRECT SCORE
    case 'CORRECT SCORE':
    case 'CS':
      return resolveCorrectScoreBet(selectionKey, homeGoals, awayGoals);
    // 6. TOTAL GOALS RANGE
    case 'TOTAL GOALS RANGE':
    case 'TG':
      return resolveTotalGoalsBet(selectionKey, totalGoals);
    // 7. FIRST GOAL TIME
    case 'FIRST GOAL TIME':
    case 'FIRST GOAL':
      return resolveFirstGoalTimeBet(bet, selectionKey);
    // 8. ODD / EVEN
    case 'ODD EVEN':
    case 'GOALS ODD EVEN': {
      const isOdd = totalGoals % 2 === 1;
      if (typeof window !== 'undefined' && (window as any).DEBUG_BET_RESOLUTION) {
        console.log('[BET RESOLUTION][ODD EVEN]', { selectionKey, totalGoals, isOdd });
      }
      if (selectionKey.includes('ODD')) return isOdd ? 'won' : 'lost';
      if (selectionKey.includes('EVEN')) return !isOdd ? 'won' : 'lost';
      return 'lost';
    }
    // 9. HALF TIME / FULL TIME
    case 'HT/FT':
      return resolveHalfTimeFullTimeBet(bet, selectionKey, homeWins, awayWins, isDraw);
    // 10. DRAW NO BET
    case 'DRAW NO BET': {
      if (isDraw) return 'pending'; // void
      if (selectionKey === 'HOME' || selectionKey === '1') return homeWins ? 'won' : 'lost';
      if (selectionKey === 'AWAY' || selectionKey === '2') return awayWins ? 'won' : 'lost';
      return 'lost';
    }
    default:
      return inferResultFromSelection(selectionKey, homeGoals, awayGoals, totalGoals);
  }
}

function inferBetType(selection: string): string {
  const normalized = selection.toUpperCase();
  if (normalized.match(/^(1|2|X|HOME|AWAY|DRAW)$/)) return 'MATCH RESULT';
  if (normalized.match(/^(1X|12|X2|HOME OR DRAW|HOME OR AWAY|DRAW OR AWAY)$/)) return 'DOUBLE CHANCE';
  if (normalized.match(/^(OV|UNDER|OVER|UN)[\d.]/)) return 'OVER UNDER';
  if (normalized.match(/^BTTS/)) return 'BTTS';
  if (normalized.match(/^CS \d+-\d+/)) return 'CORRECT SCORE';
  if (normalized.match(/^TG (OVER|UNDER)/)) return 'TOTAL GOALS RANGE';
  if (normalized.match(/^FIRST GOAL/)) return 'FIRST GOAL TIME';
  if (normalized.match(/^(ODD|EVEN|GOALS ODD|GOALS EVEN)$/)) return 'ODD EVEN';
  if (normalized.match(/^HT\/FT/)) return 'HT/FT';
  return 'UNKNOWN';
}

function resolveCorrectScoreBet(selection: string, homeGoals: number, awayGoals: number): 'won' | 'lost' {
  // Accepts normalized and non-normalized forms
  // Try to match: 'CS 2-1', 'CS_2-1', 'CS 2 1', 'CS_2_1', etc.
  const match = selection.match(/CS[ _-]?(\d+)[ _-]?(\d+)/i);
  if (match) {
    const expectedHome = parseInt(match[1]);
    const expectedAway = parseInt(match[2]);
    return (homeGoals === expectedHome && awayGoals === expectedAway) ? 'won' : 'lost';
  }
  return 'lost';
}

function resolveTotalGoalsBet(selection: string, totalGoals: number): 'won' | 'lost' {
  const match = selection.match(/^TG (OVER|UNDER) ([\d.]+)$/);
  if (match) {
    const operator = match[1];
    const threshold = parseFloat(match[2]);
    if (operator === 'OVER') return totalGoals > threshold ? 'won' : 'lost';
    if (operator === 'UNDER') return totalGoals < threshold ? 'won' : 'lost';
  }
  return 'lost';
}

function resolveFirstGoalTimeBet(bet: BetData, selection: string): 'won' | 'lost' | 'pending' {
  const match = selection.match(/^FIRST GOAL (\d+)-(\d+)$/);
  if (match && bet.first_goal_time !== undefined) {
    const minFrom = parseInt(match[1]);
    const minTo = parseInt(match[2]);
    return (bet.first_goal_time >= minFrom && bet.first_goal_time <= minTo) ? 'won' : 'lost';
  }
  return 'pending'; // No first goal time data
}

function resolveHalfTimeFullTimeBet(
  bet: BetData,
  selection: string,
  homeWins: boolean,
  awayWins: boolean,
  isDraw: boolean
): 'won' | 'lost' | 'pending' {
  const htHome = bet.half_time_home_goals ?? 0;
  const htAway = bet.half_time_away_goals ?? 0;
  const htHomeWins = htHome > htAway;
  const htAwayWins = htAway > htHome;
  const htDraw = htHome === htAway;
  const match = selection.match(/^HT\/FT (\d|X)\/(\d|X)$/);
  if (match) {
    const ht = match[1];
    const ft = match[2];
    let htCorrect = false;
    if (ht === '1') htCorrect = htHomeWins;
    else if (ht === '2') htCorrect = htAwayWins;
    else if (ht === 'X') htCorrect = htDraw;
    let ftCorrect = false;
    if (ft === '1') ftCorrect = homeWins;
    else if (ft === '2') ftCorrect = awayWins;
    else if (ft === 'X') ftCorrect = isDraw;
    return (htCorrect && ftCorrect) ? 'won' : 'lost';
  }
  return 'pending';
}

function inferResultFromSelection(
  selection: string,
  homeGoals: number,
  awayGoals: number,
  totalGoals: number
): 'won' | 'lost' | 'pending' {
  if (selection.match(/^CS/)) return resolveCorrectScoreBet(selection, homeGoals, awayGoals);
  if (selection.match(/^TG/)) return resolveTotalGoalsBet(selection, totalGoals);
  if (selection.match(/^OV|^UNDER|^OVER|^UN/)) return resolveOverUnderBet(selection, totalGoals);
  return 'pending';
}

function resolveOverUnderBet(selection: string, totalGoals: number, threshold?: number): 'won' | 'lost' {
  let th = threshold;
  if (!th) {
    const match = selection.match(/(\d+\.?\d*)/);
    if (match) th = parseFloat(match[1]);
  }
  if (selection.includes('OVER') || selection.includes('OV')) {
    return totalGoals > (th || 0) ? 'won' : 'lost';
  } else if (selection.includes('UNDER') || selection.includes('UN')) {
    return totalGoals < (th || 0) ? 'won' : 'lost';
  }
  return 'lost';
}
