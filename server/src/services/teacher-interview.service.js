/**
 * Teacher Interview Service — Groq-powered adaptive interview.
 *
 * Ports the core logic from teacherflow.py (v3.2) to JavaScript:
 * - PEDAGOGY_TAXONOMY (10 cores, 46 variants)
 * - Branch classification (6 branches)
 * - Pedagogy mix extraction (weighted multi-label)
 * - Coverage checklist + stopping rule
 * - Adaptive question generation
 */

import Groq from 'groq-sdk';

const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const MAX_INTERVIEW_TURNS = 5;
const DEBUG = process.env.APE_DEBUG === '1';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── LLM call wrapper ───────────────────────────────────────

async function llm(messages, temperature = 0.3) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await groq.chat.completions.create({
        model: MODEL,
        messages,
        temperature,
      });
      return resp.choices[0].message.content;
    } catch (err) {
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      throw new Error(`Groq call failed: ${err.message}`);
    }
  }
}

function safeJsonParse(text, fallback) {
  let t = text.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim();
  }

  try { return JSON.parse(t); } catch {}

  // Try extracting object or array
  const objStart = t.indexOf('{'), objEnd = t.lastIndexOf('}');
  const arrStart = t.indexOf('['), arrEnd = t.lastIndexOf(']');
  const candidates = [];

  if (objStart !== -1 && objEnd > objStart) candidates.push([objStart, t.slice(objStart, objEnd + 1)]);
  if (arrStart !== -1 && arrEnd > arrStart) candidates.push([arrStart, t.slice(arrStart, arrEnd + 1)]);

  candidates.sort((a, b) => a[0] - b[0]);
  for (const [, chunk] of candidates) {
    try { return JSON.parse(chunk); } catch {}
  }

  return fallback;
}

// ── Pedagogy Taxonomy ──────────────────────────────────────

