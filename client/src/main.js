/**
 * APE Survey — SPA Router & App Initialization
 * Minimal hash-less router with 4 pages:
 *   Login → Onboarding → Dashboard → Survey
 */

import { api } from './services/api.js';
import { renderLoginPage } from './pages/login.js';
import { renderOnboardingPage } from './pages/onboarding.js';
import { renderDashboardPage } from './pages/dashboard.js';
import { renderSurveyPage } from './pages/survey.js';
import { showToast } from './components/toast.js';

const app = document.getElementById('app');
let currentUser = null;

/**
 * Initialize the app — check auth state and route accordingly.
 */
async function init() {
  // Handle auth callback (token in URL from OAuth redirect)
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const error = params.get('error');

  if (token) {
    api.setToken(token);
    window.history.replaceState({}, '', '/');
  }

  if (error) {
    // Show login with error
    renderLoginPage(app);
    return;
  }

  // Check if we have a valid token
  const existingToken = api.getToken();
  if (!existingToken) {
    navigate('login');
    return;
  }

  // Validate token and get user
  try {
    currentUser = await api.getMe();

    if (!currentUser.onboardingComplete) {
      navigate('onboarding');
    } else {
      navigate('dashboard');
    }
  } catch (err) {
    // Token invalid/expired
    api.clearToken();
    navigate('login');
  }
}

/**
 * Navigate to a page.
 */
async function navigate(page, data = {}) {
  // Clean up any active recordings
  window.dispatchEvent(new Event('cleanup'));

  switch (page) {
    case 'login':
      currentUser = null;
      renderLoginPage(app);
      break;

    case 'onboarding':
      if (!currentUser) {
        try {
          currentUser = await api.getMe();
        } catch {
          navigate('login');
          return;
        }
      }
      renderOnboardingPage(app, currentUser);
      break;

    case 'dashboard':
      if (!currentUser) {
        try {
          currentUser = await api.getMe();
        } catch {
          navigate('login');
          return;
        }
      }
      await renderDashboardPage(app, currentUser);
      break;

    case 'survey':
      if (!currentUser) {
        try {
          currentUser = await api.getMe();
        } catch {
          navigate('login');
          return;
        }
      }
      if (!data.subjectId) {
        navigate('dashboard');
        return;
      }
      await renderSurveyPage(app, currentUser, data.subjectId);
      break;

    default:
      navigate('dashboard');
  }
}

// Listen for custom navigation events from pages
window.addEventListener('navigate', (e) => {
  const { page, ...data } = e.detail;
  navigate(page, data);
});

// Handle browser back/forward (not critical for this SPA but good practice)
window.addEventListener('popstate', () => {
  const token = api.getToken();
  if (token) {
    navigate('dashboard');
  } else {
    navigate('login');
  }
});

// Handle auth callback page
if (window.location.pathname === '/auth-callback') {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const needsOnboarding = params.get('needsOnboarding');
  const error = params.get('error');

  if (error) {
    renderLoginPage(app);
  } else if (token) {
    api.setToken(token);
    window.history.replaceState({}, '', '/');

    // Fetch user and route
    api.getMe().then(user => {
      currentUser = user;
      if (needsOnboarding === 'true' || !user.onboardingComplete) {
        navigate('onboarding');
      } else {
        navigate('dashboard');
      }
    }).catch((err) => {
      alert("Failed to connect to backend API! \\nError: " + err.message + "\\nAPI URL: " + import.meta.env.VITE_API_URL);
      navigate('login');
    });
  } else {
    window.history.replaceState({}, '', '/');
    init();
  }
} else {
  // Normal init
  init();
}
