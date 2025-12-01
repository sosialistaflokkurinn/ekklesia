/**
 * Phone Numbers Management
 *
 * Handles phone number CRUD operations, rendering, and auto-save for profile page.
 * Supports multiple phone numbers with country selection and default marking.
 *
 * @module profile/phone-manager
 */

import { R } from '../../i18n/strings-loader.js';
import { getFirebaseFirestore } from '../../firebase/app.js';
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getCountriesSorted, getCountryFlag, getCountryCallingCode } from '../utils/countries.js';
import { debug } from '../utils/debug.js';
import { showToast } from '../components/toast.js';
import { showStatus, createStatusIcon } from '../components/status.js';
import { SearchableSelect } from '../components/searchable-select.js';
import { el } from '../utils/dom.js';

/**
 * Expand collapsible section helper
 */
function expandCollapsibleSection(sectionId, expandIconId, simpleDisplayId) {
  const section = document.getElementById(sectionId);
  const expandIcon = document.getElementById(expandIconId);
  const simpleDisplay = document.getElementById(simpleDisplayId);

  if (section && section.style.display === 'none') {
    debug.log(`   📂 Expanding section: ${sectionId}`);
    section.style.display = 'block';
    if (simpleDisplay) simpleDisplay.style.display = 'none';
    if (expandIcon) expandIcon.classList.add('expand-icon--expanded');
  }
}

/**
 * Set default item helper
 */
async function setDefaultItem(items, index, renderFn, saveFn, itemType) {
  debug.log(`⭐ Set default ${itemType} (index ${index})`);
  debug.log(`   Current default: ${items.findIndex(item => item.is_default)}`);

  items.forEach((item, i) => {
    item.is_default = (i === index);
  });

  debug.log(`   New default: ${index}`);
  debug.log(`   Updated ${itemType}s:`, items);

  await saveFn();
  renderFn();
}

/**
 * Phone Manager Class
 * Manages phone numbers state and operations
 */
export class PhoneManager {
  constructor(currentUserData) {
    this.currentUserData = currentUserData;
    this.phoneNumbers = [];
  }

  /**
   * Initialize phone numbers from user data
   */
  initialize(phoneNumbers) {
    this.phoneNumbers = phoneNumbers || [];
  }

  /**
   * Get current phone numbers
   */
  getPhoneNumbers() {
    return this.phoneNumbers;
  }

  /**
   * Update simple phone display (collapsed view)
   */
  updateSimpleDisplay() {
    const simpleDisplay = document.getElementById('value-phone-simple');
    if (!simpleDisplay) return;

    const defaultPhone = this.phoneNumbers.find(p => p.is_default);

    if (!defaultPhone) {
      simpleDisplay.textContent = R.string.placeholder_not_available;
      return;
    }

    const flag = getCountryFlag(defaultPhone.country);
    const callingCode = getCountryCallingCode(defaultPhone.country);
    const number = defaultPhone.number;

    simpleDisplay.textContent = `${flag} ${callingCode} ${number}`;
  }

