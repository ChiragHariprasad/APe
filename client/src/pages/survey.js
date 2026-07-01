/**
 * Survey page — one question at a time, Likert scale, open-ended with voice recorder.
 */

import { api } from '../services/api.js';
import { showToast } from '../components/toast.js';

let currentSession = null;
let currentQuestionIndex = 0;
let answers = {};
let mediaRecorder = null;
let audioChunks = [];
let recordingTimer = null;
let recordingStartTime = null;
let recognition = null;
let liveTranscript = '';
let slideDirection = 'scale-in';

export async function renderSurveyPage(container, user, subjectId) {
  container.innerHTML = `
    <div class="loading-page">
      <div class="spinner"></div>
      <p>Loading survey...</p>
    </div>
  `;

  try {
    currentSession = await api.startSurvey(subjectId);
    answers = { ...currentSession.answers };
    currentQuestionIndex = currentSession.currentIndex || 0;

    // Clamp to valid range
    if (currentQuestionIndex > 11) currentQuestionIndex = 11;

    renderSurvey(container);
  } catch (err) {
    if (err.code === 'ALREADY_COMPLETED') {
      showToast('This survey has already been completed.', 'info');
      window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'dashboard' } }));
      return;
    }
    container.innerHTML = `
      <div class="loading-page">
        <p style="color: var(--color-error);">${err.message}</p>
        <button class="btn btn-primary" onclick="window.dispatchEvent(new CustomEvent('navigate', {detail:{page:'dashboard'}}))">Back to Dashboard</button>
      </div>
    `;
  }
}

function renderSurvey(container) {
  const question = currentSession.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === 11;
  const progress = ((currentQuestionIndex + 1) / 12) * 100;

  container.innerHTML = `
    <div class="survey-page page-enter">
      <!-- Survey Header -->
      <header class="survey-header">
        <div class="container container-survey">
          <div class="survey-header-inner">
            <button class="btn btn-ghost" id="survey-exit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              Save & Exit
            </button>
            <div style="text-align: center;">
              <div class="survey-subject">${currentSession.subjectName}</div>
              <div class="survey-progress-text">Question ${currentQuestionIndex + 1} of 12</div>
            </div>
            <div style="width: 100px;"></div>
          </div>
          <div class="progress-bar-container survey-progress-bar">
            <div class="progress-bar-fill" style="width: ${progress}%"></div>
          </div>
        </div>
      </header>

      <!-- Question Content -->
      <div class="survey-content">
        <div class="container container-survey">
          <div class="glass-card survey-question-card ${slideDirection}" id="question-card">
            ${question.type === 'likert' ? renderLikertQuestion(question) : renderOpenEndedQuestion(question)}
          </div>
        </div>
      </div>
    </div>
  `;

  attachSurveyListeners(container);
}

function renderLikertQuestion(question) {
  const existingAnswer = answers[question.index];
  const selectedRating = existingAnswer?.rating || null;

  const labels = ['Strongly\nDisagree', 'Disagree', 'Neutral', 'Agree', 'Strongly\nAgree'];

  return `
    <div class="question-number">Question ${question.index + 1} of 10 · Pedagogy Assessment</div>
    <div class="question-text">"${question.text}"</div>

    <div class="likert-scale" id="likert-scale">
      ${[1, 2, 3, 4, 5].map(rating => `
        <div class="likert-option ${selectedRating === rating ? 'selected' : ''}" data-rating="${rating}">
          <div class="likert-circle">${rating}</div>
          <div class="likert-label">${labels[rating - 1]}</div>
        </div>
      `).join('')}
    </div>

    <div class="survey-nav">
      <button class="btn btn-ghost" id="btn-back" ${question.index === 0 ? 'disabled' : ''}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Back
      </button>
      <button class="btn btn-primary" id="btn-next" ${selectedRating ? '' : 'disabled'}>
        Next
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
      </button>
    </div>
  `;
}

