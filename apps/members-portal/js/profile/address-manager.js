/**
 * Address Management
 *
 * Handles address CRUD operations, rendering, and auto-save for profile page.
 * Supports multiple addresses with country selection and default marking.
 *
 * @module profile/address-manager
 */

import { R } from '../../i18n/strings-loader.js';
import { getFirebaseFirestore } from '../../firebase/app.js';
import { doc, updateDoc, deleteField } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getCountriesSorted, getCountryFlag } from '../utils/countries.js';
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
 * Address Manager Class
 * Manages addresses state and operations
 */
export class AddressManager {
  constructor(currentUserData) {
    this.currentUserData = currentUserData;
    this.addresses = [];
  }

  /**
   * Initialize addresses from user data
   */
  initialize(addresses) {
    this.addresses = addresses || [];
  }

  /**
   * Get current addresses
   */
  getAddresses() {
    return this.addresses;
  }

  /**
   * Update simple address display (collapsed view)
   */
  updateSimpleDisplay() {
    const simpleDisplay = document.getElementById('value-address-simple');
    if (!simpleDisplay) return;

    const defaultAddress = this.addresses.find(a => a.is_default);

    if (!defaultAddress) {
      simpleDisplay.textContent = R.string.placeholder_not_available;
      return;
    }

    const flag = getCountryFlag(defaultAddress.country);
    const street = defaultAddress.street || '';
    const number = defaultAddress.number || '';
    const letter = defaultAddress.letter || '';
    const postal = defaultAddress.postal_code || '';
    const city = defaultAddress.city || '';

    const fullStreet = `${street} ${number}${letter}`.trim();
    simpleDisplay.textContent = `${flag} ${fullStreet}, ${postal} ${city}`.trim();
  }

