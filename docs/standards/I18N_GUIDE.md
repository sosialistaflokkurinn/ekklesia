# Ekklesia Internationalization (i18n) Guide

**Last Updated**: 2025-11-04
**Status**: ✅ Active - XML-based R.string Pattern
**Purpose**: Internationalization system for multilingual support
**Location**: Relocated from `apps/members-portal/i18n/README.md`

---

## Overview

This is an XML-based internationalization (i18n) system modeled after Android's `strings.xml` pattern. All user-facing strings are centralized in XML files for easy translation and maintenance.

### Benefits

- ✅ **Familiar pattern** - Same as Android's `R.string.key_name`
- ✅ **Centralized translations** - All strings in one file per locale
- ✅ **Easy to add languages** - Just create new `values-xx/strings.xml`
- ✅ **No build step** - Loads at runtime in browser
- ✅ **Type-safe** - IDE autocomplete works with R.string
- ✅ **Standard format** - Compatible with translation tools

---

## Structure

```
i18n/
├── README.md                      # Original documentation
├── strings-loader.js              # XML parser and R.string implementation
└── values-is/                     # Icelandic locale (default)
    └── strings.xml                # 200+ Icelandic strings
```

### Adding New Locales

To add English translations:

```
i18n/
└── values-en/
    └── strings.xml                # English strings
```

To add German translations:

```
i18n/
└── values-de/
    └── strings.xml                # German strings
```

---

## Usage in HTML Files

### 1. Import and Load

```javascript
import { R } from '/i18n/strings-loader.js';

// Wait for strings to load (must be at top of script)
await R.load('is');  // Load Icelandic (default)
```

### 2. Access Strings

```javascript
// Simple string access
document.title = R.string.page_title;
document.getElementById('btn-login').textContent = R.string.btn_login;

// Check if string exists
if (R.has('error_message')) {
  console.log(R.string.error_message);
}
```

### 3. Format Strings with Placeholders

```javascript
// String with placeholder in strings.xml:
// <string name="error_authentication">Villa við auðkenningu: %s</string>

// Format with value:
const errorMsg = R.format(R.string.error_authentication, error.message);
// Result: "Villa við auðkenningu: Invalid token"
```

### 4. Configuration Values

Configuration values (URLs, constants) are also stored in strings.xml:

```javascript
// Instead of hardcoding:
const API_URL = 'https://events-service-521240388393.europe-west2.run.app';

// Use from strings.xml:
const API_URL = R.string.config_api_events;
```

---

## strings.xml Format

### Basic String

```xml
<string name="key_name">Value in target language</string>
```

### String with Placeholder

```xml
<string name="error_message">Error: %s</string>
```

Usage:
```javascript
R.format(R.string.error_message, "Connection failed")
// => "Error: Connection failed"
```

### Multi-argument Format

```xml
<string name="welcome_user">%s, %s!</string>
```

Usage:
```javascript
R.format(R.string.welcome_user, "Velkominn", "Jón")
// => "Velkominn, Jón!"
```

---

## Complete Example

### HTML File

```html
<!DOCTYPE html>
<html lang="is">
<head>
  <meta charset="UTF-8">
  <title>Loading...</title>
</head>
<body>
  <h1 id="title">Loading...</h1>
  <button id="btn-login">Loading...</button>
  <p id="error-msg"></p>

  <script type="module">
    import { R } from '/i18n/strings-loader.js';

    // Wait for strings to load
    await R.load('is');

    // Update page with translated strings
    document.title = R.string.page_title;
    document.getElementById('title').textContent = R.string.login_title;
    document.getElementById('btn-login').textContent = R.string.btn_login;

    // Show error with formatting
    const error = { message: "Network timeout" };
    const errorElement = document.getElementById('error-msg');
    errorElement.textContent = R.format(R.string.error_message, error.message);
  </script>
</body>
</html>
```

### strings.xml

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="page_title">Innskráning - Sósíalistaflokkurinn</string>
    <string name="login_title">Innskráning</string>
    <string name="btn_login">Skrá inn með Kenni.is</string>
    <string name="error_message">Villa: %s</string>
