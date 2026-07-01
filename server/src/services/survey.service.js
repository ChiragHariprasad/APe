import db from '../config/database.js';

// The two fixed open-ended questions
const OPEN_ENDED_QUESTIONS = [
  'What aspect of the teaching approach helped you learn most effectively, and why?',
  'What is the main skill, concept, or takeaway you gained from this course because of this teaching style?',
];

/**
 * Start a new survey session or resume an existing one.
 */
export async function startOrResumeSession(userId, subjectId) {
  // Check for existing session
  const existing = await db.query(
    `SELECT * FROM survey_sessions WHERE user_id = $1 AND subject_id = $2`,
    [userId, subjectId]
  );

  if (existing.rows.length > 0) {
    const session = existing.rows[0];

    if (session.status === 'completed') {
      throw Object.assign(new Error('Survey already completed for this subject.'), {
        code: 'ALREADY_COMPLETED',
        status: 400,
      });
    }

    // Resume: get existing answers
    return await getSessionDetails(session.id);
  }

  // Create new session
  const result = await db.query(
    `INSERT INTO survey_sessions (user_id, subject_id)
     VALUES ($1, $2)
     RETURNING *`,
    [userId, subjectId]
  );

  return await getSessionDetails(result.rows[0].id);
}

/**
 * Get full session details including subject info, pedagogy questions, and existing answers.
 */
export async function getSessionDetails(sessionId) {
  // Get session with subject and pedagogy info
  const sessionResult = await db.query(
    `SELECT ss.*, s.subject_code, s.subject_name, s.pedagogy_id, s.faculty,
            p.name as pedagogy_name, p.questions as pedagogy_questions
     FROM survey_sessions ss
     JOIN subjects s ON ss.subject_id = s.id
     JOIN pedagogies p ON s.pedagogy_id = p.id
     WHERE ss.id = $1`,
    [sessionId]
  );

  if (sessionResult.rows.length === 0) {
    throw Object.assign(new Error('Session not found.'), { code: 'NOT_FOUND', status: 404 });
  }

  const session = sessionResult.rows[0];
  const pedagogyQuestions = session.pedagogy_questions; // JSONB array of 10 strings

  // Get existing Likert answers
  const likertResult = await db.query(
    `SELECT question_index, rating FROM survey_answers WHERE session_id = $1 ORDER BY question_index`,
    [sessionId]
  );

  // Get existing open-ended answers
  const openEndedResult = await db.query(
    `SELECT question_index, text_response, voice_note_id FROM open_ended_responses WHERE session_id = $1 ORDER BY question_index`,
    [sessionId]
  );

  // Build answers map
  const answers = {};
  likertResult.rows.forEach(row => {
    answers[row.question_index] = { rating: row.rating };
  });
  openEndedResult.rows.forEach(row => {
    answers[row.question_index] = {
      textResponse: row.text_response,
      voiceNoteId: row.voice_note_id,
    };
  });

  // Build questions array (10 pedagogy + 2 open-ended)
  const questions = pedagogyQuestions.map((text, index) => ({
    index,
    text,
    type: 'likert',
  }));

  OPEN_ENDED_QUESTIONS.forEach((text, i) => {
    questions.push({
      index: 10 + i,
      text,
      type: 'open_ended',
    });
  });

  return {
    sessionId: session.id,
    subjectCode: session.subject_code,
    subjectName: session.subject_name,
    pedagogyId: session.pedagogy_id,
    pedagogyName: session.pedagogy_name,
    faculty: session.faculty,
    status: session.status,
    questions,
    currentIndex: session.current_index,
    answers,
  };
}

/**
 * Save a Likert-scale answer (question index 0-9).
 */
export async function saveLikertAnswer(sessionId, userId, questionIndex, rating) {
  // Validate session belongs to user
  await validateSessionOwnership(sessionId, userId);

  // Validate question index
  if (questionIndex < 0 || questionIndex > 9) {
    throw Object.assign(new Error('Invalid question index for Likert answer.'), {
      code: 'INVALID_INDEX', status: 400,
    });
  }

  // Validate rating
  if (rating < 1 || rating > 5) {
    throw Object.assign(new Error('Rating must be between 1 and 5.'), {
      code: 'INVALID_RATING', status: 400,
    });
  }

  // Upsert answer
  await db.query(
    `INSERT INTO survey_answers (session_id, question_index, rating)
     VALUES ($1, $2, $3)
     ON CONFLICT (session_id, question_index) DO UPDATE SET
       rating = EXCLUDED.rating,
       updated_at = NOW()`,
    [sessionId, questionIndex, rating]
  );

  // Update session current_index
  const nextIndex = questionIndex + 1;
  await db.query(
    `UPDATE survey_sessions SET current_index = GREATEST(current_index, $1), updated_at = NOW()
     WHERE id = $2`,
    [nextIndex, sessionId]
  );

  return { saved: true, nextIndex };
}

/**
 * Save an open-ended response (question index 10 or 11).
 */
