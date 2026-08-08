/**
 * APE Survey — SPA Router & App Initialization
 * Hash-less SPA router supporting Student and Teacher (Faculty) workflows:
 *
 * Student Flow:
 *   Login → Onboarding (Lateral Entry) → Dashboard → Survey
 *
 * Teacher Flow:
 *   Login → Teacher Onboarding (Profile + Course Select) → Teacher Dashboard → Teacher Survey (T1-T3 + Interview) → Teacher Evaluation (T4)
 */

import { api } from './services/api.js';
import { renderLoginPage } from './pages/login.js';
import { renderOnboardingPage } from './pages/onboarding.js';
import { renderDashboardPage } from './pages/dashboard.js';
import { renderSurveyPage } from './pages/survey.js';
import { renderTeacherOnboardingPage } from './pages/teacher-onboarding.js';
import { renderTeacherDashboardPage } from './pages/teacher-dashboard.js';
import { renderTeacherSurveyPage } from './pages/teacher-survey.js';
import { renderTeacherEvaluationPage } from './pages/teacher-evaluation.js';
import { showToast } from './components/toast.js';

const app = document.getElementById('app');
let currentUser = null;
let activeViewMode = null; // 'student' | 'teacher' | null

/**
 * Initialize the app — check auth state and route accordingly based on role.
 */
async function init() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const error = params.get('error');

  if (token) {
    api.setToken(token);
    window.history.replaceState({}, '', '/');
  }

  if (error) {
    renderLoginPage(app);
    return;
  }

  const existingToken = api.getToken();
  if (!existingToken) {
    navigate('login');
    return;
  }

  try {
    currentUser = await api.getMe();
    routeUser(currentUser);
  } catch (err) {
    api.clearToken();
    navigate('login');
  }
}

/**
 * Route user based on role and onboarding status.
 */
function routeUser(user) {
  if (user.role === 'teacher') {
    if (!user.onboardingComplete) {
      navigate('teacher-onboarding');
    } else {
      navigate('teacher-dashboard');
    }
  } else {
    if (!user.onboardingComplete) {
      navigate('onboarding');
    } else {
      navigate('dashboard');
    }
  }
}

/**
 * Navigate to a page.
 */
async function navigate(page, data = {}) {
  window.dispatchEvent(new Event('cleanup'));

  if (data.forceRole) {
    activeViewMode = data.forceRole;
  }

  switch (page) {
    case 'login':
      currentUser = null;
      activeViewMode = null;
      renderLoginPage(app);
      break;

    // Student Pages
    case 'onboarding':
      if (!ensureUser()) return;
      renderOnboardingPage(app, currentUser);
      break;

    case 'dashboard':
    case 'student-dashboard':
      if (!ensureUser()) return;
      if (activeViewMode === 'student' || data.forceRole === 'student') {
        activeViewMode = 'student';
        await renderDashboardPage(app, currentUser);
      } else if (currentUser?.role === 'teacher') {
        renderTeacherDashboardPage(app, currentUser);
      } else {
        await renderDashboardPage(app, currentUser);
      }
      break;

    case 'survey':
      if (!ensureUser()) return;
      if (!data.subjectId) {
        navigate('dashboard');
        return;
      }
      await renderSurveyPage(app, currentUser, data.subjectId);
      break;

    // Teacher Pages
    case 'teacher-onboarding':
      if (!ensureUser()) return;
      renderTeacherOnboardingPage(app, currentUser);
      break;

    case 'teacher-dashboard':
      if (!ensureUser()) return;
      activeViewMode = 'teacher';
      await renderTeacherDashboardPage(app, currentUser);
      break;

    case 'teacher-survey':
      if (!ensureUser()) return;
      if (!data.teacherCourseId) {
        navigate('teacher-dashboard');
        return;
      }
      await renderTeacherSurveyPage(app, currentUser, data.teacherCourseId);
      break;

    case 'teacher-evaluation':
      if (!ensureUser()) return;
      if (!data.teacherCourseId) {
        navigate('teacher-dashboard');
        return;
      }
      await renderTeacherEvaluationPage(app, currentUser, data.teacherCourseId);
      break;

    default:
      if (currentUser?.role === 'teacher' && activeViewMode !== 'student') {
        navigate('teacher-dashboard');
      } else {
        navigate('dashboard');
      }
  }
}

async function ensureUser() {
  if (!currentUser) {
    try {
      currentUser = await api.getMe();
      return true;
    } catch {
      navigate('login');
      return false;
    }
  }
  return true;
}

// Listen for custom navigation events
window.addEventListener('navigate', (e) => {
  const { page, ...data } = e.detail;
  navigate(page, data);
});

// Handle browser back/forward
window.addEventListener('popstate', () => {
  const token = api.getToken();
  if (token) {
    if (currentUser?.role === 'teacher') navigate('teacher-dashboard');
    else navigate('dashboard');
  } else {
    navigate('login');
  }
});

// Handle auth callback page
if (window.location.pathname === '/auth-callback') {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const needsOnboarding = params.get('needsOnboarding');
  const role = params.get('role');
  const error = params.get('error');

  if (error) {
    renderLoginPage(app);
  } else if (token) {
    api.setToken(token);
    window.history.replaceState({}, '', '/');

    api.getMe().then(user => {
      currentUser = user;
      routeUser(user);
    }).catch((err) => {
      alert("Failed to connect to backend API!\nError: " + err.message);
      navigate('login');
    });
  } else {
    window.history.replaceState({}, '', '/');
    init();
  }
} else {
  init();
}
