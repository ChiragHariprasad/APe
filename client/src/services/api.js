/**
 * API client service.
 * Wraps fetch with auth token injection, error handling, and base URL configuration.
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('ape_token');
}

function setToken(token) {
  localStorage.setItem('ape_token', token);
}

function clearToken() {
  localStorage.removeItem('ape_token');
}

async function request(method, path, body = null, isFormData = false) {
  const headers = {};
  const token = getToken();

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (body && !isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const options = { method, headers };

  if (body) {
    options.body = isFormData ? body : JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, options);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.message || `Request failed with status ${res.status}`);
    error.status = res.status;
    error.code = data.error;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Auth
  getAuthUrl: () => `${API_BASE}/auth/google`,
  getMe: () => request('GET', '/auth/me'),
  logout: () => request('POST', '/auth/logout'),

  // Student Onboarding
  submitLateralEntry: (isLateralEntry) => request('POST', '/onboarding/lateral-entry', { isLateralEntry }),
  getBatchInfo: () => request('GET', '/onboarding/batch-info'),

  // Student Subjects
  getSubjects: () => request('GET', '/subjects'),

  // Student Survey
  startSurvey: (subjectId) => request('POST', '/survey/start', { subjectId }),
  getSession: (sessionId) => request('GET', `/survey/${sessionId}`),
  saveAnswer: (sessionId, questionIndex, rating) =>
    request('PUT', `/survey/${sessionId}/answer`, { questionIndex, rating }),
  saveOpenEnded: (sessionId, questionIndex, textResponse, voiceNoteId = null) =>
    request('PUT', `/survey/${sessionId}/open-ended`, { questionIndex, textResponse, voiceNoteId }),
  uploadVoiceNote: (sessionId, file, durationSecs) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('durationSecs', durationSecs.toString());
    return request('POST', `/survey/${sessionId}/voice-note`, formData, true);
  },
  submitSurvey: (sessionId) => request('POST', `/survey/${sessionId}/submit`),
  getProgress: () => request('GET', '/survey/progress/all'),

  // Teacher Endpoints
  submitTeacherOnboarding: (data) => request('POST', '/teacher/onboarding', data),
  getTeacherCourses: () => request('GET', '/teacher/courses'),
  selectTeacherCourses: (subjectIds) => request('POST', '/teacher/courses/select', { subjectIds }),
  getTeacherDashboard: () => request('GET', '/teacher/dashboard'),
  saveTeacherT1: (teacherCourseId, data) => request('PUT', `/teacher/survey/${teacherCourseId}/t1`, data),
  saveTeacherT2: (teacherCourseId, data) => request('PUT', `/teacher/survey/${teacherCourseId}/t2`, data),
  sendInterviewAnswer: (teacherCourseId, answer, question = '') =>
    request('POST', `/teacher/survey/${teacherCourseId}/interview`, { answer, question }),
  getInterviewState: (teacherCourseId) => request('GET', `/teacher/survey/${teacherCourseId}/interview`),
  getMismatchScenario: (teacherCourseId) => request('GET', `/teacher/survey/${teacherCourseId}/mismatch`),
  saveTeacherT3: (teacherCourseId, data) => request('POST', `/teacher/survey/${teacherCourseId}/t3`, data),
  submitTeacherSurvey: (teacherCourseId) => request('POST', `/teacher/survey/${teacherCourseId}/submit`),
  savePostEvaluation: (teacherCourseId, data) => request('POST', `/teacher/evaluation/${teacherCourseId}`, data),

  // Token management
  setToken,
  getToken,
  clearToken,
};
