/**
 * Firebase + Kenni.is Authentication Routes
 *
 * Handles manual OAuth flow with PKCE:
 * - /login - Serves login page (client-side initiates OAuth)
 * - /auth/callback - Handles OAuth callback (client-side exchanges code)
 * - /logout - Signs out user from Firebase
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { readFile } from 'fs/promises';
import config from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function authRoutes(fastify) {

  /**
   * Login page - serves client-side login with Firebase
   */
  fastify.get('/login', async (request, reply) => {
    try {
      // Read login.html template
      const templatePath = path.join(__dirname, '../views/login.html');
      let html = await readFile(templatePath, 'utf-8');

      // Replace Firebase config placeholders
      const firebaseConfig = {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID
      };

      html = html.replace('{{FIREBASE_API_KEY}}', firebaseConfig.apiKey || '');
      html = html.replace('{{FIREBASE_AUTH_DOMAIN}}', firebaseConfig.authDomain || '');
      html = html.replace('{{FIREBASE_PROJECT_ID}}', firebaseConfig.projectId || '');
      html = html.replace('{{FIREBASE_STORAGE_BUCKET}}', firebaseConfig.storageBucket || '');
      html = html.replace('{{FIREBASE_MESSAGING_SENDER_ID}}', firebaseConfig.messagingSenderId || '');
      html = html.replace('{{FIREBASE_APP_ID}}', firebaseConfig.appId || '');

      // Replace i18n placeholders (simple version - can be improved)
      html = html.replace(/\{\{t:([^}]+)\}\}/g, (match, key) => {
        // For now, return the key - TODO: implement proper i18n
        return key;
      });

      return reply.type('text/html').send(html);
    } catch (error) {
      fastify.log.error('Error serving login page:', error);
      return reply.code(500).send({ error: 'Failed to load login page' });
    }
  });

  /**
   * OAuth callback page - handles Kenni.is redirect
   */
  fastify.get('/auth/callback', async (request, reply) => {
    try {
      // Read callback.html template
      const templatePath = path.join(__dirname, '../views/callback.html');
      let html = await readFile(templatePath, 'utf-8');

      // Replace Firebase config placeholders
      const firebaseConfig = {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID
      };

      html = html.replace('{{FIREBASE_API_KEY}}', firebaseConfig.apiKey || '');
      html = html.replace('{{FIREBASE_AUTH_DOMAIN}}', firebaseConfig.authDomain || '');
      html = html.replace('{{FIREBASE_PROJECT_ID}}', firebaseConfig.projectId || '');
      html = html.replace('{{FIREBASE_STORAGE_BUCKET}}', firebaseConfig.storageBucket || '');
      html = html.replace('{{FIREBASE_MESSAGING_SENDER_ID}}', firebaseConfig.messagingSenderId || '');
      html = html.replace('{{FIREBASE_APP_ID}}', firebaseConfig.appId || '');

      // Replace i18n placeholders
      html = html.replace(/\{\{t:([^}]+)\}\}/g, (match, key) => {
        // Simple i18n replacements for callback page
        const translations = {
          'auth.processingLogin': 'Skráir inn',
          'auth.verifyingWithKenni': 'Sannreyni með Kenni.is...',
          'auth.exchangingCode': 'Skiptir á kóða fyrir innskráningarlykil...',
          'auth.signingIn': 'Skráir inn...',
          'auth.success': 'Innskráning tókst!',
          'auth.tryAgain': 'Reyna aftur',
          'auth.noAuthCode': 'Enginn auðkennisnúmer fannst í vefslóð',
          'auth.noPkceVerifier': 'PKCE sannprófunarlykill fannst ekki. Vinsamlegast reyndu aftur.',
          'auth.cloudFunctionError': 'Villa við að sækja innskráningarlykil',
          'auth.noCustomToken': 'Enginn innskráningarlykill fannst í svari',
          'auth.unknownError': 'Óþekkt villa kom upp'
        };
        return translations[key] || key;
      });

      return reply.type('text/html').send(html);
    } catch (error) {
      fastify.log.error('Error serving callback page:', error);
      return reply.code(500).send({ error: 'Failed to load callback page' });
    }
  });

  /**
   * Logout - clear Firebase session (client-side will handle signOut)
   */
  fastify.get('/logout', async (request, reply) => {
    // Since we're using Firebase on client-side, just redirect to home
    // The client-side will handle calling Firebase signOut()
    return reply.redirect('/?logout=1');
  });
}
