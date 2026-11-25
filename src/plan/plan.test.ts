import { describe, expect, it } from 'vitest';
import type { SkillStatus, SkillSummary } from '../domain/types';
import { buildPlan, groupByNextSkill } from './plan';

const s = (skillId: string, status: SkillStatus): SkillSummary => ({
  skillId,
  status,
  evidence: { independent: 1, prompted: 0, incorrect: 0, skipped: 0 },
});

describe('receiving plan', () => {
  it('handles empty, all-mastered and insufficient states', () => {
    expect(buildPlan([]).kind).toBe('empty');
    expect(buildPlan([s('num.recognition', 'mastered'), s('lit.initial_sounds', 'mastered')]).kind).toBe('all_mastered');
    expect(buildPlan([s('num.recognition', 'insufficient')]).kind).toBe('insufficient');
    expect(buildPlan([s('unknown.skill', 'developing')]).kind).toBe('empty');
  });

  it('recommends the first unmet prerequisite', () => {
    const p = buildPlan([
      s('num.recognition', 'mastered'),
      s('num.place_value', 'developing'),
      s('num.sub_borrow', 'not_yet'),
    ]);
    expect(p.kind === 'next' && p.skill.id).toBe('num.place_value');
    expect(p.kind === 'next' && p.mode).toBe('teach');
  });

  it('suggests a check when a prerequisite has no evidence', () => {
    const p = buildPlan([s('num.sub_borrow', 'not_yet')]);
    expect(p.kind).toBe('next');
    if (p.kind !== 'next') return;
    expect(p.skill.id).toBe('num.recognition');
    expect(p.mode).toBe('check');
    expect(p.chain).toEqual(['num.recognition', 'num.place_value', 'num.add_no_carry', 'num.sub_borrow']);
    expect(p.skill.activities).toHaveLength(2);
  });

  it('applies the strand tie rule (numeracy before literacy, placeholder)', () => {
    const p = buildPlan([s('lit.initial_sounds', 'developing'), s('num.recognition', 'developing')]);
    expect(p.kind === 'next' && p.skill.id).toBe('num.recognition');
  });

  it('groups learners by next skill', () => {
    const g = groupByNextSkill([
      { id: 'a', summary: [s('num.recognition', 'developing')] },
      { id: 'b', summary: [s('num.recognition', 'not_yet')] },
      { id: 'c', summary: [s('num.recognition', 'mastered')] },
    ]);
    expect(g.get('num.recognition')?.map((x) => x.id)).toEqual(['a', 'b']);
    expect(g.get('all_mastered')?.map((x) => x.id)).toEqual(['c']);
  });
});
