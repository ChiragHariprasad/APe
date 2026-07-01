/**
 * Batch detection service.
 * Determines academic batch and current semester from email year suffix and lateral entry status.
 *
 * KEY RULES:
 * - Survey is ALWAYS conducted after even semesters
 * - Lateral entry students are placed in the SENIOR batch (1 year earlier)
 * - Compulsory semesters are hardcoded per batch
 */

/**
 * Extract the USN year from an RVCE email address.
 * Pattern: 1rv{YY}{dept}{NNN}@rvce.edu.in
 * Example: 1rv23ai042@rvce.edu.in → 23
 */
export function extractUsnYear(email) {
  // Check standard USN format first: 1rv24ai...
  let match = email.match(/^1rv(\d{2})/i);
  if (match) return parseInt(match[1], 10);

  // Check named format: chiragh.ai24@rvce.edu.in or john.doe24@rvce.edu.in
  match = email.match(/\.[a-z]+(\d{2})@rvce\.edu\.in$/i);
  if (match) return parseInt(match[1], 10);

  return null;
}

/**
 * Determine the actual batch year, accounting for lateral entry.
 *
 * Lateral entry students join the senior batch (one year earlier).
 * Example:
 *   USN year 24, not lateral → batch 2024
 *   USN year 24, lateral     → batch 2023
 *   USN year 23, lateral     → batch 2022
 *
 * @param {number} usnYear - 2-digit year from USN (e.g. 24)
 * @param {boolean} isLateralEntry
 * @returns {number} 4-digit batch year
 */
export function determineBatchYear(usnYear, isLateralEntry) {
  const baseYear = 2000 + usnYear;
  return isLateralEntry ? baseYear - 1 : baseYear;
}

/**
 * Get the current semester for a batch.
 *
 * Since the APE survey is ALWAYS conducted after even semesters,
 * we use a fixed lookup rather than a date-based formula.
 *
 * @param {number} batchYear
 * @returns {number} Current even semester
 */
export function getCurrentSemester(batchYear) {
  const semesterMap = {
    2022: 8,   // Final year, semester 8
    2023: 6,   // 3rd year, semester 6
    2024: 4,   // 2nd year, semester 4
  };
  return semesterMap[batchYear] || 4;
}

/**
 * Determine which semesters are compulsory for a given batch.
 *
 * Rules (from user spec):
 *   2022 batch → semesters 7 AND 8 compulsory, rest optional
 *   2023 batch → semester 6 compulsory, rest optional
 *   2024 batch → semester 4 compulsory, rest optional
 *
 * @param {number} batchYear
 * @returns {number[]} Array of compulsory semester numbers
 */
export function getCompulsorySemesters(batchYear) {
  switch (batchYear) {
    case 2022: return [7, 8];
    case 2023: return [6];
    case 2024: return [4];
    default:   return [];
  }
}

/**
 * Validate that an email belongs to the RVCE domain.
 */
export function isRvceEmail(email) {
  return email && email.toLowerCase().endsWith('@rvce.edu.in');
}
