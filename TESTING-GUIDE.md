# 10-Minute Window Testing Guide

## Overview

The improved `/create-test-now` endpoint creates **4 strategic test notifications** to validate the 10-minute window behavior:

## Test Notifications Created

### ✅ Should Send (Within 10-minute window)

1. **🔔 Current Time Notification**
   - Scheduled for: Current time
   - Time difference: 0 minutes
   - Expected: ✅ SHOULD SEND immediately

2. **🕐 5 Minutes Ago Notification**
   - Scheduled for: 5 minutes before current time
   - Time difference: 5 minutes
   - Expected: ✅ SHOULD SEND (within 10-minute window)

3. **🕕 2 Minutes Future Notification**
   - Scheduled for: 2 minutes after current time
   - Time difference: 2 minutes
   - Expected: ✅ SHOULD SEND (within 10-minute window)

### ❌ Should NOT Send (Outside 10-minute window)

4. **⏰ 15 Minutes Future Notification**
   - Scheduled for: 15 minutes after current time
   - Time difference: 15 minutes
   - Expected: ❌ Should NOT send (outside 10-minute window)

## Testing Workflow

### Step 1: Clean Start
```bash
# Visit /cleanup-test to remove old test notifications
curl https://your-worker.your-subdomain.workers.dev/cleanup-test
```

### Step 2: Create Test Notifications
```bash
# Visit /create-test-now to create 4 strategic test notifications
curl https://your-worker.your-subdomain.workers.dev/create-test-now
```

### Step 3: Trigger Test
```bash
# Visit /test to manually trigger notification check
curl https://your-worker.your-subdomain.workers.dev/test
```

### Step 4: Check Results
```bash
# Visit /logs to see which notifications were sent
curl https://your-worker.your-subdomain.workers.dev/logs
```

## Expected Results

When you run the test, you should see in the logs:

✅ **3 notifications sent:**
- Current time notification
- 5 minutes ago notification  
- 2 minutes future notification

❌ **1 notification NOT sent:**
- 15 minutes future notification (outside window)

## Validation Points

### ✅ Success Indicators
- Exactly 3 Slack notifications received
- Logs show "📤 Sending notification" for 3 notifications
- Logs show "⏰ Time diff" calculations for all 4
- 15-minute notification shows as skipped due to time difference

### ❌ Issues to Watch For
- More than 3 notifications sent (window too wide)
- Less than 3 notifications sent (window too narrow or other issues)
- Duplicate notifications (tracking system not working)
- Database connection errors

## Debugging Commands

```bash
# Check current time and day matching
curl https://your-worker.your-subdomain.workers.dev/time-debug

# Full system status
curl https://your-worker.your-subdomain.workers.dev/debug

# Worker health check
curl https://your-worker.your-subdomain.workers.dev/status
```

## Tips

1. **Run tests multiple times** - The 10-minute cooldown prevents duplicates
2. **Use /cleanup-test** between test runs for clean results
3. **Check your Slack channel** to confirm actual delivery
4. **Monitor /logs** for detailed timing information
5. **Test at different times** to ensure consistency

This testing approach validates that your 10-minute window is working correctly and notifications are being delivered reliably!
