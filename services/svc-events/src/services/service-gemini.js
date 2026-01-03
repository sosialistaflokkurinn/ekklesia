/**
 * Gemini AI Service
 *
 * Wrapper for Google's Generative AI (Gemini) for the member assistant.
 * Uses @google/generative-ai SDK with API key authentication.
 *
 * Models:
 * - gemini-2.0-flash: Fast responses (~5-15s)
 * - gemini-2.0-flash-thinking-exp-01-21: Deep reasoning (~30-60s)
 *
 * @module services/service-gemini
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/util-logger');

// Gemini API Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Available models with their configurations
const GEMINI_MODELS = {
  'gemini-2.0-flash': {
    name: 'Gemini Flash (hraður)',
    timeout: 60000,
    maxTokens: 3000,
  },
  'gemini-2.0-flash-thinking-exp-01-21': {
    name: 'Gemini Thinking (nákvæmur)',
    timeout: 120000,
    maxTokens: 4000,
  },
};

const DEFAULT_MODEL = 'gemini-2.0-flash';

// Map from frontend model names to Gemini models
const MODEL_MAPPING = {
  'kimi-k2-0711-preview': 'gemini-2.0-flash',
  'kimi-k2-thinking': 'gemini-2.0-flash-thinking-exp-01-21',
  // Direct Gemini model names also work
  'gemini-2.0-flash': 'gemini-2.0-flash',
  'gemini-2.0-flash-thinking-exp-01-21': 'gemini-2.0-flash-thinking-exp-01-21',
};

let genAI = null;

/**
 * Initialize the Gemini client
 */
function initClient() {
  if (!genAI && GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    logger.info('Gemini client initialized');
  }
  return genAI;
}

/**
 * Check if Gemini service is available
 */
function isAvailable() {
  return !!GEMINI_API_KEY;
}

/**
 * Get the Gemini model name from a request model name
 * @param {string} requestedModel - Model name from frontend
 * @returns {string} - Gemini model name
 */
function resolveModel(requestedModel) {
  return MODEL_MAPPING[requestedModel] || DEFAULT_MODEL;
}

/**
 * Get model configuration
 * @param {string} modelName - Gemini model name
 * @returns {object} - Model configuration
 */
function getModelConfig(modelName) {
  return GEMINI_MODELS[modelName] || GEMINI_MODELS[DEFAULT_MODEL];
}

/**
 * Generate a chat completion using Gemini
 *
 * @param {object} options - Chat options
 * @param {string} options.systemPrompt - System prompt with context
 * @param {string} options.message - User message
 * @param {Array} options.history - Conversation history [{role, content}]
 * @param {string} options.model - Model name (kimi or gemini format)
 * @returns {Promise<object>} - { reply, model, modelName }
 */
async function generateChatCompletion({ systemPrompt, message, history = [], model: requestedModel }) {
  const client = initClient();

  if (!client) {
    throw new Error('Gemini API key not configured');
  }

  const modelName = resolveModel(requestedModel);
  const modelConfig = getModelConfig(modelName);

  logger.info('Gemini chat request', {
    operation: 'gemini_chat_start',
    model: modelName,
    messageLength: message.length,
    historyLength: history.length,
  });

  try {
    // Get the generative model with system instruction
    const generativeModel = client.getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt,
    });

    // Convert history to Gemini format
    // Gemini uses 'model' instead of 'assistant'
    const geminiHistory = history.slice(-6).map(h => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }],
    }));

    // Start chat with history
    const chat = generativeModel.startChat({
      history: geminiHistory,
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: modelConfig.maxTokens,
      },
    });

    // Send message with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Gemini request timeout')), modelConfig.timeout);
    });

    const resultPromise = chat.sendMessage(message);
    const result = await Promise.race([resultPromise, timeoutPromise]);

    const response = result.response;
    const reply = response.text();

    if (!reply) {
      throw new Error('Empty response from Gemini');
    }

    logger.info('Gemini chat response', {
      operation: 'gemini_chat_complete',
      model: modelName,
      replyLength: reply.length,
    });

    return {
      reply,
      model: modelName,
      modelName: modelConfig.name,
    };

  } catch (error) {
    logger.error('Gemini chat error', {
      operation: 'gemini_chat_error',
      model: modelName,
      error: error.message,
    });

    // Re-throw with more context
    if (error.message?.includes('429') || error.status === 429) {
      const rateLimitError = new Error('Rate limited by Gemini');
      rateLimitError.status = 429;
      throw rateLimitError;
    }

    throw error;
  }
}

/**
 * Get available models for the frontend
 * @returns {Array} - List of available models
 */
function getAvailableModels() {
  return Object.entries(GEMINI_MODELS).map(([id, config]) => ({
    id,
    name: config.name,
    timeout: config.timeout,
    isDefault: id === DEFAULT_MODEL,
  }));
}

module.exports = {
  isAvailable,
  resolveModel,
  getModelConfig,
  generateChatCompletion,
  getAvailableModels,
  GEMINI_MODELS,
  DEFAULT_MODEL,
};
