/**
 * Question families and generators (task 04, owned by Ramith).
 *
 * Each skill has at least two question families (task formats) at each band.
 * A family enumerates a FINITE set of variant keys per band, so the engine can
 * pick an unseen item, detect exhaustion, and an offline pack can list exactly
 * which items it covers.
 *
 * Rules every family follows (checked by content.test.ts):
 *  - Numeracy variants satisfy the skill's constraint (for example "no carrying"),
 *    and the expected answer is computed from the operands.
 *  - `itemId` is the canonical identity used for repeat protection. Numeracy IDs
 *    do not include the language, so reassessing in another language still
 *    avoids items the learner has seen. Equivalent orderings (23 + 14 and
 *    14 + 23) share one ID.
 *  - Literacy stimuli come from the language pack, authored per language. A
 *    reading stimulus is never voiced (audio is 'instruction' or 'none').
 */
import type { ContentItem, ContentPack } from '../../shared/contracts';
import type { LangCode } from '../domain/types';
import { CONTENT_VERSION } from './skills';
import { fill, pack, placeholders, type QKey, type SkillId } from './packs';
import { BANDS, OFFLINE_TARGETS, type Band } from './rubric';

export type AudioPolicy = ContentItem['audio'];

export interface QuestionItem {
  /**
   * Canonical identity for repeat protection. Shared by formats that use the same
   * operands or the same authored stimulus, so they count as one exposure.
   */
  itemId: string;
  /** Unique, stable ID of this exact question (family + variant key): the ContentPack itemId. */
  contentItemId: string;
  familyId: string;
  skillId: SkillId;
  band: Band;
  lang: LangCode;
  /** Said to the learner, in the assessment language. */
  prompt: string;
  /** Shown to the learner (number, sum, word, sentence). Never voiced for literacy. */
  stimulus?: string;
  expected: string;
  /** Scoring guidance: what a mastered response looks like for this skill. */
  scoring: string;
  audio: AudioPolicy;
  /** Exact text an approved clip for this item must contain ('' when audio is 'none'). */
  spoken: string;
  /** Clip lookup ID: one per family when the instruction never changes, else the contentItemId. */
  audioContentId: string;
}

interface Rendered {
  prompt: string;
  stimulus?: string;
  expected: string;
}

interface Family {
  id: string;
  skillId: SkillId;
  bands: Band[];
  audio: AudioPolicy;
  /** Template key in the language pack that holds the spoken instruction. */
  template: QKey;
  keys(band: Band, lang: LangCode): string[];
  identity(key: string, lang: LangCode): string;
  render(key: string, band: Band, lang: LangCode): Rendered;
}

const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
const nums = (key: string) => key.split(',').map(Number);
const tens = (n: number) => Math.floor(n / 10);
const ones = (n: number) => n % 10;

// ---------------------------------------------------------------------------
// Numeracy variant spaces. Each returns keys "a" or "a,b".
// ---------------------------------------------------------------------------

const recognitionRange = (band: Band) => (band === 1 ? range(1, 20) : range(21, 99));

function biggerPairs(band: Band): string[] {
  if (band === 1) return range(1, 20).flatMap((x) => range(x + 1, Math.min(20, x + 5)).map((y) => `${x},${y}`));
  // Digit reversals are the classic band-2 error (38 vs 83).
  return range(1, 9).flatMap((t) => range(t + 1, 9).map((o) => `${10 * t + o},${10 * o + t}`));
}

const placeValueNumbers = (band: Band) =>
  band === 1 ? range(11, 50).filter((n) => ones(n) !== 0) : [...range(51, 99), ...range(1, 9).map((t) => t * 10)];

const stickPairs = (band: Band) =>
  (band === 1 ? range(1, 4) : range(5, 9)).flatMap((t) => (band === 1 ? range(1, 9) : range(0, 9)).map((o) => `${t},${o}`));

/** a + b with no carrying in either column. Band 1: 2-digit + 1-digit; band 2: 2-digit + 2-digit (a <= b, one key per pair). */
function additionPairs(band: Band): string[] {
  if (band === 1) return range(10, 89).flatMap((a) => range(1, 9 - ones(a)).map((b) => `${a},${b}`));
  return range(10, 89).flatMap((a) =>
    range(a, 89)
      .filter((b) => ones(a) + ones(b) <= 9 && tens(a) + tens(b) <= 9)
      .map((b) => `${a},${b}`),
  );
}

