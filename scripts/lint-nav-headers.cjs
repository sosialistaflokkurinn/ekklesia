#!/usr/bin/env node
/**
 * Navigation Header Consistency Checker
 *
 * Ensures all pages have contextual navigation headers that describe
 * what the user is doing on each page, AND that pages appear in the
 * hamburger menu of related pages.
 *
 * Usage: node scripts/lint-nav-headers.cjs
 *
 * Rules:
 * - Each page must use initNavHeader() with a NAV_CONFIG
 * - Header text should describe the page context (not just party name)
 * - Exception: dashboard.html can use "Sósíalistaflokkurinn"
 * - New pages must have a matching NAV_CONFIG entry
 * - Pages must be included in the hamburger menu links of their area
 */

const fs = require('fs');
const path = require('path');

const PORTAL_PATH = path.join(__dirname, '../apps/members-portal');
const NAV_BAR_PATH = path.join(PORTAL_PATH, 'ui/components/navigation-bar.js');
const I18N_PATH = path.join(PORTAL_PATH, 'i18n/values-is/portal-strings.xml');

// Pages that are allowed to use generic "app_name" (Sósíalistaflokkurinn)
const ALLOWED_GENERIC_PAGES = [
  '/members-area/dashboard.html'
];

// Pages that don't need to be in hamburger menus (detail/sub-pages accessed from lists)
const DETAIL_PAGES = [
  '/elections/detail.html',           // Accessed from elections list
  '/admin/member-profile.html',       // Accessed from members list
  '/admin-elections/election-control.html',  // Accessed from elections list
  '/admin/email/campaigns.html',      // Sub-page under email/
  '/admin/email/logs.html',           // Sub-page under email/
  '/admin/email/send.html',           // Sub-page under email/
  '/admin/email/templates.html'       // Sub-page under email/
];

// Pages to ignore (redirects, dev tools, etc.)
// Use exact paths or directory prefixes
const IGNORED_PAGES = [
  '/index.html',                          // Root login page
  '/unsubscribe.html',                    // Email unsubscribe (no nav)
  '/dev-tools/',                          // Dev tools folder
  '/members-area/reactivate.html',        // Reactivation flow
  '/members-area/election-detail.html',   // Old redirect
  '/members-area/elections.html',         // Old redirect
  '/members-area/events.html',            // Old redirect
  '/admin/index.html',                    // Redirect to admin.html
  '/superuser/index.html',                // Redirect to superuser.html
  '/admin/migrate-events.html'            // Dev tool
];

// Colors for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(color, symbol, message) {
  console.log(`${color}${symbol}${colors.reset} ${message}`);
}

/**
 * Parse NAV_CONFIGS from navigation-bar.js
 * Returns: { configName: { textKey: string, links: string[] } }
 */
function parseNavConfigs() {
  const content = fs.readFileSync(NAV_BAR_PATH, 'utf-8');
  const configs = {};

  // Find each config block
  // Pattern: configName: { brand: { ... }, links: [ ... ] }
  const configBlockRegex = /(\w+):\s*\{[^{}]*brand:\s*\{[^}]+href:\s*'([^']+)'[^}]+textKey:\s*'([^']+)'[^}]*\}[^{}]*links:\s*\[([\s\S]*?)\]\s*(?:,\s*\/\/[^\n]*\n)?\s*\}/g;

  let match;
  while ((match = configBlockRegex.exec(content)) !== null) {
    const configName = match[1];
    const brandHref = match[2];
    const textKey = match[3];
    const linksBlock = match[4];

    // Extract hrefs from links array
    const linkHrefs = [];
    const hrefRegex = /href:\s*'([^']+)'/g;
    let linkMatch;
    while ((linkMatch = hrefRegex.exec(linksBlock)) !== null) {
      linkHrefs.push(linkMatch[1]);
    }

    configs[configName] = {
      textKey,
      brandHref,
      links: linkHrefs
    };
  }

  return configs;
}

/**
 * Get just the textKey for backward compatibility
 */
function getConfigTextKey(configs, configName) {
  return configs[configName]?.textKey || configName;
}

/**
 * Parse i18n strings from portal-strings.xml
 */
function parseI18nStrings() {
  const content = fs.readFileSync(I18N_PATH, 'utf-8');
  const strings = {};

  const stringRegex = /<string name="([^"]+)">([^<]+)<\/string>/g;
  let match;

  while ((match = stringRegex.exec(content)) !== null) {
    strings[match[1]] = match[2];
  }

  return strings;
}

/**
 * Find all HTML files in the portal
 */
function findHtmlFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules, .git, etc.
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
        findHtmlFiles(fullPath, files);
      }
    } else if (entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Extract NAV_CONFIG usage from HTML file
 */
function extractNavConfig(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Match: initNavHeader(NAV_CONFIGS.configName)
  const match = content.match(/initNavHeader\(NAV_CONFIGS\.(\w+)\)/);

  return match ? match[1] : null;
}

/**
 * Check if a page should be ignored
 */
function shouldIgnore(relativePath) {
  return IGNORED_PAGES.some(ignored => {
    // For directories (ending with /), check if path starts with it
    if (ignored.endsWith('/')) {
      return relativePath.startsWith(ignored);
    }
    // For exact file paths, match exactly
    return relativePath === ignored;
  });
}

/**
 * Check if a page is allowed to use generic header
 */
function isAllowedGeneric(relativePath) {
  return ALLOWED_GENERIC_PAGES.some(allowed => relativePath.endsWith(allowed));
}

/**
 * Main lint function
 */
function lintNavHeaders() {
  console.log(`\n${colors.bold}Navigation Header Consistency Check${colors.reset}\n`);
  console.log('=' .repeat(50) + '\n');

  const navConfigs = parseNavConfigs();
  const i18nStrings = parseI18nStrings();
  const htmlFiles = findHtmlFiles(PORTAL_PATH);

  const issues = [];
  const warnings = [];
  const successes = [];

  // Check each HTML file
  for (const filePath of htmlFiles) {
    const relativePath = '/' + path.relative(PORTAL_PATH, filePath);

    // Skip ignored pages
    if (shouldIgnore(relativePath)) {
      continue;
    }

    const configName = extractNavConfig(filePath);

    if (!configName) {
      // No nav config found - might be a page without navigation
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes('navigation-bar.js')) {
        issues.push({
          path: relativePath,
          issue: 'Imports navigation-bar.js but does not call initNavHeader()'
        });
      }
      continue;
    }

    // Check if config exists
    if (!navConfigs[configName]) {
      issues.push({
        path: relativePath,
        issue: `Uses NAV_CONFIGS.${configName} but config not found in navigation-bar.js`
      });
      continue;
    }

    const config = navConfigs[configName];
    const textKey = config.textKey;
    const headerText = i18nStrings[textKey] || textKey;

    // Check if using generic header when not allowed
    if (textKey === 'app_name' && !isAllowedGeneric(relativePath)) {
      warnings.push({
        path: relativePath,
        config: configName,
        header: headerText,
        warning: 'Uses generic "Sósíalistaflokkurinn" header - consider using contextual text'
      });
    } else {
      successes.push({
        path: relativePath,
        config: configName,
        header: headerText
      });
    }
  }

  // Check for unused NAV_CONFIGS
  const usedConfigs = new Set(successes.map(s => s.config).concat(warnings.map(w => w.config)));
  const unusedConfigs = Object.keys(navConfigs).filter(c => !usedConfigs.has(c));

  // Check hamburger menu links - pages should appear in related pages' menus
  const menuIssues = [];
  const allPagesWithConfig = [...successes, ...warnings];

  for (const page of allPagesWithConfig) {
    const config = navConfigs[page.config];
    if (!config) continue;

    // Skip detail pages - they're accessed from lists, not main navigation
    if (DETAIL_PAGES.includes(page.path)) continue;

    // Check if this page appears in the hamburger menu of configs that it SHOULD appear in
    // A page should appear in the menu of configs in the same "area"
    const pageArea = getPageArea(page.path);

    // Find all configs used by pages in the same area
    const sameAreaConfigs = allPagesWithConfig
      .filter(p => getPageArea(p.path) === pageArea && p.config !== page.config)
      .map(p => p.config);

    // Check if current page appears in those configs' links
    for (const otherConfigName of new Set(sameAreaConfigs)) {
      const otherConfig = navConfigs[otherConfigName];
      if (!otherConfig) continue;

      // Skip if the other config's brand points to this page (it's the "home" for that config)
      if (pathsMatch(otherConfig.brandHref, page.path)) continue;

      // Check if page is in the other config's links
      if (!pathInLinks(page.path, otherConfig.links)) {
        menuIssues.push({
          page: page.path,
          missingFrom: otherConfigName,
          area: pageArea
        });
      }
    }
  }

  /**
   * Get the area/section of a page
   */
  function getPageArea(pagePath) {
    if (pagePath.startsWith('/superuser/')) return 'superuser';
    if (pagePath.startsWith('/admin-elections/')) return 'admin-elections';
    if (pagePath.startsWith('/admin/')) return 'admin';
    if (pagePath.startsWith('/elections/')) return 'elections';
    if (pagePath.startsWith('/events/')) return 'events';
    if (pagePath.startsWith('/nomination/')) return 'nomination';
    if (pagePath.startsWith('/policy-session/')) return 'policy-session';
    if (pagePath.startsWith('/members-area/')) return 'members-area';
    return 'other';
  }

  /**
   * Normalize a path for comparison
   * /admin/ and /admin/admin.html and /admin/index.html are equivalent
   */
  function normalizePath(p) {
    // Remove trailing index.html or area-name.html
    if (p.endsWith('/index.html')) {
      return p.replace('/index.html', '/');
    }
    // Handle special cases like /admin/admin.html → /admin/
    // /superuser/superuser.html → /superuser/
    const match = p.match(/^(\/[^/]+)\/\1\.html$/);
    if (match) {
      // This doesn't work for nested paths, use simpler approach
    }
    // Simpler: check for pattern like /admin/admin.html
    if (p === '/admin/admin.html') return '/admin/';
    if (p === '/superuser/superuser.html') return '/superuser/';
    return p;
  }

  /**
   * Check if two paths are equivalent
   */
  function pathsMatch(path1, path2) {
    return normalizePath(path1) === normalizePath(path2);
  }

  /**
   * Check if a path is in a list of links
   */
  function pathInLinks(pagePath, links) {
    const normalizedPage = normalizePath(pagePath);
    return links.some(link => {
      const normalizedLink = normalizePath(link.startsWith('/') ? link : '/' + link);
      return normalizedPage === normalizedLink;
    });
  }

  // Print results
  console.log(`${colors.bold}Pages with contextual headers:${colors.reset}\n`);

  // Group by area (combine successes and warnings for display)
  const allPages = [...successes, ...warnings];
  const isMemberArea = (p) =>
    p.startsWith('/members-area/') ||
    p.startsWith('/elections/') ||
    p.startsWith('/events/') ||
    p.startsWith('/policy-session/') ||
    p.startsWith('/nomination/');
  const isAdminArea = (p) =>
    (p.startsWith('/admin/') || p.startsWith('/admin-elections/')) &&
    !p.startsWith('/admin-elections/');
  const isAdminElections = (p) => p.startsWith('/admin-elections/');
  const isSuperuserArea = (p) => p.startsWith('/superuser/');

  const areas = {
    'Members Area': allPages.filter(s => isMemberArea(s.path)),
    'Admin Area': allPages.filter(s => isAdminArea(s.path)),
    'Admin Elections': allPages.filter(s => isAdminElections(s.path)),
    'Superuser Area': allPages.filter(s => isSuperuserArea(s.path))
  };

  for (const [area, pages] of Object.entries(areas)) {
    if (pages.length > 0) {
      console.log(`  ${colors.blue}${area}:${colors.reset}`);
      for (const page of pages) {
        const isWarning = page.warning !== undefined;
        const color = isWarning ? colors.yellow : colors.green;
        const symbol = isWarning ? '⚠' : '✓';
        log(color, `  ${symbol}`, `${page.path} → "${page.header}"`);
      }
      console.log();
    }
  }

  // Print warnings
  if (warnings.length > 0) {
    console.log(`${colors.bold}${colors.yellow}Warnings:${colors.reset}\n`);
    for (const warn of warnings) {
      log(colors.yellow, '  ⚠', `${warn.path}`);
      console.log(`      ${warn.warning}`);
    }
    console.log();
  }

  // Print issues
  if (issues.length > 0) {
    console.log(`${colors.bold}${colors.red}Issues:${colors.reset}\n`);
    for (const issue of issues) {
      log(colors.red, '  ✗', `${issue.path}`);
      console.log(`      ${issue.issue}`);
    }
    console.log();
  }

  // Print menu issues (grouped by area)
  if (menuIssues.length > 0) {
    console.log(`${colors.bold}${colors.yellow}Missing from hamburger menus:${colors.reset}\n`);

    // Group by area
    const byArea = {};
    for (const mi of menuIssues) {
      if (!byArea[mi.area]) byArea[mi.area] = [];
      byArea[mi.area].push(mi);
    }

    for (const [area, areaIssues] of Object.entries(byArea)) {
      console.log(`  ${colors.blue}${area}:${colors.reset}`);
      // Deduplicate: show each page once with all configs it's missing from
      const pageMap = {};
      for (const mi of areaIssues) {
        if (!pageMap[mi.page]) pageMap[mi.page] = [];
        pageMap[mi.page].push(mi.missingFrom);
      }
      for (const [page, configs] of Object.entries(pageMap)) {
        log(colors.yellow, '    ⚠', `${page}`);
        console.log(`        Missing from: ${configs.join(', ')}`);
      }
      console.log();
    }
  }

  // Print unused configs (info only)
  if (unusedConfigs.length > 0) {
    console.log(`${colors.bold}Unused NAV_CONFIGS (may be for future pages):${colors.reset}\n`);
    for (const configName of unusedConfigs) {
      const cfg = navConfigs[configName];
      console.log(`    - ${configName} → "${i18nStrings[cfg.textKey] || cfg.textKey}"`);
    }
    console.log();
  }

  // Summary
  const uniqueMenuIssuePages = new Set(menuIssues.map(m => m.page)).size;
  console.log('=' .repeat(50));
  console.log(`\n${colors.bold}Summary:${colors.reset}`);
  console.log(`  ${colors.green}✓${colors.reset} ${successes.length} pages with contextual headers`);
  console.log(`  ${colors.yellow}⚠${colors.reset} ${warnings.length} header warnings`);
  console.log(`  ${colors.yellow}⚠${colors.reset} ${uniqueMenuIssuePages} pages missing from hamburger menus`);
  console.log(`  ${colors.red}✗${colors.reset} ${issues.length} issues\n`);

  // Exit code
  if (issues.length > 0) {
    console.log(`${colors.red}Fix issues before deploying!${colors.reset}\n`);
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log(`${colors.yellow}Consider addressing warnings for better UX.${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.green}All navigation headers are properly configured!${colors.reset}\n`);
    process.exit(0);
  }
}

// Run
lintNavHeaders();
