import type { Skill } from '../domain/types';

/**
 * SYNTHETIC SAMPLE skill map (content version below).
 * Task 04 (Ramith + educators) owns the approved graph, rubrics and activities.
 * This fixture exists so the UI, transfer and plan slices can be built and tested.
 */
export const CONTENT_VERSION = 'sample-0.1';

/** Tie rule across strands — PLACEHOLDER pending educator approval (task 04). */
export const STRAND_ORDER = ['numeracy', 'literacy'] as const;

export const SKILLS: Skill[] = [
  {
    id: 'num.recognition',
    strand: 'numeracy',
    name: 'Number recognition',
    prerequisites: [],
    commonErrors: ['Reverses digits (12 read as 21)', 'Confuses 6 and 9'],
    peerGroup: 'Number-recognition group: learners who need practice naming numbers to 100',
    oralCheck: 'Point to a number on the card and ask the learner to say it aloud.',
    activities: [
      { id: 'a.nr.1', minutes: 15, title: 'Number hunt', steps: 'Hide 10 number cards (1–50) around the room. Learners find a card, say the number aloud and place it on a number line.' },
      { id: 'a.nr.2', minutes: 15, title: 'Show me', steps: 'Call out a number. Pairs hold up the matching card, then build it with bundles of sticks.' },
    ],
  },
  {
    id: 'num.place_value',
    strand: 'numeracy',
    name: 'Tens and ones',
    prerequisites: ['num.recognition'],
    commonErrors: ['Counts all sticks one by one instead of using bundles', 'Writes 304 for thirty-four'],
    peerGroup: 'Place-value group: learners building two-digit numbers with bundles',
    oralCheck: 'Show 3 bundles of ten and 4 single sticks. Ask how many sticks there are altogether.',
    activities: [
      { id: 'a.pv.1', minutes: 15, title: 'Bundle and count', steps: 'Give each pair 60 sticks and rubber bands. Make bundles of ten, then say and write the total as tens and ones.' },
      { id: 'a.pv.2', minutes: 15, title: 'Place-value mat', steps: 'Learners roll two dice for tens and ones, place bundles on a mat, and read the number aloud.' },
    ],
  },
  {
    id: 'num.add_no_carry',
    strand: 'numeracy',
    name: 'Addition without carrying',
    prerequisites: ['num.place_value'],
    commonErrors: ['Adds tens to ones', 'Counts on from the wrong number'],
    peerGroup: 'Addition group: learners adding two-digit numbers without regrouping',
    oralCheck: 'Ask: “You have 23 marbles and get 14 more. How many do you have now?”',
    activities: [
      { id: 'a.an.1', minutes: 15, title: 'Shop sums', steps: 'Set up a pretend shop with prices under 50. Learners buy two items and add the prices with bundles, then on paper.' },
      { id: 'a.an.2', minutes: 15, title: 'Tens first', steps: 'Model adding tens then ones on a place-value mat. Learners solve four sums in pairs and explain one to the group.' },
    ],
  },
  {
    id: 'num.sub_borrow',
    strand: 'numeracy',
    name: 'Subtraction with borrowing',
    prerequisites: ['num.add_no_carry', 'num.place_value'],
    commonErrors: ['Subtracts the smaller digit from the larger in each column', 'Forgets to reduce the tens after borrowing'],
    peerGroup: 'Subtraction group: learners practising exchange of one ten for ten ones',
    oralCheck: 'Ask: “There are 42 mangoes. 17 are sold. How many are left?”',
    activities: [
      { id: 'a.sb.1', minutes: 15, title: 'Break a bundle', steps: 'With bundles, show 42 − 17: unbundle one ten when there are not enough ones. Learners repeat with three problems.' },
      { id: 'a.sb.2', minutes: 15, title: 'Check with addition', steps: 'Pairs solve a subtraction, then check it by adding the answer back. Discuss any mismatch.' },
    ],
  },
  {
    id: 'num.fractions',
    strand: 'numeracy',
    name: 'Halves and quarters',
    prerequisites: ['num.recognition'],
    commonErrors: ['Accepts unequal parts as halves', 'Thinks a quarter is bigger than a half'],
    peerGroup: 'Fractions group: learners folding and sharing equal parts',
    oralCheck: 'Fold a paper into two unequal parts and ask whether each part is a half. Ask why.',
    activities: [
      { id: 'a.fr.1', minutes: 15, title: 'Fold and share', steps: 'Learners fold paper rotis into halves and quarters, label the parts, and compare sizes.' },
      { id: 'a.fr.2', minutes: 15, title: 'Fair or not fair', steps: 'Show pictures of shapes split equally and unequally. Groups sort them and explain their choice.' },
    ],
  },
  {
    id: 'lit.initial_sounds',
    strand: 'literacy',
    name: 'Initial sounds',
    prerequisites: [],
    commonErrors: ['Gives the letter name instead of the sound', 'Matches by rhyme instead of first sound'],
    peerGroup: 'Sounds group: learners matching first sounds to pictures',
    oralCheck: 'Say a familiar word and ask the learner what sound it begins with.',
    activities: [
      { id: 'a.is.1', minutes: 15, title: 'Sound basket', steps: 'Place objects in a basket. Learners pull one out, say its name and its first sound, and sort by sound.' },
      { id: 'a.is.2', minutes: 15, title: 'I spy', steps: 'Play “I spy something that begins with …” using sounds, not letter names. Learners take turns leading.' },
    ],
  },
  {
    id: 'lit.decoding',
    strand: 'literacy',
    name: 'Word decoding',
    prerequisites: ['lit.initial_sounds'],
    commonErrors: ['Guesses from the first letter', 'Skips vowel signs'],
    peerGroup: 'Decoding group: learners blending sounds into short words',
    oralCheck: 'Show a short familiar word card. Ask the learner to read it aloud (do not say it first).',
    activities: [
      { id: 'a.dc.1', minutes: 15, title: 'Blend it', steps: 'Use letter/akshara cards to build three-sound words. Learners say each sound, then blend and read the word.' },
      { id: 'a.dc.2', minutes: 15, title: 'Word swap', steps: 'Change one sound at a time to make a new word. Pairs read each new word aloud.' },
    ],
  },
  {
    id: 'lit.sentence_reading',
    strand: 'literacy',
    name: 'Short-sentence reading',
    prerequisites: ['lit.decoding'],
    commonErrors: ['Reads word-by-word without meaning', 'Stops at unfamiliar words'],
    peerGroup: 'Reading group: learners reading and retelling short sentences',
    oralCheck: 'Show a short sentence card. Ask the learner to read it and say what it means.',
    activities: [
      { id: 'a.sr.1', minutes: 15, title: 'Read and act', steps: 'Learners read an action sentence card aloud, then act it out for the group to check meaning.' },
      { id: 'a.sr.2', minutes: 15, title: 'Echo reading', steps: 'Read a sentence with expression; learners echo it, then read the next one on their own.' },
    ],
  },
];

export const SKILL_BY_ID: Record<string, Skill> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

/** Skills in tie-rule order: strand order, then graph (array) order which is topological. */
export function orderedSkills(): Skill[] {
  return [...SKILLS].sort(
    (a, b) =>
      STRAND_ORDER.indexOf(a.strand) - STRAND_ORDER.indexOf(b.strand) ||
      SKILLS.indexOf(a) - SKILLS.indexOf(b),
  );
}
