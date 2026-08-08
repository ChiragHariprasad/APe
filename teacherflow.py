"""
APE v3.2 -- Adaptive Faculty Pedagogy Interview
==============================================

CHANGES IN v3.2 (this patch, on top of v3.1):

FIX C -- TAXONOMY WORDING MADE VERBATIM.
   Diffed PEDAGOGY_TAXONOMY against your full reference table. Structurally
   nothing was missing -- all 10 cores and all 46 variants were already
   present with matching keys. But almost every definition string had been
   quietly reworded/shortened during the original build (e.g. "Support
   students investigating questions..." instead of your "Support students
   IN investigating questions..."). Since these definitions are what the
   LLM classifies teaching narratives against, every single definition
   below has been replaced with your exact wording, verbatim, not
   re-paraphrased. The "STILL OPEN" note from v3 is removed.

FIX D -- STALL-DETECTION ON THE DISAMBIGUATION LOOP.
   This is the actual cause of the "stuck in a loop" feeling in your
   transcript, separate from the v3.1 JSON-parsing bug. Previously,
   ambiguous_pedagogies() always returned the same top candidate, and
   generate_disambiguation_question() always produced the exact same
   wording for it, every turn. If the teacher's answer didn't move that
   pedagogy's weight (e.g. a near-identical paraphrase of a prior answer),
   the SAME question was reprinted verbatim, turn after turn, up to
   MAX_FOLLOWUPS_PER_SUBJECT -- which is exactly what your AIML transcript
   shows. Fixed: after each follow-up, if the target pedagogy's weight
   moved by less than STALL_EPSILON, it's marked "stalled" and skipped for
   the rest of this subject's interview -- its last classified weight is
   accepted as final rather than being re-asked about identically.

FIX E -- QUIZ CLARIFICATION NOW ALSO CHECKED AT THE ASSESSMENT QUESTION.
   maybe_ask_quiz_clarification() previously fired exactly once, right
   after the opening "walk me through a class" narrative (checked against
   that narrative + the constraint/blocker text only). If "quiz" was never
   mentioned there but came up for the first time in the "how do you
   assess" answer, it was never clarified -- it would just fall back on
   the compulsory-vs-deliberate rule's conservative default
   (self_report_only) inside the LLM prompt, silently, instead of asking.
   Fixed: the assessment turn now checks its own answer text for "quiz"
   if it wasn't already resolved, and asks the clarification question
   right there before scoring.

Everything else (FIX A -- the array/JSON parsing bug, FIX B -- the CIE/EL/
PBL glossary + compulsory-vs-deliberate weighting, the Groq call wrapper,
course-catalog matching, the confidence-threshold / turn-cap stopping
rule) is carried over unchanged from v3.1.

Setup:
    pip install groq
    export GROQ_API_KEY="your_free_key_from_console.groq.com"
    # optional:
    export GROQ_MODEL="openai/gpt-oss-120b"
    export APE_DEBUG=1   # print raw LLM JSON output before parsing, for debugging

Run (course_knowledge.json must sit next to this file):
    python faculty_interview_v3.py
"""

import os
import re
import sys
import json
import time
from groq import Groq
from groq import APIError, RateLimitError

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")
CONFIDENCE_THRESHOLD = 0.85
MAX_FOLLOWUPS_PER_SUBJECT = 5
MAX_EXTRA_TURNS = 3
STALL_EPSILON = 0.05  # v3.2: min weight movement to NOT count a follow-up as stalled
DEBUG = os.environ.get("APE_DEBUG", "0") == "1"
COURSE_KNOWLEDGE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                      "course_knowledge.json")

# Categories asked ONCE, about the teacher as a person (dispositional).
TEACHER_CATEGORIES = ["capability", "interest", "technology"]
# Categories collected PER SUBJECT (practice, not disposition).
COURSE_CATEGORIES = ["pedagogy_mix", "constraints", "assessment", "context",
                     "philosophy", "evidence"]
REQUIRED_COURSE_CATEGORIES = ["pedagogy_mix", "constraints", "assessment"]

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))


def llm(messages, temperature=0.3, retries=2):
    """Call Groq chat completions with a couple of retries on transient errors."""
    last_err = None
    for attempt in range(retries + 1):
        try:
            resp = client.chat.completions.create(
                model=MODEL, messages=messages, temperature=temperature
            )
            return resp.choices[0].message.content
        except RateLimitError as e:
            last_err = e
            time.sleep(2 * (attempt + 1))
        except APIError as e:
            last_err = e
            time.sleep(1)
    raise RuntimeError(f"Groq call failed after retries: {last_err}")


def safe_json_parse(text, fallback):
    """Models sometimes wrap JSON in markdown fences, add stray prose, or wrap
    a bare array in an outer object -- strip and parse defensively.

    v3.1 FIX: the old version sliced from the first "{" to the last "}" and
    THEN searched that already-sliced string for "[" / "]". For a top-level
    JSON array of more than one object, that destroyed the enclosing
    brackets before the array-recovery path ever got a chance to run. Fixed
    by (1) trying the raw text first, then (2) building an object-slice
    candidate and an array-slice candidate INDEPENDENTLY from the ORIGINAL
    text, and trying whichever one starts earliest first.
    """
    t = text.strip()
    if t.startswith("```"):
        t = t.strip("`")
        if "\n" in t:
            first_line, rest = t.split("\n", 1)
            t = rest if first_line.strip().lower() in ("json", "") else t
    t = t.strip()

    # 1) try the whole (fence-stripped) text as-is.
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        pass

    # 2) try an object-candidate and an array-candidate independently, both
    #    computed from the same original `t` -- never from each other.
    candidates = []
    obj_start, obj_end = t.find("{"), t.rfind("}")
    if obj_start != -1 and obj_end != -1 and obj_end > obj_start:
        candidates.append((obj_start, t[obj_start:obj_end + 1]))
    arr_start, arr_end = t.find("["), t.rfind("]")
    if arr_start != -1 and arr_end != -1 and arr_end > arr_start:
        candidates.append((arr_start, t[arr_start:arr_end + 1]))

    for _, chunk in sorted(candidates, key=lambda c: c[0]):
        try:
            return json.loads(chunk)
        except json.JSONDecodeError:
            continue
    return fallback


