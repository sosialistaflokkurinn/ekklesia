/**
 * elections-list.js - Component Test Version
 * 
 * This is a modified version that does NOT call initNavigation()
 * because the navigation component handles its own initialization.
 * 
 * CHANGES FROM ORIGINAL:
 * - Removed import of initNavigation
 * - Removed initNavigation() call
 * - Everything else identical
 */

import { getFirebaseAuth } from '../../firebase/app.js';
import { getElectionRole, canPerformAction, requireAdmin, PERMISSIONS, hasPermission } from '../../js/rbac.js';
import { R } from '../i18n/strings-loader.js';
import { initElectionsListStrings } from './elections-list-i18n.js';
// REMOVED: import { initNavigation } from '../../js/nav.js';
import { formatDate, getTimeRemaining } from './date-utils.js';
import { createStatusBadge } from '../../js/components/badge.js';
import { showModal, showAlert } from '../../js/components/modal.js';
import { formatDateIcelandic } from '../../js/utils/format.js';
import { debug } from '../../js/utils/debug.js';

const auth = getFirebaseAuth();

// API Configuration
// =====================================================
// Configuration
// =====================================================

/**
 * API Configuration
 */
const ADMIN_API_URL = 'https://elections-service-ymzrguoifa-nw.a.run.app/api/admin/elections';

// ============================================
// STATE
// ============================================

let elections = [];
let filteredElections = [];
let currentFilter = 'all';
let searchQuery = '';
let currentUserRole = null; // Store user role for RBAC checks

// Cached permission checks (computed once, reused for all elections)
let userPermissions = {
  canDelete: false,
  canEdit: false,
  canManage: false
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  debug.log('DOM Content Loaded - Initializing elections list');
  
  try {
    // Wait for authentication
    await new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged(async (user) => {
        unsubscribe();
        if (!user) {
          window.location.href = '/';
          return;
        }
        
        // Get user role for RBAC
        const token = await user.getIdTokenResult();
        currentUserRole = getElectionRole(token.claims);
        
        debug.log('User authenticated', { 
          uid: user.uid, 
          role: currentUserRole 
        });
        
        // Compute user permissions once (used for all elections)
        userPermissions = {
          canDelete: hasPermission(PERMISSIONS.HARD_DELETE_ELECTION, token.claims),
          canEdit: hasPermission(PERMISSIONS.UPDATE_ELECTION, token.claims),
          canManage: hasPermission(PERMISSIONS.CLOSE_ELECTION, token.claims)
        };
        
        debug.log('User permissions computed', userPermissions);
        
        resolve();
      });
    });
    
    // Initialize i18n strings
    await initElectionsListStrings();
    debug.log('i18n strings initialized');
    
    // REMOVED: initNavigation();
    // Navigation component handles its own initialization
    
    // Initialize filters
    initFilters();
    debug.log('Filters initialized');
    
    // Initialize search
    initSearch();
    debug.log('Search initialized');
    
    // Load elections
    await loadElections();
    debug.log('Elections loaded');
    
  } catch (error) {
    console.error('[ElectionsList] Initialization error:', error);
    showError('Ekki tókst að hlaða kosningum. Vinsamlegast endurhlaðið síðuna.');
  }
});

// [REST OF FILE CONTINUES IDENTICALLY TO ORIGINAL...]
// Copy the entire content from the original elections-list.js
// starting from line 51 onwards
