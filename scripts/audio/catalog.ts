/**
 * Audio catalog (task 10): the distinct spoken strings per language that a
 * pack build would voice. Only content strings go in here — never learner data.
 */
import { createHash } from 'node:crypto';
import { LANGS, type LangCode } from '../../shared/domain';
import { fixedSpokenStrings, PACKS } from '../../src/content/packs';
import { offlineVariants } from '../../src/content/questions';
import { OFFLINE_TARGETS } from '../../src/content/rubric';
import { ACTIVITY_IDS, CONTENT_VERSION } from '../../src/content/skills';

/** 'instruction' = fixed or templated instruction (stimulus shown, not voiced); 'question' = whole prompt voiced (audio 'full'). */
export type SpokenKind = 'instruction' | 'question' | 'activity' | 'oral_check';

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

/** Literacy skills whose written stimulus is the thing being assessed: it must never be voiced. */
const READING_SKILLS = new Set(['lit.decoding', 'lit.sentence_reading']);

/**
 * Adapter for Ramith's seven language packs (src/content/packs) and question
 * families (src/content/questions.ts). Per language it lists:
 *  - question prompts the installed offline pack can present, from
 *    offlineVariants() — the same bounded subset toContentPack() ships, capped at
 *    `perFamilyBand` variants per family and band (default
 *    OFFLINE_TARGETS.voicedVariantsPerFamilyBand in src/content/rubric.ts).
 *    Items with audio 'none' are skipped; for 'instruction' items only the
 *    instruction is voiced, never the stimulus. The contentId is the item's own
 *    audioContentId, so it is exactly what the engine puts on PresentedItem.
 *  - every oral check (`<skillId>.oral`) and activity's steps (activity ID).
 * `approved` is the pack's reviewStatus; draft packs need --include-unapproved.
 * Throws on a content bug the pipeline must not paper over: one contentId with
 * two different texts, or a reading stimulus inside voiced text.
 */
export function packSpokenStrings(
  langs: readonly LangCode[] = LANGS,
  perFamilyBand: number = OFFLINE_TARGETS.voicedVariantsPerFamilyBand,
): { contentVersion: string; strings: SpokenString[] } {
  const strings: SpokenString[] = [];
  const textById = new Map<string, string>();
  const add = (x: SpokenString) => {
    const k = `${x.lang}|${x.contentId}`;
    const prev = textById.get(k);
    if (prev !== undefined) {
      if (prev !== x.text) throw new Error(`Audio contentId ${x.contentId} (${x.lang}) has two different texts`);
      return; // same clip already listed (fixed instruction shared by every variant)
    }
    textById.set(k, x.text);
    strings.push(x);
  };
  for (const lang of langs) {
    const approved = PACKS[lang].reviewStatus === 'approved';
    for (const item of offlineVariants(lang, perFamilyBand)) {
      if (item.audio === 'none' || !item.spoken) continue;
      if (READING_SKILLS.has(item.skillId) && item.audio !== 'instruction') {
        throw new Error(`Reading item ${item.itemId} (${lang}) has audio '${item.audio}'; reading stimuli are never voiced`);
      }
      if (item.audio === 'instruction' && item.stimulus && item.spoken.includes(item.stimulus)) {
        throw new Error(`Item ${item.itemId} (${lang}) would voice its own stimulus`);
      }
      add({ contentId: item.audioContentId, lang, text: item.spoken, approved, kind: item.audio === 'full' ? 'question' : 'instruction' });
    }
  }
  for (const f of fixedSpokenStrings(ACTIVITY_IDS)) if (langs.includes(f.lang)) add({ ...f });
  return { contentVersion: CONTENT_VERSION, strings };
}