  /**
   * Render phone numbers list
   */
  render() {
    const container = document.getElementById('phone-numbers-list');
    if (!container) return;

    container.innerHTML = '';

    if (this.phoneNumbers.length === 0) {
      const emptyMessage = el('p', '', {
        style: {
          color: 'var(--color-gray-500)',
          fontSize: '0.9375rem'
        }
      }, R.string.profile_no_phone_numbers);
      
      container.appendChild(emptyMessage);
      this.updateSimpleDisplay();
      return;
    }

    this.phoneNumbers.forEach((phone, index) => {
      // Country selector options
      const countries = getCountriesSorted();
      const options = countries.map(country => {
        const callingCode = getCountryCallingCode(country.code);
        return el('option', '', {
          value: country.code,
          'data-search': `${country.nameIs} ${country.nameEn} ${country.code} ${callingCode} ${callingCode.replace('+', '')}`,
          selected: country.code === phone.country
        }, `${getCountryFlag(country.code)} ${callingCode}`);
      });

      // Country selector
      const countrySelector = el('select', 'phone-country-selector', {
        'data-index': index
      }, ...options);

      const statusIcon = createStatusIcon();

      // Auto-save on country change
      countrySelector.addEventListener('change', async (e) => {
        const newCountry = e.target.value;
        debug.log(`🌍 Country change event (index ${index}): "${phone.country}" → "${newCountry}"`);

        if (newCountry !== phone.country) {
          debug.log(`✏️ Country changed, updating...`);
          this.phoneNumbers[index].country = newCountry;
          showStatus(statusIcon, 'loading', { baseClass: 'profile-field__status' });
          try {
            await this.save();
            showStatus(statusIcon, 'success', { baseClass: 'profile-field__status' });
            this.render();
          } catch (error) {
            debug.error('Failed to save phone country:', error);
            showStatus(statusIcon, 'error', { baseClass: 'profile-field__status' });
            // Revert change
            this.phoneNumbers[index].country = phone.country;
            this.render();
          }
        } else {
          debug.log('ℹ️ No change, skipping save');
        }
      });

      // Phone number input
      const numberInput = el('input', 'phone-number-input', {
        type: 'tel',
        value: phone.number,
        placeholder: '7758493',
        'data-index': index
      });

      // Auto-save on blur
      numberInput.addEventListener('blur', async (e) => {
        const newNumber = e.target.value.trim();
        debug.log(`📱 Phone number blur event (index ${index}): "${phone.number}" → "${newNumber}"`);

        if (newNumber !== phone.number) {
          debug.log(`✏️ Phone number changed, updating...`);
          this.phoneNumbers[index].number = newNumber;
          showStatus(statusIcon, 'loading', { baseClass: 'profile-field__status' });
          try {
            await this.save();
            showStatus(statusIcon, 'success', { baseClass: 'profile-field__status' });
          } catch (error) {
            debug.error('Failed to save phone number:', error);
            showStatus(statusIcon, 'error', { baseClass: 'profile-field__status' });
            // Revert change
            this.phoneNumbers[index].number = phone.number;
            e.target.value = phone.number;
          }
        } else {
          debug.log('ℹ️ No change, skipping save');
        }
      });

      // Default star icon
      const defaultIcon = el('span', 'phone-default-icon', {
        title: phone.is_default ? R.string.profile_phone_default_set : R.string.profile_phone_set_default,
        style: { cursor: 'pointer' },
        onclick: () => this.setDefault(index)
      }, phone.is_default ? '⭐' : '☆');

      // Delete button
      const deleteBtn = el('button', 'phone-delete-btn', {
        type: 'button',
        title: R.string.profile_phone_delete,
        disabled: this.phoneNumbers.length === 1,
        onclick: () => this.delete(index)
      }, '🗑️');

      // Assemble
      const phoneItem = el('div', `phone-number-item${phone.is_default ? ' phone-number-item--default' : ''}`, {},
        countrySelector,
        numberInput,
        statusIcon,
        defaultIcon,
        deleteBtn
      );

      container.appendChild(phoneItem);

      // Initialize SearchableSelect
      try {
        debug.log(`🔧 Initializing SearchableSelect for phone country selector (index ${index})`);
        new SearchableSelect(countrySelector, {
          searchPlaceholder: R.string.search_country || 'Search country...',
          noResultsText: R.string.no_results || 'No results found',
          renderOption: (option) => {
            return `${getCountryFlag(option.value)} ${getCountryCallingCode(option.value)}`;
          },
          renderSelected: (option) => {
            return `${getCountryFlag(option.value)} ${getCountryCallingCode(option.value)}`;
          }
        });
        debug.log(`✅ SearchableSelect initialized for phone ${index}`);
      } catch (error) {
        debug.error(`❌ Failed to initialize SearchableSelect for phone ${index}:`, error);
      }
    });

    this.updateSimpleDisplay();
  }

  /**
   * Add new phone number
   */
  add() {
    debug.log('➕ Adding new phone number...');
    debug.log(`   Current phone count: ${this.phoneNumbers.length}`);

    expandCollapsibleSection('phone-numbers-section', 'phone-expand-icon', 'value-phone-simple');

    const newPhone = {
      country: 'IS',
      number: '',
      is_default: this.phoneNumbers.length === 0
    };
    this.phoneNumbers.push(newPhone);

    debug.log(`   ✅ Added new phone: ${JSON.stringify(newPhone)}`);
    debug.log(`   New phone count: ${this.phoneNumbers.length}`);

    this.render();

    const inputs = document.querySelectorAll('.phone-number-input');
    const lastInput = inputs[inputs.length - 1];
    if (lastInput) {
      lastInput.focus();
      debug.log('   🎯 Focused on new phone input');
    }
  }

