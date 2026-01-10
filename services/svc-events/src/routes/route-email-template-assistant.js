/**
 * Email Template Assistant Route
 *
 * AI assistant for helping admins write email templates.
 * Uses Gemini for text improvements and template variable help.
 *
 * @module routes/route-email-template-assistant
 */

const express = require('express');
const logger = require('../utils/util-logger');
const authenticate = require('../middleware/middleware-auth');
const { requireRole } = require('../middleware/middleware-roles');
const gemini = require('../services/service-gemini');

const router = express.Router();

// System prompt for email template assistant
const SYSTEM_PROMPT = `Þú ert aðstoðarmaður sem hjálpar stjórnendum að SNÍÐA tölvupósta með fallegu HTML útliti.

## AÐALHLUTVERK
Þú SNÍÐUR og SKIPULEGGUR texta - þú BREYTIR EKKI orðunum sjálfum.
- Bættu við HTML sniðum (fyrirsagnir, listar, áherslur)
- Skipulagðu textann betur ef hann er óskipulagður
- Notaðu ALLTAF sömu orð og notandinn gaf þér

## MIKILVÆGT
⚠️ BREYTTU EKKI innihaldi textans - haltu öllum orðum, setningum og upplýsingum eins og þær eru.
✅ Bættu bara við HTML sniði og skipulagi.

## SNIÐ SVARS - MJÖG MIKILVÆGT
Skilaðu EINGÖNGU HTML kóða. ALDREI:
- Útskýringar eða texti utan HTML
- Markdown merki eins og \`\`\`html eða \`\`\`
- Setningar eins og "Hér er HTML útgáfan"
Svarið þitt verður að byrja á HTML tagi (t.d. <div>, <p>) og enda á HTML tagi.

## SNIÐMÁTSBREYTUR
- {{ member.name }} - Fullt nafn
- {{ member.first_name }} - Skírnarnafn
- {{ member.email }} - Netfang
- {{ cell.name }} - Nafn sellu
- {{unsubscribe_url}} - Afþakka hlekkur

## HTML STÍLAR
Notaðu inline CSS (ekki classes). Brandlitur: #722f37

Dæmi um fyrirsögn:
<h2 style="color: #722f37; border-left: 4px solid #722f37; padding-left: 12px; margin: 24px 0 12px 0;">Fyrirsögn</h2>

Dæmi um upplýsingar:
<p><strong>Dagsetning:</strong> 14. janúar</p>

Dæmi um lista:
<ul>
  <li>Atriði</li>
</ul>

Dæmi um skipting:
<hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;">

## REGLUR
1. Svaraðu á íslensku
2. EKKI breyta orðum - bara sníða
3. Skilaðu HTML tilbúnu til notkunar
4. Notaðu inline CSS styles
5. Ef spurning um breytur, útskýrðu stuttlega

## NÚVERANDI SNIÐMÁT
{{TEMPLATE_CONTENT}}`;

/**
 * POST /api/email-template-assistant/chat
 * Chat with AI assistant about email templates
 * Requires admin role
 */
router.post('/chat', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { message, templateContent = '', history = [] } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Skilaboð vantar'
      });
    }

    // Validate message length
    if (message.length > 2000) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Skilaboð of löng (hámark 2000 stafir)'
      });
    }

    if (!gemini.isAvailable()) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'AI þjónusta er ekki tiltæk'
      });
    }

    logger.info('Email template assistant request', {
      operation: 'email_template_assistant',
      userId: req.user?.uid,
      messageLength: message.length,
      hasTemplate: !!templateContent
    });

    // Build system prompt with template content
    const templateSection = templateContent
      ? `<template>\n${templateContent}\n</template>`
      : 'Ekkert sniðmát enn - notandinn er að byrja.';

    const systemPrompt = SYSTEM_PROMPT.replace('{{TEMPLATE_CONTENT}}', templateSection);

    // Use fast Gemini model
    const result = await gemini.generateChatCompletion({
      systemPrompt,
      message,
      history: history.slice(-4), // Keep last 4 messages for context
      model: 'gemini-2.0-flash'
    });

    logger.info('Email template assistant response', {
      operation: 'email_template_assistant_response',
      userId: req.user?.uid,
      replyLength: result.reply.length
    });

    res.json({
      reply: result.reply,
      model: result.model
    });

  } catch (error) {
    logger.error('Email template assistant error', {
      operation: 'email_template_assistant_error',
      userId: req.user?.uid,
      error: error.message
    });

    if (error.status === 429) {
      return res.status(429).json({
        error: 'Rate Limited',
        message: 'Of margar beiðnir. Reyndu aftur eftir smá stund.'
      });
    }

    res.status(500).json({
      error: 'Internal Error',
      message: 'Villa kom upp. Reyndu aftur.'
    });
  }
});

module.exports = router;