export const PEDAGOGY_TAXONOMY = {
  direct_instruction: {
    label: 'Direct Instruction',
    definition: 'Deliver concepts through explicit teacher-led explanations and demonstrations for efficient foundational learning.',
    variants: {
      worked_examples: 'Demonstrate complete solutions to reduce cognitive load while learning new skills.',
      explicit_instruction: 'Teach concepts directly through clear explanations, modeling, and guided practice.',
      rule_example_recall_practice: 'Reinforce learning by introducing rules, showing examples, recalling knowledge, then practicing.',
      teacher_demonstration: 'Model procedures or skills before students attempt them independently.',
      step_by_step_demonstration: 'Break complex procedures into sequential, easy-to-follow stages.',
      immediate_corrective_feedback: 'Correct errors as they occur to reinforce accurate understanding.',
    },
  },
  guided_instruction: {
    label: 'Guided Instruction',
    definition: 'Support students with structured scaffolding while gradually transferring responsibility for learning.',
    variants: {
      strong_scaffolding: 'Provide extensive instructional support that is gradually removed as competence increases.',
      structured_remediation: 'Provide targeted support to address identified learning gaps.',
      mastery_based_sequencing: 'Progress learners only after demonstrating mastery of prerequisite concepts.',
      adaptive_reading_paths: 'Personalize reading sequences based on learner knowledge and progress.',
      prerequisite_matching: 'Ensure learners possess required prior knowledge before introducing advanced material.',
    },
  },
  active_learning: {
    label: 'Active Learning',
    definition: 'Engage students in activities that require active participation rather than passive listening.',
    variants: {
      peer_debate: 'Develop critical thinking by defending and evaluating competing viewpoints.',
      reciprocal_critique: 'Improve understanding through structured peer feedback and evaluation.',
      self_explanation: 'Strengthen comprehension by explaining concepts in one\'s own words.',
      concept_mapping: 'Organize and connect ideas visually to reveal conceptual relationships.',
      highlighting: 'Encourage active reading by identifying key information within learning materials.',
      note_taking: 'Improve retention by actively recording and organizing important information.',
      interactive_learning: 'Promote learning through dialogue, collaboration, and mutual knowledge construction.',
      constructive_learning: 'Require learners to generate new ideas, explanations, or solutions beyond the provided material.',
      discussion_based_learning: 'Develop understanding through structured classroom discussions and questioning.',
    },
  },
  peer_instruction: {
    label: 'Peer Instruction',
    definition: 'Improve understanding by having students explain, discuss, and critique concepts with peers.',
    variants: {},
  },
  collaborative_learning: {
    label: 'Collaborative Learning',
    definition: 'Develop knowledge through structured teamwork toward shared learning goals.',
    variants: {
      cooperative_learning: 'Structure teamwork so members depend on each other to achieve shared goals.',
      group_problem_solving: 'Solve challenging tasks collaboratively by combining diverse perspectives.',
      team_based_activities: 'Build knowledge through coordinated group tasks with shared accountability.',
      co_design: 'Create solutions collaboratively by involving learners in the design process.',
      small_group_discussion: 'Encourage deeper understanding through focused discussions in small groups.',
      peer_collaboration: 'Promote learning by working jointly with classmates on shared academic tasks.',
    },
  },
  problem_based_learning: {
    label: 'Problem-Based Learning (PBL)',
    definition: 'Build knowledge by solving authentic, complex, real-world problems before formal instruction.',
    variants: {
      productive_failure: 'Let students struggle with difficult problems before instruction to improve long-term understanding.',
      constructive_struggle: 'Encourage challenging but manageable effort that leads to meaningful learning.',
      authentic_problem_solving: 'Apply knowledge to realistic problems that mirror professional or real-world situations.',
      case_based_problems: 'Learn concepts by analyzing and solving realistic cases or scenarios.',
      challenge_first_learning: 'Present challenging tasks before teaching solutions to stimulate deeper thinking.',
    },
  },
  project_based_learning: {
    label: 'Project-Based Learning (PjBL)',
    definition: 'Learn by designing and completing substantial projects that produce meaningful outcomes.',
    variants: {
      authentic_projects: 'Engage learners in projects that solve meaningful real-world problems.',
      milestone_based_projects: 'Structure projects into incremental stages with regular progress checkpoints.',
      design_projects: 'Develop creativity and problem-solving through designing products or solutions.',
      capstone_style_projects: 'Integrate and demonstrate accumulated knowledge through a comprehensive final project.',
    },
  },
  inquiry_learning: {
    label: 'Inquiry Learning',
    definition: 'Encourage students to investigate questions, explore evidence, and construct their own understanding.',
    variants: {
      guided_inquiry: 'Support students in investigating questions while providing structured guidance.',
      discovery_learning: 'Allow learners to uncover concepts through exploration and experimentation.',
      student_led_investigation: 'Empower students to define, investigate, and analyze their own research questions.',
      question_based_learning: 'Drive learning through purposeful questioning and evidence gathering.',
      exploration_learning: 'Encourage experimentation and exploration to develop conceptual understanding.',
    },
  },
  flipped_classroom: {
    label: 'Flipped Classroom',
    definition: 'Move content delivery outside class so classroom time focuses on discussion and application.',
    variants: {},
  },
  reflective_learning: {
    label: 'Reflective Learning',
    definition: 'Deepen learning by encouraging students to analyze and reflect on their experiences and understanding.',
    variants: {
      learning_journals: 'Encourage continuous reflection by documenting learning experiences and insights.',
      structured_reflection: 'Guide learners to systematically evaluate their understanding and performance.',
      reflection_prompts: 'Stimulate metacognition using guided reflective questions.',
      self_assessment: 'Help learners evaluate their own progress, strengths, and areas for improvement.',
      metacognitive_reflection: 'Develop awareness and regulation of one\'s own thinking and learning strategies.',
    },
  },
};

function flattenTaxonomyForPrompt() {
  const lines = [];
  for (const [coreKey, core] of Object.entries(PEDAGOGY_TAXONOMY)) {
    lines.push(`- ${coreKey} ["${core.label}"]: ${core.definition}`);
    for (const [varKey, varDef] of Object.entries(core.variants)) {
      const varLabel = varKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      lines.push(`    - ${coreKey}.${varKey} ["${varLabel}"]: ${varDef}`);
    }
  }
  return lines.join('\n');
}

