/**
 * Teacher Evaluation Page — Stage T4: Post-Intervention Evaluation
 * Evaluates effectiveness, feasibility sub-items, context fit sub-items, and resource burden.
 */

import { api } from '../services/api.js';
import { showToast } from '../components/toast.js';

let teacherCourseId = null;
let evalData = {
  evaluatedPedagogy: 'active_learning',
  effectivenessScore: 4,
  // Feasibility
  timeFit: 4,
  effortManageable: 4,
  prepManageable: 4,
  mgmtManageable: 4,
  // Context Fit
  classSizeFit: 4,
  studentReadinessFit: 4,
  subjectDifficultyFit: 4,
  curriculumFit: 4,
  participationFit: 4,
  // Resource Burden
  planningBurden: 2,
  techBurden: 2,
  materialBurden: 2,
  workloadBurden: 2,
  assessmentBurden: 2,
  // Final Action
  teacherAction: 'continue_with_adjustments',
};

export async function renderTeacherEvaluationPage(container, user, tcId) {
  teacherCourseId = tcId;

  container.innerHTML = `
    <div class="survey-page page-enter">
      <header class="survey-header">
        <div class="container container-survey">
          <div class="survey-header-inner">
            <button class="btn btn-ghost" id="exit-eval-btn">
              ← Back to Dashboard
            </button>
            <div style="text-align: center;">
              <div class="survey-subject">Stage T4: Post-Intervention Evaluation</div>
              <div class="survey-progress-text">Evaluate Feasibility & Context Fit</div>
            </div>
            <div style="width: 100px;"></div>
          </div>
        </div>
      </header>

      <div class="survey-content">
        <div class="container container-survey" style="max-width:720px;">
          <div class="glass-card" style="padding:28px;">
            <h2 style="margin:0 0 8px 0; font-size:20px; color:var(--color-text-main);">T4. Post-Implementation Feedback</h2>
            <p style="color:var(--color-text-muted); font-size:13px; margin-bottom:24px;">Evaluate the implemented pedagogical strategy across feasibility, fit, and workload dimensions.</p>

            <form id="t4-form">
              <!-- Evaluated Pedagogy selection -->
              <div class="form-group" style="margin-bottom:20px;">
                <label class="form-label">Pedagogy Evaluated</label>
                <select name="evaluatedPedagogy" class="form-input" required>
                  <option value="active_learning">Active Engagement Learning</option>
                  <option value="problem_based_learning">Problem-Based Learning (PBL)</option>
                  <option value="project_based_learning">Project-Based Learning (PjBL)</option>
                  <option value="peer_instruction">Peer Instruction & Discussion</option>
                  <option value="flipped_classroom">Flipped Classroom</option>
                  <option value="direct_instruction">Explicit & Transmission Learning</option>
                </select>
              </div>

              <!-- T4.1 Effectiveness -->
              <div class="form-group" style="margin-bottom:20px;">
                <label class="form-label">T4.1 Overall Instructional Effectiveness (1-5)</label>
                <div class="rating-options" data-field="effectivenessScore">
                  ${[1,2,3,4,5].map(v => `<button type="button" class="rating-chip ${evalData.effectivenessScore === v ? 'active' : ''}" data-val="${v}">${v}</button>`).join('')}
                </div>
              </div>

              <hr style="border:0; border-top:1px solid var(--color-border); margin:20px 0;" />
              <h3 style="font-size:15px; font-weight:700; color:var(--color-accent); margin-bottom:12px;">T4.2 Feasibility Metrics</h3>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px;">
                <div>
                  <label class="form-label" style="font-size:12px;">Time Allocation Fit (1-5)</label>
                  <div class="rating-options" data-field="timeFit">
                    ${[1,2,3,4,5].map(v => `<button type="button" class="rating-chip ${evalData.timeFit === v ? 'active' : ''}" data-val="${v}">${v}</button>`).join('')}
                  </div>
                </div>
                <div>
                  <label class="form-label" style="font-size:12px;">Instructional Effort Manageable (1-5)</label>
                  <div class="rating-options" data-field="effortManageable">
                    ${[1,2,3,4,5].map(v => `<button type="button" class="rating-chip ${evalData.effortManageable === v ? 'active' : ''}" data-val="${v}">${v}</button>`).join('')}
                  </div>
                </div>
                <div>
                  <label class="form-label" style="font-size:12px;">Lesson Prep Manageable (1-5)</label>
                  <div class="rating-options" data-field="prepManageable">
                    ${[1,2,3,4,5].map(v => `<button type="button" class="rating-chip ${evalData.prepManageable === v ? 'active' : ''}" data-val="${v}">${v}</button>`).join('')}
                  </div>
                </div>
                <div>
                  <label class="form-label" style="font-size:12px;">Classroom Mgmt Manageable (1-5)</label>
                  <div class="rating-options" data-field="mgmtManageable">
                    ${[1,2,3,4,5].map(v => `<button type="button" class="rating-chip ${evalData.mgmtManageable === v ? 'active' : ''}" data-val="${v}">${v}</button>`).join('')}
                  </div>
                </div>
              </div>

              <hr style="border:0; border-top:1px solid var(--color-border); margin:20px 0;" />
              <h3 style="font-size:15px; font-weight:700; color:var(--color-accent); margin-bottom:12px;">T4.3 Context & Classroom Fit</h3>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px;">
                <div>
                  <label class="form-label" style="font-size:12px;">Class Size Fit (1-5)</label>
                  <div class="rating-options" data-field="classSizeFit">
                    ${[1,2,3,4,5].map(v => `<button type="button" class="rating-chip ${evalData.classSizeFit === v ? 'active' : ''}" data-val="${v}">${v}</button>`).join('')}
                  </div>
                </div>
                <div>
                  <label class="form-label" style="font-size:12px;">Student Readiness Fit (1-5)</label>
                  <div class="rating-options" data-field="studentReadinessFit">
                    ${[1,2,3,4,5].map(v => `<button type="button" class="rating-chip ${evalData.studentReadinessFit === v ? 'active' : ''}" data-val="${v}">${v}</button>`).join('')}
                  </div>
                </div>
                <div>
                  <label class="form-label" style="font-size:12px;">Subject Difficulty Alignment (1-5)</label>
                  <div class="rating-options" data-field="subjectDifficultyFit">
                    ${[1,2,3,4,5].map(v => `<button type="button" class="rating-chip ${evalData.subjectDifficultyFit === v ? 'active' : ''}" data-val="${v}">${v}</button>`).join('')}
                  </div>
                </div>
                <div>
                  <label class="form-label" style="font-size:12px;">Curriculum Requirement Fit (1-5)</label>
                  <div class="rating-options" data-field="curriculumFit">
                    ${[1,2,3,4,5].map(v => `<button type="button" class="rating-chip ${evalData.curriculumFit === v ? 'active' : ''}" data-val="${v}">${v}</button>`).join('')}
                  </div>
                </div>
              </div>

              <hr style="border:0; border-top:1px solid var(--color-border); margin:20px 0;" />
              <h3 style="font-size:15px; font-weight:700; color:var(--color-accent); margin-bottom:12px;">T4.4 Resource & Workload Burden</h3>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px;">
                <div>
                  <label class="form-label" style="font-size:12px;">Planning Burden (1=Low, 5=High)</label>
                  <div class="rating-options" data-field="planningBurden">
                    ${[1,2,3,4,5].map(v => `<button type="button" class="rating-chip ${evalData.planningBurden === v ? 'active' : ''}" data-val="${v}">${v}</button>`).join('')}
                  </div>
                </div>
                <div>
                  <label class="form-label" style="font-size:12px;">Tech Setup Burden (1=Low, 5=High)</label>
                  <div class="rating-options" data-field="techBurden">
                    ${[1,2,3,4,5].map(v => `<button type="button" class="rating-chip ${evalData.techBurden === v ? 'active' : ''}" data-val="${v}">${v}</button>`).join('')}
                  </div>
                </div>
                <div>
                  <label class="form-label" style="font-size:12px;">Material Prep Burden (1=Low, 5=High)</label>
                  <div class="rating-options" data-field="materialBurden">
                    ${[1,2,3,4,5].map(v => `<button type="button" class="rating-chip ${evalData.materialBurden === v ? 'active' : ''}" data-val="${v}">${v}</button>`).join('')}
                  </div>
                </div>
                <div>
                  <label class="form-label" style="font-size:12px;">Assessment Grading Burden (1=Low, 5=High)</label>
                  <div class="rating-options" data-field="assessmentBurden">
                    ${[1,2,3,4,5].map(v => `<button type="button" class="rating-chip ${evalData.assessmentBurden === v ? 'active' : ''}" data-val="${v}">${v}</button>`).join('')}
                  </div>
                </div>
              </div>

              <!-- T4.5 Action -->
              <div class="form-group" style="margin-bottom:24px;">
                <label class="form-label">T4.5 Your Recommended Next Action</label>
                <select name="teacherAction" class="form-input" required>
                  <option value="continue">Continue pedagogy as is</option>
                  <option value="continue_with_adjustments" selected>Continue with minor adjustments</option>
                  <option value="blend">Blend / redesign with another pedagogy</option>
                  <option value="pivot">Pivot to a different teaching model</option>
                  <option value="discontinue">Discontinue this approach</option>
                </select>
              </div>

              <button type="submit" class="btn btn-primary" style="width:100%;">Submit Post-Intervention Evaluation →</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#exit-eval-btn').addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'teacher-dashboard' } }));
  });

  // Attach rating chip handlers
  container.querySelectorAll('.rating-options').forEach(group => {
    const field = group.dataset.field;
    group.querySelectorAll('.rating-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.rating-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        evalData[field] = parseInt(btn.dataset.val, 10);
      });
    });
  });

  // Submit
  container.querySelector('#t4-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    evalData.evaluatedPedagogy = fd.get('evaluatedPedagogy');
    evalData.teacherAction = fd.get('teacherAction');

    try {
      showToast('Submitting T4 evaluation...', 'info');
      await api.savePostEvaluation(teacherCourseId, evalData);
      showToast('Post-intervention evaluation submitted!', 'success');
      window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'teacher-dashboard' } }));
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  });
}
