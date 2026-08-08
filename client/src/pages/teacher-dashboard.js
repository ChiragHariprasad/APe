/**
 * Teacher Dashboard Page — Shows courses managed by the teacher and their stage progress.
 */

import { api } from '../services/api.js';
import { showToast } from '../components/toast.js';

export async function renderTeacherDashboardPage(container, user) {
  container.innerHTML = `
    <div class="loading-page">
      <div class="spinner"></div>
      <p>Loading teacher dashboard...</p>
    </div>
  `;

  try {
    const data = await api.getTeacherDashboard();
    renderDashboard(container, user, data);
  } catch (err) {
    if (err.code === 'TEACHER_ONBOARDING_REQUIRED') {
      window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'teacher-onboarding' } }));
      return;
    }
    container.innerHTML = `
      <div class="loading-page">
        <p style="color: var(--color-error);">Failed to load dashboard: ${err.message}</p>
        <button class="btn btn-primary" onclick="location.reload()">Retry</button>
      </div>
    `;
  }
}

function renderDashboard(container, user, data) {
  const { teacher, courses, pedagogyLabels } = data;

  container.innerHTML = `
    <div class="page-enter">
      <!-- Header -->
      <header class="dashboard-header">
        <div class="container">
          <div class="header-inner">
            <div class="header-brand">
              <img src="/logo.png" class="header-logo" alt="APE Logo" />
              <span class="header-title">APE Faculty Portal</span>
            </div>
            <div class="header-user">
              <div class="header-user-info">
                <div class="header-user-name">${user?.displayName || 'Professor'} <span class="badge" style="background:var(--color-accent); color:white; font-size:10px; padding:2px 6px;">FACULTY</span></div>
                <div class="header-user-meta">${teacher?.yearsTeaching || 0} Yrs Exp · ${teacher?.level || 'UG'}</div>
              </div>
              ${user?.avatarUrl
                ? `<img src="${user.avatarUrl}" alt="" class="header-avatar" referrerpolicy="no-referrer" />`
                : `<div class="header-avatar" style="background: var(--color-accent); display:flex; align-items:center; justify-content:center; font-size:14px; color:white;">${(user?.displayName || 'T')[0]}</div>`
              }
              ${(user?.isDev || ['manoj.ai23@rvce.edu.in', 'chiragh.ai24@rvce.edu.in'].includes(user?.email)) ? `
                <button class="btn btn-ghost btn-sm" id="switch-student-view-btn" style="color:var(--color-accent); border:1px solid var(--color-accent); font-size:12px;">
                  🎓 Switch to Student View
                </button>
              ` : ''}
              <button class="btn btn-ghost btn-icon" id="logout-btn" title="Logout">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- Content -->
      <main class="dashboard-content">
        <div class="container">
          <div class="dashboard-welcome" style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:24px;">
            <div>
              <h1 style="margin:0 0 4px 0;">Course Pedagogy Evaluations</h1>
              <p style="margin:0; color:var(--color-text-muted);">Manage pedagogy profiles, adaptive interviews, and mismatch assessments for your courses</p>
            </div>
            <button class="btn btn-ghost btn-sm" id="manage-courses-btn">
              + Manage Courses
            </button>
          </div>

          ${courses.length === 0 ? `
            <div class="glass-card" style="padding:40px; text-align:center;">
              <p style="color:var(--color-text-muted); font-size:15px;">You haven't selected any courses yet.</p>
              <button class="btn btn-primary" id="empty-add-courses-btn">Select Courses Now</button>
            </div>
          ` : `
            <div class="cards-grid">
              ${courses.map(c => renderCourseCard(c, pedagogyLabels)).join('')}
            </div>
          `}
        </div>
      </main>
    </div>
  `;

  // Course card clicks
  container.querySelectorAll('.teacher-course-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const tcId = card.dataset.tcId;
      const isEval = e.target.closest('.t4-action-btn');
      if (isEval) {
        window.dispatchEvent(new CustomEvent('navigate', {
          detail: { page: 'teacher-evaluation', teacherCourseId: tcId }
        }));
      } else if (tcId) {
        window.dispatchEvent(new CustomEvent('navigate', {
          detail: { page: 'teacher-survey', teacherCourseId: tcId }
        }));
      }
    });
  });

  // Manage courses buttons
  const gotoOnboarding = () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'teacher-onboarding' } }));
  };
  document.getElementById('manage-courses-btn')?.addEventListener('click', gotoOnboarding);
  document.getElementById('empty-add-courses-btn')?.addEventListener('click', gotoOnboarding);

  // Switch view for dev
  document.getElementById('switch-student-view-btn')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'dashboard' } }));
  });

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    api.clearToken();
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'login' } }));
  });
}

function renderCourseCard(course, pedagogyLabels) {
  const isCompleted = course.status === 'completed';
  const isInProgress = course.status !== 'not_started' && course.status !== 'completed';

  let statusBadge = '';
  let statusDot = '';
  let actionText = 'Start Evaluation →';

  switch (course.status) {
    case 'completed':
      statusBadge = '<span class="badge badge-completed">✓ Completed</span>';
      statusDot = '<span class="status-dot completed"></span> Complete';
      actionText = 'View / Evaluate (T4) →';
      break;
    case 't1_in_progress':
      statusBadge = '<span class="badge badge-optional">Stage T1</span>';
      statusDot = '<span class="status-dot in-progress"></span> T1 Profile';
      actionText = 'Resume T1 →';
      break;
    case 't2_in_progress':
      statusBadge = '<span class="badge badge-optional">Stage T2</span>';
      statusDot = '<span class="status-dot in-progress"></span> T2 Course';
      actionText = 'Resume T2 →';
      break;
    case 'interview_in_progress':
      statusBadge = '<span class="badge badge-required">Interview</span>';
      statusDot = '<span class="status-dot in-progress"></span> Adaptive Interview';
      actionText = 'Continue Interview →';
      break;
    case 't3_in_progress':
      statusBadge = '<span class="badge badge-required">Stage T3</span>';
      statusDot = '<span class="status-dot in-progress"></span> Mismatch Probes';
      actionText = 'Continue T3 →';
      break;
    default:
      statusBadge = '<span class="badge badge-optional">Not Started</span>';
      statusDot = '<span class="status-dot not-started"></span> Not started';
      actionText = 'Start Flow (T1-T3) →';
  }

  const pedagogyName = pedagogyLabels[course.pedagogyId] || course.pedagogyName || course.pedagogyId;

  return `
    <div class="glass-card subject-card teacher-course-card ${isCompleted ? 'completed' : ''}"
         data-tc-id="${course.id}">
      <div class="card-header">
        <span class="card-code">${course.subjectCode}</span>
        ${statusBadge}
      </div>
      <div class="card-name">${course.subjectName}</div>
      <div class="card-meta">
        <span class="badge badge-pedagogy">${course.pedagogyId} · ${pedagogyName}</span>
        ${course.semesterNumber ? `<span class="badge badge-semester">Sem ${course.semesterNumber}</span>` : ''}
        ${course.isLab ? '<span class="badge badge-optional">Lab</span>' : ''}
        ${course.mismatchScenario ? `<span class="badge" style="background:rgba(239, 68, 68, 0.15); color:#f87171;">Scenario ${course.mismatchScenario}</span>` : ''}
      </div>
      <div class="card-footer" style="margin-top:16px;">
        <div class="card-status">${statusDot}</div>
        <span class="card-action">${actionText}</span>
      </div>
    </div>
  `;
}
