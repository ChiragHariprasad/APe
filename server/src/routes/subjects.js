import { Router } from 'express';
import { authenticateToken, attachStudentProfile, requireOnboarding } from '../middleware/auth.js';
import { getSubjectsForStudent } from '../services/subject.service.js';

const router = Router();

/**
 * GET /api/subjects
 * Returns categorized subject list for the authenticated student.
 */
router.get('/', authenticateToken, attachStudentProfile, requireOnboarding, async (req, res) => {
  try {
    const { batch_year, current_semester } = req.studentProfile;

    const subjects = await getSubjectsForStudent(
      req.user.id,
      batch_year,
      current_semester
    );

    res.json({
      batchYear: batch_year,
      currentSemester: current_semester,
      ...subjects,
    });
  } catch (err) {
    console.error('Get subjects error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Internal server error.' });
  }
});

export default router;
