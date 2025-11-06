/**
 * RBAC (Role-Based Access Control) Utility
 * 
 * Handles Firebase custom claims for election-manager and superadmin roles
 * 
 * Roles:
 * - election-manager: Can create, edit, open, close, hide, unhide elections
 * - superadmin: Can do everything + permanently delete elections
 */

import { auth } from '../../firebase/app.js';

/**
 * Get current user's role from Firebase custom claims
 * @returns {Promise<string|null>} 'election-manager', 'superadmin', or null
 */
export async function getCurrentUserRole() {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.warn('[RBAC] No authenticated user');
      return null;
    }

    const idTokenResult = await user.getIdTokenResult(true); // Force refresh
    const role = idTokenResult.claims.role || null;
    
    console.log('[RBAC] Current user role:', role);
    return role;
  } catch (error) {
    console.error('[RBAC] Error getting user role:', error);
    return null;
  }
}

/**
 * Check if user has permission for an action
 * @param {string} userRole - 'election-manager' or 'superadmin'
 * @param {string} action - Action to check (e.g., 'delete', 'hide')
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
      'delete' // Hard delete - superadmin ONLY
    ]
  };

  const userPermissions = permissions[userRole] || [];
  const hasPermission = userPermissions.includes(action);

  console.log(`[RBAC] Can ${userRole} perform '${action}'?`, hasPermission);
  return hasPermission;
}

/**
 * Apply RBAC to page - show/hide elements based on role
 * Call this after page load and after role is fetched
 */
export async function applyRBAC() {
  const role = await getCurrentUserRole();

  // Hide delete buttons if not superadmin
  if (role !== 'superadmin') {
    document.querySelectorAll('.btn-delete-election').forEach(btn => {
      btn.style.display = 'none';
      btn.disabled = true;
    });
  }

  // Add role info to page (for debugging)
  const roleIndicator = document.getElementById('user-role-indicator');
  if (roleIndicator) {
    roleIndicator.textContent = role ? `Hlutverk: ${role}` : 'Enginn aðgangur';
    roleIndicator.className = role === 'superadmin' ? 'role-superadmin' : 'role-manager';
  }

  return role;
}

/**
 * Check if current user has required role
 * @param {string} requiredRole - 'election-manager' or 'superadmin'
 * @returns {Promise<boolean>}
 */
export async function hasRole(requiredRole) {
  const currentRole = await getCurrentUserRole();
  
  // superadmin has all permissions
  if (currentRole === 'superadmin') {
    return true;
  }
  
  // Check exact match
  return currentRole === requiredRole;
}

/**
 * Require specific role or redirect/show error
 * @param {string} requiredRole - 'election-manager' or 'superadmin'
 * @param {string} errorMessage - Message to show if permission denied
 * @returns {Promise<boolean>}
 */
export async function requireRole(requiredRole, errorMessage = 'Þú hefur ekki heimild til þessarar aðgerðar') {
  const hasAccess = await hasRole(requiredRole);
  
  if (!hasAccess) {
    console.warn('[RBAC] Permission denied:', requiredRole);
    alert(errorMessage);
    return false;
  }
  
  return true;
}
