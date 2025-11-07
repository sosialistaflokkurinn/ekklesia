/**
 * Unified RBAC (Role-Based Access Control) System
 * 
 * Centralized role and permission management for all portal areas.
 * 
 * Role Hierarchy:
 * - member: Basic member access (dashboard, profile, voting)
 * - admin: Member management + election management
 * - superuser: All permissions + dangerous operations
 * 
 * Role Mapping for Elections:
 * - admin → election-manager (for elections API)
 * - superuser → superadmin (for elections API)
 * 
 * @module rbac
 */

import { getFirebaseAuth } from '../firebase/app.js';
import { debug } from './utils/debug.js';

const auth = getFirebaseAuth();

// ============================================
// ROLE DEFINITIONS
// ============================================

/**
 * All available roles in the system
 */
export const ROLES = {
  MEMBER: 'member',
  ADMIN: 'admin',
  SUPERUSER: 'superuser',
  // Mapped roles for elections service
  ELECTION_MANAGER: 'election-manager',
  SUPERADMIN: 'superadmin'
};

/**
 * Role hierarchy (higher number = more permissions)
 */
const ROLE_HIERARCHY = {
  [ROLES.MEMBER]: 1,
  [ROLES.ADMIN]: 2,
  [ROLES.SUPERUSER]: 3
};

// ============================================
// PERMISSIONS DEFINITIONS
// ============================================

/**
 * All available permissions in the system
 */
export const PERMISSIONS = {
  // Member area permissions
  VIEW_DASHBOARD: 'view-dashboard',
  VIEW_PROFILE: 'view-profile',
  EDIT_PROFILE: 'edit-profile',
  VIEW_EVENTS: 'view-events',
  REGISTER_EVENT: 'register-event',
  VIEW_ELECTIONS: 'view-elections',
  VOTE: 'vote',
  
  // Admin area permissions (member management)
  VIEW_ADMIN_PORTAL: 'view-admin-portal',
  VIEW_MEMBERS_LIST: 'view-members-list',
  VIEW_MEMBER_DETAILS: 'view-member-details',
  EDIT_MEMBER: 'edit-member',
  SYNC_MEMBERS: 'sync-members',
  VIEW_SYNC_HISTORY: 'view-sync-history',
  VIEW_SYNC_QUEUE: 'view-sync-queue',
  
  // Elections admin permissions
  VIEW_ELECTIONS_ADMIN: 'view-elections-admin',
  CREATE_ELECTION: 'create-election',
  EDIT_ELECTION: 'edit-election',
  OPEN_ELECTION: 'open-election',
  CLOSE_ELECTION: 'close-election',
  HIDE_ELECTION: 'hide-election',
  UNHIDE_ELECTION: 'unhide-election',
  VIEW_ELECTION_RESULTS: 'view-election-results',
  EXPORT_ELECTION_RESULTS: 'export-election-results',
  DELETE_ELECTION: 'delete-election',
  
  // System permissions (superuser only)
  DELETE_MEMBER: 'delete-member',
  MANAGE_ROLES: 'manage-roles',
  VIEW_SYSTEM_LOGS: 'view-system-logs',
  DANGEROUS_OPERATIONS: 'dangerous-operations'
};

/**
 * Permission sets for each role
 */
