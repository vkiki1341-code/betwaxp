# 🧪 Quick Test Script - 30 Seconds

## Test Perfect Synchronization

### Step 1: Open Console (F12)
```javascript
// Check current configuration
const schedule = JSON.parse(localStorage.getItem('global_match_schedule'));
console.log('Match Interval:', schedule.matchInterval, 'minutes');
console.log('Reference Time:', new Date(schedule.referenceEpoch).toLocaleString());

// Calculate current match index
const now = new Date();
const currentIdx = Math.floor((now.getTime() - schedule.referenceEpoch) / (schedule.matchInterval * 60000));
console.log('Current Match Index:', currentIdx);
```

**Expected Output:**
```
Match Interval: 2 minutes
Reference Time: [date/time]
Current Match Index: 104
```

---

### Step 2: Check Visible Slots
Look at the time slot buttons on the page.

**Should See:**
- 🔵 2 blue buttons (past matches) with "Past" label
- 🔴 1 red button (current match) with "🔴 LIVE" label
- 🟣 3 purple buttons (upcoming matches) with "Next" label
- **Total: 6 buttons**

---

### Step 3: Test Past Match
1. Click a **blue** button (past match)
2. **Should Show**: Final score (e.g., "FT 3 - 1")
3. **Should NOT Show**: Betting buttons

---

### Step 4: Test Upcoming Match
1. Click a **purple** button (upcoming match)
2. **Should Show**: Betting buttons (Home Win, Draw, Away Win)
3. **Can**: Add to bet slip

---

### Step 5: Test Synchronization
1. Open in **2 browser tabs** (or Incognito)
2. **Both should show**: Same current match index
3. **Both should show**: Same 6 time slots

**Quick Check (Console):**
```javascript
// Run in both tabs - should match
const schedule = JSON.parse(localStorage.getItem('global_match_schedule'));
const now = new Date();
const idx = Math.floor((now.getTime() - schedule.referenceEpoch) / (schedule.matchInterval * 60000));
console.log('My Match Index:', idx);
```

---

## Quick Troubleshooting

### ❌ Not seeing 6 slots?
```javascript
// Clear cache and reload
localStorage.clear();
location.reload();
```

### ❌ Two tabs showing different matches?
```javascript
// Force resync
localStorage.removeItem('global_match_schedule');
location.reload();
```

### ❌ Can bet on past matches?
- Check that match has "Past" label (blue)
- Should show "📅 BetXPesa wins" heading
- Should show final score, not betting buttons

---

## Success Indicators

✅ 6 slots visible (2 past + 1 current + 3 upcoming)  
✅ Past matches have blue color + "Past" label  
✅ Current match has "🔴 LIVE" label  
✅ Upcoming matches have purple color + "Next" label  
✅ Can't bet on past matches  
✅ Can bet on current + upcoming matches  
✅ Both tabs show same match index  

**If all ✅, system is working perfectly!** 🎉

---

## Need Help?

See [PERFECT_SYNC_COMPLETE.md](./PERFECT_SYNC_COMPLETE.md) for full details.
