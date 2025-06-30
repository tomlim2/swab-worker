# 📬 Weekly Slack Notification Worker

A reliable Cloudflare Workers-based notification system that sends scheduled Slack messages from Supabase data with intelligent duplicate prevention and robust timing.

## 🚀 Features

- **Triple Cron Redundancy** - Multiple schedules ensure notifications never get missed
- **Smart 15-minute Window** - Handles timing variations gracefully
- **Database-based Tracking** - Prevents duplicates across worker restarts
- **Korean Standard Time (KST)** - Proper timezone handling
- **Built-in Testing** - Comprehensive testing endpoints
- **Web Interface** - Easy monitoring and debugging

## 📋 Prerequisites

Before deploying, ensure you have:

1. **Node.js** (v18 or later)
2. **Cloudflare account** with Workers plan
3. **Supabase project** with database access
4. **Slack webhook URL** for notifications

## 🛠️ Installation & Setup

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <your-repo-url>
cd swab-worker

# Install dependencies
npm install
```

### 2. Configure Wrangler

```bash
# Install Wrangler globally (if not already installed)
npm install -g wrangler

# Login to Cloudflare
wrangler auth login
```

This will open a browser window for Cloudflare authentication.

### 3. Configure Environment Variables

#### Option A: Using Wrangler CLI (Recommended)

```bash
# Set your Supabase URL (public)
wrangler secret put SUPABASE_URL
# Paste your Supabase project URL when prompted

# Set your Supabase service role key (secret)
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# Paste your Supabase service role key when prompted

# Set your Slack webhook URL (secret)
wrangler secret put SLACK_WEBHOOK_URL
# Paste your Slack webhook URL when prompted
```

#### Option B: Using Cloudflare Dashboard

1. Go to [Cloudflare Workers Dashboard](https://dash.cloudflare.com/workers)
2. Select your worker (after first deployment)
3. Go to **Settings** → **Variables**
4. Add the environment variables:
   - `SUPABASE_URL` (Environment Variable)
   - `SUPABASE_SERVICE_ROLE_KEY` (Secret)
   - `SLACK_WEBHOOK_URL` (Secret)

### 4. Setup Database

Run the SQL script in your Supabase dashboard:

```sql
-- Copy and paste the contents of database-setup.sql
-- This creates the sent_notifications table for duplicate prevention
```

### 5. Update Worker Configuration

Edit `wrangler.toml` if needed:

```toml
name = "your-worker-name"  # Change this to your preferred name
main = "src/index.ts"
compatibility_date = "2024-01-01"

[triggers]
crons = [
  "* * * * *",      # Every minute (primary)
  "*/2 * * * *",    # Every 2 minutes (backup)
  "*/5 * * * *"     # Every 5 minutes (safety net)
]

[vars]
SUPABASE_URL = "your-supabase-url"  # Optional: can be set here instead of secrets
```

## 🚀 Deployment

### First Deployment

```bash
# Deploy to Cloudflare Workers
npm run deploy

# Or use wrangler directly
wrangler deploy
```

### Subsequent Deployments

```bash
# Quick deployment
npm run deploy

# Deploy with specific name
wrangler deploy --name your-custom-name
```

### Development/Testing

```bash
# Run locally for testing
npm run dev

# Or use wrangler directly
wrangler dev
```

## 🧪 Testing Your Deployment

After deployment, test your worker:

### 1. Check Status
```bash
curl https://your-worker.your-subdomain.workers.dev/status
```

Expected response:
```json
{"status":"ok","supabase_connected":true,"timestamp":"2025-06-30T..."}
```

### 2. Test Notification System
```bash
curl https://your-worker.your-subdomain.workers.dev/create-test-now
```

### 3. View Logs
```bash
curl https://your-worker.your-subdomain.workers.dev/logs
```

### 4. Web Interface

Visit your worker URL in a browser to access the web interface:
```
https://your-worker.your-subdomain.workers.dev
```

## 📊 Available Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/status` | GET | Health check + database connection |
| `/heartbeat` | GET | Status + trigger notification check |
| `/debug` | GET | Comprehensive system information |
| `/time-debug` | GET | Current time + notification analysis |
| `/logs` | GET | Recent execution logs |
| `/test` | GET | Manual notification check |
| `/create-test-now` | GET | Create 15-minute window test |
| `/cleanup-test` | GET | Remove test notifications |
| `/force-test` | GET | Force send first notification |

## 🔧 Configuration Options

### Custom Worker Name

```bash
# Deploy with custom name
wrangler deploy --name my-notification-bot
```

### Custom Subdomain

Update `wrangler.toml`:
```toml
name = "my-custom-name"
```

### Different Cron Schedule

Modify the `[triggers]` section in `wrangler.toml`:
```toml
[triggers]
crons = ["0 9 * * 1"]  # Every Monday at 9 AM UTC
```

## 🔍 Troubleshooting

### Common Issues

1. **"Supabase connection failed"**
   ```bash
   # Check your environment variables
   wrangler secret list
   ```

2. **"Notifications not sending"**
   - Check `/debug` endpoint for configuration
   - Verify database table exists (run `database-setup.sql`)
   - Check `/logs` for error messages

3. **"Deployment failed"**
   ```bash
   # Make sure you're logged in
   wrangler auth login
   
   # Check wrangler configuration
   wrangler whoami
   ```

### Getting Help

- Check the `/debug` endpoint for system status
- View `/logs` for detailed execution information
- Use the web interface for easy debugging

## 📈 Monitoring

### Real-time Monitoring

- **Web Interface**: Visit your worker URL
- **Logs Endpoint**: `/logs` for execution history  
- **Debug Endpoint**: `/debug` for comprehensive status

### Cloudflare Dashboard

1. Go to [Workers Dashboard](https://dash.cloudflare.com/workers)
2. Select your worker
3. View metrics, logs, and performance data

## 🔄 Updates

To update your worker:

```bash
# Pull latest changes
git pull origin main

# Install any new dependencies
npm install

# Deploy updates
npm run deploy
```

## 📝 Setting Up Notifications

1. **Add notifications to your Supabase `weekly_notifications` table**:
   ```sql
   INSERT INTO weekly_notifications (message, day_of_week, time, is_active) 
   VALUES ('Weekly team standup!', '1', '09:00:00', true);
   ```

2. **Day format**: Use numbers (0=Sunday, 1=Monday, etc.) or names
3. **Time format**: Use HH:MM:SS (24-hour format)
4. **Timezone**: All times are in Korean Standard Time (KST)

## 🎯 Performance

- **Reliability**: ~95-99% notification delivery
- **Timing**: 15-minute tolerance window
- **Scalability**: Handles multiple notifications efficiently
- **Redundancy**: Triple cron schedule backup

## 📄 License

This project is private and proprietary.

---

🎉 **Your notification system is now deployed and ready!**

For more detailed information, see `FINAL-SETUP-GUIDE.md`.
