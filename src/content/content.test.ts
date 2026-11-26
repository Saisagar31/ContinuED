/**
 * Content and language-pack checks (tasks 04 + 09). These are the "automated
 * completeness checks" from the plan; human review of wording, script and
 * pronunciation is still required per language (docs/CONTENT_REVIEW.md).
 */
import { describe, expect, it } from 'vitest';
import { checkContentPack } from '../../shared/guards';
import { LANGS, STATUSES, type LangCode } from '../domain/types';
import { missingKeys, packState, skillName, t } from './i18n';
import { PACKS, Q_KEYS, SKILL_IDS, en, fixedSpokenStrings, placeholders, skillText } from './packs';
import { BANDS, OFFLINE_TARGETS, suggestFromAttempts } from './rubric';
import { ACTIVITY_IDS, SKILLS } from './skills';
import { FAMILIES, buildItem, eligibleItems, familiesFor, offlineVariants, questionSpokenStrings, toContentPack } from './questions';

const NON_EN = LANGS.filter((l) => l !== 'en');

/** Unicode block of each language's script. */
const SCRIPT: Record<Exclude<LangCode, 'en'>, RegExp> = {
  hi: /[ऀ-ॿ]/,
  mr: /[ऀ-ॿ]/,
  kn: /[ಀ-೿]/,
  te: /[ఀ-౿]/,
  ta: /[஀-௿]/,
  ml: /[ഀ-ൿ]/,
};
const ALL_INDIC = /[ऀ-෿]/g;
/** Latin tokens allowed inside native-script UI strings (product and technical names). */
const ALLOWED_LATIN = /\b(ContinuED|QR|PIN|IDs|ID|CED|https)\b/g;

function allStrings(lang: LangCode): [string, string][] {
  const p = PACKS[lang];
  const out: [string, string][] = Object.entries(p.ui).map(([k, v]) => [`ui.${k}`, v]);
  for (const [id, s] of Object.entries(p.skills)) {
    out.push([`${id}.name`, s.name], [`${id}.group`, s.group], [`${id}.oral`, s.oral]);
    for (const [k, v] of Object.entries(s.rubric)) out.push([`${id}.rubric.${k}`, v]);
    s.activities.forEach((a, i) => out.push([`${id}.act${i}.title`, a.title], [`${id}.act${i}.steps`, a.steps]));
  }
  for (const [k, v] of Object.entries(p.q)) out.push([`q.${k}`, v]);
  return out;
}

function litStrings(lang: LangCode): string[] {
  const l = PACKS[lang].lit;
  return [
    ...l.sounds.flat().flatMap((x) => [x.w, x.s]),
    ...l.words.flat(),
    ...l.sentences.flat().flatMap((s) => [s.text, s.q, s.a]),
  ];
}

describe('language packs: completeness (task 09)', () => {
  it.each(LANGS)('%s has every interface key, non-empty, with the English placeholders', (lang) => {
    expect(missingKeys(lang)).toEqual([]);
    const p = PACKS[lang];
    expect(Object.keys(p.ui).sort()).toEqual(Object.keys(en.ui).sort());
    for (const [k, v] of Object.entries(p.ui)) {
      expect(v.trim(), `${lang} ui.${k}`).not.toBe('');
      expect(placeholders(v), `${lang} ui.${k}`).toEqual(placeholders(en.ui[k as keyof typeof en.ui]));
    }
  });

  it.each(LANGS)('%s has all 8 skills, rubrics, activities and question templates', (lang) => {
    const p = PACKS[lang];
    expect(Object.keys(p.skills).sort()).toEqual([...SKILL_IDS].sort());
    for (const id of SKILL_IDS) {
      const s = p.skills[id];
      for (const v of [s.name, s.group, s.oral, s.rubric.mastered, s.rubric.developing, s.rubric.not_yet]) expect(v.trim()).not.toBe('');
      expect(s.activities).toHaveLength(ACTIVITY_IDS[id].length);
      for (const a of s.activities) expect(a.title.trim() && a.steps.trim()).toBeTruthy();
    }
    expect(Object.keys(p.q).sort()).toEqual([...Q_KEYS].sort());
    for (const k of Q_KEYS) expect(placeholders(p.q[k]), `${lang} q.${k}`).toEqual(placeholders(en.q[k]));
  });

  it.each(LANGS)('%s literacy stimuli are complete and consistent', (lang) => {
    const l = PACKS[lang].lit;
    for (const b of [0, 1]) {
      expect(l.sounds[b].length).toBeGreaterThanOrEqual(6);
      expect(l.words[b].length).toBeGreaterThanOrEqual(6);
      expect(l.sentences[b].length).toBeGreaterThanOrEqual(4);
      for (const s of l.sounds[b]) expect(s.w.startsWith(s.s), `${lang}: “${s.w}” should start with “${s.s}”`).toBe(true);
      expect(new Set(l.words[b]).size).toBe(l.words[b].length);
      expect(new Set(l.sounds[b].map((x) => x.w)).size).toBe(l.sounds[b].length);
      for (const s of l.sentences[b]) expect(s.text.trim() && s.q.trim() && s.a.trim()).toBeTruthy();
    }
  });

  it('only reviewer-approved packs drop the draft banner; English is the master', () => {
    expect(packState('en')).toBe('complete');
    for (const l of NON_EN) expect(packState(l)).toBe(PACKS[l].reviewStatus === 'approved' ? 'complete' : 'draft');
    for (const l of LANGS) if (PACKS[l].reviewStatus === 'approved') expect(PACKS[l].reviewedBy, `${l} approved without a named reviewer`).toBeTruthy();
  });
});

