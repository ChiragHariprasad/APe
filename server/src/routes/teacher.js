/**
 * Teacher routes — all endpoints for the teacher flow (T1–T4).
 */

import { Router } from 'express';
import { authenticateToken, attachTeacherProfile, requireTeacherOnboarding } from '../middleware/auth.js';
import {
  upsertTeacherProfile,
  getTeacherProfile,
  getAvailableSubjects,
  selectTeacherCourses,
  getTeacherDashboard,
  saveT1Responses,
  saveT2Responses,
  saveInterviewTurn,
  getInterviewTurns,
  saveInterviewResults,
  determineMismatchScenario,
  saveT3Responses,
  submitTeacherSurvey,
  savePostEvaluation,
} from '../services/teacher.service.js';
import {
  classifyBranch,
  processInterviewTurn,
  getRootPrompt,
  getPedagogyLabels,
} from '../services/teacher-interview.service.js';

const router = Router();

// ── Onboarding ─────────────────────────────────────────────

/**
 * POST /api/teacher/onboarding
 * Save teacher profile (general dispositional traits) + mark onboarding complete.
 */
router.post('/onboarding', authenticateToken, async (req, res) => {
  try {
    const profile = await upsertTeacherProfile(req.user.id, req.body);
    res.json({ success: true, profile });
  } catch (err) {
    console.error('Teacher onboarding error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ── Course Selection ───────────────────────────────────────

/**
 * GET /api/teacher/courses
 * Get all available courses grouped by semester for selection.
 */
router.get('/courses', authenticateToken, async (req, res) => {
  try {
    const grouped = await getAvailableSubjects();
    res.json({ courses: grouped, pedagogyLabels: getPedagogyLabels() });
  } catch (err) {
    console.error('Get courses error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * POST /api/teacher/courses/select
 * Teacher selects which courses they handle.
 */
router.post('/courses/select', authenticateToken, attachTeacherProfile, requireTeacherOnboarding, async (req, res) => {
  try {
    const { subjectIds } = req.body;
    if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'subjectIds array required.' });
    }
    const created = await selectTeacherCourses(req.teacherProfile.id, subjectIds);
    res.json({ success: true, coursesCreated: created.length });
  } catch (err) {
    console.error('Select courses error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ── Dashboard ──────────────────────────────────────────────

/**
 * GET /api/teacher/dashboard
 * Get teacher's courses with survey status.
 */
router.get('/dashboard', authenticateToken, attachTeacherProfile, requireTeacherOnboarding, async (req, res) => {
  try {
    const courses = await getTeacherDashboard(req.teacherProfile.id);
    res.json({
      teacher: {
        id: req.teacherProfile.id,
        displayName: req.user.displayName,
        yearsTeaching: req.teacherProfile.years_teaching,
        level: req.teacherProfile.level,
      },
      courses,
      pedagogyLabels: getPedagogyLabels(),
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ── Survey: T1 ─────────────────────────────────────────────

/**
 * PUT /api/teacher/survey/:id/t1
 * Save T1 (teacher profile per course) responses.
 */
router.put('/survey/:id/t1', authenticateToken, async (req, res) => {
  try {
    const updated = await saveT1Responses(req.params.id, req.body);
    res.json({ success: true, status: updated.status });
  } catch (err) {
    console.error('Save T1 error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ── Survey: T2 ─────────────────────────────────────────────

/**
 * PUT /api/teacher/survey/:id/t2
 * Save T2 (course pedagogy profile) responses.
 */
router.put('/survey/:id/t2', authenticateToken, async (req, res) => {
  try {
    const updated = await saveT2Responses(req.params.id, req.body);
    res.json({ success: true, status: updated.status });
  } catch (err) {
    console.error('Save T2 error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ── Survey: Adaptive Interview ─────────────────────────────

/**
 * POST /api/teacher/survey/:id/interview
 * Send an interview answer, get the next adaptive question.
 *
 * Request body:
 *   { answer: string }       — for turn 0, this is the response to the root prompt
 *   { answer: string }       — for subsequent turns
 *
 * Response:
 *   { nextQuestion, branch, turnIndex, coverage, pedagogyMix, isComplete, interviewProfile }
 */
router.post('/survey/:id/interview', authenticateToken, async (req, res) => {
  try {
    const teacherCourseId = req.params.id;
    const { answer } = req.body;

    if (!answer || !answer.trim()) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Answer is required.' });
    }

    // Get existing turns
    const previousTurns = await getInterviewTurns(teacherCourseId);
    const turnIndex = previousTurns.length;

    let branch;
    let question;

    if (turnIndex === 0) {
      // First turn: classify branch from the root answer
      const classification = await classifyBranch(answer);
      branch = classification.branch || 'lecture_heavy';

      // The question was the root prompt (already shown to user)
      // Get the subject name from the course profile
      const db = (await import('../config/database.js')).default;
      const subjectResult = await db.query(
        `SELECT s.subject_name FROM teacher_course_profiles tcp
         JOIN subjects s ON tcp.subject_id = s.id
         WHERE tcp.id = $1`,
        [teacherCourseId]
      );
      const subjectName = subjectResult.rows[0]?.subject_name || 'this course';
      question = getRootPrompt(subjectName);
    } else {
      // Subsequent turns: question was already sent to client
      branch = previousTurns[0]?.branch || 'lecture_heavy';
      question = req.body.question || `Follow-up ${turnIndex}`;
    }

    // Get current pedagogy mix from the course profile
    const db = (await import('../config/database.js')).default;
    const profileResult = await db.query(
      `SELECT pedagogy_mix FROM teacher_course_profiles WHERE id = $1`,
      [teacherCourseId]
    );
    const currentMix = profileResult.rows[0]?.pedagogy_mix || [];

    // Process the turn
    const result = await processInterviewTurn(
      turnIndex, branch, question, answer,
      previousTurns.map(t => ({ question: t.question, answer: t.answer })),
      currentMix
    );

    // Save the turn
    await saveInterviewTurn(
      teacherCourseId, turnIndex, branch,
      question, answer, result.llmClassification
    );

    // Update pedagogy mix on course profile
    await db.query(
      `UPDATE teacher_course_profiles SET pedagogy_mix = $2, updated_at = NOW() WHERE id = $1`,
      [teacherCourseId, JSON.stringify(result.pedagogyMix)]
    );

    // If interview is complete, save the profile
    if (result.isComplete && result.interviewProfile) {
      await saveInterviewResults(teacherCourseId, result.interviewProfile, result.pedagogyMix);
    }

    res.json({
      turnIndex,
      branch: result.branch,
      nextQuestion: result.nextQuestion,
      coverage: result.coverage,
      pedagogyMix: result.pedagogyMix,
      isComplete: result.isComplete,
      interviewProfile: result.isComplete ? result.interviewProfile : undefined,
    });
  } catch (err) {
    console.error('Interview turn error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * GET /api/teacher/survey/:id/interview
 * Get the root prompt and current interview state.
 */
router.get('/survey/:id/interview', authenticateToken, async (req, res) => {
  try {
    const teacherCourseId = req.params.id;
    const turns = await getInterviewTurns(teacherCourseId);

    // Get subject name
    const db = (await import('../config/database.js')).default;
    const subjectResult = await db.query(
      `SELECT s.subject_name, tcp.pedagogy_mix, tcp.interview_profile, tcp.status
       FROM teacher_course_profiles tcp
       JOIN subjects s ON tcp.subject_id = s.id
       WHERE tcp.id = $1`,
      [teacherCourseId]
    );
    const row = subjectResult.rows[0];
    const subjectName = row?.subject_name || 'this course';

    res.json({
      rootPrompt: getRootPrompt(subjectName),
      subjectName,
      turns: turns.map(t => ({
        turnIndex: t.turn_index,
        branch: t.branch,
        question: t.question,
        answer: t.answer,
      })),
      pedagogyMix: row?.pedagogy_mix || [],
      interviewProfile: row?.interview_profile || null,
      status: row?.status,
      isComplete: row?.status === 't3_in_progress' || row?.status === 'completed',
    });
  } catch (err) {
    console.error('Get interview state error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ── Survey: T3 (Mismatch) ──────────────────────────────────

/**
 * GET /api/teacher/survey/:id/mismatch
 * Determine the mismatch scenario for this course.
 */
router.get('/survey/:id/mismatch', authenticateToken, async (req, res) => {
  try {
    const result = await determineMismatchScenario(req.params.id);
    res.json(result);
  } catch (err) {
    console.error('Mismatch detection error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * POST /api/teacher/survey/:id/t3
 * Save T3 mismatch probe responses.
 */
router.post('/survey/:id/t3', authenticateToken, async (req, res) => {
  try {
    const saved = await saveT3Responses(req.params.id, req.body);
    res.json({ success: true, scenario: saved.scenario });
  } catch (err) {
    console.error('Save T3 error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ── Submit ──────────────────────────────────────────────────

/**
 * POST /api/teacher/survey/:id/submit
 * Complete the teacher survey (T1–T3).
 */
router.post('/survey/:id/submit', authenticateToken, async (req, res) => {
  try {
    const result = await submitTeacherSurvey(req.params.id);
    res.json({ success: true, status: result.status, completedAt: result.completed_at });
  } catch (err) {
    console.error('Submit survey error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ── T4 Post-Evaluation ─────────────────────────────────────

/**
 * POST /api/teacher/evaluation/:id
 * Save T4 post-intervention evaluation.
 */
router.post('/evaluation/:id', authenticateToken, async (req, res) => {
  try {
    const result = await savePostEvaluation(req.params.id, req.body);
    res.json({ success: true, result });
  } catch (err) {
    console.error('Save evaluation error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

export default router;
