/**
 * Slack Weekly Notification Worker - Refactored TypeScript Version
 * Self-contained implementation with modular structure
 * Handles scheduled Slack notifications with Korean timezone support
 */
import { DAY_TO_NUMBER, HTML_DASHBOARD, MAX_LOGS } from './constants';
import type { WeeklyNotification, SentNotification, Env, SupabaseResponse } from './types';
import { addLog, getExecutionLogs, clearExecutionLogs, getKSTTime, formatTime, checkDayMatch, timeToMinutes } from './lib/utils';
import { runNotificationCheck, checkRecentlySent, resetSentThisWeek } from './lib/handlers';
import { createClient } from './lib/database/supabase';
import { sendSlackNotification } from './lib/slack';

const html = HTML_DASHBOARD;

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
				const { data: notifications, error } = await supabase.select('weekly_notifications', { is_active: true }, '*', undefined, 1);

				if (error) {
					return new Response(`Error: ${error.message}`, { status: 500 });
				}

				if (notifications && notifications.length > 0) {
					const notification = notifications[0];
					console.log(`Force sending: ${notification.message}`);
					await sendSlackNotification(env, notification, true); // Force use test webhook
					return new Response(`Force sent to TEST channel: ${notification.message}`, { status: 200 });
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
				const { data, error } = await supabase.select('weekly_notifications', {}, 'count', undefined, 1);
				return new Response(
					JSON.stringify({
						status: 'ok',
						supabase_connected: !error,
						timestamp: new Date().toISOString(),
					}),
					{
						headers: { 'Content-Type': 'application/json' },
					}
				);
			} catch (e) {
				return new Response(
					JSON.stringify({
						status: 'error',
						error: e instanceof Error ? e.message : 'Unknown error',
					}),
					{
						status: 500,
						headers: { 'Content-Type': 'application/json' },
					}
				);
			}
		}

		if (url.pathname === '/heartbeat') {
			// Heartbeat endpoint for external monitoring
			const kstTime = getKSTTime();
			const currentTime = formatTime(kstTime);

			addLog('💓 Heartbeat check - triggering notification check');
			await runNotificationCheck(env);

			return new Response(
				JSON.stringify({
					status: 'alive',
					timestamp: new Date().toISOString(),
					kst_time: kstTime.toISOString(),
					current_time: currentTime,
					last_check: 'completed',
				}),
				{
					headers: { 'Content-Type': 'application/json' },
				}
			);
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
				const { data: notifications, error } = await supabase.select('weekly_notifications', { is_active: true }, '*', undefined, 1);

				if (error) {
					return new Response(`Error: ${error.message}`, { status: 500 });
				}

				debugInfo += `All active notifications:\n`;
				notifications?.forEach((notification: WeeklyNotification) => {
					const timeDiff = Math.abs(timeToMinutes(currentTime) - timeToMinutes(notification.time));

					const dayMatch = checkDayMatch(notification.day_of_week, currentDayOfWeek, currentDayName);

					debugInfo += `- ID: ${notification.id}\n`;
					debugInfo += `  Message: ${notification.message}\n`;
					debugInfo += `  Day: ${notification.day_of_week} (${dayMatch ? '✅' : '❌'})\n`;
					debugInfo += `  Time: ${notification.time} (diff: ${timeDiff} min)\n`;
					debugInfo += `  Would send: ${dayMatch && timeDiff <= 15}\n\n`;
				});

				return new Response(debugInfo, {
					status: 200,
					headers: { 'Content-Type': 'text/plain' },
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

		if (url.pathname === '/cleanup-test') {
			return await cleanupTestNotifications(env);
		}

		if (url.pathname === '/logs') {
			return getLogsResponse();
		}

		if (url.pathname === '/clear-logs') {
			clearExecutionLogs();
			addLog('Logs cleared');
			return new Response('Logs cleared', { status: 200 });
		}

		if (url.pathname === '/add-three-debug') {
			return await addThreeDebugNotifications(env);
		}

		if (url.pathname === '/cleanup-debug') {
			return await cleanupDebugNotifications(env);
		}

		// Serve index.html for root path
		if (url.pathname === '/') {
			return new Response(html, {
				headers: { 'Content-Type': 'text/html' },
			});
		}

		return new Response('Worker is running. Use /test or /status endpoints.', { status: 200 });
	},

	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		const cronTime = new Date().toISOString();
		addLog(`🕐 Scheduled event triggered at ${cronTime}`);
		addLog(`📅 Cron string: ${event.cron}`);
		addLog(`⏰ Scheduled time: ${new Date(event.scheduledTime).toISOString()}`);

		// Check if it's Sunday at midnight KST for weekly reset
		const kstTime = getKSTTime();
		const isSunday = kstTime.getDay() === 0; // 0 = Sunday
		const isMidnight = kstTime.getHours() === 0 && kstTime.getMinutes() < 5; // Within 5 minutes of midnight

		if (isSunday && isMidnight) {
			addLog('🔄 Sunday midnight detected - resetting sent_this_week flags');
			try {
				await resetSentThisWeek(env);
				addLog('✅ Weekly reset completed successfully');
			} catch (error) {
				addLog(`❌ Weekly reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}

		// Add some resilience for timing issues
		try {
			await runNotificationCheck(env);
			addLog('✅ Scheduled notification check completed successfully');
		} catch (error) {
			addLog(`❌ Scheduled notification check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

			// Retry once after a short delay for transient errors
			try {
				addLog('🔄 Retrying notification check after error...');
				await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay
				await runNotificationCheck(env);
				addLog('✅ Retry successful');
			} catch (retryError) {
				addLog(`❌ Retry also failed: ${retryError instanceof Error ? retryError.message : 'Unknown error'}`);
			}
		}
	},
};

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
		const { data: connectionTest, error: connectionError } = await supabase.select('weekly_notifications', {}, 'count', undefined, 1);

		if (connectionError) {
			debugInfo += `❌ Connection Failed: ${connectionError.message}\n\n`;
		} else {
			debugInfo += `✅ Connection Successful\n\n`;
		}

		// All Notifications
		const { data: allNotifications, error: allError } = await supabase
			.select('weekly_notifications', { orderBy: { day_of_week: 'asc', time: 'asc' } }, '*');

		if (allError) {
			debugInfo += `❌ Error fetching notifications: ${allError.message}\n\n`;
		} else {
			debugInfo += `📋 ALL NOTIFICATIONS (${allNotifications?.length || 0} total):\n`;
			allNotifications?.forEach((notification: WeeklyNotification, index: number) => {
				const timeDiff = Math.abs(timeToMinutes(currentTime) - timeToMinutes(notification.time));
				const dayMatch = checkDayMatch(notification.day_of_week, currentDayOfWeek, currentDayName);
				const wouldSend = notification.is_active && dayMatch && timeDiff <= 15;

				debugInfo += `\n${index + 1}. ID: ${notification.id}\n`;
				debugInfo += `   Message: "${notification.message}"\n`;
				debugInfo += `   Day: ${notification.day_of_week} ${dayMatch ? '✅' : '❌'}\n`;
				debugInfo += `   Time: ${notification.time} (diff: ${timeDiff}min) ${timeDiff <= 15 ? '✅' : '❌'}\n`;
				debugInfo += `   Active: ${notification.is_active ? '✅' : '❌'}\n`;
				debugInfo += `   Would Send: ${wouldSend ? '✅ YES' : '❌ NO'}\n`;
			});
		}
	} catch (e) {
		debugInfo += `❌ Debug Error: ${e instanceof Error ? e.message : 'Unknown error'}\n`;
	}

	return new Response(debugInfo, {
		status: 200,
		headers: { 'Content-Type': 'text/plain' },
	});
}

