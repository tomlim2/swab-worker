# External Monitoring Solutions for Reliable Notifications

Since Cloudflare Workers cron jobs can be unreliable, here are several backup monitoring solutions:

## 1. GitHub Actions (Free & Reliable)

Create `.github/workflows/heartbeat.yml`:

```yaml
name: Notification Heartbeat

on:
  schedule:
    # Run every 2 minutes as backup
    - cron: '*/2 * * * *'
    # Run every 5 minutes as secondary backup  
    - cron: '*/5 * * * *'

jobs:
  heartbeat:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Worker Heartbeat
        run: |
          curl -X GET "https://your-worker.your-subdomain.workers.dev/heartbeat" \
            -H "User-Agent: GitHub-Actions-Heartbeat" \
            --max-time 30 \
            --retry 3 \
            --retry-delay 2
```

## 2. UptimeRobot (Free monitoring)

1. Sign up at [UptimeRobot](https://uptimerobot.com)
2. Create HTTP monitor for: `https://your-worker.your-subdomain.workers.dev/heartbeat`
3. Set interval to 2 minutes
4. This will call your heartbeat endpoint regularly

## 3. Cronitor (Specialized cron monitoring)

1. Sign up at [Cronitor](https://cronitor.com)
2. Create monitor for your notification system
3. Use their API to ping when notifications should run

## 4. Simple Ping Service

Set up any ping service (many free options) to hit:
```
https://your-worker.your-subdomain.workers.dev/heartbeat
```

## 5. Google Cloud Scheduler (If you use GCP)

```bash
gcloud scheduler jobs create http notification-heartbeat \
  --schedule="*/2 * * * *" \
  --uri="https://your-worker.your-subdomain.workers.dev/heartbeat" \
  --http-method=GET
```

## 6. AWS EventBridge (If you use AWS)

Create a scheduled rule that triggers a Lambda which calls your heartbeat endpoint.

## How the Heartbeat Works

The `/heartbeat` endpoint:
- ✅ Responds with status and timing info
- ✅ Triggers a notification check automatically
- ✅ Provides monitoring data
- ✅ Works as backup to cron jobs

## Recommended Setup

1. **Primary**: Cloudflare Workers cron (every minute)
2. **Backup 1**: GitHub Actions (every 2 minutes)  
3. **Backup 2**: UptimeRobot (every 5 minutes)

This triple redundancy ensures your notifications are never missed!

## Testing Your Setup

```bash
# Test the heartbeat endpoint
curl https://your-worker.your-subdomain.workers.dev/heartbeat

# Should return JSON with status and trigger a notification check
```

## Monitoring Dashboard

Use the `/logs` endpoint to verify all sources are working:
- Look for "🕐 Scheduled event triggered" (cron jobs)
- Look for "💓 Heartbeat check" (external monitoring)
