/**
 * Shared interface contracts (task 02, owned by Omkar).
 *
 * These are the "interfaces to agree before parallel development" from
 * docs/PROJECT_EXECUTION_PLAN.md section 3. Each one has a success and a
 * failure example under /fixtures, checked by fixtures/fixtures.test.ts.
 *
 * Rules: add-only. Never rename or retype a field another slice already uses;
 * add a new optional field or bump a version instead.
 */
import type { LangCode, SkillSummary } from './domain';

// ---------------------------------------------------------------------------
// Content (task 04 fills real packs; task 06 consumes them)
// ---------------------------------------------------------------------------

/** One question item or generator template, versioned with its content pack. */
export interface ContentItem {
  itemId: string; // stable item or template ID
  skillId: string; // e.g. "num.place_value"
  version: string; // item version
  band: number; // difficulty band, 1 = easiest
  lang: LangCode; // language of prompt and stimulus
  prompt: string; // spoken/shown instruction to the learner
  stimulus?: string; // what the learner reads or looks at (kept separate from audio)
  expected: string; // expected response, or a rule description for generators
  scoring: string; // scoring guidance for the teacher
  /** What audio may play. 'instruction' must never reveal a reading answer. */
  audio: 'none' | 'instruction' | 'full';
  reviewStatus: 'draft' | 'approved';
}

export interface ContentPack {
  contentVersion: string; // e.g. "sample-0.1"
  lang: LangCode;
  items: ContentItem[];
}

// ---------------------------------------------------------------------------
// Sync: authenticated event submission and per-ID acknowledgement (task 11)
// ---------------------------------------------------------------------------

export type SyncEventType = 'assessment_completed' | 'transfer_issued' | 'transfer_received';

/** One de-identified operation. Retries reuse the same eventId. */
export interface SyncEvent {
  eventId: string; // unique per operation, generated on the device
  type: SyncEventType;
  occurredAt: string; // ISO 8601
  learner: string; // pseudonymous learner ID — never a name
  contentVersion: string;
  originLang: LangCode;
  destLang?: LangCode; // set for transfer_received
  summary: SkillSummary[];
}

export const MAX_SYNC_BATCH = 100;

export interface SyncBatch {
  deviceId: string;
  events: SyncEvent[]; // 1..MAX_SYNC_BATCH
}

/** Every submitted eventId appears in exactly one of the three lists. */
export interface SyncAck {
  accepted: string[]; // stored now
  duplicate: string[]; // already stored earlier — safe to remove locally
  rejected: { eventId: string; reason: string }[]; // keep locally, show to teacher
  asOf: string;
}

// ---------------------------------------------------------------------------
// Issuer signing and trust distribution (tasks 08 + 11)
// ---------------------------------------------------------------------------

/** Signing input is exactly the capsule head "CED<ver>.<payload>" (see src/transfer/capsule.ts). */
export interface SignRequest {
  head: string;
}

export interface SignResponse {
  kid: string;
  sig: string; // base64url raw ECDSA P-256 r||s (64 bytes) — what Web Crypto verifies
}

/** Mirrors TrustedKey/TrustStore in src/transfer/trust.ts, plus the list's as-of time. */
export interface TrustListResponse {
  keys: { kid: string; issuer: string; publicJwk: JsonWebKey; notBefore: string; notAfter: string }[];
  revoked: string[];
  asOf: string;
}

// ---------------------------------------------------------------------------
// Aggregate read (tasks 11 + 12). src/dashboard/aggregates.ts re-exports these.
// ---------------------------------------------------------------------------

export interface AggregateQuery {
  fromMonth: string; // YYYY-MM
  toMonth: string; // YYYY-MM
  district?: string;
  originLang?: LangCode;
}

/** null = suppressed small cohort. */
export type Count = number | null;

export interface AggregateResponse {
  asOf: string;
  coverage: { schoolsReporting: number; schoolsTotal: number };
  totalTransfers: Count;
  corridors: { from: LangCode; to: LangCode; count: Count }[];
  skills: { skillId: string; count: Count }[];
  byMonth: { month: string; count: Count }[];
  suppressionThreshold: number;
}

// ---------------------------------------------------------------------------
// Audio pack manifest (task 10)
// ---------------------------------------------------------------------------

export interface AudioClip {
  contentId: string; // the ContentItem/activity ID this clip voices
  textSha256: string; // hex SHA-256 of the exact approved spoken text
  file: string; // path relative to the pack root, e.g. "mr/3f2a….mp3"
  sha256: string; // hex SHA-256 of the MP3 bytes
  bytes: number;
  reviewStatus: 'unreviewed' | 'approved' | 'rejected';
}

export interface AudioManifest {
  packVersion: string;
  contentVersion: string;
  lang: LangCode;
  voiceId: string;
  modelId: string;
  createdAt: string;
  clips: AudioClip[];
}

// ---------------------------------------------------------------------------
// Errors returned by the API
// ---------------------------------------------------------------------------

export interface ApiError {
  error: string; // machine code, e.g. "unauthorized", "invalid_request"
  detail?: string;
}
