/**
 * Teacher Survey Page — 4-Stage Adaptive Questionnaire & Interview UI
 * Stage T1: Teacher Pedagogy & Constraint Profile
 * Stage T2: Course Pedagogy Profile
 * Stage Adaptive Interview: AI Chat with Live Pedagogy Mix & Confidence Sidebar
 * Stage T3: Mismatch Probes (Scenario A/B/C/D)
 * Stage Summary: Completion view
 */

import { api } from '../services/api.js';
import { showToast } from '../components/toast.js';
import { createInfoButton } from '../components/explainer-modal.js';

const PEDAGOGY_OPTIONS = [
  { id: 'direct_instruction', label: 'Direct Instruction / Explicit Teaching' },
  { id: 'guided_instruction', label: 'Guided Instruction & Scaffolding' },
  { id: 'active_learning', label: 'Active Learning & Engagement' },
  { id: 'peer_instruction', label: 'Peer Instruction & Critique' },
  { id: 'collaborative_learning', label: 'Collaborative & Team Learning' },
  { id: 'problem_based_learning', label: 'Problem-Based Learning (PBL)' },
  { id: 'project_based_learning', label: 'Project-Based Learning (PjBL)' },
  { id: 'inquiry_learning', label: 'Inquiry & Investigation' },
  { id: 'flipped_classroom', label: 'Flipped Classroom' },
  { id: 'reflective_learning', label: 'Reflective & Metacognitive Learning' },
];

const CONSTRAINT_OPTIONS = [
  'Class size too large',
  'Fixed / rigid syllabus',
  'Lack of instructional time',
  'Low student readiness / prerequisites missing',
  'Physical classroom setup / fixed seating',
  'High assessment & grading pressure',
  'Lack of digital / lab infrastructure',
];

const WILLING_CHANGE_OPTIONS = [
  'Lecture style & delivery',
  'In-class activities & exercises',
  'Student participation structure',
  'Assessment & grading format',
  'EdTech & digital tools integration',
];

let teacherCourseId = null;
let currentStage = 'T1'; // 'T1' | 'T2' | 'INTERVIEW' | 'T3' | 'SUMMARY'

// Form State
let t1Data = {
  currentPedagogies: [],
  primaryPedagogy: '',
  primaryConfidence: 4,
  activeMethodComfort: 4,
  interestTrying: 4,
  willingnessChange: 4,
  willingChanges: [],
  constraintsVector: [],
  topConstraints: [],
};

let t2Data = {
  coursePedagogies: [],
  coursePrimary: '',
  perceivedEffectiveness: 4,
  pedagogySatisfaction: 4,
  courseFit: 4,
  courseBarriers: [],
  changeEnablers: [],
};

// Interview State
let interviewState = {
  rootPrompt: '',
  turns: [],
  pedagogyMix: [],
  coverage: {},
  isComplete: false,
  subjectName: '',
};

// T3 State
let mismatchState = {
  scenario: 'A',
  studentPES: null,
  teacherSatisfaction: 4,
  responses: {},
};

export async function renderTeacherSurveyPage(container, user, tcId) {
  teacherCourseId = tcId;
  currentStage = 'T1';

  container.innerHTML = `
    <div class="loading-page">
      <div class="spinner"></div>
      <p>Loading faculty evaluation suite...</p>
    </div>
  `;

  try {
    const state = await api.getInterviewState(teacherCourseId);
    interviewState.subjectName = state.subjectName;
    interviewState.rootPrompt = state.rootPrompt;
    interviewState.turns = state.turns || [];
    interviewState.pedagogyMix = state.pedagogyMix || [];

    if (state.status === 't2_in_progress') {
      currentStage = 'T2';
    } else if (state.status === 'interview_in_progress') {
      currentStage = 'INTERVIEW';
    } else if (state.status === 't3_in_progress') {
      currentStage = 'T3';
      await loadMismatchData();
    } else if (state.status === 'completed') {
      currentStage = 'SUMMARY';
    }

    renderCurrentStage(container, user);
  } catch (err) {
    container.innerHTML = `
      <div class="loading-page">
        <p style="color: var(--color-error);">Failed to start teacher survey: ${err.message}</p>
        <button class="btn btn-primary" onclick="window.dispatchEvent(new CustomEvent('navigate', {detail:{page:'teacher-dashboard'}}))">Back to Dashboard</button>
      </div>
    `;
  }
}

async function loadMismatchData() {
  try {
    const res = await api.getMismatchScenario(teacherCourseId);
    mismatchState.scenario = res.scenario;
    mismatchState.studentPES = res.studentPES;
    mismatchState.teacherSatisfaction = res.teacherSatisfaction;
  } catch (err) {
    console.error('Mismatch load error:', err);
  }
}

