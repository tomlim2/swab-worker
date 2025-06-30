/**
 * Slack Weekly Notification Worker - Refactored TypeScript Version
 * Self-contained implementation with modular structure
 * Handles scheduled Slack notifications with Korean timezone support
 */

import { DAY_TO_NUMBER, HTML_DASHBOARD, MAX_LOGS } from './constants';
import type { WeeklyNotification, SentNotification, Env, SupabaseResponse } from './types';

const html = HTML_DASHBOARD;

// Simple Supabase client implementation
class SimpleSupabaseClient {
	private url: string;
	private key: string;

	constructor(url: string, key: string) {
		this.url = url;
		this.key = key;
	}

	from(table: string) {
		return new SimpleSupabaseTable(this.url, this.key, table);
	}
}

class SimpleSupabaseTable {
	private url: string;
	private key: string;
	private table: string;
	private query: any = {};

	constructor(url: string, key: string, table: string) {
		this.url = url;
		this.key = key;
		this.table = table;
	}

	select(columns: string = '*') {
		this.query.select = columns;
		return this;
	}

	eq(column: string, value: any) {
		if (!this.query.filters) this.query.filters = [];
		this.query.filters.push({ column, operator: 'eq', value });
		return this;
	}

	like(column: string, pattern: string) {
		if (!this.query.filters) this.query.filters = [];
		this.query.filters.push({ column, operator: 'like', value: pattern });
		return this;
	}

	gte(column: string, value: any) {
		if (!this.query.filters) this.query.filters = [];
		this.query.filters.push({ column, operator: 'gte', value });
		return this;
	}

	lt(column: string, value: any) {
		if (!this.query.filters) this.query.filters = [];
		this.query.filters.push({ column, operator: 'lt', value });
		return this;
	}

	limit(count: number) {
		this.query.limit = count;
		return this;
	}

	order(column: string, options: { ascending: boolean } = { ascending: true }) {
		if (!this.query.order) this.query.order = [];
		this.query.order.push({ column, ascending: options.ascending });
		return this;
	}

	async execute(): Promise<SupabaseResponse<any>> {
		let url = `${this.url}/rest/v1/${this.table}`;
		const params = new URLSearchParams();

		if (this.query.select) {
			params.append('select', this.query.select);
		}

		if (this.query.filters) {
			this.query.filters.forEach((filter: any) => {
				params.append(filter.column, `${filter.operator}.${filter.value}`);
			});
		}

		if (this.query.limit) {
			params.append('limit', this.query.limit.toString());
		}

		if (this.query.order) {
			this.query.order.forEach((orderItem: any) => {
				params.append('order', `${orderItem.column}.${orderItem.ascending ? 'asc' : 'desc'}`);
			});
		}

		if (params.toString()) {
			url += '?' + params.toString();
		}

		try {
			const response = await fetch(url, {
				headers: {
					'apikey': this.key,
					'Authorization': `Bearer ${this.key}`,
					'Content-Type': 'application/json',
					'Prefer': 'return=representation'
				}
			});

			if (!response.ok) {
				const errorText = await response.text();
				return {
					data: null,
					error: { message: `Supabase request failed: ${response.status} ${errorText}` }
				};
			}

			const data = await response.json();
			return { data: Array.isArray(data) ? data : [data], error: null };
		} catch (e) {
			return {
				data: null,
				error: { message: `Request failed: ${e instanceof Error ? e.message : 'Unknown error'}` }
			};
		}
	}