describe('language packs: native script (task 09)', () => {
  it.each(NON_EN)('%s interface and content text is in its own script', (lang) => {
    const own = SCRIPT[lang as Exclude<LangCode, 'en'>];
    const bad: string[] = [];
    for (const [key, raw] of allStrings(lang)) {
      const s = raw.replace(/\{\w+\}/g, '').replace(ALLOWED_LATIN, '');
      if (/[A-Za-z]/.test(s)) bad.push(`${key}: Latin text “${raw}”`);
      if (/\p{L}/u.test(s.replace(/[A-Za-z]/g, '')) && !own.test(s)) bad.push(`${key}: no ${lang} script`);
      const foreign = (s.match(ALL_INDIC) ?? []).filter((c) => !own.test(c));
      if (foreign.length) bad.push(`${key}: other-script characters ${foreign.join('')}`);
    }
    expect(bad).toEqual([]);
  });

  it.each(NON_EN)('%s literacy stimuli contain no Latin or other-script letters', (lang) => {
    const own = SCRIPT[lang as Exclude<LangCode, 'en'>];
    for (const s of litStrings(lang)) {
      for (const c of s.match(/\p{L}|\p{M}/gu) ?? []) expect(own.test(c), `${lang}: “${c}” in “${s}”`).toBe(true);
    }
  });
});

describe('cross-language transfer: all 49 origin/interface combinations', () => {
  it('every stable skill ID and status renders in every interface language, with an origin-language oral check', () => {
    let combos = 0;
    for (const origin of LANGS) {
      for (const ui of LANGS) {
        combos++;
        for (const id of SKILL_IDS) {
          expect(skillName(ui, id)).not.toBe(id);
          expect(skillText(origin, id)?.oral.trim()).toBeTruthy();
          expect(skillText(ui, id)?.activities.length).toBe(2);
        }
        for (const st of STATUSES) expect(t(ui, `status.${st}`).trim()).toBeTruthy();
      }
    }
    expect(combos).toBe(49);
  });

  it('the skill graph uses exactly the pack skill IDs', () => {
    expect(SKILLS.map((s) => s.id).sort()).toEqual([...SKILL_IDS].sort());
  });

  it('t() fills placeholders', () => {
    expect(t('en', 'assess.answered', { n: 3 })).toBe('Answered: 3');
    expect(t('kn', 'assess.answered', { n: 3 })).toContain('3');
  });
});

// ---------------------------------------------------------------------------
// Question generators (task 04)
// ---------------------------------------------------------------------------

const ints = (s: string) => (s.match(/\d+/g) ?? []).map(Number);

