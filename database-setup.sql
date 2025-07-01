-- Create the sent_notifications table to track when notifications are sent
-- This replaces the in-memory cache to prevent duplicate notifications

CREATE TABLE IF NOT EXISTS sent_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    notification_id UUID NOT NULL REFERENCES weekly_notifications(id) ON DELETE CASCADE,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sent_notifications_notification_id_sent_at 
ON sent_notifications(notification_id, sent_at);

-- Create index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_sent_notifications_sent_at 
ON sent_notifications(sent_at);

-- Optional: Add a cleanup function to remove old records (older than 24 hours)
-- This prevents the table from growing indefinitely
CREATE OR REPLACE FUNCTION cleanup_old_sent_notifications()
RETURNS void AS $$
BEGIN
    DELETE FROM sent_notifications 
    WHERE sent_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- You can set up a cron job in Supabase to run this cleanup function daily:
-- SELECT cron.schedule('cleanup-sent-notifications', '0 0 * * *', 'SELECT cleanup_old_sent_notifications();');




INSERT INTO "public"."weekly_notifications" ("id", "message", "day_of_week", "time", "is_active", "created_at", "updated_at") VALUES ('608cf9b4-c48d-4413-91ef-92dca3be914e', 'Tomorrow Morning', '2', '08:12:52', 'true', '2025-06-30 14:16:12.62874+00', '2025-06-30 14:16:12.62874+00'), ('8453bd7d-4653-420a-b480-dade8d68eefb', '🔥 Debug notification #3 - 5 min future (02:07:40)', '2', '02:07:40', 'true', '2025-06-30 17:02:40.760697+00', '2025-06-30 17:02:40.760697+00'), ('85a2d442-a658-4464-a994-6838c9a091ec', 'ioioio', '2', '02:50:05', 'true', '2025-06-30 17:48:11.924475+00', '2025-06-30 17:48:11.924475+00'), ('884539dc-fe8b-4001-b4d5-8e209e05b692', 'opopoipok', '2', '03:00:12', 'true', '2025-06-30 17:56:22.985021+00', '2025-06-30 17:56:22.985021+00'), ('8dd924c1-e94f-4875-9c44-bd7890a1209e', 'My Test', '1', '23:10:40', 'true', '2025-06-30 14:04:51.021432+00', '2025-06-30 14:04:51.021432+00'), ('dcceb0a0-eb1f-4938-9d9b-735fa79b81aa', '🔥 Debug notification #1 - Current time (02:02:40)', '2', '02:02:40', 'true', '2025-06-30 17:02:40.760697+00', '2025-06-30 17:02:40.760697+00'), ('e4a92584-d041-4fec-aaa0-db39c7481b5a', '🔥 Debug notification #2 - 3 min ago (01:59:40)', '2', '01:59:40', 'true', '2025-06-30 17:02:40.760697+00', '2025-06-30 17:02:40.760697+00');

UPDATE weekly_notifications SET is_active = false WHERE id != '608cf9b4-c48d-4413-91ef-92dca3be914e';