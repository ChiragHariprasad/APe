/**
 * Transcription service placeholder.
 * In production, this would call Whisper API or Google Speech-to-Text.
 */

import db from '../config/database.js';

const TRANSCRIPTION_ENABLED = process.env.TRANSCRIPTION_ENABLED === 'true';

/**
 * Queue a voice note for transcription.
 * In production: sends to a job queue (Bull, Cloud Tasks).
 * In dev: creates a placeholder transcript.
 */
export async function transcribeVoiceNote(voiceNoteId) {
  if (!TRANSCRIPTION_ENABLED) {
    // Dev mode: create placeholder
    await db.query(
      `INSERT INTO transcripts (voice_note_id, transcript_text, confidence, provider)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (voice_note_id) DO NOTHING`,
      [voiceNoteId, '[Transcription not enabled in development mode]', 0.0, 'dev-placeholder']
    );
    return { status: 'placeholder' };
  }

  // Production: would call transcription API
  // const voiceNote = await db.query('SELECT * FROM voice_notes WHERE id = $1', [voiceNoteId]);
  // const audioUrl = voiceNote.rows[0].storage_url;
  // const transcript = await whisperApi.transcribe(audioUrl);
  // await db.query(
  //   `INSERT INTO transcripts (voice_note_id, transcript_text, confidence, provider)
  //    VALUES ($1, $2, $3, 'whisper')`,
  //   [voiceNoteId, transcript.text, transcript.confidence]
  // );

  return { status: 'queued' };
}

/**
 * Get transcript for a voice note.
 */
export async function getTranscript(voiceNoteId) {
  const result = await db.query(
    `SELECT * FROM transcripts WHERE voice_note_id = $1`,
    [voiceNoteId]
  );
  return result.rows[0] || null;
}
