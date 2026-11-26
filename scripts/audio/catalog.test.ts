/**
 * Pack adapter checks (task 10b): the audio catalog is built from all seven
 * language packs, never voices a reading stimulus, keeps drafts out of normal
 * builds, and uses exactly the clip IDs the assessment engine asks for.
 */
import { describe, expect, it } from 'vitest';
import { LANGS, type Attempt, type LangCode, type Observation, type PresentedItem, type Session } from '../../shared/domain';
import { nextItem } from '../../src/assess/engine';
import { PACKS } from '../../src/content/packs';
import { buildItem, offlineVariants } from '../../src/content/questions';
import { OFFLINE_TARGETS } from '../../src/content/rubric';
import { buildCatalog, DEFAULT_VOICE_SETTINGS, packSpokenStrings, type VoiceConfig } from './catalog';

const voice: VoiceConfig = { voiceId: 'v', modelId: 'm', settings: DEFAULT_VOICE_SETTINGS };
const { strings } = packSpokenStrings();
const forLang = (lang: LangCode) => strings.filter((s) => s.lang === lang);
const isQuestionClip = (kind: string) => kind === 'instruction' || kind === 'question';

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Drives the real engine for up to `steps` items, answering with a repeating observation pattern. */
function presented(lang: LangCode, pattern: Observation[], seed: number, steps = 40): PresentedItem[] {
  const s: Session = {
    id: 'S', teacherId: 'T', learnerId: 'L-TEST-0001', contentVersion: 'draft-1.0', assessmentLang: lang,
    status: 'draft', startedAt: '', updatedAt: '', attempts: [], confirmed: {}, overrides: {},
  };
  const random = seeded(seed);
  const out: PresentedItem[] = [];
  for (let n = 0; n < steps; n++) {
    const it = nextItem(s, new Set(), {}, false, { random });
    if (!it) break;
    out.push(it);
    s.attempts.push({ ...it, observation: pattern[n % pattern.length], answeredAt: '' } as Attempt);
  }
  return out;
}

describe('pack catalog (task 10b)', () => {
  it.each(LANGS)('%s: lists question, oral-check and activity strings', (lang) => {
    const mine = forLang(lang);
    for (const kind of ['instruction', 'question', 'oral_check', 'activity'] as const) expect(mine.some((s) => s.kind === kind), kind).toBe(true);
    expect(buildCatalog(mine, voice, { includeUnapproved: true }).length).toBeGreaterThan(0);
  });

  it('approval follows the pack review status: drafts are excluded without --include-unapproved', () => {
    for (const lang of LANGS) {
      const approved = PACKS[lang].reviewStatus === 'approved';
      const mine = forLang(lang);
      expect(mine.every((s) => s.approved === approved)).toBe(true);
      if (!approved) expect(buildCatalog(mine, voice)).toHaveLength(0);
    }
  });

  it.each(LANGS)('%s: no reading stimulus is voiced by the reading items', (lang) => {
    const { words, sentences } = PACKS[lang].lit;
    // No reading sentence appears in any clip of the language.
    for (const sentence of sentences.flat()) for (const s of forLang(lang)) expect(s.text.includes(sentence.text), sentence.text).toBe(false);
    const textById = new Map(forLang(lang).map((s) => [s.contentId, s.text]));
    for (const it of offlineVariants(lang)) {
      if (it.audio === 'none') continue;
      const clip = textById.get(it.audioContentId)!;
      // An instruction never contains the item's own stimulus.
      if (it.audio === 'instruction' && it.stimulus) expect(clip.includes(it.stimulus), it.itemId).toBe(false);
      // Decoding clips never contain any decoding word.
      if (it.skillId === 'lit.decoding') for (const w of words.flat()) expect(clip.includes(w), `${w} in "${clip}"`).toBe(false);
      if (it.skillId === 'lit.decoding' || it.skillId === 'lit.sentence_reading') expect(it.audio).toBe('instruction');
    }
  });

  it.each(LANGS)('%s: every offline-pack item with audio has its exact clip ID and text in the catalog', (lang) => {
    const byId = new Map(forLang(lang).map((s) => [s.contentId, s.text]));
    for (const it of offlineVariants(lang)) {
      if (it.audio === 'none') continue;
      expect(byId.get(it.audioContentId), it.audioContentId).toBe(it.spoken);
    }
  });

  it('one clip ID never stands for two texts (is.ask and is.same share an itemId, not a clip)', () => {
    const ask = buildItem('is.ask', '1.0', 1, 'mr');
    const same = buildItem('is.same', '1.0', 1, 'mr');
    expect(ask.itemId).toBe(same.itemId);
    expect(ask.audioContentId).not.toBe(same.audioContentId);
    const keys = strings.map((s) => `${s.lang}|${s.contentId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('identical text still dedupes to one clip across content IDs', () => {
    // Every family's fixed instruction is one string, and a shared text across families would be one recording.
    const c = buildCatalog(
      [
        { contentId: 'x.instruction', lang: 'mr', text: 'same', approved: true, kind: 'instruction' },
        { contentId: 'y.instruction', lang: 'mr', text: 'same', approved: true, kind: 'instruction' },
      ],
      voice,
    );
    expect(c).toHaveLength(1);
    expect(c[0].contentIds).toEqual(['x.instruction', 'y.instruction']);
  });

  it.each(LANGS)('%s: items the engine presents use catalog clip IDs where the offline pack covers them', (lang) => {
    const ids = new Set(forLang(lang).map((s) => s.contentId));
    const offline = new Set(offlineVariants(lang).map((i) => i.audioContentId));
    const patterns: Observation[][] = [['independent'], ['prompted', 'independent'], ['incorrect', 'independent', 'skipped']];
    let voiced = 0;
    let covered = 0;
    patterns.forEach((p, i) => {
      for (const it of presented(lang, p, i + 1)) {
        expect(it.audio).toBeDefined();
        if (it.audio === 'none') continue;
        voiced++;
        const id = it.audioContentId!;
        if (id.endsWith('.instruction')) expect(ids.has(id), id).toBe(true); // one clip per family: always covered
        if (offline.has(id)) expect(ids.has(id), id).toBe(true);
        if (ids.has(id)) covered++;
        // Not covered: a templated variant outside the offline subset (the engine does not yet
        // prefer installed items), so the player falls back to text / device speech.
        else expect(id.endsWith('.instruction')).toBe(false);
      }
    });
    expect(voiced).toBeGreaterThan(0);
    expect(covered).toBeGreaterThan(0);
  });

  it('the per-family-and-band variant cap is configurable and bounds question clips', () => {
    const q = (cap?: number) => packSpokenStrings(['en'], cap).strings.filter((s) => isQuestionClip(s.kind)).length;
    expect(OFFLINE_TARGETS.voicedVariantsPerFamilyBand).toBe(6);
    expect(q(2)).toBeLessThan(q());
  });
});
