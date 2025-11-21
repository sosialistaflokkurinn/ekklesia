/**
 * @jest-environment jsdom
 */

import { formatDate, formatDateTime, formatDateOnly, formatTimeInput, isPastDate, getRelativeTime } from '../date-utils.js';

describe('Date Utilities', () => {
  describe('formatDate', () => {
    it('should format valid ISO date string with short month', () => {
      const result = formatDate('2025-11-17T14:30:00Z');
      expect(result).toMatch(/17\.\s*nóv\.\s*2025/);
      expect(result).toContain('14:30');
    });

    it('should return "-" for null input', () => {
      expect(formatDate(null)).toBe('-');
    });

    it('should return "-" for undefined input', () => {
      expect(formatDate(undefined)).toBe('-');
    });

    it('should return "-" for invalid date string', () => {
      expect(formatDate('invalid-date')).toBe('-');
    });

    it('should handle Date object input', () => {
      const date = new Date('2025-11-17T14:30:00Z');
      const result = formatDate(date);
      expect(result).toMatch(/17\.\s*nóv\.\s*2025/);
      expect(result).toContain('14:30');
    });
  });

  describe('formatDateTime', () => {
    it('should format valid ISO date string with long month', () => {
      const result = formatDateTime('2025-11-17T14:30:00Z');
      expect(result).toMatch(/17\.\s*nóvember\s*2025/);
      expect(result).toContain('14:30');
    });

    it('should return "-" for null input', () => {
      expect(formatDateTime(null)).toBe('-');
    });

    it('should return "-" for undefined input', () => {
      expect(formatDateTime(undefined)).toBe('-');
    });

    it('should return "-" for invalid date string', () => {
      expect(formatDateTime('invalid-date')).toBe('-');
    });
  });

  describe('formatDateOnly', () => {
    it('should format date as YYYY-MM-DD', () => {
      const result = formatDateOnly('2025-11-17T14:30:00Z');
      expect(result).toBe('2025-11-17');
    });

    it('should return "-" for null input', () => {
      expect(formatDateOnly(null)).toBe('-');
    });

    it('should return "-" for invalid date string', () => {
      expect(formatDateOnly('invalid-date')).toBe('-');
    });
  });

  describe('formatTimeInput', () => {
    it('should format time as HH:MM', () => {
      const result = formatTimeInput('2025-11-17T14:30:00Z');
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    it('should return empty string for null input', () => {
      expect(formatTimeInput(null)).toBe('');
    });

    it('should return empty string for invalid date string', () => {
      expect(formatTimeInput('invalid-date')).toBe('');
    });

    it('should pad single digit hours and minutes', () => {
      const result = formatTimeInput('2025-11-17T09:05:00Z');
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  describe('isPastDate', () => {
    it('should return true for past dates', () => {
      expect(isPastDate('2020-01-01T00:00:00Z')).toBe(true);
    });

    it('should return false for future dates', () => {
      expect(isPastDate('2030-01-01T00:00:00Z')).toBe(false);
    });

    it('should return false for null input', () => {
      expect(isPastDate(null)).toBe(false);
    });

    it('should return false for invalid date string', () => {
      expect(isPastDate('invalid-date')).toBe(false);
    });
  });

  describe('getRelativeTime', () => {
    it('should return formatted date for old dates (>30 days)', () => {
      const longAgo = new Date();
      longAgo.setDate(longAgo.getDate() - 40);
      const result = getRelativeTime(longAgo.toISOString());
      expect(result).not.toBe('-');
      expect(result).not.toMatch(/síðan/);
    });

    it('should return days ago for recent dates (within 30 days)', () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const result = getRelativeTime(twoDaysAgo.toISOString());
      expect(result).toMatch(/2 dagar síðan/);
    });

    it('should return hours ago for dates within 24 hours', () => {
      const twoHoursAgo = new Date();
      twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
      const result = getRelativeTime(twoHoursAgo.toISOString());
      expect(result).toMatch(/\d+ klst\. síðan/);
    });

    it('should return minutes ago for dates within the hour', () => {
      const tenMinAgo = new Date();
      tenMinAgo.setMinutes(tenMinAgo.getMinutes() - 10);
      const result = getRelativeTime(tenMinAgo.toISOString());
      expect(result).toMatch(/\d+ mín\. síðan/);
    });

    it('should return "Rétt núna" for very recent dates', () => {
      const justNow = new Date();
      justNow.setSeconds(justNow.getSeconds() - 30);
      const result = getRelativeTime(justNow.toISOString());
      expect(result).toBe('Rétt núna');
    });

    it('should return "-" for null input', () => {
      expect(getRelativeTime(null)).toBe('-');
    });

    it('should return "-" for invalid date string', () => {
      expect(getRelativeTime('invalid-date')).toBe('-');
    });
  });
});