/** a − b that needs borrowing: ones(b) > ones(a). Band 1: b is one digit; band 2: b is two digits with fewer tens. */
function subtractionPairs(band: Band): string[] {
  if (band === 1) return range(20, 99).flatMap((a) => range(ones(a) + 1, 9).map((b) => `${a},${b}`));
  return range(30, 99).flatMap((a) =>
    range(10, a - 1)
      .filter((b) => ones(b) > ones(a) && tens(b) < tens(a))
      .map((b) => `${a},${b}`),
  );
}

const shares = (band: Band) => (band === 1 ? range(2, 10).map((x) => `${x * 2},2`) : range(1, 7).map((x) => `${x * 4},4`));

// ---------------------------------------------------------------------------
// Literacy helpers
// ---------------------------------------------------------------------------

const lit = (lang: LangCode) => pack(lang).lit;
const q = (lang: LangCode, k: QKey, vars?: Record<string, string | number>) => fill(pack(lang).q[k], vars);

/** Three words: the target and two others from the same band, in a rotating order. */
function findChoices(words: string[], w: string): string[] {
  const i = words.indexOf(w);
  const others = [words[(i + 1) % words.length], words[(i + 3) % words.length]];
  const all = [w, ...others];
  const r = i % 3;
  return [...all.slice(r), ...all.slice(0, r)];
}

/** Stable keys "<band>.<index>" for a band of an authored list. */
const litKeys = <T>(lists: [T[], T[]], band: Band) => lists[band - 1].map((_, i) => `${band}.${i}`);
/** The authored entry for a "<band>.<index>" key. */
function at<T>(lists: [T[], T[]], key: string): T {
  const [b, i] = key.split('.').map(Number);
  const x = lists[b - 1]?.[i];
  if (x === undefined) throw new Error(`No literacy stimulus ${key}`);
  return x;
}

// ---------------------------------------------------------------------------
// Families
// ---------------------------------------------------------------------------

