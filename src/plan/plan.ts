/**
 * Receiving-teacher plan (section 2.6). Pure function — interface language only
 * changes presentation, never the recommendation.
 *
 * Rule (PLACEHOLDER for educator approval, task 04):
 *  1. Walk skills in tie-rule order (strand order, then graph order).
 *  2. The first skill with status developing / not_yet is the target.
 *  3. Recommend the earliest prerequisite of the target that is not mastered
 *     (depth-first, prerequisites before the target). A prerequisite with no
 *     evidence is recommended as a quick check rather than a lesson.
 */
import { SKILL_BY_ID, orderedSkills } from '../content/skills';
import type { Skill, SkillStatus, SkillSummary } from '../domain/types';

export type PlanResult =
  | { kind: 'empty' }
  | { kind: 'insufficient'; assessed: SkillSummary[] }
  | { kind: 'all_mastered'; mastered: SkillSummary[] }
  | {
      kind: 'next';
      skill: Skill;
      mode: 'teach' | 'check';
      because: SkillSummary | null; // the observation supporting the suggestion
      target: Skill;
      chain: string[]; // prerequisite path from recommendation up to target
    };

export function buildPlan(summary: SkillSummary[]): PlanResult {
  if (summary.length === 0) return { kind: 'empty' };
  const by = new Map(summary.map((s) => [s.skillId, s]));
  const known = summary.filter((s) => SKILL_BY_ID[s.skillId]);
  if (known.length === 0) return { kind: 'empty' };
  if (known.every((s) => s.status === 'insufficient')) return { kind: 'insufficient', assessed: known };

  const unmet = (st?: SkillStatus) => st === 'developing' || st === 'not_yet';
  const target = orderedSkills().find((sk) => unmet(by.get(sk.id)?.status));
  if (!target) {
    const mastered = known.filter((s) => s.status === 'mastered');
    if (mastered.length === known.length) return { kind: 'all_mastered', mastered };
    return { kind: 'insufficient', assessed: known };
  }

  // Depth-first search for the earliest non-mastered prerequisite.
  const visit = (sk: Skill, path: string[]): { skill: Skill; path: string[] } | null => {
    for (const pid of sk.prerequisites) {
      const p = SKILL_BY_ID[pid];
      if (!p) continue;
      const deeper = visit(p, [pid, ...path]);
      if (deeper) return deeper;
      if (by.get(pid)?.status !== 'mastered') return { skill: p, path: [pid, ...path] };
    }
    return null;
  };
  const pre = visit(target, [target.id]);
  const rec = pre?.skill ?? target;
  const recEvidence = by.get(rec.id) ?? null;
  const mode: 'teach' | 'check' = !recEvidence || recEvidence.status === 'insufficient' ? 'check' : 'teach';
  return {
    kind: 'next',
    skill: rec,
    mode,
    because: recEvidence && recEvidence.status !== 'insufficient' ? recEvidence : by.get(target.id) ?? null,
    target,
    chain: pre?.path ?? [target.id],
  };
}

/** Groups learners by their recommended next skill (teacher managing a class). */
export function groupByNextSkill<T extends { summary: SkillSummary[] }>(learners: T[]) {
  const groups = new Map<string, T[]>();
  for (const l of learners) {
    const p = buildPlan(l.summary);
    const key = p.kind === 'next' ? p.skill.id : p.kind;
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }
  return groups;
}