const TAXONOMY_PROMPT_BLOCK = flattenTaxonomyForPrompt();

/**
 * Get pedagogy labels for UI display (human-readable names).
 */
export function getPedagogyLabels() {
  const labels = {};
  for (const [key, core] of Object.entries(PEDAGOGY_TAXONOMY)) {
    labels[key] = core.label;
  }
  return labels;
}

// ── Branch Classification ──────────────────────────────────

const BRANCHES = {
  lecture_heavy: {
    triggers: ['explain', 'lecture', 'theory', 'board', 'slides', 'ppt', 'cover', 'step by step'],
    followups: [
      'What makes lecture the best fit for you in this course?',
      'Where, if at all, do students get to participate?',
      'What would stop you from using more active methods?',
      'Have you tried group work, problem solving, or projects before?',
    ],
  },
  mixed_method: {
    triggers: ['sometimes', 'depends', 'activity', 'both', 'mix', 'switch', 'balance'],
    followups: [
      'Which part of the class is lecture, and which is activity?',
      'How do you decide when to switch methods?',
      'Which method works best in this course?',
      'Which method is hardest to run consistently?',
    ],
  },
  active_learning: {
    triggers: ['group', 'project', 'problem', 'peer', 'discussion', 'debate', 'solve', 'hands-on'],
    followups: [
      'What kind of activity do you use most often?',
      'How do you structure and evaluate that activity?',
      'What usually goes well, and what breaks down?',
      'Would you use this more often if constraints were removed?',
    ],
  },
  tech_supported: {
    triggers: ['lms', 'video', 'quiz', 'simulation', 'online', 'tool', 'ai', 'digital', 'smart board'],
    followups: [
      'Which tools do you use regularly in this course?',
      'What does technology improve in your class?',
      'What prevents you from using more technology?',
    ],
  },
  constraint_heavy: {
    triggers: ['would like to but', 'no time', 'class size', 'too large', 'syllabus', 'rigid', 'cannot'],
    followups: [
      'What is the single biggest blocker?',
      'How does that blocker change what you do in class?',
      'What would be the easiest improvement to make?',
      'Which teaching method would you adopt first if this blocker improved?',
    ],
  },
  philosophy_heavy: {
    triggers: ['autonomy', 'discipline', 'understanding', 'real-world', 'application', 'deep', 'values'],
    followups: [
      'What matters most to you in teaching?',
      'Do you see yourself more as a guide or a source of knowledge?',
      'What kind of learning outcome do you value most?',
    ],
  },
};

/**
 * Classify the teacher's narrative into a branch using LLM.
 */
export async function classifyBranch(narrative) {
  const branchDescriptions = Object.entries(BRANCHES)
    .map(([key, b]) => `- ${key}: triggers on keywords like ${b.triggers.slice(0, 4).join(', ')}`)
    .join('\n');

  const prompt = `Classify this faculty member's description of their teaching into exactly one branch.

Branches:
${branchDescriptions}

Description: "${narrative}"

Reply with JSON only: {"branch": "<branch_key>", "reason": "<one sentence why>"}`;

  const out = await llm([{ role: 'user', content: prompt }]);
  if (DEBUG) console.log('[debug] branch classification:', out);
  const parsed = safeJsonParse(out, { branch: 'lecture_heavy', reason: 'default fallback' });
  return parsed;
}

/**
 * Classify the pedagogy mix from a teaching narrative.
 */