# ---------------------------------------------------------------------------
# Confidence rubric -- fixed evidence bands, used for EVERY score in the app.
# ---------------------------------------------------------------------------

CONFIDENCE_BANDS = [
    (0.00, 0.29, "no_evidence",
     "Category not addressed, or the answer was off-topic."),
    (0.30, 0.59, "self_report_only",
     "A rating, label, or preference was stated with no concrete classroom "
     "example (e.g. a questionnaire Likert answer on its own), OR the only "
     "evidence available is something institutionally mandated (see the "
     "compulsory-vs-deliberate rule below) rather than a teaching choice."),
    (0.60, 0.84, "partial_evidence",
     "A concrete example, mechanism, or named behaviour was given, but only "
     "once, or without detail on frequency/consistency."),
    (0.85, 1.00, "corroborated_evidence",
     "At least two independent statements (e.g. the narrative AND the "
     "evidence prompt, or the narrative AND a follow-up) describe the same "
     "practice with consistent, concrete detail: what is done, how often, "
     "with what result."),
]

CONFIDENCE_RUBRIC_TEXT = "\n".join(
    f"  {lo:.2f}-{hi:.2f}  [{name}]  {desc}" for lo, hi, name, desc in CONFIDENCE_BANDS
)


def band_for(confidence):
    for lo, hi, name, desc in CONFIDENCE_BANDS:
        if lo - 1e-9 <= confidence <= hi + 1e-9:
            return name, desc
    return "no_evidence", CONFIDENCE_BANDS[0][3]


def band_bounds(band_name):
    for lo, hi, name, _ in CONFIDENCE_BANDS:
        if name == band_name:
            return lo, hi
    return 0.0, 0.29


def self_report_confidence(rating_1_to_5):
    """Map a 1-5 Likert self-rating linearly onto the self_report_only band
    (0.30-0.59)."""
    lo, hi = band_bounds("self_report_only")
    rating_1_to_5 = max(1, min(5, rating_1_to_5))
    return round(lo + (rating_1_to_5 - 1) * (hi - lo) / 4, 3)


def validate_confidence(confidence, claimed_band):
    """Never trust a model-assigned confidence blindly: clip it back inside
    the band it claims to be justified by."""
    lo, hi = band_bounds(claimed_band)
    return round(max(lo, min(hi, confidence)), 3)


# ---------------------------------------------------------------------------
# Institutional term glossary + compulsory-vs-deliberate weighting.
# ---------------------------------------------------------------------------
# CIE/EL/PBL are institution-specific acronyms a generic LLM has no reason to
# know. Expanding them inline before they hit any prompt means the model
# scores against what they actually mean, not a bare three-letter label.

ACADEMIC_TERM_GLOSSARY = {
    "CIE": {
        "expansion": "Cumulative Internal Exams",
        "meaning": ("official exams held by the college roughly every four weeks; "
                    "these internal marks add up with the semester-end/final result "
                    "to determine credit"),
        "compulsory": True,
    },
    "EL": {
        "expansion": "Experiential Learning",
        "meaning": "a compulsory project component required for this subject or a group of subjects",
        "compulsory": True,
    },
    "PBL": {
        "expansion": "Project-Based Learning",
        "meaning": "a compulsory project component used for lab subjects",
        "compulsory": True,
    },
}


def expand_glossary_terms(text):
    """Annotate recognised institutional acronyms inline with their full
    meaning (first mention only), so downstream LLM prompts see what
    CIE/EL/PBL actually mean instead of a bare acronym with no institutional
    context. Storage/printing elsewhere still uses the original raw text."""
    if not text:
        return text
    expanded = text
    for term, info in ACADEMIC_TERM_GLOSSARY.items():
        pattern = re.compile(rf"\b{re.escape(term)}\b", re.IGNORECASE)
        if pattern.search(expanded):
            tag = f"{term} ({info['expansion']}: {info['meaning']})"
            expanded = pattern.sub(tag, expanded, count=1)
    return expanded


COMPULSORY_VS_DELIBERATE_RULE = """
COMPULSORY-VS-DELIBERATE EVIDENCE RULE (apply to every score you assign):
Some things a teacher mentions are INSTITUTIONALLY MANDATED, not a personal
teaching choice -- e.g. CIE exams, the compulsory EL (Experiential Learning)
project, a PBL project required for a lab subject, or a "quiz" that turns
out to just be the CIE quiz component. Evidence that comes ONLY from a
compulsory/mandated component reflects college policy, not the teacher's
own pedagogy, so cap it at the self_report_only band (max 0.59) no matter
how much detail is given.
Evidence from something the teacher chose to do voluntarily on top of what
is required (an extra pop quiz, an optional oral viva, ungraded debates, an
in-class discussion nobody mandated) is genuine pedagogical signal and
should be scored normally -- it can reach partial_evidence or
corroborated_evidence on its own merit, even if it is "just" an oral exam or
a pop quiz.
If it is unclear whether a mentioned "quiz" is the compulsory CIE quiz or a
separate quiz the teacher runs themselves, say so explicitly in "why" and do
not assume -- treat it as self_report_only until clarified.
"""

QUIZ_CLARIFICATION_Q = (
    "Just to make sure I score this right: when you say 'quiz', do you mean\n"
    "  A) the compulsory CIE quiz component\n"
    "  B) a separate quiz/pop-quiz you run yourself, on top of that\n"
    "  C) both"
)

QUIZ_TYPE_LABELS = {
    "A": ("compulsory_cie_quiz",
          "The quiz mentioned is the compulsory CIE quiz component (institutionally mandated)."),
    "B": ("deliberate_quiz",
          "The quiz mentioned is a separate quiz the teacher runs themselves (not institutionally mandated)."),
    "C": ("both",
          "Quizzes here include both the compulsory CIE quiz component and a separate quiz the teacher runs themselves."),
}


