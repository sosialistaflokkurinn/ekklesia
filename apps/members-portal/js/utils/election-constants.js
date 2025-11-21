/**
 * Election Constants
 * 
 * Shared constants for election management across the application.
 * Per commit 50cf8d9: Duration options aligned with real meeting patterns.
 * 
 * Usage:
 *   import { DURATION_PRESETS } from '../utils/election-constants.js';
 * 
 * @module utils/election-constants
 */

/**
 * Duration presets for in-person meeting voting
 * 
 * Based on USAGE_CONTEXT.md:
 * - Real meetings: 300 votes complete in 3-5 seconds
 * - User feedback: "2 mín í fundarsal er meira en nægur tími"
 * - Changed from 15/30/60/90/120 minutes to 1/2/3 minutes
 * 
 * @type {Array<{value: number|string, label: string}>}
 * @constant
 */
export const DURATION_PRESETS = [
  { value: 1, label: '1 mín' },
  { value: 2, label: '2 mín' },
  { value: 3, label: '3 mín' },
  { value: 'custom', label: 'Sérsníða' }
];

/**
 * Default voting duration in minutes
 * 
 * 2 minutes is sufficient for in-person meeting voting
 * where 300 votes typically complete in 3-5 seconds.
 * 
 * @type {number}
 * @constant
 */
export const DEFAULT_DURATION_MINUTES = 2;

/**
 * Minimum custom duration in minutes
 * Per commit e5d9811: Reduced from 5 to 1 minute
 * 
 * @type {number}
 * @constant
 */
export const MIN_DURATION_MINUTES = 1;

/**
 * Maximum custom duration in minutes (7 days)
 * 
 * @type {number}
 * @constant
 */
export const MAX_DURATION_MINUTES = 7 * 24 * 60; // 10080 minutes = 7 days

/**
 * Voting window completion statistics (from USAGE_CONTEXT.md)
 * 
 * @type {Object}
 * @property {number} typical_votes - Typical number of votes in meeting
 * @property {number} completion_seconds_min - Min completion time
 * @property {number} completion_seconds_max - Max completion time
 * @constant
 */
export const VOTING_STATS = {
  typical_votes: 300,
  completion_seconds_min: 3,
  completion_seconds_max: 5
};

/**
 * Format duration for display
 * Consistent formatting across all components
 * 
 * @param {number} minutes - Duration in minutes
 * @returns {string} Formatted string (e.g., "2 mín", "1 klukkustund")
 */
export function formatDuration(minutes) {
  if (minutes < 60) {
    return `${minutes} mín`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    if (hours === 1) {
      return '1 klukkustund';
    }
    return `${hours} klukkustundir`;
  }
  
  if (hours === 1) {
    return `1 klukkustund og ${remainingMinutes} mín`;
  }
  
  return `${hours} klukkustundir og ${remainingMinutes} mín`;
}
