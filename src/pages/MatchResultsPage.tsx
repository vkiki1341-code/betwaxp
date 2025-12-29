import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getFixtureSet } from "@/data/fixtureSets";
import { leagues } from "@/data/leagues";

const FETCH_DELAY_MS = 2 * 60 * 1000; // 2 minutes

const MatchResultsPage: React.FC = () => {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawData, setRawData] = useState<any[]>([]);

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      setError(null);
      try {
        // Get all matches with their week info
        const fixtureSetIdx = 0; // Or get from global state if needed
        const matches: { match_id: string; week: number }[] = [];
        leagues.forEach((league) => {
          const fixtureSet = getFixtureSet(league, fixtureSetIdx);
          fixtureSet.forEach((week, weekIdx) => {
            week.matches.forEach((match: any) => {
              const matchId = match.matchId || match.id;
              if (matchId) {
                matches.push({ match_id: String(matchId), week: weekIdx + 1 });
              }
            });
          });
        });
        // Fetch all match results from Supabase
        const { data, error } = await supabase
          .from("match_results")
          .select("match_id, home_goals, away_goals, is_final, updated_at, week")
          .in(
            "match_id",
            matches.map((m) => m.match_id)
          );
        if (error) throw error;
        setRawData(data || []); // <-- Save raw data for debug
        // Only show results if 2 minutes have passed since updated_at
        const now = Date.now();
        const filtered = (data || []).filter((r: any) => {
          if (!r.updated_at) return false;
          const updated = new Date(r.updated_at).getTime();
          return now - updated > FETCH_DELAY_MS;
        });
        setResults(filtered);
      } catch (err: any) {
        setError(err.message || "Failed to fetch results");
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
    // Optionally, poll every minute
    const interval = setInterval(fetchResults, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Match Results (after 2 minutes)</h1>
      {loading && <div>Loading...</div>}
      {error && <div className="text-red-500">{error}</div>}
      {/* Debug: Show raw data fetched from Supabase */}
      <details className="my-2">
        <summary className="cursor-pointer text-xs text-gray-500">Show raw fetched data (debug)</summary>
        <pre className="text-xs bg-gray-100 p-2 rounded max-h-40 overflow-auto">{JSON.stringify(rawData, null, 2)}</pre>
      </details>
      <table className="w-full border mt-4">
        <thead>
          <tr>
            <th className="border px-2 py-1">Match ID</th>
            <th className="border px-2 py-1">Week</th>
            <th className="border px-2 py-1">Home Goals</th>
            <th className="border px-2 py-1">Away Goals</th>
            <th className="border px-2 py-1">Final?</th>
            <th className="border px-2 py-1">Updated At</th>
          </tr>
        </thead>
        <tbody>
          {results.length === 0 && !loading ? (
            <tr>
              <td colSpan={6} className="text-center py-4">No results available yet.</td>
            </tr>
          ) : (
            results.map((r) => (
              <tr key={r.match_id}>
                <td className="border px-2 py-1">{r.match_id}</td>
                <td className="border px-2 py-1">{r.week}</td>
                <td className="border px-2 py-1">{r.home_goals}</td>
                <td className="border px-2 py-1">{r.away_goals}</td>
                <td className="border px-2 py-1">{r.is_final === 'yes' ? "Yes" : "No"}</td>
                <td className="border px-2 py-1">{r.updated_at ? new Date(r.updated_at).toLocaleString() : "-"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default MatchResultsPage;
