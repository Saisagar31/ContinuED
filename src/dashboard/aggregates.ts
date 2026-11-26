/**
 * Aggregate dashboard data (task 12).
 *
 * `AggregateSource` is the contract the real sync API (task 11) will satisfy:
 * a bounded query in, counts plus an as-of time out. Until it exists, the
 * fixture source computes the same response from a synthetic event set that
 * includes retried (duplicate) events, so dedupe and suppression are exercised.
 */
import { LANGS, type LangCode } from '../domain/types';
import { SKILLS } from '../content/skills';

export interface TransferEvent {
  eventId: string; // unique operation ID — retries reuse it
  district: string;
  school: string;
  from: LangCode;
  to: LangCode;
  month: string; // YYYY-MM
  needsSupport: string[]; // skill IDs not mastered at transfer
}

// Moved to the shared contracts (task 02) so the API returns the same shape.
import type { AggregateQuery, AggregateResponse, Count } from '../../shared/contracts';
export type { AggregateQuery, AggregateResponse, Count };

export interface AggregateSource {
  query(q: AggregateQuery): Promise<AggregateResponse>;
}

/** PLACEHOLDER — the school-approved suppression rule is an open decision (task 01). */
export const SUPPRESS_BELOW = 5;
const suppress = (n: number): Count => (n > 0 && n < SUPPRESS_BELOW ? null : n);

export function aggregate(events: TransferEvent[], q: AggregateQuery, schoolsTotal: number, asOf: string): AggregateResponse {
  const unique = new Map<string, TransferEvent>();
  for (const e of events) if (!unique.has(e.eventId)) unique.set(e.eventId, e);
  const rows = [...unique.values()].filter(
    (e) => e.month >= q.fromMonth && e.month <= q.toMonth && (!q.district || e.district === q.district) && (!q.originLang || e.from === q.originLang),
  );

  const corridor = new Map<string, number>();
  const skill = new Map<string, number>();
  const month = new Map<string, number>();
  for (const e of rows) {
    const k = `${e.from}>${e.to}`;
    corridor.set(k, (corridor.get(k) ?? 0) + 1);
    for (const s of e.needsSupport) skill.set(s, (skill.get(s) ?? 0) + 1);
    month.set(e.month, (month.get(e.month) ?? 0) + 1);
  }

  return {
    asOf,
    coverage: { schoolsReporting: new Set(rows.map((r) => r.school)).size, schoolsTotal },
    totalTransfers: suppress(rows.length),
    corridors: [...corridor]
      .map(([k, n]) => {
        const [from, to] = k.split('>') as [LangCode, LangCode];
        return { from, to, count: suppress(n), raw: n };
      })
      .sort((a, b) => b.raw - a.raw)
      .map(({ raw: _raw, ...r }) => r),
    skills: SKILLS.map((s) => ({ skillId: s.id, count: suppress(skill.get(s.id) ?? 0) })).filter((s) => s.count !== 0),
    byMonth: [...month].sort(([a], [b]) => a.localeCompare(b)).map(([m, n]) => ({ month: m, count: suppress(n) })),
    suppressionThreshold: SUPPRESS_BELOW,
  };
}

// ---------- deterministic synthetic dataset ----------

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SYNTHETIC_DISTRICTS = ['Pune', 'Belagavi', 'Hyderabad'];

export function syntheticEvents(seed = 42, n = 240): TransferEvent[] {
  const r = mulberry32(seed);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  // Weighted corridors so some are large and some fall under suppression.
  const corridors: [LangCode, LangCode, number][] = [
    ['mr', 'kn', 30], ['kn', 'te', 18], ['hi', 'mr', 20], ['te', 'ta', 10], ['ta', 'ml', 8], ['mr', 'hi', 9], ['ml', 'en', 2], ['hi', 'te', 3],
  ];
  const total = corridors.reduce((s, c) => s + c[2], 0);
  const out: TransferEvent[] = [];
  for (let i = 0; i < n; i++) {
    let x = r() * total;
    const c = corridors.find((cc) => (x -= cc[2]) < 0) ?? corridors[0];
    const district = pick(SYNTHETIC_DISTRICTS);
    const e: TransferEvent = {
      eventId: `ev-${seed}-${i}`,
      district,
      school: `${district}-S${1 + Math.floor(r() * 6)}`,
      from: c[0],
      to: c[1],
      month: `2026-${String(1 + Math.floor(r() * 11)).padStart(2, '0')}`,
      needsSupport: SKILLS.filter(() => r() < 0.3).map((s) => s.id),
    };
    out.push(e);
    if (r() < 0.1) out.push({ ...e }); // client retry: same event ID delivered twice
  }
  return out;
}

export function fixtureSource(opts: { events?: TransferEvent[]; failWhenOffline?: boolean; latencyMs?: number } = {}): AggregateSource {
  const events = opts.events ?? syntheticEvents();
  return {
    async query(q) {
      if (opts.latencyMs) await new Promise((r) => setTimeout(r, opts.latencyMs));
      if (opts.failWhenOffline && typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('offline');
      return aggregate(events, q, SYNTHETIC_DISTRICTS.length * 6, new Date().toISOString());
    },
  };
}

// ---------- offline cache ----------

const CACHE_KEY = 'continued.dashboard.cache.v1';

export function cacheKey(q: AggregateQuery) {
  return JSON.stringify([q.fromMonth, q.toMonth, q.district ?? '', q.originLang ?? '']);
}

export function readCache(q: AggregateQuery): AggregateResponse | null {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
    return all[cacheKey(q)] ?? null;
  } catch {
    return null;
  }
}

export function writeCache(q: AggregateQuery, r: AggregateResponse) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
    all[cacheKey(q)] = r;
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable — dashboard still works online */
  }
}

export const ALL_LANGS = LANGS;
