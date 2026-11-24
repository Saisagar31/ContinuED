// STUB — owner: Omkar. Real implementation comes in task O6 (prompt P-O6).
import type { SkillMap, StartPoint } from '../types/capsule.ts';

/** For each strand, the first skill in the chain that is not mastered. */
export function findStartPoints(skills: SkillMap): StartPoint[] {
  void skills;
  throw new Error('not implemented');
}

/** The most urgent start point (needs help > in progress > not assessed), or null. */
export function findRootBottleneck(skills: SkillMap): StartPoint | null {
  void skills;
  throw new Error('not implemented');
}
