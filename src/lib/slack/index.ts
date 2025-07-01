/**
 * Slack notification utilities
 */

import type { Env } from '../../types';
import { addLog } from '../utils';
import { createClient } from '../database/supabase';

/**
 * Send a Slack notification via webhook and track it in the database
 */
export async function sendSlackNotification(env: Env, message: string, notificationId: string): Promise<void> {
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
			const { error: insertError } = await supabase.insert('sent_notifications', {
				notification_id: notificationId,
				message,
				time: new Date().toTimeString().split(' ')[0],
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