const ROLE_PERMISSIONS = {
  [ROLES.MEMBER]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_PROFILE,
    PERMISSIONS.EDIT_PROFILE,
    PERMISSIONS.VIEW_EVENTS,
    PERMISSIONS.REGISTER_EVENT,
    PERMISSIONS.VIEW_ELECTIONS,
    PERMISSIONS.VOTE
  ],
  
  [ROLES.ADMIN]: [
    // All member permissions (duplicated to avoid circular reference)
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_PROFILE,
    PERMISSIONS.EDIT_PROFILE,
    PERMISSIONS.VIEW_EVENTS,
    PERMISSIONS.REGISTER_EVENT,
    PERMISSIONS.VIEW_ELECTIONS,
    PERMISSIONS.VOTE,
    // Admin portal permissions
    PERMISSIONS.VIEW_ADMIN_PORTAL,
    PERMISSIONS.VIEW_MEMBERS_LIST,
    PERMISSIONS.VIEW_MEMBER_DETAILS,
    PERMISSIONS.EDIT_MEMBER,
    PERMISSIONS.SYNC_MEMBERS,
    PERMISSIONS.VIEW_SYNC_HISTORY,
    PERMISSIONS.VIEW_SYNC_QUEUE,
    // Elections admin permissions
    PERMISSIONS.VIEW_ELECTIONS_ADMIN,
    PERMISSIONS.CREATE_ELECTION,
    PERMISSIONS.EDIT_ELECTION,
    PERMISSIONS.OPEN_ELECTION,
    PERMISSIONS.CLOSE_ELECTION,
    PERMISSIONS.HIDE_ELECTION,
    PERMISSIONS.UNHIDE_ELECTION,
    PERMISSIONS.VIEW_ELECTION_RESULTS,
    PERMISSIONS.EXPORT_ELECTION_RESULTS
  ],
  
  [ROLES.SUPERUSER]: [
    // All admin permissions (duplicated to avoid circular reference)
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_PROFILE,
    PERMISSIONS.EDIT_PROFILE,
    PERMISSIONS.VIEW_EVENTS,
    PERMISSIONS.REGISTER_EVENT,
    PERMISSIONS.VIEW_ELECTIONS,
    PERMISSIONS.VOTE,
    PERMISSIONS.VIEW_ADMIN_PORTAL,
    PERMISSIONS.VIEW_MEMBERS_LIST,
    PERMISSIONS.VIEW_MEMBER_DETAILS,
    PERMISSIONS.EDIT_MEMBER,
    PERMISSIONS.SYNC_MEMBERS,
    PERMISSIONS.VIEW_SYNC_HISTORY,
    PERMISSIONS.VIEW_SYNC_QUEUE,
    PERMISSIONS.VIEW_ELECTIONS_ADMIN,
    PERMISSIONS.CREATE_ELECTION,
    PERMISSIONS.EDIT_ELECTION,
    PERMISSIONS.OPEN_ELECTION,
    PERMISSIONS.CLOSE_ELECTION,
    PERMISSIONS.HIDE_ELECTION,
    PERMISSIONS.UNHIDE_ELECTION,
    PERMISSIONS.VIEW_ELECTION_RESULTS,
    PERMISSIONS.EXPORT_ELECTION_RESULTS,
    // Superuser-only permissions
    PERMISSIONS.DELETE_ELECTION,
    PERMISSIONS.DELETE_MEMBER,
    PERMISSIONS.MANAGE_ROLES,
    PERMISSIONS.VIEW_SYSTEM_LOGS,
    PERMISSIONS.DANGEROUS_OPERATIONS
  ]
};

// ============================================
// CORE RBAC FUNCTIONS
// ============================================

/**
 * Get current user's roles from Firebase custom claims
 * @returns {Promise<string[]>} Array of role strings
 */
export async function getCurrentUserRoles() {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.warn('[RBAC] No authenticated user');
      return [];
    }

    const idTokenResult = await user.getIdTokenResult(true); // Force refresh
    const roles = idTokenResult.claims.roles || [];
    
    debug.log('[RBAC] User roles from token:', roles);
    return roles;
  } catch (error) {
    console.error('[RBAC] Error getting user roles:', error);
    return [];
  }
}

/**
 * Get current user's highest role (for display purposes)
 * @returns {Promise<string|null>} Highest role or null
 */
export async function getCurrentUserRole() {
  const roles = await getCurrentUserRoles();
  
  if (roles.includes(ROLES.SUPERUSER)) {
    debug.log('[RBAC] Highest role: superuser');
    return ROLES.SUPERUSER;
  }
  if (roles.includes(ROLES.ADMIN)) {
    debug.log('[RBAC] Highest role: admin');
    return ROLES.ADMIN;
  }
  if (roles.includes(ROLES.MEMBER)) {
    debug.log('[RBAC] Highest role: member');
    return ROLES.MEMBER;
  }
  
  debug.log('[RBAC] No recognized role found');
  return null;
}

/**
 * Map user role to election service role
 * Used for backend API calls to elections service
 * @returns {Promise<string|null>} 'election-manager', 'superadmin', or null
 */
