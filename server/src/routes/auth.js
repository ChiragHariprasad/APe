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

    // Redirect to frontend with token
    const params = new URLSearchParams({
      token: result.token,
      needsOnboarding: result.needsOnboarding.toString(),
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
    const user = await getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' });
    }
    res.json({
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      batchYear: user.batch_year,
      batchLabel: user.batch_label,
      currentSemester: user.current_semester,
      isLateralEntry: user.is_lateral_entry,
      onboardingComplete: user.onboarding_complete || false,
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Internal server error.' });
  }
});

/**
 * POST /api/auth/logout
 * Client-side logout (invalidate token on client).
 */
router.post('/logout', authenticateToken, (req, res) => {
  // JWT is stateless; client should discard the token.
  // For server-side invalidation, add token to a blacklist (not implemented for MVP).
  res.json({ success: true, message: 'Logged out.' });
});

export default router;
