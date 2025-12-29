import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Award, TrendingUp, Clock, Filter, RefreshCw, ChevronDown, Target, Hash, Trophy, Timer, Divide, Check, X } from "lucide-react";
import { getFixtureSet } from "@/data/fixtureSets";
import { getGlobalSchedule } from "@/lib/matchScheduleService";
import { supabase } from "@/lib/supabaseClient";
import { getBetsFromSupabase, cancelBet } from "@/lib/supabaseBets";
import { calculateBetResult } from "../betResolution";
import { leagues } from "@/data/leagues"; // Make sure this import exists and points to your leagues array

// Define BetData type with all necessary fields
type BetData = {
  __raw?: any;
  id?: string;
  status?: string;
  selection?: string;
  odds?: number | string;
  stake?: number | string;
  potentialWinnings?: number | string;
  type?: string;
  kickoffTime?: string | number | Date;
  match?: any;
  homeTeam?: string;
  awayTeam?: string;
  complited?: string;
  match_id?: string;
  result?: string;
  home_goals?: number;
  away_goals?: number;
  winner?: string;
  result_amount?: number | null;
  placed_at?: string;
  is_final?: boolean;
  match_results?: any;
  
  // Additional fields for bet resolution
  bet_type?: string;
  bet_category?: string;
  threshold?: number;
  first_goal_time?: number;
  half_time_home_goals?: number;
  half_time_away_goals?: number;
  
  // Legacy fields
  amount?: number | string;
  potential_win?: number | string;
  created_at?: string;
  updated_at?: string;
  settled_at?: string;
};