function renderStageHeader(title, stepNum) {
  const steps = [
    { num: 1, label: 'T1 Profile', stage: 'T1' },
    { num: 2, label: 'T2 Course', stage: 'T2' },
    { num: 3, label: 'AI Interview', stage: 'INTERVIEW' },
    { num: 4, label: 'T3 Probes', stage: 'T3' }
  ];

  return `
    <header class="survey-header">
      <div class="container container-survey">
        <div class="survey-header-inner" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <button class="btn btn-ghost" id="exit-survey-btn" style="min-height:40px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Save & Dashboard
          </button>
          
          <div style="text-align: center;">
            <div class="survey-subject" style="font-size:16px; font-weight:800; color:var(--color-text-primary);">${interviewState.subjectName}</div>
            <div class="survey-progress-text" style="font-size:12px; color:var(--color-text-muted);">Stage ${stepNum} of 4: ${title}</div>
          </div>

          <div style="display:flex; align-items:center; gap:4px;">
            <span class="badge" style="background:var(--color-accent-glow); color:var(--color-text-accent); font-weight:700;">Stage ${stepNum}/4</span>
          </div>
        </div>

        <!-- Interactive Stepper Pipeline -->
        <div class="stage-stepper-bar" style="margin-top:14px; margin-bottom:0; padding:6px 12px;">
          ${steps.map(s => {
            const isCurrent = s.num === stepNum;
            const isCompleted = s.num < stepNum;
            return `
              <div class="stage-step ${isCurrent ? 'active' : isCompleted ? 'completed' : ''}">
                <span class="stage-step-num">${isCompleted ? '✓' : s.num}</span>
                <span>${s.label}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </header>
  `;
}

function renderCurrentStage(container, user) {
  if (currentStage === 'T1') renderT1Stage(container, user);
  else if (currentStage === 'T2') renderT2Stage(container, user);
  else if (currentStage === 'INTERVIEW') renderInterviewStage(container, user);
  else if (currentStage === 'T3') renderT3Stage(container, user);
  else if (currentStage === 'SUMMARY') renderSummaryStage(container, user);
}

// ── T1: Teacher Profile Stage ───────────────────────────────

function renderT1Stage(container, user) {
  container.innerHTML = `
    <div class="survey-page page-enter">
      ${renderStageHeader('Teacher Dispositional Profile', 1)}

      <div class="survey-content">
        <div class="container container-survey" style="max-width:760px;">
          <div class="glass-card" style="padding:32px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:20px;">
              <div>
                <h2 style="margin:0; font-size:22px; font-weight:800; color:var(--color-text-primary);">Stage T1: Dispositional Pedagogy Profile</h2>
                <p style="color:var(--color-text-muted); font-size:13px; margin-top:4px;">Define your overarching teaching philosophy and classroom constraints</p>
              </div>
            </div>

            <form id="t1-form">
              <!-- T1.1 Current Pedagogies -->
              <div class="form-group" style="margin-bottom:24px;">
                <label class="form-label" id="lbl-t1-1">
                  T1.1 Which teaching approaches do you currently use overall? (Select all that apply)
                </label>
                <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:10px; margin-top:10px;">
                  ${PEDAGOGY_OPTIONS.map(p => `
                    <label class="checkbox-option-card" style="display:flex; align-items:center; justify-content:space-between; padding:12px; border:1px solid var(--color-border); border-radius:10px; cursor:pointer; background:var(--color-bg-card);">
                      <div style="display:flex; align-items:center; gap:8px;">
                        <input type="checkbox" name="currentPedagogies" value="${p.id}" ${t1Data.currentPedagogies.includes(p.id) ? 'checked' : ''} style="accent-color:var(--color-accent);" />
                        <span style="font-size:13px; font-weight:600; color:var(--color-text-primary);">${p.label}</span>
                      </div>
                    </label>
                  `).join('')}
                </div>
              </div>

              <!-- T1.2 Primary Pedagogy -->
              <div class="form-group" style="margin-bottom:24px;">
                <label class="form-label" id="lbl-t1-2">T1.2 Which is your PRIMARY teaching approach?</label>
                <select name="primaryPedagogy" class="form-input" style="min-height:48px;" required>
                  <option value="">-- Select Primary Teaching Approach --</option>
                  ${PEDAGOGY_OPTIONS.map(p => `
                    <option value="${p.id}" ${t1Data.primaryPedagogy === p.id ? 'selected' : ''}>${p.label}</option>
                  `).join('')}
                </select>
              </div>

              <!-- T1.3 Confidence -->
              <div class="form-group" style="margin-bottom:24px;">
                <label class="form-label" id="lbl-t1-3">T1.3 Confidence in delivering your primary approach (1-5)</label>
                <div class="rating-options" data-field="primaryConfidence">
                  ${[1,2,3,4,5].map(v => `
                    <button type="button" class="rating-chip ${t1Data.primaryConfidence === v ? 'active' : ''}" data-val="${v}">${v}</button>
                  `).join('')}
                </div>
              </div>

              <!-- T1.4 Active Comfort -->
              <div class="form-group" style="margin-bottom:24px;">
                <label class="form-label" id="lbl-t1-4">T1.4 Comfort level with active/interactive teaching methods (1-5)</label>
                <div class="rating-options" data-field="activeMethodComfort">
                  ${[1,2,3,4,5].map(v => `
                    <button type="button" class="rating-chip ${t1Data.activeMethodComfort === v ? 'active' : ''}" data-val="${v}">${v}</button>
                  `).join('')}
                </div>
              </div>

              <!-- T1.5 Interest Trying -->
              <div class="form-group" style="margin-bottom:24px;">
                <label class="form-label" id="lbl-t1-5">T1.5 Openness to experimenting with new pedagogical models (1-5)</label>
                <div class="rating-options" data-field="interestTrying">
                  ${[1,2,3,4,5].map(v => `
                    <button type="button" class="rating-chip ${t1Data.interestTrying === v ? 'active' : ''}" data-val="${v}">${v}</button>
                  `).join('')}
                </div>
              </div>

              <!-- T1.6 Willingness Change -->
              <div class="form-group" style="margin-bottom:24px;">
                <label class="form-label" id="lbl-t1-6">T1.6 Willingness to modify course design if student evidence suggests improvement (1-5)</label>
                <div class="rating-options" data-field="willingnessChange">
                  ${[1,2,3,4,5].map(v => `
                    <button type="button" class="rating-chip ${t1Data.willingnessChange === v ? 'active' : ''}" data-val="${v}">${v}</button>
                  `).join('')}
                </div>
              </div>

              <!-- T1.7 Willing Changes -->
              <div class="form-group" style="margin-bottom:24px;">
                <label class="form-label" id="lbl-t1-7">T1.7 Which aspects of your course are you open to changing?</label>
                <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:8px;">
                  ${WILLING_CHANGE_OPTIONS.map(wc => `
                    <label class="checkbox-tag" style="padding:8px 16px; border:1px solid var(--color-border); border-radius:20px; font-size:13px; font-weight:600; cursor:pointer; background:var(--color-bg-card);">
                      <input type="checkbox" name="willingChanges" value="${wc}" ${t1Data.willingChanges.includes(wc) ? 'checked' : ''} style="margin-right:6px; accent-color:var(--color-accent);" />
                      ${wc}
                    </label>
                  `).join('')}
                </div>
              </div>

              <!-- T1.8 Constraints -->
              <div class="form-group" style="margin-bottom:28px;">
                <label class="form-label" id="lbl-t1-8">T1.8 Key constraints impacting your teaching flexibility (Select all that apply)</label>
                <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:10px; margin-top:10px;">
                  ${CONSTRAINT_OPTIONS.map(c => `
                    <label class="checkbox-option-card" style="padding:10px 14px; border:1px solid var(--color-border); border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; background:var(--color-bg-card);">
                      <input type="checkbox" name="constraintsVector" value="${c}" ${t1Data.constraintsVector.includes(c) ? 'checked' : ''} style="margin-right:8px; accent-color:var(--color-accent);" />
                      ${c}
                    </label>
                  `).join('')}
                </div>
              </div>

              <button type="submit" class="btn btn-primary" style="width:100%; min-height:48px; font-weight:700;">Save Profile & Continue to Stage T2 →</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach info buttons (i)
  const attachInfo = (id, key, title, text) => {
    const el = container.querySelector(`#${id}`);
    if (el) el.appendChild(createInfoButton(key, title, text));
  };

  attachInfo('lbl-t1-1', 't1', 'Current Teaching Approaches', 'Broad set of strategies you employ across courses.');
  attachInfo('lbl-t1-2', 't1', 'Primary Teaching Approach', 'The dominant methodology used in most of your classes.');
  attachInfo('lbl-t1-3', 'capability_confidence', 'Primary Approach Confidence', 'How confident you feel facilitating your main approach.');
  attachInfo('lbl-t1-4', 'active_learning', 'Active Teaching Comfort', 'Comfort level running interactive exercises.');
  attachInfo('lbl-t1-5', 'willingness_change', 'Openness to New Models', 'Eagerness to experiment with innovative teaching frameworks.');
  attachInfo('lbl-t1-6', 'willingness_change', 'Willingness to Modify Design', 'Flexibility to update course structures based on feedback.');
  attachInfo('lbl-t1-7', 't1', 'Open Aspects of Change', 'Course components you are willing to adapt.');
  attachInfo('lbl-t1-8', 'constraints', 'Instructional Constraints', 'Institutional and environmental barriers affecting delivery.');

  attachExitButton(container);
  attachRatingChips(container, t1Data);

  container.querySelector('#t1-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    t1Data.currentPedagogies = Array.from(fd.getAll('currentPedagogies'));
    t1Data.primaryPedagogy = fd.get('primaryPedagogy');
    t1Data.willingChanges = Array.from(fd.getAll('willingChanges'));
    t1Data.constraintsVector = Array.from(fd.getAll('constraintsVector'));

    if (!t1Data.primaryPedagogy) {
      showToast('Please select a primary pedagogy', 'error');
      return;
    }

    try {
      showToast('Saving T1 profile...', 'info');
      await api.saveTeacherT1(teacherCourseId, t1Data);
      currentStage = 'T2';
      renderCurrentStage(container, user);
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  });
}

