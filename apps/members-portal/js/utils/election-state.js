/**
 * Election State Manager
 *
 * Centralized state management for election schedule and status.
 * Provides real-time synchronization between admin controls and member display.
 *
 * Events:
 * - 'status-changed': Fired when election status changes
 * - 'schedule-changed': Fired when start/end times change
 * - 'countdown-tick': Fired every second during active election
 */

import { debug } from './debug.js';
import { DEFAULT_DURATION_MINUTES } from './election-constants.js';

class ElectionState extends EventTarget {
  constructor() {
    super();

    // Current election state
    this.state = {
      id: null,
      status: 'upcoming', // 'upcoming' | 'active' | 'closed'
      voting_starts_at: null,
      voting_ends_at: null,
      duration_minutes: DEFAULT_DURATION_MINUTES, // Default: 2 minutes (from shared constants)
      title: '',
      question: '',
      has_voted: false
    };

    // Countdown interval
    this.countdownInterval = null;

    // Bind methods
    this.updateStatus = this.updateStatus.bind(this);
    this.updateSchedule = this.updateSchedule.bind(this);
    this.startNow = this.startNow.bind(this);
    this.closeNow = this.closeNow.bind(this);
    this.getTimeRemaining = this.getTimeRemaining.bind(this);
  }

  /**
   * Initialize state with election data
   * @param {Object} election - Election data from API
   */
  initialize(election) {
    this.state = {
      id: election.id,
      status: election.status,
      voting_starts_at: election.voting_starts_at || election.scheduled_start,
      voting_ends_at: election.voting_ends_at || election.scheduled_end,
      duration_minutes: this.calculateDuration(
        election.voting_starts_at || election.scheduled_start,
        election.voting_ends_at || election.scheduled_end
      ),
      title: election.title,
      question: election.question,
      has_voted: election.has_voted || false
    };

    debug.log('Election state initialized:', this.state);

    // Start countdown if active
    if (this.state.status === 'active') {
      this.startCountdown();
    }

    // Dispatch initial event
    this.dispatchEvent(new CustomEvent('initialized', { detail: this.state }));
  }

  /**
   * Calculate duration in minutes between two dates
   * @param {string} start - ISO date string
   * @param {string} end - ISO date string
   * @returns {number} Duration in minutes
   */
  calculateDuration(start, end) {
    if (!start || !end) return 60;
    const startDate = new Date(start);
    const endDate = new Date(end);
    return Math.round((endDate - startDate) / 1000 / 60);
  }

  /**
   * Update election status
   * @param {string} newStatus - 'upcoming' | 'active' | 'closed'
   */
  updateStatus(newStatus) {
    const oldStatus = this.state.status;
    this.state.status = newStatus;

    debug.log(`Election status changed: ${oldStatus} → ${newStatus}`);

    // Start/stop countdown based on status
    if (newStatus === 'active') {
      this.startCountdown();
    } else {
      this.stopCountdown();
    }

    this.dispatchEvent(new CustomEvent('status-changed', {
      detail: {
        oldStatus,
        newStatus,
        state: this.state
      }
    }));
  }

  /**
   * Update election schedule
   * @param {Object} options - Schedule options
   * @param {Date|string} options.startDate - Start date/time
   * @param {number} options.durationMinutes - Duration in minutes
   */
  updateSchedule({ startDate, durationMinutes }) {
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    this.state.voting_starts_at = start.toISOString();
    this.state.voting_ends_at = end.toISOString();
    this.state.duration_minutes = durationMinutes;

    debug.log('Election schedule updated:', {
      starts: this.state.voting_starts_at,
      ends: this.state.voting_ends_at,
      duration: durationMinutes
    });

    this.dispatchEvent(new CustomEvent('schedule-changed', {
      detail: {
        voting_starts_at: this.state.voting_starts_at,
        voting_ends_at: this.state.voting_ends_at,
        duration_minutes: durationMinutes
      }
    }));
  }

  /**
   * Start election immediately
   * @param {number} durationMinutes - Duration in minutes
   */
  async startNow(durationMinutes = 60) {
    const now = new Date();
    const end = new Date(now.getTime() + durationMinutes * 60 * 1000);

    this.state.voting_starts_at = now.toISOString();
    this.state.voting_ends_at = end.toISOString();
    this.state.duration_minutes = durationMinutes;

    // Update status to active
    this.updateStatus('active');

    debug.log('Election started immediately:', {
      starts: this.state.voting_starts_at,
      ends: this.state.voting_ends_at,
      duration: durationMinutes
    });

    // TODO(#283): Call Admin Elections API to persist state to server
    // await ElectionsAdminAPI.openElection(this.state.id);

    this.dispatchEvent(new CustomEvent('started', {
      detail: this.state
    }));
  }

  /**
   * Close election immediately
   */
  async closeNow() {
    const now = new Date();
    this.state.voting_ends_at = now.toISOString();

    // Update status to closed
    this.updateStatus('closed');

    debug.log('Election closed immediately');

    // TODO(#283): Call Admin Elections API to persist state to server
    // await ElectionsAdminAPI.closeElection(this.state.id);

    this.dispatchEvent(new CustomEvent('closed', {
      detail: this.state
    }));
  }

  /**
   * Get time remaining in election (if active)
   * @returns {Object|null} Time remaining object or null
   */
  getTimeRemaining() {
    if (this.state.status !== 'active' || !this.state.voting_ends_at) {
      return null;
    }

    const now = new Date();
    const end = new Date(this.state.voting_ends_at);
    const diff = end - now;

    if (diff <= 0) {
      // Election should be closed
      this.updateStatus('closed');
      return null;
    }

    const hours = Math.floor(diff / 1000 / 60 / 60);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    return {
      total: diff,
      hours,
      minutes,
      seconds,
      formatted: `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
      humanReadable: this.formatHumanReadable(hours, minutes, seconds)
    };
  }

  /**
   * Format time remaining in human-readable Icelandic
   * @param {number} hours - Hours
   * @param {number} minutes - Minutes
   * @param {number} seconds - Seconds
   * @returns {string} Human-readable string
   */
  formatHumanReadable(hours, minutes, seconds) {
    if (hours > 0) {
      return `${hours} klst ${minutes} mín eftir`;
    } else if (minutes > 0) {
      return `${minutes} mínútur eftir`;
    } else {
      return `${seconds} sekúndur eftir`;
    }
  }

  /**
   * Start countdown timer (fires every second)
   */
  startCountdown() {
    // Clear existing interval
    this.stopCountdown();

    // Fire immediately
    const remaining = this.getTimeRemaining();
    if (remaining) {
      this.dispatchEvent(new CustomEvent('countdown-tick', {
        detail: remaining
      }));
    }

    // Start interval
    this.countdownInterval = setInterval(() => {
      const remaining = this.getTimeRemaining();

      if (remaining) {
        this.dispatchEvent(new CustomEvent('countdown-tick', {
          detail: remaining
        }));
      } else {
        // Time's up, stop countdown
        this.stopCountdown();
      }
    }, 1000);

    debug.log('Countdown timer started');
  }

  /**
   * Stop countdown timer
   */
  stopCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
      debug.log('Countdown timer stopped');
    }
  }

  /**
   * Get current state
   * @returns {Object} Current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Check if user has voted
   * @returns {boolean} True if user has voted
   */
  hasVoted() {
    return this.state.has_voted;
  }

  /**
   * Mark that user has voted
   */
  markVoted() {
    this.state.has_voted = true;
    this.dispatchEvent(new CustomEvent('voted', {
      detail: this.state
    }));
  }
}

// Export singleton instance
export const electionState = new ElectionState();
