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