def maybe_ask_quiz_clarification(course_answers, narrative_text=""):
    """Triggered whenever 'quiz' shows up in the chosen activities or in free
    text. Returns (quiz_type_key, context_note) or (None, None)."""
    combined = " ".join([course_answers.get("blocker", ""), narrative_text]).lower()
    mentioned = "quizzes" in course_answers.get("activities", []) or "quiz" in combined
    if not mentioned:
        return None, None
    print(f"\n{QUIZ_CLARIFICATION_Q}")
    while True:
        raw = input("> ").strip().upper()[:1]
        if raw in QUIZ_TYPE_LABELS:
            key, note = QUIZ_TYPE_LABELS[raw]
            return key, note
        print("  enter A, B, or C")


# ---------------------------------------------------------------------------
# Pedagogy taxonomy -- closed set. v3.2: definitions are now VERBATIM from
# the supplied reference table (structure/keys were already complete in
# v3.1 -- diffed all 10 cores / 46 variants, nothing was missing -- but the
# wording had drifted during the original build, so it's been replaced
# here 1:1 rather than left paraphrased).
# ---------------------------------------------------------------------------

PEDAGOGY_TAXONOMY = {
    "direct_instruction": {
        "label": "Direct Instruction",
        "definition": "Deliver concepts through explicit teacher-led explanations and demonstrations for efficient foundational learning.",
        "variants": {
            "worked_examples": "Demonstrate complete solutions to reduce cognitive load while learning new skills.",
            "explicit_instruction": "Teach concepts directly through clear explanations, modeling, and guided practice.",
            "rule_example_recall_practice": "Reinforce learning by introducing rules, showing examples, recalling knowledge, then practicing.",
            "teacher_demonstration": "Model procedures or skills before students attempt them independently.",
            "step_by_step_demonstration": "Break complex procedures into sequential, easy-to-follow stages.",
            "immediate_corrective_feedback": "Correct errors as they occur to reinforce accurate understanding.",
        },
    },
    "guided_instruction": {
        "label": "Guided Instruction",
        "definition": "Support students with structured scaffolding while gradually transferring responsibility for learning.",
        "variants": {
            "strong_scaffolding": "Provide extensive instructional support that is gradually removed as competence increases.",
            "structured_remediation": "Provide targeted support to address identified learning gaps.",
            "mastery_based_sequencing": "Progress learners only after demonstrating mastery of prerequisite concepts.",
            "adaptive_reading_paths": "Personalize reading sequences based on learner knowledge and progress.",
            "prerequisite_matching": "Ensure learners possess required prior knowledge before introducing advanced material.",
        },
    },
    "active_learning": {
        "label": "Active Learning",
        "definition": "Engage students in activities that require active participation rather than passive listening.",
        "variants": {
            "peer_debate": "Develop critical thinking by defending and evaluating competing viewpoints.",
            "reciprocal_critique": "Improve understanding through structured peer feedback and evaluation.",
            "self_explanation": "Strengthen comprehension by explaining concepts in one's own words.",
            "concept_mapping": "Organize and connect ideas visually to reveal conceptual relationships.",
            "highlighting": "Encourage active reading by identifying key information within learning materials.",
            "note_taking": "Improve retention by actively recording and organizing important information.",
            "interactive_learning": "Promote learning through dialogue, collaboration, and mutual knowledge construction.",
            "constructive_learning": "Require learners to generate new ideas, explanations, or solutions beyond the provided material.",
            "passive_learning": "Acquire information primarily through listening, observing, or reading without active "
                                 "engagement (anchor point at the low-engagement end of this category, not a method to encourage).",
            "discussion_based_learning": "Develop understanding through structured classroom discussions and questioning.",
        },
    },
    "peer_instruction": {
        "label": "Peer Instruction",
        "definition": "Improve understanding by having students explain, discuss, and critique concepts with peers.",
        "variants": {},
    },
    "collaborative_learning": {
        "label": "Collaborative Learning",
        "definition": "Develop knowledge through structured teamwork toward shared learning goals.",
        "variants": {
            "cooperative_learning": "Structure teamwork so members depend on each other to achieve shared goals.",
            "group_problem_solving": "Solve challenging tasks collaboratively by combining diverse perspectives.",
            "team_based_activities": "Build knowledge through coordinated group tasks with shared accountability.",
            "co_design": "Create solutions collaboratively by involving learners in the design process.",
            "small_group_discussion": "Encourage deeper understanding through focused discussions in small groups.",
            "peer_collaboration": "Promote learning by working jointly with classmates on shared academic tasks.",
        },
    },
    "problem_based_learning": {
        "label": "Problem-Based Learning (PBL)",
        "definition": "Build knowledge by solving authentic, complex, real-world problems before formal instruction.",
        "variants": {
            "productive_failure": "Let students struggle with difficult problems before instruction to improve long-term understanding.",
            "constructive_struggle": "Encourage challenging but manageable effort that leads to meaningful learning.",
            "authentic_problem_solving": "Apply knowledge to realistic problems that mirror professional or real-world situations.",
            "case_based_problems": "Learn concepts by analyzing and solving realistic cases or scenarios.",
            "challenge_first_learning": "Present challenging tasks before teaching solutions to stimulate deeper thinking.",
        },
    },
    "project_based_learning": {
        "label": "Project-Based Learning (PjBL)",
        "definition": "Learn by designing and completing substantial projects that produce meaningful outcomes.",
        "variants": {
            "authentic_projects": "Engage learners in projects that solve meaningful real-world problems.",
            "milestone_based_projects": "Structure projects into incremental stages with regular progress checkpoints.",
            "design_projects": "Develop creativity and problem-solving through designing products or solutions.",
            "capstone_style_projects": "Integrate and demonstrate accumulated knowledge through a comprehensive final project.",
        },
    },
    "inquiry_learning": {
        "label": "Inquiry Learning",
        "definition": "Encourage students to investigate questions, explore evidence, and construct their own understanding.",
        "variants": {
            "guided_inquiry": "Support students in investigating questions while providing structured guidance.",
            "discovery_learning": "Allow learners to uncover concepts through exploration and experimentation.",
            "student_led_investigation": "Empower students to define, investigate, and analyze their own research questions.",
            "question_based_learning": "Drive learning through purposeful questioning and evidence gathering.",
            "exploration_learning": "Encourage experimentation and exploration to develop conceptual understanding.",
        },
    },
    "flipped_classroom": {
        "label": "Flipped Classroom",
        "definition": "Move content delivery outside class so classroom time focuses on discussion and application.",
        "variants": {},
    },
    "reflective_learning": {
        "label": "Reflective Learning",
        "definition": "Deepen learning by encouraging students to analyze and reflect on their experiences and understanding.",
        "variants": {
            "learning_journals": "Encourage continuous reflection by documenting learning experiences and insights.",
            "structured_reflection": "Guide learners to systematically evaluate their understanding and performance.",
            "reflection_prompts": "Stimulate metacognition using guided reflective questions.",
            "self_assessment": "Help learners evaluate their own progress, strengths, and areas for improvement.",
            "metacognitive_reflection": "Develop awareness and regulation of one's own thinking and learning strategies.",
        },
    },
}


