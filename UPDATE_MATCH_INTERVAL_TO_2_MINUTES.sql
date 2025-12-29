/**
 * Update Match Interval to 2 Minutes
 * 
 * This script updates the global schedule configuration to use 2-minute intervals
 * instead of 30-minute intervals, aligning with the timeframe system.
 * 
 * Run this in Supabase SQL Editor to update existing configuration.
 */

-- Update the default value for new records (if table doesn't exist yet)
ALTER TABLE IF EXISTS public.global_schedule_config 
  ALTER COLUMN match_interval SET DEFAULT 2;

-- Update existing configuration row to use 2 minutes
UPDATE public.global_schedule_config
SET 
  match_interval = 2,
  updated_at = NOW()
WHERE id = 1;

-- If no row exists, insert a new one with 2-minute interval
INSERT INTO public.global_schedule_config (
  id,
  reference_epoch,
  match_interval,
  timezone
)
VALUES (
  1,
  EXTRACT(EPOCH FROM NOW()) * 1000, -- Current time as epoch in milliseconds
  2, -- 2 minutes between matches
  'UTC'
)
ON CONFLICT (id) DO UPDATE
SET 
  match_interval = 2;

-- Verify the update
SELECT 
  id,
  reference_epoch,
  match_interval as match_interval_minutes,
  timezone,
  to_timestamp(reference_epoch / 1000) as reference_time
FROM public.global_schedule_config
WHERE id = 1;

/**
 * Expected Output:
 * 
 * id | reference_epoch | match_interval_minutes | timezone | reference_time
 * ---|-----------------|------------------------|----------|----------------
 * 1  | [timestamp]     | 2                      | UTC      | [date/time]
 * 
 * ✅ Match interval should show as 2 minutes
 */
