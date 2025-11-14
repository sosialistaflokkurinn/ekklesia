// @ts-nocheck
/**
 * Searchable Select Component
 * 
 * Google-style dropdown with search/filter capability.
 * Drop-in replacement for native <select> elements.
 * 
 * Features:
 * - Type to search/filter options
 * - Keyboard navigation (↑↓ Enter Esc Tab)
 * - Full ARIA accessibility
 * - Custom option rendering (for flags, icons)
 * - Mobile-friendly
 * - BEM methodology
 * 
 * Usage:
 * ```javascript
 * import { SearchableSelect } from './searchable-select.js';
 * 
 * const select = new SearchableSelect(document.getElementById('my-select'), {
 *   placeholder: 'Select country...',
 *   searchPlaceholder: 'Type to search...',
 *   noResultsText: 'No results found',
 *   renderOption: (option) => `${option.flag} ${option.label}`,
 *   onChange: (value, option) => console.log('Selected:', value)
 * });
 * ```
 * 
 * @module components/searchable-select
 */

import { debug } from '../utils/debug.js';

export class SearchableSelect {
  /**
   * Create a searchable select
   * @param {HTMLSelectElement} selectElement - Original <select> element
   * @param {Object} options - Configuration options
   * @param {string} options.placeholder - Placeholder when nothing selected
   * @param {string} options.searchPlaceholder - Search input placeholder
   * @param {string} options.noResultsText - Text when no results found
   * @param {Function} options.renderOption - Custom render function for options
   * @param {Function} options.onChange - Callback when value changes
   */
  constructor(selectElement, options = {}) {
    if (!selectElement || selectElement.tagName !== 'SELECT') {
      throw new Error('SearchableSelect requires a <select> element');
    }

    this.selectElement = selectElement;
    this.options = {
      placeholder: options.placeholder || 'Select...',
      searchPlaceholder: options.searchPlaceholder || 'Type to search...',
      noResultsText: options.noResultsText || 'No results found',
      renderOption: options.renderOption || ((opt) => opt.label),
      renderSelected: options.renderSelected || options.renderOption || ((opt) => opt.label),
      onChange: options.onChange || (() => {}),
      maxHeight: options.maxHeight || '300px'
    };

    // Parse options from <select>
    this.allOptions = this.parseSelectOptions();
    this.filteredOptions = [...this.allOptions];
    
    // State
    this.selectedValue = selectElement.value || null;
    this.isOpen = false;
    this.focusedIndex = -1;
    this.searchQuery = '';

    // Build UI
    this.buildUI();
    this.attachEventListeners();
    
    // Initialize with current value
    if (this.selectedValue) {
      this.selectOption(this.selectedValue, false);
    }

    debug.log('✅ SearchableSelect initialized:', {
      options: this.allOptions.length,
      selected: this.selectedValue
    });
  }

  /**
   * Parse options from original <select> element
   * @returns {Array} Array of option objects
   */
  parseSelectOptions() {
    const options = [];
    const selectOptions = this.selectElement.querySelectorAll('option');

    selectOptions.forEach((opt, index) => {
      if (opt.value) { // Skip empty/placeholder options
        options.push({
          value: opt.value,
          label: opt.textContent.trim(),
          selected: opt.selected,
          disabled: opt.disabled,
          index: index,
          element: opt,
          searchTerms: opt.getAttribute('data-search') || '' // For custom search terms
        });
      }
    });

    return options;
  }

  /**
   * Build the custom UI
   */
  buildUI() {
    // Wrapper
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'searchable-select';
    if (this.selectElement.disabled) {
      this.wrapper.classList.add('searchable-select--disabled');
    }

    // Trigger button
    this.trigger = this.createTrigger();
    
    // Dropdown panel
    this.dropdown = this.createDropdown();

    // Assemble
    this.wrapper.appendChild(this.trigger);
    this.wrapper.appendChild(this.dropdown);

    // Replace original select
    this.selectElement.style.display = 'none';
    this.selectElement.parentNode.insertBefore(this.wrapper, this.selectElement);

    // Store reference for cleanup
    this.selectElement._searchableSelect = this;
  }

  /**
   * Create trigger button
   */
  createTrigger() {
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'searchable-select__trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.disabled = this.selectElement.disabled;

    const label = document.createElement('span');
    label.className = 'searchable-select__label';
    label.textContent = this.options.placeholder;

    const icon = document.createElement('span');
    icon.className = 'searchable-select__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = `
      <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
        <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;

    trigger.appendChild(label);
    trigger.appendChild(icon);

    this.triggerLabel = label;
    return trigger;
  }

