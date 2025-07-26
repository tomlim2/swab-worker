/// <reference types="@cloudflare/workers-types" />

import type { Env, WeeklyNotification } from './types';
import { createSupabaseClient, timeToMinutes, getKSTTime, formatTime } from './utils';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/health') {
      return new Response('OK', { status: 200 });
    }
    
    if (url.pathname === '/env-test') {
      return new Response(JSON.stringify({
        has_supabase_url: !!env.SUPABASE_URL,
        has_supabase_key: !!env.SUPABASE_SERVICE_ROLE_KEY,
        has_slack_dev: !!env.SLACK_WEBHOOK_URL_DEV,
        has_slack_prod: !!env.SLACK_WEBHOOK_URL,
        environment: env.ENVIRONMENT,
        supabase_url_length: env.SUPABASE_URL?.length || 0
      }, null, 2), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (url.pathname === '/debug') {
      const debug = await getDebugInfo(env);
      return new Response(JSON.stringify(debug, null, 2), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (url.pathname === '/test') {
      await runNotificationCheck(env);
      return new Response('Test completed', { status: 200 });
    }
    
    if (url.pathname === '/reset-weekly') {
      await resetWeeklyNotifications(env);
      return new Response('Weekly notifications reset', { status: 200 });
    }
    
    if (url.pathname === '/status') {
      const status = await getNotificationStatus(env);
      return new Response(JSON.stringify(status, null, 2), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
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
  // Choose webhook URL based on environment
  const webhookUrl = env.ENVIRONMENT === 'development' 
    ? env.SLACK_WEBHOOK_URL_DEV 
    : env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.error(`No Slack webhook URL configured for environment: ${env.ENVIRONMENT}`);
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
    
    console.log(`✅ Slack notification sent to ${env.ENVIRONMENT} environment: ${notification.message}`);
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

async function getDebugInfo(env: Env): Promise<any> {
  console.log('🔍 Getting debug info');
  
  const supabase = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  
  // Get current time in KST (UTC+9)
  const kstTime = getKSTTime();
  const currentDayOfWeek = kstTime.getDay();
  const currentTime = formatTime(kstTime);
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDayName = dayNames[currentDayOfWeek];
  
  try {
    // Get all notifications
    const { data: allNotifications, error: allError } = await supabase
      .from('weekly_notifications')
      .select('*')
      .then();
    
    if (allError) {
      console.error('Error fetching notifications:', allError);
      return { error: 'Failed to fetch notifications' };
    }
    
    // Analyze each notification
    const analyzedNotifications = allNotifications?.map((notification: WeeklyNotification) => {
      const timeDiff = Math.abs(timeToMinutes(currentTime) - timeToMinutes(notification.time));
      const dayMatch = notification.day_of_week === currentDayOfWeek;
      const timeMatch = timeDiff <= 5; // 5 minute window
      const wouldSend = notification.is_active && dayMatch && timeMatch && !notification.sent_this_week;
      
      return {
        id: notification.id,
        message: notification.message.substring(0, 50) + '...',
        day_of_week: notification.day_of_week,
        day_name: dayNames[notification.day_of_week],
        time: notification.time,
        is_active: notification.is_active,
        sent_this_week: notification.sent_this_week,
        time_diff_minutes: timeDiff,
        day_match: dayMatch,
        time_match: timeMatch,
        would_send: wouldSend
      };
    });
    
    return {
      current_time: {
        utc: new Date().toISOString(),
        kst: kstTime.toISOString(),
        kst_formatted: currentTime,
        day_of_week: currentDayOfWeek,
        day_name: currentDayName
      },
      time_window: "5 minutes",
      notifications: analyzedNotifications,
      summary: {
        total: allNotifications?.length || 0,
        active: allNotifications?.filter(n => n.is_active).length || 0,
        for_today: allNotifications?.filter(n => n.day_of_week === currentDayOfWeek).length || 0,
        within_time_window: allNotifications?.filter(n => {
          const timeDiff = Math.abs(timeToMinutes(currentTime) - timeToMinutes(n.time));
          return timeDiff <= 5;
        }).length || 0,
        ready_to_send: allNotifications?.filter(n => {
          const timeDiff = Math.abs(timeToMinutes(currentTime) - timeToMinutes(n.time));
          const dayMatch = n.day_of_week === currentDayOfWeek;
          const timeMatch = timeDiff <= 5;
          return n.is_active && dayMatch && timeMatch && !n.sent_this_week;
        }).length || 0
      }
    };
  } catch (error) {
    console.error('Error getting debug info:', error);
    return { error: 'Failed to get debug info' };
  }
}

async function getNotificationStatus(env: Env): Promise<any> {
  console.log('📊 Getting notification status');
  
  const supabase = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    // Get all notifications
    const { data: allNotifications, error: allError } = await supabase
      .from('weekly_notifications')
      .select('*')
      .then();
    
    if (allError) {
      console.error('Error fetching all notifications:', allError);
      return { error: 'Failed to fetch notifications' };
    }
    
    // Count sent vs unsent
    const sentCount = allNotifications?.filter(n => n.sent_this_week).length || 0;
    const unsentCount = allNotifications?.filter(n => !n.sent_this_week).length || 0;
    
    return {
      total: allNotifications?.length || 0,
      sent_this_week: sentCount,
      not_sent_this_week: unsentCount,
      notifications: allNotifications?.map(n => ({
        id: n.id,
        message: n.message,
        sent_this_week: n.sent_this_week,
        is_active: n.is_active,
        day_of_week: n.day_of_week,
        time: n.time
      }))
    };
  } catch (error) {
    console.error('Error getting notification status:', error);
    return { error: 'Failed to get status' };
  }
}

async function resetWeeklyNotifications(env: Env): Promise<void> {
  console.log('🔄 Resetting weekly notifications');
  console.log(`Using Supabase URL: ${env.SUPABASE_URL}`);
  
  const supabase = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    // First, let's check how many notifications are currently marked as sent
    console.log('🔍 Checking for notifications marked as sent...');
    const { data: sentNotifications, error: countError } = await supabase
      .from('weekly_notifications')
      .select('id')
      .eq('sent_this_week', true)
      .then();
    
    if (countError) {
      console.error('Error counting sent notifications:', countError);
      return;
    }
    
    const countToReset = sentNotifications?.length || 0;
    console.log(`📊 Found ${countToReset} notifications marked as sent this week`);
    
    if (countToReset === 0) {
      console.log('✅ No notifications to reset');
      return;
    }
    
    // Now reset all notifications
    console.log('🔄 Attempting to reset notifications...');
    const { data: resetResult, error } = await supabase
      .from('weekly_notifications')
      .update({ sent_this_week: false })
      .eq('sent_this_week', true)
      .then();
    
    if (error) {
      console.error('Error resetting weekly notifications:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
    } else {
      const resetCount = resetResult?.length || 0;
      console.log(`✅ Successfully reset ${resetCount} weekly notifications`);
      console.log('Reset result:', JSON.stringify(resetResult, null, 2));
    }
  } catch (error) {
    console.error('Error resetting weekly notifications:', error);
    console.error('Full error:', JSON.stringify(error, null, 2));
  }
} 