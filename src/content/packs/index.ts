/**
 * All seven language packs (task 09) and helpers to read them.
 * Interface language and assessment language are chosen independently; both
 * read from these packs.
 */
import type { LangCode } from '../../domain/types';
import { en, type MsgKey } from './en';
import { hi } from './hi';
import { kn } from './kn';
import { ml } from './ml';
import { mr } from './mr';
import { ta } from './ta';
import { te } from './te';
import type { LangPack, SkillId, SkillPackText } from './types';

export type { MsgKey } from './en';
export { en };
export * from './types';

export const PACKS: Record<LangCode, LangPack<MsgKey>> = { en, mr, kn, hi, te, ta, ml };

export function pack(lang: LangCode): LangPack<MsgKey> {
  return PACKS[lang] ?? en;
}

/** Replaces {name} placeholders. Unknown placeholders are left visible so a missing value is noticed. */
export function fill(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export function placeholders(s: string): string[] {
  return [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

export function skillText(lang: LangCode, id: string): SkillPackText | undefined {
  return pack(lang).skills[id as SkillId] ?? en.skills[id as SkillId];
}

/** Kinds of fixed spoken strings the audio build may voice. */
export type SpokenKind = 'oral_check' | 'activity';

export interface SpokenContent {
  contentId: string;
  lang: LangCode;
  text: string;
  approved: boolean;
  kind: SpokenKind;
}

/**
 * Fixed spoken strings per language: the receiving teacher's oral checks and
 * activity steps. Question variants are listed by offlineVariants() in
 * ../questions.ts. Content IDs are stable across languages so one clip per
 * (language, contentId) can be looked up. Never contains learner data.
 */
export function fixedSpokenStrings(activityIds: Record<string, string[]>): SpokenContent[] {
  const out: SpokenContent[] = [];
  for (const [lang, p] of Object.entries(PACKS) as [LangCode, LangPack<MsgKey>][]) {
    const approved = p.reviewStatus === 'approved';
    for (const [id, s] of Object.entries(p.skills) as [SkillId, SkillPackText][]) {
      out.push({ contentId: `${id}.oral`, lang, text: s.oral, approved, kind: 'oral_check' });
      s.activities.forEach((a, i) => {
        const aid = activityIds[id]?.[i];
        if (aid) out.push({ contentId: aid, lang, text: a.steps, approved, kind: 'activity' });
      });
    }
  }
  return out;
}
