/**
 * Teacher service — CRUD for teacher profiles, course selection, and survey management.
 */

import db from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COURSE_KNOWLEDGE_PATH = path.resolve(__dirname, '../../../course_knowledge.json');

// Supabase client for reading student PES
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
}

// ── Teacher Profile (T1 general) ───────────────────────────

/**
 * Create or update teacher profile (general dispositional traits).
 */
export async function upsertTeacherProfile(userId, data) {
  const {
    yearsTeaching, level, mode, avgClassSize,
    capabilityConfidence, interestNewMethods, edtechComfort,
  } = data;

  const result = await db.query(
    `INSERT INTO teacher_profiles (
       user_id, years_teaching, level, mode, avg_class_size,
       capability_confidence, interest_new_methods, edtech_comfort,
       onboarding_complete, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       years_teaching = EXCLUDED.years_teaching,
       level = EXCLUDED.level,
       mode = EXCLUDED.mode,
       avg_class_size = EXCLUDED.avg_class_size,
       capability_confidence = EXCLUDED.capability_confidence,
       interest_new_methods = EXCLUDED.interest_new_methods,
       edtech_comfort = EXCLUDED.edtech_comfort,
       onboarding_complete = TRUE,
       updated_at = NOW()
     RETURNING *`,
    [userId, yearsTeaching, level, mode, avgClassSize,
     capabilityConfidence, interestNewMethods, edtechComfort]
  );

  return result.rows[0];
}

/**
 * Get teacher profile by user ID.
 */
export async function getTeacherProfile(userId) {
  const result = await db.query(
    `SELECT * FROM teacher_profiles WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

// ── Course Selection ───────────────────────────────────────

/**
 * Load all courses from course_knowledge.json, grouped by semester.
 * Returns flattened array with batch/semester context.
 */
export function loadAllCourses() {
  const raw = fs.readFileSync(COURSE_KNOWLEDGE_PATH, 'utf-8');
  const data = JSON.parse(raw);
  const courses = [];

  for (const [batchYear, semesters] of Object.entries(data)) {
    if (batchYear === 'labs') {
      for (const [code, info] of Object.entries(semesters)) {
        courses.push({
          subjectCode: code,
          subjectName: info.subject,
          faculty: info.faculty || [],
          pedagogy: info.pedagogy,
          isLab: true,
          batchYear: null,
          semesterKey: 'labs',
          semesterNumber: null,
        });
      }
    } else {
      for (const [semKey, subjects] of Object.entries(semesters)) {
        const semNum = parseInt(semKey.replace('semester_', ''), 10);
        for (const [code, info] of Object.entries(subjects)) {
          courses.push({
            subjectCode: code,
            subjectName: info.subject,
            faculty: info.faculty || [],
            pedagogy: info.pedagogy,
            isLab: false,
            batchYear: parseInt(batchYear, 10),
            semesterKey: semKey,
            semesterNumber: semNum,
          });
        }
      }
    }
  }

  return courses;
}

/**
 * Select courses for a teacher. Creates teacher_course_profiles rows.
 * subjectIds should be UUIDs from the subjects table.
 */
export async function selectTeacherCourses(teacherId, subjectIds) {
  const created = [];

  for (const subjectId of subjectIds) {
    const result = await db.query(
      `INSERT INTO teacher_course_profiles (teacher_id, subject_id, status)
       VALUES ($1, $2, 'not_started')
       ON CONFLICT (teacher_id, subject_id) DO NOTHING
       RETURNING *`,
      [teacherId, subjectId]
    );
    if (result.rows.length > 0) {
      created.push(result.rows[0]);
    }
  }

  return created;
}

// ── Teacher Dashboard ──────────────────────────────────────

/**
 * Get all courses for a teacher with survey status.
 */
export async function getTeacherDashboard(teacherId) {
  const result = await db.query(
    `SELECT tcp.*, s.subject_code, s.subject_name, s.faculty, s.pedagogy_id,
            s.semester_number, s.semester_key, s.is_lab,
            p.name as pedagogy_name
     FROM teacher_course_profiles tcp
     JOIN subjects s ON tcp.subject_id = s.id
     JOIN pedagogies p ON s.pedagogy_id = p.id
     WHERE tcp.teacher_id = $1
     ORDER BY s.semester_number ASC, s.subject_code ASC`,
    [teacherId]
  );

  return result.rows.map(row => ({
    id: row.id,
    subjectId: row.subject_id,
    subjectCode: row.subject_code,
    subjectName: row.subject_name,
    faculty: row.faculty,
    pedagogyId: row.pedagogy_id,
    pedagogyName: row.pedagogy_name,
    semesterNumber: row.semester_number,
    isLab: row.is_lab,
    status: row.status,
    mismatchScenario: row.mismatch_scenario,
    completedAt: row.completed_at,
  }));
}

// ── T1 + T2 Responses ──────────────────────────────────────

/**
 * Save T1 (teacher profile per course) responses.
 */
export async function saveT1Responses(teacherCourseId, data) {
  const result = await db.query(
    `UPDATE teacher_course_profiles SET
       current_pedagogies = $2,
       primary_pedagogy = $3,
       primary_confidence = $4,
       active_method_comfort = $5,
       interest_trying = $6,
       willingness_change = $7,
       willing_changes = $8,
       constraints_vector = $9,
       top_constraints = $10,
       status = 't2_in_progress',
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      teacherCourseId,
      JSON.stringify(data.currentPedagogies || []),
      data.primaryPedagogy,
      data.primaryConfidence,
      data.activeMethodComfort,
      data.interestTrying,
      data.willingnessChange,
      JSON.stringify(data.willingChanges || []),
      JSON.stringify(data.constraintsVector || []),
      JSON.stringify(data.topConstraints || []),
    ]
  );
  return result.rows[0];
}

