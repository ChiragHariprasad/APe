import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken, attachStudentProfile, requireOnboarding } from '../middleware/auth.js';
import {
  startOrResumeSession,
  getSessionDetails,
  saveLikertAnswer,
  saveOpenEndedAnswer,
  saveVoiceNote,
  submitSurvey,
  getProgressForUser,
} from '../services/survey.service.js';
import { uploadFile } from '../config/storage.js';
import { transcribeVoiceNote } from '../services/transcription.service.js';

const router = Router();

// Configure multer for voice note uploads (in-memory, max 25MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['audio/webm', 'audio/ogg', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/mp4'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid audio format: ${file.mimetype}`), false);
    }
  },
});

/**
 * POST /api/survey/start
 * Start a new survey or resume an existing one.
 */
router.post('/start', authenticateToken, attachStudentProfile, requireOnboarding, async (req, res) => {
  try {
    const { subjectId } = req.body;

    if (!subjectId) {
      return res.status(400).json({ error: 'MISSING_SUBJECT', message: 'subjectId is required.' });
    }

    const session = await startOrResumeSession(req.user.id, subjectId);
    res.json(session);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.code, message: err.message });
    }
    console.error('Start survey error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Internal server error.' });
  }
});

/**
 * GET /api/survey/:sessionId
 * Get current session state and questions.
 */
router.get('/:sessionId', authenticateToken, async (req, res) => {
  try {
    const session = await getSessionDetails(req.params.sessionId);
    res.json(session);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.code, message: err.message });
    }
    console.error('Get session error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Internal server error.' });
  }
});

/**
 * PUT /api/survey/:sessionId/answer
 * Save a single Likert-scale answer.
 */
router.put('/:sessionId/answer', authenticateToken, async (req, res) => {
  try {
    const { questionIndex, rating } = req.body;

    if (typeof questionIndex !== 'number' || typeof rating !== 'number') {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'questionIndex and rating are required numbers.' });
    }

    const result = await saveLikertAnswer(req.params.sessionId, req.user.id, questionIndex, rating);
    res.json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.code, message: err.message });
    }
    console.error('Save answer error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Internal server error.' });
  }
});

/**
 * PUT /api/survey/:sessionId/open-ended
 * Save an open-ended text response.
 */
router.put('/:sessionId/open-ended', authenticateToken, async (req, res) => {
  try {
    const { questionIndex, textResponse, voiceNoteId } = req.body;

    if (typeof questionIndex !== 'number') {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'questionIndex is required.' });
    }

    const result = await saveOpenEndedAnswer(
      req.params.sessionId,
      req.user.id,
      questionIndex,
      textResponse || null,
      voiceNoteId || null
    );
    res.json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.code, message: err.message });
    }
    console.error('Save open-ended error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Internal server error.' });
  }
});

/**
 * POST /api/survey/:sessionId/voice-note
 * Upload a voice note for an open-ended question.
 */
router.post('/:sessionId/voice-note', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'NO_FILE', message: 'Audio file is required.' });
    }

    const durationSecs = parseInt(req.body.durationSecs, 10);
    if (isNaN(durationSecs) || durationSecs <= 0) {
      return res.status(400).json({ error: 'INVALID_DURATION', message: 'Valid durationSecs is required.' });
    }

    if (durationSecs > 240) {
      return res.status(400).json({
        error: 'DURATION_EXCEEDED',
        message: `Voice note must be 4 minutes or less. Received: ${durationSecs} seconds.`,
      });
    }

    // Upload file to storage
    const filename = `${uuidv4()}_${Date.now()}.webm`;
    const { storageUrl, storageKey } = await uploadFile(req.file.buffer, filename, req.file.mimetype);

    // Save voice note record
    const voiceNote = await saveVoiceNote(
      req.user.id,
      storageUrl,
      storageKey,
      req.file.mimetype,
      durationSecs,
      req.file.size
    );

    // Queue transcription (async)
    const transcriptResult = await transcribeVoiceNote(voiceNote.id);

    res.json({
      voiceNoteId: voiceNote.id,
      durationSecs: voiceNote.duration_secs,
      transcriptStatus: transcriptResult.status === 'placeholder' ? 'completed' : 'processing',
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.code, message: err.message });
    }
    console.error('Voice note upload error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Internal server error.' });
  }
});

/**
 * POST /api/survey/:sessionId/submit
 * Finalize and submit a completed survey.
 */
router.post('/:sessionId/submit', authenticateToken, async (req, res) => {
  try {
    const result = await submitSurvey(req.params.sessionId, req.user.id);
    res.json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        error: err.code,
        message: err.message,
        missingIndices: err.missingIndices,
      });
    }
    console.error('Submit survey error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Internal server error.' });
  }
});

/**
 * GET /api/survey/progress
 * Get all in-progress survey sessions for the user.
 */
router.get('/progress/all', authenticateToken, async (req, res) => {
  try {
    const sessions = await getProgressForUser(req.user.id);
    res.json({ sessions });
  } catch (err) {
    console.error('Get progress error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Internal server error.' });
  }
});

export default router;
