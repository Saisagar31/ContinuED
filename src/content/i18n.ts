/**
 * Interface strings. English is complete. Hindi and Marathi carry a small set of
 * UNREVIEWED DRAFT strings so native-script rendering can be checked on phones;
 * every other key falls back to English with a visible banner.
 * Task 09 (Ramith + seven reviewers) owns the reviewed packs.
 */
import type { LangCode } from '../domain/types';

export const LANG_NAMES: Record<LangCode, { native: string; english: string; bcp47: string }> = {
  en: { native: 'English', english: 'English', bcp47: 'en-IN' },
  mr: { native: 'मराठी', english: 'Marathi', bcp47: 'mr-IN' },
  kn: { native: 'ಕನ್ನಡ', english: 'Kannada', bcp47: 'kn-IN' },
  hi: { native: 'हिन्दी', english: 'Hindi', bcp47: 'hi-IN' },
  te: { native: 'తెలుగు', english: 'Telugu', bcp47: 'te-IN' },
  ta: { native: 'தமிழ்', english: 'Tamil', bcp47: 'ta-IN' },
  ml: { native: 'മലയാളം', english: 'Malayalam', bcp47: 'ml-IN' },
};

const en = {
  'status.mastered': 'Mastered',
  'status.developing': 'Developing',
  'status.not_yet': 'Not yet',
  'status.insufficient': 'Insufficient evidence',
  'skill.num.recognition': 'Number recognition',
  'skill.num.place_value': 'Tens and ones',
  'skill.num.add_no_carry': 'Addition without carrying',
  'skill.num.sub_borrow': 'Subtraction with borrowing',
  'skill.num.fractions': 'Halves and quarters',
  'skill.lit.initial_sounds': 'Initial sounds',
  'skill.lit.decoding': 'Word decoding',
  'skill.lit.sentence_reading': 'Short-sentence reading',
  'plan.next': 'Next lesson',
  'plan.check': 'Quick check first',
  'plan.activities': 'Activities (15 minutes each)',
  'plan.group': 'Peer group',
  'plan.because': 'Why this suggestion',
  'plan.assessedIn': 'Assessed in',
  'plan.empty': 'This transfer has no skill results.',
  'plan.allMastered': 'Every skill in this transfer is mastered. Continue with the next level of your curriculum.',
  'plan.insufficient': 'There is not enough evidence to recommend a lesson. Run a short entry check with this learner.',
  'plan.oral': 'Oral check in the origin language',
} as const;

export type MsgKey = keyof typeof en;

const drafts: Partial<Record<LangCode, Partial<Record<MsgKey, string>>>> = {
  hi: {
    'status.mastered': 'सीख लिया',
    'status.developing': 'सीख रहे हैं',
    'status.not_yet': 'अभी नहीं',
    'status.insufficient': 'पर्याप्त साक्ष्य नहीं',
    'skill.num.recognition': 'संख्या पहचान',
    'skill.num.place_value': 'दहाई और इकाई',
    'skill.num.add_no_carry': 'बिना हासिल का जोड़',
    'skill.num.sub_borrow': 'उधार लेकर घटाना',
    'skill.num.fractions': 'आधा और चौथाई',
    'skill.lit.initial_sounds': 'प्रारंभिक ध्वनियाँ',
    'skill.lit.decoding': 'शब्द पढ़ना',
    'skill.lit.sentence_reading': 'छोटे वाक्य पढ़ना',
    'plan.next': 'अगला पाठ',
    'plan.activities': 'गतिविधियाँ (15 मिनट)',
  },
  mr: {
    'status.mastered': 'आत्मसात',
    'status.developing': 'शिकत आहे',
    'status.not_yet': 'अजून नाही',
    'status.insufficient': 'पुरेसा पुरावा नाही',
    'skill.num.recognition': 'संख्या ओळख',
    'skill.num.place_value': 'दशक आणि एकक',
    'skill.num.add_no_carry': 'हातचा न घेता बेरीज',
    'skill.num.sub_borrow': 'हातचा घेऊन वजाबाकी',
    'skill.num.fractions': 'अर्धा आणि पाव',
    'skill.lit.initial_sounds': 'सुरुवातीचे ध्वनी',
    'skill.lit.decoding': 'शब्द वाचन',
    'skill.lit.sentence_reading': 'लहान वाक्य वाचन',
    'plan.next': 'पुढील पाठ',
    'plan.activities': 'उपक्रम (15 मिनिटे)',
  },
};

export function t(lang: LangCode, key: MsgKey): string {
  return drafts[lang]?.[key] ?? en[key];
}

/** 'complete' | 'draft' (some unreviewed strings) | 'fallback' (English only). */
export function packState(lang: LangCode): 'complete' | 'draft' | 'fallback' {
  if (lang === 'en') return 'complete';
  return drafts[lang] ? 'draft' : 'fallback';
}

export function missingKeys(lang: LangCode): MsgKey[] {
  return (Object.keys(en) as MsgKey[]).filter((k) => lang !== 'en' && !drafts[lang]?.[k]);
}

export const skillName = (lang: LangCode, id: string) => t(lang, `skill.${id}` as MsgKey) ?? id;
