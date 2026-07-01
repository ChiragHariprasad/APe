import db from '../config/database.js';
import jwt from 'jsonwebtoken';
import { verifyIdToken, getTokensFromCode } from '../config/google-oauth.js';
import { isRvceEmail, extractUsnYear } from './batch.service.js';

/**
 * Process Google OAuth callback.
 * Validates domain, upserts user, returns JWT.
 */
export async function processGoogleCallback(code) {
  // Exchange authorization code for tokens
  const tokens = await getTokensFromCode(code);
  const payload = await verifyIdToken(tokens.id_token);

  const { sub: googleId, email, name, picture, hd } = payload;

  // Validate RVCE domain
  if (hd !== 'rvce.edu.in' || !isRvceEmail(email)) {
    throw Object.assign(new Error('Only @rvce.edu.in emails are allowed.'), {
      code: 'INVALID_DOMAIN',
      status: 403,
    });
  }

  // Upsert user
  const result = await db.query(
    `INSERT INTO users (google_id, email, display_name, avatar_url, last_login_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (google_id) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       avatar_url = EXCLUDED.avatar_url,
       last_login_at = NOW()
     RETURNING *`,
    [googleId, email.toLowerCase(), name, picture]
  );

  const user = result.rows[0];

  // Check if onboarding is complete
  const profileResult = await db.query(
    `SELECT onboarding_complete FROM student_profiles WHERE user_id = $1`,
    [user.id]
  );

  const needsOnboarding = profileResult.rows.length === 0 || !profileResult.rows[0].onboarding_complete;

  // Generate JWT
  const token = jwt.sign(
    { id: user.id, email: user.email, displayName: user.display_name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
    },
    needsOnboarding,
  };
}

/**
 * Get current user details.
 */
export async function getUserById(userId) {
  const result = await db.query(
    `SELECT u.*, sp.batch_id, sp.is_lateral_entry, sp.current_semester,
            sp.onboarding_complete, ab.batch_year, ab.label as batch_label
     FROM users u
     LEFT JOIN student_profiles sp ON u.id = sp.user_id
     LEFT JOIN academic_batches ab ON sp.batch_id = ab.id
     WHERE u.id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}
