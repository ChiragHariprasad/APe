/**
 * Teacher Dashboard Page — Elevated Faculty Hub with Analytics, Search/Filter, Stage Pipelines & (i) Explainers
 */

import { api } from '../services/api.js';
import { showToast } from '../components/toast.js';
import { createInfoButton } from '../components/explainer-modal.js';

let searchQuery = '';
let statusFilter = 'ALL';

export async function renderTeacherDashboardPage(container, user) {
  searchQuery = '';
  statusFilter = 'ALL';

  container.innerHTML = `
    <div class="loading-page">
      <div class="spinner"></div>
      <p>Loading faculty portal dashboard...</p>
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

  // Calculate Stat Metrics
  const totalCourses = courses.length;
  const completedCount = courses.filter(c => c.status === 'completed').length;
  const inProgressCount = courses.filter(c => c.status !== 'not_started' && c.status !== 'completed').length;
  const mismatchCount = courses.filter(c => c.mismatchScenario).length;

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
                <div class="header-user-meta">${teacher?.yearsTeaching || 0} Yrs Exp · ${teacher?.level || 'UG'} Level</div>
              </div>
              ${user?.avatarUrl
                ? `<img src="${user.avatarUrl}" alt="" class="header-avatar" referrerpolicy="no-referrer" />`
                : `<div class="header-avatar" style="background: var(--color-accent); display:flex; align-items:center; justify-content:center; font-size:14px; color:white; font-weight:700;">${(user?.displayName || 'T')[0]}</div>`
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

      <!-- Main Content -->
      <main class="dashboard-content">
        <div class="container">
          
          <!-- Faculty Hero Profile Card -->
          <div class="teacher-hero-card">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
              <div>
                <h1 style="margin:0 0 6px 0; font-size:24px; font-weight:800; color:var(--color-text-primary);">
                  Welcome, Professor ${user?.displayName || ''}
                </h1>
                <p style="margin:0; color:var(--color-text-secondary); font-size:14px;">
                  Adaptive Pedagogy Evaluation & Mismatch Resolution Workspace
                </p>
              </div>
              <div style="display:flex; gap:10px;">
                <button class="btn btn-ghost btn-sm" id="manage-courses-btn" style="border:1px solid var(--color-border-accent); color:var(--color-text-accent); font-weight:700;">
                  + Manage Course List
                </button>
              </div>
            </div>
          </div>

          <!-- Quick Analytics Stats Grid -->
          <div class="teacher-stats-grid">
            <div class="teacher-stat-card">
              <div class="stat-icon">📚</div>
              <div>
                <div class="stat-value">${totalCourses}</div>
                <div class="stat-label">Total Assigned Courses</div>
              </div>
            </div>

            <div class="teacher-stat-card">
              <div class="stat-icon">⏳</div>
              <div>
                <div class="stat-value" style="color:var(--color-warning);">${inProgressCount}</div>
                <div class="stat-label">In-Progress Surveys</div>
              </div>
            </div>

            <div class="teacher-stat-card">
              <div class="stat-icon">✅</div>
              <div>
                <div class="stat-value" style="color:var(--color-success);">${completedCount}</div>
                <div class="stat-label">Completed Evaluations</div>
              </div>
            </div>

            <div class="teacher-stat-card">
              <div class="stat-icon">⚠️</div>
              <div>
                <div class="stat-value" style="color:var(--color-error);">${mismatchCount}</div>
                <div class="stat-label">Mismatches Flagged</div>
              </div>
            </div>
          </div>

          <!-- Search & Filter Controls -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
            <div style="display:flex; gap:12px; flex:1; min-width:280px;">
              <input type="text" id="dashboard-search" class="form-input" placeholder="🔍 Search course code or subject..." value="${searchQuery}" style="flex:1;" />
              <select id="status-filter-select" class="form-input" style="width:180px;">
                <option value="ALL" ${statusFilter === 'ALL' ? 'selected' : ''}>All Stages</option>
                <option value="not_started" ${statusFilter === 'not_started' ? 'selected' : ''}>Not Started</option>
                <option value="in_progress" ${statusFilter === 'in_progress' ? 'selected' : ''}>In Progress</option>
                <option value="completed" ${statusFilter === 'completed' ? 'selected' : ''}>Completed (T4)</option>
              </select>
            </div>
          </div>

          <!-- Course Cards Container -->
          <div id="course-cards-container">
            ${renderFilteredCourses(courses, pedagogyLabels)}
          </div>

        </div>
      </main>
    </div>
  `;

  // Attach search & filter handlers
  const searchInput = container.querySelector('#dashboard-search');
  const filterSelect = container.querySelector('#status-filter-select');

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    container.querySelector('#course-cards-container').innerHTML = renderFilteredCourses(courses, pedagogyLabels);
    attachCardListeners(container);
  });

  filterSelect.addEventListener('change', (e) => {
    statusFilter = e.target.value;
    container.querySelector('#course-cards-container').innerHTML = renderFilteredCourses(courses, pedagogyLabels);
    attachCardListeners(container);
  });

  attachCardListeners(container);

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

function renderFilteredCourses(courses, pedagogyLabels) {
  const filtered = courses.filter(c => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchCode = c.subjectCode.toLowerCase().includes(q);
      const matchName = c.subjectName.toLowerCase().includes(q);
      if (!matchCode && !matchName) return false;
    }

    if (statusFilter === 'completed' && c.status !== 'completed') return false;
    if (statusFilter === 'not_started' && c.status !== 'not_started') return false;
    if (statusFilter === 'in_progress' && (c.status === 'not_started' || c.status === 'completed')) return false;

    return true;
  });

  if (filtered.length === 0) {
    return `
      <div class="glass-card" style="padding:40px; text-align:center;">
        <p style="color:var(--color-text-muted); font-size:15px; margin-bottom:16px;">No courses match your search or filter criteria.</p>
        <button class="btn btn-primary" id="empty-add-courses-btn">Manage Courses</button>
      </div>
    `;
  }

  return `
    <div class="cards-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap:20px;">
      ${filtered.map(c => renderCourseCard(c, pedagogyLabels)).join('')}
    </div>
  `;
}

