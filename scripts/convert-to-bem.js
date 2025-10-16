#!/usr/bin/env node
/**
 * BEM Class Name Conversion Script
 *
 * Converts current CSS class naming (prefix-name) to BEM methodology
 * according to design team standards:
 * - Use BEM: block__element--modifier
 * - Use --name for utility classes
 * - Skip base when not needed: --header instead of .block__header
 */

const fs = require('fs');
const path = require('path');

// Conversion mapping based on design team standards
const COMPONENT_MAPPINGS = {
  // Navigation component (skip base: use --name)
  'nav-header': '--header',
  'nav-container': '--container',
  'nav-brand': '--brand',
  'nav-links': '--links',
  'nav-link': '--link',
  'nav-logout': '--link--logout',

  // Page component
  'page-container': '--page-container',
  'page-header': '--page-header',
  'page-title': '--page-title',
  'page-subtitle': '--page-subtitle',

  // Card component
  'card': '--card',
  'card-title': '--card__title',
  'card-content': '--card__content',
  'welcome-card': '--card--welcome',

  // Info grid
  'info-grid': '--info-grid',
  'info-item': '--info-item',
  'info-label': '--info-label',
  'info-value': '--info-value',

  // Login component
  'status': '--status',
  'btn': '--btn',
  'info-box': '--info-box',
  'debug-log': '--debug-log',
  'log-entry': '--log-entry',
  'timestamp': '--timestamp',

  // Form component
  'form-group': '--form-group',
  'form-label': '--form-label',
  'form-input': '--form-input',
  'form-input-monospace': '--form-input--monospace',
  'form-select': '--form-select',

  // Test page component
  'event-title': '--event-title',
  'auth-status': '--auth-status',
  'status-badge': '--status-badge',
  'status-authenticated': '--status--authenticated',
  'status-unauthenticated': '--status--unauthenticated',
  'user-details': '--user-details',
  'api-info': '--api-info',
  'test-section': '--test-section',
  'test-title': '--test-title',
  'test-result': '--test-result',
  'test-success': '--test-result--success',
  'test-error': '--test-result--error',

  // Utility classes (already use -- prefix, keep as is)
  'clickable': '--clickable',
  'disabled': '--disabled',
  'hidden': '--hidden',
  'margin-top-sm': '--margin-top-sm',
  'margin-top-md': '--margin-top-md',
  'margin-bottom-xs': '--margin-bottom-xs',
  'margin-bottom-sm': '--margin-bottom-sm',
  'margin-bottom-md': '--margin-bottom-md',
  'text-muted': '--text-muted',
  'text-error': '--text-error',

  // Keep some classes as-is (base/root classes)
  'container': '--container',
  'subtitle': '--subtitle',
  'authenticated': 'authenticated', // body state class, keep without prefix
  'not-authenticated': 'not-authenticated',
  'authenticating': 'authenticating',
  'error': 'error',
  'success': 'success',
  'info': 'info',
  'active': 'active',
  'secondary': 'secondary',
};

// State modifiers that appear after class names (e.g., .nav-link.active)
const STATE_MODIFIERS = {
  'active': '--active',
  'authenticated': '--authenticated',
  'not-authenticated': '--not-authenticated',
  'authenticating': '--authenticating',
  'error': '--error',
  'success': '--success',
  'info': '--info',
  'secondary': '--secondary',
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
    // Handle both single and multiple classes
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
  console.log('Converting CSS classes to BEM methodology...\n');

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
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Run conversion
convert(dryRun);
