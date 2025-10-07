import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createTranslator } from '../i18n.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Simple template rendering utility
 * Replaces {{VAR_NAME}} with actual values
 * Also supports {{t:key.path}} for translations
 */
export async function renderTemplate(templateName, variables = {}, language = 'is') {
  const templatePath = path.join(__dirname, '..', 'views', templateName);
  let html = await fs.readFile(templatePath, 'utf-8');

  const t = createTranslator(language);

  // Replace translation keys {{t:key.path}}
  html = html.replace(/{{t:([^}]+)}}/g, (match, key) => {
    return t(key);
  });

  // Replace translation keys with interpolation {{t:key.path:param1=value1,param2=value2}}
  html = html.replace(/{{t:([^:]+):([^}]+)}}/g, (match, key, paramsStr) => {
    const params = {};
    paramsStr.split(',').forEach(param => {
      const [k, v] = param.split('=');
      params[k.trim()] = v.trim();
    });
    return t(key, params);
  });

  // Replace all {{VARIABLE}} placeholders
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    html = html.replace(regex, value);
  }

  return html;
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text) {
  if (text === null || text === undefined) {
    return '';
  }

  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };

  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}
