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

	/**
	 * Create a query builder for a table
	 */
	from(table: string) {
		return new QueryBuilder(this.url, this.key, table);
	}
}

class QueryBuilder {
	private url: string;
	private key: string;
	private table: string;
	private selectColumns: string = '*';
	private whereConditions: Array<{ column: string; operator: string; value: any }> = [];
	private orderByClause: { column: string; ascending: boolean } | null = null;
	private limitValue: number | null = null;

	constructor(url: string, key: string, table: string) {
		this.url = url;
		this.key = key;
		this.table = table;
	}

	/**
	 * Specify columns to select
	 */
	select(columns: string = '*') {
		this.selectColumns = columns;
		return this;
	}

	/**
	 * Add equality condition
	 */
	eq(column: string, value: any) {
		this.whereConditions.push({ column, operator: 'eq', value });
		return this;
	}

	/**
	 * Add greater than condition
	 */
	gt(column: string, value: any) {
		this.whereConditions.push({ column, operator: 'gt', value });
		return this;
	}

	/**
	 * Add less than condition
	 */
	lt(column: string, value: any) {
		this.whereConditions.push({ column, operator: 'lt', value });
		return this;
	}

	/**
	 * Add ordering
	 */
	order(column: string, options: { ascending?: boolean } = {}) {
		this.orderByClause = { column, ascending: options.ascending !== false };
		return this;
	}

	/**
	 * Add limit
	 */
	limit(count: number) {
		this.limitValue = count;
		return this;
	}

	/**
	 * Execute the query
	 */
	async execute(): Promise<SupabaseResponse<any>> {
		let url = `${this.url}/rest/v1/${this.table}`;
		const params = new URLSearchParams();

		// Add select
		if (this.selectColumns !== '*') {
			params.append('select', this.selectColumns);
		}

		// Add where conditions
		this.whereConditions.forEach(condition => {
			params.append(condition.column, `${condition.operator}.${condition.value}`);
		});

		// Add order
		if (this.orderByClause) {
			const direction = this.orderByClause.ascending ? 'asc' : 'desc';
			params.append('order', `${this.orderByClause.column}.${direction}`);
		}

		// Add limit
		if (this.limitValue) {
			params.append('limit', this.limitValue.toString());
		}

		if (params.toString()) {
			url += '?' + params.toString();
		}

		try {
			const response = await fetch(url, {
				method: 'GET',
				headers: {
					'apikey': this.key,
					'Authorization': `Bearer ${this.key}`,
					'Content-Type': 'application/json',
				},
			});

			if (!response.ok) {
				return {
					data: null,
					error: { 
						message: `HTTP ${response.status}: ${response.statusText}`,
						details: await response.text()
					}
				};
			}

			const data = await response.json();
			return { data, error: null };
		} catch (error) {
			return {
				data: null,
				error: { 
					message: error instanceof Error ? error.message : 'Unknown error',
					details: error 
				}
			};
		}
	}

	/**
	 * Insert data
	 */
	async insert(data: any): Promise<SupabaseResponse<any>> {
		const url = `${this.url}/rest/v1/${this.table}`;

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
				return {
					data: null,
					error: { 
						message: `HTTP ${response.status}: ${response.statusText}`,
						details: await response.text()
					}
				};
			}

			const responseData = await response.json();
			return { data: responseData, error: null };
		} catch (error) {
			return {
				data: null,
				error: { 
					message: error instanceof Error ? error.message : 'Unknown error',
					details: error 
				}
			};
		}
	}

	/**
	 * Update data
	 */
	async update(data: any): Promise<SupabaseResponse<any>> {
		let url = `${this.url}/rest/v1/${this.table}`;
		const params = new URLSearchParams();

		// Add where conditions for update
		this.whereConditions.forEach(condition => {
			params.append(condition.column, `${condition.operator}.${condition.value}`);
		});

		if (params.toString()) {
			url += '?' + params.toString();
		}

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
				return {
					data: null,
					error: { 
						message: `HTTP ${response.status}: ${response.statusText}`,
						details: await response.text()
					}
				};
			}

			const responseData = await response.json();
			return { data: responseData, error: null };
		} catch (error) {
			return {
				data: null,
				error: { 
					message: error instanceof Error ? error.message : 'Unknown error',
					details: error 
				}
			};
		}
	}
}

/**
 * Create a Supabase client instance
 */
export function createClient(url: string, key: string): SimpleSupabaseClient {
	return new SimpleSupabaseClient(url, key);
}