function renderOpenEndedQuestion(question) {
  const existingAnswer = answers[question.index];
  const existingText = existingAnswer?.textResponse || '';
  const existingVoiceNoteId = existingAnswer?.voiceNoteId || null;
  const isLast = question.index === 11;

  return `
    <div class="question-number">Open-Ended Question ${question.index - 9} of 2</div>
    <div class="question-text">"${question.text}"</div>

    <div class="open-ended-container">
      <div class="response-section">
        <label class="response-label" for="text-response">Your written response</label>
        <textarea class="input-field" id="text-response"
          placeholder="Share your thoughts..."
          maxlength="2000"
          rows="5">${existingText}</textarea>
        <div style="text-align: right; margin-top: var(--space-1); font-size: var(--font-size-xs); color: var(--color-text-muted);">
          <span id="char-count">${existingText.length}</span>/2000
        </div>
      </div>

      <div class="response-or">or record a voice note</div>

      <div class="response-section">
        <label class="response-label">Voice note (max 4 minutes)</label>
        <div class="voice-recorder" id="voice-recorder">
          <div class="recorder-controls">
            <button class="record-btn idle" id="record-btn" title="Start recording">
              <svg viewBox="0 0 24 24"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="white" stroke-width="2"/><line x1="12" y1="19" x2="12" y2="22" stroke="white" stroke-width="2"/></svg>
            </button>
            <div class="recorder-info">
              <div class="recorder-timer" id="recorder-timer">0:00</div>
              <div class="recorder-status" id="recorder-status">Tap to start recording</div>
            </div>
          </div>
          <div id="audio-preview-area"></div>
        </div>
        ${existingVoiceNoteId ? `
          <div style="margin-top: var(--space-2); font-size: var(--font-size-sm); color: var(--color-success);">
            ✓ Voice note already uploaded
          </div>
        ` : ''}
      </div>
    </div>

    <div class="survey-nav" style="margin-top: var(--space-6);">
      <button class="btn btn-ghost" id="btn-back">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Back
      </button>
      <button class="btn btn-primary" id="btn-next" ${existingText || existingVoiceNoteId ? '' : 'disabled'}>
        ${isLast ? 'Review & Submit' : 'Next'}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
      </button>
    </div>
  `;
}

function attachSurveyListeners(container) {
  const question = currentSession.questions[currentQuestionIndex];

  // Save & Exit
  document.getElementById('survey-exit')?.addEventListener('click', () => {
    stopRecording();
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'dashboard' } }));
  });

  if (question.type === 'likert') {
    attachLikertListeners();
  } else {
    attachOpenEndedListeners();
  }

  // Back button
  document.getElementById('btn-back')?.addEventListener('click', () => {
    if (currentQuestionIndex > 0) {
      currentQuestionIndex--;
      slideDirection = 'slide-in-left';
      renderSurvey(container);
    }
  });

  // Next button
  document.getElementById('btn-next')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-next');
    btn.disabled = true;

    try {
      if (question.type === 'likert') {
        await saveLikertResponse();
      } else {
        await saveOpenEndedResponse();
      }

      if (currentQuestionIndex < 11) {
        currentQuestionIndex++;
        slideDirection = 'slide-in-right';
        renderSurvey(container);
      } else {
        // Last question — show submit screen
        renderSubmitScreen(container);
      }
    } catch (err) {
      showToast(err.message || 'Failed to save answer', 'error');
      btn.disabled = false;
    }
  });
}

function attachLikertListeners() {
  const scale = document.getElementById('likert-scale');
  if (!scale) return;

  scale.addEventListener('click', (e) => {
    const option = e.target.closest('.likert-option');
    if (!option) return;

    const rating = parseInt(option.dataset.rating, 10);
    const question = currentSession.questions[currentQuestionIndex];

    // Update visual state
    scale.querySelectorAll('.likert-option').forEach(o => o.classList.remove('selected'));
    option.classList.add('selected');

    // Emoji Feedback Animation
    const emojis = ['😠', '🙁', '😐', '🙂', '🤩'];
    const emoji = document.createElement('div');
    emoji.className = 'emoji-feedback';
    emoji.textContent = emojis[rating - 1];
    
    const rect = option.getBoundingClientRect();
    emoji.style.left = `${rect.left + rect.width / 2 - 16}px`;
    emoji.style.top = `${rect.top}px`;
    document.body.appendChild(emoji);
    setTimeout(() => emoji.remove(), 1000);

    // Store answer
    answers[question.index] = { rating };

    // Enable next button
    const nextBtn = document.getElementById('btn-next');
    if (nextBtn) nextBtn.disabled = false;
  });
}

