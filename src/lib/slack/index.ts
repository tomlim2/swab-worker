/**
 * Slack notification utilities
 */

import type { Env, WeeklyNotification } from '../../types';
import { addLog } from '../utils';
import { createClient } from '../database/supabase';

/**
 * Check if a notification is a test/debug notification
 */
function isTestNotification(notification: WeeklyNotification): boolean {
	const message = notification.message;
	return message.includes('Test notification') || message.includes('Debug notification');
}

/**
 * Send a Slack notification via webhook and track it in the database
 */
export async function sendSlackNotification(env: Env, notification: WeeklyNotification, forceTestWebhook?: boolean): Promise<void> {
	let message = notification.message;
	if (message.includes('[branch_version]')) {
		message = message.replace(/\[branch_version\]/g, notification.branch_version || '');
	}
	if (message.includes('[emoji_this_week]')) {
		message = message.replace(/\[emoji_this_week\]/g, notification.emoji_this_week || '');
	}

	// Automatically use test webhook for test/debug notifications, or use forceTestWebhook parameter
	const useTestWebhook = forceTestWebhook !== undefined ? forceTestWebhook : isTestNotification(notification);
	
	// Choose webhook URL based on test flag
	const webhookUrl = useTestWebhook ? env.SLACK_WEBHOOK_URL_TEST : env.SLACK_WEBHOOK_URL;
	const webhookType = useTestWebhook ? 'TEST' : 'PRODUCTION';
	
	addLog(`📡 Attempting to send ${webhookType} Slack notification: ${message}`);

	if (!webhookUrl) {
		const missingVar = useTestWebhook ? 'SLACK_WEBHOOK_URL_TEST' : 'SLACK_WEBHOOK_URL';
		addLog(`❌ ${missingVar} not configured`);
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
				username: useTestWebhook ? 'Weekly Notification Bot (TEST)' : 'Weekly Notification Bot',
				icon_emoji: useTestWebhook ? ':test_tube:' : ':bell:',
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			addLog(`❌ Failed to send ${webhookType} Slack notification: ${response.status} ${response.statusText} ${errorText}`);
			return;
		}

		addLog(`✅ ${webhookType} Slack notification sent successfully: ${message}`);

		// Track sent notification in the database
		const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

		try {
			const { error: insertError } = await supabase.insert('sent_notifications', {
				notification_id: notification.id,
				message,
				time: new Date().toTimeString().split(' ')[0],
				sent_at: new Date().toISOString(),
			});

			if (insertError) {
				console.error('Error tracking sent notification:', insertError);
				addLog(`⚠️ Could not track sent notification in database: ${insertError.message}`);
			} else {
				addLog(`✅ Notification tracked in database: ${notification.id}`);
			}
		} catch (e) {
			addLog(`❌ Error tracking notification: ${e instanceof Error ? e.message : 'Unknown error'}`);
		}
	} catch (error) {
		addLog(`❌ Error sending Slack notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}
