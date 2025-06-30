/**
 * Application configuration constants
 */

export const MAX_LOGS = 50;

const alreadySent = await supabase
  .from('sent_notifications')
  .eq('notification_id', notification.id)
  .gte('sent_at', todayStart)
  .execute();

if (!alreadySent.data || alreadySent.data.length === 0) {
  await sendSlackNotification(env, notification.message, notification.id);
  // ...log or record sent notification...
}
