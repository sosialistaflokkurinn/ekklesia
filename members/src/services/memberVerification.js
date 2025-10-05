/**
 * Member Verification Service
 *
 * Verifies membership status by checking kennitala against registered members list.
 * This is the authoritative source for voting eligibility.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Cache for valid kennitölur
let validMembers = new Set();
let lastLoaded = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Load kennitölur from file
 * Default path: members/data/kennitalas.txt (overridable with KENNITALAS_FILE_PATH)
 */
async function loadValidMembers() {
  // Check if cache is still valid
  if (lastLoaded && Date.now() - lastLoaded < CACHE_DURATION) {
    return;
  }

  try {
    // Path can be configured via environment variable
    const dataPath = process.env.KENNITALAS_FILE_PATH ||
                    path.join(__dirname, '../../data/kennitalas.txt');

    const content = await fs.readFile(dataPath, 'utf-8');

    // Parse kennitölur (one per line)
    validMembers = new Set(
      content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length === 10) // Valid kennitala format
    );

    lastLoaded = Date.now();
    console.log(`Loaded ${validMembers.size} valid members from kennitalas.txt`);
  } catch (error) {
    console.error('Failed to load kennitalas.txt:', error);
    // Keep existing cache if file read fails
  }
}

/**
 * Check if a kennitala is a registered member
 * @param {string} kennitala - Icelandic national ID (10 digits)
 * @returns {Promise<boolean>} True if member is registered
 */
export async function isValidMember(kennitala) {
  if (!kennitala || typeof kennitala !== 'string') {
    return false;
  }

  // Clean kennitala (remove dashes, spaces)
  const cleanKennitala = kennitala.replace(/[-\s]/g, '');

  // Validate format (10 digits)
  if (!/^\d{10}$/.test(cleanKennitala)) {
    return false;
  }

  // Ensure members list is loaded
  await loadValidMembers();

  return validMembers.has(cleanKennitala);
}

/**
 * Extract kennitala from user claims
 *
 * Kennitala comes from Kenni.is via Firebase/Identity Platform:
 * 1. Firebase claim: national_id (from Kenni.is via OIDC Bridge)
 * 2. Fallback: kennitala custom claim
 * 3. Fallback: preferred_username (some IdPs)
 *
 * @param {Object} user - User object from session
 * @returns {string|null} Kennitala or null
 */
export function extractKennitala(user) {
  // Extract kennitala from Firebase ID token claims
  // Firebase stores OIDC provider custom claims in firebase.sign_in_attributes

  // Method 1: Check national_id (from Kenni.is via OIDC Bridge → Firebase)
  if (user.national_id) {
    console.log(`✓ Kennitala extracted from Firebase token: ${user.national_id.substring(0, 6)}-****`);
    return user.national_id;
  }

  // Method 2: Check standard kennitala claim
  if (user.kennitala) {
    console.log(`✓ Kennitala extracted from standard claim`);
    return user.kennitala;
  }

  // Method 3: Check preferred_username (some IdPs use this)
  if (user.preferred_username && /^\d{10}$/.test(user.preferred_username.replace(/[-\s]/g, ''))) {
    console.log(`✓ Kennitala extracted from preferred_username`);
    return user.preferred_username.replace(/[-\s]/g, '');
  }

  // No kennitala found in any expected location
  console.warn(`⚠ No kennitala found in token claims for user ${user.sub || 'unknown'}`);
  return null;
}

/**
 * Get membership status for a user
 * @param {Object} user - User object from session
 * @returns {Promise<Object>} Membership status
 */
export async function getMembershipStatus(user) {
  const kennitala = extractKennitala(user);

  if (!kennitala) {
    return {
      verified: false,
      eligible: false,
      reason: 'Kennitala ekki fundið í notendaupplýsingum'
    };
  }

  const isValid = await isValidMember(kennitala);

  if (!isValid) {
    return {
      verified: true,
      eligible: false,
      kennitala: maskKennitala(kennitala),
      reason: 'Kennitala ekki á skrá félagsmanna'
    };
  }

  return {
    verified: true,
    eligible: true,
    kennitala: maskKennitala(kennitala),
    votingRights: true
  };
}

/**
 * Mask kennitala for display (show birthdate, hide last 4 digits)
 * Format: DDMMYY-XXXX → DDMMYY-****
 */
function maskKennitala(kennitala) {
  if (!kennitala || kennitala.length !== 10) {
    return 'N/A';
  }

  return `${kennitala.substring(0, 6)}-****`;
}

/**
 * Reload members list (for admin operations)
 */
export async function reloadMembers() {
  lastLoaded = null;
  await loadValidMembers();
  return validMembers.size;
}
