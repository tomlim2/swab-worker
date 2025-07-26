import type { WeeklyNotification, SupabaseResponse } from './types';

/**
 * Convert time string (HH:MM:SS) to minutes
 */
export function timeToMinutes(timeString: string): number {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Create a simple Supabase client for basic operations
 */
export function createSupabaseClient(url: string, key: string) {
  return {
    from: (table: string) => ({
      select: (columns: string = '*') => ({
        eq: (column: string, value: any) => ({
          eq: (col2: string, val2: any) => ({
            eq: (col3: string, val3: any) => ({
              then: async (): Promise<SupabaseResponse<WeeklyNotification[]>> => {
                // Mock implementation - replace with actual Supabase calls
                console.log(`Querying ${table} where ${column}=${value} and ${col2}=${val2} and ${col3}=${val3}`);
                return { data: [], error: null };
              }
            })
          })
        })
      }),
      update: (data: any) => ({
        eq: (column: string, value: any) => ({
          then: async (): Promise<SupabaseResponse<any>> => {
            console.log(`Updating ${table} set ${JSON.stringify(data)} where ${column}=${value}`);
            return { data: null, error: null };
          }
        })
      })
    })
  };
}

/**
 * Get current time in KST (UTC+9)
 */
export function getKSTTime(): Date {
  const now = new Date();
  return new Date(now.getTime() + 9 * 60 * 60 * 1000);
}

/**
 * Format time as HH:MM:SS
 */
export function formatTime(date: Date): string {
  return date.toTimeString().substring(0, 8);
} 