def flatten_taxonomy_for_prompt():
    lines = []
    for core_key, core in PEDAGOGY_TAXONOMY.items():
        lines.append(f'- {core_key} ["{core["label"]}"]: {core["definition"]}')
        for var_key, var_def in core["variants"].items():
            lines.append(f'    - {core_key}.{var_key} ["{var_key.replace("_", " ").title()}"]: {var_def}')
    return "\n".join(lines)


TAXONOMY_PROMPT_BLOCK = flatten_taxonomy_for_prompt()


# ---------------------------------------------------------------------------
# Course knowledge -- load + match (faculty field is never read)
# ---------------------------------------------------------------------------

def load_course_knowledge(path=COURSE_KNOWLEDGE_PATH):
    """Flatten course_knowledge.json into {code: [subject variants]}, ignoring
    "faculty" entirely, at any nesting depth. Any dict with a "subject" key
    is treated as a leaf course entry."""
    try:
        with open(path) as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"\n(course_knowledge.json not found at {path} -- "
              f"course matching disabled, will use free text as-is)\n")
        return {}

    catalog = {}

    def walk(node):
        if not isinstance(node, dict):
            return
        for key, val in node.items():
            if isinstance(val, dict) and "subject" in val:
                catalog.setdefault(key, set()).add(val["subject"])
            elif isinstance(val, dict):
                walk(val)

    walk(data)
    return {code: sorted(subjects) for code, subjects in catalog.items()}


def resolve_variant(code, subjects):
    if len(subjects) == 1:
        return code, subjects[0]
    print(f"\n\"{code}\" matches more than one catalog entry:")
    for i, s in enumerate(subjects, 1):
        print(f"  {i}) {s}")
    while True:
        raw = input("Which one? > ").strip()
        if raw.isdigit() and 1 <= int(raw) <= len(subjects):
            return code, subjects[int(raw) - 1]
        print(f"  enter a number 1-{len(subjects)}")


def find_course_match(user_input, catalog):
    """Returns (code_or_None, subject_text, context_confidence, why)."""
    q = user_input.strip()
    if not catalog:
        return None, q, 0.30, "no catalog available; free text taken as-is (self_report_only band)."

    for code, subjects in catalog.items():
        if q.upper() == code.upper():
            code, subject = resolve_variant(code, subjects)
            return code, subject, 0.95, f"exact course-code match against catalog ({code}); deterministic, not inferred."

    for code, subjects in catalog.items():
        for subj in subjects:
            if q.lower() == subj.lower():
                return code, subj, 0.95, f"exact subject-name match against catalog ({code}); deterministic, not inferred."

    catalog_lines = "\n".join(
        f"{code}: {' / '.join(subjects)}" for code, subjects in sorted(catalog.items())
    )
    prompt = f"""A faculty member typed this as their course: "{q}"

Known course catalog (code: subject name, "/" separates variants of the same code):
{catalog_lines}

Which single code is the closest match to what they typed? Consider abbreviations,
partial names, and course codes. If nothing in the catalog is a reasonable match,
return null.

Reply with JSON only: {{"code": "<catalog code or null>", "confidence": "<high|medium|low>"}}"""
    out = llm([{"role": "user", "content": prompt}])
    guess = safe_json_parse(out, {"code": None, "confidence": "low"})
    code = guess.get("code")

    if code and code in catalog:
        code, subject = resolve_variant(code, catalog[code])
        print(f"\nClosest match I found: \"{subject}\" ({code}) "
              f"-- model confidence: {guess.get('confidence', 'unknown')}")
        yn = input("Is that right? [y/n] > ").strip().lower()
        if yn.startswith("y"):
            return code, subject, 0.85, (
                f"model proposed '{subject}' ({code}) and the teacher confirmed it -- "
                f"two independent signals (model + human confirmation) = corroborated_evidence band."
            )

    print("Couldn't confidently match that to the catalog -- proceeding with what you typed.")
    return None, q, 0.30, "no catalog match found or confirmation declined; free text taken as-is (self_report_only band)."


def run_course_selection_multi(catalog):
    print("\n=== Course Identification ===\n")
    print("Which course(s) is this profile for? You teach more than one subject is fine --")
    print("enter them comma-separated (subject names or course codes).")
    raw = input("> ").strip()
    subject_inputs = [s.strip() for s in raw.split(",") if s.strip()]
    if not subject_inputs:
        subject_inputs = ["unspecified course"]

    resolved = []
    for s in subject_inputs:
        code, subject, conf, why = find_course_match(s, catalog)
        if code:
            print(f"Matched: {subject} ({code})")
        resolved.append({
            "input": s, "course_code": code, "course_subject": subject,
            "context_confidence": conf, "context_why": why,
        })
    return resolved