/**
 * Save T2 (course pedagogy profile) responses.
 */
export async function saveT2Responses(teacherCourseId, data) {
  const result = await db.query(
    `UPDATE teacher_course_profiles SET
       course_pedagogies = $2,
       course_primary = $3,
       perceived_effectiveness = $4,
       pedagogy_satisfaction = $5,
       course_fit = $6,
       course_barriers = $7,
       change_enablers = $8,
       status = 'interview_in_progress',
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      teacherCourseId,
      JSON.stringify(data.coursePedagogies || []),
      data.coursePrimary,
      data.perceivedEffectiveness,
      data.pedagogySatisfaction,
      data.courseFit,
      JSON.stringify(data.courseBarriers || []),
      JSON.stringify(data.changeEnablers || []),
    ]
  );
  return result.rows[0];
}

// ── Interview Turn Storage ─────────────────────────────────

/**
 * Save a single interview turn.
 */
export async function saveInterviewTurn(teacherCourseId, turnIndex, branch, question, answer, llmClassification) {
  const result = await db.query(
    `INSERT INTO teacher_interview_turns (teacher_course_id, turn_index, branch, question, answer, llm_classification)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [teacherCourseId, turnIndex, branch, question, answer, JSON.stringify(llmClassification || {})]
  );
  return result.rows[0];
}

/**
 * Get all interview turns for a course profile.
 */
export async function getInterviewTurns(teacherCourseId) {
  const result = await db.query(
    `SELECT * FROM teacher_interview_turns
     WHERE teacher_course_id = $1
     ORDER BY turn_index ASC`,
    [teacherCourseId]
  );
  return result.rows;
}

/**
 * Save the extracted interview profile and pedagogy mix.
 */
