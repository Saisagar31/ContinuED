/**
 * End to end, in-process: client modules (src/sync, src/transfer) against the real
 * routes. Covers server signing → Venkat's capsule decode, key rotation and
 * revocation, and outbox → POST /events → GET /aggregates via apiAggregateSource.
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TrustListResponse } from '../../shared/contracts';
import { apiAggregateSource } from '../../src/sync/apiAggregateSource';
import { enqueue, flush, pending, resetOutboxHandle, resetSyncStatus } from '../../src/sync/outbox';
import { decodeCapsule, encodeCapsule, type TransferEnvelope } from '../../src/transfer/capsule';
import { currentIssuerKid, serverSigner } from '../../src/transfer/serverSigner';
import type { TrustStore } from '../../src/transfer/trust';
import type { Handler } from './http';
import { localSigner } from './signing';
import { call, fetchVia, makeApp, tok, transferEvent } from './testkit';

const API = 'http://api.test';
const teacher = tok('schoolA', 'pune', 'teacher');

const envelope = (ad: string): TransferEnvelope => ({
  v: 1,
  tid: 'T-abcdef123456',
  lp: 'L-7K3Q-9FX2',
  ol: 'mr',
  ad,
  cv: 'sample-0.1',
  s: [{ skillId: 'num.place_value', status: 'developing', evidence: { independent: 1, prompted: 2, incorrect: 0, skipped: 0 } }],
});

async function trustFrom(route: Handler): Promise<TrustStore> {
  const res = await call(route, 'GET', '/trust', { token: teacher });
  expect(res.status).toBe(200);
  const t = res.body as TrustListResponse;
  return { keys: t.keys, revoked: t.revoked, revocationListAsOf: t.asOf };
}

const signerVia = (route: Handler, kid: string) => serverSigner({ apiUrl: API, kid, getToken: async () => teacher, fetch: fetchVia(route) });

describe('server signing end to end', () => {
  it('localSigner + POST /sign + serverSigner → encodeCapsule → decodeCapsule with /trust = verified', async () => {
    const { route } = await makeApp();
    const trust = await trustFrom(route);
    const kid = currentIssuerKid(trust, '2026-11-20')!;
    expect(kid).toBe('k1');
    const code = await encodeCapsule(envelope('2026-11-01'), signerVia(route, kid));
    expect(await decodeCapsule(code, trust)).toMatchObject({ ok: true, trust: 'verified', kid: 'k1', issuer: 'Test School' });
    expect(await decodeCapsule(code, { keys: [], revoked: [] })).toMatchObject({ ok: true, trust: 'unknown_key' });
  });

  it('serverSigner refuses when the server signs with a different kid, and without a token', async () => {
    const { route } = await makeApp();
    await expect(encodeCapsule(envelope('2026-11-01'), signerVia(route, 'k-other'))).rejects.toThrow('issuer_key_mismatch');
    const noToken = serverSigner({ apiUrl: API, kid: 'k1', getToken: async () => null, fetch: fetchVia(route) });
    await expect(encodeCapsule(envelope('2026-11-01'), noToken)).rejects.toThrow('unauthorized');
  });

  it('key rotation: old kid verifies before notAfter alongside the new kid; revoked kid → revoked_key', async () => {
    const oldKey = await localSigner('k-2026a');
    const newKey = await localSigner('k-2026b');
    const keys = [
      { kid: 'k-2026a', issuer: 'Test School', publicJwk: oldKey.publicJwk, notBefore: '2025-01-01', notAfter: '2026-12-31' },
      { kid: 'k-2026b', issuer: 'Test School', publicJwk: newKey.publicJwk, notBefore: '2026-10-01', notAfter: '2028-12-31' },
    ];
    const before = await makeApp({ signer: oldKey.signer, trust: { keys, revoked: [] } });
    const after = await makeApp({ signer: newKey.signer, trust: { keys, revoked: [] } });
    const trust = await trustFrom(after.route);
    expect(currentIssuerKid(trust, '2026-11-20')).toBe('k-2026b');

    const oldCode = await encodeCapsule(envelope('2026-09-15'), signerVia(before.route, 'k-2026a'));
    const newCode = await encodeCapsule(envelope('2026-11-15'), signerVia(after.route, 'k-2026b'));
    expect(await decodeCapsule(oldCode, trust)).toMatchObject({ trust: 'verified', kid: 'k-2026a' });
    expect(await decodeCapsule(newCode, trust)).toMatchObject({ trust: 'verified', kid: 'k-2026b' });

    const revokedApp = await makeApp({ signer: newKey.signer, trust: { keys, revoked: ['k-2026a'] } });
    const revokedTrust = await trustFrom(revokedApp.route);
    expect(await decodeCapsule(oldCode, revokedTrust)).toMatchObject({ trust: 'revoked_key' });
    expect(await decodeCapsule(newCode, revokedTrust)).toMatchObject({ trust: 'verified' });
  });
});

describe('outbox → real API → apiAggregateSource', () => {
  beforeEach(async () => {
    await resetOutboxHandle();
    resetSyncStatus();
    await new Promise((res, rej) => {
      const r = indexedDB.deleteDatabase('continued-sync');
      r.onsuccess = res;
      r.onerror = rej;
    });
  });

  it('counts match after a flush, a re-sent duplicate and a partially rejected batch', async () => {
    const { route } = await makeApp();
    const f = fetchVia(route);
    const good = Array.from({ length: 7 }, () => transferEvent());
    const bad = { ...transferEvent(), summary: [] }; // needs at least one skill
    for (const e of [...good, bad]) await enqueue(e);
    const opts = { apiUrl: API, deviceId: 'device-1', getToken: async () => teacher, fetch: f };
    expect((await flush(opts)).state).toBe('idle');
    const left = await pending();
    expect(left.map((e) => e.eventId)).toEqual([bad.eventId]);
    expect(left[0].rejectedReason).toMatch(/summary/);

    // Two already-synced events come back (e.g. device restored from a backup) → duplicates, no double count.
    await enqueue(good[0]);
    await enqueue(good[1]);
    await flush(opts);
    expect((await pending()).map((e) => e.eventId)).toEqual([bad.eventId]);

    const source = apiAggregateSource({ apiUrl: API, getToken: async () => tok('schoolA', 'pune', 'school_lead'), fetch: f });
    const agg = await source.query({ fromMonth: '2026-01', toMonth: '2026-12' });
    expect(agg.totalTransfers).toBe(7);
    expect(agg.corridors).toEqual([{ from: 'mr', to: 'kn', count: 7 }]);

    const asTeacher = apiAggregateSource({ apiUrl: API, getToken: async () => teacher, fetch: f });
    await expect(asTeacher.query({ fromMonth: '2026-01', toMonth: '2026-12' })).rejects.toMatchObject({ status: 403, code: 'forbidden' });
  });
});