</resources>
```

---

## API Reference

### R.load(locale)

Load strings for specified locale.

```javascript
await R.load('is');  // Load Icelandic
await R.load('en');  // Load English (if values-en/strings.xml exists)
```

**Returns**: `Promise<void>`

### R.string.{key}

Access string by key.

```javascript
const title = R.string.page_title;
const button = R.string.btn_login;
```

**Returns**: `string` (empty string if key not found)

### R.format(template, ...args)

Format string with placeholders.

```javascript
R.format(R.string.error_message, "Connection failed")
// => "Villa: Connection failed"

R.format(R.string.welcome_user, "Velkominn", "Jón")
// => "Velkominn, Jón!"
```

**Parameters**:
- `template` - String with `%s` or `%d` placeholders
- `...args` - Values to substitute

**Returns**: `string`

### R.has(key)

Check if string key exists.

```javascript
if (R.has('error_message')) {
  console.log('Error message is defined');
}
```

**Returns**: `boolean`

### R.getAll()

Get all loaded strings (for debugging).

```javascript
const allStrings = R.getAll();
console.log('Loaded strings:', Object.keys(allStrings).length);
```

**Returns**: `Object`

### R.getLocale()

Get current locale.

```javascript
const locale = R.getLocale();  // => "is"
```

**Returns**: `string`

### R.isLoaded()

Check if strings are loaded.

```javascript
if (R.isLoaded()) {
  console.log('Strings ready');
}
```

**Returns**: `boolean`

---

## String Organization in strings.xml

### Recommended Structure

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- ========================================== -->
    <!-- PAGE METADATA -->
    <!-- ========================================== -->
    <string name="app_name">Sósíalistaflokkurinn</string>
    <string name="page_title">Innskráning - Sósíalistaflokkurinn</string>

    <!-- ========================================== -->
    <!-- LOGIN PAGE -->
    <!-- ========================================== -->
    <string name="login_title">Innskráning</string>
    <string name="btn_login">Skrá inn með Kenni.is</string>

    <!-- ========================================== -->
    <!-- ERRORS -->
    <!-- ========================================== -->
    <string name="error_authentication">Villa við auðkenningu: %s</string>

    <!-- ========================================== -->
    <!-- CONFIGURATION (not translated) -->
    <!-- ========================================== -->
    <string name="config_api_events">https://events-service-521240388393.europe-west2.run.app</string>
</resources>
```

### Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Page title | `page_title_*` | `page_title_dashboard` |
| Button | `btn_*` | `btn_login`, `btn_submit` |
| Label | `label_*` | `label_name`, `label_email` |
| Error | `error_*` | `error_authentication` |
| Status | `status_*` | `status_authenticated` |
| Navigation | `nav_*` | `nav_dashboard`, `nav_logout` |
| Configuration | `config_*` | `config_api_events` |
| Console log | `log_*` | `log_authentication_error` |
| Test page | `test_*` | `test_auth_title` |

---

## Integration with Code Standards

### HTML Integration

All user-facing text must have `id` attributes for i18n:

✅ **Good** (i18n-ready):
```html
<h1 id="page-title">Loading...</h1>
<button id="btn-save" class="btn">Loading...</button>
<label id="label-name" class="form__label">Loading...</label>
```

**JavaScript** (populate with i18n strings):
```javascript
import { R } from '/i18n/strings-loader.js';
await R.load('is');

document.getElementById('page-title').textContent = R.string.page_title;
document.getElementById('btn-save').textContent = R.string.btn_save;
document.getElementById('label-name').textContent = R.string.label_name;
```

❌ **Bad** (hardcoded):
```html
<h1>Félagakerfi</h1>  <!-- Hardcoded Icelandic text -->
<button class="btn">Vista</button>  <!-- Not translatable -->
```

**Why**: All text must be translatable. Use `R.string` pattern for all languages.

---

### JavaScript Integration

Always import and load i18n at the top of your module:

```javascript
// ✅ Good: Import and load at module top
import { R } from '/i18n/strings-loader.js';
import { auth, db } from './firebase-config.js';

await R.load('is');  // Load before using strings

// Now use R.string throughout the file
document.title = R.string.page_title;
console.log(R.string.log_authentication_success);
```

```javascript
// ❌ Bad: Hardcoded strings
document.title = 'Félagakerfi';
console.log('Authentication successful');
```

---

### CSS Integration

CSS should never contain user-facing text (use content injection instead):

❌ **Bad** (text in CSS):
```css
.btn--save::after {
  content: "Vista";  /* Hardcoded Icelandic */
}
```

✅ **Good** (text in HTML/JS):
```html
✅ **Good** (text in HTML/JS):
```html
<button id="btn-save" class="btn">Loading...</button>

<script type="module">
import { R } from '/i18n/strings-loader.js';
await R.load('is');

document.getElementById('btn-save').textContent = R.string.btn_save;
</script>
```

---

## Reusable HTML Initialization Pattern

**Pattern Used**: Admin Elections Dashboard, Create Wizard, Edit Forms

### Overview

For pages with many text elements (20+ strings), use a consistent initialization pattern that loads i18n strings before the page renders.

### Implementation Steps

**1. Add IDs to ALL text elements in HTML**

```html
<!DOCTYPE html>
<html lang="is">
<head>
  <title id="page-title">Loading...</title>
</head>
<body>
  <nav>
    <a href="/" id="nav-home">Loading...</a>
    <a href="/about" id="nav-about">Loading...</a>
    <button id="logout-btn">Loading...</button>
  </nav>
  
  <main>
    <h1 id="page-heading">Loading...</h1>
    <p id="page-description">Loading...</p>
    
    <form>
      <label for="name" id="label-name">Loading...</label>
      <input id="name" type="text" placeholder="Loading...">
      <small id="help-name">Loading...</small>
      
      <button type="submit" id="btn-submit">Loading...</button>
    </form>
  </main>
</body>
</html>
```

**2. Add i18n initialization script BEFORE other scripts**

```html
<!-- i18n Initialization -->
<script type="module">
  import { R } from '../i18n/strings-loader.js';
  
  // Load i18n strings before anything else
  await R.load('is');
  
  // Set page metadata
  document.getElementById('page-title').textContent = R.string.page_title;
  
  // Set navigation
  document.getElementById('nav-home').textContent = R.string.nav_home;
  document.getElementById('nav-about').textContent = R.string.nav_about;
  document.getElementById('logout-btn').textContent = R.string.btn_logout;
  
  // Set main content
  document.getElementById('page-heading').textContent = R.string.page_heading;
  document.getElementById('page-description').textContent = R.string.page_description;
  
  // Set form labels and placeholders
  document.getElementById('label-name').textContent = R.string.label_name;
  document.getElementById('name').placeholder = R.string.placeholder_name;
  document.getElementById('help-name').textContent = R.string.help_name;
  document.getElementById('btn-submit').textContent = R.string.btn_submit;
</script>

<!-- Other scripts AFTER i18n -->
<script type="module" src="./app.js"></script>
```

**3. Follow naming conventions in strings.xml**

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
  <!-- Page metadata -->
  <string name="page_title">Page Title - Company Name</string>
  
  <!-- Navigation -->
  <string name="nav_home">Home</string>
  <string name="nav_about">About</string>
  <string name="btn_logout">Log out</string>
  
  <!-- Content -->
  <string name="page_heading">Main Heading</string>
  <string name="page_description">Page description text</string>
  
  <!-- Form -->
  <string name="label_name">Name</string>
  <string name="placeholder_name">Enter your name...</string>
  <string name="help_name">Full legal name</string>
  <string name="btn_submit">Submit Form</string>
</resources>
```

### Naming Conventions

