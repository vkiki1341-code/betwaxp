// api-global-state.js
// Minimal Node/Express API to serve the current global fixture state from Supabase
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const app = express();
const port = 3030;

// Configure with your Supabase credentials
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// The table and row id for global system state
const SYSTEM_STATE_ID = '9597122f-1306-4732-aeb8-ff699011c727';

app.get('/api/global-state', async (req, res) => {
  const { data, error } = await supabase
    .from('betting_system_state')
    .select('*')
    .eq('id', SYSTEM_STATE_ID)
    .single();
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  // Fetch global schedule (referenceEpoch, matchInterval) from the same row or another config table if needed
  // For now, assume these fields are present in betting_system_state
  res.json({
    fixtureSetIdx: data.fixture_set_idx ?? 0,
    fixtureSalt: data.fixture_salt || String(data.fixture_set_idx ?? 0),
    currentTimeframeIdx: data.current_timeframe_idx ?? 0,
    selectedCountry: data.selected_country || 'en',
    referenceEpoch: data.reference_epoch ?? Date.UTC(2023, 0, 1, 0, 0, 0),
    matchInterval: data.match_interval ?? 30 // in minutes
  });
});

app.listen(port, () => {
  console.log(`Global state API listening at http://localhost:${port}`);
});
