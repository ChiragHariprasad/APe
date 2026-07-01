/**
 * Onboarding page — lateral entry question, batch/semester determination.
 */

import { api } from '../services/api.js';
import { showToast } from '../components/toast.js';

export function renderOnboardingPage(container, user) {
  let selectedAnswer = null;

  container.innerHTML = `
    <div class="onboarding-page page-enter">
      <div class="glass-card onboarding-card">
        <h1 class="onboarding-greeting">Welcome, ${user?.displayName || 'Student'}! 👋</h1>
        <p class="onboarding-question">Before we begin, are you a <strong>lateral entry</strong> student?</p>

        <div class="toggle-group" id="lateral-toggle">
          <button class="toggle-btn" data-value="false" id="btn-no">No</button>
          <button class="toggle-btn" data-value="true" id="btn-yes">Yes</button>
        </div>

        <button class="btn btn-primary btn-lg" id="onboarding-continue" disabled>
          Continue
        </button>
      </div>
    </div>
  `;

  // Toggle handlers
  const btnNo = document.getElementById('btn-no');
  const btnYes = document.getElementById('btn-yes');
  const continueBtn = document.getElementById('onboarding-continue');

  function selectOption(value) {
    selectedAnswer = value === 'true';
    btnNo.classList.toggle('active', !selectedAnswer);
    btnYes.classList.toggle('active', selectedAnswer);
    continueBtn.disabled = false;
  }

  btnNo.addEventListener('click', () => selectOption('false'));
  btnYes.addEventListener('click', () => selectOption('true'));

  continueBtn.addEventListener('click', async () => {
    if (selectedAnswer === null) return;

    continueBtn.disabled = true;
    continueBtn.textContent = 'Setting up...';

    try {
      const result = await api.submitLateralEntry(selectedAnswer);
      showToast(`${result.label} — Semester ${result.currentSemester}`, 'success');

      window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'dashboard' } }));
    } catch (err) {
      showToast(err.message || 'Failed to complete onboarding', 'error');
      continueBtn.disabled = false;
      continueBtn.textContent = 'Continue';
    }
  });
}
