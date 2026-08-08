import { Router } from 'express';
import { getAuthUrl } from '../config/google-oauth.js';
import { processGoogleCallback, getUserById } from '../services/auth.service.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/auth/google
 * Redirect to Google OAuth consent screen.
 */
router.get('/google', (req, res) => {
  const url = getAuthUrl();
  res.redirect(url);
});

/**
 * GET /api/auth/google/callback
 * Handle OAuth callback from Google.
 */
router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ error: 'MISSING_CODE', message: 'Authorization code is required.' });
    }

    const result = await processGoogleCallback(code);

    // Redirect to frontend with token and role
    const params = new URLSearchParams({
      token: result.token,
      needsOnboarding: result.needsOnboarding.toString(),
      role: result.user.role,
    });

    res.redirect(`${process.env.CLIENT_URL}/auth-callback?${params.toString()}`);
  } catch (err) {
    if (err.code === 'INVALID_DOMAIN') {
      // Redirect to frontend with error
      res.redirect(`${process.env.CLIENT_URL}/auth-callback?error=invalid_domain`);
    } else {
      console.error('OAuth callback error:', err);
      res.redirect(`${process.env.CLIENT_URL}/auth-callback?error=auth_failed`);
    }
  }
});

/**
 * GET /api/auth/me
 * Get current user profile.
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const role = req.user.role || 'student';
    const user = await getUserById(req.user.id, role);
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' });
    }

    const isDev = user.email ? ['manoj.ai23@rvce.edu.in', 'chiragh.ai24@rvce.edu.in'].includes(user.email.toLowerCase().trim()) : false;

    const base = {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      role,
      isDev,
    };

    if (role === 'teacher') {
      res.json({
        ...base,
        teacherProfileId: user.teacher_profile_id || null,
        yearsTeaching: user.years_teaching,
        level: user.level,
        mode: user.mode,
        avgClassSize: user.avg_class_size,
        onboardingComplete: user.onboarding_complete || false,
      });
    } else {
      res.json({
        ...base,
        batchYear: user.batch_year,
        batchLabel: user.batch_label,
        currentSemester: user.current_semester,
        isLateralEntry: user.is_lateral_entry,
        onboardingComplete: user.onboarding_complete || false,
      });
    }
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Internal server error.' });
  }
});

import { deleteDevTeacherData } from '../services/teacher.service.js';

/**
 * POST /api/auth/logout
 * Client-side logout (invalidate token on client). If dev email, reset temporary teacher DB entries.
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    if (req.user && req.user.email) {
      await deleteDevTeacherData(req.user.id, req.user.email);
    }
  } catch (err) {
    console.error('Logout dev cleanup error:', err);
  }
  res.json({ success: true, message: 'Logged out.' });
});

export default router;
