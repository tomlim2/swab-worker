import { createClient } from '@supabase/supabase-js';

// Day mapping for database
const DAY_TO_NUMBER = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
} as const;

interface WeeklyNotification {
  id: string;
  message: string;
  day_of_week: string;
  time: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SentNotification {
  id: string;
  notification_id: string;
  sent_at: string;
}

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SLACK_WEBHOOK_URL: string;
}

// Simple log storage (in-memory)
const executionLogs: string[] = [];
const MAX_LOGS = 50;

function addLog(message: string) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}`;
  executionLogs.unshift(logEntry);
  if (executionLogs.length > MAX_LOGS) {
    executionLogs.pop();
  }
  console.log(logEntry);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/test') {
      // Manual test endpoint
      console.log('Manual test triggered');
      await runNotificationCheck(env);
      return new Response('Test completed. Check logs for details.', { status: 200 });
    }
    
    if (url.pathname === '/force-test') {
      // Force send first notification regardless of time
      console.log('Force test triggered - ignoring time matching');
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
      
      try {
        const { data: notifications, error } = await supabase
          .from('weekly_notifications')
          .select('*')
          .eq('is_active', true)
          .limit(1);
          
        if (error) {
          return new Response(`Error: ${error.message}`, { status: 500 });
        }
        
        if (notifications && notifications.length > 0) {
          const notification = notifications[0];
          console.log(`Force sending: ${notification.message}`);
          await sendSlackNotification(env, notification.message, notification.id);
          return new Response(`Force sent: ${notification.message}`, { status: 200 });
        } else {
          return new Response('No active notifications found', { status: 404 });
        }
      } catch (e) {
        return new Response(`Error: ${e instanceof Error ? e.message : 'Unknown'}`, { status: 500 });
      }
    }
    
    if (url.pathname === '/status') {
      // Health check endpoint
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
      try {
        const { data, error } = await supabase.from('weekly_notifications').select('count').limit(1);
        return new Response(JSON.stringify({
          status: 'ok',
          supabase_connected: !error,
          timestamp: new Date().toISOString()
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({
          status: 'error',
          error: e instanceof Error ? e.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    if (url.pathname === '/time-debug') {
      // Debug time matching specifically
      console.log('Time debug triggered');
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
      
      // Use proper timezone handling
      const kstTime = getKSTTime();
      
      const currentDayOfWeek = kstTime.getDay().toString();
      const currentTime = formatTime(kstTime);
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDayName = dayNames[parseInt(currentDayOfWeek)];
      
      let debugInfo = `Current KST: ${kstTime.toISOString()}\n`;
      debugInfo += `Day: ${currentDayOfWeek} (${currentDayName})\n`;
      debugInfo += `Time: ${currentTime}\n\n`;
      
      try {
        const { data: notifications, error } = await supabase
          .from('weekly_notifications')
          .select('*')
          .eq('is_active', true);
          
        if (error) {
          return new Response(`Error: ${error.message}`, { status: 500 });
        }
        
        debugInfo += `All active notifications:\n`;
        notifications?.forEach((notification: WeeklyNotification) => {
          const timeDiff = Math.abs(
            timeToMinutes(currentTime) - timeToMinutes(notification.time)
          );
          
          const dayMatch = checkDayMatch(notification.day_of_week, currentDayOfWeek, currentDayName);
          
          debugInfo += `- ID: ${notification.id}\n`;
          debugInfo += `  Message: ${notification.message}\n`;
          debugInfo += `  Day: ${notification.day_of_week} (${dayMatch ? '✅' : '❌'})\n`;
          debugInfo += `  Time: ${notification.time} (diff: ${timeDiff} min)\n`;
          debugInfo += `  Would send: ${dayMatch && timeDiff <= 3}\n\n`;
        });
        
        return new Response(debugInfo, { 
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        });
      } catch (e) {
        return new Response(`Error: ${e instanceof Error ? e.message : 'Unknown'}`, { status: 500 });
      }
    }
    
    if (url.pathname === '/debug') {
      return await getComprehensiveDebug(env);
    }
    
    if (url.pathname === '/create-test-now') {
      return await createTestNotification(env);
    }
    
    if (url.pathname === '/logs') {
      return getLogsResponse();
    }
    
    if (url.pathname === '/clear-logs') {
      executionLogs.length = 0;
      addLog('Logs cleared');
      return new Response('Logs cleared', { status: 200 });
    }

    return new Response('Worker is running. Use /test or /status endpoints.', { status: 200 });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    addLog('🕐 Scheduled event triggered');
    await runNotificationCheck(env);
  },
};

// Helper function to get Korean Standard Time
function getKSTTime(): Date {
  const now = new Date();
  const kstOffset = 9 * 60; // 9 hours in minutes
  return new Date(now.getTime() + (kstOffset * 60 * 1000));
}

// Helper function to format time consistently
function formatTime(date: Date): string {
  return date.toTimeString().split(' ')[0]; // HH:MM:SS
}

// Improved day matching logic
function checkDayMatch(dbDay: string, currentDayNumber: string, currentDayName: string): boolean {
  const normalizedDbDay = dbDay.toString().trim();
  const normalizedCurrentDay = currentDayNumber.toString().trim();
  
  // Try number match first (0-6)
  if (normalizedDbDay === normalizedCurrentDay) {
    return true;
  }
  
  // Try name match (case insensitive)
  if (normalizedDbDay.toLowerCase() === currentDayName.toLowerCase()) {
    return true;
  }
  
  return false;
}

async function runNotificationCheck(env: Env): Promise<void> {
  addLog('🔍 Starting notification check');
  
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  
  // Use improved time handling
  const kstTime = getKSTTime();
  const currentDayOfWeek = kstTime.getDay().toString();
  const currentTime = formatTime(kstTime);
  
  console.log(`Current UTC time: ${new Date().toISOString()}`);
  console.log(`Current KST time: ${kstTime.toISOString()}`);
  console.log(`Checking notifications for day: ${currentDayOfWeek}, time: ${currentTime}`);
  
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDayName = dayNames[parseInt(currentDayOfWeek)];
  console.log(`Day name: ${currentDayName}`);
  
  try {
    // Fetch all active notifications
    const { data: notifications, error } = await supabase
      .from('weekly_notifications')
      .select('*')
      .eq('is_active', true);
      
    if (error) {
      console.error('Error fetching notifications:', error);
      addLog(`❌ Database error: ${error.message}`);
      return;
    }
    
    addLog(`📊 Found ${notifications?.length || 0} total active notifications`);
    
    // Filter by day first
    const todaysNotifications = notifications?.filter((notification: WeeklyNotification) => {
      return checkDayMatch(notification.day_of_week, currentDayOfWeek, currentDayName);
    }) || [];
    
    addLog(`📅 Found ${todaysNotifications.length} notifications for today`);
    
    if (todaysNotifications.length === 0) {
      addLog('❌ No notifications found for today');
      return;
    }
    
    // Filter notifications by time with improved window (3 minutes instead of 1)
    const matchingNotifications = [];
    
    for (const notification of todaysNotifications) {
      const notificationTime = notification.time;
      const timeDiff = Math.abs(
        timeToMinutes(currentTime) - timeToMinutes(notificationTime)
      );
      
      addLog(`⏰ Time diff for ${notification.id}: ${timeDiff} minutes (Current: ${currentTime}, Notification: ${notificationTime})`);
      
      // Skip if time difference is too large (3 minutes for better reliability)
      if (timeDiff > 3) {
        continue;
      }
      
      // Check if this notification was recently sent (using database)
      const wasRecentlySent = await checkRecentlySent(supabase, notification.id);
      
      if (wasRecentlySent) {
        addLog(`⏳ Skipping ${notification.id} - sent recently`);
        continue;
      }
      
      matchingNotifications.push(notification);
    }
    
    addLog(`🎯 Found ${matchingNotifications.length} matching notifications to send`);
    
    // Send Slack notifications
    for (const notification of matchingNotifications) {
      addLog(`📤 Sending notification: ${notification.message}`);
      await sendSlackNotification(env, notification.message, notification.id);
    }
    
  } catch (error) {
    addLog(`❌ Error in notification check: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function checkRecentlySent(supabase: any, notificationId: string): Promise<boolean> {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: recentSent, error } = await supabase
      .from('sent_notifications')
      .select('sent_at')
      .eq('notification_id', notificationId)
      .gte('sent_at', fiveMinutesAgo)
      .limit(1);
    
    if (error) {
      console.error('Error checking sent status:', error);
      return false; // If we can't check, proceed to send
    }
    
    return recentSent && recentSent.length > 0;
  } catch (e) {
    console.error('Exception checking sent status:', e);
    return false; // If we can't check, proceed to send
  }
}