/** Independent re-computation of each numeracy item from what is shown or said to the learner. */
function checkNumeracy(item: ReturnType<typeof buildItem>): string | null {
  const shown = item.stimulus ?? item.prompt;
  const n = ints(shown);
  const exp = Number(item.expected);
  switch (item.familyId) {
    case 'nr.say':
      return exp === n[0] && (item.band === 1 ? exp <= 20 : exp >= 21 && exp <= 99) ? null : 'number out of band';
    case 'nr.after':
      return exp === n[0] + 1 ? null : 'wrong successor';
    case 'nr.bigger':
      return exp === Math.max(n[0], n[1]) && n[0] !== n[1] ? null : 'wrong comparison';
    case 'pv.split': {
      const [num] = n;
      return item.expected === buildItem('pv.split', String(num), item.band, 'en').expected && /\d+ tens and \d+ ones/.test(item.expected) &&
        ints(item.expected)[0] * 10 + ints(item.expected)[1] === num
        ? null
        : 'tens/ones do not rebuild the number';
    }
    case 'pv.join':
    case 'pv.sticks':
      return exp === n[0] * 10 + n[1] && n[1] <= 9 ? null : 'tens/ones mismatch';
    case 'add.bare':
    case 'add.story': {
      const [a, b] = n;
      if (exp !== a + b) return 'wrong sum';
      if ((a % 10) + (b % 10) > 9 || Math.floor(a / 10) + Math.floor(b / 10) > 9) return 'needs carrying';
      return null;
    }
    case 'add.missing': {
      const [a, c] = n;
      const b = c - a;
      if (exp !== b || b < 1) return 'wrong missing addend';
      return (a % 10) + (b % 10) > 9 ? 'needs carrying' : null;
    }
    case 'sub.bare':
    case 'sub.story': {
      const [a, b] = n;
      if (exp !== a - b || exp < 0) return 'wrong difference';
      return b % 10 > a % 10 ? null : 'no borrowing needed';
    }
    case 'fr.half':
      return exp * 2 === n[0] ? null : 'not half';
    case 'fr.quarter':
      return exp * 4 === n[0] ? null : 'not a quarter';
    case 'fr.share':
      return exp * n[1] === n[0] && Number.isInteger(exp) ? null : 'unequal share';
  }
  return null;
}