function attachOpenEndedListeners() {
  const textArea = document.getElementById('text-response');
  const charCount = document.getElementById('char-count');
  const recordBtn = document.getElementById('record-btn');
  const nextBtn = document.getElementById('btn-next');
  const question = currentSession.questions[currentQuestionIndex];

  // Text input tracking
  if (textArea) {
    textArea.addEventListener('input', () => {
      if (charCount) charCount.textContent = textArea.value.length;

      // Enable next if has text
      if (nextBtn) {
        const hasContent = textArea.value.trim().length > 0 || answers[question.index]?.voiceNoteId;
        nextBtn.disabled = !hasContent;
      }
    });
  }

  // Voice recorder
  if (recordBtn) {
    recordBtn.addEventListener('click', toggleRecording);
  }
}

async function toggleRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    stopRecording();
  } else {
    startRecording();
  }
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    liveTranscript = '';

    // Initialize free Web Speech API transcription
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      const textArea = document.getElementById('text-response');
      let baseText = textArea ? textArea.value : '';
      if (baseText && !baseText.endsWith(' ')) baseText += ' ';
      
      recognition.onresult = (event) => {
        let interimStr = '';
        let newFinalStr = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            newFinalStr += event.results[i][0].transcript;
          } else {
            interimStr += event.results[i][0].transcript;
          }
        }
        liveTranscript += newFinalStr;
        
        if (textArea) {
          textArea.value = baseText + liveTranscript + interimStr;
          textArea.dispatchEvent(new Event('input'));
        }
      };
      
      recognition.start();
    }

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      handleRecordingComplete();
    };

    mediaRecorder.start(1000); // Collect data every second
    recordingStartTime = Date.now();

    // Update UI
    const btn = document.getElementById('record-btn');
    const status = document.getElementById('recorder-status');
    if (btn) {
      btn.classList.remove('idle');
      btn.classList.add('recording');
      btn.innerHTML = `<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" fill="white"/></svg>`;
      btn.title = 'Stop recording';
    }
    if (status) {
      status.textContent = 'Recording (Transcribing live...)';
      status.className = 'recorder-status';
    }

    // Start timer
    recordingTimer = setInterval(updateRecordingTimer, 1000);
  } catch (err) {
    showToast('Microphone access denied. Please allow microphone access.', 'error');
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }
  if (recognition) {
    recognition.stop();
    recognition = null;
  }
}

function updateRecordingTimer() {
  if (!recordingStartTime) return;

  const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  const timerEl = document.getElementById('recorder-timer');
  const statusEl = document.getElementById('recorder-status');

  if (timerEl) timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  // Soft warning at 3 minutes
  if (elapsed >= 180 && elapsed < 240) {
    if (statusEl) {
      statusEl.textContent = 'Preferred limit reached. Consider wrapping up.';
      statusEl.className = 'recorder-status warning';
    }
  }

  // Hard stop at 4 minutes
  if (elapsed >= 240) {
    if (statusEl) {
      statusEl.textContent = 'Maximum limit reached — recording stopped.';
      statusEl.className = 'recorder-status error';
    }
    stopRecording();
  }
}