export async function saveInterviewResults(teacherCourseId, interviewProfile, pedagogyMix) {
  const result = await db.query(
    `UPDATE teacher_course_profiles SET
       interview_profile = $2,
       pedagogy_mix = $3,
       status = 't3_in_progress',
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [teacherCourseId, JSON.stringify(interviewProfile), JSON.stringify(pedagogyMix)]
  );
  return result.rows[0];
}

// ── T3 Mismatch Detection ──────────────────────────────────

/**
 * Determine mismatch scenario by comparing teacher satisfaction with student PES.
 * Returns { scenario, studentPES, teacherSatisfaction }
 */
export async function determineMismatchScenario(teacherCourseId) {
  // Get teacher data
  const tcpResult = await db.query(
    `SELECT tcp.pedagogy_satisfaction, tcp.subject_id, s.subject_code
     FROM teacher_course_profiles tcp
     JOIN subjects s ON tcp.subject_id = s.id
     WHERE tcp.id = $1`,
    [teacherCourseId]
  );

  if (tcpResult.rows.length === 0) {
    throw Object.assign(new Error('Teacher course profile not found.'), { code: 'NOT_FOUND', status: 404 });
  }

  const { pedagogy_satisfaction, subject_id } = tcpResult.rows[0];

  // Get average student PES from Supabase
  let studentPES = null;
  if (supabase) {
    const { data, error } = await supabase
      .from('processed_survey_results')
      .select('pes')
      .eq('subject_id', subject_id);

    if (!error && data && data.length > 0) {
      studentPES = data.reduce((sum, r) => sum + (r.pes || 0), 0) / data.length;
    }
  }

  // Thresholds
  const teacherSatisfied = pedagogy_satisfaction >= 4;  // Likert 1-5, >= 4 = satisfied
  const studentSatisfied = studentPES !== null ? studentPES >= 0.65 : null;  // PES 0-1, >= 0.65

  let scenario;
  if (studentPES === null) {
    // No student data yet — can't determine mismatch, skip T3
    scenario = 'A';
  } else if (teacherSatisfied && studentSatisfied) {
    scenario = 'A';
  } else if (teacherSatisfied && !studentSatisfied) {
    scenario = 'B';
  } else if (!teacherSatisfied && studentSatisfied) {
    scenario = 'C';
  } else {
    scenario = 'D';
  }

  return {
    scenario,
    studentPES: studentPES !== null ? Math.round(studentPES * 10000) / 10000 : null,
    teacherSatisfaction: pedagogy_satisfaction,
  };
}

/**
 * Save T3 mismatch probe responses.
 */
export async function saveT3Responses(teacherCourseId, data) {
  // Update the scenario on the course profile
  await db.query(
    `UPDATE teacher_course_profiles SET mismatch_scenario = $2, updated_at = NOW() WHERE id = $1`,
    [teacherCourseId, data.scenario]
  );

  // Insert mismatch probe data
  const result = await db.query(
    `INSERT INTO teacher_mismatch_probes (
       teacher_course_id, scenario, student_pes, teacher_satisfaction,
       effectiveness_reasons, willingness_to_change, change_requirements,
       pedagogy_problems, continue_if_positive, ease_changes,
       preferred_changes, interested_pedagogies, change_barriers
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      teacherCourseId,
      data.scenario,
      data.studentPES,
      data.teacherSatisfaction,
      JSON.stringify(data.effectivenessReasons || null),
      data.willingnessToChange || null,
      JSON.stringify(data.changeRequirements || null),
      JSON.stringify(data.pedagogyProblems || null),
      data.continueIfPositive || null,
      JSON.stringify(data.easeChanges || null),
      JSON.stringify(data.preferredChanges || null),
      JSON.stringify(data.interestedPedagogies || null),
      JSON.stringify(data.changeBarriers || null),
    ]
  );

  return result.rows[0];
}

// ── Submit ──────────────────────────────────────────────────

/**
 * Complete the teacher survey for a course (T1–T3 done).
 */