  /**
   * Delete phone number
   */
  async delete(index) {
    debug.log(`🗑️ Delete phone number requested (index ${index})`);

    if (this.phoneNumbers.length === 1) {
      debug.log('⚠️ Cannot delete last phone number');
      showToast(R.string.profile_phone_cannot_delete_last, 'error');
      return;
    }

    const wasDefault = this.phoneNumbers[index].is_default;
    debug.log(`Deleting phone: ${JSON.stringify(this.phoneNumbers[index])}, was default: ${wasDefault}`);

    this.phoneNumbers.splice(index, 1);

    if (wasDefault && this.phoneNumbers.length > 0) {
      this.phoneNumbers[0].is_default = true;
      debug.log(`Set new default: ${JSON.stringify(this.phoneNumbers[0])}`);
    }

    await this.save();
    this.render();
  }

  /**
   * Set default phone number
   */
  async setDefault(index) {
    await setDefaultItem(
      this.phoneNumbers,
      index,
      () => this.render(),
      () => this.save(),
      'phone number'
    );
    this.updateSimpleDisplay();
  }

  /**
   * Save phone numbers to Firestore
   */
  async save() {
    debug.log(
      `💾 Saving phone numbers to Firestore: count=${this.phoneNumbers.length}, countryCodes=[${this.phoneNumbers.map(pn => pn.country_code || 'N/A').join(', ')}]`
    );

    const statusIcon = document.getElementById('status-phone-numbers');

    try {
      if (statusIcon) {
        statusIcon.className = 'profile-field__status profile-field__status--loading';
        debug.log('⏳ Showing loading spinner...');
      }

      const db = getFirebaseFirestore();
      const kennitalaKey = this.currentUserData.kennitala.replace(/-/g, '');
      const memberDocRef = doc(db, 'members', kennitalaKey);

      debug.log('📝 Firestore path: /members/' + kennitalaKey);

      await updateDoc(memberDocRef, {
        'profile.phone_numbers': this.phoneNumbers,
        'profile.updated_at': new Date()
      });

      debug.log('✅ Phone numbers saved successfully to Firestore');

      if (statusIcon) {
        statusIcon.className = 'profile-field__status profile-field__status--success';
        debug.log('✓ Showing success checkmark');

        setTimeout(() => {
          statusIcon.className = 'profile-field__status';
          debug.log('ℹ️ Cleared status icon');
        }, 2000);
      }

      showToast(R.string.profile_phone_saved, 'success');
      debug.log('🎉 Toast notification shown');

    } catch (error) {
      debug.error('❌ Failed to save phone numbers:', error);

      if (statusIcon) {
        statusIcon.className = 'profile-field__status profile-field__status--error';
        debug.log('✕ Showing error icon');

        setTimeout(() => {
          statusIcon.className = 'profile-field__status';
        }, 3000);
      }

      showToast(R.string.profile_phone_save_error, 'error');
      debug.log('⚠️ Error toast notification shown');
    }
  }

  /**
   * Toggle section visibility
   */
  toggleSection() {
    const section = document.getElementById('phone-numbers-section');
    const expandIcon = document.getElementById('phone-expand-icon');
    const simpleDisplay = document.getElementById('value-phone-simple');

    if (!section || !expandIcon || !simpleDisplay) return;

    const isExpanded = section.style.display !== 'none';

    if (isExpanded) {
      section.style.display = 'none';
      simpleDisplay.style.display = 'block';
      expandIcon.classList.remove('expand-icon--expanded');
    } else {
      section.style.display = 'block';
      simpleDisplay.style.display = 'none';
      expandIcon.classList.add('expand-icon--expanded');
    }
  }

  /**
   * Setup event listeners
   */
  setupListeners() {
    const addBtn = document.getElementById('btn-add-phone');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.add());
    }

    const label = document.getElementById('label-phone-numbers');
    if (label) {
      label.addEventListener('click', () => this.toggleSection());
    }

    // Ensure section starts collapsed (set inline style for toggle logic)
    const section = document.getElementById('phone-numbers-section');
    const simpleDisplay = document.getElementById('value-phone-simple');
    if (section) {
      section.style.display = 'none';
    }
    if (simpleDisplay) {
      simpleDisplay.style.display = 'block';
    }
  }
}
