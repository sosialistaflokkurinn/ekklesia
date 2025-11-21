/**
 * Navigation Header Component
 * 
 * Reusable navigation component for all authenticated pages.
 * Provides consistent navigation with responsive hamburger menu.
 * 
 * FEATURES:
 * - Desktop: Horizontal navigation bar with links
 * - Mobile: Hamburger menu with slide-in drawer
 * - Support for sub-tabs (e.g., election types)
 * - Auto-initialization with nav.js
 * - i18n string loading
 * - ARIA accessibility
 * 
 * USAGE:
 * ```javascript
 * import { createNavHeader } from '../ui/components/nav-header.js';
 * 
 * const nav = createNavHeader({
 *   brand: {
 *     href: '/admin-elections/',
 *     textKey: 'nav_admin_elections'  // i18n key from R.string
 *   },
 *   links: [
 *     { 
 *       href: '/admin-elections/', 
 *       textKey: 'nav_elections_list',
 *       active: true 
 *     },
 *     { 
 *       href: '/members-area/dashboard.html', 
 *       textKey: 'nav_back_to_member' 
 *     }
 *   ],
 *   tabs: [  // Optional sub-navigation tabs (mobile drawer)
 *     {
 *       href: '/elections/?type=general',
 *       textKey: 'election_type_general',
 *       active: true
 *     },
 *     {
 *       href: '/elections/?type=board',
 *       textKey: 'election_type_board'
 *     }
 *   ],
 *   includeLogout: true  // Default: true
 * });
 * 
 * document.body.insertBefore(nav, document.body.firstChild);
 * ```
 * 
 * @module ui/components/nav-header
 */

import { R } from '../../i18n/strings-loader.js';

/**
 * Navigation Header Options
 * @typedef {Object} NavHeaderOptions
 * @property {Object} brand - Brand link configuration
 * @property {string} brand.href - Brand link URL
 * @property {string} brand.textKey - i18n key for brand text
 * @property {Array<NavLink>} links - Main navigation links
 * @property {Array<NavTab>} [tabs] - Optional sub-navigation tabs (mobile only)
 * @property {boolean} [includeLogout=true] - Include logout link
 * @property {Function} [onLogout] - Custom logout handler (default: signOut + redirect)
 */

/**
 * Navigation Link
 * @typedef {Object} NavLink
 * @property {string} href - Link URL
 * @property {string} textKey - i18n key for link text (from R.string)
 * @property {boolean} [active=false] - Whether link is currently active
 */

/**
 * Navigation Tab (Sub-navigation for mobile)
 * @typedef {Object} NavTab
 * @property {string} href - Tab URL
 * @property {string} textKey - i18n key for tab text
 * @property {boolean} [active=false] - Whether tab is currently active
 */

/**
 * Create Navigation Header Element
 * 
 * @param {NavHeaderOptions} options - Configuration options
 * @returns {HTMLElement} Navigation element ready to insert into DOM
 */
