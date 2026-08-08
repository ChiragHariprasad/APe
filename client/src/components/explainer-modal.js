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
  'active_learning': {
    title: 'Active Learning & Engagement',
    short: 'Students actively participate through hands-on activities, discussions, or problem solving.',
    detail: 'Instead of sitting passively during lectures, students solve short problems, debate concepts, work in pairs, or answer interactive polls in class.',
    example: '5-minute think-pair-share exercises during a theory lecture.'
  },
  'direct_instruction': {
    title: 'Direct Instruction / Explicit Teaching',
    short: 'Teacher-led structured instruction focused on clear explanations and step-by-step guidance.',
    detail: 'The instructor explains concepts directly, presents worked examples on the board/slides, and guides students through practice problems step by step.',
    example: 'Standard 50-minute lecture explaining formula derivations with board work.'
  },
  'guided_instruction': {
    title: 'Guided Instruction & Scaffolding',
    short: 'Providing structured temporary support that is gradually removed as student competence grows.',
    detail: 'The teacher gives templates, hints, and step-by-step prompt sheets initially, then gradually lets students work independently.',
    example: 'Starting a lab exercise with pre-written code skeletons before giving blank files.'
  },
  'peer_instruction': {
    title: 'Peer Instruction & Critique',
    short: 'Students teach and discuss concepts with peers to reinforce understanding.',
    detail: 'A concept question is posed, students answer individually, then discuss differences with a peer next to them before voting again.',
    example: 'Mazur\'s Peer Instruction method with clickers or raised hands.'
  },
  'collaborative_learning': {
    title: 'Collaborative & Team Learning',
    short: 'Students work together in small groups towards a shared academic goal.',
    detail: 'Fosters team communication and collective problem solving by assigning specific group roles or team deliverables.',
    example: 'Group assignment requiring a joint technical report and presentation.'
  },
  'problem_based_learning': {
    title: 'Problem-Based Learning (PBL)',
    short: 'Learning centered around solving open-ended, real-world problems.',
    detail: 'Students are given a realistic engineering scenario or case study before learning the theory, driving their own need to discover the underlying concepts.',
    example: '"Design a flood-warning sensor network for a river prone to overflowing."'
  },
  'project_based_learning': {
    title: 'Project-Based Learning (PjBL)',
    short: 'Long-term extended projects resulting in a functional prototype or product.',
    detail: 'Students work over several weeks or a full semester to produce a working system, prototype, software application, or hardware model.',
    example: 'Semester-long capstone project building an autonomous robot.'
  },
  'inquiry_learning': {
    title: 'Inquiry & Investigation',
    short: 'Students pose questions, conduct research, and gather evidence to form conclusions.',
    detail: 'Emphasizes curiosity and analytical investigation. Students analyze raw datasets or conduct experiments to formulate hypotheses.',
    example: 'Analyzing traffic flow dataset to discover bottlenecks without prior solutions given.'
  },
  'flipped_classroom': {
    title: 'Flipped Classroom',
    short: 'Direct content is reviewed at home; in-class time is spent on application and discussion.',
    detail: 'Students watch video lectures or read course materials prior to class. Lecture hours are then dedicated exclusively to solving hard problems and Q&A.',
    example: 'Reading Chapter 4 before class so class time is spent entirely on problem solving.'
  },
  'reflective_learning': {
    title: 'Reflective & Metacognitive Learning',
    short: 'Students analyze their own learning process, mistakes, and problem-solving strategies.',
    detail: 'Encourages self-awareness by having students write short learning reflection logs or post-exam diagnostic analyses.',
    example: 'Writing a 3-sentence summary of "What was hardest to understand today and why?".'
  },

  // Ratings & Dimensions
  'capability_confidence': {
    title: 'Capability Confidence (1-5 Scale)',
    short: 'Your self-assessed skill level in planning and executing interactive teaching strategies.',
    detail: 'Rate how comfortable and skilled you feel when organizing active learning, group work, or interactive classroom techniques.',
    example: '1 = Novice / Hesitant, 3 = Moderate, 5 = Highly Experienced Expert.'
  },
  'willingness_change': {
    title: 'Willingness to Change (1-5 Scale)',
    short: 'Your openness to modifying lesson plans, assessment styles, or classroom delivery.',
    detail: 'Measures how eager or open you are to trying new instructional methods or altering existing course schedules.',
    example: '1 = Prefer existing fixed routine, 5 = Eager to experiment with new methods.'
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
  const short = customText || dictInfo.short || 'Additional details regarding this item.';
  const detail = dictInfo.detail || 'This metric or option helps assess pedagogy alignment and student learning experience.';
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
    const cardWidth = 360;
    let left = rect.left + window.scrollX - (cardWidth / 2) + 12;
    let top = rect.bottom + window.scrollY + 8;

    if (left + cardWidth > window.innerWidth - 16) {
      left = window.innerWidth - cardWidth - 16;
    }
    if (left < 16) left = 16;

    card.style.position = 'absolute';
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
