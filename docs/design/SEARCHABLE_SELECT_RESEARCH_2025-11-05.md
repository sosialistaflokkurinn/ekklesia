# Google-Style Dropdown Research & Implementation Plan

**Date**: 2025-11-05
**Goal**: Replace all `<select>` dropdowns with Google-style searchable dropdowns
**Target**: Member profile page (phone country codes) + Admin pages

---

## 📊 Current Dropdowns Found

### 1. **Profile Page** - Country Code Selectors (2 instances)
- **Location**: `js/profile.js` lines 1476, 1612
- **Purpose**: Select country code for phone numbers
- **Features**: Shows flag emoji + country code (e.g., "🇮🇸 +354")
- **Current**: Native `<select>` dropdown
- **Issue**: ~200 countries, hard to find without search

### 2. **Admin Members List** - Filters (2 instances)
- **Location**: `admin/members.html` lines 86, 95
- **Filters**:
  - Status filter: "Allir", "Virkir", "Óvirkir" (3 options)
  - Electoral district: 6 Icelandic districts
- **Current**: Native `<select>` dropdown
- **Issue**: Small number of options, but consistency needed

### 3. **Admin Member Edit** - Gender Select (1 instance)
- **Location**: `admin/member-edit.html` line 180
- **Purpose**: Select gender (Karl/Kona/Annað)
- **Current**: Native `<select>` dropdown
- **Issue**: Only 3 options, might not need search

### 4. **Test Events Page** - Test Controls (2 instances)
- **Location**: `members-area/test-events.html` lines 111, 134
- **Purpose**: Development/testing controls
- **Priority**: Low (test page only)

---

## 🎯 Implementation Options

### Option 1: **Pure CSS/Vanilla JS** (Recommended for this project)

**Pros**:
- ✅ No external dependencies
- ✅ Full control over styling
- ✅ Matches existing BEM architecture
- ✅ Lightweight (~5KB)
- ✅ Easy to customize

**Cons**:
- ❌ More development time
- ❌ Need to handle accessibility manually

**Complexity**: Medium
**Time**: 4-6 hours

---

### Option 2: **Tom Select** (Modern, lightweight)

**Website**: https://tom-select.js.org/
**Size**: 32KB (minified)
**License**: Apache 2.0

**Pros**:
- ✅ Modern, actively maintained
- ✅ Vanilla JS (no jQuery)
- ✅ Great accessibility (ARIA)
- ✅ Virtual scrolling (good for 200+ countries)
- ✅ Keyboard navigation
- ✅ Custom render functions (for flags)
- ✅ Small bundle size

**Cons**:
- ❌ External dependency
- ❌ Need to customize CSS to match design

**Complexity**: Low
**Time**: 2-3 hours

---

### Option 3: **Choices.js**

**Website**: https://choices-js.github.io/Choices/
**Size**: 47KB (minified)
**License**: MIT

**Pros**:
- ✅ Very popular (9k+ stars)
- ✅ No dependencies
- ✅ Good documentation
- ✅ Configurable

**Cons**:
- ❌ Slightly larger than Tom Select
- ❌ Less modern API

**Complexity**: Low
**Time**: 2-3 hours

---

### Option 4: **Select2** (Classic, jQuery-based)

**NOT RECOMMENDED** - Requires jQuery, outdated

---

## 🏗️ Recommended Architecture

### Custom Vanilla JS Component

Create `/js/components/searchable-select.js`:

```javascript
/**
 * Searchable Select Component
 * 
 * Google-style dropdown with search/filter capability
 * Replaces native <select> with custom accessible dropdown
 * 
 * Features:
 * - Type to search/filter
 * - Keyboard navigation (↑↓ Enter Esc)
 * - ARIA accessibility
 * - Custom rendering (for flags, icons)
 * - Mobile-friendly
 * 
 * Usage:
 *   import { createSearchableSelect } from './searchable-select.js';
 *   
 *   const dropdown = createSearchableSelect({
 *     options: [
 *       { value: 'IS', label: '🇮🇸 +354', searchTerms: ['iceland', 'ísland', '354'] },
 *       { value: 'US', label: '🇺🇸 +1', searchTerms: ['usa', 'america', 'united states'] }
 *     ],
 *     placeholder: 'Search countries...',
 *     onChange: (value) => console.log('Selected:', value)
 *   });
 */

class SearchableSelect {
  constructor(element, options) {
    this.element = element;
    this.options = options;
    this.selectedValue = null;
    this.isOpen = false;
    this.filteredOptions = [...options];
    this.focusedIndex = -1;
    
    this.init();
  }
  
  init() {
    // Create wrapper
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'searchable-select';
    
    // Create trigger button
    this.trigger = this.createTrigger();
    
    // Create dropdown panel
    this.dropdown = this.createDropdown();
    
    // Create search input
    this.searchInput = this.createSearchInput();
    
    // Create options list
    this.optionsList = this.createOptionsList();
    
    // Assemble
    this.wrapper.appendChild(this.trigger);
    this.wrapper.appendChild(this.dropdown);
    this.dropdown.appendChild(this.searchInput);
    this.dropdown.appendChild(this.optionsList);
    
    // Replace original select
    this.element.parentNode.insertBefore(this.wrapper, this.element);
    this.element.style.display = 'none';
    
    // Event listeners
    this.attachEventListeners();
  }
  
  createTrigger() {
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'searchable-select__trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    
    const label = document.createElement('span');
    label.className = 'searchable-select__label';
    label.textContent = this.options.placeholder || 'Select...';
    
    const icon = document.createElement('span');
    icon.className = 'searchable-select__icon';
    icon.innerHTML = '▼';
    
    trigger.appendChild(label);
    trigger.appendChild(icon);
    
    return trigger;
  }
  
  createDropdown() {
    const dropdown = document.createElement('div');
    dropdown.className = 'searchable-select__dropdown';
    dropdown.style.display = 'none';
    dropdown.setAttribute('role', 'listbox');
    
    return dropdown;
  }
  
  createSearchInput() {
    const wrapper = document.createElement('div');
    wrapper.className = 'searchable-select__search';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'searchable-select__input';
    input.placeholder = 'Type to search...';
    input.setAttribute('aria-label', 'Search options');
    
    wrapper.appendChild(input);
    return wrapper;
  }
  
  createOptionsList() {
    const list = document.createElement('ul');
    list.className = 'searchable-select__list';
    
    return list;
  }
  
  // ... rest of implementation
}
```

