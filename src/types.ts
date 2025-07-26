export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SLACK_WEBHOOK_URL_DEV: string;
  SLACK_WEBHOOK_URL: string;
  ENVIRONMENT: string;
}

export interface WeeklyNotification {
  id: string;
  message: string;
  day_of_week: number;
  time: string;
  is_active: boolean;
  sent_this_week: boolean;
  emoji_this_week: string;
  branch_version?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SupabaseResponse<T> {
  data: T | null;
  error: any;
} 