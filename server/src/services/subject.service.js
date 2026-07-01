import db from '../config/database.js';
import { getCompulsorySemesters } from './batch.service.js';

/**
 * Get categorized subjects for a student based on their batch and semester.
 *
 * @param {string} userId
 * @param {number} batchYear
 * @param {number} currentSemester
 * @returns {Object} { compulsory, optional, completed, labs }
 */
export async function getSubjectsForStudent(userId, batchYear, currentSemester) {
  // Get all subjects for this batch (non-lab)
  const subjectsResult = await db.query(
    `SELECT s.*, p.name as pedagogy_name, p.success_criterion
     FROM subjects s
     JOIN pedagogies p ON s.pedagogy_id = p.id
     WHERE s.batch_year = $1 AND s.is_lab = FALSE
     ORDER BY s.semester_number ASC, s.subject_code ASC`,
    [batchYear]
  );

  // Extract subject codes for this batch to filter labs
  const subjectCodes = subjectsResult.rows.map(s => s.subject_code);

  // Get lab subjects ONLY if they correspond to a theory subject in this batch
  const labsResult = await db.query(
    `SELECT s.*, p.name as pedagogy_name, p.success_criterion
     FROM subjects s
     JOIN pedagogies p ON s.pedagogy_id = p.id
     WHERE s.is_lab = TRUE AND s.subject_code = ANY($1)
     ORDER BY s.subject_code ASC`,
    [subjectCodes]
  );

  // Get completion status for this user
  const completionResult = await db.query(
    `SELECT ss.subject_id, ss.status, ss.current_index, ss.id as session_id
     FROM survey_sessions ss
     WHERE ss.user_id = $1`,
    [userId]
  );

  const statusMap = {};
  completionResult.rows.forEach(row => {
    statusMap[row.subject_id] = {
      status: row.status,
      currentIndex: row.current_index,
      sessionId: row.session_id,
    };
  });

  // Determine compulsory semesters
  const compulsorySems = getCompulsorySemesters(batchYear);

  // Categorize
  const compulsory = [];
  const optional = [];
  const completed = [];

  for (const subject of subjectsResult.rows) {
    const sessionInfo = statusMap[subject.id];
    const surveyStatus = sessionInfo
      ? sessionInfo.status === 'completed' ? 'completed' : 'in_progress'
      : 'not_started';

    const entry = {
      id: subject.id,
      subjectCode: subject.subject_code,
      subjectName: subject.subject_name,
      faculty: subject.faculty,
      pedagogyId: subject.pedagogy_id,
      pedagogyName: subject.pedagogy_name,
      semesterNumber: subject.semester_number,
      semesterKey: subject.semester_key,
      isLab: subject.is_lab,
      surveyStatus,
      currentIndex: sessionInfo?.currentIndex || 0,
      sessionId: sessionInfo?.sessionId || null,
    };

    if (surveyStatus === 'completed') {
      completed.push(entry);
    } else if (compulsorySems.includes(subject.semester_number)) {
      compulsory.push(entry);
    } else {
      optional.push(entry);
    }
  }

  // Labs — categorize by status
  const labs = labsResult.rows.map(subject => {
    const sessionInfo = statusMap[subject.id];
    const surveyStatus = sessionInfo
      ? sessionInfo.status === 'completed' ? 'completed' : 'in_progress'
      : 'not_started';

    return {
      id: subject.id,
      subjectCode: subject.subject_code,
      subjectName: subject.subject_name,
      faculty: subject.faculty,
      pedagogyId: subject.pedagogy_id,
      pedagogyName: subject.pedagogy_name,
      semesterNumber: subject.semester_number,
      semesterKey: subject.semester_key,
      isLab: true,
      surveyStatus,
      currentIndex: sessionInfo?.currentIndex || 0,
      sessionId: sessionInfo?.sessionId || null,
    };
  });

  return { compulsory, optional, completed, labs };
}
