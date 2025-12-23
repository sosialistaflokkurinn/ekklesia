#!/usr/bin/env node
/**
 * Þjóðskrá Address Lookup Script
 *
 * Uses Playwright to look up registered addresses in Þjóðskrá via island.is
 *
 * Usage:
 *   node scripts/thjodskra-lookup.js
 *
 * Prerequisites:
 *   - npm install playwright
 *   - Rafræn skilríki (electronic ID) for authentication
 *
 * Output:
 *   Creates thjodskra-results.json with address data for each kennitala
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load kennitölur from external file (not in git - contains PII)
const KENNITOLUR_FILE = path.join(__dirname, 'thjodskra-kennitolur.txt');
if (!fs.existsSync(KENNITOLUR_FILE)) {
  console.error(`❌ Missing ${KENNITOLUR_FILE}`);
  console.error('   Create file with one kennitala per line');
  process.exit(1);
}
const KENNITOLUR = fs.readFileSync(KENNITOLUR_FILE, 'utf-8')
  .split('\n')
  .map(k => k.trim())
  .filter(k => k && /^\d{10}$/.test(k));

const RESULTS_FILE = path.join(__dirname, 'thjodskra-results.json');

async function main() {
  console.log('🔍 Þjóðskrá Address Lookup');
  console.log(`   Looking up ${KENNITOLUR.length} kennitölur\n`);

  // Launch browser (visible for authentication)
  const browser = await chromium.launch({
    headless: false,  // Need to see for authentication
    slowMo: 100
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Results storage
  const results = [];

  try {
    // Go to island.is mínar síður
    console.log('📱 Opening island.is...');
    await page.goto('https://island.is/minarsidur');

    // Wait for user to authenticate
    console.log('\n⏳ Please authenticate with your electronic ID...');
    console.log('   (Rafræn skilríki, Auðkenni app, or similar)\n');

    // Wait for successful login (check for user menu or similar)
    await page.waitForSelector('[data-testid="user-menu"]', { timeout: 300000 }); // 5 min timeout
    console.log('✅ Authenticated successfully!\n');

    // Now we need to go to Þjóðskrá lookup
    // The exact URL/flow depends on what service is available
    // This is a template - adjust based on actual island.is structure

    console.log('🔎 Starting address lookups...\n');

    for (const kt of KENNITOLUR) {
      console.log(`   Looking up ${kt}...`);

      try {
        // Navigate to person lookup (adjust URL as needed)
        // Note: You may need admin/organization access to look up other people
        await page.goto(`https://island.is/umsoknir/thjodskra/uppfletting?kt=${kt}`);

        // Wait for results
        await page.waitForTimeout(2000);

        // Extract address data (adjust selectors based on actual page)
        const addressData = await page.evaluate(() => {
          // This is a placeholder - adjust based on actual page structure
          const streetEl = document.querySelector('[data-testid="address-street"]');
          const postalEl = document.querySelector('[data-testid="address-postal"]');
          const cityEl = document.querySelector('[data-testid="address-city"]');

          return {
            street: streetEl?.textContent?.trim() || null,
            postal_code: postalEl?.textContent?.trim() || null,
            city: cityEl?.textContent?.trim() || null
          };
        });

        results.push({
          ssn: kt,
          ...addressData,
          found: !!addressData.street,
          timestamp: new Date().toISOString()
        });

        console.log(`   ✓ ${kt}: ${addressData.street || 'Not found'}`);

      } catch (err) {
        console.log(`   ✗ ${kt}: Error - ${err.message}`);
        results.push({
          ssn: kt,
          error: err.message,
          found: false,
          timestamp: new Date().toISOString()
        });
      }

      // Small delay between lookups
      await page.waitForTimeout(1000);
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    // Save results
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    console.log(`\n📁 Results saved to: ${RESULTS_FILE}`);

    // Close browser
    await browser.close();
  }

  // Summary
  const found = results.filter(r => r.found).length;
  const notFound = results.filter(r => !r.found).length;
  console.log(`\n📊 Summary: ${found} found, ${notFound} not found`);
}

main().catch(console.error);