# ---------------------------------------------------------------------------
# Layer 0a -- Teacher-level questionnaire (asked ONCE; dispositional traits)
# ---------------------------------------------------------------------------

TEACHER_QUESTIONNAIRE = [
    ("background", "In one line: years teaching and level (UG/PG/both).", "text"),
    ("capability_confidence", "Rate 1-5: how confident do you feel running "
                               "active-learning methods (group work, projects, discussions)?", "scale"),
    ("interest", "Rate 1-5: 'I'm interested in experimenting with new teaching "
                 "methods, if constraints allowed it.'", "scale"),
    ("edtech_comfort", "Rate 1-5: comfort with educational technology and AI tools in teaching.", "scale"),
]


def run_teacher_questionnaire():
    print(f"\n=== Teacher Profile ({len(TEACHER_QUESTIONNAIRE)} items, asked once, ~1 min) ===\n")
    answers = {}
    for key, prompt, qtype in TEACHER_QUESTIONNAIRE:
        while True:
            raw = input(f"{prompt}\n> ").strip()
            if not raw:
                print("  (please enter a response)")
                continue
            if qtype == "scale":
                try:
                    v = int(raw)
                    if not 1 <= v <= 5:
                        raise ValueError
                    answers[key] = v
                    break
                except ValueError:
                    print("  enter a whole number 1-5")
            else:
                answers[key] = raw
                break
    return answers


def seed_teacher_profile(answers):
    """capability/interest/technology are self-ratings only -> confidence is
    formula-derived and pinned inside the self_report_only band."""
    profile = {}
    cap = answers["capability_confidence"]
    profile["capability"] = {
        "value": f"self-rated {cap}/5 on active methods",
        "confidence": self_report_confidence(cap),
        "why": f"questionnaire self-rating {cap}/5, no behavioural example yet -> self_report_only band.",
    }
    interest = answers["interest"]
    profile["interest"] = {
        "value": f"self-rated {interest}/5 interest in new methods",
        "confidence": self_report_confidence(interest),
        "why": f"questionnaire self-rating {interest}/5, no behavioural example yet -> self_report_only band.",
    }
    tech = answers["edtech_comfort"]
    profile["technology"] = {
        "value": f"self-rated {tech}/5 ed-tech/AI comfort",
        "confidence": self_report_confidence(tech),
        "why": f"questionnaire self-rating {tech}/5, no behavioural example yet -> self_report_only band.",
    }
    return profile


# ---------------------------------------------------------------------------
# Layer 0b -- Course-level questionnaire (asked PER SUBJECT; practice)
# ---------------------------------------------------------------------------

ACTIVITY_OPTIONS = [
    "Discussions", "Coding", "Group work", "Projects",
    "Quizzes", "Presentations", "Reflection", "Case studies",
]

COURSE_QUESTIONNAIRE = [
    ("style", "Which best describes your typical classroom for THIS course?\n"
              "  A) Lecture-focused\n  B) Lecture + guided examples\n"
              "  C) Interactive problem solving\n  D) Project/discussion heavy", "choice"),
    ("lecture_pct", "Roughly what % of a typical class (this course) is spent lecturing?\n"
                    "  A) 0-25   B) 25-50   C) 50-75   D) 75-100", "choice"),
    ("blocker", "What's your single biggest teaching constraint for this course right now?", "text"),
    ("blocker_severity", "Rate its severity, 1 (mild) to 5 (severe):", "scale"),
]


def ask_activities():
    print("\nWhich activities do students regularly perform in this course? Select all that apply.")
    for i, opt in enumerate(ACTIVITY_OPTIONS, 1):
        print(f"  {i}) {opt}")
    while True:
        raw = input("Numbers, comma-separated (e.g. 1,3,4) > ").strip()
        picks = [p.strip() for p in raw.split(",") if p.strip()]
        try:
            idxs = [int(p) for p in picks]
            if idxs and all(1 <= i <= len(ACTIVITY_OPTIONS) for i in idxs):
                return sorted({ACTIVITY_OPTIONS[i - 1].lower() for i in idxs})
        except ValueError:
            pass
        print(f"  enter one or more numbers 1-{len(ACTIVITY_OPTIONS)}, comma-separated")


def run_course_questionnaire(subject_label):
    print(f"\n=== Course Questionnaire: {subject_label} ===\n")
    answers = {}
    for i, (key, prompt, qtype) in enumerate(COURSE_QUESTIONNAIRE):
        if i == 2:
            answers["activities"] = ask_activities()
        while True:
            raw = input(f"{prompt}\n> ").strip()
            if not raw:
                print("  (please enter a response)")
                continue
            if qtype == "scale":
                try:
                    v = int(raw)
                    if not 1 <= v <= 5:
                        raise ValueError
                    answers[key] = v
                    break
                except ValueError:
                    print("  enter a whole number 1-5")
            elif qtype == "choice":
                if raw.strip().upper()[:1] in ("A", "B", "C", "D"):
                    answers[key] = raw.strip().upper()[:1]
                    break
                print("  enter A, B, C, or D")
            else:
                answers[key] = raw
                break
    return answers


def seed_course_profile(course_answers, course_match):
    profile = {}
    profile["context"] = {
        "value": (course_match["course_subject"] +
                  (f" ({course_match['course_code']})" if course_match["course_code"] else ""))[:60],
        "confidence": course_match["context_confidence"],
        "why": course_match["context_why"],
    }
    sev = course_answers["blocker_severity"]
    profile["constraints"] = {
        "value": course_answers["blocker"][:40],
        "confidence": self_report_confidence(sev),
        "why": f"questionnaire severity self-rating {sev}/5 with a one-line blocker description, "
               f"no independent corroboration yet -> self_report_only band.",
    }
    return profile


# ---------------------------------------------------------------------------
# Layer 3 -- Signal-conflict detection (rule-based, no LLM call needed)
# ---------------------------------------------------------------------------

