/**
 * Teacher Onboarding Page — Enhanced UI/UX with Info Explainers & Step Progress Stepper
 * Step 1: Teacher Dispositional Profile (Years teaching, Level, Mode, Capability, Interest, Tech Comfort)
 * Step 2: Course Selection (Select courses handled across semesters with search & tab filters)
 */

import { api } from '../services/api.js';
import { showToast } from '../components/toast.js';
import { createInfoButton } from '../components/explainer-modal.js';

let currentStep = 1; // 1: Profile, 2: Course Selection
let teacherProfileData = {};
let availableCoursesGrouped = {};
let selectedSubjectIds = new Set();
let searchQuery = '';
let activeTabFilter = 'ALL';

export async function renderTeacherOnboardingPage(container, user) {
  currentStep = 1;
  searchQuery = '';
  activeTabFilter = 'ALL';
  teacherProfileData = {
    yearsTeaching: 5,
    level: 'UG',
    mode: 'theory',
    avgClassSize: 60,
    capabilityConfidence: 4,
    interestNewMethods: 4,
    edtechComfort: 4,
  };
  selectedSubjectIds.clear();

  container.innerHTML = `
    <div class="loading-page">
      <div class="spinner"></div>
      <p>Loading faculty setup portal...</p>
    </div>
  `;

  try {
    const data = await api.getTeacherCourses();
    availableCoursesGrouped = data.courses || {};
    renderStep(container, user);
  } catch (err) {
    container.innerHTML = `
      <div class="loading-page">
        <p style="color: var(--color-error);">Failed to load course catalog: ${err.message}</p>
        <button class="btn btn-primary" onclick="location.reload()">Retry</button>
      </div>
    `;
  }
}

function renderStep(container, user) {
  if (currentStep === 1) {
    renderProfileStep(container, user);
  } else {
    renderCourseSelectionStep(container, user);
  }
}

function renderStepperHeader(activeStepNum) {
  return `
    <div class="stage-stepper-bar" style="margin-bottom:24px;">
      <div class="stage-step ${activeStepNum === 1 ? 'active' : 'completed'}">
        <span class="stage-step-num">${activeStepNum > 1 ? '✓' : '1'}</span>
        <span>Step 1: Faculty Profile</span>
      </div>
      <div style="color:var(--color-text-muted); font-size:12px;">➔</div>
      <div class="stage-step ${activeStepNum === 2 ? 'active' : ''}">
        <span class="stage-step-num">2</span>
        <span>Step 2: Select Courses</span>
      </div>
    </div>
  `;
}

