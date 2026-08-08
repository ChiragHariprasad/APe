/**
 * Universal Info Explainer System (Modal & Bottom-Sheet Popover)
 * Displays simple, plain-English explanations and classroom examples when clicking (i) buttons.
 */

const EXPLAINER_DICTIONARY = {
  // Stage Codes & Evaluation Stages
  't1': {
    title: 'Stage T1: Teacher Dispositional Profile',
    short: 'Captures your overall teaching background, experience, and general confidence.',
    detail: 'This baseline setup asks about your teaching experience, typical class sizes, and general comfort with interactive teaching methods. It helps tailor subsequent questions to your teaching style.',
    example: '5+ years teaching UG engineering courses with classes of 60 students.'
  },
  't2': {
    title: 'Stage T2: Course Pedagogy Profile',
    short: 'Evaluates course-specific teaching methods, satisfaction, and perceived effectiveness.',
    detail: 'Focuses on the specific subject you teach. We look at how you currently run lectures, practicals, assignments, and where you encounter constraints or opportunities.',
    example: 'Using slides for theory, but running weekly lab problem sets for hands-on practice.'
  },
  'interview': {
    title: 'Adaptive AI Interview',
    short: 'Interactive chat session with AI to analyze your teaching narrative against standard pedagogy frameworks.',
    detail: 'An adaptive conversational session powered by AI (Groq LLM). The AI asks open-ended questions about how you teach, clarifies ambiguities, and automatically maps your responses into standard pedagogical models.',
    example: '"Walk me through how you introduce a complex topic in class..."'
  },
  't3': {
    title: 'Stage T3: Mismatch Probes',
    short: 'Compares student feedback with teacher self-reports to highlight alignment and gap areas.',
    detail: 'Shows real vs perceived teaching impact by contrasting student feedback index (PES) with your self-assessment, presenting targeted scenario questions to resolve mismatches.',
    example: 'Scenario A: Students report high engagement while teacher perceives high difficulty.'
  },
  't4': {
    title: 'Stage T4: Post-Intervention Evaluation',
    short: 'Measures feasibility, context fit, and workload burden after implementing a teaching strategy.',
    detail: 'After trying out a recommended pedagogy, this stage collects structured feedback on how manageable the preparation, time commitment, and grading were.',
    example: 'Rating preparation burden as manageable (2/5) while time fit was ideal (4/5).'
  },
  'pes': {
    title: 'PES (Pedagogy Effectiveness Score)',
    short: 'Student feedback metric index measuring classroom engagement and learning satisfaction.',
    detail: 'Calculated from aggregated student survey responses regarding active participation, clarity of instruction, and learning outcome satisfaction in your course.',
    example: 'PES 4.2 / 5.0 indicates strong positive student perception.'
  },

  // Pedagogy Strategies & Definitions
  'direct_instruction': {
    title: 'Direct Instruction / Explicit Teaching',
    short: 'You explain and demonstrate the concept directly.',
    detail: 'The teacher leads the lesson, presents the material step-by-step, demonstrates how to solve problems, and then gives students practice.',
    example: 'You teach a concept on the board, work through 2–3 examples, and then students solve similar questions.'
  },
  'guided_instruction': {
    title: 'Guided Instruction & Scaffolding',
    short: 'You guide students through a task while gradually reducing your support.',
    detail: 'Break a difficult concept into smaller steps, provide hints, examples, templates, or questions, and slowly let students work independently.',
    example: 'First solve a problem together, then solve one with hints, and finally ask students to solve one on their own.'
  },
  'active_learning': {
    title: 'Active Learning & Engagement',
    short: 'Students learn by actively doing something rather than only listening.',
    detail: 'Use questions, discussions, quizzes, demonstrations, problem-solving activities, or short exercises during the lesson.',
    example: 'Instead of lecturing for an hour, pause every 10–15 minutes for students to answer a question or solve a problem.'
  },
  'peer_instruction': {
    title: 'Peer Instruction & Critique',
    short: 'Students learn by explaining ideas to and evaluating the work of their classmates.',
    detail: 'Students discuss their answers, challenge reasoning, give feedback, and correct misunderstandings together.',
    example: 'Students answer a conceptual question individually, discuss their answer with a partner, and then answer again.'
  },
  'collaborative_learning': {
    title: 'Collaborative & Team Learning',
    short: 'Students work together in small groups to achieve a shared learning goal.',
    detail: 'Assign group tasks where students discuss, divide responsibilities, share knowledge, and produce something together.',
    example: 'Groups analyse a case study and jointly present their solution to the class.'
  },
  'problem_based_learning': {
    title: 'Problem-Based Learning (PBL)',
    short: 'Students learn by trying to solve a realistic, open-ended problem.',
    detail: 'Start with a problem rather than first teaching all the theory. Students identify what they need to learn, research it, and use their findings to develop a solution.',
    example: 'Give students a real-world engineering failure and ask them to determine why it happened and how to prevent it.'
  },
  'project_based_learning': {
    title: 'Project-Based Learning (PjBL)',
    short: 'Students learn by working on a substantial project that results in a real product, solution, or outcome.',
    detail: 'The project usually takes multiple classes or weeks and combines several skills or concepts.',
    example: 'Students design and build a working IoT system while applying programming, electronics, and data analysis.'
  },
  'inquiry_learning': {
    title: 'Inquiry & Investigation',
    short: 'Students learn by asking questions, investigating evidence, and discovering or testing explanations.',
    detail: 'Instead of immediately giving the answer, encourage students to formulate questions, collect information, conduct experiments, and draw conclusions.',
    example: 'Ask students why a particular material fails under certain conditions and have them design an experiment to investigate it.'
  },
  'flipped_classroom': {
    title: 'Flipped Classroom',
    short: 'Students learn basic content before class, and class time is used for application and discussion.',
    detail: 'Provide videos, readings, or other material for students to study beforehand. During class, focus on solving problems, activities, discussions, and addressing difficulties.',
    example: 'Students watch a 15-minute lecture video before class; classroom time is then spent solving problems with your guidance.'
  },
  'reflective_learning': {
    title: 'Reflective & Metacognitive Learning',
    short: 'Students consciously think about how they learn, what they understand, and where they need improvement.',
    detail: 'Ask students to reflect on their reasoning, mistakes, strategies, and progress.',
    example: 'After an assignment, ask students: "What did you find difficult?", "What mistake did you make?", and "What would you do differently next time?"'
  },

  // Ratings & Dimensions
  'capability_confidence': {
    title: 'Confidence in Primary Approach (1-5 Scale)',
    short: 'Your self-assessed confidence and skill level in planning and executing your primary teaching methodology.',
    detail: 'Rate how comfortable, skilled, and effective you feel when organizing and delivering your main teaching approach in class.',
    example: '1 = Low Confidence / Novice (needs prep support), 3 = Moderate / Competent, 5 = Highly Experienced Master.'
  },
  'interest_trying': {
    title: 'Openness to New Pedagogical Models (1-5 Scale)',
    short: 'Your eagerness to experiment with new or innovative teaching techniques.',
    detail: 'Reflects your willingness to try modern instructional models such as flipped classroom, peer instruction, or problem-based learning.',
    example: '1 = Prefer conventional traditional routines, 5 = Enthusiastic about trying new teaching frameworks.'
  },
  'willingness_change': {
    title: 'Willingness to Modify Course Design (1-5 Scale)',
    short: 'Your flexibility to adapt lesson plans, assessment formats, or teaching pace based on student evidence.',
    detail: 'Measures how open you are to refining course structure when student feedback (PES), learning analytics, or performance metrics suggest room for improvement.',
    example: '1 = Fixed rigid syllabus regardless of student data, 5 = Continuously refining course design based on student learning evidence.'
  },
  'workload_burden': {
    title: 'Workload Burden (1-5 Scale)',
    short: 'The extra effort, time, and administrative overhead required to execute a pedagogy.',
    detail: 'Measures resource stress including pre-class prep time, grading complexity, EdTech configuration, and classroom management effort.',
    example: '1 = Low extra burden (easy prep), 5 = High extra burden (heavy prep & grading time).'
  },
  'constraints': {
    title: 'Instructional Constraints',
    short: 'External or institutional challenges that limit instructional flexibility.',
    detail: 'Common constraints include large class sizes, fixed syllabus guidelines, missing student prerequisites, or rigid exam structures.',
    example: 'Teaching 120 students in a tiered lecture hall with fixed desks.'
  }
};