export const FAMILIES: Family[] = [
  // Number recognition
  {
    id: 'nr.say', skillId: 'num.recognition', bands: [1, 2], audio: 'instruction', template: 'nr.say',
    keys: (b) => recognitionRange(b).map(String),
    identity: (k) => `nr.say:${k}`,
    render: (k, _b, l) => ({ prompt: q(l, 'nr.say'), stimulus: k, expected: k }),
  },
  {
    id: 'nr.after', skillId: 'num.recognition', bands: [1, 2], audio: 'full', template: 'nr.after',
    keys: (b) => (b === 1 ? range(1, 19) : range(20, 98)).map(String),
    identity: (k) => `nr.after:${k}`,
    render: (k, _b, l) => ({ prompt: q(l, 'nr.after', { n: k }), expected: String(Number(k) + 1) }),
  },
  {
    id: 'nr.bigger', skillId: 'num.recognition', bands: [1, 2], audio: 'instruction', template: 'nr.bigger',
    keys: (b) => biggerPairs(b),
    identity: (k) => {
      const [x, y] = nums(k);
      return `nr.bigger:${Math.min(x, y)},${Math.max(x, y)}`;
    },
    render: (k, _b, l) => {
      const [x, y] = nums(k);
      const shown = (x + y) % 2 === 0 ? [x, y] : [y, x];
      return { prompt: q(l, 'nr.bigger'), stimulus: `${shown[0]}   ${shown[1]}`, expected: String(Math.max(x, y)) };
    },
  },
  // Tens and ones
  {
    id: 'pv.split', skillId: 'num.place_value', bands: [1, 2], audio: 'full', template: 'pv.split',
    keys: (b) => placeValueNumbers(b).map(String),
    identity: (k) => `pv.split:${k}`,
    render: (k, _b, l) => {
      const n = Number(k);
      return { prompt: q(l, 'pv.split', { n }), expected: q(l, 'pv.ans', { t: tens(n), o: ones(n) }) };
    },
  },
  {
    id: 'pv.join', skillId: 'num.place_value', bands: [1, 2], audio: 'full', template: 'pv.join',
    keys: (b) => placeValueNumbers(b).map(String),
    identity: (k) => `pv.join:${k}`,
    render: (k, _b, l) => {
      const n = Number(k);
      return { prompt: q(l, 'pv.join', { t: tens(n), o: ones(n) }), expected: String(n) };
    },
  },
  {
    id: 'pv.sticks', skillId: 'num.place_value', bands: [1, 2], audio: 'full', template: 'pv.sticks',
    keys: (b) => stickPairs(b),
    identity: (k) => `pv.sticks:${k}`,
    render: (k, _b, l) => {
      const [t, o] = nums(k);
      return { prompt: q(l, 'pv.sticks', { t, o }), expected: String(t * 10 + o) };
    },
  },
  // Addition without carrying
  {
    id: 'add.bare', skillId: 'num.add_no_carry', bands: [1, 2], audio: 'instruction', template: 'add.bare',
    keys: additionPairs,
    identity: (k) => `add.bare:${nums(k).sort((a, b) => a - b).join('+')}`,
    render: (k, _b, l) => {
      const [a, b] = nums(k);
      return { prompt: q(l, 'add.bare'), stimulus: `${a} + ${b} = ?`, expected: String(a + b) };
    },
  },
  {
    id: 'add.story', skillId: 'num.add_no_carry', bands: [1, 2], audio: 'full', template: 'add.story',
    keys: additionPairs,
    identity: (k) => `add.story:${nums(k).sort((a, b) => a - b).join('+')}`,
    render: (k, _b, l) => {
      const [a, b] = nums(k);
      return { prompt: q(l, 'add.story', { a, b }), expected: String(a + b) };
    },
  },
  {
    id: 'add.missing', skillId: 'num.add_no_carry', bands: [1, 2], audio: 'instruction', template: 'add.missing',
    keys: additionPairs,
    identity: (k) => `add.missing:${k}`,
    render: (k, _b, l) => {
      const [a, b] = nums(k);
      return { prompt: q(l, 'add.missing'), stimulus: `${a} + ☐ = ${a + b}`, expected: String(b) };
    },
  },
  // Subtraction with borrowing
  {
    id: 'sub.bare', skillId: 'num.sub_borrow', bands: [1, 2], audio: 'instruction', template: 'sub.bare',
    keys: subtractionPairs,
    identity: (k) => `sub.bare:${nums(k).join('-')}`,
    render: (k, _b, l) => {
      const [a, b] = nums(k);
      return { prompt: q(l, 'sub.bare'), stimulus: `${a} − ${b} = ?`, expected: String(a - b) };
    },
  },
  {
    id: 'sub.story', skillId: 'num.sub_borrow', bands: [1, 2], audio: 'full', template: 'sub.story',
    keys: subtractionPairs,
    identity: (k) => `sub.story:${nums(k).join('-')}`,
    render: (k, _b, l) => {
      const [a, b] = nums(k);
      return { prompt: q(l, 'sub.story', { a, b }), expected: String(a - b) };
    },
  },
  // Halves and quarters
  {
    id: 'fr.half', skillId: 'num.fractions', bands: [1], audio: 'full', template: 'fr.half',
    keys: () => range(1, 10).map((x) => String(x * 2)),
    identity: (k) => `fr.half:${k}`,
    render: (k, _b, l) => ({ prompt: q(l, 'fr.half', { n: k }), expected: String(Number(k) / 2) }),
  },
  {
    id: 'fr.quarter', skillId: 'num.fractions', bands: [2], audio: 'full', template: 'fr.quarter',
    keys: () => range(1, 7).map((x) => String(x * 4)),
    identity: (k) => `fr.quarter:${k}`,
    render: (k, _b, l) => ({ prompt: q(l, 'fr.quarter', { n: k }), expected: String(Number(k) / 4) }),
  },
  {
    id: 'fr.share', skillId: 'num.fractions', bands: [1, 2], audio: 'full', template: 'fr.share',
    keys: shares,
    identity: (k) => `fr.share:${nums(k).join('/')}`,
    render: (k, _b, l) => {
      const [n, kk] = nums(k);
      return { prompt: q(l, 'fr.share', { n, k: kk }), expected: String(n / kk) };
    },
  },
  // Literacy keys are stable positions "<band>.<index>" into the pack's lists, not the text itself,
  // so a reviewer's spelling fix cannot reset repeat protection. Pack lists are append-only.
  // Initial sounds (the spoken word is the task, so it may be voiced)
  {
    id: 'is.ask', skillId: 'lit.initial_sounds', bands: [1, 2], audio: 'full', template: 'is.ask',
    keys: (b, l) => litKeys(lit(l).sounds, b),
    identity: (k, l) => `lit.initial_sounds:${l}:${k}`,
    render: (k, _b, l) => {
      const s = at(lit(l).sounds, k);
      return { prompt: q(l, 'is.ask', { w: s.w }), expected: s.s };
    },
  },
  {
    id: 'is.same', skillId: 'lit.initial_sounds', bands: [1, 2], audio: 'full', template: 'is.same',
    keys: (b, l) => litKeys(lit(l).sounds, b),
    identity: (k, l) => `lit.initial_sounds:${l}:${k}`,
    render: (k, _b, l) => {
      const s = at(lit(l).sounds, k);
      return { prompt: q(l, 'is.same', { w: s.w }), expected: q(l, 'is.sameAns', { s: s.s }) };
    },
  },
  // Word decoding (the word is never voiced)
  {
    id: 'dc.read', skillId: 'lit.decoding', bands: [1, 2], audio: 'instruction', template: 'dc.read',
    keys: (b, l) => litKeys(lit(l).words, b),
    identity: (k, l) => `lit.decoding:${l}:${k}`,
    render: (k, _b, l) => {
      const w = at(lit(l).words, k);
      return { prompt: q(l, 'dc.read'), stimulus: w, expected: w };
    },
  },
  {
    // The teacher says the target word; the learner finds it among three written words.
    // No app audio, so a clip can never read out the target in place of the teacher.
    id: 'dc.find', skillId: 'lit.decoding', bands: [1, 2], audio: 'none', template: 'dc.find',
    keys: (b, l) => litKeys(lit(l).words, b),
    identity: (k, l) => `lit.decoding:${l}:${k}`,
    render: (k, b, l) => {
      const w = at(lit(l).words, k);
      return { prompt: q(l, 'dc.find', { w }), stimulus: findChoices(lit(l).words[b - 1], w).join('   '), expected: w };
    },
  },
  // Short-sentence reading (the sentence is never voiced)
  {
    id: 'sr.read', skillId: 'lit.sentence_reading', bands: [1, 2], audio: 'instruction', template: 'sr.read',
    keys: (b, l) => litKeys(lit(l).sentences, b),
    identity: (k, l) => `lit.sentence_reading:${l}:${k}`,
    render: (k, _b, l) => ({ prompt: q(l, 'sr.read'), stimulus: at(lit(l).sentences, k).text, expected: q(l, 'sr.readAns') }),
  },
  {
    // The comprehension question repeats words from the sentence, so voicing it before the
    // child reads would give the reading away. The teacher asks it after the reading:
    // no app audio until educators decide otherwise.
    id: 'sr.comp', skillId: 'lit.sentence_reading', bands: [1, 2], audio: 'none', template: 'sr.comp',
    keys: (b, l) => litKeys(lit(l).sentences, b),
    identity: (k, l) => `lit.sentence_reading:${l}:${k}`,
    render: (k, _b, l) => {
      const s = at(lit(l).sentences, k);
      return { prompt: q(l, 'sr.comp', { q: s.q }), stimulus: s.text, expected: s.a };
    },
  },
];

