/**
 * Superuser Strings - Localized strings for superuser console
 * 
 * These strings are used in the superuser role management interface.
 * Uses a simple Map-based approach for string retrieval with interpolation.
 */

const strings = {
  // General
  'save': 'Vista',
  'saving': 'Vista...',
  'cancel': 'Hætta við',
  'confirm': 'Staðfesta',
  'from': 'Frá',
  'to': 'Til',
  'updated': 'Uppfært',
  'not_found': 'Fannst ekki',
  
  // Role management
  'confirm_role_change_title': 'Staðfesta hlutverkabreytingu',
  'confirm_role_change_message': 'Ertu viss um að þú viljir breyta hlutverki ${name}?',
  'role_changed_success': 'Hlutverk breytt í ${role}',
  'logout_required_note': 'Athugið: Notandi þarf að skrá sig út og inn aftur til að breytingin taki gildi.',
  'user_not_registered_warning': 'Þessi notandi hefur ekki skráð sig inn í kerfið. Hlutverkabreyting mun taka gildi þegar þeir skrá sig inn.',
  'not_registered_firebase': 'Ekki skráð/ur',
  
  // Elevated users lists
  'no_superusers': 'Engir kerfisstjórar skráðir',
  'no_admins': 'Engir stjórnendur skráðir',
  
  // Login status
  'logged_in': 'Innskráð/ur',
  'not_logged_in': 'Ekki innskráð/ur',
  
  // Role change history
  'role_history_changed_by': '${changedByName} breytti hlutverki ${targetName}',
  'role_history_from_to': '${oldRole} \u2192 ${newRole}',

  // Source labels
  'source_system_admin': 'Kerfisstjórn',
  'source_firebase': 'Firebase',
  'source_django': 'Django',
  'source_django_members': 'Django (ekki skráð/ur)'
};

/**
 * Get a localized string with optional interpolation
 * @param {string} key - The string key
 * @param {Object} params - Optional parameters for interpolation
 * @returns {string} The localized string
 */
function get(key, params = {}) {
  let str = strings[key] || key;
  
  // Simple interpolation: replace ${varName} with params.varName
  if (params && typeof params === 'object') {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\$\\{${paramKey}\\}`, 'g'), paramValue);
    }
  }
  
  return str;
}

export const superuserStrings = {
  get,
  // Compatibility: load() is a no-op since strings are inline
  load: async () => strings,
  // Compatibility: translatePage() for data-i18n attributes
  translatePage: () => {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translation = get(key);
      if (translation !== key) {
        el.textContent = translation;
      }
    });
  }
};
