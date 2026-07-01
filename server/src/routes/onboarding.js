import { Router } from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  extractUsnYear,
  determineBatchYear,
  getCurrentSemester,
} from '../services/batch.service.js';

const router = Router();

/**
 * POST /api/onboarding/lateral-entry
 * Student answers the lateral-entry question.
 * Computes batch and semester, creates student profile.
 */
router.post('/lateral-entry', authenticateToken, async (req, res) => {
  try {
    const { isLateralEntry } = req.body;

    if (typeof isLateralEntry !== 'boolean') {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'isLateralEntry must be a boolean.',
      });
    }

    const userId = req.user.id;
    const email = req.user.email;

    // Extract USN year from email
    const usnYear = extractUsnYear(email);
    if (!usnYear) {
      return res.status(400).json({
        error: 'INVALID_EMAIL',
        message: 'Could not determine batch year from email.',
      });
    }

    const batchYear = determineBatchYear(usnYear, isLateralEntry);

    // Find or validate batch
    const batchResult = await db.query(
      `SELECT id, label FROM academic_batches WHERE batch_year = $1`,
      [batchYear]
    );

    if (batchResult.rows.length === 0) {
      return res.status(400).json({
        error: 'UNKNOWN_BATCH',
        message: `Batch year ${batchYear} is not configured in the system.`,
      });
    }

    const batch = batchResult.rows[0];
    const currentSemester = getCurrentSemester(batchYear);

    // Upsert student profile
    await db.query(
      `INSERT INTO student_profiles (user_id, batch_id, is_lateral_entry, current_semester, usn_year, onboarding_complete)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       ON CONFLICT (user_id) DO UPDATE SET
         is_lateral_entry = EXCLUDED.is_lateral_entry,
         current_semester = EXCLUDED.current_semester,
         onboarding_complete = TRUE,
         updated_at = NOW()`,
      [userId, batch.id, isLateralEntry, currentSemester, usnYear]
    );

    res.json({
      batchYear,
      currentSemester,
      label: batch.label,
      isLateralEntry,
    });
  } catch (err) {
    console.error('Onboarding error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Internal server error.' });
  }
});

/**
 * GET /api/onboarding/batch-info
 * Returns computed batch and semester info for the authenticated user.
 */
router.get('/batch-info', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT sp.*, ab.batch_year, ab.label
       FROM student_profiles sp
       JOIN academic_batches ab ON sp.batch_id = ab.id
       WHERE sp.user_id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'NO_PROFILE',
        message: 'Student profile not found. Please complete onboarding.',
      });
    }

    const profile = result.rows[0];
    res.json({
      batchYear: profile.batch_year,
      currentSemester: profile.current_semester,
      label: profile.label,
      isLateralEntry: profile.is_lateral_entry,
      onboardingComplete: profile.onboarding_complete,
    });
  } catch (err) {
    console.error('Batch info error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Internal server error.' });
  }
});

export default router;
