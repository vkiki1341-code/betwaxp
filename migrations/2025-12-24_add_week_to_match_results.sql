-- Migration: Add week column and constraint to match_results
ALTER TABLE match_results
ADD COLUMN IF NOT EXISTS week INT CHECK (week >= 1 AND week <= 10000);