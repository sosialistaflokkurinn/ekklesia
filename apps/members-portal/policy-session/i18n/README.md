# Policy Session Internationalization (i18n)

This directory contains localized strings for the Policy Session area.

## Structure

```
i18n/
├── strings-loader.js          # Strings loader for policy-session
└── values-is/                 # Icelandic translations
    └── strings.xml            # Policy session strings
```

## Usage

The `strings-loader.js` automatically loads strings from the `values-{locale}/strings.xml` file based on the current locale.

```javascript
import { R } from '../i18n/strings-loader.js';

// Load strings for Icelandic
await R.load('is');

// Access strings
console.log(R.string.amendment_submit); // "Senda inn breytingatillögu"
```

## String Categories

### Amendment Form
- `amendment_*` - Amendment submission form labels and messages

### Voting
- `vote_*` - Voting buttons, confirmations, and status messages

### Results
- `results_*` - Results display labels and headings

### Phase Management
- `phase_*` - Phase titles and descriptions
- `filter_*` - Phase filter button labels

### Policy Items
- `policy_*` - Policy item voting headings

### Final Vote
- `final_vote_*` - Final policy vote labels and options

## Adding New Strings

1. Add the string to `values-is/strings.xml`:
```xml
<string name="new_string_key">Íslenskur texti</string>
```

2. Use in JavaScript:
```javascript
const text = R.string.new_string_key;
```

## Supported Locales

- `is` - Íslenska (Icelandic) - Default

## Best Practices

1. **Keep strings in XML**: Never hardcode UI text in JavaScript
2. **Use descriptive names**: Name keys based on their purpose (e.g., `amendment_submit`, not `button_text`)
3. **Group by feature**: Use prefixes to group related strings (e.g., `vote_*`, `amendment_*`)
4. **Include context**: Add XML comments to explain complex strings
5. **Reuse when possible**: Check if a similar string exists before creating new ones

## Testing

After adding or modifying strings:

1. Refresh the page (hard refresh with Ctrl+Shift+R)
2. Check browser console for string loading confirmation
3. Verify all UI text displays correctly
4. Test with missing strings (should gracefully handle undefined strings)

## Migration from Global Strings

Policy session strings were extracted from `/i18n/values-is/strings.xml` to create this dedicated i18n directory. This allows policy-session to be self-contained with its own localization resources.