describe('question families (task 04)', () => {
  it.each(LANGS)('%s: every skill has at least two task formats at every band', (lang) => {
    for (const id of SKILL_IDS) {
      for (const band of BANDS) {
        const fams = familiesFor(id, band);
        expect(fams.length, `${id} band ${band}`).toBeGreaterThanOrEqual(OFFLINE_TARGETS.minFamiliesPerSkill);
        expect(eligibleItems(id, band, lang).length, `${lang} ${id} band ${band}`).toBeGreaterThan(0);
      }
    }
  });

  it('every numeracy variant meets its constraint and has an independently correct answer', () => {
    let checked = 0;
    for (const f of FAMILIES.filter((x) => x.skillId.startsWith('num.'))) {
      for (const band of f.bands) {
        for (const k of f.keys(band, 'en')) {
          const item = buildItem(f.id, k, band, 'en');
          expect(checkNumeracy(item), `${f.id} ${k}: ${item.prompt} ${item.stimulus ?? ''} = ${item.expected}`).toBeNull();
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it('band 2 subtraction always uses a two-digit subtrahend, band 1 a one-digit one', () => {
    for (const it of eligibleItems('num.sub_borrow', 1, 'en')) expect(ints(it.stimulus ?? it.prompt)[1]).toBeLessThan(10);
    for (const it of eligibleItems('num.sub_borrow', 2, 'en')) expect(ints(it.stimulus ?? it.prompt)[1]).toBeGreaterThanOrEqual(10);
  });

  it('equivalent questions share one identity; numeracy identity ignores language', () => {
    const f = FAMILIES.find((x) => x.id === 'add.bare')!;
    expect(f.identity('23,14', 'en')).toBe(f.identity('14,23', 'en'));
    expect(buildItem('add.story', '23,14', 2, 'en').itemId).toBe(buildItem('add.story', '23,14', 2, 'ta').itemId);
    expect(buildItem('add.story', '23,14', 2, 'en').prompt).not.toBe(buildItem('add.story', '23,14', 2, 'ta').prompt);
    // The same word in two formats is one exposure, but two distinct content items.
    const a = buildItem('dc.read', '1.0', 1, 'mr');
    const b = buildItem('dc.find', '1.0', 1, 'mr');
    expect(a.itemId).toBe(b.itemId);
    expect(a.contentItemId).not.toBe(b.contentItemId);
    expect(a.stimulus).toBe(PACKS.mr.lit.words[0][0]);
  });

  it('literacy identity is the stimulus position, so a spelling fix keeps repeat protection', () => {
    const before = buildItem('dc.read', '2.3', 2, 'kn');
    const words = PACKS.kn.lit.words[1];
    const original = words[3];
    words[3] = `${original}್`; // simulate a reviewer's correction
    try {
      const after = buildItem('dc.read', '2.3', 2, 'kn');
      expect(after.itemId).toBe(before.itemId);
      expect(after.stimulus).not.toBe(before.stimulus);
    } finally {
      words[3] = original;
    }
  });

  it('seen items are excluded and exhaustion is detectable', () => {
    const all = eligibleItems('num.fractions', 2, 'en');
    const seen = new Set(all.map((i) => i.itemId));
    expect(eligibleItems('num.fractions', 2, 'en', seen)).toEqual([]);
  });

  it.each(LANGS)('%s: prompts are filled and reading stimuli are never voiced', (lang) => {
    for (const id of SKILL_IDS) {
      for (const band of BANDS) {
        for (const it of eligibleItems(id, band, lang)) {
          expect(it.prompt + it.expected).not.toMatch(/\{\w+\}/);
          if (id === 'lit.decoding' || id === 'lit.sentence_reading') {
            expect(it.audio).not.toBe('full');
            if (it.stimulus) expect(it.spoken.includes(it.stimulus)).toBe(false);
          }
        }
      }
    }
  });

  it.each(LANGS)('%s: the offline pack is bounded and passes the shared ContentPack contract', (lang) => {
    const items = offlineVariants(lang);
    const perFamilyBand = new Map<string, number>();
    for (const i of items) perFamilyBand.set(`${i.familyId}@${i.band}`, (perFamilyBand.get(`${i.familyId}@${i.band}`) ?? 0) + 1);
    for (const n of perFamilyBand.values()) expect(n).toBeLessThanOrEqual(OFFLINE_TARGETS.voicedVariantsPerFamilyBand);
    expect(checkContentPack(toContentPack(lang))).toBeNull();
    // Fixed instructions are voiced once per family, not once per variant.
    const clips = questionSpokenStrings(lang);
    expect(clips.find((c) => c.contentId === 'add.bare.instruction')).toBeTruthy();
    expect(new Set(clips.map((c) => c.contentId)).size).toBe(clips.length);
    // Every content item ID is unique, and every clip ID always means one exact text.
    const ids = toContentPack(lang).items.map((i) => i.itemId);
    expect(new Set(ids).size).toBe(ids.length);
    const textByClip = new Map<string, string>();
    for (const i of items) {
      if (!i.spoken) continue;
      const prev = textByClip.get(i.audioContentId);
      expect(prev === undefined || prev === i.spoken, `${lang} ${i.audioContentId}`).toBe(true);
      textByClip.set(i.audioContentId, i.spoken);
    }
  });

  it.each(LANGS)('%s: no voiced prompt contains a word of the reading sentence it is about', (lang) => {
    for (const band of BANDS) {
      for (const it of eligibleItems('lit.sentence_reading', band, lang)) {
        // A fixed instruction ("Read this sentence aloud.") is the same for every sentence, so it cannot leak one.
        if (!it.spoken || it.audioContentId.endsWith('.instruction')) continue;
        const words = (it.stimulus ?? '').split(/[\s.,!?।]+/u).filter((w) => w.length > 1);
        for (const w of words) expect(it.spoken.includes(w), `${lang} ${it.contentItemId} voices “${w}”`).toBe(false);
      }
    }
  });

  it('fixed spoken strings cover every oral check and activity in all seven languages', () => {
    const s = fixedSpokenStrings(ACTIVITY_IDS);
    expect(s).toHaveLength(7 * 8 * 3);
    expect(s.every((x) => x.text.trim().length > 0)).toBe(true);
  });
});

describe('rubric (task 04)', () => {
  const at = (o: 'independent' | 'prompted' | 'incorrect' | 'skipped', band = 1) => ({ observation: o, band });
  it('mastery needs two independent successes including one at the top band', () => {
    expect(suggestFromAttempts([at('independent'), at('independent')])).toBe('developing');
    expect(suggestFromAttempts([at('independent'), at('independent', 2)])).toBe('mastered');
  });
  it('a single answer, skip or prompt never assigns mastery', () => {
    expect(suggestFromAttempts([at('independent', 2)])).toBe('developing');
    expect(suggestFromAttempts([at('skipped')])).toBe('insufficient');
    expect(suggestFromAttempts([at('incorrect')])).toBe('insufficient');
    expect(suggestFromAttempts([at('incorrect'), at('incorrect')])).toBe('not_yet');
    expect(suggestFromAttempts([at('prompted', 2), at('prompted', 2)])).toBe('developing');
  });
});