// ── T2: Course Profile Stage ────────────────────────────────

function renderT2Stage(container, user) {
  container.innerHTML = `
    <div class="survey-page page-enter">
      ${renderStageHeader('Course Pedagogy Profile', 2)}

      <div class="survey-content">
        <div class="container container-survey" style="max-width:760px;">
          <div class="glass-card" style="padding:32px;">
            <div style="margin-bottom:20px;">
              <h2 style="margin:0; font-size:22px; font-weight:800; color:var(--color-text-primary);">Stage T2: Course-Specific Evaluation</h2>
              <p style="color:var(--color-text-muted); font-size:13px; margin-top:4px;">Evaluate your current teaching implementation specifically for <strong>${interviewState.subjectName}</strong></p>
            </div>

            <form id="t2-form">
              <!-- T2.1 Course Pedagogies -->
              <div class="form-group" style="margin-bottom:24px;">
                <label class="form-label" id="lbl-t2-1">T2.1 Pedagogies deployed in THIS course</label>
                <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:10px; margin-top:10px;">
                  ${PEDAGOGY_OPTIONS.map(p => `
                    <label class="checkbox-option-card" style="display:flex; align-items:center; gap:10px; padding:12px; border:1px solid var(--color-border); border-radius:10px; cursor:pointer; background:var(--color-bg-card);">
                      <input type="checkbox" name="coursePedagogies" value="${p.id}" ${t2Data.coursePedagogies.includes(p.id) ? 'checked' : ''} style="accent-color:var(--color-accent);" />
                      <span style="font-size:13px; font-weight:600; color:var(--color-text-primary);">${p.label}</span>
                    </label>
                  `).join('')}
                </div>
              </div>

              <!-- T2.2 Primary Course Pedagogy -->
              <div class="form-group" style="margin-bottom:24px;">
                <label class="form-label" id="lbl-t2-2">T2.2 Primary pedagogy for THIS course</label>
                <select name="coursePrimary" class="form-input" style="min-height:48px;" required>
                  <option value="">-- Select Primary Approach --</option>
                  ${PEDAGOGY_OPTIONS.map(p => `
                    <option value="${p.id}" ${t2Data.coursePrimary === p.id ? 'selected' : ''}>${p.label}</option>
                  `).join('')}
                </select>
              </div>

              <!-- T2.3 Perceived Effectiveness -->
              <div class="form-group" style="margin-bottom:24px;">
                <label class="form-label" id="lbl-t2-3">T2.3 Perceived effectiveness of current pedagogy in achieving learning outcomes (1-5)</label>
                <div class="rating-options" data-field="perceivedEffectiveness">
                  ${[1,2,3,4,5].map(v => `
                    <button type="button" class="rating-chip ${t2Data.perceivedEffectiveness === v ? 'active' : ''}" data-val="${v}">${v}</button>
                  `).join('')}
                </div>
              </div>

              <!-- T2.4 Teacher Satisfaction -->
              <div class="form-group" style="margin-bottom:24px;">
                <label class="form-label" id="lbl-t2-4">T2.4 Your satisfaction with student engagement & comprehension in this course (1-5)</label>
                <div class="rating-options" data-field="pedagogySatisfaction">
                  ${[1,2,3,4,5].map(v => `
                    <button type="button" class="rating-chip ${t2Data.pedagogySatisfaction === v ? 'active' : ''}" data-val="${v}">${v}</button>
                  `).join('')}
                </div>
              </div>

              <!-- T2.5 Course Fit -->
              <div class="form-group" style="margin-bottom:28px;">
                <label class="form-label" id="lbl-t2-5">T2.5 Alignment between teaching approach and course syllabus difficulty (1-5)</label>
                <div class="rating-options" data-field="courseFit">
                  ${[1,2,3,4,5].map(v => `
                    <button type="button" class="rating-chip ${t2Data.courseFit === v ? 'active' : ''}" data-val="${v}">${v}</button>
                  `).join('')}
                </div>
              </div>

              <button type="submit" class="btn btn-primary" style="width:100%; min-height:48px; font-weight:700;">Save & Proceed to Adaptive AI Interview →</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;

  const attachInfo = (id, key, title, text) => {
    const el = container.querySelector(`#${id}`);
    if (el) el.appendChild(createInfoButton(key, title, text));
  };

  attachInfo('lbl-t2-1', 't2', 'Course Deployed Pedagogies', 'Methods used specifically within this course syllabus.');
  attachInfo('lbl-t2-2', 't2', 'Primary Course Pedagogy', 'The main teaching model used in this subject.');
  attachInfo('lbl-t2-3', 't2', 'Perceived Effectiveness', 'How well current methods meet syllabus objectives.');
  attachInfo('lbl-t2-4', 't2', 'Teacher Satisfaction', 'Your contentment with student understanding and activity.');
  attachInfo('lbl-t2-5', 't2', 'Course Context Fit', 'How well the pedagogy matches course difficulty and prerequisites.');

  attachExitButton(container);
  attachRatingChips(container, t2Data);

  container.querySelector('#t2-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    t2Data.coursePedagogies = Array.from(fd.getAll('coursePedagogies'));
    t2Data.coursePrimary = fd.get('coursePrimary');

    if (!t2Data.coursePrimary) {
      showToast('Please select a primary course pedagogy', 'error');
      return;
    }

    try {
      showToast('Saving T2 evaluation...', 'info');
      await api.saveTeacherT2(teacherCourseId, t2Data);
      currentStage = 'INTERVIEW';
      renderCurrentStage(container, user);
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  });
}

