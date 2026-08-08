/**
 * Teacher Survey Page — 4-Stage Adaptive Questionnaire & Interview UI
 * Stage T1: Teacher Profile (Per-Course)
 * Stage T2: Course Pedagogy Profile
 * Stage Adaptive Interview: Chat-style interactive interview with Groq LLM
 * Stage T3: Mismatch Probes (Scenario A/B/C/D)
 */

import { api } from '../services/api.js';
import { showToast } from '../components/toast.js';

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
      <p>Loading teacher questionnaire...</p>
    </div>
  `;

  try {
    // Load interview state to check existing progress
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
  return `
    <header class="survey-header">
      <div class="container container-survey">
        <div class="survey-header-inner">
          <button class="btn btn-ghost" id="exit-survey-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Save & Exit
          </button>
          <div style="text-align: center;">
            <div class="survey-subject">${interviewState.subjectName}</div>
            <div class="survey-progress-text">Stage ${stepNum} of 4: ${title}</div>
          </div>
          <div style="width: 100px;"></div>
        </div>
        <div class="progress-bar-container survey-progress-bar">
          <div class="progress-bar-fill" style="width: ${(stepNum / 4) * 100}%"></div>
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
      ${renderStageHeader('T1. Teacher Pedagogy Profile', 1)}

      <div class="survey-content">
        <div class="container container-survey" style="max-width:700px;">
          <div class="glass-card" style="padding:28px;">
            <h2 style="margin:0 0 8px 0; font-size:20px; color:var(--color-text-main);">Teacher Pedagogy & Constraint Profile</h2>
            <p style="color:var(--color-text-muted); font-size:13px; margin-bottom:24px;">Assess your overall pedagogical practices and classroom constraints</p>

            <form id="t1-form">
              <!-- T1.1 Current Pedagogies -->
              <div class="form-group" style="margin-bottom:20px;">
                <label class="form-label">T1.1 Which teaching approaches do you currently use? (Select all that apply)</label>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:8px;">
                  ${PEDAGOGY_OPTIONS.map(p => `
                    <label class="checkbox-option-card" style="display:flex; align-items:center; gap:8px; padding:10px; border:1px solid var(--color-border); border-radius:8px; cursor:pointer;">
                      <input type="checkbox" name="currentPedagogies" value="${p.id}" ${t1Data.currentPedagogies.includes(p.id) ? 'checked' : ''} />
                      <span style="font-size:13px; color:var(--color-text-main);">${p.label}</span>
                    </label>
                  `).join('')}
                </div>
              </div>

              <!-- T1.2 Primary Pedagogy -->
              <div class="form-group" style="margin-bottom:20px;">
                <label class="form-label">T1.2 Which is your PRIMARY teaching approach?</label>
                <select name="primaryPedagogy" class="form-input" required>
                  <option value="">-- Select Primary Approach --</option>
                  ${PEDAGOGY_OPTIONS.map(p => `
                    <option value="${p.id}" ${t1Data.primaryPedagogy === p.id ? 'selected' : ''}>${p.label}</option>
                  `).join('')}
                </select>
              </div>

              <!-- T1.3 Confidence -->
              <div class="form-group" style="margin-bottom:20px;">
                <label class="form-label">T1.3 Confidence in delivering your primary approach (1-5)</label>
                <div class="rating-options" data-field="primaryConfidence">
                  ${[1,2,3,4,5].map(v => `
                    <button type="button" class="rating-chip ${t1Data.primaryConfidence === v ? 'active' : ''}" data-val="${v}">${v}</button>
                  `).join('')}
                </div>
              </div>

              <!-- T1.4 Active Comfort -->
              <div class="form-group" style="margin-bottom:20px;">
                <label class="form-label">T1.4 Comfort level with active/interactive teaching methods (1-5)</label>
                <div class="rating-options" data-field="activeMethodComfort">
                  ${[1,2,3,4,5].map(v => `
                    <button type="button" class="rating-chip ${t1Data.activeMethodComfort === v ? 'active' : ''}" data-val="${v}">${v}</button>
                  `).join('')}
                </div>
              </div>

              <!-- T1.5 Interest Trying -->
              <div class="form-group" style="margin-bottom:20px;">
                <label class="form-label">T1.5 Openness to experimenting with new pedagogical models (1-5)</label>
                <div class="rating-options" data-field="interestTrying">
                  ${[1,2,3,4,5].map(v => `
                    <button type="button" class="rating-chip ${t1Data.interestTrying === v ? 'active' : ''}" data-val="${v}">${v}</button>
                  `).join('')}
                </div>
              </div>

              <!-- T1.6 Willingness Change -->
              <div class="form-group" style="margin-bottom:20px;">
                <label class="form-label">T1.6 Willingness to modify course design if student evidence suggests improvement (1-5)</label>
                <div class="rating-options" data-field="willingnessChange">
                  ${[1,2,3,4,5].map(v => `
                    <button type="button" class="rating-chip ${t1Data.willingnessChange === v ? 'active' : ''}" data-val="${v}">${v}</button>
                  `).join('')}
                </div>
              </div>

              <!-- T1.7 Willing Changes -->
              <div class="form-group" style="margin-bottom:20px;">
                <label class="form-label">T1.7 Which aspects of your course are you open to changing?</label>
                <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;">
                  ${WILLING_CHANGE_OPTIONS.map(wc => `
                    <label class="checkbox-tag" style="padding:6px 12px; border:1px solid var(--color-border); border-radius:20px; font-size:12px; cursor:pointer;">
                      <input type="checkbox" name="willingChanges" value="${wc}" ${t1Data.willingChanges.includes(wc) ? 'checked' : ''} style="margin-right:6px;" />
                      ${wc}
                    </label>
                  `).join('')}
                </div>
              </div>

              <!-- T1.8 Constraints -->
              <div class="form-group" style="margin-bottom:24px;">
                <label class="form-label">T1.8 What key constraints impact your teaching? (Select all that apply)</label>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-top:8px;">
                  ${CONSTRAINT_OPTIONS.map(c => `
                    <label class="checkbox-option-card" style="padding:8px 12px; border:1px solid var(--color-border); border-radius:8px; font-size:12px; cursor:pointer;">
                      <input type="checkbox" name="constraintsVector" value="${c}" ${t1Data.constraintsVector.includes(c) ? 'checked' : ''} style="margin-right:6px;" />
                      ${c}
                    </label>
                  `).join('')}
                </div>
              </div>

              <button type="submit" class="btn btn-primary" style="width:100%;">Save & Continue to Stage T2 →</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;

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
      ${renderStageHeader('T2. Course Pedagogy Profile', 2)}

      <div class="survey-content">
        <div class="container container-survey" style="max-width:700px;">
          <div class="glass-card" style="padding:28px;">
            <h2 style="margin:0 0 8px 0; font-size:20px; color:var(--color-text-main);">Course-Specific Evaluation</h2>
            <p style="color:var(--color-text-muted); font-size:13px; margin-bottom:24px;">Evaluate your current teaching implementation for <strong>${interviewState.subjectName}</strong></p>

            <form id="t2-form">
              <!-- T2.1 Course Pedagogies -->
              <div class="form-group" style="margin-bottom:20px;">
                <label class="form-label">T2.1 Pedagogies deployed in THIS course</label>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:8px;">
                  ${PEDAGOGY_OPTIONS.map(p => `
                    <label class="checkbox-option-card" style="display:flex; align-items:center; gap:8px; padding:10px; border:1px solid var(--color-border); border-radius:8px; cursor:pointer;">
                      <input type="checkbox" name="coursePedagogies" value="${p.id}" ${t2Data.coursePedagogies.includes(p.id) ? 'checked' : ''} />
                      <span style="font-size:13px; color:var(--color-text-main);">${p.label}</span>
                    </label>
                  `).join('')}
                </div>
              </div>

              <!-- T2.2 Primary Course Pedagogy -->
              <div class="form-group" style="margin-bottom:20px;">
                <label class="form-label">T2.2 Primary pedagogy for THIS course</label>
                <select name="coursePrimary" class="form-input" required>
                  <option value="">-- Select Primary Approach --</option>
                  ${PEDAGOGY_OPTIONS.map(p => `
                    <option value="${p.id}" ${t2Data.coursePrimary === p.id ? 'selected' : ''}>${p.label}</option>
                  `).join('')}
                </select>
              </div>

              <!-- T2.3 Perceived Effectiveness -->
              <div class="form-group" style="margin-bottom:20px;">
                <label class="form-label">T2.3 Perceived effectiveness of current pedagogy in achieving learning outcomes (1-5)</label>
                <div class="rating-options" data-field="perceivedEffectiveness">
                  ${[1,2,3,4,5].map(v => `
                    <button type="button" class="rating-chip ${t2Data.perceivedEffectiveness === v ? 'active' : ''}" data-val="${v}">${v}</button>
                  `).join('')}
                </div>
              </div>

              <!-- T2.4 Teacher Satisfaction -->
              <div class="form-group" style="margin-bottom:20px;">
                <label class="form-label">T2.4 Your satisfaction with student engagement & comprehension in this course (1-5)</label>
                <div class="rating-options" data-field="pedagogySatisfaction">
                  ${[1,2,3,4,5].map(v => `
                    <button type="button" class="rating-chip ${t2Data.pedagogySatisfaction === v ? 'active' : ''}" data-val="${v}">${v}</button>
                  `).join('')}
                </div>
              </div>

              <!-- T2.5 Course Fit -->
              <div class="form-group" style="margin-bottom:24px;">
                <label class="form-label">T2.5 Alignment between teaching approach and course syllabus difficulty (1-5)</label>
                <div class="rating-options" data-field="courseFit">
                  ${[1,2,3,4,5].map(v => `
                    <button type="button" class="rating-chip ${t2Data.courseFit === v ? 'active' : ''}" data-val="${v}">${v}</button>
                  `).join('')}
                </div>
              </div>

              <button type="submit" class="btn btn-primary" style="width:100%;">Save & Proceed to Adaptive Interview →</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;

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
        <div class="container container-survey" style="max-width:750px;">
          <!-- Top info / pedagogy mix tags -->
          <div class="glass-card" style="padding:16px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <span style="font-size:12px; font-weight:700; color:var(--color-accent); text-transform:uppercase;">AI Evidence Extraction</span>
              <div style="font-size:13px; color:var(--color-text-muted);">Share your typical classroom flow. The AI asks 3-5 tailored follow-up questions.</div>
            </div>
            <div id="pedagogy-mix-tags" style="display:flex; flex-wrap:wrap; gap:4px;">
              ${renderPedagogyMixTags(interviewState.pedagogyMix)}
            </div>
          </div>

          <!-- Chat Conversation Window -->
          <div class="glass-card chat-window" style="padding:20px; height:420px; display:flex; flex-direction:column; justify-content:space-between;">
            <div class="chat-messages" id="chat-messages" style="flex:1; overflow-y:auto; padding-right:8px; display:flex; flex-direction:column; gap:14px;">
              <!-- Root Prompt -->
              <div class="chat-bubble system-bubble" style="background:rgba(99, 102, 241, 0.12); padding:12px 16px; border-radius:12px 12px 12px 2px; align-self:flex-start; max-width:85%;">
                <div style="font-size:11px; font-weight:700; color:var(--color-accent); margin-bottom:4px;">APE INTERVIEWER</div>
                <div style="font-size:14px; color:var(--color-text-main);">${interviewState.rootPrompt}</div>
              </div>

              <!-- Previous Turns -->
              ${interviewState.turns.map(t => `
                <div class="chat-bubble user-bubble" style="background:var(--color-accent); color:white; padding:12px 16px; border-radius:12px 12px 2px 12px; align-self:flex-end; max-width:85%;">
                  <div style="font-size:14px;">${t.answer}</div>
                </div>
                ${t.question ? `
                  <div class="chat-bubble system-bubble" style="background:rgba(99, 102, 241, 0.12); padding:12px 16px; border-radius:12px 12px 12px 2px; align-self:flex-start; max-width:85%;">
                    <div style="font-size:11px; font-weight:700; color:var(--color-accent); margin-bottom:4px;">APE INTERVIEWER</div>
                    <div style="font-size:14px; color:var(--color-text-main);">${t.question}</div>
                  </div>
                ` : ''}
              `).join('')}
            </div>

            <!-- Chat Input Form -->
            <form id="chat-form" style="margin-top:16px; display:flex; gap:10px;">
              <textarea id="chat-input" class="form-input" rows="2" placeholder="Describe your class session, activities, student involvement..." style="resize:none;" required></textarea>
              <button type="submit" class="btn btn-primary" id="send-chat-btn" style="height:auto; white-space:nowrap;">
                Send Answer →
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;

  attachExitButton(container);

  const messagesDiv = container.querySelector('#chat-messages');
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  const form = container.querySelector('#chat-form');
  const input = container.querySelector('#chat-input');
  const sendBtn = container.querySelector('#send-chat-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const answerText = input.value.trim();
    if (!answerText) return;

    // Append user answer immediately
    const userBubble = document.createElement('div');
    userBubble.className = 'chat-bubble user-bubble';
    userBubble.style.cssText = 'background:var(--color-accent); color:white; padding:12px 16px; border-radius:12px 12px 2px 12px; align-self:flex-end; max-width:85%;';
    userBubble.innerHTML = `<div style="font-size:14px;">${escapeHtml(answerText)}</div>`;
    messagesDiv.appendChild(userBubble);

    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;

    // Typing indicator
    const typingBubble = document.createElement('div');
    typingBubble.className = 'chat-bubble system-bubble typing';
    typingBubble.style.cssText = 'background:rgba(99, 102, 241, 0.12); padding:12px 16px; border-radius:12px 12px 12px 2px; align-self:flex-start;';
    typingBubble.innerHTML = `<span style="font-size:12px; color:var(--color-accent);">AI is classifying pedagogy & generating follow-up...</span>`;
    messagesDiv.appendChild(typingBubble);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    try {
      const res = await api.sendInterviewAnswer(teacherCourseId, answerText);
      typingBubble.remove();

      interviewState.turns.push({ answer: answerText, question: res.nextQuestion });
      interviewState.pedagogyMix = res.pedagogyMix || [];

      // Update tags
      const tagsContainer = container.querySelector('#pedagogy-mix-tags');
      if (tagsContainer) tagsContainer.innerHTML = renderPedagogyMixTags(res.pedagogyMix);

      if (res.isComplete || !res.nextQuestion) {
        showToast('Interview coverage complete!', 'success');
        await loadMismatchData();
        currentStage = 'T3';
        renderCurrentStage(container, user);
      } else {
        // Append AI next question
        const sysBubble = document.createElement('div');
        sysBubble.className = 'chat-bubble system-bubble';
        sysBubble.style.cssText = 'background:rgba(99, 102, 241, 0.12); padding:12px 16px; border-radius:12px 12px 12px 2px; align-self:flex-start; max-width:85%;';
        sysBubble.innerHTML = `
          <div style="font-size:11px; font-weight:700; color:var(--color-accent); margin-bottom:4px;">APE INTERVIEWER</div>
          <div style="font-size:14px; color:var(--color-text-main);">${escapeHtml(res.nextQuestion)}</div>
        `;
        messagesDiv.appendChild(sysBubble);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;

        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
      }
    } catch (err) {
      typingBubble.remove();
      showToast(`Error: ${err.message}`, 'error');
      input.disabled = false;
      sendBtn.disabled = false;
    }
  });
}

