# XML-based i18n System (Android strings.xml style)

**Created**: 2025-10-12
**Type**: Internationalization System
**Pattern**: Android R.string

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
├── README.md                      # This file
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

### ❌ DON'T

- Don't hardcode strings in HTML or JavaScript
- Don't use abbreviations in key names
- Don't mix languages in one strings.xml file
- Don't forget to handle missing keys (use `R.has()`)
- Don't skip `await R.load()` at the start

---

## Files Updated

All HTML files now use the XML-based i18n system:

1. ✅ `public/index.html` - Login page
2. ✅ `public/dashboard.html` - Dashboard
3. ✅ `public/profile.html` - Profile page
4. ✅ `public/test-events.html` - Events test page

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

---

## Related Documentation

- **Android strings.xml reference**: https://developer.android.com/guide/topics/resources/string-resource
- **Project i18n strategy**: See main project README

---

**Last Updated**: 2025-10-12
**Locale**: Icelandic (is) - Default
**String Count**: 200+ strings in values-is/strings.xml
