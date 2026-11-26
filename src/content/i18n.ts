/**
 * Interface strings for all seven languages, read from the language packs in
 * ./packs (task 09). Every pack has every key (checked at compile time and by
 * content.test.ts). Non-English packs are unreviewed drafts until a named
 * native-speaker reviewer approves them, and the app shows a banner until then.
 */
import type { LangCode } from '../domain/types';
import { PACKS, en, fill, skillText, type MsgKey } from './packs';

export type { MsgKey };

export const LANG_NAMES: Record<LangCode, { native: string; english: string; bcp47: string }> = {
  en: { native: 'English', english: 'English', bcp47: 'en-IN' },
  mr: { native: 'मराठी', english: 'Marathi', bcp47: 'mr-IN' },
  kn: { native: 'ಕನ್ನಡ', english: 'Kannada', bcp47: 'kn-IN' },
  hi: { native: 'हिन्दी', english: 'Hindi', bcp47: 'hi-IN' },
  te: { native: 'తెలుగు', english: 'Telugu', bcp47: 'te-IN' },
  ta: { native: 'தமிழ்', english: 'Tamil', bcp47: 'ta-IN' },
  ml: { native: 'മലയാളം', english: 'Malayalam', bcp47: 'ml-IN' },
};

/** Interface text in `lang`, with optional {placeholder} values. Falls back to English per key. */
export function t(lang: LangCode, key: MsgKey, vars?: Record<string, string | number>): string {
  const s = PACKS[lang]?.ui[key] ?? en.ui[key];
  return vars ? fill(s, vars) : s;
}

/**
 * True only when a named reviewer approved this language's content (questions,
 * rubric, activities). Unlike packState, English is not exempt: it is the
 * translation master, but its content still needs educator approval.
 */
export function contentReviewed(lang: LangCode): boolean {
  return PACKS[lang]?.reviewStatus === 'approved';
}

/**
 * Interface translation state, for the app-wide banner.
 * 'complete' = English master or a reviewer-approved pack;
 * 'draft' = every key present but not yet reviewed;
 * 'fallback' = no pack, English shown.
 */
export function packState(lang: LangCode): 'complete' | 'draft' | 'fallback' {
  if (lang === 'en') return 'complete';
  const p = PACKS[lang];
  if (!p) return 'fallback';
  return p.reviewStatus === 'approved' && missingKeys(lang).length === 0 ? 'complete' : 'draft';
}

export function missingKeys(lang: LangCode): MsgKey[] {
  if (lang === 'en') return [];
  const ui = PACKS[lang]?.ui as Partial<Record<MsgKey, string>> | undefined;
  return (Object.keys(en.ui) as MsgKey[]).filter((k) => !ui?.[k]?.trim());
}

export const skillName = (lang: LangCode, id: string) => skillText(lang, id)?.name ?? id;
