/**
 * Teacher Evaluation Page — Stage T4: Post-Intervention Evaluation
 * Evaluates Instructional Effectiveness, Feasibility Metrics, Context Fit, and Workload Burden Scale with (i) Explainers
 */

import { api } from '../services/api.js';
import { showToast } from '../components/toast.js';
import { createInfoButton } from '../components/explainer-modal.js';

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
          <div class="survey-header-inner" style="display:flex; justify-content:space-between; align-items:center;">
            <button class="btn btn-ghost" id="exit-eval-btn" style="min-height:40px;">
              ← Back to Dashboard
            </button>
            <div style="text-align: center;">
              <div class="survey-subject" style="font-size:16px; font-weight:800; color:var(--color-text-primary);">Stage T4 Evaluation Report</div>
              <div class="survey-progress-text" style="font-size:12px; color:var(--color-text-muted);">Feasibility, Context Fit & Burden Metrics</div>
            </div>
            <span class="badge badge-completed" style="font-weight:700;">Stage T4</span>
          </div>
        </div>
      </header>

      <div class="survey-content">
        <div class="container container-survey" style="max-width:800px;">
          <div class="glass-card" style="padding:32px;">
            <div style="margin-bottom:24px;">
              <h2 style="margin:0 0 6px 0; font-size:22px; font-weight:800; color:var(--color-text-primary);">T4. Post-Implementation Feedback</h2>
              <p style="color:var(--color-text-muted); font-size:13px; margin:0;">Evaluate the implemented pedagogical strategy across feasibility, classroom fit, and resource workload dimensions.</p>
            </div>

            <form id="t4-form">
              <!-- Evaluated Pedagogy Selection -->
              <div class="form-group" style="margin-bottom:24px;">
                <label class="form-label" id="lbl-t4-pedagogy">Pedagogy Strategy Evaluated</label>
                <select name="evaluatedPedagogy" class="form-input" style="min-height:48px;" required>
                  <option value="active_learning">Active Engagement Learning</option>
                  <option value="problem_based_learning">Problem-Based Learning (PBL)</option>
                  <option value="project_based_learning">Project-Based Learning (PjBL)</option>
                  <option value="peer_instruction">Peer Instruction & Discussion</option>
                  <option value="flipped_classroom">Flipped Classroom</option>
                  <option value="direct_instruction">Explicit & Transmission Learning</option>
                </select>
              </div>

              <!-- T4.1 Overall Effectiveness -->
              <div class="form-group" style="margin-bottom:24px;">
                <label class="form-label" id="lbl-t4-eff">T4.1 Overall Instructional Effectiveness (1-5)</label>
                <div class="rating-options" data-field="effectivenessScore">
                  ${[1,2,3,4,5].map(v => `<button type="button" class="rating-chip ${evalData.effectivenessScore === v ? 'active' : ''}" data-val="${v}">${v}</button>`).join('')}
                </div>
              </div>

              <hr style="border:0; border-top:1px solid var(--color-border); margin:24px 0;" />
              
              <!-- T4.2 Feasibility Metrics -->
              <h3 style="font-size:16px; font-weight:800; color:var(--color-accent); margin-bottom:16px;">T4.2 Feasibility Metrics</h3>
              <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:18px; margin-bottom:24px;">
                <div>
                  <label class="form-label" id="lbl-t4-time" style="font-size:13px;">Time Allocation Fit (1-5)</label>
                  <div class="rating-options" data-field="timeFit">
                    ${[1,2,3,4,5].map(v => `<button type="button" class="rating-chip ${evalData.timeFit === v ? 'active' : ''}" data-val="${v}">${v}</button>`).join('')}
                  </div>
                </div>
                <div>
                  <label class="form-label" id="lbl-t4-effort" style="font-size:13px;">Instructional Effort Manageable (1-5)</label>
                  <div class="rating-options" data-field="effortManageable">
                    ${[1,2,3,4,5].map(v => `<button type="button" class="rating-chip ${evalData.effortManageable === v ? 'active' : ''}" data-val="${v}">${v}</button>`).join('')}
                  </div>
                </div>
                <div>
                  <label class="form-label" id="lbl-t4-prep" style="font-size:13px;">Lesson Prep Manageable (1-5)</label>
                  <div class="rating-options" data-field="prepManageable">
                    ${[1,2,3,4,5].map(v => `<button type="button" class="rating-chip ${evalData.prepManageable === v ? 'active' : ''}" data-val="${v}">${v}</button>`).join('')}
                  </div>
                </div>
                <div>
                  <label class="form-label" id="lbl-t4-mgmt" style="font-size:13px;">Classroom Mgmt Manageable (1-5)</label>
                  <div class="rating-options" data-field="mgmtManageable">
                    ${[1,2,3,4,5].map(v => `<button type="button" class="rating-chip ${evalData.mgmtManageable === v ? 'active' : ''}" data-val="${v}">${v}</button>`).join('')}
                  </div>
                </div>
              </div>

              <hr style="border:0; border-top:1px solid var(--color-border); margin:24px 0;" />
              
              <!-- T4.3 Context Fit -->
              <h3 style="font-size:16px; font-weight:800; color:var(--color-accent); margin-bottom:16px;">T4.3 Context & Classroom Fit</h3>
              <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:18px; margin-bottom:24px;">
                <div>
                  <label class="form-label" id="lbl-t4-size" style="font-size:13px;">Class Size Fit (1-5)</label>
                  <div class="rating-options" data-field="classSizeFit">
                    ${[1,2,3,4,5].map(v => `<button type="button" class="rating-chip ${evalData.classSizeFit === v ? 'active' : ''}" data-val="${v}">${v}</button>`).join('')}
                  </div>
                </div>
                <div>
                  <label class="form-label" id="lbl-t4-readiness" style="font-size:13px;">Student Readiness Fit (1-5)</label>
                  <div class="rating-options" data-field="studentReadinessFit">
                    ${[1,2,3,4,5].map(v => `<button type="button" class="rating-chip ${evalData.studentReadinessFit === v ? 'active' : ''}" data-val="${v}">${v}</button>`).join('')}
                  </div>
                </div>
                <div>
                  <label class="form-label" id="lbl-t4-diff" style="font-size:13px;">Subject Difficulty Alignment (1-5)</label>
                  <div class="rating-options" data-field="subjectDifficultyFit">
                    ${[1,2,3,4,5].map(v => `<button type="button" class="rating-chip ${evalData.subjectDifficultyFit === v ? 'active' : ''}" data-val="${v}">${v}</button>`).join('')}
                  </div>
                </div>
                <div>
                  <label class="form-label" id="lbl-t4-curr" style="font-size:13px;">Curriculum Requirement Fit (1-5)</label>
                  <div class="rating-options" data-field="curriculumFit">
                    ${[1,2,3,4,5].map(v => `<button type="button" class="rating-chip ${evalData.curriculumFit === v ? 'active' : ''}" data-val="${v}">${v}</button>`).join('')}
                  </div>
                </div>
              </div>

              <hr style="border:0; border-top:1px solid var(--color-border); margin:24px 0;" />
              
              <!-- T4.4 Workload Burden Scale -->
              <h3 style="font-size:16px; font-weight:800; color:var(--color-accent); margin-bottom:16px;">T4.4 Resource & Workload Burden (1=Low Burden green, 5=High Burden red)</h3>
              <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:18px; margin-bottom:28px;">
                <div>
                  <label class="form-label" id="lbl-t4-b1" style="font-size:13px;">Planning & Prep Burden</label>
                  <div class="rating-options" data-field="planningBurden">
                    ${[1,2,3,4,5].map(v => `<button type="button" class="rating-chip ${evalData.planningBurden === v ? 'active' : ''}" data-val="${v}">${v}</button>`).join('')}
                  </div>
                </div>
                <div>
                  <label class="form-label" id="lbl-t4-b2" style="font-size:13px;">Tech Setup Burden</label>
                  <div class="rating-options" data-field="techBurden">
                    ${[1,2,3,4,5].map(v => `<button type="button" class="rating-chip ${evalData.techBurden === v ? 'active' : ''}" data-val="${v}">${v}</button>`).join('')}
                  </div>
                </div>
                <div>
                  <label class="form-label" id="lbl-t4-b3" style="font-size:13px;">Material Creation Burden</label>
                  <div class="rating-options" data-field="materialBurden">
                    ${[1,2,3,4,5].map(v => `<button type="button" class="rating-chip ${evalData.materialBurden === v ? 'active' : ''}" data-val="${v}">${v}</button>`).join('')}
                  </div>
                </div>
                <div>
                  <label class="form-label" id="lbl-t4-b4" style="font-size:13px;">Assessment Grading Burden</label>
                  <div class="rating-options" data-field="assessmentBurden">
                    ${[1,2,3,4,5].map(v => `<button type="button" class="rating-chip ${evalData.assessmentBurden === v ? 'active' : ''}" data-val="${v}">${v}</button>`).join('')}
                  </div>
                </div>
              </div>

              <!-- T4.5 Recommended Action -->
              <div class="form-group" style="margin-bottom:28px;">
                <label class="form-label" id="lbl-t4-act">T4.5 Recommended Next Action</label>
                <select name="teacherAction" class="form-input" style="min-height:48px;" required>
                  <option value="continue">Continue pedagogy as is</option>
                  <option value="continue_with_adjustments" selected>Continue with minor adjustments</option>
                  <option value="blend">Blend / redesign with another pedagogy</option>
                  <option value="pivot">Pivot to a different teaching model</option>
                  <option value="discontinue">Discontinue this approach</option>
                </select>
              </div>

              <button type="submit" class="btn btn-primary" style="width:100%; min-height:48px; font-weight:700;">
                Submit Post-Intervention Evaluation →
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach info explainers
  const attachInfo = (id, key, title, text) => {
    const el = container.querySelector(`#${id}`);
    if (el) el.appendChild(createInfoButton(key, title, text));
  };

  attachInfo('lbl-t4-pedagogy', 't4', 'Evaluated Pedagogy', 'The specific instructional model implemented.');
  attachInfo('lbl-t4-eff', 't4', 'Instructional Effectiveness', 'Overall contribution to student learning gains.');
  attachInfo('lbl-t4-time', 't4', 'Time Allocation Fit', 'Suitability of time required for in-class activities.');
  attachInfo('lbl-t4-effort', 't4', 'Instructional Effort', 'Manageability of teacher workload during class.');
  attachInfo('lbl-t4-prep', 't4', 'Lesson Prep Effort', 'Time spent preparing slides, worksheets, or lab files.');
  attachInfo('lbl-t4-mgmt', 't4', 'Classroom Management', 'Ease of facilitating student behavior and participation.');
  attachInfo('lbl-t4-size', 'constraints', 'Class Size Fit', 'Adaptability of method to your classroom count.');
  attachInfo('lbl-t4-readiness', 'constraints', 'Student Readiness Fit', 'Alignment with student background preparation.');
  attachInfo('lbl-t4-diff', 't4', 'Subject Difficulty Fit', 'Suitability for the complexity of the course material.');
  attachInfo('lbl-t4-curr', 't4', 'Curriculum Requirement Fit', 'Adherence to mandatory university syllabus guidelines.');
  attachInfo('lbl-t4-b1', 'workload_burden', 'Planning Burden', 'Prep time overhead before each lecture.');
  attachInfo('lbl-t4-b2', 'workload_burden', 'Tech Setup Burden', 'Effort required to configure software or AV tools.');
  attachInfo('lbl-t4-b3', 'workload_burden', 'Material Creation Burden', 'Effort needed to build assignments or handouts.');
  attachInfo('lbl-t4-b4', 'workload_burden', 'Grading Burden', 'Assessment and feedback evaluation time.');
  attachInfo('lbl-t4-act', 't4', 'Recommended Action', 'Next step decision regarding this teaching strategy.');

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

  // Form submit
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