const MyBets: React.FC = () => {
  // State declarations
  const [bets, setBets] = useState<BetData[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "won" | "lost">("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showRawId, setShowRawId] = useState<number | null>(null);
  const [recentlyUpdatedBets, setRecentlyUpdatedBets] = useState<Set<string>>(new Set());
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const navigate = useNavigate();
  const matchIdsRef = useRef<Set<string>>(new Set());
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get scheduled match IDs
  let scheduledMatchIds: Set<string> = new Set();
  try {
    const schedule = getGlobalSchedule();
    // You need to provide a league object and a setIdx (e.g., 0) to getFixtureSet
    // If you have a leagues array and want to use the first league as default:

    const fixtureSet = leagues && leagues.length > 0 ? getFixtureSet(leagues[0], 0) : [];
    if (fixtureSet) {
      for (const week of fixtureSet) {
        for (const match of week.matches) {
          if (match.matchId) {
            scheduledMatchIds.add(String(match.matchId));
          } else if (match.id) {
            scheduledMatchIds.add(String(match.id));
          }
        }
      }
    }
  } catch (e) {
    scheduledMatchIds = new Set();
  }

  // COMPREHENSIVE BET RESOLUTION FUNCTIONS
  const resolveBetOutcome = (bet: BetData): 'won' | 'lost' | 'pending' => { 
    if (!bet) return 'pending';

    // Check if status is already explicitly set
    const status = bet.status?.toLowerCase();
    if (status === 'won' || status === 'lost') return status;

    // Only resolve if bet is marked as completed/final AND final scores are present
    const homeGoals = typeof bet.home_goals === 'number' ? bet.home_goals : undefined;
    const awayGoals = typeof bet.away_goals === 'number' ? bet.away_goals : undefined;
    const hasFinalScores = typeof homeGoals === 'number' && typeof awayGoals === 'number';
    if ((bet.complited === 'yes' || bet.is_final === true) && hasFinalScores) {
      return calculateBetResult(bet);
    }

    // Otherwise, always pending
    return 'pending';
  };

  // calculateBetResult is now imported from shared utility

  // Helper function to infer bet type from selection
  const inferBetType = (selection: string): string => {
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
  };

  // Specific bet type resolvers
  const resolveOverUnderBet = (selection: string, totalGoals: number, threshold?: number): 'won' | 'lost' => {
    // Extract threshold from selection if not provided
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
  };

  const resolveCorrectScoreBet = (selection: string, homeGoals: number, awayGoals: number): 'won' | 'lost' => {
    const match = selection.match(/^CS (\d+)-(\d+)$/);
    if (match) {
      const expectedHome = parseInt(match[1]);
      const expectedAway = parseInt(match[2]);
      return (homeGoals === expectedHome && awayGoals === expectedAway) ? 'won' : 'lost';
    }
    return 'lost';
  };

  const resolveTotalGoalsBet = (selection: string, totalGoals: number): 'won' | 'lost' => {
    const match = selection.match(/^TG (OVER|UNDER) ([\d.]+)$/);
    if (match) {
      const operator = match[1];
      const threshold = parseFloat(match[2]);
      if (operator === 'OVER') return totalGoals > threshold ? 'won' : 'lost';
      if (operator === 'UNDER') return totalGoals < threshold ? 'won' : 'lost';
    }
    return 'lost';
  };

  const resolveFirstGoalTimeBet = (bet: BetData, selection: string): 'won' | 'lost' | 'pending' => {
    const match = selection.match(/^FIRST GOAL (\d+)-(\d+)$/);
    if (match && bet.first_goal_time !== undefined) {
      const minFrom = parseInt(match[1]);
      const minTo = parseInt(match[2]);
      return (bet.first_goal_time >= minFrom && bet.first_goal_time <= minTo) ? 'won' : 'lost';
    }
    return 'pending'; // No first goal time data
  };

  const resolveHalfTimeFullTimeBet = (
    bet: BetData, 
    selection: string, 
    homeWins: boolean, 
    awayWins: boolean, 
    isDraw: boolean
  ): 'won' | 'lost' | 'pending' => {
    const htHome = bet.half_time_home_goals ?? 0;
    const htAway = bet.half_time_away_goals ?? 0;
    const htHomeWins = htHome > htAway;
    const htAwayWins = htAway > htHome;
    const htDraw = htHome === htAway;
    
    const match = selection.match(/^HT\/FT (\d|X)\/(\d|X)$/);
    if (match) {
      const ht = match[1];
      const ft = match[2];
      
      // Check HT result
      let htCorrect = false;
      if (ht === '1') htCorrect = htHomeWins;
      else if (ht === '2') htCorrect = htAwayWins;
      else if (ht === 'X') htCorrect = htDraw;
      
      // Check FT result
      let ftCorrect = false;
      if (ft === '1') ftCorrect = homeWins;
      else if (ft === '2') ftCorrect = awayWins;
      else if (ft === 'X') ftCorrect = isDraw;
      
      return (htCorrect && ftCorrect) ? 'won' : 'lost';
    }
    
    return 'pending';
  };

  const inferResultFromSelection = (
    selection: string, 
    homeGoals: number, 
    awayGoals: number, 
    totalGoals: number
  ): 'won' | 'lost' | 'pending' => {
    // Try to match common patterns
    if (selection.match(/^CS/)) return resolveCorrectScoreBet(selection, homeGoals, awayGoals);
    if (selection.match(/^TG/)) return resolveTotalGoalsBet(selection, totalGoals);
    if (selection.match(/^OV|^UNDER|^OVER|^UN/)) return resolveOverUnderBet(selection, totalGoals);
    
    return 'pending';
  };

  // Calculate potential winnings based on bet type and result
  const calculateWinnings = (bet: BetData, result: 'won' | 'lost' | 'pending'): number => {
    if (result !== 'won') return 0;
    
    const stake = Number(bet.stake) || 0;
    const odds = Number(bet.odds) || 0;
    
    // For winning bets: (odds * stake) - stake = profit
    const profit = (odds * stake) - stake;
    return Math.max(0, profit);
  };

  // Calculate loss amount (stake only)
  const calculateLoss = (bet: BetData, result: 'won' | 'lost' | 'pending'): number => {
    if (result !== 'lost') return 0;
    return Number(bet.stake) || 0;
  };

  // Get bet type icon
  const getBetTypeIcon = (betType?: string) => {
    switch (betType?.toUpperCase()) {
      case '1X2':
      case 'MATCH_RESULT':
        return <Trophy className="w-4 h-4" />;
      case 'BTTS':
        return <Target className="w-4 h-4" />;
      case 'OVER_UNDER':
      case 'TOTAL_GOALS':
        return <Hash className="w-4 h-4" />;
      case 'CORRECT_SCORE':
        return <Check className="w-4 h-4" />;
      case 'FIRST_GOAL':
        return <Timer className="w-4 h-4" />;
      case 'ODD_EVEN':
        return <Divide className="w-4 h-4" />;
      default:
        return null;
    }
  };

  // Get bet type label
  const getBetTypeLabel = (bet: BetData): string => {
    const selection = String(bet.selection || '').trim();
    const betType = inferBetType(selection);
    switch (betType) {
      case 'MATCH_RESULT':
        return 'Match Result';
      case 'DOUBLE_CHANCE':
        return 'Double Chance';
      case 'OVER_UNDER':
        return 'Over/Under Goals';
      case 'BTTS':
        return 'Both Teams To Score';
      case 'CORRECT_SCORE':
        return 'Correct Score';
      case 'TOTAL_GOALS_RANGE':
        return 'Total Goals';
      case 'FIRST_GOAL_TIME':
        return 'First Goal Time';
      case 'ODD_EVEN':
        return 'Goals Odd/Even';
      case 'HT_FT':
        return 'Half Time/Full Time';
      case 'DRAW_NO_BET':
        return 'Draw No Bet';
      default:
        // Show the actual bet type placed by the user if available
        return bet.bet_type || bet.type || 'Bet';
    }
  };

  // Get selection display text
  const getSelectionDisplay = (bet: BetData): string => {
    const selection = String(bet.selection || '').trim();
    const normalized = selection.toUpperCase();
    
    // Format for display
    if (normalized === '1') return 'Home Win';
    if (normalized === 'X') return 'Draw';
    if (normalized === '2') return 'Away Win';
    if (normalized === 'BTTS YES') return 'Both Teams To Score - Yes';
    if (normalized === 'BTTS NO') return 'Both Teams To Score - No';
    if (normalized.match(/^OV/)) return selection.replace('OV', 'Over');
    if (normalized.match(/^UN/)) return selection.replace('UN', 'Under');
    if (normalized.match(/^CS/)) return selection.replace('CS', 'Correct Score:');
    if (normalized.match(/^TG/)) return selection.replace('TG', 'Total Goals');
    if (normalized.match(/^FIRST GOAL/)) return selection;
    if (normalized === 'ODD') return 'Goals Odd';
    if (normalized === 'EVEN') return 'Goals Even';
    
    return selection;
  };

  // Check if match has ended
  const hasMatchEnded = (bet: BetData): boolean => {
    const kickoffTime = new Date(bet.kickoffTime || 0).getTime();
    if (isNaN(kickoffTime)) return false;
    
    const currentTime = Date.now();
    const matchDuration = 105 * 60 * 1000; // 90 mins + 15 mins extra/injury time
    const matchEndTime = kickoffTime + matchDuration;
    
    return currentTime >= matchEndTime;
  };

  // Fetch and attach results from Supabase
  useEffect(() => {
    const attachResultsFromSupabase = async () => {
      if (!bets.length) return;
      
      try {
        const betIds = bets
          .map(bet => bet.__raw?.id || bet.id)
          .filter(Boolean);
        
        if (!betIds.length) return;

        const { data: results, error } = await supabase
          .from('bets')
          .select('id, result, home_goals, away_goals, winner, is_final, complited, first_goal_time, half_time_home_goals, half_time_away_goals, bet_type, threshold')
          .in('id', betIds);

        if (error) {
          console.error('Error fetching results from Supabase:', error);
          return;
        }

        const resultsMap = new Map<string, any>();
        (results || []).forEach((row: any) => {
          resultsMap.set(String(row.id), row);
        });

        setBets(prevBets =>
          prevBets.map(bet => {
            const betId = bet.__raw?.id || bet.id;
            if (betId && resultsMap.has(String(betId))) {
              const resultRow = resultsMap.get(String(betId));
              return {
                ...bet,
                result: resultRow.result ?? bet.result,
                home_goals: resultRow.home_goals ?? bet.home_goals,
                away_goals: resultRow.away_goals ?? bet.away_goals,
                winner: resultRow.winner ?? bet.winner,
                is_final: resultRow.is_final ?? bet.is_final,
                complited: resultRow.complited ?? bet.complited,
                first_goal_time: resultRow.first_goal_time ?? bet.first_goal_time,
                half_time_home_goals: resultRow.half_time_home_goals ?? bet.half_time_home_goals,
                half_time_away_goals: resultRow.half_time_away_goals ?? bet.half_time_away_goals,
                bet_type: resultRow.bet_type ?? bet.bet_type,
                threshold: resultRow.threshold ?? bet.threshold,
                match_results: resultRow.match_results ?? bet.match_results,
              };
            }
            return bet;
          })
        );
      } catch (err) {
        console.error('Exception attaching results from Supabase:', err);
      }
    };

    attachResultsFromSupabase();
  }, [bets]);

  // Fetch bets function
  const fetchBets = useCallback(async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      
      if (userId) {
        const { data, error } = await getBetsFromSupabase(userId);
        
        if (error) {
          console.error("Error fetching bets:", error);
          setBets([]);
        } else if (Array.isArray(data)) {
          const newBetIds = new Set(data.map(bet => bet.__raw?.id).filter(Boolean));
          const previouslyUpdated = recentlyUpdatedBets;
          const newlyUpdated = new Set<string>();
          
          data.forEach(bet => {
            const betId = bet.__raw?.id;
            if (betId && !previouslyUpdated.has(betId)) {
              newlyUpdated.add(betId);
            }
          });
          
          setBets(data);
          
          if (newlyUpdated.size > 0) {
            setRecentlyUpdatedBets(newlyUpdated);
            setTimeout(() => {
              setRecentlyUpdatedBets(prev => {
                const next = new Set(prev);
                newlyUpdated.forEach(id => next.delete(id));
                return next;
              });
            }, 3000);
          }
        } else if (data && Array.isArray(data.data)) {
          setBets(data.data);
        } else {
          setBets([]);
        }
      } else {
        setBets([]);
      }
      setLastUpdated(new Date().toLocaleString());
    } catch (err) {
      console.error("Error in fetchBets:", err);
      setBets([]);
    } finally {
      setLoading(false);
    }
  }, [recentlyUpdatedBets]);

  // Fetch bets on mount
  useEffect(() => {
    fetchBets();
  }, [fetchBets]);

  // Auto-refresh setup
  useEffect(() => {
    if (autoRefreshEnabled) {
      refreshIntervalRef.current = setInterval(() => {
        fetchBets();
      }, 120000); // 2 minutes
    } else if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefreshEnabled, fetchBets]);

  // Handle refresh
  const handleRefresh = async () => {
    if (loading) return;
    await fetchBets();
  };

  const toggleAutoRefresh = () => {
    setAutoRefreshEnabled(!autoRefreshEnabled);
  };

  const { toast } = useToast();

  // Cancel bet handler
  const handleCancel = async (e: React.MouseEvent, bet: BetData) => {
    e.stopPropagation();
    if (!bet?.__raw?.id) {
      toast({ title: 'Cancellation failed', description: 'Bet id not available' });
      return;
    }

    try {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      
      if (!userId) {
        toast({ title: 'Not signed in', description: 'Please sign in to cancel bets' });
        setLoading(false);
        return;
      }

      const res = await cancelBet(userId, String(bet.__raw.id));
      if (res?.error) {
        toast({ title: 'Cancel failed', description: String(res.error?.message || res.error) });
      } else {
        toast({ title: 'Bet cancelled', description: `KES ${Number(bet.stake).toLocaleString()} refunded` });
        await fetchBets();
      }
    } catch (err) {
      console.error('Exception cancelling bet', err);
      toast({ title: 'Cancel failed', description: String(err) });
    } finally {
      setLoading(false);
    }
  };

  // Extract team names from bet
  const extractTeamsFromBet = (bet: BetData) => {
    let match = bet.match || bet.__raw?.match || bet.__raw?.matches || bet.__raw?.raw || {};
    
    if (match && (match as any).raw) match = (match as any).raw;
    
    const unwrapKeys = ['data', 'fixture', 'event', 'match', 'payload'];
    for (const k of unwrapKeys) {
      if (match && (match as any)[k]) match = (match as any)[k];
    }
    
    const getTeamName = (obj: any) => {
      if (!obj) return undefined;
      if (typeof obj === 'string') return obj;
      if (typeof obj === 'object') {
        return (obj as any).shortName || (obj as any).name || (obj as any).displayName || (obj as any).fullName || (obj as any).teamName || undefined;
      }
      return undefined;
    };
    
    let home = getTeamName((match as any).homeTeam) || getTeamName((match as any).home) || 
               getTeamName((match as any).participants?.[0]) || getTeamName((match as any).teams?.[0]) || 
               getTeamName((match as any).competitors?.[0]) || getTeamName((match as any).sides?.[0]);
    let away = getTeamName((match as any).awayTeam) || getTeamName((match as any).away) || 
               getTeamName((match as any).participants?.[1]) || getTeamName((match as any).teams?.[1]) || 
               getTeamName((match as any).competitors?.[1]) || getTeamName((match as any).sides?.[1]);
    
    if ((!home || !away) && (match as any).label) {
      const label = (match as any).label;
      const separators = [' vs ', ' v ', ' - ', ' vs. ', '\u2013', '\u2014'];
      for (const sep of separators) {
        if (label.includes(sep)) {
          const parts = label.split(sep).map((s: string) => s.trim()).filter(Boolean);
          if (parts.length >= 2) {
            home = home || parts[0];
            away = away || parts[1];
            break;
          }
        }
      }
    }
    
    home = home || bet.homeTeam || (bet.__raw as any)?.homeTeam;
    away = away || bet.awayTeam || (bet.__raw as any)?.awayTeam;

    if ((!home || !away || home === 'Unknown' || away === 'Unknown') && (bet.__raw as any)?.match_id) {
      const id = (bet.__raw as any).match_id;
      const matchIdPattern = /match-\d+-([^-]+)-vs-([^-]+)/i;
      const m = id.match(matchIdPattern);
      if (m && m.length >= 3) {
        home = home === 'Unknown' || !home ? m[1] : home;
        away = away === 'Unknown' || !away ? m[2] : away;
      }
    }
    
    return { home: home || 'Unknown', away: away || 'Unknown' };
  };

  // Filter bets based on status
  const filteredBets = bets.filter((bet) => {
    if (filter === "all") return true;
    const resolvedStatus = resolveBetOutcome(bet);
    return resolvedStatus?.toLowerCase() === filter;
  });

  // Calculate statistics
  const stats = {
    total: bets.length,
    pending: bets.filter((b) => resolveBetOutcome(b)?.toLowerCase() === "pending").length,
    won: bets.filter((b) => resolveBetOutcome(b)?.toLowerCase() === "won").length,
    lost: bets.filter((b) => resolveBetOutcome(b)?.toLowerCase() === "lost").length,
    totalStaked: bets.reduce((sum, b) => sum + (Number(b.stake) || 0), 0),
    totalWon: bets
      .filter((b) => resolveBetOutcome(b)?.toLowerCase() === "won")
      .reduce((sum, b) => sum + calculateWinnings(b, 'won'), 0),
    totalLost: bets
      .filter((b) => resolveBetOutcome(b)?.toLowerCase() === "lost")
      .reduce((sum, b) => sum + calculateLoss(b, 'lost'), 0),
    potentialWinnings: bets
      .filter((b) => resolveBetOutcome(b)?.toLowerCase() === "pending")
      .reduce((sum, b) => sum + (Number(b.potentialWinnings) || Number(b.odds) * Number(b.stake)), 0),
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "won":
        return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800";
      case "lost":
        return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800";
      case "pending":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800";
      default:
        return "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-800";
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case "won":
        return <Award className="w-4 h-4" />;
      case "lost":
        return <TrendingUp className="w-4 h-4 rotate-180" />;
      case "pending":
        return <Clock className="w-4 h-4" />;
      default:
        return null;
    }
  };

  // Render function
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4 md:p-6">
      {/* Back Button */}
      <div className="mb-6">
        <Button 
          onClick={() => navigate("/betting")} 
          variant="outline" 
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white border-blue-500"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Betting
        </Button>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-700 dark:to-blue-900 rounded-lg p-6 text-white shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">My Bets</h1>
              <p className="text-blue-100">Track all your bets and winnings</p>
              <div className="flex items-center gap-2 mt-2">
                <div className={`w-3 h-3 rounded-full ${autoRefreshEnabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                <span className="text-sm">
                  Auto-refresh: {autoRefreshEnabled ? 'ON (every 2 min)' : 'OFF'}
                </span>
              </div>
            </div>
            <Button
              onClick={toggleAutoRefresh}
              variant={autoRefreshEnabled ? "default" : "outline"}
              className={autoRefreshEnabled ? "bg-green-600 hover:bg-green-700" : "bg-gray-600 hover:bg-gray-700"}
            >
              {autoRefreshEnabled ? "Auto-Refresh ON" : "Auto-Refresh OFF"}
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-4 min-h-[100px] bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 flex flex-col justify-between">
          <div className="text-sm text-muted-foreground mb-2">Total Bets</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white min-h-[32px]">{stats.total}</div>
        </Card>

        <Card className="p-4 min-h-[100px] bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 flex flex-col justify-between">
          <div className="text-sm text-green-700 dark:text-green-400 mb-2">Won</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400 min-h-[32px]">{stats.won}</div>
          <div className="text-xs text-green-600 dark:text-green-400 mt-1 min-h-[20px]">
            KES {stats.totalWon.toLocaleString()}
          </div>
        </Card>

        <Card className="p-4 min-h-[100px] bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 flex flex-col justify-between">
          <div className="text-sm text-red-700 dark:text-red-400 mb-2">Lost</div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400 min-h-[32px]">{stats.lost}</div>
          <div className="text-xs text-red-600 dark:text-red-400 mt-1 min-h-[20px]">
            -KES {stats.totalLost.toLocaleString()}
          </div>
        </Card>

        <Card className="p-4 min-h-[100px] bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 flex flex-col justify-between">
          <div className="text-sm text-blue-700 dark:text-blue-400 mb-2">Pending</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 min-h-[32px]">{stats.pending}</div>
          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            KES {stats.potentialWinnings.toLocaleString()}
          </div>
        </Card>
      </div>

      {/* Financial Summary */}
      <Card className="p-4 mb-8 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 border-indigo-200 dark:border-indigo-800">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-muted-foreground mb-2">Total Staked</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              KES {stats.totalStaked.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-2">Net Profit/Loss</div>
            <div className={`text-xl font-bold ${stats.totalWon - stats.totalLost >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {stats.totalWon - stats.totalLost >= 0 ? '+' : ''}
              KES {(stats.totalWon - stats.totalLost).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-2">Last Updated</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {lastUpdated ? lastUpdated.split(',')[1]?.trim() || lastUpdated : 'Never'}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-2">Win Rate</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {stats.total > 0 ? Math.round((stats.won / stats.total) * 100) : 0}%
            </div>
          </div>
        </div>
      </Card>

      {/* Filters and Controls */}
      <div className="flex gap-2 mb-6 flex-wrap items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => setFilter("all")}
            variant={filter === "all" ? "default" : "outline"}
            className={filter === "all" ? "bg-blue-600 hover:bg-blue-700" : ""}
          >
            <Filter className="w-4 h-4 mr-2" />
            All Bets
          </Button>
          <Button
            onClick={() => setFilter("pending")}
            variant={filter === "pending" ? "default" : "outline"}
            className={filter === "pending" ? "bg-blue-600 hover:bg-blue-700" : ""}
          >
            Pending ({stats.pending})
          </Button>
          <Button
            onClick={() => setFilter("won")}
            variant={filter === "won" ? "default" : "outline"}
            className={filter === "won" ? "bg-green-600 hover:bg-green-700" : ""}
          >
            Won ({stats.won})
          </Button>
          <Button
            onClick={() => setFilter("lost")}
            variant={filter === "lost" ? "default" : "outline"}
            className={filter === "lost" ? "bg-red-600 hover:bg-red-700" : ""}
          >
            Lost ({stats.lost})
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleRefresh}
            variant="outline"
            className="flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw className="w-4 h-4" />
            {loading ? 'Refreshing...' : 'Refresh Now'}
          </Button>
        </div>
      </div>

      {/* Bets List */}
      {loading && bets.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center space-x-2 text-muted-foreground">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
            <span>Loading your bets...</span>
          </div>
        </div>
      ) : filteredBets.length === 0 ? (
        <Card className="p-12 text-center bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <div className="text-muted-foreground mb-2">
            {bets.length === 0 ? "You have not placed any bets yet." : `No ${filter} bets found.`}
          </div>
          <p className="text-sm text-muted-foreground">
            {bets.length === 0 ? "Visit the home page to place your first bet!" : "Try changing your filter."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredBets.map((bet, idx) => {
            const betId = bet.__raw?.id;
            const isRecentlyUpdated = betId && recentlyUpdatedBets.has(betId);
            const teams = extractTeamsFromBet(bet);
            const resolvedStatus = resolveBetOutcome(bet);
            const betTypeLabel = getBetTypeLabel(bet);
            const selectionDisplay = getSelectionDisplay(bet);
            const matchEnded = hasMatchEnded(bet);
            const hasScores = typeof bet.home_goals === 'number' && typeof bet.away_goals === 'number';
            
            // Calculate winnings/loss
            const winnings = calculateWinnings(bet, resolvedStatus);
            const loss = calculateLoss(bet, resolvedStatus);

            return (
              <Card
                key={idx}
                className={`bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 cursor-pointer ${isRecentlyUpdated ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => setExpandedId(expandedId === idx ? null : idx)}
              >
                <div className="p-4 md:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge
                          variant="outline"
                          className={`${getStatusColor(resolvedStatus)} border flex items-center gap-1`}
                        >
                          {getStatusIcon(resolvedStatus)}
                          <span className="capitalize">{resolvedStatus}</span>
                        </Badge>
                        
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          {getBetTypeIcon(bet.bet_type)}
                          <span>{betTypeLabel}</span>
                        </div>
                        
                        {isRecentlyUpdated && (
                          <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                            Updated
                          </Badge>
                        )}
                      </div>

                      <div className="mb-3">
                        <div className="font-bold text-slate-900 dark:text-white text-lg">
                          {teams.home} vs {teams.away}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {new Date(bet.kickoffTime || 0).toLocaleString()}
                          {hasScores && (
                            <span className="ml-2 text-green-600 font-semibold">
                              Final: {bet.home_goals} - {bet.away_goals}
                            </span>
                          )}
                          {matchEnded && !hasScores && (
                            <span className="ml-2 text-amber-600">Awaiting results...</span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground text-xs">Selection</div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {selectionDisplay}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">Odds</div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {Number(bet.odds || 0).toFixed(2)}x
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">Stake</div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            KES {Number(bet.stake || 0).toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">
                            {resolvedStatus === 'won' ? 'Won' : resolvedStatus === 'lost' ? 'Lost' : 'Potential'}
                          </div>
                          <div className={`font-semibold ${
                            resolvedStatus === 'won' 
                              ? 'text-green-600 dark:text-green-400' 
                              : resolvedStatus === 'lost'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-blue-600 dark:text-blue-400'
                          }`}>
                            {resolvedStatus === 'won' 
                              ? `+KES ${winnings.toLocaleString()}`
                              : resolvedStatus === 'lost'
                              ? `-KES ${loss.toLocaleString()}`
                              : `KES ${Number(bet.potentialWinnings ?? (Number(bet.odds || 0) * Number(bet.stake || 0) || 0)).toLocaleString()}`
                            }
                          </div>
                        </div>
                      </div>

                      {/* Detailed match info for resolved bets */}
                      {resolvedStatus !== 'pending' && hasScores && (
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground text-xs mb-1">Match Result</div>
                              <div className="text-lg font-bold text-slate-900 dark:text-white">
                                {bet.home_goals} - {bet.away_goals}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-xs mb-1">Your Bet</div>
                              <div className={`text-lg font-bold ${
                                resolvedStatus === 'won' 
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}>
                                {selectionDisplay}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-xs mb-1">Outcome</div>
                              <div className={`text-lg font-bold ${
                                resolvedStatus === 'won' 
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}>
                                {resolvedStatus === 'won' ? '✅ WON' : '❌ LOST'}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <ChevronDown
                        className={`w-5 h-5 text-muted-foreground ${expandedId === idx ? "rotate-180" : ""}`}
                      />
                      
                      {/* Quick status summary */}
                      {resolvedStatus === 'won' && (
                        <div className="text-right">
                          <div className="text-xs text-green-600 dark:text-green-400">Won</div>
                          <div className="text-lg font-bold text-green-600 dark:text-green-400">
                            +KES {winnings.toLocaleString()}
                          </div>
                        </div>
                      )}
                      
                      {resolvedStatus === 'lost' && (
                        <div className="text-right">
                          <div className="text-xs text-red-600 dark:text-red-400">Lost</div>
                          <div className="text-lg font-bold text-red-600 dark:text-red-400">
                            -KES {loss.toLocaleString()}
                          </div>
                        </div>
                      )}
                      
                      {resolvedStatus === 'pending' && (
                        <div className="text-right">
                          <div className="text-xs text-blue-600 dark:text-blue-400">Pending</div>
                          <div className="text-sm text-muted-foreground">
                            {matchEnded ? 'Awaiting results' : 'In progress'}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedId === idx && (
                  <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4 md:p-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                      <div>
                        <div className="text-muted-foreground text-xs mb-1">Bet ID</div>
                        <div className="font-mono text-slate-900 dark:text-white">
                          {betId ? `#${betId.slice(-8)}` : `#${idx + 1}`}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs mb-1">Bet Type</div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {betTypeLabel}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs mb-1">Placed On</div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {new Date(bet.placed_at || bet.created_at || bet.kickoffTime || 0).toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs mb-1">Potential Return</div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          KES {Number(Number(bet.odds || 0) * Number(bet.stake || 0)).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    
                    {/* Match Details */}
                    {hasScores && (
                      <div className="mb-4 p-3 bg-white dark:bg-slate-800 rounded border">
                        <div className="text-sm font-semibold text-muted-foreground mb-2">Match Details</div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center">
                            <div className="text-xs text-muted-foreground">Home</div>
                            <div className="text-lg font-bold">{bet.home_goals}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-muted-foreground">Away</div>
                            <div className="text-lg font-bold">{bet.away_goals}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-muted-foreground">Total Goals</div>
                            <div className="text-lg font-bold">
                              {Number(bet.home_goals || 0) + Number(bet.away_goals || 0)}
                            </div>
                          </div>
                        </div>
                        {bet.first_goal_time && (
                          <div className="mt-2 text-center text-sm text-muted-foreground">
                            First Goal: {bet.first_goal_time}' minute
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-4">
                      {resolvedStatus === 'pending' && matchEnded === false && (
                        <Button
                          onClick={(e) => handleCancel(e, bet)}
                          variant="destructive"
                          size="sm"
                        >
                          Cancel Bet
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Auto-refresh indicator */}
      {autoRefreshEnabled && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
          <span className="text-sm">Auto-refresh active (2 min)</span>
        </div>
      )}
    </div>
  );
};

export default MyBets;