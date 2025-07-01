/**
 * Self-contained Supabase client implementation
 * Replaces @supabase/supabase-js to avoid bundling issues
 */

import type { SupabaseResponse } from '../../types';

export class SimpleSupabaseClient {
	private url: string;
	private key: string;

	constructor(url: string, key: string) {
		this.url = url;
		this.key = key;
	}

	async select(table: string, filters: Record<string, any> = {}, columns: string = '*', orderBy?: { column: string, ascending?: boolean }, limit?: number): Promise<SupabaseResponse<any>> {
		let url = `${this.url}/rest/v1/${table}`;
		const params = new URLSearchParams();
		if (columns !== '*') params.append('select', columns);
		Object.entries(filters).forEach(([column, value]) => {
			params.append(column, `eq.${value}`);
		});
		if (orderBy) {
			const direction = orderBy.ascending === false ? 'desc' : 'asc';
			params.append('order', `${orderBy.column}.${direction}`);
		}
		if (limit) params.append('limit', limit.toString());
		if (params.toString()) url += '?' + params.toString();
		try {
			const response = await fetch(url, {
				headers: {
					'apikey': this.key,
					'Authorization': `Bearer ${this.key}`,
					'Content-Type': 'application/json',
				},
			});
			if (!response.ok) {
				return { data: null, error: { message: `HTTP ${response.status}: ${response.statusText}`, details: await response.text() } };
			}
			const data = await response.json();
			return { data, error: null };
		} catch (error) {
			return { data: null, error: { message: error instanceof Error ? error.message : 'Unknown error', details: error } };
		}
	}

	async insert(table: string, data: any): Promise<SupabaseResponse<any>> {
		const url = `${this.url}/rest/v1/${table}`;
		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'apikey': this.key,
					'Authorization': `Bearer ${this.key}`,
					'Content-Type': 'application/json',
					'Prefer': 'return=representation',
				},
				body: JSON.stringify(data),
			});
			if (!response.ok) {
				return { data: null, error: { message: `HTTP ${response.status}: ${response.statusText}`, details: await response.text() } };
			}
			const responseData = await response.json();
			return { data: responseData, error: null };
		} catch (error) {
			return { data: null, error: { message: error instanceof Error ? error.message : 'Unknown error', details: error } };
		}
	}

	async update(table: string, filters: Record<string, any>, data: any): Promise<SupabaseResponse<any>> {
		let url = `${this.url}/rest/v1/${table}`;
		const params = new URLSearchParams();
		Object.entries(filters).forEach(([column, value]) => {
			params.append(column, `eq.${value}`);
		});
		if (params.toString()) url += '?' + params.toString();
		try {
			const response = await fetch(url, {
				method: 'PATCH',
				headers: {
					'apikey': this.key,
					'Authorization': `Bearer ${this.key}`,
					'Content-Type': 'application/json',
					'Prefer': 'return=representation',
				},
				body: JSON.stringify(data),
			});
			if (!response.ok) {
				return { data: null, error: { message: `HTTP ${response.status}: ${response.statusText}`, details: await response.text() } };
			}
			const responseData = await response.json();
			return { data: responseData, error: null };
		} catch (error) {
			return { data: null, error: { message: error instanceof Error ? error.message : 'Unknown error', details: error } };
		}
	}

	async delete(table: string, filters: Record<string, any>): Promise<SupabaseResponse<any>> {
		let url = `${this.url}/rest/v1/${table}`;
		const params = new URLSearchParams();
		Object.entries(filters).forEach(([column, value]) => {
			params.append(column, `eq.${value}`);
		});
		if (params.toString()) url += '?' + params.toString();
		try {
			const response = await fetch(url, {
				method: 'DELETE',
				headers: {
					'apikey': this.key,
					'Authorization': `Bearer ${this.key}`,
					'Content-Type': 'application/json',
					'Prefer': 'return=representation',
				},
			});
			if (!response.ok) {
				return { data: null, error: { message: `HTTP ${response.status}: ${response.statusText}`, details: await response.text() } };
			}
			const responseData = await response.json();
			return { data: responseData, error: null };
		} catch (error) {
			return { data: null, error: { message: error instanceof Error ? error.message : 'Unknown error', details: error } };
		}
	}
}

/**
 * Create a Supabase client instance
 */
export function createClient(url: string, key: string): SimpleSupabaseClient {
	return new SimpleSupabaseClient(url, key);
}