	async insert(values: any | any[]) {
		const url = `${this.url}/rest/v1/${this.table}`;
		
		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'apikey': this.key,
					'Authorization': `Bearer ${this.key}`,
					'Content-Type': 'application/json',
					'Prefer': 'return=representation'
				},
				body: JSON.stringify(values)
			});

			if (!response.ok) {
				const errorText = await response.text();
				return { data: null, error: { message: `Insert failed: ${response.status} ${errorText}` } };
			}

			const data = await response.json();
			return { data: Array.isArray(data) ? data : [data], error: null };
		} catch (e) {
			return {
				data: null,
				error: { message: `Insert failed: ${e instanceof Error ? e.message : 'Unknown error'}` }
			};
		}
	}

	async delete() {
		let url = `${this.url}/rest/v1/${this.table}`;
		const params = new URLSearchParams();

		if (this.query.filters) {
			this.query.filters.forEach((filter: any) => {
				params.append(filter.column, `${filter.operator}.${filter.value}`);
			});
		}

		if (params.toString()) {
			url += '?' + params.toString();
		}

		try {
			const response = await fetch(url, {
				method: 'DELETE',
				headers: {
					'apikey': this.key,
					'Authorization': `Bearer ${this.key}`,
					'Content-Type': 'application/json',
					'Prefer': 'return=representation'
				}
			});

			if (!response.ok) {
				const errorText = await response.text();
				return { data: null, error: { message: `Delete failed: ${response.status} ${errorText}` } };
			}

			const data = await response.json();
			return { data: Array.isArray(data) ? data : [data], error: null };
		} catch (e) {
			return {
				data: null,
				error: { message: `Delete failed: ${e instanceof Error ? e.message : 'Unknown error'}` }
			};
		}
	}
}

// Helper function to create Supabase client
function createClient(url: string, key: string): SimpleSupabaseClient {
	return new SimpleSupabaseClient(url, key);
}

// Simple log storage (in-memory)
const executionLogs: string[] = [];

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
				const { data: notifications, error } = await supabase.from('weekly_notifications').select('*').eq('is_active', true).limit(1).execute();

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
				const { data, error } = await supabase.from('weekly_notifications').select('count').limit(1).execute();
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
				const { data: notifications, error } = await supabase.from('weekly_notifications').select('*').eq('is_active', true).execute();

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
			executionLogs.length = 0;
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