function renderProfileStep(container, user) {
  container.innerHTML = `
    <div class="onboarding-page page-enter">
      <div class="glass-card onboarding-card" style="max-width: 720px; width: 100%; padding:32px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <img src="/logo.png" style="width:40px; height:40px;" alt="Logo" />
            <div>
              <h2 style="margin:0; font-size:22px; font-weight:800; color:var(--color-text-primary);">Faculty Onboarding Profile</h2>
              <div style="font-size:13px; color:var(--color-text-muted);">Welcome Professor ${user?.displayName || ''}! Let's set up your teaching baseline.</div>
            </div>
          </div>
          <span class="badge" style="background:var(--color-accent-glow); color:var(--color-text-accent); padding:4px 10px; font-weight:700;">Stage T1 Setup</span>
        </div>

        ${renderStepperHeader(1)}

        <form id="teacher-profile-form" class="teacher-form">
          <div class="form-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:20px;">
            <div class="form-group">
              <label class="form-label" id="lbl-exp">Years of Teaching Experience</label>
              <input type="number" name="yearsTeaching" min="0" max="50" value="${teacherProfileData.yearsTeaching}" class="form-input" required />
            </div>

            <div class="form-group">
              <label class="form-label" id="lbl-level">Teaching Level</label>
              <select name="level" class="form-input" required>
                <option value="UG" ${teacherProfileData.level === 'UG' ? 'selected' : ''}>Undergraduate (UG)</option>
                <option value="PG" ${teacherProfileData.level === 'PG' ? 'selected' : ''}>Postgraduate (PG)</option>
                <option value="both" ${teacherProfileData.level === 'both' ? 'selected' : ''}>Both UG & PG</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" id="lbl-mode">Primary Teaching Mode</label>
              <select name="mode" class="form-input" required>
                <option value="theory" ${teacherProfileData.mode === 'theory' ? 'selected' : ''}>Theory Lectures</option>
                <option value="lab" ${teacherProfileData.mode === 'lab' ? 'selected' : ''}>Lab / Practical Sessions</option>
                <option value="both" ${teacherProfileData.mode === 'both' ? 'selected' : ''}>Both Theory & Lab</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" id="lbl-size">Average Class Size</label>
              <input type="number" name="avgClassSize" min="5" max="300" value="${teacherProfileData.avgClassSize}" class="form-input" required />
            </div>
          </div>

          <hr style="border:0; border-top:1px solid var(--color-border); margin:24px 0;" />

          <div style="margin-bottom:20px;">
            <label class="form-label" id="lbl-capability">Self-Assessed Capability in Interactive Pedagogies (1-5)</label>
            <div class="rating-options" data-field="capabilityConfidence">
              ${[1,2,3,4,5].map(v => `
                <button type="button" class="rating-chip ${teacherProfileData.capabilityConfidence === v ? 'active' : ''}" data-val="${v}">
                  ${v} ${v===1?'(Basic)':v===3?'(Moderate)':v===5?'(Expert)':''}
                </button>
              `).join('')}
            </div>
          </div>

          <div style="margin-bottom:20px;">
            <label class="form-label" id="lbl-interest">Interest in Trying New Teaching Methods (1-5)</label>
            <div class="rating-options" data-field="interestNewMethods">
              ${[1,2,3,4,5].map(v => `
                <button type="button" class="rating-chip ${teacherProfileData.interestNewMethods === v ? 'active' : ''}" data-val="${v}">
                  ${v} ${v===1?'(Low)':v===3?'(Open)':v===5?'(Eager)':''}
                </button>
              `).join('')}
            </div>
          </div>

          <div style="margin-bottom:28px;">
            <label class="form-label" id="lbl-tech">EdTech & Digital Tool Comfort (1-5)</label>
            <div class="rating-options" data-field="edtechComfort">
              ${[1,2,3,4,5].map(v => `
                <button type="button" class="rating-chip ${teacherProfileData.edtechComfort === v ? 'active' : ''}" data-val="${v}">
                  ${v} ${v===1?'(Novice)':v===3?'(Comfortable)':v===5?'(Advanced)':''}
                </button>
              `).join('')}
            </div>
          </div>

          <button type="submit" class="btn btn-primary" style="width:100%; min-height:48px; font-weight:700;">Next: Select Courses →</button>
        </form>
      </div>
    </div>
  `;

  // Attach info buttons (i)
  const attachInfo = (id, key, title, text) => {
    const el = container.querySelector(`#${id}`);
    if (el) el.appendChild(createInfoButton(key, title, text));
  };

  attachInfo('lbl-exp', 't1', 'Teaching Experience', 'Total number of years spent teaching in higher education.');
  attachInfo('lbl-level', 't1', 'Teaching Level', 'Target student audience level (Undergraduate or Postgraduate).');
  attachInfo('lbl-mode', 't1', 'Teaching Mode', 'Primary classroom delivery format (Theory or Laboratory).');
  attachInfo('lbl-size', 'constraints', 'Class Size', 'Average number of students enrolled per section.');
  attachInfo('lbl-capability', 'capability_confidence', 'Capability Confidence', 'Self-assessed confidence in designing and running interactive activities.');
  attachInfo('lbl-interest', 'willingness_change', 'Interest in New Methods', 'Openness to adopting innovative teaching strategies.');
  attachInfo('lbl-tech', 't1', 'EdTech Comfort', 'Familiarity with LMS, online polling, and digital educational tools.');

  // Rating chip handlers
  container.querySelectorAll('.rating-options').forEach(group => {
    const field = group.dataset.field;
    group.querySelectorAll('.rating-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.rating-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        teacherProfileData[field] = parseInt(btn.dataset.val, 10);
      });
    });
  });

  // Form submit
  container.querySelector('#teacher-profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    teacherProfileData.yearsTeaching = parseInt(fd.get('yearsTeaching'), 10);
    teacherProfileData.level = fd.get('level');
    teacherProfileData.mode = fd.get('mode');
    teacherProfileData.avgClassSize = parseInt(fd.get('avgClassSize'), 10);

    currentStep = 2;
    renderStep(container, user);
  });
}

