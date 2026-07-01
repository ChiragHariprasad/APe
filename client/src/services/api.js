/**
 * API client service.
 * Wraps fetch with auth token injection, error handling, and base URL configuration.
 */

const API_BASE = '/api';

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

  // Onboarding
  submitLateralEntry: (isLateralEntry) => request('POST', '/onboarding/lateral-entry', { isLateralEntry }),
  getBatchInfo: () => request('GET', '/onboarding/batch-info'),

  // Subjects
  getSubjects: () => request('GET', '/subjects'),

  // Survey
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

  // Token management
  setToken,
  getToken,
  clearToken,
};