  /**
   * Render addresses list
   */
  render() {
    const container = document.getElementById('addresses-list');
    if (!container) return;

    container.innerHTML = '';

    if (this.addresses.length === 0) {
      const emptyMessage = el('p', '', {
        style: {
          color: 'var(--color-gray-500, #6b7280)',
          fontStyle: 'italic'
        }
      }, R.string.profile_no_addresses);
      
      container.appendChild(emptyMessage);
      this.updateSimpleDisplay();
      return;
    }

    const countries = getCountriesSorted();

    this.addresses.forEach((address, index) => {
      // Row 1: Country selector + Status + Default star + Delete button
      const statusIcon = createStatusIcon();

      // Country selector options
      const options = countries.map(country => {
        return el('option', '', {
          value: country.code,
          'data-search': `${country.nameIs} ${country.nameEn} ${country.code}`,
          selected: country.code === address.country
        }, `${getCountryFlag(country.code)} ${country.nameIs}`);
      });

      // Country selector
      const countrySelector = el('select', 'item-country-selector', {}, ...options);

      // Country change listener
      countrySelector.addEventListener('change', async (e) => {
        const newCountry = e.target.value;
        debug.log(`🌍 Country change (index ${index}): "${address.country}" → "${newCountry}"`);

        if (newCountry !== address.country) {
          debug.log('✏️ Country changed, updating...');
          this.addresses[index].country = newCountry;
          showStatus(statusIcon, 'loading', { baseClass: 'profile-field__status' });
          await this.save();
          showStatus(statusIcon, 'success', { baseClass: 'profile-field__status' });
          this.render();
        }
      });

      // Default star icon
      const defaultIcon = el('span', 'item-default-icon', {
        title: address.is_default ? R.string.profile_address_default_set : R.string.profile_address_set_default,
        onclick: () => this.setDefault(index)
      }, address.is_default ? '⭐' : '☆');

      // Delete button
      const deleteBtn = el('button', 'item-delete-btn', {
        title: R.string.profile_address_delete,
        disabled: this.addresses.length === 1,
        onclick: () => this.delete(index)
      }, '🗑️');

      const row1 = el('div', 'address-item__row address-item__row--controls', {},
        countrySelector,
        statusIcon,
        defaultIcon,
        deleteBtn
      );

      // Row 2: Street input + Number + Letter
      const streetInput = el('input', 'address-input address-input--street', {
        type: 'text',
        value: address.street || '',
        placeholder: R.string.label_street
      });

      const numberInput = el('input', 'address-input address-input--number', {
        type: 'text',
        value: address.number || '',
        placeholder: R.string.label_house_number,
        style: { width: '80px' }
      });

      const letterInput = el('input', 'address-input address-input--letter', {
        type: 'text',
        value: address.letter || '',
        placeholder: R.string.label_house_letter,
        style: { width: '60px' },
        maxLength: 2
      });

      streetInput.addEventListener('blur', async (e) => {
        const newStreet = e.target.value.trim();
        debug.log(`🏠 Street blur (index ${index}): "${address.street}" → "${newStreet}"`);

        if (newStreet !== address.street) {
          debug.log('✏️ Street changed, updating...');
          this.addresses[index].street = newStreet;
          showStatus(statusIcon, 'loading', { baseClass: 'profile-field__status' });
          await this.save();
          showStatus(statusIcon, 'success', { baseClass: 'profile-field__status' });
        } else {
          debug.log('ℹ️ No change, skipping save');
        }
      });

      numberInput.addEventListener('blur', async (e) => {
        const newNumber = e.target.value.trim();
        debug.log(`🔢 House number blur (index ${index}): "${address.number}" → "${newNumber}"`);

        if (newNumber !== address.number) {
          debug.log('✏️ House number changed, updating...');
          this.addresses[index].number = newNumber;
          showStatus(statusIcon, 'loading', { baseClass: 'profile-field__status' });
          await this.save();
          showStatus(statusIcon, 'success', { baseClass: 'profile-field__status' });
        } else {
          debug.log('ℹ️ No change, skipping save');
        }
      });

      letterInput.addEventListener('blur', async (e) => {
        const newLetter = e.target.value.trim().toUpperCase();
        debug.log(`🔤 House letter blur (index ${index}): "${address.letter}" → "${newLetter}"`);

        if (newLetter !== address.letter) {
          debug.log('✏️ House letter changed, updating...');
          this.addresses[index].letter = newLetter;
          showStatus(statusIcon, 'loading', { baseClass: 'profile-field__status' });
          await this.save();
          showStatus(statusIcon, 'success', { baseClass: 'profile-field__status' });
        } else {
          debug.log('ℹ️ No change, skipping save');
        }
      });

      const row2 = el('div', 'address-item__row', {},
        streetInput,
        numberInput,
        letterInput
      );

      // Row 3: Postal code + City
      const postalInput = el('input', 'address-input address-input--postal', {
        type: 'text',
        value: address.postal_code || '',
        placeholder: R.string.label_postal_code
      });

      const cityInput = el('input', 'address-input address-input--city', {
        type: 'text',
        value: address.city || '',
        placeholder: R.string.label_city
      });

      postalInput.addEventListener('blur', async (e) => {
        const newPostal = e.target.value.trim();
        debug.log(`📮 Postal code blur (index ${index}): "${address.postal_code}" → "${newPostal}"`);

        if (newPostal !== address.postal_code) {
          debug.log('✏️ Postal code changed, updating...');
          this.addresses[index].postal_code = newPostal;
          showStatus(statusIcon, 'loading', { baseClass: 'profile-field__status' });
          await this.save();
          showStatus(statusIcon, 'success', { baseClass: 'profile-field__status' });
        } else {
          debug.log('ℹ️ No change, skipping save');
        }
      });

      cityInput.addEventListener('blur', async (e) => {
        const newCity = e.target.value.trim();
        debug.log(`🏙️ City blur (index ${index}): "${address.city}" → "${newCity}"`);

        if (newCity !== address.city) {
          debug.log('✏️ City changed, updating...');
          this.addresses[index].city = newCity;
          showStatus(statusIcon, 'loading', { baseClass: 'profile-field__status' });
          await this.save();
          showStatus(statusIcon, 'success', { baseClass: 'profile-field__status' });
        } else {
          debug.log('ℹ️ No change, skipping save');
        }
      });

      const row3 = el('div', 'address-item__row', {},
        postalInput,
        cityInput
      );

      // Assemble
      const addressItem = el('div', `address-item${address.is_default ? ' address-item--default' : ''}`, {},
        row1,
        row2,
        row3
      );

      container.appendChild(addressItem);

      // Initialize SearchableSelect
      try {
        debug.log(`🔧 Initializing SearchableSelect for address country selector (index ${index})`);
        new SearchableSelect(countrySelector, {
          searchPlaceholder: R.string.search_country,
          noResultsText: R.string.no_results,
          renderOption: (option) => {
            const country = countries.find(c => c.code === option.value);
            return `${getCountryFlag(option.value)} ${country ? country.nameIs : option.value}`;
          },
          renderSelected: (option) => {
            const country = countries.find(c => c.code === option.value);
            return `${getCountryFlag(option.value)} ${country ? country.nameIs : option.value}`;
          }
        });
        debug.log(`✅ SearchableSelect initialized for address ${index}`);
      } catch (error) {
        debug.error(`❌ Failed to initialize SearchableSelect for address ${index}:`, error);
      }
    });

    this.updateSimpleDisplay();
  }

