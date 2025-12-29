-- Add force_update_nonce column to always trigger Supabase realtime events
ALTER TABLE betting_system_state ADD COLUMN IF NOT EXISTS force_update_nonce DOUBLE PRECISION DEFAULT 0;