| Element Type | Convention | Example |
|--------------|------------|---------|
| Page titles | `{page}_page_title` | `admin_elections_page_title` |
| Navigation | `nav_{section}` or `admin_nav_{section}` | `nav_home`, `admin_nav_elections` |
| Headings | `{page}_heading` or `{section}_title` | `create_election_heading`, `step_1_title` |
| Labels | `label_{field}` | `label_election_title` |
| Placeholders | `placeholder_{field}` | `placeholder_election_description` |
| Help text | `help_{field}` | `help_election_title` |
| Buttons | `btn_{action}` | `btn_save`, `btn_create` |
| Progress steps | `wizard_step_{n}` | `wizard_step_1` |
| Step content | `step_{n}_title`, `step_{n}_description` | `step_2_description` |

### Benefits

✅ **Consistent**: Same pattern across all admin pages  
✅ **Maintainable**: Easy to find and update strings  
✅ **Translatable**: All text centralized for translators  
✅ **Searchable**: Clear naming makes code grep-friendly  
✅ **Type-safe**: IDE autocomplete with R.string  
✅ **Reusable**: Pattern works for any multi-step form or dashboard  

### Real-World Example

**Used in**: 
- `apps/members-portal/admin-elections/index.html` (Elections List - 30+ strings)
- `apps/members-portal/admin-elections/create.html` (Create Wizard - 50+ strings)

**Files**: 
- HTML: Add IDs to elements
- JavaScript: Import R, no hardcoded strings
- strings.xml: All user-facing text

