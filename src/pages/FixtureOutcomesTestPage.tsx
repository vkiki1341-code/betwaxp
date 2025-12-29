import React, { useState } from 'react';

const SUPABASE_URL = 'https://tpcdflrjjhkzzrdiubzb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwY2RmbHJqamhrenpyZGl1YnpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MDA2OTQsImV4cCI6MjA4MDA3NjY5NH0.C1vwN-hY-lhg1xOiR4KsY9zIRRiSu_A8amAMxyeL48Y';
const FIXTURE_OUTCOMES_ENDPOINT = `${SUPABASE_URL}/rest/v1/fixture_outcomes`;

function getHeaders() {
  return {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

export default function FixtureOutcomesTestPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchOutcomes = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(FIXTURE_OUTCOMES_ENDPOINT, {
        method: 'GET',
        headers: getHeaders(),
      });
      if (!res.ok) {
        setError('Failed to fetch: ' + (await res.text()));
        setLoading(false);
        return;
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError('Exception: ' + err);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>Fixture Outcomes Table (Test Fetch)</h2>
      <button onClick={fetchOutcomes} disabled={loading} style={{ marginBottom: 16 }}>
        {loading ? 'Loading...' : 'Fetch All Outcomes'}
      </button>
      {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
      <pre style={{ background: '#f4f4f4', padding: 12, borderRadius: 4, maxHeight: 400, overflow: 'auto' }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
