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
              ${(user?.isDev || ['manoj.ai23@rvce.edu.in', 'chiragh.ai24@rvce.edu.in'].includes(user?.email)) ? `
                <button class="btn btn-ghost btn-sm" id="switch-view-btn" style="color:var(--color-accent); border:1px solid var(--color-accent); font-size:12px; display:inline-flex; align-items:center; gap:6px;">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6"/><path d="M2 11.5a10 10 0 0 1 18.8-4.3L21.5 8M22 12.5a10 10 0 0 1-18.8 4.3L2.5 16"/></svg>
                  Switch to Teacher View
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
          <div class="dashboard-welcome">
            <h1>Your Subjects</h1>
            <p>Complete the pedagogy evaluation surveys for your courses</p>
          </div>

          ${renderSection('Compulsory', compulsory, 'compulsory', '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>')}
          ${renderSection('Optional (Previous Semesters)', optional, 'optional', '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>')}
          ${renderSection('Labs', labs.filter(l => l.surveyStatus !== 'completed'), 'optional', '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2"><path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55A1 1 0 0 0 5.61 22h12.78a1 1 0 0 0 .89-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><line x1="8.5" y1="2" x2="15.5" y2="2"/></svg>')}
          ${renderSection('Completed', [...completed, ...labs.filter(l => l.surveyStatus === 'completed')], 'completed', '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>')}
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

  // Switch view for dev
  document.getElementById('switch-view-btn')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'teacher-dashboard', forceRole: 'teacher' } }));
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
      <span style="display:inline-flex; align-items:center;">${icon}</span>
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
    ? '<span class="badge badge-completed" style="display:inline-flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> Completed</span>'
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
