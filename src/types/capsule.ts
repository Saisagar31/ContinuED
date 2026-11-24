import type { SkillId, Strand } from '../data/competencyGraph.ts';
import type { LangCode } from './language.ts';

export type MasteryStatus = 'mastered' | 'in_progress' | 'needs_help' | 'not_assessed';

export type SkillMap = Record<SkillId, MasteryStatus>;

export interface CapsulePayload {
  v: 1;
  id: string; // Pseudonymous ID, e.g. "TC-4821". No names, no personal data.
  age: number;
  originLang: LangCode;
  ts: number; // Unix seconds
  skills: SkillMap;
}

export interface DecodeResult {
  valid: boolean;
  data?: CapsulePayload;
  error?: 'format' | 'corrupt' | 'signature' | 'crypto';
}

export interface StartPoint {
  strand: Strand;
  skillId: SkillId;
  status: MasteryStatus;
}
