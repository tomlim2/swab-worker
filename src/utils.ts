import type { WeeklyNotification, SupabaseResponse } from './types';

/**
 * Convert time string (HH:MM:SS) to minutes
 */
export function timeToMinutes(timeString: string): number {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Create a real Supabase client using fetch API
 */
export function createSupabaseClient(url: string, key: string) {
  const baseUrl = `${url}/rest/v1`;
  
  return {
    from: (table: string) => ({
      select: (columns: string = '*') => ({
        then: async (): Promise<SupabaseResponse<WeeklyNotification[]>> => {
          const queryParams = new URLSearchParams({
            select: columns
          });
          
          const response = await fetch(`${baseUrl}/${table}?${queryParams}`, {
            method: 'GET',
            headers: {
              'apikey': key,
              'Authorization': `Bearer ${key}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            }
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Supabase query error: ${response.status} ${response.statusText} - ${errorText}`);
            return { data: null, error: { message: errorText } };
          }
          
          const data = await response.json() as WeeklyNotification[];
          return { data, error: null };
        },
        eq: (column: string, value: any) => ({
          then: async (): Promise<SupabaseResponse<WeeklyNotification[]>> => {
            const queryParams = new URLSearchParams({
              [`${column}`]: `eq.${value}`,
              select: columns
            });
            
            const response = await fetch(`${baseUrl}/${table}?${queryParams}`, {
              method: 'GET',
              headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              }
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error(`Supabase query error: ${response.status} ${response.statusText} - ${errorText}`);
              return { data: null, error: { message: errorText } };
            }
            
            const data = await response.json() as WeeklyNotification[];
            return { data, error: null };
          },
          eq: (col2: string, val2: any) => ({
            eq: (col3: string, val3: any) => ({
              then: async (): Promise<SupabaseResponse<WeeklyNotification[]>> => {
                const queryParams = new URLSearchParams({
                  [`${column}`]: `eq.${value}`,
                  [`${col2}`]: `eq.${val2}`,
                  [`${col3}`]: `eq.${val3}`,
                  select: columns
                });
                
                const response = await fetch(`${baseUrl}/${table}?${queryParams}`, {
                  method: 'GET',
                  headers: {
                    'apikey': key,
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                  }
                });
                
                if (!response.ok) {
                  const errorText = await response.text();
                  console.error(`Supabase query error: ${response.status} ${response.statusText} - ${errorText}`);
                  return { data: null, error: { message: errorText } };
                }
                
                const data = await response.json() as WeeklyNotification[];
                return { data, error: null };
              }
            }),
            then: async (): Promise<SupabaseResponse<WeeklyNotification[]>> => {
              const queryParams = new URLSearchParams({
                [`${column}`]: `eq.${value}`,
                [`${col2}`]: `eq.${val2}`,
                select: columns
              });
              
              const response = await fetch(`${baseUrl}/${table}?${queryParams}`, {
                method: 'GET',
                headers: {
                  'apikey': key,
                  'Authorization': `Bearer ${key}`,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=representation'
                }
              });
              
              if (!response.ok) {
                const errorText = await response.text();
                console.error(`Supabase query error: ${response.status} ${response.statusText} - ${errorText}`);
                return { data: null, error: { message: errorText } };
              }
              
              const data = await response.json() as WeeklyNotification[];
              return { data, error: null };
            }
          })
        })
      }),
      update: (data: any) => ({
        eq: (column: string, value: any) => ({
          then: async (): Promise<SupabaseResponse<any>> => {
            const queryParams = new URLSearchParams({
              [`${column}`]: `eq.${value}`
            });
            
            const response = await fetch(`${baseUrl}/${table}?${queryParams}`, {
              method: 'PATCH',
              headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify(data)
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error(`Supabase update error: ${response.status} ${response.statusText} - ${errorText}`);
              return { data: null, error: { message: errorText } };
            }
            
            const result = await response.json();
            return { data: result, error: null };
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