export function createNavHeader(options = {}) {
  const {
    brand = { href: '/', textKey: 'app_name' },
    links = [],
    tabs = [],
    includeLogout = true,
    onLogout = null
  } = options;

  // Create nav element
  const nav = document.createElement('nav');
  nav.className = 'nav';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Main navigation');

  // Build HTML structure
  nav.innerHTML = `
    <div class="nav__container">
      <!-- Brand -->
      <a href="${brand.href}" class="nav__brand" id="nav-brand">
        ${R.string[brand.textKey] || 'Loading...'}
      </a>

      <!-- Hamburger Button (mobile only) -->
      <button 
        class="nav__hamburger" 
        id="nav-hamburger" 
        aria-expanded="false"
        aria-label="${R.string.nav_open_menu || 'Opna valmynd'}"
        data-open-label="${R.string.nav_open_menu || 'Opna valmynd'}"
        data-close-label="${R.string.nav_close_menu || 'Loka valmynd'}"
      >
        <span class="nav__hamburger-line"></span>
        <span class="nav__hamburger-line"></span>
        <span class="nav__hamburger-line"></span>
      </button>

      <!-- Overlay for mobile menu -->
      <div class="nav__overlay" id="nav-overlay"></div>

      <!-- Navigation Drawer -->
      <div class="nav__drawer" id="nav-drawer" aria-hidden="true">
        <!-- Close button (mobile only) -->
        <button class="nav__close" id="nav-close" aria-label="${R.string.nav_close || 'Loka'}">
          <span class="nav__close-icon">✕</span>
        </button>

        ${tabs.length > 0 ? `
          <!-- Sub-navigation tabs (mobile only) -->
          <div class="nav__tabs" role="tablist" aria-label="Election type filter">
            ${tabs.map(tab => `
              <a 
                href="${tab.href}" 
                class="nav__tab ${tab.active ? 'nav__tab--active' : ''}"
                role="tab"
                aria-selected="${tab.active ? 'true' : 'false'}"
              >
                ${R.string[tab.textKey] || tab.textKey}
              </a>
            `).join('')}
          </div>
        ` : ''}

        <!-- Main navigation links -->
        <div class="nav__links">
          ${links.map(link => `
            <a 
              href="${link.href}" 
              class="nav__link ${link.active ? 'nav__link--active' : ''}"
              ${link.active ? 'aria-current="page"' : ''}
            >
              ${R.string[link.textKey] || link.textKey}
            </a>
          `).join('')}
          
          ${includeLogout ? `
            <a 
              href="#" 
              class="nav__link nav__link--logout" 
              id="nav-logout"
            >
              ${R.string.nav_logout || 'Útskrá'}
            </a>
          ` : ''}
        </div>
      </div>
    </div>
  `;

  // Attach logout handler if logout link exists
  if (includeLogout) {
    const logoutLink = nav.querySelector('#nav-logout');
    if (logoutLink) {
      logoutLink.addEventListener('click', async (e) => {
        e.preventDefault();
        
        if (onLogout) {
          // Custom logout handler
          await onLogout();
        } else {
          // Default: Sign out and redirect to home
          try {
            const { getFirebaseAuth } = await import('../../firebase/app.js');
            const auth = getFirebaseAuth();
            await auth.signOut();
            window.location.href = '/';
          } catch (error) {
            console.error('[NavHeader] Logout error:', error);
            // Fallback: just redirect
            window.location.href = '/';
          }
        }
      });
    }
  }

  return nav;
}

/**
 * Initialize Navigation Component
 * 
 * Convenience function that creates nav header and initializes behavior.
 * Use this when you want both creation and initialization in one call.
 * 
 * @param {NavHeaderOptions} options - Configuration options
 * @param {HTMLElement} [mountPoint=document.body] - Where to insert nav (default: before body content)
 * @returns {HTMLElement} The created navigation element
 */
export async function initNavHeader(options = {}, mountPoint = null) {
  // Ensure i18n strings are loaded before creating nav
  await R.load('is');
  
  // Create nav header
  const nav = createNavHeader(options);

  // Insert into DOM
  if (mountPoint) {
    mountPoint.appendChild(nav);
  } else {
    // Insert at beginning of body (before skip link)
    const skipLink = document.querySelector('.u-skip-link');
    if (skipLink) {
      skipLink.insertAdjacentElement('afterend', nav);
    } else {
      document.body.insertBefore(nav, document.body.firstChild);
    }
  }

  // Initialize navigation behavior (hamburger menu, etc.)
  const { initNavigation } = await import('../../js/nav-interactions.js');
  initNavigation();

  return nav;
}

/**
 * Common Navigation Configurations
 * 
 * Pre-defined configurations for different areas of the app.
 * Use these for consistency across similar pages.
 */