export async function getElectionRole() {
  const roles = await getCurrentUserRoles();
  
  if (roles.includes(ROLES.SUPERUSER)) {
    debug.log('[RBAC] Mapped superuser -> superadmin (elections)');
    return ROLES.SUPERADMIN;
  }
  if (roles.includes(ROLES.ADMIN)) {
    debug.log('[RBAC] Mapped admin -> election-manager (elections)');
    return ROLES.ELECTION_MANAGER;
  }
  
  debug.log('[RBAC] No election role found');
  return null;
}

/**
 * Check if user has a specific role
 * @param {string} requiredRole - Role to check (e.g., 'member', 'admin', 'superuser')
 * @returns {Promise<boolean>}
 */
export async function hasRole(requiredRole) {
  const roles = await getCurrentUserRoles();
  return roles.includes(requiredRole);
}

/**
 * Check if user has at least one of the specified roles
 * @param {string[]} requiredRoles - Array of acceptable roles
 * @returns {Promise<boolean>}
 */
export async function hasAnyRole(requiredRoles) {
  const roles = await getCurrentUserRoles();
  return requiredRoles.some(role => roles.includes(role));
}

/**
 * Check if user has all specified roles
 * @param {string[]} requiredRoles - Array of required roles
 * @returns {Promise<boolean>}
 */
export async function hasAllRoles(requiredRoles) {
  const roles = await getCurrentUserRoles();
  return requiredRoles.every(role => roles.includes(role));
}

/**
 * Check if user has permission for an action
 * @param {string} permission - Permission to check (use PERMISSIONS constants)
 * @returns {Promise<boolean>}
 */
export async function hasPermission(permission) {
  const roles = await getCurrentUserRoles();
  
  // Check each role's permissions
  for (const role of roles) {
    const rolePermissions = ROLE_PERMISSIONS[role] || [];
    if (rolePermissions.includes(permission)) {
      debug.log(`[RBAC] User has permission '${permission}' via role '${role}'`);
      return true;
    }
  }
  
  debug.log(`[RBAC] User does NOT have permission '${permission}'`);
  return false;
}

/**
 * Check if user has any of the specified permissions
 * @param {string[]} permissions - Array of permissions to check
 * @returns {Promise<boolean>}
 */