export async function saveOpenEndedAnswer(sessionId, userId, questionIndex, textResponse, voiceNoteId = null) {
  await validateSessionOwnership(sessionId, userId);

  if (questionIndex !== 10 && questionIndex !== 11) {
    throw Object.assign(new Error('Invalid question index for open-ended answer.'), {
      code: 'INVALID_INDEX', status: 400,
    });
  }

  // Must have at least text or voice note
  if (!textResponse && !voiceNoteId) {
    throw Object.assign(new Error('Please provide a text response or voice note.'), {
      code: 'EMPTY_RESPONSE', status: 400,
    });
  }

  const questionText = OPEN_ENDED_QUESTIONS[questionIndex - 10];

  await db.query(
    `INSERT INTO open_ended_responses (session_id, question_index, question_text, text_response, voice_note_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (session_id, question_index) DO UPDATE SET
       text_response = EXCLUDED.text_response,
       voice_note_id = COALESCE(EXCLUDED.voice_note_id, open_ended_responses.voice_note_id),
       updated_at = NOW()`,
    [sessionId, questionIndex, questionText, textResponse, voiceNoteId]
  );

  const nextIndex = questionIndex + 1;
  await db.query(
    `UPDATE survey_sessions SET current_index = GREATEST(current_index, $1), updated_at = NOW()
     WHERE id = $2`,
    [nextIndex, sessionId]
  );

  return { saved: true, nextIndex };
}

/**
 * Save a voice note and return its ID.
 */
export async function saveVoiceNote(userId, storageUrl, storageKey, mimeType, durationSecs, fileSizeBytes) {
  if (durationSecs > 240) {
    throw Object.assign(new Error(`Voice note must be 4 minutes or less. Received: ${durationSecs} seconds.`), {
      code: 'DURATION_EXCEEDED', status: 400,
    });
  }

  const result = await db.query(
    `INSERT INTO voice_notes (user_id, storage_url, storage_key, mime_type, duration_secs, file_size_bytes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, storageUrl, storageKey, mimeType, durationSecs, fileSizeBytes]
  );

  return result.rows[0];
}

/**
 * Submit a completed survey.
 */
export async function submitSurvey(sessionId, userId) {
  await validateSessionOwnership(sessionId, userId);

  // Check all 10 Likert answers exist
  const likertResult = await db.query(
    `SELECT question_index FROM survey_answers WHERE session_id = $1`,
    [sessionId]
  );
  const answeredLikert = new Set(likertResult.rows.map(r => r.question_index));

  // Check both open-ended answers exist
  const openEndedResult = await db.query(
    `SELECT question_index, text_response, voice_note_id FROM open_ended_responses WHERE session_id = $1`,
    [sessionId]
  );
  const answeredOpenEnded = new Set(openEndedResult.rows.map(r => r.question_index));

  const missingIndices = [];
  for (let i = 0; i < 10; i++) {
    if (!answeredLikert.has(i)) missingIndices.push(i);
  }
  for (let i = 10; i < 12; i++) {
    if (!answeredOpenEnded.has(i)) missingIndices.push(i);
  }

  // Also check open-ended have content
  for (const row of openEndedResult.rows) {
    if (!row.text_response && !row.voice_note_id) {
      missingIndices.push(row.question_index);
    }
  }

  if (missingIndices.length > 0) {
    throw Object.assign(new Error(`Questions ${missingIndices.join(', ')} are unanswered.`), {
      code: 'INCOMPLETE_SURVEY', status: 400, missingIndices,
    });
  }

  // Mark as completed
  const now = new Date();
  await db.query(
    `UPDATE survey_sessions SET status = 'completed', completed_at = $1, updated_at = $1
     WHERE id = $2`,
    [now, sessionId]
  );

  // Get subject_id for completion_status
  const sessionResult = await db.query(
    `SELECT subject_id FROM survey_sessions WHERE id = $1`,
    [sessionId]
  );

  // Upsert completion_status
  await db.query(
    `INSERT INTO completion_status (user_id, subject_id, session_id, is_completed, completed_at)
     VALUES ($1, $2, $3, TRUE, $4)
     ON CONFLICT (user_id, subject_id) DO UPDATE SET
       is_completed = TRUE,
       completed_at = EXCLUDED.completed_at`,
    [userId, sessionResult.rows[0].subject_id, sessionId, now]
  );

  return { status: 'completed', completedAt: now.toISOString() };
}

/**
 * Get all in-progress sessions for a user.
 */
export async function getProgressForUser(userId) {
  const result = await db.query(
    `SELECT ss.id as session_id, ss.status, ss.current_index, ss.updated_at,
            s.subject_code, s.subject_name
     FROM survey_sessions ss
     JOIN subjects s ON ss.subject_id = s.id
     WHERE ss.user_id = $1 AND ss.status = 'in_progress'
     ORDER BY ss.updated_at DESC`,
    [userId]
  );

  return result.rows.map(row => ({
    sessionId: row.session_id,
    subjectCode: row.subject_code,
    subjectName: row.subject_name,
    status: row.status,
    currentIndex: row.current_index,
    totalQuestions: 12,
    updatedAt: row.updated_at,
  }));
}

/**
 * Validate that a session belongs to the requesting user.
 */
async function validateSessionOwnership(sessionId, userId) {
  const result = await db.query(
    `SELECT id, status FROM survey_sessions WHERE id = $1 AND user_id = $2`,
    [sessionId, userId]
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error('Session not found or access denied.'), {
      code: 'NOT_FOUND', status: 404,
    });
  }

  if (result.rows[0].status === 'completed') {
    throw Object.assign(new Error('This survey has already been submitted.'), {
      code: 'ALREADY_COMPLETED', status: 400,
    });
  }

  return result.rows[0];
}

export { OPEN_ENDED_QUESTIONS };
