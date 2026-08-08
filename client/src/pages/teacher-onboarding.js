/**
 * Teacher Onboarding Page
 * Step 1: Teacher Dispositional Profile (Years teaching, Level, Mode, Confidence, Interest, Tech Comfort)
 * Step 2: Course Selection (Select courses handled across semesters)
 */

import { api } from '../services/api.js';
import { showToast } from '../components/toast.js';

let currentStep = 1; // 1: Profile, 2: Course Selection
let teacherProfileData = {};
let availableCoursesGrouped = {};
let selectedSubjectIds = new Set();

export async function renderTeacherOnboardingPage(container, user) {
  currentStep = 1;
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
      <p>Loading teacher onboarding...</p>
    </div>
  `;

  try {
    const data = await api.getTeacherCourses();
    availableCoursesGrouped = data.courses || {};
    renderStep(container, user);
  } catch (err) {
    container.innerHTML = `
      <div class="loading-page">
        <p style="color: var(--color-error);">Failed to load course list: ${err.message}</p>
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

function renderProfileStep(container, user) {
  container.innerHTML = `
    <div class="onboarding-page page-enter">
      <div class="glass-card onboarding-card" style="max-width: 650px; width: 100%;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom: 20px;">
          <img src="/logo.png" style="width:36px; height:36px;" alt="Logo" />
          <div>
            <h2 style="margin:0; font-size:20px; font-weight:700; color:var(--color-text-main);">Teacher Profile</h2>
            <div style="font-size:13px; color:var(--color-text-muted);">Welcome ${user?.displayName || 'Professor'}! Please set up your profile.</div>
          </div>
        </div>

        <form id="teacher-profile-form" class="teacher-form">
          <div class="form-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
            <div class="form-group">
              <label class="form-label">Years of Teaching Experience</label>
              <input type="number" name="yearsTeaching" min="0" max="50" value="${teacherProfileData.yearsTeaching}" class="form-input" required />
            </div>

            <div class="form-group">
              <label class="form-label">Teaching Level</label>
              <select name="level" class="form-input" required>
                <option value="UG" ${teacherProfileData.level === 'UG' ? 'selected' : ''}>Undergraduate (UG)</option>
                <option value="PG" ${teacherProfileData.level === 'PG' ? 'selected' : ''}>Postgraduate (PG)</option>
                <option value="both" ${teacherProfileData.level === 'both' ? 'selected' : ''}>Both UG & PG</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Primary Teaching Mode</label>
              <select name="mode" class="form-input" required>
                <option value="theory" ${teacherProfileData.mode === 'theory' ? 'selected' : ''}>Theory</option>
                <option value="lab" ${teacherProfileData.mode === 'lab' ? 'selected' : ''}>Lab / Practical</option>
                <option value="both" ${teacherProfileData.mode === 'both' ? 'selected' : ''}>Both Theory & Lab</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Average Class Size</label>
              <input type="number" name="avgClassSize" min="5" max="300" value="${teacherProfileData.avgClassSize}" class="form-input" required />
            </div>
          </div>

          <hr style="border:0; border-top:1px solid var(--color-border); margin:20px 0;" />

          <div style="margin-bottom:16px;">
            <label class="form-label">Self-Assessed Capability in Active/Interactive Pedagogies (1-5)</label>
            <div class="rating-options" data-field="capabilityConfidence">
              ${[1,2,3,4,5].map(v => `
                <button type="button" class="rating-chip ${teacherProfileData.capabilityConfidence === v ? 'active' : ''}" data-val="${v}">${v}</button>
              `).join('')}
            </div>
          </div>

          <div style="margin-bottom:16px;">
            <label class="form-label">Interest in Trying New Teaching Methods (1-5)</label>
            <div class="rating-options" data-field="interestNewMethods">
              ${[1,2,3,4,5].map(v => `
                <button type="button" class="rating-chip ${teacherProfileData.interestNewMethods === v ? 'active' : ''}" data-val="${v}">${v}</button>
              `).join('')}
            </div>
          </div>

          <div style="margin-bottom:24px;">
            <label class="form-label">EdTech & Digital Tool Comfort (1-5)</label>
            <div class="rating-options" data-field="edtechComfort">
              ${[1,2,3,4,5].map(v => `
                <button type="button" class="rating-chip ${teacherProfileData.edtechComfort === v ? 'active' : ''}" data-val="${v}">${v}</button>
              `).join('')}
            </div>
          </div>

          <button type="submit" class="btn btn-primary" style="width:100%;">Next: Select Courses →</button>
        </form>
      </div>
    </div>
  `;

  // Attach rating chip handlers
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
      <div class="glass-card onboarding-card" style="max-width: 800px; width: 100%;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div>
            <h2 style="margin:0; font-size:20px; font-weight:700; color:var(--color-text-main);">Select Your Courses</h2>
            <div style="font-size:13px; color:var(--color-text-muted);">Choose all theory & lab courses you are currently handling across semesters</div>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" id="back-to-step1">← Back</button>
        </div>

        <div class="courses-selector-container" style="max-height: 450px; overflow-y: auto; padding-right: 8px; margin-bottom: 24px;">
          ${groupKeys.map(groupName => {
            const subjects = availableCoursesGrouped[groupName];
            return `
              <div class="course-group-block" style="margin-bottom: 20px;">
                <div style="font-size:14px; font-weight:700; color:var(--color-accent); margin-bottom:10px; border-bottom:1px solid var(--color-border); padding-bottom:4px;">
                  ${groupName}
                </div>
                <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap:12px;">
                  ${subjects.map(s => {
                    const isChecked = selectedSubjectIds.has(s.id);
                    const facultyText = Array.isArray(s.faculty) && s.faculty.length > 0 ? s.faculty.join(', ') : 'Faculty unassigned';
                    return `
                      <label class="course-checkbox-card ${isChecked ? 'selected' : ''}" data-subject-id="${s.id}" style="
                        display:flex; align-items:flex-start; gap:12px; padding:12px; border-radius:10px;
                        border: 1px solid ${isChecked ? 'var(--color-accent)' : 'var(--color-border)'};
                        background: ${isChecked ? 'rgba(99, 102, 241, 0.08)' : 'var(--color-card-bg)'};
                        cursor: pointer; transition: all 0.2s ease;
                      ">
                        <input type="checkbox" value="${s.id}" ${isChecked ? 'checked' : ''} style="margin-top:3px; cursor:pointer;" />
                        <div style="flex:1;">
                          <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:12px; font-weight:700; color:var(--color-accent);">${s.subjectCode}</span>
                            <span class="badge badge-pedagogy" style="font-size:10px;">${s.pedagogyId}</span>
                          </div>
                          <div style="font-size:14px; font-weight:600; color:var(--color-text-main); margin:4px 0;">${s.subjectName}</div>
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

        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="font-size:13px; color:var(--color-text-muted);">
            <strong id="selected-count">${selectedSubjectIds.size}</strong> course(s) selected
          </div>
          <button type="button" id="complete-onboarding-btn" class="btn btn-primary" ${selectedSubjectIds.size === 0 ? 'disabled' : ''}>
            Complete Setup & Go to Dashboard →
          </button>
        </div>
      </div>
    </div>
  `;

  // Back button
  container.querySelector('#back-to-step1').addEventListener('click', () => {
    currentStep = 1;
    renderStep(container, user);
  });

  // Checkbox handlers
  container.querySelectorAll('.course-checkbox-card').forEach(card => {
    const cb = card.querySelector('input[type="checkbox"]');
    card.addEventListener('click', (e) => {
      if (e.target !== cb) cb.checked = !cb.checked;
      const id = card.dataset.subjectId;
      if (cb.checked) {
        selectedSubjectIds.add(id);
        card.style.borderColor = 'var(--color-accent)';
        card.style.background = 'rgba(99, 102, 241, 0.08)';
      } else {
        selectedSubjectIds.delete(id);
        card.style.borderColor = 'var(--color-border)';
        card.style.background = 'var(--color-card-bg)';
      }
      container.querySelector('#selected-count').textContent = selectedSubjectIds.size;
      const submitBtn = container.querySelector('#complete-onboarding-btn');
      submitBtn.disabled = selectedSubjectIds.size === 0;
    });
  });

  // Complete onboarding
  container.querySelector('#complete-onboarding-btn').addEventListener('click', async () => {
    try {
      showToast('Saving profile...', 'info');
      // 1. Submit teacher onboarding profile
      await api.submitTeacherOnboarding(teacherProfileData);

      // 2. Submit selected courses
      await api.selectTeacherCourses(Array.from(selectedSubjectIds));

      showToast('Teacher onboarding complete!', 'success');
      window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'teacher-dashboard' } }));
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  });
}
