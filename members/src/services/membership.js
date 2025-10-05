/**
 * Membership Service
 *
 * Provides membership data and status for users.
 * Currently uses mock data - will be replaced with database queries.
 */

/**
 * Get membership information for a user
 * @param {string} userId - User ID from OIDC (sub claim)
 * @returns {Object} Membership data
 */
export function getMembershipData(userId) {
  // Mock data - TODO: Replace with database query
  // In production, this would query the members database

  // Generate a membership number based on user ID
  const membershipNumber = generateMembershipNumber(userId);

  // Mock different statuses for testing
  // In production, this comes from database
  const mockStatuses = [
    {
      status: 'active',
      statusText: 'Virk félagsaðild',
      feesOwed: 0,
      lastPaymentDate: new Date('2024-09-01'),
      memberSince: new Date('2020-01-15'),
      nextPaymentDue: new Date('2025-01-01')
    },
    {
      status: 'fees_due',
      statusText: 'Gjöld ógreidd',
      feesOwed: 5000,  // ISK
      lastPaymentDate: new Date('2023-12-01'),
      memberSince: new Date('2019-03-20'),
      nextPaymentDue: new Date('2024-01-01')
    },
    {
      status: 'suspended',
      statusText: 'Aðild í bið',
      feesOwed: 15000,  // ISK
      lastPaymentDate: new Date('2022-06-01'),
      memberSince: new Date('2018-05-10'),
      suspendedDate: new Date('2024-01-15'),
      suspensionReason: 'Gjöld ógreidd í meira en 12 mánuði'
    }
  ];

  // For demo: cycle through statuses based on user ID hash
  const statusIndex = Math.abs(hashCode(userId)) % mockStatuses.length;
  const membershipData = mockStatuses[statusIndex];

  return {
    membershipNumber,
    ...membershipData
  };
}

/**
 * Generate a membership number from user ID
 * Format: SM-YYYY-XXXXX (Samstaða-Year-Number)
 */
function generateMembershipNumber(userId) {
  // Extract last 5 chars of user ID and convert to number
  const numericId = userId.slice(-5).split('').reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);

  // Pad to 5 digits
  const paddedId = String(numericId % 100000).padStart(5, '0');

  return `SM-2020-${paddedId}`;
}

/**
 * Simple hash function for demo purposes
 */
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash;
}

/**
 * Get badge configuration for membership status
 */
export function getStatusBadge(status) {
  const badges = {
    active: {
      text: 'Virk félagsaðild',
      class: 'badge-success',
      icon: '✓'
    },
    fees_due: {
      text: 'Gjöld ógreidd',
      class: 'badge-warning',
      icon: '⚠'
    },
    suspended: {
      text: 'Aðild í bið',
      class: 'badge-danger',
      icon: '⏸'
    }
  };

  return badges[status] || badges.active;
}

/**
 * Format currency in ISK
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat('is-IS', {
    style: 'currency',
    currency: 'ISK',
    minimumFractionDigits: 0
  }).format(amount);
}
