# Icelandic Strings (values-is)

Icelandic language strings for the Policy Session feature.

## Files

- **`policy-session-strings.xml`** - XML string resources (Android format)
- **`strings-loader.js`** - Runtime string loader

## Usage

Strings are loaded automatically by the i18n system:

```javascript
import { R } from './i18n/strings-loader.js';

// Access strings
const title = R.string.policy_session_title;
const description = R.string.policy_session_description;
```

## String Format

```xml
<resources>
    <string name="policy_session_title">Stefnuþing</string>
    <string name="policy_session_description">Umræður og atkvæðagreiðslur...</string>
</resources>
```

## Related

- [i18n Guide](../../../../../docs/standards/I18N_GUIDE.md)
- [Policy Session Strings](./policy-session-strings.xml)