async function handleRecordingComplete() {
  const blob = new Blob(audioChunks, { type: 'audio/webm' });
  const durationSecs = Math.floor((Date.now() - recordingStartTime) / 1000);

  // Reset button state
  const btn = document.getElementById('record-btn');
  if (btn) {
    btn.classList.remove('recording');
    btn.classList.add('idle');
    btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="white" stroke-width="2"/><line x1="12" y1="19" x2="12" y2="22" stroke="white" stroke-width="2"/></svg>`;
    btn.title = 'Start recording';
  }

  // Show preview
  const previewArea = document.getElementById('audio-preview-area');
  if (previewArea) {
    const audioUrl = URL.createObjectURL(blob);
    previewArea.innerHTML = `
      <div class="audio-preview">
        <audio controls src="${audioUrl}" style="flex:1; height: 36px;"></audio>
        <button class="btn btn-secondary" id="upload-voice-btn" style="flex-shrink:0;">Upload</button>
        <button class="btn btn-ghost" id="rerecord-btn" style="flex-shrink:0;">Re-record</button>
      </div>
    `;

    document.getElementById('upload-voice-btn')?.addEventListener('click', async () => {
      await uploadVoiceNote(blob, durationSecs);
    });

    document.getElementById('rerecord-btn')?.addEventListener('click', () => {
      previewArea.innerHTML = '';
      const timerEl = document.getElementById('recorder-timer');
      const statusEl = document.getElementById('recorder-status');
      if (timerEl) timerEl.textContent = '0:00';
      if (statusEl) {
        statusEl.textContent = 'Tap to start recording';
        statusEl.className = 'recorder-status';
      }
    });
  }
}

async function uploadVoiceNote(blob, durationSecs) {
  const uploadBtn = document.getElementById('upload-voice-btn');
  if (uploadBtn) {
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading...';
  }

  try {
    const file = new File([blob], 'voice-note.webm', { type: 'audio/webm' });
    const result = await api.uploadVoiceNote(currentSession.sessionId, file, durationSecs);

    const question = currentSession.questions[currentQuestionIndex];
    if (!answers[question.index]) answers[question.index] = {};
    answers[question.index].voiceNoteId = result.voiceNoteId;

    showToast('Voice note uploaded successfully!', 'success');

    // Enable next button
    const nextBtn = document.getElementById('btn-next');
    if (nextBtn) nextBtn.disabled = false;

    if (uploadBtn) {
      uploadBtn.textContent = '✓ Uploaded';
      uploadBtn.style.color = 'var(--color-success)';
    }
  } catch (err) {
    showToast(err.message || 'Failed to upload voice note', 'error');
    if (uploadBtn) {
      uploadBtn.disabled = false;
      uploadBtn.textContent = 'Retry Upload';
    }
  }
}

async function saveLikertResponse() {
  const question = currentSession.questions[currentQuestionIndex];
  const answer = answers[question.index];
  if (!answer || !answer.rating) throw new Error('Please select a rating.');

  await api.saveAnswer(currentSession.sessionId, question.index, answer.rating);
}

async function saveOpenEndedResponse() {
  const question = currentSession.questions[currentQuestionIndex];
  const textArea = document.getElementById('text-response');
  const textResponse = textArea?.value?.trim() || null;
  const voiceNoteId = answers[question.index]?.voiceNoteId || null;

  if (!textResponse && !voiceNoteId) {
    throw new Error('Please provide a text response or record a voice note.');
  }

  // Store text in answers
  if (!answers[question.index]) answers[question.index] = {};
  answers[question.index].textResponse = textResponse;

  await api.saveOpenEnded(currentSession.sessionId, question.index, textResponse, voiceNoteId);
}

function renderSubmitScreen(container) {
  container.innerHTML = `
    <div class="survey-page page-enter">
      <div class="survey-content">
        <div class="container container-narrow">
          <div class="glass-card submit-screen">
            <div class="submit-icon">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2 class="submit-title">Ready to Submit</h2>
            <p class="submit-subtitle">
              You've answered all 12 questions for<br>
              <strong>${currentSession.subjectName}</strong>
            </p>
            <div class="submit-actions">
              <button class="btn btn-success btn-lg" id="submit-btn">
                Submit Survey
              </button>
              <button class="btn btn-ghost" id="review-btn">
                ← Review Answers
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('submit-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = 'Submitting...';

    try {
      await api.submitSurvey(currentSession.sessionId);
      showSuccessOverlay(container);
    } catch (err) {
      showToast(err.message || 'Failed to submit survey', 'error');
      if (err.data?.missingIndices) {
        showToast(`Missing answers for questions: ${err.data.missingIndices.map(i => i + 1).join(', ')}`, 'warning');
      }
      btn.disabled = false;
      btn.textContent = 'Submit Survey';
    }
  });

  document.getElementById('review-btn')?.addEventListener('click', () => {
    currentQuestionIndex = 0;
    renderSurvey(container);
  });
}

function showSuccessOverlay(container) {
  const overlay = document.createElement('div');
  overlay.className = 'success-overlay';
  overlay.innerHTML = `
    <div class="success-content">
      <div class="success-check">
        <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h2 style="color: white; margin-bottom: var(--space-2);">Survey Submitted!</h2>
      <p style="color: var(--color-text-secondary); margin-bottom: var(--space-6);">Thank you for your feedback on ${currentSession.subjectName}</p>
      <button class="btn btn-primary btn-lg" id="success-return">Return to Dashboard</button>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('success-return')?.addEventListener('click', () => {
    overlay.remove();
    // Clean up state
    currentSession = null;
    answers = {};
    currentQuestionIndex = 0;
    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'dashboard' } }));
  });
}
