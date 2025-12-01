/**
 * Address Autocomplete Component
 *
 * Shows dropdown suggestions as user types Icelandic street names.
 * Uses iceaddr Cloud Function for search.
 *
 * Usage:
 *   new AddressAutocomplete(inputElement, {
 *     onSelect: (address) => { ... }
 *   });
 *
 * @module components/address-autocomplete
 */

import { httpsCallable } from '../../firebase/app.js';
import { debug } from '../utils/debug.js';

// Cloud Function for address search
const searchAddresses = httpsCallable('search_addresses', 'europe-west2');

/**
 * Address Autocomplete Class
 *
 * Provides real-time address suggestions for Icelandic addresses.
 */
export class AddressAutocomplete {
  /**
   * Create an address autocomplete instance
   *
   * @param {HTMLInputElement} inputElement - The street input field
   * @param {Object} options - Configuration options
   * @param {Function} options.onSelect - Callback when address is selected
   * @param {number} options.debounceMs - Debounce delay in milliseconds (default: 300)
   * @param {number} options.minChars - Minimum characters before search (default: 2)
   */
  constructor(inputElement, options = {}) {
    this.input = inputElement;
    this.onSelect = options.onSelect || (() => {});
    this.debounceMs = options.debounceMs || 300;
    this.minChars = options.minChars || 2;

    this.dropdown = null;
    this.debounceTimer = null;
    this.results = [];
    this.selectedIndex = -1;
    this.isOpen = false;

    this.init();
  }

  /**
   * Initialize the autocomplete component
   */
  init() {
    // Create dropdown container
    this.dropdown = document.createElement('div');
    this.dropdown.className = 'address-autocomplete__dropdown';
    this.dropdown.style.display = 'none';
    this.dropdown.setAttribute('role', 'listbox');
    this.dropdown.setAttribute('aria-label', 'Address suggestions');

    // Ensure parent has relative positioning
    const wrapper = this.input.closest('.address-input--street-wrapper') ||
                    this.input.parentNode;
    wrapper.style.position = 'relative';
    wrapper.appendChild(this.dropdown);

    // Set ARIA attributes on input
    this.input.setAttribute('role', 'combobox');
    this.input.setAttribute('aria-autocomplete', 'list');
    this.input.setAttribute('aria-expanded', 'false');
    this.input.setAttribute('autocomplete', 'off');

    // Input event listeners
    this.input.addEventListener('input', (e) => this.handleInput(e));
    this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
    this.input.addEventListener('focus', (e) => this.handleFocus(e));
    this.input.addEventListener('blur', () => this.handleBlur());

    // Prevent dropdown from closing when clicking on it
    this.dropdown.addEventListener('mousedown', (e) => e.preventDefault());

    debug.log('🔍 AddressAutocomplete initialized');
  }

  /**
   * Handle input changes with debouncing
   */
  handleInput(e) {
    const query = e.target.value.trim();

    // Clear previous timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Hide if too short
    if (query.length < this.minChars) {
      this.hideDropdown();
      return;
    }

    // Debounce search
    this.debounceTimer = setTimeout(async () => {
      await this.search(query);
    }, this.debounceMs);
  }

  /**
   * Handle focus - show dropdown if we have results
   */
  handleFocus(e) {
    if (this.results.length > 0 && e.target.value.length >= this.minChars) {
      this.showDropdown();
    }
  }

  /**
   * Handle blur - hide dropdown with delay
   */
  handleBlur() {
    // Small delay to allow click events on dropdown
    setTimeout(() => {
      this.hideDropdown();
    }, 200);
  }

  /**
   * Search for addresses
   */
  async search(query) {
    debug.log(`🔍 Searching addresses: "${query}"`);

    try {
      const result = await searchAddresses({ query, limit: 10 });
      this.results = result.data.results || [];

      debug.log(`📍 Found ${this.results.length} addresses`);

      if (this.results.length > 0) {
        this.showDropdown();
      } else {
        this.hideDropdown();
      }
    } catch (error) {
      debug.error('Address search failed:', error);
      this.hideDropdown();
    }
  }

  /**
   * Show dropdown with results
   */
  showDropdown() {
    this.dropdown.innerHTML = '';
    this.selectedIndex = -1;

    this.results.forEach((result, index) => {
      const item = document.createElement('div');
      item.className = 'address-autocomplete__item';
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', 'false');
      item.setAttribute('data-index', index);

      // Create formatted display
      const streetSpan = document.createElement('span');
      streetSpan.className = 'address-autocomplete__street';
      streetSpan.textContent = `${result.street} ${result.number || ''}${result.letter || ''}`.trim();

      const locationSpan = document.createElement('span');
      locationSpan.className = 'address-autocomplete__location';
      locationSpan.textContent = `${result.postal_code || ''} ${result.city || ''}`.trim();

      item.appendChild(streetSpan);
      item.appendChild(locationSpan);

      item.addEventListener('click', () => this.selectResult(index));
      item.addEventListener('mouseover', () => {
        this.selectedIndex = index;
        this.highlightSelected();
      });

      this.dropdown.appendChild(item);
    });

    this.dropdown.style.display = 'block';
    this.isOpen = true;
    this.input.setAttribute('aria-expanded', 'true');
  }

  /**
   * Hide dropdown
   */
  hideDropdown() {
    this.dropdown.style.display = 'none';
    this.isOpen = false;
    this.selectedIndex = -1;
    this.input.setAttribute('aria-expanded', 'false');
  }

  /**
   * Handle keyboard navigation
   */
  handleKeydown(e) {
    if (!this.isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.results.length - 1);
        this.highlightSelected();
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.highlightSelected();
        break;

      case 'Enter':
        e.preventDefault();
        if (this.selectedIndex >= 0) {
          this.selectResult(this.selectedIndex);
        }
        break;

      case 'Escape':
        this.hideDropdown();
        break;

      case 'Tab':
        // Allow tab but select if there's a highlighted item
        if (this.selectedIndex >= 0) {
          this.selectResult(this.selectedIndex);
        }
        this.hideDropdown();
        break;
    }
  }

  /**
   * Highlight currently selected item
   */
  highlightSelected() {
    const items = this.dropdown.querySelectorAll('.address-autocomplete__item');
    items.forEach((item, i) => {
      const isSelected = i === this.selectedIndex;
      item.classList.toggle('address-autocomplete__item--selected', isSelected);
      item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });

    // Scroll selected item into view
    if (this.selectedIndex >= 0 && items[this.selectedIndex]) {
      items[this.selectedIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  /**
   * Select a result and trigger callback
   */
  selectResult(index) {
    const result = this.results[index];
    if (!result) return;

    debug.log('✅ Address selected:', result.display);

    // Update input with street name
    this.input.value = result.street;

    // Callback with full address data
    this.onSelect(result);

    this.hideDropdown();
  }

  /**
   * Destroy the autocomplete instance
   */
  destroy() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    if (this.dropdown && this.dropdown.parentNode) {
      this.dropdown.parentNode.removeChild(this.dropdown);
    }
    this.input.removeAttribute('role');
    this.input.removeAttribute('aria-autocomplete');
    this.input.removeAttribute('aria-expanded');
  }
}