function renderCourseSelectionStep(container, user) {
  const groupKeys = Object.keys(availableCoursesGrouped);

  container.innerHTML = `
    <div class="onboarding-page page-enter">
      <div class="glass-card onboarding-card" style="max-width: 880px; width: 100%; padding:32px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="margin:0; font-size:22px; font-weight:800; color:var(--color-text-primary);">Select Your Courses</h2>
            <div style="font-size:13px; color:var(--color-text-muted);">Choose the courses you handle across theory and laboratory subjects</div>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" id="back-to-step1">← Back to Profile</button>
        </div>

        ${renderStepperHeader(2)}

        <!-- Search & Filter Bar -->
        <div style="display:flex; gap:12px; margin-bottom:20px; flex-wrap:wrap;">
          <input type="text" id="course-search-input" class="form-input" placeholder="🔍 Search course code or name..." value="${searchQuery}" style="flex:1; min-width:240px;" />
          <button type="button" class="btn btn-ghost btn-sm" id="select-all-btn" style="border:1px solid var(--color-border-accent); color:var(--color-text-accent);">Select All Visible</button>
        </div>

        <div class="courses-selector-container" style="max-height: 480px; overflow-y: auto; padding-right: 8px; margin-bottom: 24px;">
          ${groupKeys.map(groupName => {
            const subjects = availableCoursesGrouped[groupName].filter(s => {
              if (!searchQuery) return true;
              const q = searchQuery.toLowerCase();
              return s.subjectCode.toLowerCase().includes(q) || s.subjectName.toLowerCase().includes(q);
            });

            if (subjects.length === 0) return '';

            return `
              <div class="course-group-block" style="margin-bottom: 24px;">
                <div style="font-size:14px; font-weight:700; color:var(--color-accent); margin-bottom:12px; border-bottom:1px solid var(--color-border); padding-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
                  <span>${groupName}</span>
                  <span style="font-size:11px; color:var(--color-text-muted);">${subjects.length} subjects available</span>
                </div>
                <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap:14px;">
                  ${subjects.map(s => {
                    const isChecked = selectedSubjectIds.has(s.id);
                    const facultyText = Array.isArray(s.faculty) && s.faculty.length > 0 ? s.faculty.join(', ') : 'Faculty unassigned';
                    return `
                      <label class="course-checkbox-card ${isChecked ? 'selected' : ''}" data-subject-id="${s.id}" style="
                        display:flex; align-items:flex-start; gap:14px; padding:14px; border-radius:12px;
                        border: 1px solid ${isChecked ? 'var(--color-accent)' : 'var(--color-border)'};
                        background: ${isChecked ? 'var(--color-accent-glow)' : 'var(--color-bg-card)'};
                        cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                        box-shadow: ${isChecked ? '0 4px 14px var(--color-accent-glow)' : 'none'};
                      ">
                        <input type="checkbox" value="${s.id}" ${isChecked ? 'checked' : ''} style="margin-top:4px; cursor:pointer; width:18px; height:18px; accent-color:var(--color-accent);" />
                        <div style="flex:1;">
                          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                            <span style="font-size:12px; font-weight:800; color:var(--color-accent);">${s.subjectCode}</span>
                            <span class="badge badge-pedagogy" style="font-size:10px;">${s.pedagogyId}</span>
                          </div>
                          <div style="font-size:14px; font-weight:700; color:var(--color-text-primary); margin-bottom:4px; line-height:1.3;">${s.subjectName}</div>
                          <div style="font-size:11px; color:var(--color-text-muted);">${facultyText}</div>
                        </div>
                      </label>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-top:1px solid var(--color-border); padding-top:20px;">
          <div style="font-size:14px; color:var(--color-text-secondary);">
            Selected: <strong id="selected-count" style="color:var(--color-accent); font-size:16px;">${selectedSubjectIds.size}</strong> course(s)
          </div>
          <button type="button" id="complete-onboarding-btn" class="btn btn-primary" style="min-height:48px; padding:0 28px; font-weight:700;" ${selectedSubjectIds.size === 0 ? 'disabled' : ''}>
            Complete Setup & Go to Dashboard →
          </button>
        </div>
      </div>
    </div>
  `;

  // Search input handler
  const searchInput = container.querySelector('#course-search-input');
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderCourseSelectionStep(container, user);
  });

  // Select all visible
  container.querySelector('#select-all-btn').addEventListener('click', () => {
    container.querySelectorAll('.course-checkbox-card input[type="checkbox"]').forEach(cb => {
      cb.checked = true;
      selectedSubjectIds.add(cb.value);
    });
    renderCourseSelectionStep(container, user);
  });

  // Back button
  container.querySelector('#back-to-step1').addEventListener('click', () => {
    currentStep = 1;
    renderStep(container, user);
  });

  // Checkbox card click handlers
  container.querySelectorAll('.course-checkbox-card').forEach(card => {
    const cb = card.querySelector('input[type="checkbox"]');
    card.addEventListener('click', (e) => {
      if (e.target !== cb) cb.checked = !cb.checked;
      const id = card.dataset.subjectId;
      if (cb.checked) {
        selectedSubjectIds.add(id);
      } else {
        selectedSubjectIds.delete(id);
      }
      container.querySelector('#selected-count').textContent = selectedSubjectIds.size;
      const submitBtn = container.querySelector('#complete-onboarding-btn');
      submitBtn.disabled = selectedSubjectIds.size === 0;
    });
  });

  // Complete onboarding
  container.querySelector('#complete-onboarding-btn').addEventListener('click', async () => {
    try {
      showToast('Saving profile & setup...', 'info');
      await api.submitTeacherOnboarding(teacherProfileData);
      await api.selectTeacherCourses(Array.from(selectedSubjectIds));

      showToast('Teacher onboarding complete!', 'success');
      window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'teacher-dashboard' } }));
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  });
}