async function createTestNotification(env: Env): Promise<Response> {
	console.log('Creating test notifications optimized for 10-minute window');
	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

	const kstTime = getKSTTime();
	const currentDayOfWeek = kstTime.getDay().toString();
	const currentTime = formatTime(kstTime).substring(0, 8); // HH:MM:SS

	try {
		// Create multiple test notifications at strategic times for 10-minute window testing
		const testNotifications = [];

		// 1. Notification for current time (should trigger immediately)
		testNotifications.push({
			message: `🔔 Test notification - Current time (${currentTime})`,
			day_of_week: currentDayOfWeek,
			time: currentTime,
			is_active: true,
		});

		// 2. Notification 5 minutes ago (should trigger within window)
		const fiveMinutesAgo = new Date(kstTime.getTime() - 5 * 60 * 1000);
		const fiveMinutesAgoTime = formatTime(fiveMinutesAgo).substring(0, 8);
		testNotifications.push({
			message: `🕐 Test notification - 5 min ago (${fiveMinutesAgoTime})`,
			day_of_week: currentDayOfWeek,
			time: fiveMinutesAgoTime,
			is_active: true,
		});

		// 3. Notification 2 minutes from now (should trigger within window)
		const twoMinutesLater = new Date(kstTime.getTime() + 2 * 60 * 1000);
		const twoMinutesLaterTime = formatTime(twoMinutesLater).substring(0, 8);
		testNotifications.push({
			message: `🕕 Test notification - 2 min future (${twoMinutesLaterTime})`,
			day_of_week: currentDayOfWeek,
			time: twoMinutesLaterTime,
			is_active: true,
		});

		// 4. Notification 10 minutes from now (should trigger - within window)
		const tenMinutesLater = new Date(kstTime.getTime() + 10 * 60 * 1000);
		const tenMinutesLaterTime = formatTime(tenMinutesLater).substring(0, 8);
		testNotifications.push({
			message: `🕙 Test notification - 10 min future (${tenMinutesLaterTime})`,
			day_of_week: currentDayOfWeek,
			time: tenMinutesLaterTime,
			is_active: true,
		});

		// 5. Notification 20 minutes from now (should trigger - within window)
		const twentyMinutesLater = new Date(kstTime.getTime() + 20 * 60 * 1000);
		const twentyMinutesLaterTime = formatTime(twentyMinutesLater).substring(0, 8);
		testNotifications.push({
			message: `⏰ Test notification - 20 min future (${twentyMinutesLaterTime}) - Should NOT send`,
			day_of_week: currentDayOfWeek,
			time: twentyMinutesLaterTime,
			is_active: true,
		});

		// Insert all test notifications
		const { data, error } = await supabase.insert('weekly_notifications', testNotifications);

		if (error) {
			return new Response(`Error creating test notifications: ${error.message}`, { status: 500 });
		}

		let response = `✅ Created ${data?.length || 0} test notifications for 15-minute window testing:\n\n`;
		response += `📅 Day: ${currentDayOfWeek} (${
			['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseInt(currentDayOfWeek)]
		})\n`;
		response += `🕐 Current KST Time: ${currentTime}\n\n`;

		response += `📋 Test Notifications Created:\n`;
		data?.forEach((notification: WeeklyNotification, index: number) => {
			const timeDiff = Math.abs(timeToMinutes(currentTime) - timeToMinutes(notification.time));
			const shouldTrigger = timeDiff <= 15;

			response += `${index + 1}. ${notification.message}\n`;
			response += `   ID: ${notification.id}\n`;
			response += `   Time: ${notification.time} (${timeDiff} min diff)\n`;
			response += `   Expected: ${shouldTrigger ? '✅ SHOULD SEND' : '❌ Should NOT send'}\n\n`;
		});

		response += `🧪 Test Instructions:\n`;
		response += `1. Visit /test to manually trigger notification check\n`;
		response += `2. Check /logs to see which notifications were sent\n`;
		response += `3. Wait for cron job to run automatically\n`;
		response += `4. Expected: 4 notifications should send, 1 should not\n`;

		return new Response(response, { status: 200 });
	} catch (e) {
		return new Response(`Error: ${e instanceof Error ? e.message : 'Unknown'}`, { status: 500 });
	}
}

