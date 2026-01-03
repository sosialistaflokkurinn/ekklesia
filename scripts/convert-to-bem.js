#!/usr/bin/env node
/**
 * BEM Class Name Conversion Script
 *
 * Converts current CSS class naming (prefix-name) to canonical BEM methodology:
 * - Blocks: .block (e.g., .nav, .card, .form)
 * - Elements: .block__element (e.g., .nav__link, .card__title)
 * - Modifiers: .block--modifier or .block__element--modifier
 * - Utilities: .u-name (e.g., .u-hidden, .u-margin-top-md)
 *
 * This follows industry-standard BEM, not custom notation.
 */

const fs = require('fs');
const path = require('path');

// Canonical BEM conversion mapping
const COMPONENT_MAPPINGS = {
  // Navigation component (block: nav)
  'nav-header': 'nav',
  'nav-container': 'nav__container',
  'nav-brand': 'nav__brand',
  'nav-links': 'nav__links',
  'nav-link': 'nav__link',
  'nav-logout': 'nav__link--logout',

  // Page component (block: page)
  'page-container': 'page__container',
  'page-header': 'page__header',
  'page-title': 'page__title',
  'page-subtitle': 'page__subtitle',

  // Card component (block: card)
  'card': 'card',
  'card-title': 'card__title',
  'card-content': 'card__content',
  'welcome-card': 'card--welcome',

  // Info grid component (block: info-grid)
  'info-grid': 'info-grid',
  'info-item': 'info-grid__item',
  'info-label': 'info-grid__label',
  'info-value': 'info-grid__value',

  // Login/Status component (block: status)
  'status': 'status',
  'info-box': 'info-box',

  // Debug log component (block: debug-log)
  'debug-log': 'debug-log',
  'log-entry': 'debug-log__entry',
  'timestamp': 'debug-log__timestamp',

  // Button component (block: btn)
  'btn': 'btn',

  // Form component (block: form)
  'form-group': 'form__group',
  'form-label': 'form__label',
  'form-input': 'form__input',
  'form-input-monospace': 'form__input--monospace',
  'form-select': 'form__select',

  // Test page component (block: test)
  'event-title': 'event-title',
  'auth-status': 'auth-status',
  'status-badge': 'status-badge',
  'status-authenticated': 'status-badge--authenticated',
  'status-unauthenticated': 'status-badge--unauthenticated',
  'user-details': 'user-details',
  'api-info': 'api-info',
  'test-section': 'test-section',
  'test-title': 'test-section__title',
  'test-result': 'test-section__result',
  'test-success': 'test-section__result--success',
  'test-error': 'test-section__result--error',

  // Utility classes (prefix: u-)
  'clickable': 'u-clickable',
  'disabled': 'u-disabled',
  'hidden': 'u-hidden',
  'margin-top-sm': 'u-margin-top-sm',
  'margin-top-md': 'u-margin-top-md',
  'margin-bottom-xs': 'u-margin-bottom-xs',
  'margin-bottom-sm': 'u-margin-bottom-sm',
  'margin-bottom-md': 'u-margin-bottom-md',
  'text-muted': 'u-text-muted',
  'text-error': 'u-text-error',

  // Base/root classes (keep as-is)
  'container': 'container',
  'subtitle': 'subtitle',

  // State classes (keep as-is, applied to blocks)
  // These are applied as: <div class="nav__link nav__link--active">
  // We'll handle .active specially in conversion
};

// Files to convert
const CSS_FILES = [
  'members/public/styles/global.css',
  'members/public/styles/components/page.css',
  'members/public/styles/components/nav.css',
  'members/public/styles/components/login.css',
  'members/public/styles/components/events-test.css',
];

const HTML_FILES = [
  'members/public/index.html',
  'members/public/dashboard.html',
  'members/public/profile.html',
  'members/public/test-events.html',
];

let stats = {
  cssFiles: 0,
  htmlFiles: 0,
  cssConversions: 0,
  htmlConversions: 0,
  errors: [],
};

/**
 * Convert CSS class selector
 */
function convertCSSClass(cssContent) {
  let converted = cssContent;
  let conversions = [];

  // Sort by length (longest first) to avoid partial replacements
  const sortedMappings = Object.entries(COMPONENT_MAPPINGS)
    .sort((a, b) => b[0].length - a[0].length);

  sortedMappings.forEach(([oldClass, newClass]) => {
    // Match CSS selectors: .class-name
    const regex = new RegExp(`\\.${oldClass}(?![a-z-])`, 'g');
    const matches = converted.match(regex);

    if (matches) {
      converted = converted.replace(regex, `.${newClass}`);
      conversions.push({ old: oldClass, new: newClass, count: matches.length });
    }
  });

  // Handle .class.active patterns -> .class.class--active
  // Example: .nav-link.active → .nav__link.nav__link--active
  converted = converted.replace(/\.nav__link\.active/g, '.nav__link.nav__link--active');
  converted = converted.replace(/\.btn\.secondary/g, '.btn.btn--secondary');

  // Handle descendant selectors that need updating
  // Example: .welcome-card .card-title → .card--welcome .card__title
  converted = converted.replace(/\.card--welcome \.card__title/g, '.card--welcome .card__title');
  converted = converted.replace(/\.card--welcome \.card__content/g, '.card--welcome .card__content');
  converted = converted.replace(/\.debug-log \.debug-log__entry/g, '.debug-log .debug-log__entry');
  converted = converted.replace(/\.debug-log \.debug-log__timestamp/g, '.debug-log .debug-log__timestamp');
  converted = converted.replace(/\.debug-log \.success/g, '.debug-log .success');
  converted = converted.replace(/\.debug-log \.error/g, '.debug-log .error');
  converted = converted.replace(/\.debug-log \.info/g, '.debug-log .info');
  converted = converted.replace(/\.user-details div/g, '.user-details div');

  return { content: converted, conversions };
}