See [Epic #192](https://github.com/sosialistaflokkurinn/ekklesia/issues/192) for full implementation details.

---
```

**Exception**: Icons and decorative symbols (not language-specific) are OK:
```css
.status-icon--success::after {
  content: "✓";  /* Universal symbol, not language-specific */
}
```

---

## Translation Workflow

### 1. Add New String

Edit `values-is/strings.xml`:

```xml
<string name="new_feature_title">Nýr eiginleiki</string>
```

### 2. Use in Code

```javascript
document.getElementById('title').textContent = R.string.new_feature_title;
```

### 3. Add Translations

Create `values-en/strings.xml`:

```xml
<string name="new_feature_title">New Feature</string>
```

### 4. Switch Locale

```javascript
await R.load('en');  // Load English translations
```

---

## Debugging

### Check Loaded Strings

```javascript
console.log('Loaded strings:', R.getAll());
console.log('Total count:', Object.keys(R.getAll()).length);
console.log('Current locale:', R.getLocale());
```

### Check if String Exists

```javascript
if (!R.has('my_key')) {
  console.warn('Missing translation key: my_key');
}
```

### View in Browser Console

```javascript
// Access R globally (for debugging)
window.R = R;

// Then in console:
R.string.page_title
R.getAll()
R.has('error_message')
```

---

## Best Practices

### ✅ DO

- Use descriptive key names: `error_authentication_failed` not `err1`
- Group related strings with prefixes: `nav_*`, `btn_*`, `error_*`
- Add comments to organize sections in XML
- Use formatting for dynamic values: `%s`
- Store configuration in strings.xml too (URLs, constants)
- Always `await R.load()` at the top of your module
- Check `R.has()` before accessing potentially missing keys
- Use `R.format()` for strings with dynamic content

### ❌ DON'T

- Don't hardcode strings in HTML or JavaScript
- Don't use abbreviations in key names
- Don't mix languages in one strings.xml file
- Don't forget to handle missing keys (use `R.has()`)
- Don't skip `await R.load()` at the start
- Don't put user-facing text in CSS
- Don't use inline text in HTML (use `id` + JavaScript)

---

## Common Patterns

### Pattern 1: Page Initialization

```javascript
import { R } from '/i18n/strings-loader.js';
import { auth } from './firebase-config.js';

// Load i18n first
await R.load('is');

// Set page metadata
document.title = R.string.page_title;

// Populate UI elements
document.getElementById('page-heading').textContent = R.string.heading_dashboard;
document.getElementById('btn-logout').textContent = R.string.btn_logout;

// Log in user's language
console.log(R.string.log_page_loaded);
```

---

### Pattern 2: Dynamic Error Messages

```javascript
async function saveProfile() {
  try {
    await updateDoc(docRef, profileData);
    console.log(R.string.log_save_success);
  } catch (error) {
    console.error(R.format(R.string.error_save, error.message));

    // Show user-friendly error
    const errorElement = document.getElementById('error-message');
    errorElement.textContent = R.format(R.string.error_save_user, error.message);
  }
}
```

**strings.xml**:
```xml
<string name="log_save_success">Profile saved successfully</string>
<string name="error_save">Error saving profile: %s</string>
<string name="error_save_user">Could not save profile. Please try again.</string>
```

---

### Pattern 3: Configuration Constants

```javascript
// Instead of hardcoding API URLs
const EVENTS_API = R.string.config_api_events;
const ELECTIONS_API = R.string.config_api_elections;

async function fetchEvents() {
  const response = await fetch(`${EVENTS_API}/api/events`);
  // ...
}
```

**strings.xml**:
```xml
<!-- Configuration (not translated across locales) -->
<string name="config_api_events">https://events-service-ymzrguoifa-nw.a.run.app</string>
<string name="config_api_elections">https://elections-service-ymzrguoifa-nw.a.run.app</string>
```

**Why**: Centralizes configuration, easier to update for different environments.

---

### Pattern 4: Conditional Text

```javascript
const isAdmin = user.role === 'admin';

// Use different strings based on role
document.getElementById('welcome').textContent = isAdmin
  ? R.string.welcome_admin
  : R.string.welcome_member;
```

**strings.xml**:
```xml
<string name="welcome_admin">Velkominn, stjórnandi</string>
<string name="welcome_member">Velkominn, félagi</string>
```

---

## Migration from Old i18n System

### Before (is.js)

```javascript
import { R } from '/i18n/R.js';

// Direct property access
const title = R.string.page_title;
```

### After (strings.xml)

```javascript
import { R } from '/i18n/strings-loader.js';

// Wait for XML to load
await R.load('is');

// Same property access
const title = R.string.page_title;
```

**Changes**:
1. Import from `strings-loader.js` instead of `R.js`
2. Add `await R.load('is')` at the top of your script
3. String access remains the same: `R.string.{key}`

---

## File Locations

### Source Files

- **Loader**: `apps/members-portal/i18n/strings-loader.js`
- **Icelandic strings**: `apps/members-portal/i18n/values-is/strings.xml`
- **English strings** (future): `apps/members-portal/i18n/values-en/strings.xml`

### HTML Files Using i18n

All HTML files use the XML-based i18n system:

1. ✅ `apps/members-portal/index.html` - Login page
2. ✅ `apps/members-portal/members-area/dashboard.html` - Dashboard
3. ✅ `apps/members-portal/members-area/profile.html` - Profile page
4. ✅ `apps/members-portal/admin/*.html` - Admin pages

All files import from `strings-loader.js` and call `await R.load('is')` before accessing strings.

---

## Future Enhancements

Possible improvements:

- [ ] Add English translations (`values-en/strings.xml`)
- [ ] Add plurals support (e.g., "1 vote" vs "2 votes")
- [ ] Add string arrays for lists
- [ ] Add date/number formatting
- [ ] Build-time validation of string keys
- [ ] VSCode extension for autocomplete
- [ ] Pre-commit hook to detect hardcoded strings

---

## Related Documentation

- **HTML Guide**: [/docs/standards/HTML_GUIDE.md](/docs/standards/HTML_GUIDE.md)
- **JavaScript Guide**: [/docs/standards/JAVASCRIPT_GUIDE.md](/docs/standards/JAVASCRIPT_GUIDE.md)
- **Master Code Standards**: [/docs/CODE_STANDARDS.md](/docs/CODE_STANDARDS.md)

**External Resources**:
- **Android strings.xml reference**: https://developer.android.com/guide/topics/resources/string-resource
- **i18n Best Practices**: https://developer.mozilla.org/en-US/docs/Web/Localization

---

**Last Updated**: 2025-11-04
**Locale**: Icelandic (is) - Default
**String Count**: 200+ strings in values-is/strings.xml
**Status**: ✅ Active - Required for all user-facing text
