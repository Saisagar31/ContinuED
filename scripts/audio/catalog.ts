/**
 * Audio catalog (task 10): the distinct spoken strings per language that a
 * pack build would voice. Only content strings go in here — never learner data.
 */
import { createHash } from 'node:crypto';
import type { LangCode } from '../../shared/domain';
import { CONTENT_VERSION, SKILLS } from '../../src/content/skills';

export type SpokenKind = 'instruction' | 'activity' | 'oral_check';

/** One spoken string from a content source. */
export interface SpokenString {
  contentId: string;
  lang: LangCode;
  text: string;
  approved: boolean;
  kind: SpokenKind;
}

/** Voice settings sent to the provider. Part of the dedupe key. */
export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  speed: number;
  use_speaker_boost: boolean;
}

/** Documented provider defaults (text-to-speech/convert page), pinned so the key is stable. */
export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0,
  speed: 1,
  use_speaker_boost: true,
};

export interface VoiceConfig {
  voiceId: string;
  modelId: string;
  settings: VoiceSettings;
}

/** One recording to generate. Several content IDs can share it when the text is identical. */
export interface CatalogClip {
  dedupeKey: string; // hex sha256 of [text, lang, voiceId, modelId, settings]
  textSha256: string; // hex sha256 of the exact text
  lang: LangCode;
  text: string;
  contentIds: string[];
  /** true only when every source string was approved by a reviewer. */
  approved: boolean;
}

export const sha256Hex = (data: string | Uint8Array): string => createHash('sha256').update(data).digest('hex');

/** Settings serialised with sorted keys so key order never changes the hash. */
function stableSettings(s: VoiceSettings): [string, unknown][] {
  return Object.entries(s).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

export function dedupeKey(text: string, lang: LangCode, voice: VoiceConfig): string {
  return sha256Hex(JSON.stringify([text, lang, voice.voiceId, voice.modelId, stableSettings(voice.settings)]));
}

/**
 * Group strings into unique clips. Unapproved strings are dropped unless
 * includeUnapproved is set (they are then voiced but stay 'unreviewed').
 */
export function buildCatalog(strings: SpokenString[], voice: VoiceConfig, opts: { includeUnapproved?: boolean; langs?: LangCode[] } = {}): CatalogClip[] {
  const byKey = new Map<string, CatalogClip>();
  for (const s of strings) {
    if (opts.langs && !opts.langs.includes(s.lang)) continue;
    if (!s.approved && !opts.includeUnapproved) continue;
    const text = s.text.trim();
    if (!text) continue;
    const key = dedupeKey(text, s.lang, voice);
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.contentIds.includes(s.contentId)) existing.contentIds.push(s.contentId);
      existing.approved = existing.approved && s.approved;
    } else {
      byKey.set(key, { dedupeKey: key, textSha256: sha256Hex(text), lang: s.lang, text, contentIds: [s.contentId], approved: s.approved });
    }
  }
  return [...byKey.values()];
}

/**
 * Adapter for the synthetic sample skills (src/content/skills.ts). English only,
 * and nothing there is approved yet, so a real build voices nothing from it
 * unless --include-unapproved is passed.
 */
export function sampleSkillStrings(): { contentVersion: string; strings: SpokenString[] } {
  const strings: SpokenString[] = [];
  for (const skill of SKILLS) {
    strings.push({ contentId: `${skill.id}.oral`, lang: 'en', text: skill.oralCheck, approved: false, kind: 'oral_check' });
    for (const a of skill.activities) strings.push({ contentId: a.id, lang: 'en', text: a.steps, approved: false, kind: 'activity' });
  }
  return { contentVersion: CONTENT_VERSION, strings };
}