/**
 * Convert HTML class attributes
 */
function convertHTMLClass(htmlContent) {
  let converted = htmlContent;
  let conversions = [];

  // Sort by length (longest first)
  const sortedMappings = Object.entries(COMPONENT_MAPPINGS)
    .sort((a, b) => b[0].length - a[0].length);

  sortedMappings.forEach(([oldClass, newClass]) => {
    // Match class attributes: class="... old-class ..."
    const patterns = [
      // class="old-class"
      new RegExp(`class="${oldClass}"`, 'g'),
      // class="old-class other"
      new RegExp(`class="${oldClass}\\s`, 'g'),
      // class="other old-class"
      new RegExp(`\\s${oldClass}"`, 'g'),
      // class="other old-class more"
      new RegExp(`\\s${oldClass}\\s`, 'g'),
    ];

    let totalMatches = 0;
    patterns.forEach((regex, idx) => {
      const matches = converted.match(regex);
      if (matches) {
        totalMatches += matches.length;
        switch (idx) {
          case 0:
            converted = converted.replace(regex, `class="${newClass}"`);
            break;
          case 1:
            converted = converted.replace(regex, `class="${newClass} `);
            break;
          case 2:
            converted = converted.replace(regex, ` ${newClass}"`);
            break;
          case 3:
            converted = converted.replace(regex, ` ${newClass} `);
            break;
        }
      }
    });

    if (totalMatches > 0) {
      conversions.push({ old: oldClass, new: newClass, count: totalMatches });
    }
  });

  // Handle .active state class → BEM modifier
  // class="nav-link active" → class="nav__link nav__link--active"
  converted = converted.replace(
    /class="nav__link active"/g,
    'class="nav__link nav__link--active"'
  );
  converted = converted.replace(
    /class="nav__link nav__link--active active"/g,
    'class="nav__link nav__link--active"'
  );

  // Handle .secondary modifier for buttons
  converted = converted.replace(
    /class="btn secondary"/g,
    'class="btn btn--secondary"'
  );

  return { content: converted, conversions };
}

/**
 * Process CSS file
 */
function processCSSFile(filePath, dryRun = false) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const { content: converted, conversions } = convertCSSClass(content);

    if (!dryRun && converted !== content) {
      fs.writeFileSync(filePath, converted, 'utf8');
    }

    stats.cssFiles++;
    stats.cssConversions += conversions.length;

    return { success: true, conversions };
  } catch (error) {
    stats.errors.push({ file: filePath, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Process HTML file
 */
function processHTMLFile(filePath, dryRun = false) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const { content: converted, conversions } = convertHTMLClass(content);

    if (!dryRun && converted !== content) {
      fs.writeFileSync(filePath, converted, 'utf8');
    }

    stats.htmlFiles++;
    stats.htmlConversions += conversions.length;

    return { success: true, conversions };
  } catch (error) {
    stats.errors.push({ file: filePath, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Main conversion function
 */
function convert(dryRun = false) {
  console.log('Converting CSS classes to canonical BEM methodology...\n');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No files will be modified\n');
  }

  // Process CSS files
  console.log('CSS Files:');
  CSS_FILES.forEach(filePath => {
    const result = processCSSFile(filePath, dryRun);
    if (result.success) {
      console.log(`  ✓ ${filePath}`);
      result.conversions.forEach(conv => {
        console.log(`    - .${conv.old} → .${conv.new} (${conv.count} occurrences)`);
      });
    } else {
      console.log(`  ✗ ${filePath} - ERROR: ${result.error}`);
    }
  });

  console.log('\nHTML Files:');
  HTML_FILES.forEach(filePath => {
    const result = processHTMLFile(filePath, dryRun);
    if (result.success) {
      console.log(`  ✓ ${filePath}`);
      result.conversions.forEach(conv => {
        console.log(`    - class="${conv.old}" → class="${conv.new}" (${conv.count} occurrences)`);
      });
    } else {
      console.log(`  ✗ ${filePath} - ERROR: ${result.error}`);
    }
  });

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Summary:');
  console.log(`  - ${stats.cssFiles} CSS files processed`);
  console.log(`  - ${stats.htmlFiles} HTML files processed`);
  console.log(`  - ${stats.cssConversions} CSS conversions`);
  console.log(`  - ${stats.htmlConversions} HTML conversions`);
  console.log(`  - ${stats.errors.length} errors`);

  if (stats.errors.length > 0) {
    console.log('\nErrors:');
    stats.errors.forEach(err => {
      console.log(`  ✗ ${err.file}: ${err.error}`);
    });
  }

  if (dryRun) {
    console.log('\n💡 Run without --dry-run to apply changes');
  } else {
    console.log('\n✅ Conversion complete!');
    console.log('\n📋 Canonical BEM Structure:');
    console.log('  - Blocks: .nav, .card, .form');
    console.log('  - Elements: .nav__link, .card__title, .form__input');
    console.log('  - Modifiers: .nav__link--active, .card--welcome');
    console.log('  - Utilities: .u-hidden, .u-margin-top-md');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Run conversion
convert(dryRun);