// Helper function to get Korean Standard Time
function getKSTTime(): Date {
	const now = new Date();
	const kstOffset = 9 * 60; // 9 hours in minutes
	return new Date(now.getTime() + kstOffset * 60 * 1000);
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
		const { data: notifications, error } = await supabase.from('weekly_notifications').select('*').eq('is_active', true).execute();

		if (error) {
			console.error('Error fetching notifications:', error);
			addLog(`❌ Database error: ${error.message}`);
			return;
		}

		addLog(`📊 Found ${notifications?.length || 0} total active notifications`);

		// Filter by day first
		const todaysNotifications =
			notifications?.filter((notification: WeeklyNotification) => {
				return checkDayMatch(notification.day_of_week, currentDayOfWeek, currentDayName);
			}) || [];

		addLog(`📅 Found ${todaysNotifications.length} notifications for today`);

		if (todaysNotifications.length === 0) {
			addLog('❌ No notifications found for today');
			return;
		}

		// Filter notifications by time with improved window (10 minutes instead of 1)
		const matchingNotifications = [];

		for (const notification of todaysNotifications) {
			const notificationTime = notification.time;
			const timeDiff = Math.abs(timeToMinutes(currentTime) - timeToMinutes(notificationTime));

			addLog(`⏰ Time diff for ${notification.id}: ${timeDiff} minutes (Current: ${currentTime}, Notification: ${notificationTime})`);

			// Skip if time difference is too large (15 minutes for maximum reliability with cron delays)
			if (timeDiff > 15) {
				addLog(`⏭️ Skipping ${notification.id} - outside 15-minute window (${timeDiff} min diff)`);
				continue;
			}

			// Check if this notification was recently sent (using database with smart cooldown)
			const wasRecentlySent = await checkRecentlySent(supabase, notification.id, timeDiff);

			if (wasRecentlySent) {
				addLog(`⏳ Skipping ${notification.id} - sent recently or duplicate cron`);
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

async function checkRecentlySent(supabase: any, notificationId: string, timeDiff: number): Promise<boolean> {
	try {
		// Smart cooldown based on timing accuracy
		// If we're very close to the scheduled time (0-2 minutes), use shorter cooldown
		// If we're further away (3-15 minutes), use longer cooldown to prevent cron overlap
		const cooldownMinutes = timeDiff <= 2 ? 5 : 15;
		const cooldownTime = new Date(Date.now() - cooldownMinutes * 60 * 1000).toISOString();

		const { data: recentSent, error } = await supabase
			.from('sent_notifications')
			.select('sent_at')
			.eq('notification_id', notificationId)
			.gte('sent_at', cooldownTime)
			.limit(1)
			.execute();

		if (error) {
			console.error('Error checking sent status:', error);
			return false; // If we can't check, proceed to send (fail-safe)
		}

		const wasSentRecently = recentSent && recentSent.length > 0;

		if (wasSentRecently) {
			const lastSentAt = recentSent[0].sent_at;
			const minutesAgo = Math.round((Date.now() - new Date(lastSentAt).getTime()) / (60 * 1000));
			addLog(`📍 Notification ${notificationId} was sent ${minutesAgo} minutes ago (cooldown: ${cooldownMinutes} min)`);
		}

		return wasSentRecently;
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
			const { error: insertError } = await supabase.from('sent_notifications').insert({
				notification_id: notificationId,
				sent_at: new Date().toISOString(),
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
		const { data: connectionTest, error: connectionError } = await supabase.from('weekly_notifications').select('count').limit(1).execute();

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
			.order('time', { ascending: true })
			.execute();

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

		// 5. Notification 20 minutes from now (should NOT trigger - outside window)
		const twentyMinutesLater = new Date(kstTime.getTime() + 20 * 60 * 1000);
		const twentyMinutesLaterTime = formatTime(twentyMinutesLater).substring(0, 8);
		testNotifications.push({
			message: `⏰ Test notification - 20 min future (${twentyMinutesLaterTime}) - Should NOT send`,
			day_of_week: currentDayOfWeek,
			time: twentyMinutesLaterTime,
			is_active: true,
		});

		// Insert all test notifications
		const { data, error } = await supabase.from('weekly_notifications').insert(testNotifications);

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
		const { data, error } = await supabase.from('weekly_notifications').like('message', '%Test notification%').delete();

		if (error) {
			return new Response(`Error cleaning up test notifications: ${error.message}`, { status: 500 });
		}

		const deletedCount = data?.length || 0;

		// Also clean up old sent_notifications records  
		const oldTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
		const { error: sentError } = await supabase.from('sent_notifications').lt('sent_at', oldTime).delete();

		let response = `🧹 Cleanup completed!\n\n`;
		response += `✅ Deleted ${deletedCount} test notifications\n`;
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
		const { data, error } = await supabase.from('weekly_notifications').insert(debugNotifications);

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

	let logsInfo = `=== WORKER EXECUTION LOGS (Last ${executionLogs.length}) ===\n\n`;

	if (executionLogs.length === 0) {
		logsInfo += 'No logs available yet. Worker may not have run or been restarted.\n\n';
		logsInfo += 'Try:\n';
		logsInfo += '1. Visit /test to trigger a manual check\n';
		logsInfo += '2. Visit /create-test-now to create a test notification\n';
		logsInfo += '3. Wait for the cron job to run (every minute)\n';
	} else {
		executionLogs.forEach((log) => {
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
		const { data, error } = await supabase.from('weekly_notifications').like('message', '%Debug notification%').delete();

		if (error) {
			return new Response(`Error cleaning up debug notifications: ${error.message}`, { status: 500 });
		}

		const deletedCount = data?.length || 0;

		let response = `🧹 Debug cleanup completed!\n\n`;
		response += `✅ Deleted ${deletedCount} debug notifications\n`;
		response += `🔥 All debug notifications have been removed\n\n`;
		response += `The worker will no longer send duplicate debug messages.`;

		return new Response(response, { status: 200 });
	} catch (e) {
		return new Response(`Error: ${e instanceof Error ? e.message : 'Unknown'}`, { status: 500 });
	}
}
