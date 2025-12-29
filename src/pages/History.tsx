
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const History = () => {
  const [user, setUser] = useState<any>(null);
  const [bets, setBets] = useState<any[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
    // Fetch bets and promos from localStorage (optional, can be removed if not needed)
    setBets(JSON.parse(localStorage.getItem("betting_bets") || "[]"));
    setPromos(JSON.parse(localStorage.getItem("betting_promos") || "[]"));
    // Fetch last 10 global matches from Supabase
    const fetchMatches = async () => {
      setLoadingMatches(true);
      const { data, error } = await supabase
        .from('match_results')
        .select('home_team, away_team, home_score, away_score, status, updated_at')
        .order('updated_at', { ascending: false })
        .limit(10);
      if (!error && data) {
        setMatches(data);
      } else {
        setMatches([]);
      }
      setLoadingMatches(false);
    };
    fetchMatches();
    // Optionally, listen for refresh events if needed
    return () => {};
  }, []);

  return (
    <div className="max-w-2xl mx-auto mt-12 p-6 bg-card rounded shadow">
      <h2 className="text-xl font-bold mb-4">Account History</h2>
      <div className="mb-6">
        <h3 className="font-bold mb-2">Bets</h3>
        {bets.length === 0 ? <div className="text-muted-foreground">No bets placed.</div> : (
          <ul className="space-y-2">
            {bets.map((bet, idx) => (
              <li key={idx} className="p-2 border rounded">
                <div>Match: {bet.matchId}</div>
                <div>Type: {bet.type}</div>
                <div>Stake: {bet.stake}</div>
                <div>Status: {bet.status}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mb-6">
        <h3 className="font-bold mb-2">Promos</h3>
        {promos.length === 0 ? <div className="text-muted-foreground">No promos used.</div> : (
          <ul className="space-y-2">
            {promos.map((promo, idx) => (
              <li key={idx} className="p-2 border rounded">
                <div>Promo: {promo.title}</div>
                <div>Description: {promo.description}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="font-bold mb-2">Global Match History (Last 10 Games)</h3>
        {loadingMatches ? (
          <div className="text-muted-foreground">Loading match history...</div>
        ) : matches.length === 0 ? (
          <div className="text-muted-foreground">No match history found.</div>
        ) : (
          <ul className="space-y-2">
            {matches.map((match, idx) => (
              <li key={idx} className="p-2 border rounded">
                <div>{match.home_team} vs {match.away_team}</div>
                <div>Score: {match.home_score} - {match.away_score}</div>
                <div>Status: {match.status}</div>
                <div className="text-xs text-muted-foreground">Updated: {new Date(match.updated_at).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default History;