function renderCourseCard(course, pedagogyLabels) {
  const isCompleted = course.status === 'completed';
  const pedagogyName = pedagogyLabels[course.pedagogyId] || course.pedagogyName || course.pedagogyId;

  // Compute stage pipeline progress
  let activeStageIndex = 0; // 0: T1, 1: T2, 2: AI Interview, 3: T3, 4: T4
  let actionText = 'Start Stage T1 Profile →';
  let badgeColor = 'var(--color-text-muted)';
  let statusLabel = 'Not Started';

  switch (course.status) {
    case 't1_in_progress':
      activeStageIndex = 0;
      actionText = 'Resume Stage T1 →';
      statusLabel = 'Stage T1 Profile';
      badgeColor = 'var(--color-accent)';
      break;
    case 't2_in_progress':
      activeStageIndex = 1;
      actionText = 'Resume Stage T2 →';
      statusLabel = 'Stage T2 Course';
      badgeColor = 'var(--color-accent)';
      break;
    case 'interview_in_progress':
      activeStageIndex = 2;
      actionText = 'Continue Adaptive Interview →';
      statusLabel = 'AI Interview Chat';
      badgeColor = '#a855f7';
      break;
    case 't3_in_progress':
      activeStageIndex = 3;
      actionText = 'Continue Stage T3 Probes →';
      statusLabel = 'Stage T3 Mismatches';
      badgeColor = '#ef4444';
      break;
    case 'completed':
      activeStageIndex = 4;
      actionText = 'View Evaluation & T4 Report →';
      statusLabel = 'Completed (T4)';
      badgeColor = 'var(--color-success)';
      break;
  }

  return `
    <div class="glass-card subject-card teacher-course-card ${isCompleted ? 'completed' : ''}"
         data-tc-id="${course.id}" style="display:flex; flex-direction:column; justify-space-between; padding:20px; border-radius:16px; border:1px solid var(--color-border); transition:all 0.2s ease;">
      
      <div>
        <!-- Top Bar -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-size:14px; font-weight:800; color:var(--color-accent);">${course.subjectCode}</span>
          <span class="badge" style="background:${badgeColor}22; color:${badgeColor}; font-weight:700; border:1px solid ${badgeColor}44;">${statusLabel}</span>
        </div>

        <!-- Subject Name -->
        <div style="font-size:16px; font-weight:700; color:var(--color-text-primary); margin-bottom:12px; line-height:1.3;">
          ${course.subjectName}
        </div>

        <!-- Tags -->
        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:16px;">
          <span class="badge badge-pedagogy" style="font-size:11px;">
            ${course.pedagogyId}
          </span>
          ${course.semesterNumber ? `<span class="badge badge-semester">Sem ${course.semesterNumber}</span>` : ''}
          ${course.isLab ? '<span class="badge badge-optional">Lab</span>' : ''}
          ${course.mismatchScenario ? `<span class="badge" style="background:rgba(239, 68, 68, 0.15); color:#f87171;">Scenario ${course.mismatchScenario} Flagged</span>` : ''}
        </div>

        <!-- Stage Pipeline Stepper Visual -->
        <div style="margin-bottom:16px; background:var(--color-bg-secondary); padding:8px 12px; border-radius:10px; border:1px solid var(--color-border);">
          <div style="font-size:11px; font-weight:700; color:var(--color-text-muted); margin-bottom:6px;">EVALUATION PIPELINE</div>
          <div style="display:flex; justify-content:space-between; gap:4px;">
            ${['T1', 'T2', 'AI', 'T3', 'T4'].map((stage, idx) => {
              const isDone = idx < activeStageIndex || isCompleted;
              const isCurrent = idx === activeStageIndex && !isCompleted;
              const bg = isDone ? 'var(--color-success)' : isCurrent ? 'var(--color-accent)' : 'var(--color-border)';
              const textColor = (isDone || isCurrent) ? '#ffffff' : 'var(--color-text-muted)';
              return `
                <div style="flex:1; text-align:center; padding:4px 0; border-radius:4px; background:${bg}; color:${textColor}; font-size:10px; font-weight:700;">
                  ${stage}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Action Button -->
      <div style="margin-top:auto; border-top:1px solid var(--color-border); padding-top:14px; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:12px; color:var(--color-text-muted); font-weight:600;">${isCompleted ? '✓ Evaluation Complete' : 'In Progress'}</span>
        <button class="btn btn-primary btn-sm teacher-action-btn" style="font-weight:700; border-radius:8px;">
          ${actionText}
        </button>
      </div>

    </div>
  `;
}

function attachCardListeners(container) {
  container.querySelectorAll('.teacher-course-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const tcId = card.dataset.tcId;
      const isEval = card.querySelector('.completed') || card.innerHTML.includes('T4 Report');
      if (tcId) {
        if (isEval && e.target.closest('.teacher-action-btn')) {
          window.dispatchEvent(new CustomEvent('navigate', {
            detail: { page: 'teacher-evaluation', teacherCourseId: tcId }
          }));
        } else {
          window.dispatchEvent(new CustomEvent('navigate', {
            detail: { page: 'teacher-survey', teacherCourseId: tcId }
          }));
        }
      }
    });
  });
}
