/**
 * Task 06 acceptance checks (plan section 4, row 06, and section 5 "Dynamic assessment").
 */
import { describe, expect, it } from 'vitest';
import type { Attempt, LangCode, Observation, Session, SkillStatus } from '../domain/types';
import { eligibleItems } from '../content/questions';
import { STOPPING } from '../content/rubric';
import { nextItem, reasonText, suggestStatus, suggestStatusFor, summarise } from './engine';

/** Deterministic random source so paths are reproducible. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const base = (lang: LangCode = 'en'): Session => ({
  id: 'S1', teacherId: 'T', learnerId: 'L-TEST-0001', contentVersion: 'draft-1.0', assessmentLang: lang,
  status: 'draft', startedAt: '', updatedAt: '', attempts: [], confirmed: {}, overrides: {},
});

/** Runs a session where `respond` decides the observation for each presented item. */
function run(respond: (a: { skillId: string; band: number; n: number }) => Observation, o: { lang?: LangCode; seen?: Set<string>; prior?: Record<string, SkillStatus>; seed?: number } = {}) {
  const s = base(o.lang);
  const random = seeded(o.seed ?? 1);
  for (let n = 0; n < 40; n++) {
    const it = nextItem(s, o.seen ?? new Set(), o.prior ?? {}, false, { random });
    if (!it) break;
    s.attempts.push({ ...it, observation: respond({ skillId: it.skillId, band: it.band, n }), answeredAt: '' } as Attempt);
  }
  return s;
}

const path = (s: Session) => s.attempts.map((a) => `${a.skillId}@${a.band}`);

