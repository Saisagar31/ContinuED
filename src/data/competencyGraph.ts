// Foundational Literacy & Numeracy (FLN) skill graph. Language-agnostic:
// the text for each skill lives in src/locales/*.ts.

export type SkillId =
  | 'NUM_01'
  | 'NUM_02'
  | 'NUM_03'
  | 'NUM_04'
  | 'NUM_05'
  | 'LIT_01'
  | 'LIT_02'
  | 'LIT_03';

export type Strand = 'numeracy' | 'literacy';

// NEVER REORDER: this order is the QR wire order. Only append new skills
// (and bump the capsule version).
export const SKILLS: readonly { id: SkillId; strand: Strand; prerequisite: SkillId | null }[] = [
  { id: 'NUM_01', strand: 'numeracy', prerequisite: null }, // Number Recognition (1–99)
  { id: 'NUM_02', strand: 'numeracy', prerequisite: 'NUM_01' }, // Place Value (Tens & Ones)
  { id: 'NUM_03', strand: 'numeracy', prerequisite: 'NUM_02' }, // Addition Without Regrouping
  { id: 'NUM_04', strand: 'numeracy', prerequisite: 'NUM_03' }, // Subtraction With Regrouping
  { id: 'NUM_05', strand: 'numeracy', prerequisite: 'NUM_04' }, // Fractions (Halves & Quarters)
  { id: 'LIT_01', strand: 'literacy', prerequisite: null }, // Phonemic Awareness & Letter Sounds
  { id: 'LIT_02', strand: 'literacy', prerequisite: 'LIT_01' }, // Decoding 2–3 Syllable Words
  { id: 'LIT_03', strand: 'literacy', prerequisite: 'LIT_02' }, // Reading Short Sentences
];

export const SKILL_IDS: readonly SkillId[] = SKILLS.map((s) => s.id);