def detect_signal_conflicts(teacher_answers, course_answers):
    conflicts = []
    active_learning_used = any(
        a in course_answers["activities"] for a in ["group work", "projects", "discussions", "case studies"]
    )
    if teacher_answers["interest"] >= 4 and not active_learning_used:
        conflicts.append({
            "type": "interest_usage_gap", "category": "interest",
            "probe": "You indicated real interest in active learning, but it didn't "
                     "come up in the activities you use in this course -- what's "
                     "actually stopping you here?",
        })
    if teacher_answers["edtech_comfort"] >= 4 and course_answers["lecture_pct"] in ("C", "D"):
        conflicts.append({
            "type": "tech_integration_gap", "category": "technology",
            "probe": "You're comfortable with ed-tech, but this course still sounds "
                     "fairly lecture-heavy -- what's preventing you from bringing more "
                     "tech into the actual teaching?",
        })
    if teacher_answers["edtech_comfort"] >= 4 and teacher_answers["interest"] <= 2:
        conflicts.append({
            "type": "confidence_interest_gap", "category": "capability",
            "probe": "You seem comfortable with these tools but not especially drawn "
                     "to using new methods more broadly -- can you say why?",
        })
    return conflicts


# ---------------------------------------------------------------------------
# Pedagogy classification -- closed-set, weighted, multi-label, cited.
# ---------------------------------------------------------------------------

ROOT_PROMPT_TEMPLATE = "Walk me through a typical class in {subject} from start to finish."
EVIDENCE_PROMPT = ("For this course, give one quick example: something that worked really "
                    "well, and something that didn't.")


def classify_pedagogy_mix(narrative_text, prior_mix=None, _retry=True):
    """Ask the model to express the narrative ONLY in terms of the closed
    PEDAGOGY_TAXONOMY. Narrative is glossary-expanded before it hits the
    model, the compulsory-vs-deliberate rule is injected, dict-wrapped
    arrays are recovered instead of discarded, and a genuinely empty result
    triggers one retry with a visible warning instead of failing silently."""
    prior_block = ""
    if prior_mix:
        prior_block = ("Pedagogy weights already established from earlier turns "
                        "in this same course (do not discard, only refine):\n" +
                        json.dumps(prior_mix, indent=2) + "\n\n")

    narrative_for_llm = expand_glossary_terms(narrative_text)

    prompt = f"""You must classify a faculty member's description of their teaching using
ONLY the following closed taxonomy of pedagogies and named variants. Do not invent
any category outside this list. If nothing fits perfectly, pick the nearest entry
and say so honestly in the rationale -- do not leave it out.

TAXONOMY:
{TAXONOMY_PROMPT_BLOCK}

{COMPULSORY_VS_DELIBERATE_RULE}

{prior_block}Teaching description:
"{narrative_for_llm}"

Return a JSON array. Each element is one pedagogy that has real evidence in the
description (usually 1-4 elements, more only if clearly justified):
{{
  "core": "<one core_key from the taxonomy above, exactly as written>",
  "variant": "<one variant key under that core, exactly as written, or null if only
              core-level evidence exists>",
  "weight": <float 0-1, relative strength of evidence for THIS pedagogy in the
             description -- weights are independent, they do not need to sum to 1>,
  "band": "<one of: no_evidence, self_report_only, partial_evidence, corroborated_evidence>",
  "rationale": "<short quote or close paraphrase of the specific words that justify
                this match and this band>"
}}
Reply with the JSON array only, no commentary, no markdown fences."""
    out = llm([{"role": "user", "content": prompt}])
    if DEBUG:
        print(f"  [debug] raw pedagogy classification output:\n{out}\n")
    parsed = safe_json_parse(out, [])

    # Recover a dict-wrapped array (e.g. {"pedagogies": [...]}) or a bare
    # single object instead of silently discarding real classifications.
    if isinstance(parsed, dict):
        list_val = next((v for v in parsed.values() if isinstance(v, list)), None)
        if list_val is not None:
            parsed = list_val
        elif "core" in parsed:
            parsed = [parsed]
        else:
            parsed = []
    if not isinstance(parsed, list):
        parsed = []

    if not parsed and narrative_text.strip() and _retry:
        print("  [warn] pedagogy classification returned nothing usable, retrying once...")
        return classify_pedagogy_mix(narrative_text, prior_mix=prior_mix, _retry=False)

    cleaned = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        core = item.get("core")
        if core not in PEDAGOGY_TAXONOMY:
            continue  # refuse anything outside the closed set
        variant = item.get("variant")
        if variant and variant not in PEDAGOGY_TAXONOMY[core]["variants"]:
            variant = None
        band = item.get("band", "self_report_only")
        if band not in {b[2] for b in CONFIDENCE_BANDS}:
            band = "self_report_only"
        try:
            weight = validate_confidence(float(item.get("weight", 0.3)), band)
        except (TypeError, ValueError):
            weight = band_bounds(band)[0]
        cleaned.append({
            "core": core,
            "core_label": PEDAGOGY_TAXONOMY[core]["label"],
            "variant": variant,
            "variant_label": variant.replace("_", " ").title() if variant else None,
            "weight": weight,
            "band": band,
            "why": item.get("rationale", "").strip(),
        })

    if not cleaned and narrative_text.strip():
        print("  [warn] pedagogy classification still empty after retry -- "
              "check raw model output with APE_DEBUG=1.")
    return cleaned


def merge_pedagogy_mix(old_mix, new_mix):
    """Combine mixes across turns: same (core, variant) pair keeps the higher
    weight and the rationale that earned it."""
    by_key = {(m["core"], m["variant"]): m for m in old_mix}
    for m in new_mix:
        key = (m["core"], m["variant"])
        if key not in by_key or m["weight"] > by_key[key]["weight"]:
            by_key[key] = m
    return sorted(by_key.values(), key=lambda m: -m["weight"])