  /**
   * Create dropdown panel
   */
  createDropdown() {
    const dropdown = document.createElement('div');
    dropdown.className = 'searchable-select__dropdown';
    dropdown.style.display = 'none';
    dropdown.setAttribute('role', 'listbox');

    // Search input wrapper
    const searchWrapper = document.createElement('div');
    searchWrapper.className = 'searchable-select__search';

    const searchIcon = document.createElement('span');
    searchIcon.className = 'searchable-select__search-icon';
    searchIcon.setAttribute('aria-hidden', 'true');
    searchIcon.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.5"/>
        <path d="M11 11L14.5 14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    `;

    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.className = 'searchable-select__input';
    this.searchInput.placeholder = this.options.searchPlaceholder;
    this.searchInput.setAttribute('aria-label', 'Search options');
    this.searchInput.autocomplete = 'off';

    searchWrapper.appendChild(searchIcon);
    searchWrapper.appendChild(this.searchInput);

    // Options list
    this.optionsList = document.createElement('ul');
    this.optionsList.className = 'searchable-select__list';
    this.optionsList.style.maxHeight = this.options.maxHeight;
    this.optionsList.setAttribute('role', 'listbox');

    // No results message
    this.noResults = document.createElement('div');
    this.noResults.className = 'searchable-select__no-results';
    this.noResults.textContent = this.options.noResultsText;
    this.noResults.style.display = 'none';

    dropdown.appendChild(searchWrapper);
    dropdown.appendChild(this.optionsList);
    dropdown.appendChild(this.noResults);

    return dropdown;
  }

  /**
   * Render options list
   */
  renderOptions() {
    this.optionsList.innerHTML = '';
    this.filteredOptions.forEach((option, index) => {
      const li = document.createElement('li');
      li.className = 'searchable-select__option';
      li.setAttribute('role', 'option');
      li.setAttribute('data-value', option.value);
      li.setAttribute('data-index', index);

      if (option.value === this.selectedValue) {
        li.classList.add('searchable-select__option--selected');
        li.setAttribute('aria-selected', 'true');
      } else {
        li.setAttribute('aria-selected', 'false');
      }

      if (option.disabled) {
        li.classList.add('searchable-select__option--disabled');
        li.setAttribute('aria-disabled', 'true');
      }

      // Render option content
      const content = this.options.renderOption(option);
      if (typeof content === 'string') {
        li.innerHTML = content;
      } else {
        li.appendChild(content);
      }

      this.optionsList.appendChild(li);
    });

    // Show/hide no results
    if (this.filteredOptions.length === 0) {
      this.noResults.style.display = 'block';
      this.optionsList.style.display = 'none';
    } else {
      this.noResults.style.display = 'none';
      this.optionsList.style.display = 'block';
    }
  }

  /**
   * Filter options based on search query
   */
  filterOptions(query) {
    this.searchQuery = query.toLowerCase().trim();

    if (!this.searchQuery) {
      this.filteredOptions = [...this.allOptions];
    } else {
      this.filteredOptions = this.allOptions.filter(option => {
        const label = option.label.toLowerCase();
        const value = option.value.toLowerCase();
        
        // Check if option has custom search terms (data-search attribute)
        const searchTerms = option.searchTerms ? option.searchTerms.toLowerCase() : '';
        
        return label.includes(this.searchQuery) || 
               value.includes(this.searchQuery) ||
               searchTerms.includes(this.searchQuery);
      });
    }

    this.renderOptions();
    this.focusedIndex = -1; // Reset focus
  }

  /**
   * Open dropdown
   */
  open() {
    if (this.isOpen || this.selectElement.disabled) return;

    this.isOpen = true;
    this.wrapper.classList.add('searchable-select--open');
    this.dropdown.style.display = 'block';
    this.trigger.setAttribute('aria-expanded', 'true');

    // Render options
    this.renderOptions();

    // Focus search input
    setTimeout(() => {
      this.searchInput.focus();
      this.searchInput.select();
    }, 50);

    debug.log('📖 SearchableSelect opened');
  }

  /**
   * Close dropdown
   */
  close() {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.wrapper.classList.remove('searchable-select--open');
    this.dropdown.style.display = 'none';
    this.trigger.setAttribute('aria-expanded', 'false');

    // Clear search
    this.searchInput.value = '';
    this.filterOptions('');

    debug.log('📕 SearchableSelect closed');
  }

  /**
   * Toggle dropdown
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Select an option
   * @param {string} value - Option value
   * @param {boolean} triggerChange - Whether to trigger onChange callback
   */
  selectOption(value, triggerChange = true) {
    const option = this.allOptions.find(opt => opt.value === value);
    if (!option || option.disabled) return;

    // Update state
    const previousValue = this.selectedValue;
    this.selectedValue = value;

    // Update original select
    this.selectElement.value = value;

    // Update UI
    const content = this.options.renderSelected(option);
    if (typeof content === 'string') {
      this.triggerLabel.innerHTML = content;
    } else {
      this.triggerLabel.innerHTML = '';
      this.triggerLabel.appendChild(content);
    }

    // Update options
    this.renderOptions();

    // Close dropdown
    this.close();

    // Trigger change event on original select
    const event = new Event('change', { bubbles: true });
    this.selectElement.dispatchEvent(event);

    // Trigger callback
    if (triggerChange && previousValue !== value) {
      this.options.onChange(value, option);
    }

    debug.log('✅ Option selected:', value);
  }

