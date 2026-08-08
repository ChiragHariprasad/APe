import jwt from 'jsonwebtoken';
import db from '../config/database.js';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'INVALID_TOKEN', message: 'Invalid or expired token.' });
  }
}

export async function attachStudentProfile(req, res, next) {
  try {
    const result = await db.query(
      `SELECT sp.*, ab.batch_year, ab.label as batch_label
       FROM student_profiles sp
       JOIN academic_batches ab ON sp.batch_id = ab.id
       WHERE sp.user_id = $1`,
      [req.user.id]
    );

    if (result.rows.length > 0) {
      req.studentProfile = result.rows[0];
    }

    next();
  } catch (err) {
    console.error('Error fetching student profile:', err);
    next(err);
  }
}

export function requireOnboarding(req, res, next) {
  if (!req.studentProfile || !req.studentProfile.onboarding_complete) {
    return res.status(403).json({
      error: 'ONBOARDING_REQUIRED',
      message: 'Please complete onboarding first.',
    });
  }
  next();
}

/**
 * Attach teacher profile to request (parallel to attachStudentProfile).
 */
export async function attachTeacherProfile(req, res, next) {
  try {
    const result = await db.query(
      `SELECT * FROM teacher_profiles WHERE user_id = $1`,
      [req.user.id]
    );

    if (result.rows.length > 0) {
      req.teacherProfile = result.rows[0];
    }

    next();
  } catch (err) {
    console.error('Error fetching teacher profile:', err);
    next(err);
  }
}

/**
 * Require teacher onboarding to be complete.
 */
export function requireTeacherOnboarding(req, res, next) {
  if (!req.teacherProfile || !req.teacherProfile.onboarding_complete) {
    return res.status(403).json({
      error: 'TEACHER_ONBOARDING_REQUIRED',
      message: 'Please complete teacher onboarding first.',
    });
  }
  next();
}
