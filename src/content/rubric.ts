/**
 * Mastery rubric, adaptation rules, stopping rules and offline coverage targets
 * (task 04, owned by Ramith). Versioned with the content so a saved session can
 * always be interpreted with the rules it was assessed under.
 *
 * Every number here is an INITIAL RULE FOR EDUCATORS TO PILOT (plan section 2.4),
 * not an approved standard. Changing any value means bumping RUBRIC_VERSION.
 */
import type { Observation, SkillStatus } from '../domain/types';
import type { SkillId } from './packs/types';

export const RUBRIC_VERSION = 'draft-rubric-1';

/** Difficulty bands per skill. 1 = entry level, 2 = harder / transfer task. */
export const BANDS = [1, 2] as const;
export type Band = (typeof BANDS)[number];
export const TOP_BAND: Band = 2;

/** What each band covers, for educators reviewing the generators (English reference). */
export const LEVEL_DESCRIPTORS: Record<SkillId, Record<Band, string>> = {
  'num.recognition': { 1: 'Read, order and continue numbers 1–20', 2: 'Read and compare two-digit numbers 21–99, including digit reversals (38 / 83)' },
  'num.place_value': { 1: 'Tens and ones for 11–50 (ones never 0), and up to 4 bundles', 2: 'Tens and ones for 51–99 and whole tens (10, 20 … 90)' },
  'num.add_no_carry': { 1: 'Two-digit + one-digit, no carrying', 2: 'Two-digit + two-digit, no carrying' },
  'num.sub_borrow': { 1: 'Two-digit − one-digit with borrowing', 2: 'Two-digit − two-digit with borrowing' },
  'num.fractions': { 1: 'Half of a set; sharing between 2', 2: 'Quarter of a set; sharing between 4' },
  'lit.initial_sounds': { 1: 'First sound of familiar words with common consonants', 2: 'Less frequent, aspirated or vowel-initial sounds' },
  'lit.decoding': { 1: 'Familiar two-syllable words', 2: 'Familiar three-syllable words and words with conjuncts' },
  'lit.sentence_reading': { 1: 'Three- or four-word sentences, literal question', 2: 'Five- to eight-word sentences, literal question about who / what / when / where' },
};

export interface ObservedAttempt {
  observation: Observation;
  band: number;
}

/**
 * Suggested status from the evidence for ONE skill. Only a suggestion: the
 * teacher confirms the final status against the rubric (plan 2.4), and a single
 * answer, skip or audio failure can never assign mastery.
 *
 * - mastered: at least 2 independent successes, at least 1 of them at the top band
 * - developing: at least 1 success (independent or prompted) but not mastered
 * - not_yet: at least 2 incorrect and no success
 * - insufficient: anything else (for example only skips, or a single incorrect)
 */
export function suggestFromAttempts(attempts: ObservedAttempt[]): SkillStatus {
  const ind = attempts.filter((a) => a.observation === 'independent');
  const prompted = attempts.filter((a) => a.observation === 'prompted').length;
  const incorrect = attempts.filter((a) => a.observation === 'incorrect').length;
  if (ind.length >= 2 && ind.some((a) => a.band >= TOP_BAND)) return 'mastered';
  if (ind.length + prompted >= 1) return 'developing';
  if (incorrect >= 2) return 'not_yet';
  return 'insufficient';
}

/** Session limits. A limit or timeout stops the session; it never counts as failure. */
export const STOPPING = {
  /** Items per session across all skills. */
  maxItems: 16,
  /** Items on one skill before moving on. */
  maxItemsPerSkill: 4,
  /** Consecutive skips on one skill before moving on (ability stays undecided). */
  maxSkipsPerSkill: 2,
  /** Suggested session length; the app shows it, the teacher decides. */
  targetMinutes: 20,
} as const;

/** True when a skill has enough evidence to stop asking about it. */
export function skillSettled(attempts: ObservedAttempt[]): boolean {
  const s = suggestFromAttempts(attempts);
  if (s === 'mastered' || s === 'not_yet') return true;
  const skips = attempts.filter((a) => a.observation === 'skipped').length;
  return attempts.length >= STOPPING.maxItemsPerSkill || skips >= STOPPING.maxSkipsPerSkill;
}

/** The follow-up rules the engine applies, in words, for educator review and the session log. */
export const ADAPTATION_RULES: Record<Observation, string> = {
  independent: 'Offer a harder band, or a different format at the top band; move on once mastery evidence is met.',
  prompted: 'Offer another example at the same band in a different format.',
  incorrect: 'Check the first prerequisite with no evidence yet; otherwise offer another format at the entry band.',
  skipped: 'Leave ability undecided and offer an alternative item; after 2 skips on a skill, move on.',
};

/** Offline pack targets per language (plan section 3, "Offline scope"). */
export const OFFLINE_TARGETS = {
  /** Every skill has at least this many question families (task formats). */
  minFamiliesPerSkill: 2,
  /** Voiced variants installed per family and band (bounded so the audio pack stays small). */
  voicedVariantsPerFamilyBand: 6,
  /** Repeat policy: an item a learner has seen is not offered again while unseen eligible items remain. */
  repeatPolicy: 'no-repeat-until-exhausted',
  /** Storage budget for one language's audio pack on the phone. */
  maxAudioPackMB: 15,
} as const;