function renderPedagogyMixTags(mix) {
  if (!mix || mix.length === 0) return '<span style="font-size:11px; color:var(--color-text-muted);">Extracting...</span>';
  return mix.map(m => `
    <span class="badge" style="background:rgba(99,102,241,0.15); color:var(--color-accent); font-size:10px;">
      ${m.coreLabel || m.core} (${Math.round((m.weight || 0.5) * 100)}%)
    </span>
  `).join('');
}

// ── T3: Mismatch Probes Stage ───────────────────────────────

function renderT3Stage(container, user) {
  const scenario = mismatchState.scenario || 'A';

  container.innerHTML = `
    <div class="survey-page page-enter">
      ${renderStageHeader('T3. Student-Teacher Alignment Assessment', 4)}

      <div class="survey-content">
        <div class="container container-survey" style="max-width:700px;">
          <div class="glass-card" style="padding:28px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
              <h2 style="margin:0; font-size:20px; color:var(--color-text-main);">Alignment Scenario: ${scenario}</h2>
              <span class="badge" style="background:var(--color-accent); color:white;">SCENARIO ${scenario}</span>
            </div>

            ${renderScenarioContent(scenario)}
          </div>
        </div>
      </div>
    </div>
  `;

  attachExitButton(container);

  const form = container.querySelector('#t3-form');
  if (form) {
    attachRatingChips(container, mismatchState.responses);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        scenario,
        studentPES: mismatchState.studentPES,
        teacherSatisfaction: mismatchState.teacherSatisfaction,
      };

      if (scenario === 'B') {
        payload.effectivenessReasons = Array.from(fd.getAll('effectivenessReasons'));
        payload.willingnessToChange = mismatchState.responses.willingnessToChange || 4;
        payload.changeRequirements = Array.from(fd.getAll('changeRequirements'));
      } else if (scenario === 'C') {
        payload.pedagogyProblems = Array.from(fd.getAll('pedagogyProblems'));
        payload.continueIfPositive = mismatchState.responses.continueIfPositive || 4;
        payload.easeChanges = Array.from(fd.getAll('easeChanges'));
      } else if (scenario === 'D') {
        payload.preferredChanges = Array.from(fd.getAll('preferredChanges'));
        payload.interestedPedagogies = Array.from(fd.getAll('interestedPedagogies'));
        payload.changeBarriers = Array.from(fd.getAll('changeBarriers'));
      }

      try {
        showToast('Saving T3 probe responses...', 'info');
        await api.saveTeacherT3(teacherCourseId, payload);
        await api.submitTeacherSurvey(teacherCourseId);
        currentStage = 'SUMMARY';
        renderCurrentStage(container, user);
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      }
    });
  } else {
    // Scenario A or auto-proceed button
    container.querySelector('#finish-t3-btn')?.addEventListener('click', async () => {
      try {
        await api.submitTeacherSurvey(teacherCourseId);
        currentStage = 'SUMMARY';
        renderCurrentStage(container, user);
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      }
    });
  }
}