def pedagogy_mix_summary(mix, top_n=3):
    top = mix[:top_n]
    return " + ".join(
        f'{(m["variant_label"] or m["core_label"])} ({m["weight"]:.2f})' for m in top
    ) or "no pedagogy evidence yet"


def ambiguous_pedagogies(mix, low=0.4, high=0.7):
    """Pedagogies sitting in the ambiguous middle, or within 0.1 of the top
    weight, are worth a disambiguating follow-up rather than guessing."""
    if not mix:
        return []
    top_weight = mix[0]["weight"]
    return [m for m in mix if low <= m["weight"] <= high or (top_weight - m["weight"]) <= 0.1]


def generate_disambiguation_question(pedagogy_entry):
    label = pedagogy_entry["variant_label"] or pedagogy_entry["core_label"]
    core_def = PEDAGOGY_TAXONOMY[pedagogy_entry["core"]]["definition"]
    definition = (PEDAGOGY_TAXONOMY[pedagogy_entry["core"]]["variants"].get(pedagogy_entry["variant"])
                  if pedagogy_entry["variant"] else core_def)
    return (f"You mentioned something close to {label} ({definition}) How often does this "
            f"actually happen in this course, and what does it look like in practice?")


# ---------------------------------------------------------------------------
# update_profile -- non-pedagogy categories only (assessment, philosophy, evidence)
# ---------------------------------------------------------------------------

def update_profile(profile, question, answer, target_categories):
    """Answer is glossary-expanded and the compulsory-vs-deliberate rule is
    injected, so 'CIE' scores as institutionally-mandated evidence (capped
    at self_report_only) rather than an opaque label."""
    answer_for_llm = expand_glossary_terms(answer)

    prompt = f"""You maintain a structured pedagogy profile for a faculty member's course,
built incrementally across a conversation.

Confidence rubric (every category must use these bands and nothing else):
{CONFIDENCE_RUBRIC_TEXT}

{COMPULSORY_VS_DELIBERATE_RULE}

Current profile for the categories you may touch (JSON):
{json.dumps({c: profile.get(c, {}) for c in target_categories}, indent=2)}

Latest exchange:
Q: {question}
A: {answer_for_llm}

Update ONLY these categories: {target_categories}. For each, return:
  "value": a short (3-6 word) label summarizing what was learned
  "band": one of no_evidence / self_report_only / partial_evidence / corroborated_evidence,
          chosen strictly per the rubric above based on what this answer actually contains
  "confidence": a float that must fall inside the numeric range for that band
  "why": which specific words/turns justify this band (do not just repeat the definition)
Only raise confidence versus the current value if this answer adds real new evidence;
never lower it without also lowering the band and explaining why in "why".
Reply with JSON only, keyed by category name, no commentary, no markdown fences."""
    out = llm([{"role": "user", "content": prompt}])
    if DEBUG:
        print(f"  [debug] raw update_profile output:\n{out}\n")
    updated = safe_json_parse(out, None)
    if not isinstance(updated, dict):
        return profile
    for cat in target_categories:
        entry = updated.get(cat)
        if not isinstance(entry, dict):
            continue
        band = entry.get("band", "self_report_only")
        if band not in {b[2] for b in CONFIDENCE_BANDS}:
            band = "self_report_only"
        try:
            conf = validate_confidence(float(entry.get("confidence", 0.3)), band)
        except (TypeError, ValueError):
            conf = band_bounds(band)[0]
        value = entry.get("value", profile.get(cat, {}).get("value"))
        if isinstance(value, str):
            value = value.strip()[:60]  # guard against the LLM ignoring the 3-6 word ask
        profile[cat] = {
            "value": value,
            "confidence": conf,
            "band": band,
            "why": entry.get("why", ""),
        }
    return profile


def category_confidence_met(profile, categories, threshold=CONFIDENCE_THRESHOLD):
    for c in categories:
        entry = profile.get(c) or {}
        if entry.get("confidence", 0) < threshold:
            return False
    return True


def pedagogy_mix_confidence_met(mix, threshold=CONFIDENCE_THRESHOLD):
    return bool(mix) and mix[0]["weight"] >= threshold


def required_course_categories_met(profile, mix):
    if not pedagogy_mix_confidence_met(mix):
        return False
    return category_confidence_met(profile, ["constraints", "assessment"])


# ---------------------------------------------------------------------------
# Per-subject adaptive interview
# ---------------------------------------------------------------------------