  /**
   * Handle keyboard navigation
   */
  handleKeyDown(e) {
    if (!this.isOpen) {
      // Open on Enter/Space/ArrowDown when closed
      if (['Enter', ' ', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        this.open();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.focusNext();
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.focusPrevious();
        break;

      case 'Enter':
        e.preventDefault();
        if (this.focusedIndex >= 0 && this.focusedIndex < this.filteredOptions.length) {
          const option = this.filteredOptions[this.focusedIndex];
          this.selectOption(option.value);
        }
        break;

      case 'Escape':
        e.preventDefault();
        this.close();
        this.trigger.focus();
        break;

      case 'Tab':
        this.close();
        // Allow default tab behavior
        break;

      default:
        // Let search input handle other keys
        break;
    }
  }

  /**
   * Focus next option
   */
  focusNext() {
    if (this.filteredOptions.length === 0) return;

    this.focusedIndex = (this.focusedIndex + 1) % this.filteredOptions.length;
    this.updateFocusedOption();
  }

  /**
   * Focus previous option
   */
  focusPrevious() {
    if (this.filteredOptions.length === 0) return;

    this.focusedIndex = this.focusedIndex <= 0 
      ? this.filteredOptions.length - 1 
      : this.focusedIndex - 1;
    this.updateFocusedOption();
  }

  /**
   * Update visual focus on option
   */
  updateFocusedOption() {
    // Remove previous focus
    const previousFocused = this.optionsList.querySelector('.searchable-select__option--focused');
    if (previousFocused) {
      previousFocused.classList.remove('searchable-select__option--focused');
    }

    // Add focus to current
    if (this.focusedIndex >= 0 && this.focusedIndex < this.filteredOptions.length) {
      const options = this.optionsList.querySelectorAll('.searchable-select__option');
      const focused = options[this.focusedIndex];
      if (focused) {
        focused.classList.add('searchable-select__option--focused');
        focused.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Trigger click
    this.trigger.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggle();
    });

    // Trigger keyboard
    this.trigger.addEventListener('keydown', (e) => {
      this.handleKeyDown(e);
    });

    // Search input
    this.searchInput.addEventListener('input', (e) => {
      this.filterOptions(e.target.value);
    });

    // Search input keyboard
    this.searchInput.addEventListener('keydown', (e) => {
      this.handleKeyDown(e);
    });

    // Option clicks
    this.optionsList.addEventListener('click', (e) => {
      const optionEl = e.target.closest('.searchable-select__option');
      if (optionEl && !optionEl.classList.contains('searchable-select__option--disabled')) {
        const value = optionEl.dataset.value;
        this.selectOption(value);
      }
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (this.isOpen && !this.wrapper.contains(e.target)) {
        this.close();
      }
    });

    // ESC to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
        this.trigger.focus();
      }
    });
  }

  /**
   * Destroy the component and restore original select
   */
  destroy() {
    this.wrapper.remove();
    this.selectElement.style.display = '';
    delete this.selectElement._searchableSelect;
    
    debug.log('🗑️ SearchableSelect destroyed');
  }

  /**
   * Update options dynamically
   * @param {Array} newOptions - New options array
   */
  updateOptions(newOptions) {
    // Update original select
    this.selectElement.innerHTML = '';
    newOptions.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      if (opt.selected) option.selected = true;
      if (opt.disabled) option.disabled = true;
      this.selectElement.appendChild(option);
    });

    // Re-parse options
    this.allOptions = this.parseSelectOptions();
    this.filteredOptions = [...this.allOptions];

    // Re-render if open
    if (this.isOpen) {
      this.renderOptions();
    }

    debug.log('🔄 SearchableSelect options updated:', this.allOptions.length);
  }

  /**
   * Get the wrapper element (for consistency with component factory pattern)
   * @returns {HTMLElement} The wrapper element
   */
  get element() {
    return this.wrapper;
  }

  /**
   * Get current value
   */
  getValue() {
    return this.selectedValue;
  }

  /**
   * Set value programmatically
   * @param {string} value - Value to set
   */
  setValue(value) {
    this.selectOption(value, false);
  }
}

/**
 * Helper function to initialize all selects with data-searchable attribute
 */
export function initSearchableSelects() {
  const selects = document.querySelectorAll('select[data-searchable]');
  
  selects.forEach(select => {
    if (!select._searchableSelect) {
      new SearchableSelect(select, {
        placeholder: select.dataset.placeholder,
        searchPlaceholder: select.dataset.searchPlaceholder,
        noResultsText: select.dataset.noResults
      });
    }
  });

  debug.log(`✅ Initialized ${selects.length} searchable selects`);
}

export default SearchableSelect;
