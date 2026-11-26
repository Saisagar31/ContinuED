/**
 * Language pack shape (tasks 04 + 09, owned by Ramith).
 *
 * One pack per language holds everything a teacher or learner reads or hears
 * in that language: interface text, skill names, peer groups, oral checks,
 * rubric descriptors, activities, numeracy question templates and literacy
 * stimuli. The English pack is the master: every other pack must have exactly
 * the same keys and the same {placeholders} (checked by content.test.ts).
 */
import type { LangCode } from '../../domain/types';

export const SKILL_IDS = [
  'num.recognition',
  'num.place_value',
  'num.add_no_carry',
  'num.sub_borrow',
  'num.fractions',
  'lit.initial_sounds',
  'lit.decoding',
  'lit.sentence_reading',
] as const;
export type SkillId = (typeof SKILL_IDS)[number];

/** Question-template keys. Numeracy templates may contain {placeholders}. */
export const Q_KEYS = [
  'nr.say',
  'nr.after',
  'nr.bigger',
  'pv.split',
  'pv.ans',
  'pv.join',
  'pv.sticks',
  'add.bare',
  'add.story',
  'add.missing',
  'sub.bare',
  'sub.story',
  'fr.half',
  'fr.quarter',
  'fr.share',
  'is.ask',
  'is.same',
  'is.sameAns',
  'dc.read',
  'dc.find',
  'sr.read',
  'sr.readAns',
  'sr.comp',
] as const;
export type QKey = (typeof Q_KEYS)[number];

export interface SkillPackText {
  name: string;
  /** Short peer-group label for the receiving teacher. */
  group: string;
  /** One oral check the receiving teacher can run in this language. */
  oral: string;
  /** What each confirmed status looks like for this skill. */
  rubric: { mastered: string; developing: string; not_yet: string };
  /** Same order and count as the activities in the skill graph. */
  activities: { title: string; steps: string }[];
}

/** A word whose first sound the learner names. `s` must be a prefix of `w`. */
export interface SoundItem {
  w: string;
  s: string;
}

/** A sentence to read, with one comprehension question and its answer. */
export interface SentenceItem {
  text: string;
  q: string;
  a: string;
}

/**
 * Literacy stimuli are authored per language and script, never translated word-for-word.
 * Index 0 = band 1, 1 = band 2. APPEND-ONLY: an entry's position is its repeat-protection ID
 * (questions.ts), so fix spellings in place and add new entries at the end.
 */
export interface LiteracyStimuli {
  sounds: [SoundItem[], SoundItem[]];
  words: [string[], string[]];
  sentences: [SentenceItem[], SentenceItem[]];
}

export interface LangPack<K extends string = string> {
  lang: LangCode;
  /** 'approved' only after a named native-speaker reviewer signs off (docs/CONTENT_REVIEW.md). */
  reviewStatus: 'draft' | 'approved';
  reviewedBy: string | null;
  reviewedOn: string | null;
  ui: Record<K, string>;
  skills: Record<SkillId, SkillPackText>;
  q: Record<QKey, string>;
  lit: LiteracyStimuli;
}
