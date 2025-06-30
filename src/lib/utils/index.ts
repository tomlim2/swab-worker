/**
 * Utility functions for the Slack Weekly Notification Worker
 */

import { MAX_LOGS } from '../../constants';

// Simple log storage (in-memory)
const executionLogs: string[] = [];

/**
 * Add a log entry with timestamp
 */
export function addLog(message: string): void {
	const timestamp = new Date().toISOString();
	const logEntry = `[${timestamp}] ${message}`;
	executionLogs.unshift(logEntry);
	if (executionLogs.length > MAX_LOGS) {
		executionLogs.pop();
	}
	console.log(logEntry);
}

/**
 * Get all execution logs
 */
export function getExecutionLogs(): string[] {
	return [...executionLogs];
}

/**
 * Clear all execution logs
 */
export function clearExecutionLogs(): void {
	executionLogs.length = 0;
}

/**
 * Get Korean Standard Time (UTC+9)
 */
export function getKSTTime(): Date {
	const now = new Date();
	const kstOffset = 9 * 60; // 9 hours in minutes
	return new Date(now.getTime() + kstOffset * 60 * 1000);
}

/**
 * Format time consistently as HH:MM:SS
 */
export function formatTime(date: Date): string {
	return date.toTimeString().split(' ')[0]; // HH:MM:SS
}

/**
 * Check if database day matches current day (supports both number and name formats)
 */
export function checkDayMatch(dbDay: string, currentDayNumber: string, currentDayName: string): boolean {
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

/**
 * Convert time string (HH:MM:SS) to minutes since midnight
 */
export function timeToMinutes(timeString: string): number {
	const [hours, minutes] = timeString.split(':').map(Number);
	return hours * 60 + minutes;
}
