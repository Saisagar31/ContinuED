/**
 * Storage port for the school API (task 11). Implementations:
 *  - memory.ts  in-process, for tests and the dev server
 *  - dynamo.ts  DynamoDB, for Lambda
 *
 * Single-table design (both implementations follow the same keys and semantics):
 *
 *   Event item       PK = SCHOOL#<schoolId>    SK = EVENT#<eventId>
 *                    attributes: the de-identified SyncEvent fields, deviceId, receivedAt,
 *                    aggKeys (the counter SKs this event incremented), and
 *                    expiresAt (epoch seconds; DynamoDB TTL deletes the raw event after
 *                    RETENTION_DAYS — counters are kept, they hold no learner IDs).
 *
 *   Counter item     PK = SCHOOL#<schoolId>    SK = AGG#<YYYY-MM>#<dimension>#<key>
 *                    attribute n (number). Only transfer_received events are counted.
 *                    dimension CORRIDOR, key "<originLang>><destLang>"   e.g. AGG#2026-03#CORRIDOR#mr>kn
 *                    dimension SKILL,    key "<originLang>#<skillId>"    e.g. AGG#2026-03#SKILL#mr#num.place_value
 *                    (skill = status !== 'mastered', i.e. needs support).
 *                    Total and by-month counts are sums of the CORRIDOR counters, and the
 *                    origin language is part of each key so the originLang filter works.
 *
 *   District member  PK = DISTRICT#<district>  SK = SCHOOL#<schoolId>
 *                    written with each event that has a district, so a district read
 *                    can find its schools with one Query.
 *
 * Accepting an event is ONE TransactWriteItems: first a Put of the event item with
 * ConditionExpression attribute_not_exists(PK), then one ADD per counter (and the
 * district member Put). If the condition fails the whole transaction is cancelled,
 * so a retried event never double-counts.
 */
import type { SyncEvent } from '../../../shared/contracts';

export type Dimension = 'CORRIDOR' | 'SKILL';

export interface Counter {
  schoolId: string;
  month: string; // YYYY-MM
  dimension: Dimension;
  key: string;
  n: number;
}

export interface PutEventInput {
  schoolId: string;
  district?: string;
  deviceId: string;
  event: SyncEvent;
  receivedAt: Date;
  retentionDays: number;
}

export type PutResult = 'accepted' | 'duplicate';

export interface SchoolStore {
  /** Atomically store the event once and increment its counters. */
  putEvent(input: PutEventInput): Promise<PutResult>;
  /** Counters for one school with fromMonth <= month <= toMonth. Zero counters may be omitted. */
  readCounters(schoolId: string, fromMonth: string, toMonth: string): Promise<Counter[]>;
  /** School IDs that have synced at least one event under this district. */
  schoolsInDistrict(district: string): Promise<string[]>;
  /** Delete every stored event of this learner in this school, decrementing their counters. Returns events deleted. */
  deleteLearner(schoolId: string, learner: string): Promise<number>;
}

// ---------- key helpers shared by both implementations ----------

export const schoolPk = (schoolId: string) => `SCHOOL#${schoolId}`;
export const districtPk = (district: string) => `DISTRICT#${district}`;
export const eventSk = (eventId: string) => `EVENT#${eventId}`;
export const counterSk = (month: string, dimension: Dimension, key: string) => `AGG#${month}#${dimension}#${key}`;

export const monthOf = (iso: string) => new Date(iso).toISOString().slice(0, 7);

/** Counter SKs an event increments (deduplicated: one transaction cannot touch an item twice). */
export function counterKeysFor(e: SyncEvent): string[] {
  if (e.type !== 'transfer_received' || !e.destLang) return [];
  const month = monthOf(e.occurredAt);
  const keys = new Set<string>([counterSk(month, 'CORRIDOR', `${e.originLang}>${e.destLang}`)]);
  for (const s of e.summary) if (s.status !== 'mastered') keys.add(counterSk(month, 'SKILL', `${e.originLang}#${s.skillId}`));
  return [...keys];
}

export function parseCounterSk(schoolId: string, sk: string, n: number): Counter | null {
  const m = /^AGG#(\d{4}-\d{2})#(CORRIDOR|SKILL)#(.+)$/.exec(sk);
  return m ? { schoolId, month: m[1], dimension: m[2] as Dimension, key: m[3], n } : null;
}

export const expiresAtFor = (receivedAt: Date, retentionDays: number) => Math.floor(receivedAt.getTime() / 1000) + retentionDays * 86_400;

/** Only the contract fields are stored — extra properties in the request body are dropped. */
export function storedEventFields(e: SyncEvent): SyncEvent {
  return {
    eventId: e.eventId,
    type: e.type,
    occurredAt: e.occurredAt,
    learner: e.learner,
    contentVersion: e.contentVersion,
    originLang: e.originLang,
    ...(e.destLang ? { destLang: e.destLang } : {}),
    summary: e.summary.map((s) => ({
      skillId: s.skillId,
      status: s.status,
      evidence: {
        independent: s.evidence.independent,
        prompted: s.evidence.prompted,
        incorrect: s.evidence.incorrect,
        skipped: s.evidence.skipped,
      },
    })),
  };
}