def run_subject_interview(subject_label, teacher_profile, teacher_answers):
    print(f"\n=== Adaptive Interview: {subject_label} ===\n")

    course_answers = run_course_questionnaire(subject_label)

    profile = {c: {"value": None, "confidence": 0.0, "band": "no_evidence", "why": ""}
               for c in ["assessment", "philosophy", "evidence"]}

    conflict_probes = detect_signal_conflicts(teacher_answers, course_answers)

    root_prompt = ROOT_PROMPT_TEMPLATE.format(subject=subject_label)
    print(root_prompt)
    root_answer = input("> ").strip()

    # Disambiguate "quiz" the moment it comes up, before it can be
    # mis-scored as either a compulsory or a deliberate assessment.
    quiz_type, quiz_note = maybe_ask_quiz_clarification(course_answers, root_answer)
    course_answers["quiz_type"] = quiz_type

    mix = classify_pedagogy_mix(root_answer)

    # If the model still couldn't classify anything real (rare after the
    # parser fix, but possible), don't just report "no evidence" -- give
    # the teacher one concrete chance to re-describe it.
    if not mix:
        print("\nCould you describe that a bit more concretely -- e.g. do you lecture "
              "start-to-finish, have students present with your guidance, run debates, "
              "assign group projects, and so on?")
        followup = input("> ").strip()
        mix = classify_pedagogy_mix(f"{root_answer}\n\nAdditional detail: {followup}")

    print(f"\n[pedagogy mix so far: {pedagogy_mix_summary(mix)}]\n")

    # v3.2 FIX D: track pedagogies that stopped moving so we don't ask the
    # exact same disambiguation question about them turn after turn.
    asked = 0
    stalled = set()
    while asked < MAX_FOLLOWUPS_PER_SUBJECT and not pedagogy_mix_confidence_met(mix):
        candidates = [m for m in ambiguous_pedagogies(mix) if (m["core"], m["variant"]) not in stalled]
        if not candidates:
            break
        target = candidates[0]
        prev_weight = target["weight"]
        q = generate_disambiguation_question(target)
        print(q)
        answer = input("> ").strip()
        new_mix = classify_pedagogy_mix(answer, prior_mix=mix)
        mix = merge_pedagogy_mix(mix, new_mix)
        asked += 1
        updated = next((m for m in mix if m["core"] == target["core"] and m["variant"] == target["variant"]), None)
        if updated is None or (updated["weight"] - prev_weight) < STALL_EPSILON:
            # this answer didn't move the needle -- accept current weight,
            # stop asking about this specific pedagogy for this subject.
            stalled.add((target["core"], target["variant"]))
        print(f"\n[pedagogy mix so far: {pedagogy_mix_summary(mix)}]\n")

    for conflict in conflict_probes:
        print(f"\n{conflict['probe']}")
        answer = input("> ").strip()
        if conflict["category"] in ("interest", "capability", "technology"):
            new_mix = classify_pedagogy_mix(answer, prior_mix=mix)
            mix = merge_pedagogy_mix(mix, new_mix)
        else:
            profile = update_profile(profile, conflict["probe"], answer, [conflict["category"]])

    extra_pool = {
        "assessment": "How do you usually assess whether students actually learned something in this course?",
        "philosophy": "What matters most to you in teaching this course, if you had to pick one thing?",
    }
    extra_turns = 0
    for cat, q in extra_pool.items():
        if extra_turns >= MAX_EXTRA_TURNS or required_course_categories_met(profile, mix):
            break
        if (profile.get(cat) or {}).get("confidence", 0) >= CONFIDENCE_THRESHOLD:
            continue
        print(f"\n{q}")
        answer = input("> ").strip()
        # v3.2 FIX E: "quiz" may not show up until THIS answer -- re-check
        # here rather than only relying on the earlier narrative check.
        if cat == "assessment":
            if quiz_type is None and "quiz" in answer.lower():
                quiz_type, quiz_note = maybe_ask_quiz_clarification(course_answers, answer)
                course_answers["quiz_type"] = quiz_type
            answer_for_profile = f"{answer}\n\n[Clarification: {quiz_note}]" if quiz_note else answer
        else:
            answer_for_profile = answer
        profile = update_profile(profile, q, answer_for_profile, [cat])
        extra_turns += 1

    print(f"\n{EVIDENCE_PROMPT}")
    answer = input("> ").strip()
    profile = update_profile(profile, EVIDENCE_PROMPT, answer, ["evidence"])

    return course_answers, mix, profile, conflict_probes


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def print_subject_profile(subject_label, mix, profile, flagged_conflicts):
    print(f"\n=== Pedagogy Profile: {subject_label} ===\n")
    print("Pedagogy mix (weight = strength of evidence in this closed taxonomy):")
    if not mix:
        print("  (none classified -- see [warn] messages above)")
    for m in mix:
        label = m["variant_label"] or m["core_label"]
        print(f"  {label:32s} weight={m['weight']:.2f}  band={m['band']:20s} why: {m['why']}")
    print()
    for cat, entry in profile.items():
        print(f"{cat:12s} {str(entry.get('value') or '-'):38s} "
              f"(confidence: {entry.get('confidence', 0):.2f}, band: {entry.get('band', '-')})")
        if entry.get("why"):
            print(f"{'':12s} why: {entry['why']}")
    if flagged_conflicts:
        print(f"\nSignal conflicts flagged: {[c['type'] for c in flagged_conflicts]}")


def save_all(teacher_answers, teacher_profile, subject_results, path="faculty_profile.json"):
    out = {
        "confidence_rubric": {name: {"range": [lo, hi], "meaning": desc}
                               for lo, hi, name, desc in CONFIDENCE_BANDS},
        "academic_term_glossary": ACADEMIC_TERM_GLOSSARY,
        "pedagogy_taxonomy_reference": {
            core: {"label": v["label"], "variants": list(v["variants"].keys())}
            for core, v in PEDAGOGY_TAXONOMY.items()
        },
        "teacher": {"intake": teacher_answers, "profile": teacher_profile},
        "subjects": subject_results,
    }
    with open(path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"\nSaved to {path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if not os.environ.get("GROQ_API_KEY"):
        sys.exit("Set GROQ_API_KEY in your environment first (get a free key at "
                  "console.groq.com).")

    catalog = load_course_knowledge()
    course_matches = run_course_selection_multi(catalog)

    teacher_answers = run_teacher_questionnaire()
    teacher_profile = seed_teacher_profile(teacher_answers)

    subject_results = []
    for course_match in course_matches:
        subject_label = course_match["course_subject"]

        course_answers, mix, practice_profile, conflicts = run_subject_interview(
            subject_label, teacher_profile, teacher_answers
        )
        course_profile = seed_course_profile(course_answers, course_match)

        full_profile = {**course_profile, **practice_profile}
        for cat in TEACHER_CATEGORIES:
            full_profile[cat] = teacher_profile[cat]

        full_profile["pedagogy_mix_summary"] = {
            "value": pedagogy_mix_summary(mix),
            "confidence": mix[0]["weight"] if mix else 0.0,
            "band": mix[0]["band"] if mix else "no_evidence",
            "why": "see per-pedagogy weights and rationale in pedagogy_mix below.",
        }

        print_subject_profile(subject_label, mix, full_profile, conflicts)

        subject_results.append({
            "course_match": course_match,
            "course_intake": course_answers,
            "pedagogy_mix": mix,
            "profile": full_profile,
            "signal_conflicts": [c["type"] for c in conflicts],
        })

    save_all(teacher_answers, teacher_profile, subject_results)


if __name__ == "__main__":
    main()