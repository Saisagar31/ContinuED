import { describe, expect, it } from 'vitest';
import type { Attempt, Observation, Session } from '../domain/types';
import { nextItem, suggestStatus, summarise } from './stubEngine';

const base = (): Session => ({
  id: 'S', teacherId: 'T', learnerId: 'L', contentVersion: 'sample-0.1', assessmentLang: 'en',
  status: 'draft', startedAt: '', updatedAt: '', attempts: [], confirmed: {}, overrides: {},
});

function run(pattern: Observation[]) {
  const s = base();
  const path: string[] = [];
  for (const obs of pattern) {
    const it = nextItem(s, new Set());
    if (!it) break;
    path.push(`${it.skillId}@${it.band}`);
    s.attempts.push({ ...it, observation: obs, answeredAt: '' } as Attempt);
  }
  return { s, path };
}

describe('stub engine (prototype only)', () => {
  it('different response patterns follow different paths', () => {
    const strong = run(['independent', 'independent', 'independent', 'independent']).path;
    const weak = run(['prompted', 'prompted', 'prompted', 'incorrect']).path;
    expect(strong).not.toEqual(weak);
    expect(strong[1]).toBe('num.recognition@2');
    expect(weak[1]).toBe('num.recognition@1');
  });

  it('arithmetic answers are correct and constrained', () => {
    for (let i = 0; i < 200; i++) {
      const s = base();
      s.attempts = [{ itemId: 'x', skillId: 'num.add_no_carry', band: 1, prompt: '', expected: '', selectionReason: '', presentedAt: '', observation: 'independent', answeredAt: '' }];
      const it = nextItem(s, new Set())!;
      const m = /^(\d+) \+ (\d+)/.exec(it.prompt)!;
      const [a, b] = [Number(m[1]), Number(m[2])];
      expect(Number(it.expected)).toBe(a + b);
      expect((a % 10) + (b % 10)).toBeLessThan(10);
    }
  });

  it('avoids items seen in earlier sessions', () => {
    const seen = new Set(Array.from({ length: 20 }, (_, i) => `nr:${i + 1}`).filter((x) => x !== 'nr:7'));
    expect(nextItem(base(), seen)?.itemId).toBe('nr:7');
    seen.add('nr:7');
    expect(nextItem(base(), seen)).toBeUndefined(); // exhausted
  });

  it('suggests status but summary uses only teacher-confirmed statuses', () => {
    expect(suggestStatus({ independent: 2, prompted: 0, incorrect: 0, skipped: 0 })).toBe('mastered');
    expect(suggestStatus({ independent: 0, prompted: 0, incorrect: 0, skipped: 1 })).toBe('insufficient');
    const { s } = run(['independent', 'independent']);
    expect(summarise(s)[0].status).toBe('insufficient');
    s.confirmed['num.recognition'] = 'mastered';
    expect(summarise(s)[0]).toMatchObject({ skillId: 'num.recognition', status: 'mastered', evidence: { independent: 2 } });
  });
});