  /**
   * Add new address
   */
  add() {
    debug.log('➕ Adding new address...');
    debug.log(`   Current address count: ${this.addresses.length}`);

    expandCollapsibleSection('addresses-section', 'address-expand-icon', 'value-address-simple');

    const newAddress = {
      country: 'IS',
      street: '',
      number: '',
      letter: '',
      postal_code: '',
      city: '',
      is_default: this.addresses.length === 0
    };
    this.addresses.push(newAddress);

    debug.log(`   ✅ Added new address: ${JSON.stringify(newAddress)}`);
    debug.log(`   New address count: ${this.addresses.length}`);

    this.render();

    const inputs = document.querySelectorAll('.address-input');
    if (inputs.length > 0) {
      const lastInput = inputs[inputs.length - 3];
      if (lastInput) {
        lastInput.focus();
        debug.log('   🎯 Focused on new street input');
      }
    }
  }

  /**
   * Delete address
   */
  async delete(index) {
    debug.log(`🗑️ Delete address requested (index ${index})`);

    if (this.addresses.length === 1) {
      debug.log('⚠️ Cannot delete last address');
      showToast(R.string.profile_address_cannot_delete_last, 'error');
      return;
    }

    const wasDefault = this.addresses[index].is_default;
    debug.log(`Deleting address: ${JSON.stringify(this.addresses[index])}, was default: ${wasDefault}`);

    this.addresses.splice(index, 1);

    if (wasDefault && this.addresses.length > 0) {
      this.addresses[0].is_default = true;
      debug.log(`Set new default: ${JSON.stringify(this.addresses[0])}`);
    }

    await this.save();
    this.render();
  }

  /**
   * Set default address
   */
  async setDefault(index) {
    await setDefaultItem(
      this.addresses,
      index,
      () => this.render(),
      () => this.save(),
      'address'
    );
    this.updateSimpleDisplay();
  }

  /**
   * Save addresses to Firestore
   * 
   * @param {Object} options - Save options
   * @param {boolean} options.silent - If true, suppress toast notification (used for migration auto-save)
   */
  async save(options = {}) {
    const { silent = false } = options;
    
    debug.log('💾 Saving addresses to Firestore:', this.addresses);
    if (silent) {
      debug.log('   🔕 Silent mode: No toast notification will be shown');
    }

    const statusIcon = document.getElementById('status-addresses');

    try {
      if (statusIcon) {
        statusIcon.className = 'profile-field__status profile-field__status--loading';
        debug.log('⏳ Showing loading spinner...');
      }

      const db = getFirebaseFirestore();
      const kennitalaKey = this.currentUserData.kennitala.replace(/-/g, '');
      const memberDocRef = doc(db, 'members', kennitalaKey);

      debug.log('📝 Firestore path: /members/' + kennitalaKey);

      // Delete old address field (root level) and save new addresses array
      await updateDoc(memberDocRef, {
        'profile.addresses': this.addresses,
        'profile.updated_at': new Date(),
        'address': deleteField()  // Remove old address structure
      });

      debug.log('✅ Addresses saved successfully to Firestore');
      debug.log('🗑️ Old address field deleted from root level');

      if (statusIcon) {
        statusIcon.className = 'profile-field__status profile-field__status--success';
        debug.log('✓ Showing success checkmark');

        setTimeout(() => {
          statusIcon.className = 'profile-field__status';
          debug.log('ℹ️ Cleared status icon');
        }, 2000);
      }

      // Only show toast if not silent mode
      if (!silent) {
        showToast(R.string.profile_address_saved, 'success');
        debug.log('🎉 Toast notification shown');
      } else {
        debug.log('🔕 Toast notification suppressed (silent mode)');
      }

      // Update simple display to show changes in collapsed view
      this.updateSimpleDisplay();

    } catch (error) {
      debug.error('❌ Failed to save addresses:', error);

      if (statusIcon) {
        statusIcon.className = 'profile-field__status profile-field__status--error';
        debug.log('✕ Showing error icon');

        setTimeout(() => {
          statusIcon.className = 'profile-field__status';
        }, 3000);
      }

      // Always show error toast (even in silent mode)
      showToast(R.string.profile_address_save_error, 'error');
      debug.log('⚠️ Error toast notification shown');
    }
  }

  /**
   * Toggle section visibility
   */
  toggleSection() {
    const section = document.getElementById('addresses-section');
    const expandIcon = document.getElementById('address-expand-icon');
    const simpleDisplay = document.getElementById('value-address-simple');

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
    const addBtn = document.getElementById('btn-add-address');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.add());
    }

    const label = document.getElementById('label-addresses');
    if (label) {
      label.addEventListener('click', () => this.toggleSection());
    }
  }
}
