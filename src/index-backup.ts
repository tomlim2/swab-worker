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

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SLACK_WEBHOOK_URL: string;
}

// Add interface for tracking sent notifications
interface SentNotification {
  id: string;
  notification_id: string;
  sent_at: string;
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
          await sendSlackNotification(env.SLACK_WEBHOOK_URL, `${notification.message}`);
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
      
      // Convert to Korean time (UTC+9)
      const now = new Date();
      const kstOffset = 9 * 60; // 9 hours in minutes
      const kstTime = new Date(now.getTime() + (kstOffset * 60 * 1000));
      
      const currentDayOfWeek = kstTime.getDay().toString();
      const currentTime = kstTime.toTimeString().split(' ')[0];
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
          
          // Use the same matching logic as the main function
          const dbDay = notification.day_of_week.toString().trim();
          const currentDay = currentDayOfWeek.toString().trim();
          const dayNameMatch = dbDay.toLowerCase() === currentDayName.toLowerCase();
          const dayNumberMatch = dbDay === currentDay;
          const dayMatch = dayNumberMatch || dayNameMatch;
          
          debugInfo += `- ID: ${notification.id}\n`;
          debugInfo += `  Message: ${notification.message}\n`;
          debugInfo += `  Day: ${notification.day_of_week} (DB:"${dbDay}" vs Current:"${currentDay}" | Number:${dayNumberMatch} Name:${dayNameMatch} = ${dayMatch})\n`;
          debugInfo += `  Time: ${notification.time} (diff: ${timeDiff} min)\n`;
          debugInfo += `  Would send: ${dayMatch && timeDiff <= 5}\n\n`;
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
      // Comprehensive debug endpoint
      console.log('Comprehensive debug triggered');
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
      
      // Convert to Korean time (UTC+9)
      const now = new Date();
      const kstOffset = 9 * 60;
      const kstTime = new Date(now.getTime() + (kstOffset * 60 * 1000));
      
      const currentDayOfWeek = kstTime.getDay().toString();
      const currentTime = kstTime.toTimeString().split(' ')[0];
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
      debugInfo += `UTC Time: ${now.toISOString()}\n`;
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
            const dayMatch = notification.day_of_week === currentDayOfWeek || notification.day_of_week === currentDayName;
            const wouldSend = notification.is_active && dayMatch && timeDiff <= 1;
            
