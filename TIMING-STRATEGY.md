# Notification Timing Strategy

## Why 15-minute window with multiple crons?

The improved worker uses a **15-minute time window** with **3 overlapping cron jobs** for maximum reliability using only Wrangler:

### 1. **Multiple Cron Jobs for Redundancy**
- `* * * * *` - Every minute (primary)
- `*/2 * * * *` - Every 2 minutes (backup)  
- `*/5 * * * *` - Every 5 minutes (safety net)

### 2. **Smart Duplicate Prevention**
- **Close to time (0-2 min diff)**: 5-minute cooldown
- **Further from time (3-15 min diff)**: 15-minute cooldown
- Prevents multiple cron jobs from sending duplicates

### 3. **15-Minute Window Benefits**
- Handles cron timing variations (±2-3 minutes)
- Accommodates worker cold starts and delays
- Still precise enough for most notification needs
- Compatible with multiple overlapping cron schedules

## Example Scenarios

**Scheduled Time: 09:00**
- ✅ **08:50** - 10 min early, will send (worker started early)
- ✅ **09:05** - 5 min late, will send (normal cron delay)
- ✅ **09:12** - 12 min late, will send (cold start delay)
- ❌ **09:20** - 20 min late, won't send (too far off)

**Multiple Cron Behavior:**
- 09:00 - Primary cron tries to run
- 09:02 - Backup cron runs (if primary failed)
- 09:05 - Safety net cron runs (if both failed)
- Smart cooldown prevents duplicates between all three

## Reliability Improvements

1. **Triple redundancy** - 3 cron schedules
2. **Wider time window** - accommodates delays
3. **Smart cooldown** - prevents duplicates
4. **Database tracking** - survives worker restarts
5. **Detailed logging** - easy troubleshooting

This provides excellent reliability using only Wrangler/Cloudflare Workers!