describe('assessment engine (task 06)', () => {
  it('learners with different response patterns follow different skill/difficulty paths', () => {
    const strong = run(() => 'independent');
    const weak = run(() => 'incorrect');
    const prompted = run(() => 'prompted');
    expect(path(strong)).not.toEqual(path(weak));
    expect(path(strong)).not.toEqual(path(prompted));
    // Strong: harder band after a success, then moves on once mastery evidence is met.
    expect(path(strong).slice(0, 3)).toEqual(['num.recognition@1', 'num.recognition@2', 'num.place_value@1']);
    expect(suggestStatusFor(strong.attempts, 'num.recognition')).toBe('mastered');
    // Prompted: stays at the same band with another example.
    expect(path(prompted).slice(0, 2)).toEqual(['num.recognition@1', 'num.recognition@1']);
  });

  it('a weak learner is not tested on skills whose prerequisite already points to "not yet"', () => {
    const weak = run(() => 'incorrect');
    const skills = new Set(weak.attempts.map((a) => a.skillId));
    expect(suggestStatusFor(weak.attempts, 'num.recognition')).toBe('not_yet');
    expect(skills.has('num.place_value')).toBe(false); // needs number recognition
    expect(skills.has('num.fractions')).toBe(false); // needs number recognition
    expect(skills.has('lit.initial_sounds')).toBe(true); // other strand still assessed
  });

  it('an incorrect answer leads to a prerequisite check when the prerequisite has no evidence', () => {
    const prior: Record<string, SkillStatus> = { 'num.recognition': 'developing' };
    const s = base();
    // One recognition success, then a wrong addition answer while place value is still untried.
    s.attempts.push({ ...nextItem(s, new Set(), {}, false, { random: seeded(2) })!, observation: 'independent', answeredAt: '' } as Attempt);
    // Jump straight to an addition attempt that is wrong, with place value untried.
    const add = eligibleItems('num.add_no_carry', 1, 'en')[0];
    s.attempts.push({ ...add, selectionReason: 'test', presentedAt: '', observation: 'incorrect', answeredAt: '' } as unknown as Attempt);
    const next = nextItem(s, new Set(), prior, false, { random: seeded(3) })!;
    expect(next.skillId).toBe('num.place_value');
    expect(next.selectionReason).toBe('prereq|num.place_value');
  });

  it('a skip offers an alternative; two skips leave the skill undecided and move on', () => {
    const s = run(({ skillId }) => (skillId === 'num.recognition' ? 'skipped' : 'independent'));
    const rec = s.attempts.filter((a) => a.skillId === 'num.recognition');
    expect(rec.map((a) => a.observation)).toEqual(['skipped', 'skipped']);
    expect(rec[1].selectionReason).toBe('skip|num.recognition');
    expect(suggestStatusFor(s.attempts, 'num.recognition')).toBe('insufficient');
    expect(s.attempts[2].skillId).not.toBe('num.recognition');
  });

  it('same-skill attempts vary both the question and the task format', () => {
    const s = run(() => 'prompted', { seed: 7 });
    const rec = s.attempts.filter((a) => a.skillId === 'num.recognition');
    expect(rec.length).toBeGreaterThanOrEqual(3);
    expect(new Set(rec.map((a) => a.itemId)).size).toBe(rec.length);
    expect(new Set(rec.map((a) => a.familyId)).size).toBeGreaterThanOrEqual(2);
  });

  it('asking for an alternative replaces the item on the same skill and band without counting an attempt', () => {
    const s = base();
    s.current = nextItem(s, new Set(), {}, false, { random: seeded(4) })!;
    const alt = nextItem(s, new Set(), {}, true, { random: seeded(5) })!;
    expect(alt.skillId).toBe(s.current.skillId);
    expect(alt.band).toBe(s.current.band);
    expect(alt.itemId).not.toBe(s.current.itemId);
    expect(alt.familyId).not.toBe(s.current.familyId);
    expect(alt.selectionReason).toBe('alternative');
    expect(s.attempts).toHaveLength(0);
  });

  it('reassessment avoids every item seen before, even in another assessment language', () => {
    const first = run(() => 'prompted', { lang: 'en', seed: 11 });
    const seen = new Set(first.attempts.map((a) => a.itemId));
    const again = run(() => 'prompted', { lang: 'kn', seen, seed: 11 });
    const numeracy = again.attempts.filter((a) => a.skillId.startsWith('num.'));
    expect(numeracy.length).toBeGreaterThan(0);
    for (const a of again.attempts) expect(seen.has(a.itemId)).toBe(false);
    // Kannada session shows Kannada prompts.
    expect(again.attempts[0].prompt).toMatch(/[ಀ-೿]/);
  });

  it('uses earlier evidence: starts at the first skill not mastered last time', () => {
    const prior: Record<string, SkillStatus> = { 'num.recognition': 'mastered', 'num.place_value': 'mastered' };
    const it = nextItem(base(), new Set(), prior, false, { random: seeded(1) })!;
    expect(it.skillId).toBe('num.add_no_carry');
    expect(it.selectionReason).toBe('prior|num.add_no_carry');
  });

  it('moves on when the eligible material for a skill is exhausted, and stops when everything is', () => {
    const fr = (b: 1 | 2) => eligibleItems('num.fractions', b, 'en').map((i) => i.itemId);
    const prior: Record<string, SkillStatus> = { 'num.recognition': 'mastered', 'num.place_value': 'mastered', 'num.add_no_carry': 'mastered', 'num.sub_borrow': 'mastered' };
    const it = nextItem(base(), new Set([...fr(1), ...fr(2)]), prior, false)!;
    expect(it.skillId).toBe('lit.initial_sounds');

    const everything = new Set<string>();
    for (const id of ['num.recognition', 'num.place_value', 'num.add_no_carry', 'num.sub_borrow', 'num.fractions', 'lit.initial_sounds', 'lit.decoding', 'lit.sentence_reading'])
      for (const b of [1, 2] as const) for (const i of eligibleItems(id, b, 'en')) everything.add(i.itemId);
    expect(nextItem(base(), everything, {}, false)).toBeUndefined();
  });

  it('stops at the session item limit', () => {
    const s = run(() => 'prompted');
    expect(s.attempts.length).toBeLessThanOrEqual(STOPPING.maxItems);
    s.attempts = s.attempts.concat(Array(STOPPING.maxItems).fill(s.attempts[0]));
    expect(nextItem(s, new Set())).toBeUndefined();
  });

  it('presented arithmetic carries the generated stimulus and a correct expected answer', () => {
    const s = run(({ n }) => (n % 3 === 0 ? 'incorrect' : 'independent'), { seed: 21 });
    for (const a of s.attempts.filter((x) => x.familyId === 'add.bare' || x.familyId === 'sub.bare')) {
      const [x, y] = (a.stimulus ?? '').match(/\d+/g)!.map(Number);
      expect(Number(a.expected)).toBe(a.familyId === 'add.bare' ? x + y : x - y);
    }
  });

  it('reading stimuli are kept out of the spoken prompt', () => {
    const prior: Record<string, SkillStatus> = { 'lit.initial_sounds': 'mastered' };
    for (let seed = 1; seed < 20; seed++) {
      const s = base('hi');
      s.attempts = [];
      const it = nextItem({ ...s }, new Set(), { ...prior, 'num.recognition': 'mastered', 'num.place_value': 'mastered', 'num.add_no_carry': 'mastered', 'num.sub_borrow': 'mastered', 'num.fractions': 'mastered' }, false, { random: seeded(seed) })!;
      expect(it.skillId).toBe('lit.decoding');
      expect(it.audio).not.toBe('full');
      if (it.familyId === 'dc.read') expect(it.prompt.includes(it.stimulus!)).toBe(false);
    }
  });

  it('suggestions never assign mastery from a single answer; summary uses confirmed statuses only', () => {
    expect(suggestStatus({ independent: 1, prompted: 0, incorrect: 0, skipped: 0 })).toBe('developing');
    expect(suggestStatus({ independent: 0, prompted: 0, incorrect: 0, skipped: 1 })).toBe('insufficient');
    const s = run(() => 'independent');
    expect(summarise(s)[0].status).toBe('insufficient');
    s.confirmed['num.recognition'] = 'mastered';
    expect(summarise(s)[0]).toMatchObject({ skillId: 'num.recognition', status: 'mastered', evidence: { independent: 2 } });
  });

  it('selection reasons are stored language-neutral and shown in the interface language', () => {
    expect(reasonText('en', 'prereq|num.place_value')).toBe('Incorrect → check the earlier skill Tens and ones');
    expect(reasonText('mr', 'prereq|num.place_value')).toContain('दशक आणि एकक');
    expect(reasonText('ta', 'alternative')).toMatch(/[஀-௿]/);
    expect(reasonText('en', 'Some older free-text reason')).toBe('Some older free-text reason');
  });
});
