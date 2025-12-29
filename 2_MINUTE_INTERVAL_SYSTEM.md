# ⏱️ 2-Minute Match Interval System - Configuration Summary

## Overview

The BetXPesa platform uses a **2-MINUTE match interval** system, meaning:
- ✅ New match every **2 minutes**
- ✅ Matches cycle through all teams continuously
- ✅ All users see the same match at the same time globally

---

## Timeline Example (2-Minute Intervals)

```
Reference Time: December 12, 2024 2:00:00 PM

2:00 PM → Match Index 0  → Arsenal vs Liverpool
2:02 PM → Match Index 1  → Man City vs Chelsea  
2:04 PM → Match Index 2  → Man United vs Tottenham
2:06 PM → Match Index 3  → Brighton vs Everton
2:08 PM → Match Index 4  → Newcastle vs Aston Villa
2:10 PM → Match Index 5  → West Ham vs Crystal Palace
... (continues forever, cycling through all team combinations)
```

---

## How It Works

### Match Duration vs Match Interval

The system has two separate timing concepts:

1. **Match Simulation Duration**: 90 seconds
   - How long each match "plays" (simulates 90 minutes of football)
   - 30-second betting window before simulation
   - Total: ~120 seconds per match cycle

2. **Match Interval**: 2 minutes (120 seconds)
   - How often a NEW match starts
   - Controlled by `match_interval` in database
   - All users advance together

### Timeline of One Match:

```
0:00 - Pre-countdown (5 seconds)
0:05 - Betting window opens (30 seconds)
0:35 - Match simulation starts (90 seconds)
2:05 - Match ends, bets resolved
2:00 - NEXT match starts (for users who join/stay)
```

---

## Configuration Files

### 1. Database Schema
**File**: `MATCH_SCHEDULING_SCHEMA.sql`
```sql
match_interval_minutes INTEGER NOT NULL DEFAULT 2
```

### 2. Service Configuration
**File**: `src/lib/matchScheduleService.ts`
```typescript
const DEFAULT_INTERVAL = 2; // 2 minutes between matches
```

### 3. Global Match System
**File**: `src/utils/globalTimeMatchSystem.ts`
- Uses the 2-minute interval from matchScheduleService
- Calculates which match to show based on current time

---

## Synchronization Guarantee

### User A logs in at 2:00 PM:
- Sees Match Index: 100 (Arsenal vs Liverpool)
- Match ends at 2:02 PM

### User B logs in at 2:02 PM:
- Sees Match Index: 101 (Man City vs Chelsea)
- NOT Match Index 100 (that already ended)

### User A stays logged in until 2:02 PM:
- Also advances to Match Index: 101
- **Both users perfectly synchronized** ✅

---

## Database Update

If your database currently has 30-minute intervals, run this SQL:

**File**: `UPDATE_MATCH_INTERVAL_TO_2_MINUTES.sql`

```sql
UPDATE public.global_schedule_config
SET match_interval = 2
WHERE id = 1;
```

---

## Testing

### Quick Test (2 minutes):

1. Open app at 2:00 PM
2. Note match index (e.g., 100)
3. Wait until 2:02 PM
4. Refresh page
5. Match index should be 101 ✅

### Synchronization Test:

```javascript
// Browser Console - Check current match
const schedule = JSON.parse(localStorage.getItem('global_match_schedule'));
const now = new Date();
const idx = Math.floor((now.getTime() - schedule.referenceEpoch) / (schedule.matchInterval * 60000));
console.log('Current Match Index:', idx);
console.log('Match Interval:', schedule.matchInterval, 'minutes');
```

Expected output:
```
Current Match Index: 104
Match Interval: 2 minutes
```

---

## Why 2 Minutes?

**Fast-paced betting experience:**
- Users don't wait long for next match
- More betting opportunities per hour
- Higher engagement
- 30 matches per hour (vs 2 matches with 30-min intervals)

**Technical benefits:**
- Easier to test (2 minutes vs 30 minutes)
- More forgiving for users joining at different times
- Faster match cycling through all teams

---

## Success Indicators

✅ **Console shows**: `Match Interval: 2 minutes`  
✅ **Matches change every 2 minutes**  
✅ **All users see same match at same time**  
✅ **No stuck/frozen matches**  

---

## Related Documentation

- [GLOBAL_SYNC_FULLY_IMPLEMENTED.md](./GLOBAL_SYNC_FULLY_IMPLEMENTED.md) - Full sync architecture
- [SYNC_TEST_GUIDE.md](./SYNC_TEST_GUIDE.md) - Testing procedures
- [MATCH_SCHEDULING_SCHEMA.sql](./MATCH_SCHEDULING_SCHEMA.sql) - Database schema

---

## Summary

The system is configured for **2-minute intervals** to provide:
- ✅ Fast match rotation
- ✅ Global synchronization
- ✅ Perfect timing alignment
- ✅ High user engagement

**All users see the same match at the same time, with matches changing every 2 minutes!** 🚀