async function cleanupTestNotifications(env: Env): Promise<Response> {
	console.log('Cleaning up old test notifications');
	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

	try {
		// Delete test notifications (those containing "Test notification" in the message)
		const { data, error } = await supabase.delete('weekly_notifications', { like: { message: '%Test notification%' } });

		let response = `🧹 Cleanup completed!\n\n`;
		response += `✅ Cleaned up old sent notification records\n\n`;
		response += `Now you can create fresh test notifications with /create-test-now`;

		return new Response(response, { status: 200 });
	} catch (e) {
		return new Response(`Error: ${e instanceof Error ? e.message : 'Unknown'}`, { status: 500 });
	}
}

async function addThreeDebugNotifications(env: Env): Promise<Response> {
	addLog('Creating three simple debug notifications');
	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

	const kstTime = getKSTTime();
	const currentDayOfWeek = kstTime.getDay().toString();
	const currentTime = formatTime(kstTime).substring(0, 8); // HH:MM:SS

	try {
		// Create three simple test notifications around current time
		const debugNotifications = [];

		// 1. Notification for current time
		debugNotifications.push({
			message: `🔥 Debug notification #1 - Current time (${currentTime})`,
			day_of_week: currentDayOfWeek,
			time: currentTime,
			is_active: true,
		});

		// 2. Notification 3 minutes ago  
		const threeMinutesAgo = new Date(kstTime.getTime() - 3 * 60 * 1000);
		const threeMinutesAgoTime = formatTime(threeMinutesAgo).substring(0, 8);
		debugNotifications.push({
			message: `🔥 Debug notification #2 - 3 min ago (${threeMinutesAgoTime})`,
			day_of_week: currentDayOfWeek,
			time: threeMinutesAgoTime,
			is_active: true,
		});

		// 3. Notification 5 minutes from now
		const fiveMinutesLater = new Date(kstTime.getTime() + 5 * 60 * 1000);
		const fiveMinutesLaterTime = formatTime(fiveMinutesLater).substring(0, 8);
		debugNotifications.push({
			message: `🔥 Debug notification #3 - 5 min future (${fiveMinutesLaterTime})`,
			day_of_week: currentDayOfWeek,
			time: fiveMinutesLaterTime,
			is_active: true,
		});

		// Insert the three debug notifications
		const { data, error } = await supabase.insert('weekly_notifications', debugNotifications);

		if (error) {
			return new Response(`Error creating debug notifications: ${error.message}`, { status: 500 });
		}

		let response = `✅ Created 3 debug notifications:\n\n`;
		response += `📅 Day: ${currentDayOfWeek} (${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseInt(currentDayOfWeek)]})\n`;
		response += `🕐 Current KST Time: ${currentTime}\n\n`;

		response += `📋 Debug Notifications Created:\n`;
		data?.forEach((notification: WeeklyNotification, index: number) => {
			const timeDiff = Math.abs(timeToMinutes(currentTime) - timeToMinutes(notification.time));
			const shouldTrigger = timeDiff <= 15;

			response += `${index + 1}. ${notification.message}\n`;
			response += `   ID: ${notification.id}\n`;
			response += `   Time: ${notification.time} (${timeDiff} min diff)\n`;
			response += `   Expected: ${shouldTrigger ? '✅ SHOULD SEND' : '❌ Should NOT send'}\n\n`;
		});

		response += `🧪 Next steps:\n`;
		response += `1. Visit /test to manually trigger notification check\n`;
		response += `2. Check /logs to see which notifications were sent\n`;
		response += `3. Use /cleanup-test to remove these when done\n`;

		return new Response(response, { status: 200 });
	} catch (e) {
		return new Response(`Error: ${e instanceof Error ? e.message : 'Unknown'}`, { status: 500 });
	}
}