export const FAMILY_BY_ID: Record<string, Family> = Object.fromEntries(FAMILIES.map((f) => [f.id, f]));

export function familiesFor(skillId: string, band: Band): Family[] {
  return FAMILIES.filter((f) => f.skillId === skillId && f.bands.includes(band));
}

export function buildItem(familyId: string, key: string, band: Band, lang: LangCode): QuestionItem {
  const f = FAMILY_BY_ID[familyId];
  if (!f) throw new Error(`Unknown question family ${familyId}`);
  const r = f.render(key, band, lang);
  const itemId = f.identity(key, lang);
  const contentItemId = `${f.id}:${key}`;
  const fixedInstruction = placeholders(pack(lang).q[f.template]).length === 0;
  return {
    itemId,
    contentItemId,
    familyId: f.id,
    skillId: f.skillId,
    band,
    lang,
    prompt: r.prompt,
    ...(r.stimulus !== undefined ? { stimulus: r.stimulus } : {}),
    expected: r.expected,
    scoring: pack(lang).skills[f.skillId].rubric.mastered,
    audio: f.audio,
    spoken: f.audio === 'none' ? '' : r.prompt,
    // Family-scoped: two formats can share an itemId while saying different things.
    audioContentId: f.audio === 'instruction' && fixedInstruction ? `${f.id}.instruction` : contentItemId,
  };
}

