// Shared domain types (task 02, owned by Omkar). The app imports them via
// src/domain/types.ts, which re-exports this file. Add-only: never rename fields.

export const LANGS = ['en', 'mr', 'kn', 'hi', 'te', 'ta', 'ml'] as const;
export type LangCode = (typeof LANGS)[number];

export type SkillStatus = 'mastered' | 'developing' | 'not_yet' | 'insufficient';
export const STATUSES: SkillStatus[] = ['mastered', 'developing', 'not_yet', 'insufficient'];

export type Observation = 'independent' | 'prompted' | 'incorrect' | 'skipped';
export const OBSERVATIONS: Observation[] = ['independent', 'prompted', 'incorrect', 'skipped'];

/** Agreed age field is still an open decision (task 01); bands keep it coarse. */
export type AgeBand = '5-6' | '7-8' | '9-10' | '11-12' | '13+';
export const AGE_BANDS: AgeBand[] = ['5-6', '7-8', '9-10', '11-12', '13+'];

export type Strand = 'numeracy' | 'literacy';

export interface Activity {
  id: string;
  minutes: number;
  title: string;
  steps: string;
}

export interface Skill {
  id: string;
  strand: Strand;
  name: string;
  prerequisites: string[];
  commonErrors: string[];
  activities: Activity[];
  peerGroup: string;
  oralCheck: string;
}

export interface EvidenceCounts {
  independent: number;
  prompted: number;
  incorrect: number;
  skipped: number;
}

export interface SkillSummary {
  skillId: string;
  status: SkillStatus;
  evidence: EvidenceCounts;
}

export interface PresentedItem {
  itemId: string;
  skillId: string;
  band: number;
  prompt: string;
  expected: string;
  selectionReason: string;
  presentedAt: string;
  // Added by task 06 (all optional, so older saved sessions still load):
  /** Question family (task format) from src/content/questions.ts. */
  familyId?: string;
  /** What the learner is shown. Kept apart from `prompt` so a reading stimulus is never voiced. */
  stimulus?: string;
  /** What audio may play for this item. */
  audio?: 'none' | 'instruction' | 'full';
  /** Audio-pack clip ID for this item. */
  audioContentId?: string;
}

export interface Attempt extends PresentedItem {
  observation: Observation;
  answeredAt: string;
}

export interface Teacher {
  id: string;
  displayName: string;
  pinSalt: string;
  pinHash: string;
  createdAt: string;
}

export interface Learner {
  id: string; // random pseudonymous ID, e.g. L-7K3Q-9FX2
  teacherId: string;
  label?: string; // teacher-local nickname, never leaves the device
  ageBand?: AgeBand;
  createdAt: string;
  source: 'local' | 'transfer';
}

export interface Session {
  id: string;
  teacherId: string;
  learnerId: string;
  predecessorId?: string;
  contentVersion: string;
  assessmentLang: LangCode;
  status: 'draft' | 'completed';
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  current?: PresentedItem;
  attempts: Attempt[];
  confirmed: Record<string, SkillStatus>;
  overrides: Record<string, { from: SkillStatus; reason: string }>;
  // Added 26 Nov (all optional, so sessions saved earlier still load):
  /** Rubric version used to score this session (plan §3: keep evidence and rubric version together). */
  rubricVersion?: string;
  /** Item IDs shown but replaced via "Different question" — excluded from later picks in this session. */
  shownNotAttempted?: string[];
}

export interface ReceivedTransfer {
  tid: string;
  teacherId: string;
  code: string;
  trust: TrustState;
  receivedAt: string;
}

export type TrustState =
  | 'verified'
  | 'unverified'
  | 'unknown_key'
  | 'expired_key'
  | 'revoked_key'
  | 'altered';