export async function hasAnyPermission(permissions) {
  for (const permission of permissions) {
    if (await hasPermission(permission)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if user has all specified permissions
 * @param {string[]} permissions - Array of permissions to check
 * @returns {Promise<boolean>}
 */
export async function hasAllPermissions(permissions) {
  for (const permission of permissions) {
    if (!await hasPermission(permission)) {
      return false;
    }
  }
  return true;
}

/**
 * Legacy function for elections admin (maintains backwards compatibility)
 * @deprecated Use hasPermission() instead
 * @param {string} userRole - 'election-manager' or 'superadmin'
 * @param {string} action - Action to check
 * @returns {boolean}
 */
export function canPerformAction(userRole, action) {
  const permissions = {
    'election-manager': [
      'create',
      'edit',
      'open',
      'close',
      'hide',
      'unhide',
      'view-results',
      'export'
    ],
    'superadmin': [
      'create',
      'edit',
      'open',
      'close',
      'hide',
      'unhide',
      'view-results',
      'export',
      'delete'
    ]
  };

  const userPermissions = permissions[userRole] || [];
  const hasPermission = userPermissions.includes(action);

  debug.log(`[RBAC] Can ${userRole} perform '${action}'?`, hasPermission);
  return hasPermission;
}

// ============================================
// PAGE ACCESS CONTROL
// ============================================

/**
 * Require member role to access page
 * Redirects to login if not authenticated or not a member
 * @param {string} redirectUrl - URL to redirect to if unauthorized (default: /session/login.html)
 * @throws {Error} If user is not a member
 */
export async function requireMember(redirectUrl = '/session/login.html') {
  const user = auth.currentUser;
  if (!user) {
    console.warn('[RBAC] No authenticated user, redirecting to login');
    window.location.href = redirectUrl;
    throw new Error('Not authenticated');
  }
  
  const isMember = await hasRole(ROLES.MEMBER);
  if (!isMember) {
    console.error('[RBAC] User does not have member role');
    throw new Error('Member role required');
  }
  
  debug.log('[RBAC] ✓ Member access granted');
  return true;
}

/**
 * Require admin role to access page
 * Redirects if not authorized
 * @param {string} redirectUrl - URL to redirect to if unauthorized (default: /members-area/)
 * @throws {Error} If user is not an admin
 */
export async function requireAdmin(redirectUrl = '/members-area/') {
  const user = auth.currentUser;
  if (!user) {
    console.warn('[RBAC] No authenticated user, redirecting to login');
    window.location.href = '/session/login.html';
    throw new Error('Not authenticated');
  }
  
  const isAdmin = await hasAnyRole([ROLES.ADMIN, ROLES.SUPERUSER]);
  if (!isAdmin) {
    console.error('[RBAC] User does not have admin or superuser role');
    alert('Þú hefur ekki heimild til að skoða þessa síðu. Aðeins stjórnendur hafa aðgang.');
    window.location.href = redirectUrl;
    throw new Error('Admin role required');
  }
  
  debug.log('[RBAC] ✓ Admin access granted');
  return true;
}

/**
 * Require superuser role to access page
 * Redirects if not authorized
 * @param {string} redirectUrl - URL to redirect to if unauthorized (default: /members-area/)
 * @throws {Error} If user is not a superuser
 */
export async function requireSuperuser(redirectUrl = '/members-area/') {
  const user = auth.currentUser;
  if (!user) {
    console.warn('[RBAC] No authenticated user, redirecting to login');
    window.location.href = '/session/login.html';
    throw new Error('Not authenticated');
  }
  
  const isSuperuser = await hasRole(ROLES.SUPERUSER);
  if (!isSuperuser) {
    console.error('[RBAC] User does not have superuser role');
    alert('Þú hefur ekki heimild til að skoða þessa síðu. Aðeins kerfisstjórar hafa aðgang.');
    window.location.href = redirectUrl;
    throw new Error('Superuser role required');
  }
  
  debug.log('[RBAC] ✓ Superuser access granted');
  return true;
}

/**
 * Require specific permission to proceed
 * @param {string} permission - Required permission (use PERMISSIONS constants)
 * @param {string} errorMessage - Error message to show if denied
 * @throws {Error} If user doesn't have permission
 */
export async function requirePermission(permission, errorMessage = null) {
  const hasAccess = await hasPermission(permission);
  if (!hasAccess) {
    const message = errorMessage || `Þú hefur ekki heimild til að framkvæma þessa aðgerð (${permission}).`;
    console.error('[RBAC]', message);
    throw new Error(message);
  }
  return true;
}

// ============================================
// UI HELPERS
// ============================================

/**
 * Show/hide element based on permission
 * @param {string} elementId - DOM element ID
 * @param {string} permission - Required permission
 */
export async function toggleElementByPermission(elementId, permission) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const hasAccess = await hasPermission(permission);
  element.style.display = hasAccess ? '' : 'none';
  element.disabled = !hasAccess;
}

/**
 * Show/hide element based on role
 * @param {string} elementId - DOM element ID
 * @param {string|string[]} role - Required role(s)
 */
export async function toggleElementByRole(elementId, role) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const hasAccess = Array.isArray(role) 
    ? await hasAnyRole(role)
    : await hasRole(role);
  
  element.style.display = hasAccess ? '' : 'none';
  element.disabled = !hasAccess;
}

/**
 * Add role indicator to page (for debugging)
 * @param {string} elementId - DOM element ID to display role
 */
export async function displayRoleIndicator(elementId = 'user-role-indicator') {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const role = await getCurrentUserRole();
  const roles = await getCurrentUserRoles();
  
  if (role) {
    element.textContent = `Hlutverk: ${role} (${roles.join(', ')})`;
    element.className = `role-indicator role-${role}`;
  } else {
    element.textContent = 'Enginn aðgangur';
    element.className = 'role-indicator role-none';
  }
}

// ============================================
// EXPORTS
// ============================================

export default {
  ROLES,
  PERMISSIONS,
  getCurrentUserRoles,
  getCurrentUserRole,
  getElectionRole,
  hasRole,
  hasAnyRole,
  hasAllRoles,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canPerformAction,
  requireMember,
  requireAdmin,
  requireSuperuser,
  requirePermission,
  toggleElementByPermission,
  toggleElementByRole,
  displayRoleIndicator
};
