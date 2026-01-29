/**
 * Moonshot AI Text Enhancement Utility
 *
 * Uses Moonshot AI to improve event descriptions
 * from Facebook by making them more readable and well-formatted.
 */

const axios = require('axios');
const logger = require('./util-logger');

// Moonshot AI API Configuration
// Reads from KIMI_API_KEY env var for backwards compatibility
const MOONSHOT_API_KEY = process.env.KIMI_API_KEY;
const MOONSHOT_API_BASE = 'https://api.moonshot.ai/v1';
const MOONSHOT_MODEL = 'kimi-k2-0711-preview';

/**
 * Improve event description text using Moonshot AI
 * @param {string} originalText - Original description from Facebook
 * @param {string} eventTitle - Event title for context
 * @returns {Promise<string>} - Improved text or original if API fails
 */
async function improveEventDescription(originalText, eventTitle = '') {
  // Skip if no API key or empty text
  if (!MOONSHOT_API_KEY) {
    logger.debug('Moonshot AI API key not configured, skipping text improvement');
    return originalText;
  }

  if (!originalText || originalText.trim().length < 50) {
    // Don't process very short descriptions
    return originalText;
  }

  try {
    const prompt = `Þú ert textaritari fyrir íslenskan stjórnmálaflokk (Sósíalistaflokkurinn). Endurskrifaðu eftirfarandi viðburðatexta.

MIKILVÆGT - Ekki endurtaka þessar upplýsingar því þær birtast annars staðar á síðunni:
- Titill viðburðar (sýndur sem fyrirsögn)
- Staðsetning/heimilisfang (sýnt með kortahlekkjum)
- Dagsetning og tími (sýnt í sérstökum merkimiða)
- Zoom/fjarfundahlekkir (sýndir sem sérstakir hnappar) - FJARLÆGÐU alla Zoom URL úr textanum

Leiðbeiningar:
- Einbeita þér að INNIHALDI: hvað á að gerast, hvers vegna, hverjir eru velkomnir
- Gera textann læsilegri og faglegri
- Nota **feitletrað** fyrir fyrirsagnir ef við á
- Halda óformlegum en vinalegum tón
- Nota emoji sparlega
- Halda textanum stuttum og hnitmiðuðum

Viðburður: ${eventTitle}

Upprunalegi textinn:
${originalText}

Skrifaðu aðeins endurbættan texta, ekki útskýringar.`;

    const response = await axios.post(
      `${MOONSHOT_API_BASE}/chat/completions`,
      {
        model: MOONSHOT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${MOONSHOT_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const improvedText = response.data?.choices?.[0]?.message?.content;

    if (improvedText && improvedText.trim().length > 0) {
      logger.info('Event description improved by Moonshot AI', {
        eventTitle,
        originalLength: originalText.length,
        improvedLength: improvedText.length
      });
      return improvedText.trim();
    }

    return originalText;

  } catch (error) {
    logger.warn('Moonshot AI API call failed, using original text', {
      eventTitle,
      error: error.message
    });
    return originalText;
  }
}

/**
 * Check if Moonshot AI API is configured and available
 */
function isMoonshotConfigured() {
  return !!MOONSHOT_API_KEY;
}

module.exports = {
  improveEventDescription,
  isMoonshotConfigured
};