export const NAV_CONFIGS = {
  // ==========================================
  // MEMBERS AREA CONFIGURATIONS
  // ==========================================
  
  /**
   * Members Dashboard (Home Page)
   * Shows party branding
   */
  members: {
    brand: {
      href: '/members-area/dashboard.html',
      textKey: 'app_name'  // "Sósíalistaflokkurinn"
    },
    links: [
      { href: '/members-area/dashboard.html', textKey: 'nav_dashboard' },
      { href: '/members-area/profile.html', textKey: 'nav_profile' },
      { href: '/elections/', textKey: 'nav_elections' },
      { href: '/events/', textKey: 'nav_events' }
    ]
  },

  /**
   * Member Profile Page
   * Shows "Mínar upplýsingar" for context
   */
  membersProfile: {
    brand: {
      href: '/members-area/dashboard.html',
      textKey: 'nav_my_profile'  // "Mínar upplýsingar"
    },
    links: [
      { href: '/members-area/dashboard.html', textKey: 'nav_dashboard' },
      { href: '/members-area/profile.html', textKey: 'nav_profile' },
      { href: '/elections/', textKey: 'nav_elections' },
      { href: '/events/', textKey: 'nav_events' }
    ]
  },

  /**
   * Elections List and Detail
   * Shows "Kosningar" for context
   */
  elections: {
    brand: {
      href: '/elections/',
      textKey: 'nav_elections'  // "Kosningar"
    },
    links: [
      { href: '/elections/', textKey: 'nav_elections' },
      { href: '/members-area/dashboard.html', textKey: 'nav_back_to_member' }
    ],
    tabs: [
      { href: '/elections/?type=general', textKey: 'election_type_general' },
      { href: '/elections/?type=board', textKey: 'election_type_board' },
      { href: '/elections/?type=policy', textKey: 'election_type_policy' }
    ]
  },

  /**
   * Events Page
   * Shows "Viðburðir" for context
   */
  events: {
    brand: {
      href: '/events/',
      textKey: 'nav_events'  // "Viðburðir"
    },
    links: [
      { href: '/events/', textKey: 'nav_events' },
      { href: '/members-area/dashboard.html', textKey: 'nav_back_to_member' }
    ]
  },

  /**
   * Policy Session
   * Shows "Stefnumótun" for context
   */
  policySession: {
    brand: {
      href: '/policy-session/',
      textKey: 'nav_policy_session'  // "Stefnumótun"
    },
    links: [
      { href: '/policy-session/', textKey: 'nav_policy_session' },
      { href: '/members-area/dashboard.html', textKey: 'nav_back_to_member' }
    ]
  },

  // ==========================================
  // ADMIN AREA CONFIGURATIONS
  // ==========================================

  /**
   * Admin Dashboard (Home)
   * Shows "Stjórnkerfi" branding
   */
  admin: {
    brand: {
      href: '/admin/',
      textKey: 'nav_admin'  // "Stjórnkerfi"
    },
    links: [
      { href: '/admin/', textKey: 'nav_dashboard' },
      { href: '/admin/members.html', textKey: 'nav_admin_members' },
      { href: '/admin/sync-members.html', textKey: 'nav_admin_sync' },
      { href: '/admin/sync-history.html', textKey: 'nav_admin_sync_history' },
      { href: '/admin/sync-queue.html', textKey: 'nav_admin_sync_queue' },
      { href: '/members-area/dashboard.html', textKey: 'nav_back_to_member' }
    ]
  },

  /**
   * Admin Members List
   * Shows "Félagaskrá" for context
   */
  adminMembers: {
    brand: {
      href: '/admin/members.html',
      textKey: 'nav_admin_members'  // "Félagaskrá"
    },
    links: [
      { href: '/admin/', textKey: 'nav_dashboard' },
      { href: '/admin/members.html', textKey: 'nav_admin_members' },
      { href: '/admin/sync-members.html', textKey: 'nav_admin_sync' },
      { href: '/admin/sync-history.html', textKey: 'nav_admin_sync_history' },
      { href: '/admin/sync-queue.html', textKey: 'nav_admin_sync_queue' },
      { href: '/members-area/dashboard.html', textKey: 'nav_back_to_member' }
    ]
  },

  /**
   * Admin Member Profile
   * Shows "Upplýsingar félaga" for context
   */
  adminMemberProfile: {
    brand: {
      href: '/admin/members.html',
      textKey: 'nav_admin_member_profile'  // "Upplýsingar félaga"
    },
    links: [
      { href: '/admin/', textKey: 'nav_dashboard' },
      { href: '/admin/members.html', textKey: 'nav_admin_members' },
      { href: '/admin/sync-members.html', textKey: 'nav_admin_sync' },
      { href: '/admin/sync-history.html', textKey: 'nav_admin_sync_history' },
      { href: '/admin/sync-queue.html', textKey: 'nav_admin_sync_queue' },
      { href: '/members-area/dashboard.html', textKey: 'nav_back_to_member' }
    ]
  },

  /**
   * Admin Sync Members
   * Shows "Samstilling félagaskrár" for context
   */
  adminSyncMembers: {
    brand: {
      href: '/admin/sync-members.html',
      textKey: 'nav_admin_sync'  // "Samstilling félagaskrár"
    },
    links: [
      { href: '/admin/', textKey: 'nav_dashboard' },
      { href: '/admin/members.html', textKey: 'nav_admin_members' },
      { href: '/admin/sync-members.html', textKey: 'nav_admin_sync' },
      { href: '/admin/sync-history.html', textKey: 'nav_admin_sync_history' },
      { href: '/admin/sync-queue.html', textKey: 'nav_admin_sync_queue' },
      { href: '/members-area/dashboard.html', textKey: 'nav_back_to_member' }
    ]
  },

  /**
   * Admin Sync History
   * Shows "Samstillingarsaga" for context
   */
  adminSyncHistory: {
    brand: {
      href: '/admin/sync-history.html',
      textKey: 'nav_admin_sync_history'  // "Samstillingarsaga"
    },
    links: [
      { href: '/admin/', textKey: 'nav_dashboard' },
      { href: '/admin/members.html', textKey: 'nav_admin_members' },
      { href: '/admin/sync-members.html', textKey: 'nav_admin_sync' },
      { href: '/admin/sync-history.html', textKey: 'nav_admin_sync_history' },
      { href: '/admin/sync-queue.html', textKey: 'nav_admin_sync_queue' },
      { href: '/members-area/dashboard.html', textKey: 'nav_back_to_member' }
    ]
  },

  /**
   * Admin Sync Queue
   * Shows "Samstillingarbiðröð" for context
   */
  adminSyncQueue: {
    brand: {
      href: '/admin/sync-queue.html',
      textKey: 'nav_admin_sync_queue'  // "Samstillingarbiðröð"
    },
    links: [
      { href: '/admin/', textKey: 'nav_dashboard' },
      { href: '/admin/members.html', textKey: 'nav_admin_members' },
      { href: '/admin/sync-members.html', textKey: 'nav_admin_sync' },
      { href: '/admin/sync-history.html', textKey: 'nav_admin_sync_history' },
      { href: '/admin/sync-queue.html', textKey: 'nav_admin_sync_queue' },
      { href: '/members-area/dashboard.html', textKey: 'nav_back_to_member' }
    ]
  },

  // ==========================================
  // ADMIN ELECTIONS CONFIGURATIONS
  // ==========================================

  /**
   * Admin Elections List
   * Shows "Kosningastjórnun" for context
   */
  adminElections: {
    brand: {
      href: '/admin-elections/',
      textKey: 'nav_admin_elections'  // "Kosningastjórnun"
    },
    links: [
      { href: '/admin-elections/', textKey: 'nav_admin_elections' },
      { href: '/members-area/dashboard.html', textKey: 'nav_back_to_member' }
    ]
  },

  /**
   * Admin Elections Create
   * Shows "Ný kosning" for context
   */
  adminElectionsCreate: {
    brand: {
      href: '/admin-elections/',
      textKey: 'nav_admin_elections_create'  // "Ný kosning"
    },
    links: [
      { href: '/admin-elections/', textKey: 'nav_admin_elections' },
      { href: '/members-area/dashboard.html', textKey: 'nav_back_to_member' }
    ]
  },

  /**
   * Admin Elections Control
   * Shows "Stjórnborð kosninga" for context
   */
  adminElectionsControl: {
    brand: {
      href: '/admin-elections/',
      textKey: 'nav_admin_elections_control'  // "Stjórnborð kosninga"
    },
    links: [
      { href: '/admin-elections/', textKey: 'nav_admin_elections' },
      { href: '/members-area/dashboard.html', textKey: 'nav_back_to_member' }
    ]
  }
};
