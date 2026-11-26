/**
 * Playback with a visible availability state (task 10, browser).
 * Order: exact approved clip from the active pack -> device speech in that
 * language (unreviewed) -> text only. Never throws to the UI.
 */
import { LANG_NAMES } from '../content/i18n';
import type { LangCode } from '../domain/types';
import { clipBlobFor, defaultPackDeps, type PackDeps } from './packManager';

export type Availability = 'clip' | 'device_speech' | 'text_only';

/** The parts of speechSynthesis we use. */
export interface SpeechLike {
  getVoices(): { lang: string }[];
  cancel(): void;
  speak(u: unknown): void;
}

export interface PlayerDeps {
  getClip: (lang: LangCode, contentId: string) => Promise<Blob | null>;
  playBlob: (blob: Blob) => Promise<void>;
  speech?: SpeechLike;
  makeUtterance?: (text: string, voice: { lang: string }, lang: string) => unknown;
}

export function defaultPlayerDeps(pack: PackDeps = defaultPackDeps()): PlayerDeps {
  return {
    getClip: (lang, id) => clipBlobFor(lang, id, pack),
    playBlob: async (blob) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true });
      await audio.play();
    },
    speech: typeof speechSynthesis !== 'undefined' ? speechSynthesis : undefined,
    makeUtterance: (text, voice, lang) => {
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice as SpeechSynthesisVoice;
      u.lang = lang;
      return u;
    },
  };
}

/** A device voice for the language: exact BCP 47 tag first, then any voice of that language. */
function findVoice(lang: LangCode, speech?: SpeechLike): { lang: string } | undefined {
  try {
    const voices = speech?.getVoices() ?? [];
    const tag = LANG_NAMES[lang].bcp47.toLowerCase();
    return voices.find((v) => v.lang.toLowerCase().replace('_', '-') === tag) ?? voices.find((v) => v.lang.toLowerCase().split(/[-_]/)[0] === lang);
  } catch {
    return undefined;
  }
}

/** What playFor would use, without playing anything (for the on-screen state). */
export async function availabilityFor(lang: LangCode, contentId: string, deps: PlayerDeps = defaultPlayerDeps()): Promise<Availability> {
  try {
    if (await deps.getClip(lang, contentId)) return 'clip';
  } catch {
    // fall through
  }
  return findVoice(lang, deps.speech) ? 'device_speech' : 'text_only';
}

export async function playFor(lang: LangCode, contentId: string, fallbackText: string, deps: PlayerDeps = defaultPlayerDeps()): Promise<Availability> {
  try {
    const blob = await deps.getClip(lang, contentId);
    if (blob) {
      await deps.playBlob(blob);
      return 'clip';
    }
  } catch {
    // missing/corrupt clip or autoplay blocked: try device speech
  }
  try {
    const voice = findVoice(lang, deps.speech);
    if (voice && deps.speech && deps.makeUtterance && fallbackText.trim()) {
      deps.speech.cancel();
      deps.speech.speak(deps.makeUtterance(fallbackText, voice, voice.lang));
      return 'device_speech';
    }
  } catch {
    // fall through to text
  }
  return 'text_only';
}