export async function classifyPedagogyMix(narrative, priorMix = null) {
  let priorBlock = '';
  if (priorMix && priorMix.length > 0) {
    priorBlock = `Pedagogy weights from prior turns (refine, don't discard):\n${JSON.stringify(priorMix, null, 2)}\n\n`;
  }

  const prompt = `Classify this faculty member's teaching description using ONLY the closed taxonomy below.

TAXONOMY:
${TAXONOMY_PROMPT_BLOCK}

${priorBlock}Teaching description:
"${narrative}"

Return a JSON array. Each element is one pedagogy with real evidence (usually 1-4):
{
  "core": "<core_key from taxonomy>",
  "variant": "<variant key or null>",
  "weight": <float 0-1>,
  "band": "<no_evidence|self_report_only|partial_evidence|corroborated_evidence>",
  "rationale": "<specific words that justify this>"
}
Reply with the JSON array only.`;

  const out = await llm([{ role: 'user', content: prompt }]);
  if (DEBUG) console.log('[debug] pedagogy mix:', out);
  let parsed = safeJsonParse(out, []);

  // Recover wrapped arrays
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const listVal = Object.values(parsed).find(v => Array.isArray(v));
    if (listVal) parsed = listVal;
    else if (parsed.core) parsed = [parsed];
    else parsed = [];
  }
  if (!Array.isArray(parsed)) parsed = [];

  // Clean and validate
  return parsed.filter(item => {
    if (!item || typeof item !== 'object') return false;
    return item.core && PEDAGOGY_TAXONOMY[item.core];
  }).map(item => ({
    core: item.core,
    coreLabel: PEDAGOGY_TAXONOMY[item.core].label,
    variant: item.variant && PEDAGOGY_TAXONOMY[item.core].variants[item.variant] ? item.variant : null,
    weight: Math.max(0, Math.min(1, parseFloat(item.weight) || 0.3)),
    band: item.band || 'self_report_only',
    rationale: (item.rationale || '').slice(0, 200),
  }));
}

/**
 * Merge pedagogy mixes across turns (keep higher weight per core+variant pair).
 */
export function mergePedagogyMix(oldMix, newMix) {
  const byKey = {};
  for (const m of (oldMix || [])) byKey[`${m.core}|${m.variant}`] = m;
  for (const m of (newMix || [])) {
    const key = `${m.core}|${m.variant}`;
    if (!byKey[key] || m.weight > byKey[key].weight) byKey[key] = m;
  }
  return Object.values(byKey).sort((a, b) => b.weight - a.weight);
}

// ── Coverage Checklist ─────────────────────────────────────

const COVERAGE_FIELDS = {
  dominant_method: false,
  secondary_method: false,
  participation_level: false,
  pedagogical_orientation: false,
  capability: false,
  constraints: false,
  assessment: false,
  change_readiness: false,
};

/**
 * Extract coverage status from interview turns using LLM.
 */
export async function extractCoverage(allTurns) {
  const transcript = allTurns.map(t => `Q: ${t.question}\nA: ${t.answer}`).join('\n\n');

  const prompt = `Based on this faculty interview transcript, determine which of these fields have been covered with concrete evidence:

Transcript:
${transcript}

Fields to check:
- dominant_method: Is the teacher's primary classroom method identified?
- secondary_method: Is a secondary method identified?
- participation_level: Is the level of student participation clear?
- pedagogical_orientation: Is the teacher's philosophy/orientation clear?
- capability: Is their confidence in active/new methods clear?
- constraints: Are the main teaching constraints/blockers clear?
- assessment: Is the assessment approach identified?
- change_readiness: Is their openness to changing methods clear?

Reply with JSON only: {"dominant_method": true/false, "secondary_method": true/false, ...}`;

  const out = await llm([{ role: 'user', content: prompt }]);
  const parsed = safeJsonParse(out, COVERAGE_FIELDS);

  // Count covered
  const fields = { ...COVERAGE_FIELDS };
  for (const key of Object.keys(fields)) {
    fields[key] = parsed[key] === true;
  }

  return fields;
}

/**
 * Check if enough coverage fields are filled (6 of 8 = stop).
 */
export function isCoverageComplete(coverage) {
  const covered = Object.values(coverage).filter(Boolean).length;
  return covered >= 6;
}

// ── Adaptive Question Selection ────────────────────────────

const EXTRA_PROBES = [
  { category: 'assessment', question: 'How do you usually assess whether students actually learned something in this course?' },
  { category: 'philosophy', question: 'What matters most to you in teaching this course, if you had to pick one thing?' },
  { category: 'technology', question: 'What tools, if any, do you lean on day to day in this course?' },
];

