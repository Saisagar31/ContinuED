import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SyncAck, SyncBatch, SyncEvent } from '../../shared/contracts';
import { enqueue, flush, getSyncStatus, onSyncStatus, pending, resetOutboxHandle, resetSyncStatus, type FlushOptions } from './outbox';

let n = 0;
const ev = (): SyncEvent => ({
  eventId: `ev-${String(++n).padStart(4, '0')}`,
  type: 'transfer_received',
  occurredAt: '2026-03-01T00:00:00Z',
  learner: 'L-0001',
  contentVersion: 'sample-0.1',
  originLang: 'mr',
  destLang: 'kn',
  summary: [{ skillId: 'num.place_value', status: 'developing', evidence: { independent: 1, prompted: 0, incorrect: 0, skipped: 0 } }],
});

const ackJson = (ack: Partial<SyncAck>) =>
  new Response(JSON.stringify({ accepted: [], duplicate: [], rejected: [], asOf: '2026-11-20T10:00:00.000Z', ...ack }), { status: 200 });

/** Records every batch; `reply` decides the response for each call. */
function mockFetch(reply: (b: SyncBatch, call: number) => Response | Promise<Response>) {
  const calls: { url: string; auth: string | null; batch: SyncBatch }[] = [];
  const f = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const batch = JSON.parse(String(init?.body)) as SyncBatch;
    calls.push({ url: String(url), auth: new Headers(init?.headers).get('authorization'), batch });
    return reply(batch, calls.length);
  }) as typeof fetch;
  return { f, calls };
}

const sleeps: number[] = [];
const opts = (f: typeof fetch, over: Partial<FlushOptions> = {}): FlushOptions => ({
  apiUrl: 'https://api.test/',
  deviceId: 'device-1',
  getToken: async () => 'token-1',
  fetch: f,
  sleep: async (ms) => void sleeps.push(ms),
  ...over,
});
const ids = async () => (await pending()).map((e) => e.eventId).sort();

beforeEach(async () => {
  await resetOutboxHandle();
  resetSyncStatus();
  sleeps.length = 0;
  await new Promise((res, rej) => {
    const r = indexedDB.deleteDatabase('continued-sync');
    r.onsuccess = res;
    r.onerror = rej;
  });
});

describe('outbox', () => {
  it('removes only acknowledged (accepted/duplicate) ids; keeps rejected with reason and unmentioned ids', async () => {
    const [a, b, c, d] = [ev(), ev(), ev(), ev()];
    for (const e of [a, b, c, d]) await enqueue(e);
    const { f, calls } = mockFetch(() =>
      ackJson({ accepted: [a.eventId, 'ev-not-ours'], duplicate: [b.eventId], rejected: [{ eventId: c.eventId, reason: 'events[2].summary: bad' }] }),
    );
    const s = await flush(opts(f));
    expect(calls[0].url).toBe('https://api.test/events');
    expect(calls[0].auth).toBe('Bearer token-1');
    expect(calls[0].batch.deviceId).toBe('device-1');
    expect(s).toMatchObject({ state: 'idle', lastSyncAt: '2026-11-20T10:00:00.000Z' });
    expect(await ids()).toEqual([c.eventId, d.eventId].sort());
    const rejected = (await pending()).find((e) => e.eventId === c.eventId)!;
    expect(rejected.rejectedReason).toBe('events[2].summary: bad');

    // Next flush resends d only (rejected entries are not re-sent automatically).
    const second = mockFetch((batch) => ackJson({ accepted: batch.events.map((e) => e.eventId) }));
    await flush(opts(second.f));
    expect(second.calls[0].batch.events.map((e) => e.eventId)).toEqual([d.eventId]);
    expect(await ids()).toEqual([c.eventId]);
  });

  it('401 → reauth_required, stops, and deletes nothing', async () => {
    for (let i = 0; i < 3; i++) await enqueue(ev());
    const before = await ids();
    const { f, calls } = mockFetch(() => new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }));
    const s = await flush(opts(f));
    expect(s.state).toBe('reauth_required');
    expect(calls).toHaveLength(1);
    expect(await ids()).toEqual(before);

    const noToken = mockFetch(() => ackJson({}));
    resetSyncStatus();
    expect((await flush(opts(noToken.f, { getToken: async () => null }))).state).toBe('reauth_required');
    expect(noToken.calls).toHaveLength(0);
  });

  it('offline: bounded exponential backoff, then offline, nothing lost', async () => {
    for (let i = 0; i < 2; i++) await enqueue(ev());
    const before = await ids();
    let attempts = 0;
    const f = (async () => {
      attempts++;
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    const statuses: string[] = [];
    const off = onSyncStatus((s) => statuses.push(s.state));
    const s = await flush(opts(f));
    off();
    expect(s.state).toBe('offline');
    expect(s.lastError).toBe('network unavailable');
    expect(attempts).toBe(6);
    expect(sleeps).toEqual([500, 1000, 2000, 4000, 8000]);
    expect(statuses).toEqual(['syncing', 'offline']);
    expect(await ids()).toEqual(before);
  });

  it('5xx retries then reports error; recovers on a later attempt', async () => {
    await enqueue(ev());
    const always = mockFetch(() => new Response('{}', { status: 503 }));
    expect((await flush(opts(always.f, { maxAttempts: 3 }))).state).toBe('error');
    expect(always.calls).toHaveLength(3);
    expect(await ids()).toHaveLength(1);

    const flaky = mockFetch((b, call) => (call < 3 ? new Response('{}', { status: 500 }) : ackJson({ accepted: b.events.map((e) => e.eventId) })));
    expect((await flush(opts(flaky.f))).state).toBe('idle');
    expect(await ids()).toEqual([]);
    expect(getSyncStatus().lastError).toBeUndefined();
  });

  it('invalid acknowledgement or 400 keeps everything', async () => {
    await enqueue(ev());
    const junk = mockFetch(() => new Response(JSON.stringify({ accepted: 'all' }), { status: 200 }));
    expect((await flush(opts(junk.f))).state).toBe('error');
    const refused = mockFetch(() => new Response(JSON.stringify({ error: 'invalid_request' }), { status: 400 }));
    expect((await flush(opts(refused.f))).state).toBe('error');
    expect(refused.calls).toHaveLength(1); // not retried
    expect(await ids()).toHaveLength(1);
  });

  it('sends batches of at most 100 and re-enqueueing an id does not duplicate it', async () => {
    const events = Array.from({ length: 150 }, ev);
    for (const e of events) await enqueue(e);
    await enqueue(events[0]);
    expect(await pending()).toHaveLength(150);
    const { f, calls } = mockFetch((b) => ackJson({ accepted: b.events.map((e) => e.eventId) }));
    await flush(opts(f));
    expect(calls.map((c) => c.batch.events.length)).toEqual([100, 50]);
    expect(await pending()).toHaveLength(0);
  });
});