            debugInfo += `\n${index + 1}. ID: ${notification.id}\n`;
            debugInfo += `   Message: "${notification.message}"\n`;
            debugInfo += `   Day: ${notification.day_of_week} ${dayMatch ? '✅' : '❌'}\n`;
            debugInfo += `   Time: ${notification.time} (diff: ${timeDiff}min) ${timeDiff <= 1 ? '✅' : '❌'}\n`;
            debugInfo += `   Active: ${notification.is_active ? '✅' : '❌'}\n`;
            debugInfo += `   Would Send: ${wouldSend ? '✅ YES' : '❌ NO'}\n`;
          });
        }
        
        // Today's Matching Notifications
        debugInfo += `\n\n🎯 TODAY'S MATCHING NOTIFICATIONS:\n`;
        
        // Use the same filtering logic as the main function instead of SQL query
        const { data: allActiveNotifications, error: activeError } = await supabase
          .from('weekly_notifications')
          .select('*')
          .eq('is_active', true);
          
        if (activeError) {
          debugInfo += `❌ Error: ${activeError.message}\n`;
        } else if (!allActiveNotifications || allActiveNotifications.length === 0) {
          debugInfo += `No active notifications found\n`;
        } else {
          // Filter by day using the same logic as main function
          const todayNotifications = allActiveNotifications.filter((notification: WeeklyNotification) => {
            const dbDay = notification.day_of_week.toString().trim();
            const currentDay = currentDayOfWeek.toString().trim();
            const dayNameMatch = dbDay.toLowerCase() === currentDayName.toLowerCase();
            const dayNumberMatch = dbDay === currentDay;
            return dayNumberMatch || dayNameMatch;
          });
          
          if (todayNotifications.length === 0) {
            debugInfo += `No notifications scheduled for today (${currentDayName})\n`;
          } else {
            todayNotifications.forEach((notification: WeeklyNotification) => {
              const timeDiff = Math.abs(
                timeToMinutes(currentTime) - timeToMinutes(notification.time)
              );
              debugInfo += `\n📝 ${notification.message}\n`;
              debugInfo += `   Day: ${notification.day_of_week} (matches current day ${currentDayOfWeek})\n`;
              debugInfo += `   Time: ${notification.time} (${timeDiff}min away)\n`;
            });
          }
        }
        
      } catch (e) {
        debugInfo += `❌ Debug Error: ${e instanceof Error ? e.message : 'Unknown error'}\n`;
      }
      
      return new Response(debugInfo, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    if (url.pathname === '/create-test-now') {
      // Create a test notification for right now
      console.log('Creating test notification for current time');
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
      
      // Get current KST time
      const now = new Date();
      const kstOffset = 9 * 60;
      const kstTime = new Date(now.getTime() + (kstOffset * 60 * 1000));
      
      const currentDayOfWeek = kstTime.getDay().toString();
      const currentTime = kstTime.toTimeString().split(' ')[0].substring(0, 8); // HH:MM:SS
      
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
    
    if (url.pathname === '/logs') {
      // Show recent execution logs
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
    
    if (url.pathname === '/clear-logs') {
      // Clear the logs
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

async function runNotificationCheck(env: Env): Promise<void> {
  addLog('🔍 Starting notification check');
  
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  
  // Convert to Korean time (UTC+9)
  const now = new Date();
  const kstOffset = 9 * 60; // 9 hours in minutes
  const kstTime = new Date(now.getTime() + (kstOffset * 60 * 1000));
  
  const currentDayOfWeek = kstTime.getDay().toString(); // 0=Sunday, 1=Monday, etc.
  const currentTime = kstTime.toTimeString().split(' ')[0];
  
  console.log(`Current UTC time: ${now.toISOString()}`);
  console.log(`Current KST time: ${kstTime.toISOString()}`);
  console.log(`Checking notifications for day: ${currentDayOfWeek}, time: ${currentTime}`);
  
  // Get day name for debugging
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDayName = dayNames[parseInt(currentDayOfWeek)];
  console.log(`Day name: ${currentDayName}`);
  
  try {
    // First, let's fetch ALL notifications to see what's in the database
    const { data: allNotifications, error: allError } = await supabase
      .from('weekly_notifications')
      .select('*');
      
    if (allError) {
      console.error('Error fetching all notifications:', allError);
    } else {
      console.log(`Total notifications in database: ${allNotifications?.length || 0}`);
      allNotifications?.forEach((notification: WeeklyNotification) => {
        console.log(`DB Record: ID=${notification.id}, day=${notification.day_of_week}, time=${notification.time}, active=${notification.is_active}, message="${notification.message}"`);
      });
    }
    
    // Fetch active notifications for current day (more robust matching)
    const { data: notifications, error } = await supabase
      .from('weekly_notifications')
      .select('*')
      .eq('is_active', true);
      
    if (error) {
      console.error('Error fetching notifications:', error);
      return;
    }
    
    addLog(`📊 Found ${notifications?.length || 0} total active notifications`);
    
    // Filter by day first
    const todaysNotifications = notifications?.filter((notification: WeeklyNotification) => {
      const dbDay = notification.day_of_week.toString().trim();
      const currentDay = currentDayOfWeek.toString().trim();
      const dayNameMatch = dbDay.toLowerCase() === currentDayName.toLowerCase();
      const dayNumberMatch = dbDay === currentDay;
      
      addLog(`Day matching for ${notification.id}: DB:"${dbDay}" vs Current:"${currentDay}" = ${dayNumberMatch || dayNameMatch}`);
      
      return dayNumberMatch || dayNameMatch;
    }) || [];
    
    addLog(`📅 Found ${todaysNotifications.length} notifications for today`);
    
    if (todaysNotifications.length === 0) {
      addLog('❌ No notifications found for today');
      return;
    }
    
    // Filter notifications by time (within 1 minute for precise scheduling)
    const matchingNotifications = todaysNotifications.filter((notification: WeeklyNotification) => {
      const notificationTime = notification.time;
      const timeDiff = Math.abs(
        timeToMinutes(currentTime) - timeToMinutes(notificationTime)
      );
      
      addLog(`⏰ Time diff for ${notification.id}: ${timeDiff} minutes (Current: ${currentTime}, Notification: ${notificationTime})`);
      
      return timeDiff <= 1; // Within 1 minute for precise timing
    });
    
    addLog(`🎯 Found ${matchingNotifications.length} matching notifications to send`);
    
    // Send Slack notifications
    for (const notification of matchingNotifications) {
      addLog(`📤 Sending notification: ${notification.message}`);
      await sendSlackNotification(env.SLACK_WEBHOOK_URL, notification.message);
      
      // Track sent notification in the database
      try {
        const { error: insertError } = await supabase
          .from('sent_notifications')
          .insert({
            notification_id: notification.id,
            sent_at: new Date().toISOString()
          });
          
        if (insertError) {
          console.error('Error tracking sent notification:', insertError);
        } else {
          addLog(`✅ Notification sent and tracked: ${notification.id}`);
        }
      } catch (e) {
        addLog(`❌ Error tracking notification: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }
    
  } catch (error) {
    addLog(`❌ Error in notification check: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function timeToMinutes(timeString: string): number {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

async function sendSlackNotification(webhookUrl: string, message: string): Promise<void> {
  addLog(`📡 Attempting to send Slack notification: ${message}`);
  
  if (!webhookUrl) {
    console.error('SLACK_WEBHOOK_URL not configured');
    return;
  }
  
  try {
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
      addLog(`❌ Failed to send Slack notification: ${response.status} ${response.statusText} ${errorText}`);
    } else {
      addLog(`✅ Slack notification sent successfully: ${message}`);
    }
  } catch (error) {
    addLog(`❌ Error sending Slack notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
