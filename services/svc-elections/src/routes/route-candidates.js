/**
 * Nomination Candidate Metadata Routes
 * API endpoints for managing candidate metadata in nomination elections
 *
 * Purpose: Manage candidate information for uppstillingarnefnd
 * - Get all candidates with metadata
 * - Get single candidate details
 * - Update candidate fields (tracks edit history)
 *
 * Firestore collection: nomination-candidates
 * Access: Committee members only
 */

const express = require('express');
const admin = require('../firebase');
const logger = require('../utils/util-logger');
const { verifyMemberToken } = require('../middleware/middleware-member-auth');
const { readLimiter, voteLimiter } = require('../middleware/middleware-rate-limiter');

const router = express.Router();
const db = admin.firestore();
const COLLECTION = 'nomination-candidates';

// =====================================================
// GET /api/candidates - List All Candidates
// =====================================================
router.get('/', readLimiter, verifyMemberToken, async (req, res) => {
  const startTime = Date.now();

  try {
    const snapshot = await db.collection(COLLECTION)
      .orderBy('name')
      .get();

    const candidates = [];
    snapshot.forEach(doc => {
      candidates.push({ id: doc.id, ...doc.data() });
    });

    const duration = Date.now() - startTime;

    (req.logger || logger).info('[Candidates API] List candidates', {
      uid: req.user.uid,
      count: candidates.length,
      duration_ms: duration,
    });

    res.json({
      candidates,
      total: candidates.length,
    });
  } catch (error) {
    (req.logger || logger).error('[Candidates API] List error:', {
      error: error.message,
      stack: error.stack,
      uid: req.user?.uid,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Mistókst að sækja frambjóðendur',
    });
  }
});

// =====================================================
// GET /api/candidates/:id - Get Single Candidate
// =====================================================
router.get('/:id', readLimiter, verifyMemberToken, async (req, res) => {
  const { id } = req.params;

  try {
    const doc = await db.collection(COLLECTION).doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Frambjóðandi fannst ekki',
      });
    }

    const candidate = { id: doc.id, ...doc.data() };

    (req.logger || logger).info('[Candidates API] Get candidate', {
      uid: req.user.uid,
      candidate_id: id,
    });

    res.json({ candidate });
  } catch (error) {
    (req.logger || logger).error('[Candidates API] Get error:', {
      error: error.message,
      stack: error.stack,
      candidate_id: id,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Mistókst að sækja frambjóðanda',
    });
  }
});

// =====================================================
// PATCH /api/candidates/:id - Update Candidate Fields
// =====================================================
// Body: {
//   field: "bio",          // Single field to update
//   value: "New bio text"  // New value
// }
// OR:
// Body: {
//   updates: { bio: "...", stance: "..." }  // Multiple fields
// }
router.patch('/:id', voteLimiter, verifyMemberToken, async (req, res) => {
  const { id } = req.params;
  const { field, value, updates } = req.body;

  // Validate input - either single field or updates object
  if (!field && !updates) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Vantar field/value eða updates',
    });
  }

  try {
    const docRef = db.collection(COLLECTION).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Frambjóðandi fannst ekki',
      });
    }

    const currentData = doc.data();
    const timestamp = new Date().toISOString();
    const editHistory = currentData.edit_history || [];

    // Prepare updates
    let fieldsToUpdate = {};

    if (updates && typeof updates === 'object') {
      // Multiple fields update
      fieldsToUpdate = updates;
    } else if (field && value !== undefined) {
      // Single field update
      fieldsToUpdate = { [field]: value };
    }

    // Track edit history for each changed field
    for (const [fieldName, newValue] of Object.entries(fieldsToUpdate)) {
      if (currentData[fieldName] !== newValue) {
        editHistory.push({
          field: fieldName,
          user_id: req.user.uid,
          user_name: req.user.claims?.name || req.user.email || 'Unknown',
          timestamp,
          previous_value: currentData[fieldName] || null,
        });
      }
    }

    // Prepare final update object
    const updateData = {
      ...fieldsToUpdate,
      edit_history: editHistory,
      updated_at: timestamp,
      last_edited_by: {
        user_id: req.user.uid,
        user_name: req.user.claims?.name || req.user.email || 'Unknown',
        timestamp,
      },
    };

    await docRef.update(updateData);

    // Fetch updated document
    const updatedDoc = await docRef.get();
    const candidate = { id: updatedDoc.id, ...updatedDoc.data() };

    (req.logger || logger).info('[Candidates API] Updated candidate', {
      uid: req.user.uid,
      candidate_id: id,
      fields: Object.keys(fieldsToUpdate),
    });

    res.json({
      success: true,
      candidate,
    });
  } catch (error) {
    (req.logger || logger).error('[Candidates API] Update error:', {
      error: error.message,
      stack: error.stack,
      candidate_id: id,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Mistókst að uppfæra frambjóðanda',
    });
  }
});

// =====================================================
// GET /api/candidates/:id/history - Get Edit History
// =====================================================
router.get('/:id/history', readLimiter, verifyMemberToken, async (req, res) => {
  const { id } = req.params;

  try {
    const doc = await db.collection(COLLECTION).doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Frambjóðandi fannst ekki',
      });
    }

    const data = doc.data();
    const editHistory = data.edit_history || [];

    (req.logger || logger).info('[Candidates API] Get history', {
      uid: req.user.uid,
      candidate_id: id,
      entries: editHistory.length,
    });

    res.json({
      candidate_id: id,
      candidate_name: data.name,
      edit_history: editHistory,
      total: editHistory.length,
    });
  } catch (error) {
    (req.logger || logger).error('[Candidates API] History error:', {
      error: error.message,
      stack: error.stack,
      candidate_id: id,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Mistókst að sækja breytingasögu',
    });
  }
});

module.exports = router;
