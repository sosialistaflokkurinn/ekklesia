/**
 * Date Utility Functions
 * 
 * Centralized date formatting utilities for admin elections area.
 * Provides consistent date/time formatting across all admin pages.
 * 
 * @module admin-elections/js/date-utils
 */

/**
 * Format date for display (short format with time)
 * Uses manual Icelandic formatting to ensure consistency across all browsers
 * 
 * @param {string|Date} dateString - ISO date string or Date object
 * @returns {string} Formatted date string in format "DD. mmm. YYYY, HH:MM" or "-" if invalid
 * 
 * @example
 * formatDate('2025-11-17T14:30:00Z') // "17. nóv. 2025, 14:30"
 * formatDate(null) // "-"
 */
export function formatDate(dateString) {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  
  // Icelandic month abbreviations
  const months = ['jan.', 'feb.', 'mar.', 'apr.', 'maí', 'jún.', 'júl.', 'ág.', 'sep.', 'okt.', 'nóv.', 'des.'];
  
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${day}. ${month} ${year}, ${hours}:${minutes}`;
}

/**
 * Format date/time for display (long format with time)
 * Uses manual Icelandic formatting to ensure consistency across all browsers
 * 
 * @param {string|Date} isoString - ISO date string or Date object
 * @returns {string} Formatted date string in format "DD. MMMM YYYY, HH:MM" or "-" if invalid
 * 
 * @example
 * formatDateTime('2025-11-17T14:30:00Z') // "17. nóvember 2025, 14:30"
 * formatDateTime(null) // "-"
 */
export function formatDateTime(isoString) {
  if (!isoString) return '-';
  
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '-';
  
  // Icelandic month names (full)
  const months = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'];
  
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${day}. ${month} ${year}, ${hours}:${minutes}`;
}

/**
 * Format date without time (date only)
 * 
 * @param {string|Date} dateString - ISO date string or Date object
 * @returns {string} Formatted date string in format "YYYY-MM-DD" or "-" if invalid
 * 
 * @example
 * formatDateOnly('2025-11-17T14:30:00Z') // "2025-11-17"
 * formatDateOnly(null) // "-"
 */
export function formatDateOnly(dateString) {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  
  return date.toISOString().split('T')[0];
}

/**
 * Format time for input field (HH:MM format)
 * 
 * @param {string|Date} dateString - ISO date string or Date object
 * @returns {string} Time in HH:MM format or empty string if invalid
 * 
 * @example
 * formatTimeInput('2025-11-17T14:30:00Z') // "14:30"
 * formatTimeInput(null) // ""
 */
export function formatTimeInput(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${hours}:${minutes}`;
}

/**
 * Check if date is in the past
 * 
 * @param {string|Date} dateString - ISO date string or Date object
 * @returns {boolean} True if date is in the past, false otherwise
 * 
 * @example
 * isPastDate('2020-01-01') // true
 * isPastDate('2030-01-01') // false
 */
export function isPastDate(dateString) {
  if (!dateString) return false;
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return false;
  
  return date < new Date();
}

/**
 * Get relative time description (e.g., "2 hours ago", "in 3 days")
 * 
 * @param {string|Date} dateString - ISO date string or Date object
 * @returns {string} Relative time description or "-" if invalid
 * 
 * @example
 * getRelativeTime('2025-11-17T12:00:00Z') // "2 klst. síðan" (2 hours ago)
 * getRelativeTime(null) // "-"
 */
export function getRelativeTime(dateString) {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 30) {
    return formatDate(dateString);
  } else if (diffDays > 0) {
    return `${diffDays} ${diffDays === 1 ? 'dag' : 'dagar'} síðan`;
  } else if (diffHours > 0) {
    return `${diffHours} ${diffHours === 1 ? 'klst.' : 'klst.'} síðan`;
  } else if (diffMins > 0) {
    return `${diffMins} ${diffMins === 1 ? 'mín.' : 'mín.'} síðan`;
  } else {
    return 'Rétt núna';
  }
}

/**
 * Get time remaining until a date in human-readable format
 * 
 * @param {string|Date} endDate - End date/time
 * @returns {string} Human-readable time remaining (e.g., "2 mín", "1 klst. 30 mín") or "Lokið" if passed
 * 
 * @example
 * getTimeRemaining('2025-11-17T14:32:00Z') // "2 mín" (if current time is 14:30)
 * getTimeRemaining('2025-11-17T15:30:00Z') // "1 klst." (if current time is 14:30)
 * getTimeRemaining('2025-11-17T14:00:00Z') // "Lokið" (if current time is 14:30)
 */
export function getTimeRemaining(endDate) {
  if (!endDate) return '-';
  
  const end = new Date(endDate);
  if (isNaN(end.getTime())) return '-';
  
  const now = new Date();
  const diffMs = end - now;
  
  // If election already ended
  if (diffMs <= 0) return 'Lokið';
  
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const remainingMins = diffMins % 60;
  
  // Format: "1 klst. 30 mín" or "2 mín" or "1 klst."
  if (diffHours > 0 && remainingMins > 0) {
    return `${diffHours} klst. ${remainingMins} mín`;
  } else if (diffHours > 0) {
    return `${diffHours} klst.`;
  } else {
    return `${diffMins} mín`;
  }
}