/**
 * Generate the next interview question based on branch, coverage, and turn history.
 */
export function getNextQuestion(branch, turnIndex, coverage, previousTurns) {
  const branchConfig = BRANCHES[branch] || BRANCHES.lecture_heavy;

  // First, exhaust branch-specific follow-ups
  if (turnIndex < branchConfig.followups.length) {
    return {
      question: branchConfig.followups[turnIndex],
      source: 'branch_followup',
    };
  }

  // Then fill coverage gaps with extra probes
  for (const probe of EXTRA_PROBES) {
    const alreadyAsked = previousTurns.some(t =>
      t.question.toLowerCase().includes(probe.category)
    );
    if (!alreadyAsked && !coverage[probe.category]) {
      return {
        question: probe.question,
        source: 'coverage_probe',
      };
    }
  }

  // Coverage complete or max turns reached
  return null;
}

// ── Extract Final Profile ──────────────────────────────────

/**
 * Extract structured teacher profile labels from the full interview transcript.
 */
export async function extractTeacherProfile(allTurns) {
  const transcript = allTurns.map(t => `Q: ${t.question}\nA: ${t.answer}`).join('\n\n');

  const prompt = `Based on this faculty interview transcript, extract a structured profile.

Transcript:
${transcript}

Return JSON with these fields (use short 3-6 word labels for values, and confidence 0.0-1.0):
{
  "dominant_pedagogy": {"value": "...", "confidence": 0.0},
  "secondary_pedagogy": {"value": "...", "confidence": 0.0},
  "teaching_practice": {"value": "...", "confidence": 0.0},
  "constraints": {"value": "...", "confidence": 0.0},
  "capability": {"value": "...", "confidence": 0.0},
  "interest": {"value": "...", "confidence": 0.0},
  "assessment": {"value": "...", "confidence": 0.0},
  "philosophy": {"value": "...", "confidence": 0.0},
  "technology": {"value": "...", "confidence": 0.0},
  "change_readiness": {"value": "...", "confidence": 0.0}
}
Reply with JSON only.`;

  const out = await llm([{ role: 'user', content: prompt }]);
  if (DEBUG) console.log('[debug] extracted profile:', out);
  return safeJsonParse(out, {});
}

/**
 * Process one interview turn: classify pedagogy mix, check coverage, decide next step.
 * Returns { pedagogyMix, coverage, nextQuestion, branch, isComplete, interviewProfile }
 */
export async function processInterviewTurn(
  turnIndex, branch, question, answer,
  previousTurns, currentPedagogyMix
) {
  // Combine all answers for pedagogy classification
  const allText = [...previousTurns.map(t => t.answer), answer].join('\n');

  // Classify pedagogy mix
  const newMix = await classifyPedagogyMix(answer, currentPedagogyMix);
  const mergedMix = mergePedagogyMix(currentPedagogyMix, newMix);

  // Build turn list for coverage check
  const allTurns = [...previousTurns, { question, answer }];

  // Check coverage
  const coverage = await extractCoverage(allTurns);
  const coverageComplete = isCoverageComplete(coverage);

  // Decide next question
  let nextQuestion = null;
  let isComplete = false;
  let interviewProfile = null;

  if (coverageComplete || turnIndex >= MAX_INTERVIEW_TURNS - 1) {
    isComplete = true;
    interviewProfile = await extractTeacherProfile(allTurns);
  } else {
    const next = getNextQuestion(branch, turnIndex + 1, coverage, allTurns);
    if (next) {
      nextQuestion = next.question;
    } else {
      isComplete = true;
      interviewProfile = await extractTeacherProfile(allTurns);
    }
  }

  return {
    pedagogyMix: mergedMix,
    coverage,
    nextQuestion,
    branch,
    isComplete,
    interviewProfile,
    llmClassification: { mix: newMix, coverage },
  };
}

/**
 * Get the root interview prompt for a subject.
 */
export function getRootPrompt(subjectName) {
  return `Walk me through a typical class in ${subjectName} from start to finish.`;
}