function renderScenarioContent(scenario) {
  if (scenario === 'A') {
    return `
      <div style="background:rgba(34, 197, 94, 0.1); border:1px solid rgba(34, 197, 94, 0.3); border-radius:10px; padding:20px; margin-bottom:24px;">
        <h3 style="margin:0 0 8px 0; color:#4ade80; font-size:16px;">✓ Alignment Validated (Scenario A)</h3>
        <p style="margin:0; font-size:13px; color:var(--color-text-muted);">
          Both your evaluation and student feedback indicate positive engagement and satisfaction. No specific intervention probes are required.
        </p>
      </div>
      <button type="button" class="btn btn-primary" id="finish-t3-btn" style="width:100%;">Complete Evaluation Flow →</button>
    `;
  }

  if (scenario === 'B') {
    return `
      <div style="background:rgba(234, 179, 8, 0.1); border:1px solid rgba(234, 179, 8, 0.3); border-radius:10px; padding:16px; margin-bottom:20px;">
        <div style="font-weight:600; color:#facc15; font-size:14px;">Scenario B: Teacher Satisfied, Student Evaluation Low</div>
        <div style="font-size:12px; color:var(--color-text-muted); margin-top:4px;">You rated engagement high, but student perception scores indicate gaps. Please answer these diagnostic probes:</div>
      </div>

      <form id="t3-form">
        <div class="form-group" style="margin-bottom:16px;">
          <label class="form-label">T3.1 What might explain why students find this approach less effective?</label>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:6px;">
            ${['Pacing too fast', 'Lack of worked examples', 'Assessment misalignment', 'Difficult prerequisites', 'Passive format'].map(r => `
              <label class="checkbox-option-card" style="padding:8px; border:1px solid var(--color-border); border-radius:6px; font-size:12px; cursor:pointer;">
                <input type="checkbox" name="effectivenessReasons" value="${r}" style="margin-right:6px;" /> ${r}
              </label>
            `).join('')}
          </div>
        </div>

        <div class="form-group" style="margin-bottom:16px;">
          <label class="form-label">T3.2 Willingness to modify strategy based on student feedback (1-5)</label>
          <div class="rating-options" data-field="willingnessToChange">
            ${[1,2,3,4,5].map(v => `<button type="button" class="rating-chip ${mismatchState.responses.willingnessToChange === v ? 'active' : ''}" data-val="${v}">${v}</button>`).join('')}
          </div>
        </div>

        <button type="submit" class="btn btn-primary" style="width:100%;">Finalize Evaluation →</button>
      </form>
    `;
  }

  if (scenario === 'C') {
    return `
      <div style="background:rgba(59, 130, 246, 0.1); border:1px solid rgba(59, 130, 246, 0.3); border-radius:10px; padding:16px; margin-bottom:20px;">
        <div style="font-weight:600; color:#60a5fa; font-size:14px;">Scenario C: Teacher Dissatisfied, Student Evaluation High</div>
        <div style="font-size:12px; color:var(--color-text-muted); margin-top:4px;">Students responded positively, but you feel the pedagogy isn't achieving full potential.</div>
      </div>

      <form id="t3-form">
        <div class="form-group" style="margin-bottom:16px;">
          <label class="form-label">T3.4 What specific problems do you see in current execution?</label>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:6px;">
            ${['Shallow comprehension', 'Superficial participation', 'Time-consuming prep', 'Hard to assess fairly'].map(r => `
              <label class="checkbox-option-card" style="padding:8px; border:1px solid var(--color-border); border-radius:6px; font-size:12px; cursor:pointer;">
                <input type="checkbox" name="pedagogyProblems" value="${r}" style="margin-right:6px;" /> ${r}
              </label>
            `).join('')}
          </div>
        </div>

        <div class="form-group" style="margin-bottom:16px;">
          <label class="form-label">T3.5 Openness to maintaining current method given positive student reception (1-5)</label>
          <div class="rating-options" data-field="continueIfPositive">
            ${[1,2,3,4,5].map(v => `<button type="button" class="rating-chip ${mismatchState.responses.continueIfPositive === v ? 'active' : ''}" data-val="${v}">${v}</button>`).join('')}
          </div>
        </div>

        <button type="submit" class="btn btn-primary" style="width:100%;">Finalize Evaluation →</button>
      </form>
    `;
  }

  // Scenario D
  return `
    <div style="background:rgba(239, 68, 68, 0.1); border:1px solid rgba(239, 68, 68, 0.3); border-radius:10px; padding:16px; margin-bottom:20px;">
      <div style="font-weight:600; color:#f87171; font-size:14px;">Scenario D: Mutual Dissatisfaction (High Mismatch / Pivot Urged)</div>
      <div style="font-size:12px; color:var(--color-text-muted); margin-top:4px;">Both faculty and student feedback indicate current pedagogy is underperforming.</div>
    </div>

    <form id="t3-form">
      <div class="form-group" style="margin-bottom:16px;">
        <label class="form-label">T3.7 Which teaching changes would you prioritize for next semester?</label>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:6px;">
          ${['Adopt Flipped Classroom', 'Introduce Problem-Based Tasks', 'Increase Peer Collaboration', 'Simplify Explanations & Examples'].map(r => `
            <label class="checkbox-option-card" style="padding:8px; border:1px solid var(--color-border); border-radius:6px; font-size:12px; cursor:pointer;">
              <input type="checkbox" name="preferredChanges" value="${r}" style="margin-right:6px;" /> ${r}
            </label>
          `).join('')}
        </div>
      </div>

      <button type="submit" class="btn btn-primary" style="width:100%;">Finalize Evaluation →</button>
    </form>
  `;
}