// ── Adaptive Interview Stage ────────────────────────────────

function renderInterviewStage(container, user) {
  container.innerHTML = `
    <div class="survey-page page-enter">
      ${renderStageHeader('Adaptive Faculty Interview (AI)', 3)}

      <div class="survey-content">
        <div class="container container-survey" style="max-width:1040px;">
          
          <div style="display:grid; grid-template-columns: 320px 1fr; gap:20px;" class="interview-layout">
            
            <!-- Sidebar: Live Pedagogy Classification & Confidence Meter -->
            <div class="glass-card" style="padding:20px; display:flex; flex-direction:column; gap:16px; border-radius:16px;">
              <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--color-border); padding-bottom:12px;">
                <div style="font-size:14px; font-weight:800; color:var(--color-accent); display:flex; align-items:center;">
                  LIVE PEDAGOGY MIX
                </div>
                <span class="badge" style="background:var(--color-accent-glow); color:var(--color-text-accent); font-size:10px;">AI CLASSIFIER</span>
              </div>

              <div id="pedagogy-mix-widget" style="display:flex; flex-direction:column; gap:12px;">
                ${renderPedagogyMixWidget(interviewState.pedagogyMix)}
              </div>

              <div style="margin-top:auto; background:var(--color-bg-secondary); padding:12px; border-radius:10px; font-size:12px; color:var(--color-text-muted);">
                💡 <strong>Tip:</strong> Be specific about in-class exercises, quizzes, or group activities to help the AI accurately capture your teaching evidence.
              </div>
            </div>

            <!-- Main Chat Conversation Window -->
            <div class="chat-window">
              <div class="chat-header">
                <div style="display:flex; align-items:center; gap:10px;">
                  <div style="width:10px; height:10px; border-radius:50%; background:#10b981; box-shadow:0 0 8px #10b981;"></div>
                  <div>
                    <div style="font-size:14px; font-weight:700; color:var(--color-text-primary);">APE AI Interviewer</div>
                    <div style="font-size:11px; color:var(--color-text-muted);">Groq Adaptive Pedagogical Classifier</div>
                  </div>
                </div>
                <span class="badge badge-optional" style="font-size:10px;">Turn ${interviewState.turns.length + 1}</span>
              </div>

              <!-- Chat Messages Container -->
              <div class="chat-messages" id="chat-messages">
                <!-- Root Prompt -->
                <div class="chat-bubble chat-bubble-ai">
                  <div style="font-size:11px; font-weight:800; color:var(--color-accent); margin-bottom:4px;">APE INTERVIEWER</div>
                  <div>${interviewState.rootPrompt}</div>
                </div>

                <!-- Previous Turns -->
                ${interviewState.turns.map(t => `
                  <div class="chat-bubble chat-bubble-user">
                    <div>${t.answer}</div>
                  </div>
                  ${t.question ? `
                    <div class="chat-bubble chat-bubble-ai">
                      <div style="font-size:11px; font-weight:800; color:var(--color-accent); margin-bottom:4px;">APE INTERVIEWER</div>
                      <div>${t.question}</div>
                    </div>
                  ` : ''}
                `).join('')}

                ${interviewState.isComplete ? `
                  <div class="chat-bubble chat-bubble-ai" style="border-color:var(--color-success); background:rgba(16, 185, 129, 0.1);">
                    <div style="font-size:11px; font-weight:800; color:var(--color-success); margin-bottom:4px;">INTERVIEW COMPLETE ✓</div>
                    <div>Thank you! All required evidence has been gathered. You can now proceed to Stage T3 Mismatch Probes.</div>
                  </div>
                ` : ''}
              </div>

              <!-- Quick Suggestion Chips -->
              ${!interviewState.isComplete ? `
                <div style="padding:8px 16px; background:var(--color-bg-glass); border-top:1px solid var(--color-border);">
                  <div style="font-size:11px; font-weight:700; color:var(--color-text-muted); margin-bottom:4px;">QUICK SAMPLE RESPONSES:</div>
                  <div class="suggestion-chips">
                    <button type="button" class="suggestion-chip">"I deliver a 30-min slide lecture followed by a 15-min pair exercise."</button>
                    <button type="button" class="suggestion-chip">"Students work in 4-person groups on weekly problem sets."</button>
                    <button type="button" class="suggestion-chip">"I conduct bi-weekly quizzes and solve past exam questions on the board."</button>
                  </div>
                </div>
              ` : ''}

              <!-- Input Area -->
              <div style="padding:14px 16px; border-top:1px solid var(--color-border); background:var(--color-bg-glass); display:flex; gap:10px;">
                ${interviewState.isComplete ? `
                  <button type="button" id="next-to-t3-btn" class="btn btn-primary" style="width:100%; min-height:48px; font-weight:700;">Proceed to Stage T3 Mismatch Probes →</button>
                ` : `
                  <textarea id="interview-answer-input" class="form-input" placeholder="Type your narrative response here... (Press Enter to send)" rows="2" style="flex:1; resize:none; font-size:14px; padding:10px;"></textarea>
                  <button type="button" id="send-interview-btn" class="btn btn-primary" style="min-width:90px; height:auto; font-weight:700;">Send ➔</button>
                `}
              </div>

            </div>

          </div>

        </div>
      </div>
    </div>
  `;

  attachExitButton(container);

  // Responsive CSS layout fallback check
  const style = document.createElement('style');
  style.textContent = `
    @media (max-width: 840px) {
      .interview-layout {
        grid-template-columns: 1fr !important;
      }
    }
  `;
  container.appendChild(style);

  // Scroll chat to bottom
  const chatMessages = container.querySelector('#chat-messages');
  if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;

  // Handle Quick Suggestion Chip clicks
  container.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const input = container.querySelector('#interview-answer-input');
      if (input) {
        input.value = chip.textContent.replace(/^"|"$/g, '');
        input.focus();
      }
    });
  });

  // Handle Send Answer
  const sendBtn = container.querySelector('#send-interview-btn');
  const answerInput = container.querySelector('#interview-answer-input');

  const handleSend = async () => {
    const answer = answerInput?.value.trim();
    if (!answer) return;

    // Append local user bubble immediately
    const userBubble = document.createElement('div');
    userBubble.className = 'chat-bubble chat-bubble-user';
    userBubble.textContent = answer;
    chatMessages.appendChild(userBubble);
    answerInput.value = '';
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Show typing indicator
    const typingBubble = document.createElement('div');
    typingBubble.className = 'chat-bubble chat-bubble-ai typing';
    typingBubble.innerHTML = '<span class="spinner" style="width:14px; height:14px; display:inline-block; vertical-align:middle;"></span> Analyzing evidence...';
    chatMessages.appendChild(typingBubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
      const res = await api.submitInterviewTurn(teacherCourseId, answer);
      typingBubble.remove();

      interviewState.turns = res.turns || [];
      interviewState.pedagogyMix = res.pedagogyMix || [];
      interviewState.isComplete = res.status === 'completed' || res.status === 't3_in_progress';

      renderInterviewStage(container, user);
    } catch (err) {
      typingBubble.remove();
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  sendBtn?.addEventListener('click', handleSend);
  answerInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // Proceed to T3 button
  container.querySelector('#next-to-t3-btn')?.addEventListener('click', async () => {
    currentStage = 'T3';
    await loadMismatchData();
    renderCurrentStage(container, user);
  });
}

function renderPedagogyMixWidget(mix) {
  if (!mix || mix.length === 0) {
    return `<div style="font-size:13px; color:var(--color-text-muted); text-align:center; padding:12px;">No pedagogies classified yet. Share your teaching narrative in chat.</div>`;
  }

  return mix.map(m => {
    const weightPct = Math.round((m.weight || 0) * 100);
    const label = m.variant_label || m.core_label || m.core;
    return `
      <div style="background:var(--color-bg-secondary); padding:10px 12px; border-radius:10px; border:1px solid var(--color-border);">
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; font-weight:700; color:var(--color-text-primary); margin-bottom:4px;">
          <span>${label}</span>
          <span style="color:var(--color-accent);">${weightPct}%</span>
        </div>
        <div style="height:6px; background:var(--color-bg-glass); border-radius:3px; overflow:hidden;">
          <div style="height:100%; width:${weightPct}%; background:linear-gradient(90deg, var(--color-accent) 0%, var(--color-accent-light) 100%); transition:width 0.4s ease;"></div>
        </div>
      </div>
    `;
  }).join('');
}

// ── T3: Mismatch Probes Stage ───────────────────────────────

function renderT3Stage(container, user) {
  container.innerHTML = `
    <div class="survey-page page-enter">
      ${renderStageHeader('Stage T3: Mismatch Probes', 4)}

      <div class="survey-content">
        <div class="container container-survey" style="max-width:760px;">
          <div class="glass-card" style="padding:32px;">
            <div style="margin-bottom:20px;">
              <h2 style="margin:0; font-size:22px; font-weight:800; color:var(--color-text-primary);">Stage T3: Mismatch Diagnostics</h2>
              <p style="color:var(--color-text-muted); font-size:13px; margin-top:4px;">Resolving signal conflicts between student feedback and faculty self-report</p>
            </div>

            <!-- Mismatch Comparison Visual Card -->
            <div class="mismatch-comparison-card" style="background:var(--color-bg-secondary); padding:20px; border-radius:14px; border:1px solid var(--color-border); margin-bottom:24px; display:grid; grid-template-columns:1fr 1fr; gap:16px;">
              <div style="background:var(--color-bg-card); padding:14px; border-radius:10px; border:1px solid var(--color-border);">
                <div style="font-size:11px; font-weight:800; color:var(--color-accent); text-transform:uppercase;">STUDENT FEEDBACK INDEX (PES)</div>
                <div style="font-size:24px; font-weight:800; color:var(--color-text-primary); margin:6px 0;">
                  ${mismatchState.studentPES ? mismatchState.studentPES.toFixed(1) : '3.8'} / 5.0
                </div>
                <div style="font-size:12px; color:var(--color-text-muted);">Aggregated student perception score</div>
              </div>

              <div style="background:var(--color-bg-card); padding:14px; border-radius:10px; border:1px solid var(--color-border);">
                <div style="font-size:11px; font-weight:800; color:var(--color-text-accent); text-transform:uppercase;">TEACHER SATISFACTION</div>
                <div style="font-size:24px; font-weight:800; color:var(--color-text-primary); margin:6px 0;">
                  ${mismatchState.teacherSatisfaction || 4} / 5.0
                </div>
                <div style="font-size:12px; color:var(--color-text-muted);">Faculty self-assessment benchmark</div>
              </div>
            </div>

            <form id="t3-form">
              <div class="form-group" style="margin-bottom:24px;">
                <label class="form-label" id="lbl-t3-probe">T3.1 Pedagogical Mismatch Scenario Diagnostic</label>
                <div style="font-size:14px; color:var(--color-text-primary); background:var(--color-bg-input); padding:16px; border-radius:10px; border-left:4px solid var(--color-accent); margin-top:8px; line-height:1.5;">
                  ${getScenarioPromptText(mismatchState.scenario)}
                </div>
              </div>

              <div class="form-group" style="margin-bottom:24px;">
                <label class="form-label" id="lbl-t3-resp">T3.2 What is the primary underlying driver for this gap?</label>
                <div style="display:flex; flex-direction:column; gap:10px; margin-top:10px;">
                  <label class="checkbox-option-card" style="padding:12px; border:1px solid var(--color-border); border-radius:10px; cursor:pointer; background:var(--color-bg-card); display:flex; align-items:center; gap:10px;">
                    <input type="radio" name="mismatchDriver" value="readiness" checked style="accent-color:var(--color-accent);" />
                    <span style="font-size:13px; font-weight:600;">Student readiness gap or missing prerequisites</span>
                  </label>
                  <label class="checkbox-option-card" style="padding:12px; border:1px solid var(--color-border); border-radius:10px; cursor:pointer; background:var(--color-bg-card); display:flex; align-items:center; gap:10px;">
                    <input type="radio" name="mismatchDriver" value="pace" style="accent-color:var(--color-accent);" />
                    <span style="font-size:13px; font-weight:600;">Pacing vs syllabus coverage pressure</span>
                  </label>
                  <label class="checkbox-option-card" style="padding:12px; border:1px solid var(--color-border); border-radius:10px; cursor:pointer; background:var(--color-bg-card); display:flex; align-items:center; gap:10px;">
                    <input type="radio" name="mismatchDriver" value="format" style="accent-color:var(--color-accent);" />
                    <span style="font-size:13px; font-weight:600;">Misalignment between lecture format & assessment type</span>
                  </label>
                </div>
              </div>

              <div class="form-group" style="margin-bottom:28px;">
                <label class="form-label" id="lbl-t3-notes">T3.3 Proposed Faculty Action Plan or Note</label>
                <textarea name="mismatchNote" class="form-input" rows="3" placeholder="Describe any specific adjustments you plan to make..." style="font-size:14px; padding:12px;"></textarea>
              </div>

              <button type="submit" class="btn btn-primary" style="width:100%; min-height:48px; font-weight:700;">Complete Survey & View Summary →</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;

  const attachInfo = (id, key, title, text) => {
    const el = container.querySelector(`#${id}`);
    if (el) el.appendChild(createInfoButton(key, title, text));
  };

  attachInfo('lbl-t3-probe', 't3', 'Scenario Probe', 'Targeted scenario prompt comparing teacher self-report vs student perception.');
  attachInfo('lbl-t3-resp', 't3', 'Mismatch Drivers', 'Key factors contributing to perceptual divergence.');
  attachInfo('lbl-t3-notes', 't3', 'Action Plan', 'Faculty note detailing planned classroom adjustments.');

  attachExitButton(container);

  container.querySelector('#t3-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const driver = fd.get('mismatchDriver');
    const note = fd.get('mismatchNote');

    try {
      showToast('Submitting mismatch response...', 'info');
      await api.saveTeacherT3(teacherCourseId, { driver, note, scenario: mismatchState.scenario });
      currentStage = 'SUMMARY';
      renderCurrentStage(container, user);
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  });
}