/**
 * Creates an interactive (i) button element.
 * @param {string} key - Dictionary key or custom content identifier
 * @param {string} [customTitle] - Optional inline title override
 * @param {string} [customText] - Optional inline explanation override
 */
export function createInfoButton(key, customTitle = '', customText = '') {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'info-btn';
  btn.setAttribute('aria-label', 'More information');
  btn.innerHTML = `<span class="info-icon">i</span>`;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showExplainerModal(key, customTitle, customText, btn);
  });

  return btn;
}

/**
 * Show explainer modal or popover.
 */
export function showExplainerModal(key, customTitle = '', customText = '', triggerEl = null) {
  // Remove existing modals if any
  document.querySelectorAll('.explainer-modal-container').forEach(el => el.remove());

  const keyLower = (key || '').toLowerCase();
  const dictInfo = EXPLAINER_DICTIONARY[keyLower] || {};

  const title = customTitle || dictInfo.title || key || 'Information & Context';
  const short = (dictInfo.short || customText || 'Additional details regarding this item.');
  const detail = dictInfo.detail || (customText && customText !== short ? customText : 'This option helps assess pedagogy alignment and student learning experience.');
  const example = dictInfo.example || '';

  const isMobile = window.innerWidth <= 768;

  const modalOverlay = document.createElement('div');
  modalOverlay.className = `explainer-modal-container ${isMobile ? 'mobile-sheet' : 'desktop-popover'}`;
  modalOverlay.innerHTML = `
    <div class="explainer-backdrop"></div>
    <div class="explainer-card page-enter" style="z-index: 100000;">
      <div class="explainer-header">
        <div class="explainer-title-group">
          <div class="explainer-badge">EXPLAINER</div>
          <h3 class="explainer-title">${title}</h3>
        </div>
        <button type="button" class="explainer-close-btn" aria-label="Close">&times;</button>
      </div>
      <div class="explainer-body">
        <p class="explainer-short">${short}</p>
        ${detail ? `<p class="explainer-detail">${detail}</p>` : ''}
        ${example ? `
          <div class="explainer-example-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:4px;"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
            <strong>Practical Example:</strong> ${example}
          </div>
        ` : ''}
      </div>
      <div class="explainer-footer">
        <button type="button" class="btn btn-primary btn-sm explainer-gotit-btn">Got it</button>
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);

  const card = modalOverlay.querySelector('.explainer-card');
  const backdrop = modalOverlay.querySelector('.explainer-backdrop');
  const closeBtn = modalOverlay.querySelector('.explainer-close-btn');
  const gotItBtn = modalOverlay.querySelector('.explainer-gotit-btn');

  if (!isMobile && triggerEl) {
    const rect = triggerEl.getBoundingClientRect();
    const cardWidth = Math.min(420, window.innerWidth - 32);

    card.style.position = 'fixed';
    card.style.width = `${cardWidth}px`;
    card.style.maxHeight = 'calc(100vh - 40px)';
    card.style.overflowY = 'auto';

    // Calculate height
    const cardHeight = card.offsetHeight || 300;

    let left = rect.left + (rect.width / 2) - (cardWidth / 2);
    let top = rect.bottom + 10;

    // If popping below overflows screen bottom, pop ABOVE trigger element
    if (top + cardHeight > window.innerHeight - 20) {
      top = rect.top - cardHeight - 10;
    }

    // Clamp inside viewport boundaries so modal is ALWAYS 100% visible
    if (top < 20) {
      top = Math.max(20, (window.innerHeight - cardHeight) / 2);
    }
    if (left + cardWidth > window.innerWidth - 16) {
      left = window.innerWidth - cardWidth - 16;
    }
    if (left < 16) left = 16;

    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  }

  const close = () => {
    card.classList.add('page-exit');
    modalOverlay.style.opacity = '0';
    setTimeout(() => modalOverlay.remove(), 200);
  };

  backdrop.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  gotItBtn.addEventListener('click', close);

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      close();
      window.removeEventListener('keydown', escHandler);
    }
  };
  window.addEventListener('keydown', escHandler);
}

/**
 * Helper to append an info button next to an HTML label element.
 */
export function attachInfoToLabel(labelSelector, key, title = '', text = '') {
  document.querySelectorAll(labelSelector).forEach(label => {
    if (label.querySelector('.info-btn')) return;
    const btn = createInfoButton(key, title, text);
    label.appendChild(btn);
  });
}

