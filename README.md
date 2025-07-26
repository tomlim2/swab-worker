# Weekly Notification Worker

A Cloudflare Worker that sends weekly Slack notifications using Supabase as the database.

## Features

- 🕐 **Scheduled Notifications**: Runs every 5 minutes to check for notifications
- 📅 **Weekly Tracking**: Uses `sent_this_week` field to prevent duplicate sends
- 🌏 **KST Timezone**: Handles Korean Standard Time (UTC+9)
- 🔔 **Slack Integration**: Sends notifications via webhook with environment-based URLs
- ⏰ **Time Window**: Only sends within 5 minutes of scheduled time

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Install Wrangler CLI

```bash
npm install -g wrangler
```

### 3. Login to Cloudflare

```bash
wrangler login
```

### 4. Set Environment Variables

In the Cloudflare Dashboard:

1. Go to **Workers & Pages**
2. Select your worker
3. Go to **Settings** → **Variables**
4. Add these environment variables:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `SLACK_WEBHOOK_URL_DEV` | Your Slack webhook URL for development |
| `SLACK_WEBHOOK_URL` | Your Slack webhook URL for production |
| `ENVIRONMENT` | Set to "development" or "production" |

### 5. Deploy

```bash
# Deploy to Cloudflare
wrangler deploy
```

## Environment Configuration

The worker automatically chooses the correct Slack webhook URL based on the `ENVIRONMENT` variable:

- **Development**: Uses `SLACK_WEBHOOK_URL_DEV`
- **Production**: Uses `SLACK_WEBHOOK_URL`

This allows you to send notifications to different Slack channels for testing and production.

## Database Schema

The worker uses this Supabase table:

```sql
create table public.weekly_notifications (
  id uuid not null default gen_random_uuid(),
  message text not null,
  day_of_week integer not null,
  time time without time zone not null,
  is_active boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  sent_this_week boolean null default false,
  branch_version text null,
  emoji_this_week text null default ':arnyang_ugly:'::text,
  constraint weekly_notifications_pkey primary key (id),
  constraint weekly_notifications_day_of_week_check check (
    (day_of_week >= 0) and (day_of_week <= 6)
  )
);
```

## Usage

### Endpoints

- `/health` - Health check
- `/test` - Manually trigger notification check
- `/reset-weekly` - Reset all `sent_this_week` flags

### Adding Notifications

Insert notifications into the `weekly_notifications` table:

```sql
INSERT INTO weekly_notifications (message, day_of_week, time, is_active, emoji_this_week)
VALUES ('Weekly team meeting reminder', 1, '09:00:00', true, ':meeting:');
```

### Day of Week Values

- `0` = Sunday
- `1` = Monday
- `2` = Tuesday
- `3` = Wednesday
- `4` = Thursday
- `5` = Friday
- `6` = Saturday

### Weekly Reset

The `sent_this_week` field needs to be reset weekly. You can:

1. **Manual Reset**: Visit `/reset-weekly` endpoint
2. **Database Trigger**: Create a cron job or trigger to reset weekly
3. **SQL Command**: Run this weekly:
   ```sql
   UPDATE weekly_notifications 
   SET sent_this_week = false 
   WHERE sent_this_week = true;
   ```

## How It Works

1. **Cron Trigger**: Runs every 5 minutes
2. **Time Check**: Gets current KST time and day of week
3. **Database Query**: Finds active notifications for today that haven't been sent this week
4. **Time Window**: Only processes notifications within 5 minutes of scheduled time
5. **Environment Check**: Chooses appropriate Slack webhook URL based on environment
6. **Slack Send**: Sends notification via webhook with emoji
7. **Mark Sent**: Updates `sent_this_week` to `true`

## Development

```bash
# Run locally
npm run dev

# Deploy to development
npm run deploy:dev

# Deploy to production
npm run deploy:prod
```

## Troubleshooting

### Check Logs

View worker logs in Cloudflare Dashboard:
1. Go to **Workers & Pages**
2. Select your worker
3. Go to **Logs** tab

### Test Endpoints

- Visit `/health` to check if worker is running
- Visit `/test` to manually trigger notification check
- Visit `/reset-weekly` to reset weekly flags

### Common Issues

1. **No notifications sent**: Check if `sent_this_week` is `false`
2. **Wrong timezone**: Worker uses KST (UTC+9)
3. **Webhook errors**: Verify webhook URLs are correct for your environment
4. **Database errors**: Check Supabase credentials and table permissions
5. **Environment issues**: Ensure `ENVIRONMENT` variable is set correctly 