// ── Summary Stage ──────────────────────────────────────────

function renderSummaryStage(container, user) {
  container.innerHTML = `
    <div class="survey-page page-enter">
      <div class="survey-content">
        <div class="container container-survey" style="max-width:600px; text-align:center;">
          <div class="glass-card" style="padding:40px;">
            <div style="font-size:48px; margin-bottom:16px;">🎉</div>
            <h2 style="margin:0 0 8px 0; font-size:24px; color:var(--color-text-main);">Evaluation Flow Completed!</h2>
            <p style="color:var(--color-text-muted); font-size:14px; margin-bottom:24px;">
              Your dispositional profile, course evaluation, interview evidence, and alignment probes for <strong>${interviewState.subjectName}</strong> have been recorded.
            </p>
            <div style="display:flex; justify-content:center; gap:12px;">
              <button class="btn btn-primary" id="return-dashboard-btn">Return to Dashboard</button>
              <button class="btn btn-ghost" id="eval-t4-btn">Perform Post-Intervention Eval (T4) →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#return-dashboard-btn').addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'teacher-dashboard' } }));
  });

  container.querySelector('#eval-t4-btn').addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('navigate', {
      detail: { page: 'teacher-evaluation', teacherCourseId }
    }));
  });
}

// Helper utilities
function attachExitButton(container) {
  container.querySelector('#exit-survey-btn')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'teacher-dashboard' } }));
  });
}

function attachRatingChips(container, stateObj) {
  container.querySelectorAll('.rating-options').forEach(group => {
    const field = group.dataset.field;
    group.querySelectorAll('.rating-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.rating-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        stateObj[field] = parseInt(btn.dataset.val, 10);
      });
    });
  });
}

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