/**
 * Clip lookup ID for an item. A fixed instruction is one clip per family. Any
 * other voiced prompt is scoped to its family, because two families can share
 * one canonical itemId (is.ask and is.same both use "lit.initial_sounds:<lang>:<word>")
 * while saying different things; without the family prefix both would look up
 * the same clip. The audio build (scripts/audio/catalog.ts) reads this value
 * from the items, so the two can never drift apart.
 */
function audioContentIdFor(familyId: string, audio: AudioPolicy, fixedInstruction: boolean, itemId: string): string {
  if (audio === 'instruction' && fixedInstruction) return `${familyId}.instruction`;
  return itemId.startsWith(`${familyId}:`) ? itemId : `${familyId}:${itemId}`;
}

/** Every item for a skill and band in `lang`, one per canonical identity, minus `seen`. */
export function eligibleItems(skillId: string, band: Band, lang: LangCode, seen: ReadonlySet<string> = new Set()): QuestionItem[] {
  const out: QuestionItem[] = [];
  const ids = new Set<string>();
  for (const f of familiesFor(skillId, band)) {
    for (const k of f.keys(band, lang)) {
      const id = f.identity(k, lang);
      if (seen.has(id) || ids.has(`${f.id}|${id}`)) continue;
      ids.add(`${f.id}|${id}`);
      out.push(buildItem(f.id, k, band, lang));
    }
  }
  return out;
}

/** Evenly spaced pick of n items, deterministic, so every build of a pack is identical. */
function spread<T>(xs: T[], n: number): T[] {
  if (xs.length <= n) return xs;
  return Array.from({ length: n }, (_, i) => xs[Math.floor((i * xs.length) / n)]);
}

/**
 * The bounded set of items an offline pack installs for `lang`: up to
 * OFFLINE_TARGETS.voicedVariantsPerFamilyBand per family and band. Families with
 * fewer variants (literacy lists, quarters) are included in full.
 */
export function offlineVariants(lang: LangCode, perFamilyBand: number = OFFLINE_TARGETS.voicedVariantsPerFamilyBand): QuestionItem[] {
  const out: QuestionItem[] = [];
  for (const f of FAMILIES) {
    for (const band of BANDS) {
      if (!f.bands.includes(band)) continue;
      for (const k of spread(f.keys(band, lang), perFamilyBand)) out.push(buildItem(f.id, k, band, lang));
    }
  }
  return out;
}

/** The offline subset in the shared ContentPack contract (checked by checkContentPack). */
export function toContentPack(lang: LangCode): ContentPack {
  const status = pack(lang).reviewStatus;
  return {
    contentVersion: CONTENT_VERSION,
    lang,
    items: offlineVariants(lang).map((i) => ({
      itemId: i.contentItemId,
      skillId: i.skillId,
      version: CONTENT_VERSION,
      band: i.band,
      lang,
      prompt: i.prompt,
      ...(i.stimulus !== undefined ? { stimulus: i.stimulus } : {}),
      expected: i.expected,
      scoring: i.scoring,
      audio: i.audio,
      reviewStatus: status,
    })),
  };
}

/** Distinct question clips to voice for `lang`: one per audioContentId. */
export function questionSpokenStrings(lang: LangCode): { contentId: string; text: string }[] {
  const byId = new Map<string, string>();
  for (const i of offlineVariants(lang)) if (i.spoken) byId.set(i.audioContentId, i.spoken);
  return [...byId].map(([contentId, text]) => ({ contentId, text }));
}
