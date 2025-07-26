/// <reference types="@cloudflare/workers-types" />

import type { Env, WeeklyNotification } from './types';
import { createSupabaseClient, timeToMinutes, getKSTTime, formatTime } from './utils';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/health') {
      return new Response('OK', { status: 200 });
    }
    
    if (url.pathname === '/test') {
      await runNotificationCheck(env);
      return new Response('Test completed', { status: 200 });
    }
    
    if (url.pathname === '/reset-weekly') {
      await resetWeeklyNotifications(env);
      return new Response('Weekly notifications reset', { status: 200 });
    }
    
    return new Response('Weekly Notification Worker', { status: 200 });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('🕐 Scheduled event triggered');
    await runNotificationCheck(env);
  }
};

async function runNotificationCheck(env: Env): Promise<void> {
  console.log('🔍 Starting notification check');
  
  const supabase = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  
  // Get current time in KST (UTC+9)
  const kstTime = getKSTTime();
  const currentDayOfWeek = kstTime.getDay();
  const currentTime = formatTime(kstTime);
  
  console.log(`Current KST time: ${kstTime.toISOString()}`);
  console.log(`Day of week: ${currentDayOfWeek}, Time: ${currentTime}`);
  
  try {
    // Fetch active notifications for today that haven't been sent this week
    const { data: notifications, error } = await supabase
      .from('weekly_notifications')
      .select('*')
      .eq('is_active', true)
      .eq('day_of_week', currentDayOfWeek)
      .eq('sent_this_week', false)
      .then();
    
    if (error) {
      console.error('Error fetching notifications:', error);
      return;
    }
    
    console.log(`Found ${notifications?.length || 0} notifications for today`);
    
    if (!notifications || notifications.length === 0) {
      return;
    }
    
    // Check time window (within 5 minutes of scheduled time)
    const matchingNotifications = notifications.filter((notification: WeeklyNotification) => {
      const timeDiff = Math.abs(timeToMinutes(currentTime) - timeToMinutes(notification.time));
      return timeDiff <= 5; // 5 minute window
    });
    
    console.log(`Found ${matchingNotifications.length} notifications within time window`);
    
    // Send notifications
    for (const notification of matchingNotifications) {
      await sendSlackNotification(env, notification);
      await markNotificationSent(supabase, notification.id);
    }
    
  } catch (error) {
    console.error('Error in notification check:', error);
  }
}

async function sendSlackNotification(env: Env, notification: WeeklyNotification): Promise<void> {
  const webhookUrl = env.SLACK_WEBHOOK_URL_DEV;
  
  if (!webhookUrl) {
    console.error('SLACK_WEBHOOK_URL_DEV not configured');
    return;
  }
  
  try {
    const message = `${notification.emoji_this_week} ${notification.message}`;
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: message,
        username: 'Weekly Notification Bot',
        icon_emoji: ':bell:',
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }
    
    console.log(`✅ Slack notification sent: ${notification.message}`);
  } catch (error) {
    console.error(`❌ Failed to send Slack notification:`, error);
  }
}

async function markNotificationSent(supabase: any, notificationId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('weekly_notifications')
      .update({ sent_this_week: true })
      .eq('id', notificationId)
      .then();
    
    if (error) {
      console.error('Error marking notification as sent:', error);
    } else {
      console.log(`✅ Marked notification ${notificationId} as sent this week`);
    }
  } catch (error) {
    console.error('Error marking notification as sent:', error);
  }
}

async function resetWeeklyNotifications(env: Env): Promise<void> {
  console.log('🔄 Resetting weekly notifications');
  
  const supabase = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    const { error } = await supabase
      .from('weekly_notifications')
      .update({ sent_this_week: false })
      .eq('sent_this_week', true)
      .then();
    
    if (error) {
      console.error('Error resetting weekly notifications:', error);
    } else {
      console.log('✅ Weekly notifications reset successfully');
    }
  } catch (error) {
    console.error('Error resetting weekly notifications:', error);
  }
} 