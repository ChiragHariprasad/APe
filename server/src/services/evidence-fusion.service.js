/**
 * Evidence Fusion Service — 7-dimension recommendation engine and action decision matrix.
 *
 * Implements the fusion architecture:
 * Student evidence → Course Pedagogy Profile
 * Teacher evidence → Teacher Profile + Instructor-Course Constraints
 * Both → Evidence Fusion → Recalculated Recommendation → Action Decision
 */

/**
 * Compute the 7 dimensions of the recommendation:
 * 1. Student Evidence Support (0-1)
 * 2. Teacher Acceptance (0-1)
 * 3. Pedagogy-Learner Fit (0-1)
 * 4. Context Fit (0-1)
 * 5. Feasibility (0-1)
 * 6. Implementation Burden (0-1)
 * 7. Overall Recommendation Score (0-1)
 */
export function computeEvidenceFusion(studentData, teacherData, courseData) {
  const studentSupport = studentData ? (studentData.pes || 0.5) : 0.5;
  const teacherAcceptance = teacherData ? (teacherData.pedagogy_satisfaction || 3) / 5 : 0.5;

  const learnerFit = studentData ? ((studentData.cps || 0.5) + (studentData.lis || 0.5)) / 2 : 0.5;
  const contextFit = teacherData ? (teacherData.course_fit || 3) / 5 : 0.5;
  const feasibility = teacherData ? (teacherData.active_method_comfort || 3) / 5 : 0.5;

  // Implementation burden inverse of change readiness
  const readiness = teacherData ? ((teacherData.interest_trying || 3) + (teacherData.willingness_change || 3)) / 10 : 0.5;
  const implementationBurden = Math.max(0, 1 - readiness);

  // Overall weighted score
  const overallRecommendation = Math.round((
    (studentSupport * 0.25) +
    (teacherAcceptance * 0.20) +
    (learnerFit * 0.20) +
    (contextFit * 0.15) +
    (feasibility * 0.20)
  ) * 10000) / 10000;

  const action = decideAction(studentSupport, teacherAcceptance, feasibility);

  return {
    studentEvidenceSupport: Math.round(studentSupport * 10000) / 10000,
    teacherAcceptance: Math.round(teacherAcceptance * 10000) / 10000,
    pedagogyLearnerFit: Math.round(learnerFit * 10000) / 10000,
    contextFit: Math.round(contextFit * 10000) / 10000,
    feasibility: Math.round(feasibility * 10000) / 10000,
    implementationBurden: Math.round(implementationBurden * 10000) / 10000,
    overallRecommendation,
    recommendedAction: action,
  };
}

/**
 * Action decision table (from Section 20 of specification):
 *
 * Student | Teacher | Feasibility | Action
 * --------+---------+-------------+-------------------------------
 * Pos     | Pos     | High        | Continue
 * Pos     | Neg     | High        | Continue with minor adjustments
 * Pos     | Neg     | Low         | Blend / Redesign
 * Neg     | Pos     | High        | Investigate / Adjust
 * Neg     | Pos     | Low         | Consider Pivot
 * Neg     | Neg     | High        | Pivot
 * Neg     | Neg     | Low         | Pivot with constraints / Redesign
 */
export function decideAction(studentSupport, teacherAcceptance, feasibility) {
  const studentPos = studentSupport >= 0.65;
  const teacherPos = teacherAcceptance >= 0.65;
  const feasibilityHigh = feasibility >= 0.60;

  if (studentPos && teacherPos && feasibilityHigh) return 'continue';
  if (studentPos && teacherPos && !feasibilityHigh) return 'continue_with_adjustments';
  if (studentPos && !teacherPos && feasibilityHigh) return 'continue_with_adjustments';
  if (studentPos && !teacherPos && !feasibilityHigh) return 'blend';
  if (!studentPos && teacherPos && feasibilityHigh) return 'investigate_adjust';
  if (!studentPos && teacherPos && !feasibilityHigh) return 'consider_pivot';
  if (!studentPos && !teacherPos && feasibilityHigh) return 'pivot';
  return 'pivot_with_constraints';
}