function getLogsResponse(): Response {
	addLog('Logs endpoint accessed');

	const logs = getExecutionLogs();
	let logsInfo = `=== WORKER EXECUTION LOGS (Last ${logs.length}) ===\n\n`;

	if (logs.length === 0) {
		logsInfo += 'No logs available yet. Worker may not have run or been restarted.\n\n';
		logsInfo += 'Try:\n';
		logsInfo += '1. Visit /test to trigger a manual check\n';
		logsInfo += '2. Visit /create-test-now to create a test notification\n';
		logsInfo += '3. Wait for the cron job to run (every minute)\n';
	} else {
		logs.forEach((log) => {
			logsInfo += log + '\n';
		});
	}

	return new Response(logsInfo, {
		status: 200,
		headers: { 'Content-Type': 'text/plain' },
	});
}
// Cleanup debug notifications specifically
async function cleanupDebugNotifications(env: Env): Promise<Response> {
	addLog('Cleaning up debug notifications');
	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

	try {
		// Delete debug notifications (those containing "Debug notification" in the message)
		const { data, error } = await supabase.delete('weekly_notifications', { like: { message: '%Debug notification%' } });

		let response = `🧹 Debug cleanup completed!\n\n`;
		response += `🔥 All debug notifications have been removed\n\n`;
		response += `The worker will no longer send duplicate debug messages.`;

		return new Response(response, { status: 200 });
	} catch (e) {
		return new Response(`Error: ${e instanceof Error ? e.message : 'Unknown'}`, { status: 500 });
	}
}

