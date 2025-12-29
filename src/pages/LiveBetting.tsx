import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Zap, TrendingUp, Clock, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface LiveMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  minute: number;
  homeScore: number;
  awayScore: number;
  odds1x2: { one: number; draw: number; two: number };
  oddsBTTS: { yes: number; no: number };
  status: "live" | "starting" | "ending";
  homeLogoUrl?: string;
  awayLogoUrl?: string;
}

interface LiveBettingProps {
  onBetSelected?: (bet: any) => void;
}

export default function LiveBetting({ onBetSelected }: LiveBettingProps) {
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<LiveMatch | null>(null);
  const [selectedBet, setSelectedBet] = useState<any>(null);

  // You may want to get current week/league from props, context, or a global state
  // For this example, we'll use hardcoded values
  const currentLeague = "Premier League"; // Replace with dynamic value as needed
  const currentWeek = 1; // Replace with dynamic value as needed

  useEffect(() => {
    let isMounted = true;
    async function fetchLiveMatches() {
      setLoading(true);
      // Adjust the query to match your Supabase schema for live matches/outcomes
      const { data, error } = await supabase
        .from('fixture_outcomes')
        .select('*')
        .eq('league', currentLeague)
        .eq('week', currentWeek)
        .eq('status', 'live');
      if (error) {
        console.error('Error fetching live matches:', error);
        setLoading(false);
        return;
      }
      if (isMounted) {
        setLiveMatches(data || []);
        setLoading(false);
      }
    }
    fetchLiveMatches();
    // Poll every 5 seconds for real-time updates
    const interval = setInterval(fetchLiveMatches, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [currentLeague, currentWeek]);

  const handleBetPlacement = (match: LiveMatch, betType: string, selection: string, odds: number) => {
    const bet = {
      match: `${match.homeTeam} vs ${match.awayTeam}`,
      league: match.league,
      type: betType,
      selection,
      odds,
      isLive: true,
    };
    setSelectedBet(bet);
    if (onBetSelected) {
      onBetSelected(bet);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Zap className="w-12 h-12 text-yellow-400 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-300">Loading live matches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <Zap className="w-8 h-8 text-yellow-400 animate-pulse" />
        <h2 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-red-500 bg-clip-text text-transparent">
          Live Betting
        </h2>
        <div className="ml-auto bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-2 rounded-full text-sm font-semibold animate-pulse">
          {liveMatches.length} LIVE MATCHES
        </div>
      </div>

      {liveMatches.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/50 rounded-lg border border-slate-700/50">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-300 text-lg">No live matches available at the moment</p>
          <p className="text-gray-500 text-sm mt-2">Check back soon for live betting opportunities</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {liveMatches.map((match) => (
            <div
              key={match.id}
              className="bg-gradient-to-br from-slate-900/60 to-slate-950/60 border-2 border-yellow-500/30 rounded-lg p-6 hover:border-yellow-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/20"
            >
              {/* Match Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-red-400 font-bold text-sm">LIVE</span>
                  <span className="text-gray-400 text-sm">{match.minute}'</span>
                </div>
                <span className="text-xs bg-slate-700/50 text-gray-300 px-3 py-1 rounded-full">
                  {match.league}
                </span>
              </div>

              {/* Match Score */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex-1">
                  <p className="text-white font-bold text-lg">{match.homeTeam}</p>
                  <p className="text-sm text-gray-400">Home</p>
                </div>

                <div className="flex items-center gap-4 mx-4">
                  <div className="text-center">
                    <p className="text-4xl font-bold text-white">{match.homeScore}</p>
                  </div>
                  <div className="text-gray-400 text-xl">-</div>
                  <div className="text-center">
                    <p className="text-4xl font-bold text-white">{match.awayScore}</p>
                  </div>
                </div>

                <div className="flex-1 text-right">
                  <p className="text-white font-bold text-lg">{match.awayTeam}</p>
                  <p className="text-sm text-gray-400">Away</p>
                </div>
              </div>

              {/* Betting Options */}
              <div className="space-y-3">
                {/* 1X2 Odds */}
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    onClick={() =>
                      handleBetPlacement(match, "1X2", "1", match.odds1x2.one)
                    }
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold py-2 px-3 rounded-lg transition-all duration-200 transform hover:scale-105"
                  >
                    <div className="flex flex-col items-center w-full">
                      <span className="text-xs text-blue-200">HOME</span>
                      <span className="text-lg font-bold">{match.odds1x2.one.toFixed(2)}</span>
                    </div>
                  </Button>

                  <Button
                    onClick={() =>
                      handleBetPlacement(match, "1X2", "X", match.odds1x2.draw)
                    }
                    className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-bold py-2 px-3 rounded-lg transition-all duration-200 transform hover:scale-105"
                  >
                    <div className="flex flex-col items-center w-full">
                      <span className="text-xs text-purple-200">DRAW</span>
                      <span className="text-lg font-bold">
                        {match.odds1x2.draw.toFixed(2)}
                      </span>
                    </div>
                  </Button>

                  <Button
                    onClick={() =>
                      handleBetPlacement(match, "1X2", "2", match.odds1x2.two)
                    }
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold py-2 px-3 rounded-lg transition-all duration-200 transform hover:scale-105"
                  >
                    <div className="flex flex-col items-center w-full">
                      <span className="text-xs text-red-200">AWAY</span>
                      <span className="text-lg font-bold">{match.odds1x2.two.toFixed(2)}</span>
                    </div>
                  </Button>
                </div>

                {/* BTTS Odds */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() =>
                      handleBetPlacement(match, "BTTS", "Yes", match.oddsBTTS.yes)
                    }
                    className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-bold py-2 px-3 rounded-lg transition-all duration-200 transform hover:scale-105"
                  >
                    <div className="flex flex-col items-center w-full">
                      <span className="text-xs text-green-200">BTTS YES</span>
                      <span className="text-lg font-bold">
                        {match.oddsBTTS.yes.toFixed(2)}
                      </span>
                    </div>
                  </Button>

                  <Button
                    onClick={() =>
                      handleBetPlacement(match, "BTTS", "No", match.oddsBTTS.no)
                    }
                    className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-500 hover:to-orange-600 text-white font-bold py-2 px-3 rounded-lg transition-all duration-200 transform hover:scale-105"
                  >
                    <div className="flex flex-col items-center w-full">
                      <span className="text-xs text-orange-200">BTTS NO</span>
                      <span className="text-lg font-bold">
                        {match.oddsBTTS.no.toFixed(2)}
                      </span>
                    </div>
                  </Button>
                </div>
              </div>

              {/* Selected Bet Display */}
              {selectedBet && selectedBet.match === `${match.homeTeam} vs ${match.awayTeam}` && (
                <div className="mt-4 p-3 bg-green-500/20 border border-green-400/50 rounded-lg">
                  <p className="text-green-300 text-sm font-semibold">
                    ✓ {selectedBet.selection} @ {selectedBet.odds.toFixed(2)} added to betslip
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Live Stats Section */}
      <div className="grid md:grid-cols-3 gap-4 mt-8">
        <div className="bg-gradient-to-br from-yellow-900/30 to-yellow-950/30 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            <p className="text-gray-400 text-sm">Quick Odds Updates</p>
          </div>
          <p className="text-xl font-bold text-white">Real-time</p>
          <p className="text-xs text-gray-500 mt-1">Updated every 5 seconds</p>
        </div>

        <div className="bg-gradient-to-br from-red-900/30 to-red-950/30 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-gray-400 text-sm">Live Opportunities</p>
          </div>
          <p className="text-xl font-bold text-white">{liveMatches.length}</p>
          <p className="text-xs text-gray-500 mt-1">Matches currently active</p>
        </div>

        <div className="bg-gradient-to-br from-blue-900/30 to-blue-950/30 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <p className="text-gray-400 text-sm">Live Streaming</p>
          </div>
          <p className="text-xl font-bold text-white">Available</p>
          <p className="text-xs text-gray-500 mt-1">Watch while you bet</p>
        </div>
      </div>
    </div>
  );
}
