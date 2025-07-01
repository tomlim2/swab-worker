/**
 * Route handlers for the Slack Weekly Notification Worker
 */

import type { Env, WeeklyNotification } from '../../types';
import { addLog, getKSTTime, formatTime, checkDayMatch, timeToMinutes } from '../utils';
import { createClient } from '../database/supabase';
import { sendSlackNotification } from '../slack';

/**
 * Run the main notification check logic
 */
export async function runNotificationCheck(env: Env): Promise<void> {
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
		// Fetch all active notifications that have not been sent this week
		const { data: notifications, error } = await supabase.select('weekly_notifications', { is_active: true, sent_this_week: false });

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

		// Filter notifications by time with improved window (10 minutes)
		const matchingNotifications = [];

		for (const notification of todaysNotifications) {
			const notificationTime = notification.time;
			const timeDiff = Math.abs(timeToMinutes(currentTime) - timeToMinutes(notificationTime));

			addLog(`⏰ Time diff for ${notification.id}: ${timeDiff} minutes (Current: ${currentTime}, Notification: ${notificationTime})`);

			// Only send if within a 10-minute window
			if (timeDiff > 10) {
				addLog(`⏭️ Skipping ${notification.id} - outside 10-minute window (${timeDiff} min diff)`);
				continue;
			}

			matchingNotifications.push(notification);
		}

		addLog(`🎯 Found ${matchingNotifications.length} matching notifications to send`);

		// Send Slack notifications and set sent_this_week to true
		for (const notification of matchingNotifications) {
			try {
				await sendSlackNotification(env, notification.message, notification.id);
				await supabase.update('weekly_notifications', { id: notification.id }, { sent_this_week: true });
				addLog(`✅ Marked notification ${notification.id} as sent_this_week=true`);
			} catch (error) {
				addLog(`❌ Failed to send notification ${notification.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}
	} catch (error) {
		console.error('Unexpected error in runNotificationCheck:', error);
		addLog(`❌ Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

/**
 * Check if a notification was recently sent (with smart cooldown)
 */
export async function checkRecentlySent(supabase: any, notificationId: string, timeDiff: number): Promise<boolean> {
	try {
		// Smart cooldown based on timing accuracy
		// If we're very close to the scheduled time (0-2 minutes), use shorter cooldown
		// If we're further away (3-15 minutes), use longer cooldown to prevent cron overlap
		const cooldownMinutes = timeDiff <= 2 ? 5 : 15;
		const cooldownTime = new Date(Date.now() - cooldownMinutes * 60 * 1000).toISOString();

		const { data: recentSent, error } = await supabase
			.select('sent_notifications', {
				filter: {
					notification_id: notificationId,
					sent_at: {
						_gte: cooldownTime
					}
				},
				limit: 1
			});

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

async function checkRecentlySentWeekly(supabase: any, message: string, time: string): Promise<boolean> {
	try {
		const cooldownMinutes = 10000;
		const cooldownTime = new Date(Date.now() - cooldownMinutes * 60 * 1000).toISOString();
		const { data: recentSent, error } = await supabase
			.select('sent_notifications', {
				filter: {
					message: message,
					time: time,
					sent_at: {
						_gte: cooldownTime
					}
				},
				limit: 1
			});
		if (error) {
			console.error('Error checking sent status:', error);
			return false;
		}
		return recentSent && recentSent.length > 0;
	} catch (e) {
		console.error('Exception checking sent status:', e);
		return false;
	}
}

// Add reset logic to be called in the scheduled worker
export async function resetSentThisWeek(env: Env): Promise<void> {
	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	try {
		await supabase.update('weekly_notifications', {}, { sent_this_week: false });
		addLog('🔄 Reset sent_this_week for all notifications');
	} catch (error) {
		addLog(`❌ Failed to reset sent_this_week: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}
