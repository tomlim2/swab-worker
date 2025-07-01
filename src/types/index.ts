/**
 * TypeScript interfaces and types for Slack Weekly Notification Worker
 */

export interface WeeklyNotification {
	id: string;
	message: string;
	day_of_week: string;
	time: string;
	is_active: boolean;
	sent_this_week: boolean;
	branch_version?: string;
	created_at: string;
	updated_at: string;
}

export interface SentNotification {
	id: string;
	notification_id: string;
	sent_at: string;
}

export interface Env {
	SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string;
	SLACK_WEBHOOK_URL: string;
}

export interface SupabaseResponse<T> {
	data: T[] | T | null;
	error: { message: string; details?: any } | null;
}