function timeToMinutes(timeString: string): number {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

async function sendSlackNotification(env: Env, message: string, notificationId: string): Promise<void> {
  addLog(`📡 Attempting to send Slack notification: ${message}`);
  
  if (!env.SLACK_WEBHOOK_URL) {
    addLog('❌ SLACK_WEBHOOK_URL not configured');
    return;
  }
  
  try {
    const response = await fetch(env.SLACK_WEBHOOK_URL, {
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
      addLog(`❌ Failed to send Slack notification: ${response.status} ${response.statusText} ${errorText}`);
      return;
    }
    
    addLog(`✅ Slack notification sent successfully: ${message}`);
    
    // Track sent notification in the database
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    
    try {
      const { error: insertError } = await supabase
        .from('sent_notifications')
        .insert({
          notification_id: notificationId,
          sent_at: new Date().toISOString()
        });
        
      if (insertError) {
        console.error('Error tracking sent notification:', insertError);
        addLog(`⚠️ Could not track sent notification in database: ${insertError.message}`);
      } else {
        addLog(`✅ Notification tracked in database: ${notificationId}`);
      }
    } catch (e) {
      addLog(`❌ Error tracking notification: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
    
  } catch (error) {
    addLog(`❌ Error sending Slack notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function getComprehensiveDebug(env: Env): Promise<Response> {
  console.log('Comprehensive debug triggered');
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  
  const kstTime = getKSTTime();
  const currentDayOfWeek = kstTime.getDay().toString();
  const currentTime = formatTime(kstTime);
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDayName = dayNames[parseInt(currentDayOfWeek)];
  
  let debugInfo = `=== SLACK NOTIFICATION WORKER DEBUG ===\n\n`;
  
  // Environment Check
  debugInfo += `🔧 ENVIRONMENT:\n`;
  debugInfo += `SUPABASE_URL: ${env.SUPABASE_URL ? '✅ Set' : '❌ Missing'}\n`;
  debugInfo += `SUPABASE_SERVICE_ROLE_KEY: ${env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing'}\n`;
  debugInfo += `SLACK_WEBHOOK_URL: ${env.SLACK_WEBHOOK_URL ? '✅ Set' : '❌ Missing'}\n\n`;
  
  // Time Information
  debugInfo += `⏰ TIME INFORMATION:\n`;
  debugInfo += `UTC Time: ${new Date().toISOString()}\n`;
  debugInfo += `KST Time: ${kstTime.toISOString()}\n`;
  debugInfo += `Current Day: ${currentDayOfWeek} (${currentDayName})\n`;
  debugInfo += `Current Time: ${currentTime}\n\n`;
  
  try {
    // Database Connection Test
    debugInfo += `🗄️ DATABASE CONNECTION:\n`;
    const { data: connectionTest, error: connectionError } = await supabase
      .from('weekly_notifications')
      .select('count')
      .limit(1);
      
    if (connectionError) {
      debugInfo += `❌ Connection Failed: ${connectionError.message}\n\n`;
    } else {
      debugInfo += `✅ Connection Successful\n\n`;
    }
    
    // All Notifications
    const { data: allNotifications, error: allError } = await supabase
      .from('weekly_notifications')
      .select('*')
      .order('day_of_week', { ascending: true })
      .order('time', { ascending: true });
      
    if (allError) {
      debugInfo += `❌ Error fetching notifications: ${allError.message}\n\n`;
    } else {
      debugInfo += `📋 ALL NOTIFICATIONS (${allNotifications?.length || 0} total):\n`;
      allNotifications?.forEach((notification: WeeklyNotification, index) => {
        const timeDiff = Math.abs(
          timeToMinutes(currentTime) - timeToMinutes(notification.time)
        );
        const dayMatch = checkDayMatch(notification.day_of_week, currentDayOfWeek, currentDayName);
        const wouldSend = notification.is_active && dayMatch && timeDiff <= 3;
        
        debugInfo += `\n${index + 1}. ID: ${notification.id}\n`;
        debugInfo += `   Message: "${notification.message}"\n`;
        debugInfo += `   Day: ${notification.day_of_week} ${dayMatch ? '✅' : '❌'}\n`;
        debugInfo += `   Time: ${notification.time} (diff: ${timeDiff}min) ${timeDiff <= 3 ? '✅' : '❌'}\n`;
        debugInfo += `   Active: ${notification.is_active ? '✅' : '❌'}\n`;
        debugInfo += `   Would Send: ${wouldSend ? '✅ YES' : '❌ NO'}\n`;
      });
    }
    
  } catch (e) {
    debugInfo += `❌ Debug Error: ${e instanceof Error ? e.message : 'Unknown error'}\n`;
  }
  
  return new Response(debugInfo, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' }
  });
}

async function createTestNotification(env: Env): Promise<Response> {
  console.log('Creating test notification for current time');
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  
  const kstTime = getKSTTime();
  const currentDayOfWeek = kstTime.getDay().toString();
  const currentTime = formatTime(kstTime).substring(0, 8); // HH:MM:SS
  
  try {
    const { data, error } = await supabase
      .from('weekly_notifications')
      .insert({
        message: `Test notification created at ${currentTime}`,
        day_of_week: currentDayOfWeek,
        time: currentTime,
        is_active: true
      })
      .select()
      .single();
      
    if (error) {
      return new Response(`Error creating test notification: ${error.message}`, { status: 500 });
    }
    
    return new Response(`Test notification created! ID: ${data.id}, Time: ${currentTime}, Day: ${currentDayOfWeek}`, { status: 200 });
  } catch (e) {
    return new Response(`Error: ${e instanceof Error ? e.message : 'Unknown'}`, { status: 500 });
  }
}

function getLogsResponse(): Response {
  addLog('Logs endpoint accessed');
  
  let logsInfo = `=== WORKER EXECUTION LOGS (Last ${executionLogs.length}) ===\n\n`;
  
  if (executionLogs.length === 0) {
    logsInfo += 'No logs available yet. Worker may not have run or been restarted.\n\n';
    logsInfo += 'Try:\n';
    logsInfo += '1. Visit /test to trigger a manual check\n';
    logsInfo += '2. Visit /create-test-now to create a test notification\n';
    logsInfo += '3. Wait for the cron job to run (every minute)\n';
  } else {
    executionLogs.forEach(log => {
      logsInfo += log + '\n';
    });
  }
  
  return new Response(logsInfo, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' }
  });
}
