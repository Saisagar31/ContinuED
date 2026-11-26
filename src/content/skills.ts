import type { Skill } from '../domain/types';
import { en } from './packs/en';
import type { SkillId } from './packs/types';

/**
 * Skill graph (task 04, owned by Ramith). DRAFT until educators approve it.
 *
 * Skill IDs are stable and travel in transfer capsules: never rename one.
 * Display text (names, groups, oral checks, activities) lives in the language
 * packs under ./packs; the English objects below are built from the English
 * pack so there is one source of truth.
 */
export const CONTENT_VERSION = 'draft-1.0';

/** Tie rule across strands — PLACEHOLDER pending educator approval (task 04). */
export const STRAND_ORDER = ['numeracy', 'literacy'] as const;

interface GraphNode {
  id: SkillId;
  strand: Skill['strand'];
  prerequisites: SkillId[];
  /** Educator reference, English only. Used to write distractors and rubrics. */
  commonErrors: string[];
  /** Stable activity IDs, in the same order as the pack's activities. */
  activityIds: string[];
}

/** Array order is topological within each strand (prerequisites first). */
const GRAPH: GraphNode[] = [
  {
    id: 'num.recognition',
    strand: 'numeracy',
    prerequisites: [],
    commonErrors: ['Reverses digits (12 read as 21)', 'Confuses 6 and 9', 'Reads 40 as “four”'],
    activityIds: ['a.nr.1', 'a.nr.2'],
  },
  {
    id: 'num.place_value',
    strand: 'numeracy',
    prerequisites: ['num.recognition'],
    commonErrors: ['Counts all sticks one by one instead of using bundles', 'Writes 304 for thirty-four', 'Swaps tens and ones'],
    activityIds: ['a.pv.1', 'a.pv.2'],
  },
  {
    id: 'num.add_no_carry',
    strand: 'numeracy',
    prerequisites: ['num.place_value'],
    commonErrors: ['Adds tens to ones', 'Counts on from the wrong number', 'Writes the digits side by side (23 + 14 = 2314)'],
    activityIds: ['a.an.1', 'a.an.2'],
  },
  {
    id: 'num.sub_borrow',
    strand: 'numeracy',
    prerequisites: ['num.add_no_carry', 'num.place_value'],
    commonErrors: ['Subtracts the smaller digit from the larger in each column', 'Forgets to reduce the tens after borrowing'],
    activityIds: ['a.sb.1', 'a.sb.2'],
  },
  {
    id: 'num.fractions',
    strand: 'numeracy',
    prerequisites: ['num.recognition'],
    commonErrors: ['Accepts unequal parts as halves', 'Thinks a quarter is bigger than a half'],
    activityIds: ['a.fr.1', 'a.fr.2'],
  },
  {
    id: 'lit.initial_sounds',
    strand: 'literacy',
    prerequisites: [],
    commonErrors: ['Gives the letter name instead of the sound', 'Matches by rhyme instead of first sound'],
    activityIds: ['a.is.1', 'a.is.2'],
  },
  {
    id: 'lit.decoding',
    strand: 'literacy',
    prerequisites: ['lit.initial_sounds'],
    commonErrors: ['Guesses from the first letter', 'Skips vowel signs (matras)', 'Reads conjunct letters as separate sounds'],
    activityIds: ['a.dc.1', 'a.dc.2'],
  },
  {
    id: 'lit.sentence_reading',
    strand: 'literacy',
    prerequisites: ['lit.decoding'],
    commonErrors: ['Reads word by word without meaning', 'Stops at unfamiliar words', 'Answers from the picture, not the text'],
    activityIds: ['a.sr.1', 'a.sr.2'],
  },
];

export const ACTIVITY_IDS: Record<SkillId, string[]> = Object.fromEntries(GRAPH.map((g) => [g.id, g.activityIds])) as Record<SkillId, string[]>;

export const SKILLS: Skill[] = GRAPH.map((g) => {
  const text = en.skills[g.id];
  return {
    id: g.id,
    strand: g.strand,
    name: text.name,
    prerequisites: g.prerequisites,
    commonErrors: g.commonErrors,
    peerGroup: text.group,
    oralCheck: text.oral,
    activities: g.activityIds.map((id, i) => ({ id, minutes: 15, title: text.activities[i].title, steps: text.activities[i].steps })),
  };
});

export const SKILL_BY_ID: Record<string, Skill> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

/** Skills in tie-rule order: strand order, then graph (array) order which is topological. */
export function orderedSkills(): Skill[] {
  return [...SKILLS].sort(
    (a, b) =>
      STRAND_ORDER.indexOf(a.strand) - STRAND_ORDER.indexOf(b.strand) ||
      SKILLS.indexOf(a) - SKILLS.indexOf(b),
  );
}