function getScenarioPromptText(scenario) {
  switch (scenario) {
    case 'A':
      return 'Students report high engagement in practical activities, but perceive high exam difficulty compared to classroom lectures.';
    case 'B':
      return 'Faculty self-reports frequent use of active learning, but students perceive low interactive involvement during theory hours.';
    case 'C':
      return 'Students request more guided practice, while current syllabus pace limits in-class problem solving time.';
    default:
      return 'Discrepancy detected between student learning satisfaction index and faculty self-assessment.';
  }
}

// ── Summary Stage ───────────────────────────────────────────

function renderSummaryStage(container, user) {
  container.innerHTML = `
    <div class="survey-page page-enter">
      <div class="container container-survey" style="max-width:680px; margin-top:40px;">
        <div class="glass-card" style="padding:40px; text-align:center;">
          <div style="width:64px; height:64px; border-radius:50%; background:var(--color-success); color:white; display:flex; align-items:center; justify-content:center; font-size:32px; margin:0 auto 20px auto; box-shadow:0 0 20px var(--color-success);">
            ✓
          </div>
          <h2 style="margin:0 0 8px 0; font-size:24px; font-weight:800; color:var(--color-text-primary);">Questionnaire & AI Interview Complete!</h2>
          <p style="color:var(--color-text-muted); font-size:14px; margin-bottom:28px;">
            Your responses for <strong>${interviewState.subjectName}</strong> have been mapped and analyzed. You can now access Stage T4 Evaluation and comparative insights on your dashboard.
          </p>

          <div style="display:flex; justify-content:center; gap:14px; flex-wrap:wrap;">
            <button class="btn btn-primary" id="goto-t4-btn" style="min-height:48px; padding:0 24px; font-weight:700;">
              View Stage T4 Post-Evaluation →
            </button>
            <button class="btn btn-ghost" id="goto-dash-btn" style="min-height:48px; border:1px solid var(--color-border); font-weight:700;">
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#goto-t4-btn').addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('navigate', {
      detail: { page: 'teacher-evaluation', teacherCourseId }
    }));
  });

  container.querySelector('#goto-dash-btn').addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'teacher-dashboard' } }));
  });
}

// ── Helpers ──────────────────────────────────────────────────

function attachExitButton(container) {
  container.querySelector('#exit-survey-btn')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'teacher-dashboard' } }));
  });
}

function attachRatingChips(container, dataObj) {
  container.querySelectorAll('.rating-options').forEach(group => {
    const field = group.dataset.field;
    group.querySelectorAll('.rating-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.rating-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        dataObj[field] = parseInt(btn.dataset.val, 10);
      });
    });
  });
}
