/**
 * Address Management
 *
 * Handles address CRUD operations, rendering, and auto-save for profile page.
 * Supports multiple addresses with country selection and default marking.
 *
 * @module profile/address-manager
 */

import { R } from '../../i18n/strings-loader.js';
import { getFirebaseFirestore, httpsCallable } from '../../firebase/app.js';
import { doc, updateDoc, deleteField } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Cloud Function for syncing profile updates to Django
const updateMemberProfileFunction = httpsCallable('updatememberprofile', 'europe-west2');
import { getCountriesSorted, getCountryFlag } from '../utils/util-countries.js';
import { debug } from '../utils/util-debug.js';
import { showToast } from '../components/ui-toast.js';
import { showStatus, createStatusIcon } from '../components/ui-status.js';
import { SearchableSelect } from '../components/ui-searchable-select.js';
import { AddressAutocomplete } from '../components/member-address-autocomplete.js';
import { el } from '../utils/util-dom.js';

// Cloud Function for Icelandic address validation (iceaddr)
const validateAddressFunction = httpsCallable('validate_address', 'europe-west2');

// Store autocomplete instances for cleanup
const autocompleteInstances = new Map();

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
   * Validate Icelandic address using iceaddr Cloud Function
   * Only validates if country is Iceland (IS) and street + number are filled
   *
   * @param {number} index - Address index to validate
   * @param {HTMLElement} statusIcon - Status icon element for feedback
   * @returns {Promise<Object|null>} Validated address data or null
   */
  async validateIcelandicAddress(index, statusIcon) {
    const address = this.addresses[index];

    // Only validate Icelandic addresses
    if (address.country !== 'IS') {
      debug.log('🌍 Skipping validation - not Icelandic address');
      return null;
    }

    // Need street and number for validation
    if (!address.street || !address.number) {
      debug.log('ℹ️ Skipping validation - missing street or number');
      return null;
    }

    try {
      debug.log(`🔍 Validating Icelandic address: ${address.street} ${address.number}${address.letter || ''}`);

      const result = await validateAddressFunction({
        street: address.street,
        number: parseInt(address.number, 10) || address.number,
        letter: address.letter || '',
        postal_code: address.postal_code ? parseInt(address.postal_code, 10) : undefined
      });

      if (result.data.valid && result.data.address) {
        const validated = result.data.address;
        debug.log('✅ Address validated:', validated);

        // Auto-fill city if empty or different
        if (!address.city || address.city !== validated.city) {
          debug.log(`🏙️ Auto-filling city: "${address.city}" → "${validated.city}"`);
          this.addresses[index].city = validated.city;
        }

        // Auto-fill postal code if empty
        if (!address.postal_code && validated.postal_code) {
          debug.log(`📮 Auto-filling postal code: → "${validated.postal_code}"`);
          this.addresses[index].postal_code = String(validated.postal_code);
        }

        // Store GPS coordinates for future use (e.g., map display)
        this.addresses[index].latitude = validated.latitude;
        this.addresses[index].longitude = validated.longitude;
        this.addresses[index].hnitnum = validated.hnitnum;

        debug.log(`📍 GPS stored: ${validated.latitude}, ${validated.longitude}`);

        return validated;
      } else {
        debug.warn('⚠️ Address not found in national registry:', result.data.error);
        // Don't prevent saving - user might know their address better
        return null;
      }
    } catch (error) {
      debug.error('❌ Address validation failed:', error);
      // Don't prevent saving on validation error
      return null;
    }
  }

  /**
   * Get current addresses
   */
  getAddresses() {
    return this.addresses;
  }

  /**
   * Format address as single display string
   * @param {Object} address - Address object with street, number, letter, postal_code, city
   * @returns {string} Formatted address string like "Gullengi 37A, 112 Reykjavík"
   */
  formatAddressString(address) {
    const parts = [];
    
    // Street + number + letter
    const streetPart = [
      address.street || '',
      address.number || '',
    ].filter(Boolean).join(' ');
    
    const fullStreet = streetPart + (address.letter || '');
    if (fullStreet.trim()) {
      parts.push(fullStreet.trim());
    }
    
    // Postal code + city
    const locationPart = [
      address.postal_code || '',
      address.city || ''
    ].filter(Boolean).join(' ');
    
    if (locationPart.trim()) {
      parts.push(locationPart.trim());
    }
    
    return parts.join(', ');
  }

  /**
   * Parse address string back into fields
   * Handles formats like "Gullengi 37A, 112 Reykjavík" or "Gullengi 37, 112 Reykjavík"
   * @param {string} addressString - Full address string
   * @returns {Object} Parsed address fields
   */
  parseAddressString(addressString) {
    const result = {
      street: '',
      number: '',
      letter: '',
      postal_code: '',
      city: ''
    };
    
    if (!addressString || !addressString.trim()) {
      return result;
    }
    
    // Split by comma - first part is street+number, second is postal+city
    const parts = addressString.split(',').map(p => p.trim());
    
    if (parts[0]) {
      // Parse street part: "Gullengi 37A" or "Gullengi 37"
      // Match: street name, then number, then optional letter
      const streetMatch = parts[0].match(/^(.+?)\s+(\d+)([A-Za-z])?$/);
      if (streetMatch) {
        result.street = streetMatch[1].trim();
        result.number = streetMatch[2];
        result.letter = streetMatch[3] || '';
      } else {
        // No number found, treat whole thing as street
        result.street = parts[0];
      }
    }
    
    if (parts[1]) {
      // Parse location part: "112 Reykjavík"
      const locationMatch = parts[1].match(/^(\d+)\s*(.*)$/);
      if (locationMatch) {
        result.postal_code = locationMatch[1];
        result.city = locationMatch[2].trim();
      } else {
        // No postal code, treat as city
        result.city = parts[1];
      }
    }
    
    return result;
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
          color: 'var(--color-gray-500)',
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
          try {
            await this.save();
            showStatus(statusIcon, 'success', { baseClass: 'profile-field__status' });
            this.render();
          } catch (error) {
            debug.error('Failed to save address country:', error);
            showStatus(statusIcon, 'error', { baseClass: 'profile-field__status' });
            // Revert change
            this.addresses[index].country = address.country;
            this.render();
          }
        }
      });

      // Default star icon
      const defaultIcon = el('span', 'item-default-icon', {
        title: address.is_default ? R.string.profile_address_default_set : R.string.profile_address_set_default,
        onclick: () => this.setDefault(index)
      }, address.is_default ? '⭐' : '☆');

      // Save button (cosmetic - actual save happens on blur)
      const saveBtn = el('button', 'item-save-btn', {
        title: R.string.btn_save || 'Vista',
        type: 'button',
        onclick: async () => {
          // Trigger blur on address input to save
          addressInput.blur();
          // Show brief feedback
          showStatus(statusIcon, 'success', { baseClass: 'profile-field__status' });
        }
      }, '💾');

      // Delete button
      const deleteBtn = el('button', 'item-delete-btn', {
        title: R.string.profile_address_delete,
        disabled: this.addresses.length === 1,
        onclick: () => this.delete(index)
      }, '🗑️');

      // Single unified address input
      // Shows full address like "Gullengi 37A, 112 Reykjavík"
      const addressWrapper = el('div', 'address-input--unified-wrapper', {});
      const addressInput = el('input', 'address-input address-input--unified', {
        type: 'text',
        value: this.formatAddressString(address),
        placeholder: R.string.label_full_address || 'Heimilisfang (t.d. Gullengi 37, 112 Reykjavík)'
      });
      addressWrapper.appendChild(addressInput);

      // Initialize autocomplete for Icelandic addresses only
      if (address.country === 'IS') {
        // Cleanup previous autocomplete instance if any
        const prevInstance = autocompleteInstances.get(`address-${index}`);
        if (prevInstance) {
          prevInstance.destroy();
        }

        const autocomplete = new AddressAutocomplete(addressInput, {
          onSelect: async (selectedAddress) => {
            debug.log('🏠 Autocomplete selected:', selectedAddress.display);

            // Auto-fill all address fields
            this.addresses[index].street = selectedAddress.street;
            this.addresses[index].number = String(selectedAddress.number || '');
            this.addresses[index].letter = selectedAddress.letter || '';
            this.addresses[index].postal_code = String(selectedAddress.postal_code || '');
            this.addresses[index].city = selectedAddress.city || '';

            // Store GPS silently (user doesn't see this)
            this.addresses[index].latitude = selectedAddress.latitude;
            this.addresses[index].longitude = selectedAddress.longitude;
            this.addresses[index].hnitnum = selectedAddress.hnitnum;

            // Update the input with formatted address
            addressInput.value = this.formatAddressString(this.addresses[index]);

            debug.log(`📍 GPS stored: ${selectedAddress.latitude}, ${selectedAddress.longitude}`);

            // Save
            showStatus(statusIcon, 'loading', { baseClass: 'profile-field__status' });
            try {
              await this.save();
              showStatus(statusIcon, 'success', { baseClass: 'profile-field__status' });
              this.updateSimpleDisplay();
            } catch (error) {
              debug.error('Failed to save autocomplete selection:', error);
              showStatus(statusIcon, 'error', { baseClass: 'profile-field__status' });
            }
          }
        });

        autocompleteInstances.set(`address-${index}`, autocomplete);
        debug.log(`🔍 Autocomplete initialized for address ${index}`);
      }

      // On blur, parse the address string and save
      addressInput.addEventListener('blur', async (e) => {
        const newValue = e.target.value.trim();
        const oldValue = this.formatAddressString(address);
        
        debug.log(`🏠 Address blur (index ${index}): "${oldValue}" → "${newValue}"`);

        if (newValue !== oldValue) {
          debug.log('✏️ Address changed, parsing and updating...');
          
          // Parse the new address string
          const parsed = this.parseAddressString(newValue);
          debug.log('📋 Parsed address:', parsed);
          
          // Update address fields
          this.addresses[index].street = parsed.street;
          this.addresses[index].number = parsed.number;
          this.addresses[index].letter = parsed.letter;
          this.addresses[index].postal_code = parsed.postal_code;
          this.addresses[index].city = parsed.city;
          
          showStatus(statusIcon, 'loading', { baseClass: 'profile-field__status' });
          try {
            // Validate if Icelandic address
            if (address.country === 'IS' && parsed.street && parsed.number) {
              const validated = await this.validateIcelandicAddress(index, statusIcon);
              if (validated) {
                // Update input with validated/corrected address
                addressInput.value = this.formatAddressString(this.addresses[index]);
              }
            }
            await this.save();
            showStatus(statusIcon, 'success', { baseClass: 'profile-field__status' });
            this.updateSimpleDisplay();
          } catch (error) {
            debug.error('Failed to save address:', error);
            showStatus(statusIcon, 'error', { baseClass: 'profile-field__status' });
            // Revert
            e.target.value = oldValue;
            this.addresses[index].street = address.street;
            this.addresses[index].number = address.number;
            this.addresses[index].letter = address.letter;
            this.addresses[index].postal_code = address.postal_code;
            this.addresses[index].city = address.city;
          }
        } else {
          debug.log('ℹ️ No change, skipping save');
        }
      });

      // Single row with all controls: Country + Address input + Status + Default star + Delete
      const singleRow = el('div', 'address-item__row', {},
        countrySelector,
        addressWrapper,
        statusIcon,
        saveBtn,
        defaultIcon,
        deleteBtn
      );

      // Assemble (single row layout)
      const addressItem = el('div', `address-item${address.is_default ? ' address-item--default' : ''}`, {},
        singleRow
      );

      container.appendChild(addressItem);

      // Initialize SearchableSelect for country
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

    // Focus on the new unified address input
    const inputs = document.querySelectorAll('.address-input--unified');
    if (inputs.length > 0) {
      const lastInput = inputs[inputs.length - 1];
      if (lastInput) {
        lastInput.focus();
        debug.log('   🎯 Focused on new address input');
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

      // Sync to Django via Cloud Function (non-blocking)
      try {
        debug.log('🔄 Syncing addresses to Django...');
        const syncResult = await updateMemberProfileFunction({
          kennitala: this.currentUserData.kennitala,
          updates: {
            addresses: this.addresses
          }
        });
        debug.log('✅ Django sync completed:', syncResult.data);
      } catch (syncError) {
        // Log but don't fail - Firestore save already succeeded
        debug.warn('⚠️ Django sync failed (Firestore save succeeded):', syncError.message);
      }

      if (statusIcon) {
        statusIcon.className = 'profile-field__status profile-field__status--success';
        debug.log('✓ Showing success checkmark');

        setTimeout(() => {
          statusIcon.className = 'profile-field__status';
          debug.log('ℹ️ Cleared status icon');
        }, 2000);
      }

      // Status icon shows success - no toast needed

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

    // Ensure section starts collapsed (set inline style for toggle logic)
    const section = document.getElementById('addresses-section');
    const simpleDisplay = document.getElementById('value-address-simple');
    if (section) {
      section.style.display = 'none';
    }
    if (simpleDisplay) {
      simpleDisplay.style.display = 'block';
    }
  }
}
