/**
 * Vertex AI Embedding Service
 *
 * Generates text embeddings using Google's text-embedding-004 model.
 * Used for RAG (Retrieval Augmented Generation) semantic search.
 *
 * @module services/service-embedding
 */

const { PredictionServiceClient } = require('@google-cloud/aiplatform');
const logger = require('../utils/util-logger');

// Configuration
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'ekklesia-prod-10-2025';
// Use us-central1 for Vertex AI as it has the widest model availability
const LOCATION = process.env.VERTEX_AI_LOCATION || 'us-central1';
const MODEL_ID = 'text-embedding-004';
const ENDPOINT = `projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_ID}`;

// Vertex AI client (lazy initialization)
let predictionClient = null;

/**
 * Initialize Vertex AI prediction client
 */
function initializeClient() {
  if (!predictionClient) {
    predictionClient = new PredictionServiceClient({
      apiEndpoint: `${LOCATION}-aiplatform.googleapis.com`,
    });

    logger.info('Vertex AI embedding client initialized', {
      project: PROJECT_ID,
      location: LOCATION,
      model: MODEL_ID,
    });
  }
  return predictionClient;
}

/**
 * Generate embedding for a single text
 *
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} - 768-dimensional embedding vector
 */
async function generateEmbedding(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Text must be a non-empty string');
  }

  // Truncate very long texts (model limit is ~8192 tokens)
  const truncatedText = text.slice(0, 20000);

  try {
    const client = initializeClient();

    const instances = [{ content: truncatedText }];
    const parameters = { outputDimensionality: 768 };

    const [response] = await client.predict({
      endpoint: ENDPOINT,
      instances: instances.map(i => ({ structValue: { fields: { content: { stringValue: i.content } } } })),
      parameters: { structValue: { fields: { outputDimensionality: { numberValue: parameters.outputDimensionality } } } },
    });

    if (!response?.predictions?.[0]) {
      throw new Error('Invalid embedding response');
    }

    // Extract embedding values from response
    const embedding = response.predictions[0].structValue.fields.embeddings.structValue.fields.values.listValue.values;
    return embedding.map(v => v.numberValue);
  } catch (error) {
    logger.error('Failed to generate embedding', {
      operation: 'embedding_error',
      error: error.message,
      code: error.code,
      details: error.details,
      textLength: text.length,
      endpoint: ENDPOINT,
      stack: error.stack?.substring(0, 500),
    });
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts (batch)
 *
 * @param {string[]} texts - Array of texts to embed
 * @returns {Promise<number[][]>} - Array of embedding vectors
 */
async function generateEmbeddings(texts) {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error('Texts must be a non-empty array');
  }

  // Process in batches of 5 to avoid rate limits
  const BATCH_SIZE = 5;
  const results = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(text => generateEmbedding(text));
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Small delay between batches to avoid rate limits
    if (i + BATCH_SIZE < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Convert embedding array to PostgreSQL vector format
 *
 * @param {number[]} embedding - Embedding vector
 * @returns {string} - PostgreSQL vector string format
 */
function toPgVector(embedding) {
  return `[${embedding.join(',')}]`;
}

module.exports = {
  generateEmbedding,
  generateEmbeddings,
  toPgVector,
};