export async function submitTeacherSurvey(teacherCourseId) {
  const result = await db.query(
    `UPDATE teacher_course_profiles SET
       status = 'completed',
       completed_at = NOW(),
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [teacherCourseId]
  );
  return result.rows[0];
}

// ── T4 Post-Evaluation ─────────────────────────────────────

/**
 * Save T4 post-intervention evaluation.
 */
export async function savePostEvaluation(teacherCourseId, data) {
  const feasibilityScore = (
    (data.timeFit || 0) + (data.effortManageable || 0) +
    (data.prepManageable || 0) + (data.mgmtManageable || 0)
  ) / 4;

  const contextFitScore = (
    (data.classSizeFit || 0) + (data.studentReadinessFit || 0) +
    (data.subjectDifficultyFit || 0) + (data.curriculumFit || 0) +
    (data.participationFit || 0)
  ) / 5;

  const resourceBurdenScore = (
    (data.planningBurden || 0) + (data.techBurden || 0) +
    (data.materialBurden || 0) + (data.workloadBurden || 0) +
    (data.assessmentBurden || 0)
  ) / 5;

  const result = await db.query(
    `INSERT INTO teacher_post_evaluations (
       teacher_course_id, evaluated_pedagogy,
       effectiveness_score, time_fit, effort_manageable, prep_manageable, mgmt_manageable, feasibility_score,
       class_size_fit, student_readiness_fit, subject_difficulty_fit, curriculum_fit, participation_fit, context_fit_score,
       planning_burden, tech_burden, material_burden, workload_burden, assessment_burden, resource_burden_score,
       teacher_action, ape_action
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
     ON CONFLICT (teacher_course_id, evaluated_pedagogy) DO UPDATE SET
       effectiveness_score = EXCLUDED.effectiveness_score,
       time_fit = EXCLUDED.time_fit,
       effort_manageable = EXCLUDED.effort_manageable,
       prep_manageable = EXCLUDED.prep_manageable,
       mgmt_manageable = EXCLUDED.mgmt_manageable,
       feasibility_score = EXCLUDED.feasibility_score,
       class_size_fit = EXCLUDED.class_size_fit,
       student_readiness_fit = EXCLUDED.student_readiness_fit,
       subject_difficulty_fit = EXCLUDED.subject_difficulty_fit,
       curriculum_fit = EXCLUDED.curriculum_fit,
       participation_fit = EXCLUDED.participation_fit,
       context_fit_score = EXCLUDED.context_fit_score,
       planning_burden = EXCLUDED.planning_burden,
       tech_burden = EXCLUDED.tech_burden,
       material_burden = EXCLUDED.material_burden,
       workload_burden = EXCLUDED.workload_burden,
       assessment_burden = EXCLUDED.assessment_burden,
       resource_burden_score = EXCLUDED.resource_burden_score,
       teacher_action = EXCLUDED.teacher_action,
       ape_action = EXCLUDED.ape_action
     RETURNING *`,
    [
      teacherCourseId, data.evaluatedPedagogy,
      data.effectivenessScore, data.timeFit, data.effortManageable, data.prepManageable, data.mgmtManageable,
      Math.round(feasibilityScore * 100) / 100,
      data.classSizeFit, data.studentReadinessFit, data.subjectDifficultyFit, data.curriculumFit, data.participationFit,
      Math.round(contextFitScore * 100) / 100,
      data.planningBurden, data.techBurden, data.materialBurden, data.workloadBurden, data.assessmentBurden,
      Math.round(resourceBurdenScore * 100) / 100,
      data.teacherAction, data.apeAction || null,
    ]
  );

  return result.rows[0];
}

/**
 * Get all subjects available for teacher selection (from subjects table in Neon).
 * Groups by semester for easy UI rendering.
 */
export async function getAvailableSubjects() {
  const result = await db.query(
    `SELECT s.id, s.subject_code, s.subject_name, s.faculty, s.pedagogy_id,
            s.batch_year, s.semester_key, s.semester_number, s.is_lab,
            p.name as pedagogy_name
     FROM subjects s
     JOIN pedagogies p ON s.pedagogy_id = p.id
     ORDER BY s.batch_year DESC, s.semester_number ASC, s.subject_code ASC`
  );

  // Group by "batchYear_semesterKey"
  const grouped = {};
  for (const row of result.rows) {
    const key = row.is_lab ? 'Labs' : `${row.batch_year} — Semester ${row.semester_number}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({
      id: row.id,
      subjectCode: row.subject_code,
      subjectName: row.subject_name,
      faculty: row.faculty,
      pedagogyId: row.pedagogy_id,
      pedagogyName: row.pedagogy_name,
      batchYear: row.batch_year,
      semesterNumber: row.semester_number,
      isLab: row.is_lab,
    });
  }

  return grouped;
}
