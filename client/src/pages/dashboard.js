/**
 * Dashboard page — subject cards categorized as compulsory, optional, completed, labs.
 */

import { api } from '../services/api.js';
import { showToast } from '../components/toast.js';

export async function renderDashboardPage(container, user) {
  // Show loading
  container.innerHTML = `
    <div class="loading-page">
      <div class="spinner"></div>
      <p>Loading your subjects...</p>
    </div>
  `;

  try {
    const data = await api.getSubjects();
    renderDashboard(container, user, data);
  } catch (err) {
    if (err.code === 'ONBOARDING_REQUIRED') {
      window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'onboarding' } }));
      return;
    }
    container.innerHTML = `
      <div class="loading-page">
        <p style="color: var(--color-error);">Failed to load subjects. ${err.message}</p>
        <button class="btn btn-primary" onclick="location.reload()">Retry</button>
      </div>
    `;
  }
}

function renderDashboard(container, user, data) {
  const { compulsory, optional, completed, labs, batchYear, currentSemester } = data;

  container.innerHTML = `
    <div class="page-enter">
      <!-- Header -->
      <header class="dashboard-header">
        <div class="container">
          <div class="header-inner">
            <div class="header-brand">
              <img src="/logo.png" class="header-logo" alt="APE Logo" />
              <span class="header-title">APE Survey</span>
            </div>
            <div class="header-user">
              <div class="header-user-info">
                <div class="header-user-name">${user?.displayName || ''}</div>
                <div class="header-user-meta">${batchYear} Batch · Sem ${currentSemester}</div>
              </div>
              ${user?.avatarUrl
                ? `<img src="${user.avatarUrl}" alt="" class="header-avatar" referrerpolicy="no-referrer" />`
                : `<div class="header-avatar" style="background: var(--color-accent); display:flex; align-items:center; justify-content:center; font-size:14px; color:white;">${(user?.displayName || '?')[0]}</div>`
              }
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
          <div class="dashboard-welcome">
            <h1>Your Subjects</h1>
            <p>Complete the pedagogy evaluation surveys for your courses</p>
          </div>

          ${renderSection('Compulsory', compulsory, 'compulsory', '🔴')}
          ${renderSection('Optional (Previous Semesters)', optional, 'optional', '🔵')}
          ${renderSection('Labs', labs.filter(l => l.surveyStatus !== 'completed'), 'optional', '🧪')}
          ${renderSection('Completed', [...completed, ...labs.filter(l => l.surveyStatus === 'completed')], 'completed', '✅')}
        </div>
      </main>
    </div>
  `;

  // Event delegation for card clicks
  container.addEventListener('click', (e) => {
    const card = e.target.closest('.subject-card:not(.completed)');
    if (!card) return;

    const subjectId = card.dataset.subjectId;
    if (subjectId) {
      window.dispatchEvent(new CustomEvent('navigate', {
        detail: { page: 'survey', subjectId }
      }));
    }
  });

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    api.clearToken();
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'login' } }));
  });
}

function renderSection(title, subjects, type, icon) {
  if (!subjects || subjects.length === 0) return '';

  return `
    <div class="section-header">
      <span>${icon}</span>
      <h2>${title}</h2>
      <span class="section-count">${subjects.length}</span>
    </div>
    <div class="cards-grid">
      ${subjects.map(s => renderSubjectCard(s, type)).join('')}
    </div>
  `;
}

function renderSubjectCard(subject, type) {
  const isCompleted = subject.surveyStatus === 'completed';
  const isInProgress = subject.surveyStatus === 'in_progress';
  const progressPercent = isInProgress ? Math.round((subject.currentIndex / 12) * 100) : 0;

  const statusBadge = isCompleted
    ? '<span class="badge badge-completed">✓ Completed</span>'
    : type === 'compulsory'
      ? '<span class="badge badge-required">Required</span>'
      : '<span class="badge badge-optional">Optional</span>';

  const statusIndicator = isCompleted
    ? '<span class="status-dot completed"></span> Completed'
    : isInProgress
      ? `<span class="status-dot in-progress"></span> ${subject.currentIndex}/12 answered`
      : '<span class="status-dot not-started"></span> Not started';

  const actionText = isCompleted
    ? ''
    : isInProgress
      ? 'Resume →'
      : 'Start Survey →';

  const progressBar = isInProgress
    ? `<div class="progress-bar-container"><div class="progress-bar-fill" style="width: ${progressPercent}%"></div></div>`
    : '';

  return `
    <div class="glass-card subject-card ${type} ${isCompleted ? 'completed' : ''}"
         data-subject-id="${subject.id}"
         id="card-${subject.id}">
      <div class="card-header">
        <span class="card-code">${subject.subjectCode}</span>
        ${statusBadge}
      </div>
      <div class="card-name">${subject.subjectName}</div>
      <div class="card-faculty">${Array.isArray(subject.faculty) ? subject.faculty.join(' · ') : subject.faculty}</div>
      <div class="card-meta">
        <span class="badge badge-pedagogy">${subject.pedagogyId} · ${subject.pedagogyName}</span>
        ${subject.semesterNumber > 0 ? `<span class="badge badge-semester">Sem ${subject.semesterNumber}</span>` : ''}
        ${subject.isLab ? '<span class="badge badge-optional">Lab</span>' : ''}
      </div>
      <div class="card-footer">
        <div class="card-status">${statusIndicator}</div>
        <span class="card-action">${actionText}</span>
      </div>
      ${progressBar}
    </div>
  `;
}