---

## 📝 Implementation Steps

### Phase 1: Create Component (2-3 hours)

1. ✅ Research complete
2. Create `/js/components/searchable-select.js`
3. Create `/styles/components/searchable-select.css`
4. Implement core functionality:
   - Open/close dropdown
   - Search/filter logic
   - Keyboard navigation
   - Selection handling
5. Add accessibility (ARIA)
6. Mobile responsive styles

### Phase 2: Integrate in Profile (1-2 hours)

1. Replace country code selectors in `profile.js`
2. Preserve flag emoji rendering
3. Test phone number country selection
4. Test autosave functionality

### Phase 3: Integrate in Admin (1 hour)

1. Replace status filter dropdown
2. Replace electoral district filter
3. Update member edit gender selector
4. Test filtering functionality

### Phase 4: Polish & Test (1 hour)

1. Browser testing (Chrome, Firefox, Safari)
2. Mobile testing
3. Accessibility testing (screen reader)
4. Keyboard-only navigation testing

---

## 🎨 Design Specs (Based on Screenshot)

### Visual Design

```
┌─────────────────────────────────┐
│ 🇮🇸 +354               ▼        │  ← Trigger button (closed)
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ 🔍 [Type to search...        ] │  ← Search input
├─────────────────────────────────┤
│ 🇺🇸 +1                          │
│ 🇮🇸 +354                    ★   │  ← Selected (with star)
│ 🇩🇰 +45                         │
│ 🇸🇪 +46                         │
│ 🇳🇴 +47                         │
│ ⋮                               │
└─────────────────────────────────┘
```

### CSS Variables

```css
.searchable-select {
  --select-border-color: #e2e8f0;
  --select-border-radius: 8px;
  --select-bg: white;
  --select-text: #1a202c;
  --select-hover-bg: #f7fafc;
  --select-focus-border: #4299e1;
  --select-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  --select-max-height: 300px;
}
```

---

## 🔍 Key Features Required

### 1. Search/Filter
- Case-insensitive search
- Match country name OR code
- Highlight matching text
- Clear button (X icon)

### 2. Keyboard Navigation
- `↓` - Next option
- `↑` - Previous option
- `Enter` - Select focused option
- `Esc` - Close dropdown
- `Tab` - Close and move to next field
- Type to search immediately

### 3. Accessibility
- ARIA roles: `listbox`, `option`
- ARIA states: `aria-expanded`, `aria-selected`
- Screen reader announcements
- Focus management
- High contrast mode support

### 4. Mobile
- Touch-friendly (44x44px minimum)
- Virtual keyboard integration
- Scroll lock when open
- Bottom sheet style on small screens

### 5. Integration
- Drop-in replacement for `<select>`
- Preserve form submission values
- Support `<optgroup>` (for grouping)
- Custom render function for options

---

## 💡 Recommendation

**Use Tom Select** for fastest implementation:

```html
<!-- Add to HTML -->
<link href="https://cdn.jsdelivr.net/npm/tom-select@2.3.1/dist/css/tom-select.css" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/tom-select@2.3.1/dist/js/tom-select.complete.min.js"></script>
```

```javascript
// Initialize
new TomSelect('#country-selector', {
  maxOptions: null,
  sortField: { field: 'text', direction: 'asc' },
  render: {
    option: (data, escape) => {
      return `<div>${getCountryFlag(data.value)} ${escape(data.text)}</div>`;
    },
    item: (data, escape) => {
      return `<div>${getCountryFlag(data.value)} ${escape(data.text)}</div>`;
    }
  }
});
```

**OR Build Custom** for full control and no dependencies (takes longer but cleaner).

---

## 🤔 Decision Time

**What do you prefer?**

1. **Tom Select** (CDN, 2-3 hours, production-ready)
2. **Custom Vanilla JS** (4-6 hours, full control, no deps)
3. **Choices.js** (CDN, 2-3 hours, slightly larger)

Let me know and I'll start implementation! 🚀
