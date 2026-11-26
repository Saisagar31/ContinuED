import { describe, expect, it } from 'vitest';
import type { AggregateResponse, SyncAck } from '../../shared/contracts';
import { checkAggregateResponse, checkSyncAck } from '../../shared/guards';
import { SUPPRESS_BELOW } from '../../src/dashboard/aggregates';
import { batch, call, makeApp, tok, transferEvent } from './testkit';

const Q = { fromMonth: '2026-01', toMonth: '2026-12' };
const teacherA = tok('schoolA', 'pune', 'teacher');
const leadA = tok('schoolA', 'pune', 'school_lead');
const teacherB = tok('schoolB', 'pune', 'teacher');
const leadB = tok('schoolB', 'pune', 'school_lead');

async function sync(route: Awaited<ReturnType<typeof makeApp>>['route'], token: string, events: unknown[]) {
  const res = await call(route, 'POST', '/events', { token, body: batch(events) });
  expect(res.status).toBe(200);
  expect(checkSyncAck(res.body)).toBeNull();
  return res.body as SyncAck;
}

async function aggregates(route: Awaited<ReturnType<typeof makeApp>>['route'], token: string, query: Record<string, string> = Q) {
  const res = await call(route, 'GET', '/aggregates', { token, query });
  expect(res.status).toBe(200);
  expect(checkAggregateResponse(res.body)).toBeNull();
  return res.body as AggregateResponse;
}

const many = (n: number, over: Parameters<typeof transferEvent>[0] = {}) => Array.from({ length: n }, () => transferEvent(over));

describe('authentication and roles', () => {
  it('missing, malformed, invalid and expired tokens are 401', async () => {
    const { route } = await makeApp();
    for (const path of ['/events', '/sign']) {
      expect((await call(route, 'POST', path, { body: {} })).status).toBe(401);
    }
    expect((await call(route, 'GET', '/trust', {})).status).toBe(401);
    expect((await route({ method: 'GET', path: '/trust', query: {}, headers: { authorization: 'Basic abc' }, body: undefined })).status).toBe(401);
    expect((await call(route, 'GET', '/trust', { token: 'garbage' })).status).toBe(401);
    const expired = await call(route, 'GET', '/aggregates', { token: 'expired', query: Q });
    expect(expired).toEqual({ status: 401, body: { error: 'unauthorized' } });
  });

  it('a token without custom:school_id is 403', async () => {
    const { route } = await makeApp();
    expect((await call(route, 'GET', '/trust', { token: tok('', 'pune', 'teacher') })).status).toBe(403);
  });

  it('teacher calling /aggregates is 403; school lead calling /sign is 403', async () => {
    const { route } = await makeApp();
    expect((await call(route, 'GET', '/aggregates', { token: teacherA, query: Q })).status).toBe(403);
    expect((await call(route, 'POST', '/sign', { token: leadA, body: { head: 'CED1.abc' } })).status).toBe(403);
    expect((await call(route, 'DELETE', '/learners/L-0001', { token: teacherA })).status).toBe(403);
  });
});

describe('POST /events', () => {
  it('malformed body is 400', async () => {
    const { route } = await makeApp();
    expect((await call(route, 'POST', '/events', { token: teacherA, body: 'x' })).status).toBe(400);
    expect((await call(route, 'POST', '/events', { token: teacherA, body: batch([]) })).status).toBe(400);
    expect((await call(route, 'POST', '/events', { token: teacherA, body: batch([transferEvent()], 'bad id!') })).status).toBe(400);
    expect((await call(route, 'POST', '/events', { token: teacherA, body: batch(many(101)) })).status).toBe(400);
    expect((await call(route, 'POST', '/events', { token: teacherA, body: batch([{ type: 'x' }]) })).status).toBe(400);
  });

  it('replay of the same batch: all duplicate, counts unchanged', async () => {
    const { route } = await makeApp();
    const events = many(6);
    const first = await sync(route, teacherA, events);
    expect(first.accepted).toHaveLength(6);
    const before = await aggregates(route, leadA);
    const again = await sync(route, teacherA, events);
    expect(again.accepted).toEqual([]);
    expect(again.duplicate.sort()).toEqual(events.map((e) => e.eventId).sort());
    expect(await aggregates(route, leadA)).toEqual(before);
    expect(before.totalTransfers).toBe(6);
  });

  it('partial ack: invalid event rejected, valid ones counted once; resubmitting does not double count', async () => {
    const { route } = await makeApp();
    const good = many(5);
    const bad = { ...transferEvent(), destLang: undefined }; // transfer_received needs destLang
    const ack = await sync(route, teacherA, [good[0], bad, ...good.slice(1)]);
    expect(ack.accepted.sort()).toEqual(good.map((e) => e.eventId).sort());
    expect(ack.rejected).toEqual([{ eventId: bad.eventId, reason: expect.stringContaining('destLang') }]);
    expect(ack.duplicate).toEqual([]);
    // every submitted ID appears in exactly one list
    const listed = [...ack.accepted, ...ack.duplicate, ...ack.rejected.map((r) => r.eventId)];
    expect(new Set(listed).size).toBe(6);
    expect((await aggregates(route, leadA)).totalTransfers).toBe(5);

    // client keeps the rejected one and resubmits everything plus a fixed version + one new
    const fixed = { ...bad, destLang: 'kn' };
    const extra = transferEvent();
    const ack2 = await sync(route, teacherA, [...good, fixed, extra]);
    expect(ack2.duplicate.sort()).toEqual(good.map((e) => e.eventId).sort());
    expect(ack2.accepted.sort()).toEqual([fixed.eventId, extra.eventId].sort());
    expect((await aggregates(route, leadA)).totalTransfers).toBe(7);
  });

  it('the same eventId twice in one batch is listed once', async () => {
    const { route } = await makeApp();
    const e = transferEvent();
    const ack = await sync(route, teacherA, [e, e]);
    expect(ack).toMatchObject({ accepted: [e.eventId], duplicate: [], rejected: [] });
  });

  it('only transfer_received events are counted; extra body fields (schoolId) are ignored', async () => {
    const { route, store } = await makeApp();
    const assessed = transferEvent({ type: 'assessment_completed', destLang: undefined });
    const evil = { ...transferEvent(), schoolId: 'schoolB' };
    const ack = await sync(route, teacherA, [assessed, evil, ...many(4)]);
    expect(ack.accepted).toHaveLength(6);
    expect((await aggregates(route, leadA)).totalTransfers).toBe(5);
    const evilItem = (store as unknown as { items(): Record<string, unknown>[] }).items().find((i) => i.eventId === evil.eventId)!;
    expect(evilItem.PK).toBe('SCHOOL#schoolA');
    expect(evilItem.schoolId).toBe('schoolA');
    expect(evilItem.expiresAt).toBe(Math.floor(Date.parse('2026-11-20T10:00:00Z') / 1000) + 30 * 86400);
    expect((await aggregates(route, leadB)).totalTransfers).toBe(0);
  });
});

describe('school isolation', () => {
  it('school A cannot read or delete school B data', async () => {
    const { route } = await makeApp();
    const shared = transferEvent({ learner: 'L-SHARED' });
    await sync(route, teacherA, [shared, ...many(5)]);
    // Same eventId and learner pseudonym under school B are separate records.
    const ackB = await sync(route, teacherB, [{ ...shared }, ...many(5, { originLang: 'hi', destLang: 'te' })]);
    expect(ackB.accepted).toHaveLength(6);

    const a = await aggregates(route, leadA);
    const b = await aggregates(route, leadB);
    expect(a.totalTransfers).toBe(6);
    expect(a.corridors).toEqual([{ from: 'mr', to: 'kn', count: 6 }]);
    expect(b.corridors).toEqual([
      { from: 'hi', to: 'te', count: 5 },
      { from: 'mr', to: 'kn', count: null }, // 1 → suppressed
    ]);
    expect(a.coverage).toEqual({ schoolsReporting: 1, schoolsTotal: 1 });

    // A's lead deleting the learner only touches school A.
    const del = await call(route, 'DELETE', '/learners/L-SHARED', { token: leadA });
    expect(del).toMatchObject({ status: 200, body: { deleted: 1 } });
    expect((await aggregates(route, leadA)).totalTransfers).toBe(5);
    expect((await aggregates(route, leadB)).totalTransfers).toBe(6);
  });

  it('a district filter for another district is 403, and school leads cannot use it', async () => {
    const { route } = await makeApp();
    const dl = tok('office', 'pune', 'district_lead');
    expect((await call(route, 'GET', '/aggregates', { token: dl, query: { ...Q, district: 'belagavi' } })).status).toBe(403);
    expect((await call(route, 'GET', '/aggregates', { token: dl, query: { ...Q, district: 'pune' } })).status).toBe(200);
    expect((await call(route, 'GET', '/aggregates', { token: leadA, query: { ...Q, district: 'pune' } })).status).toBe(403);
    expect((await call(route, 'GET', '/aggregates', { token: tok('office', '', 'district_lead'), query: Q })).status).toBe(403);
  });
});

describe('GET /aggregates', () => {
  it('district lead sees the sum of schools in their own district only', async () => {
    const { route } = await makeApp();
    await sync(route, teacherA, many(4));
    await sync(route, teacherB, many(3));
    await sync(route, tok('schoolC', 'belagavi', 'teacher'), many(10));
    const d = await aggregates(route, tok('office', 'pune', 'district_lead'));
    expect(d.totalTransfers).toBe(7);
    expect(d.coverage).toEqual({ schoolsReporting: 2, schoolsTotal: 2 });
    const other = await aggregates(route, tok('office2', 'belagavi', 'district_lead'));
    expect(other.totalTransfers).toBe(10);
  });

  it('counts by corridor, skill needing support and month, with filters and suppression', async () => {
    const { route } = await makeApp();
    await sync(route, teacherA, [
      ...many(6, { occurredAt: '2026-03-02T08:00:00Z' }), // mr>kn, place_value developing, letter_sounds mastered
      ...many(2, { occurredAt: '2026-04-02T08:00:00Z', originLang: 'hi', destLang: 'kn', statuses: { 'num.place_value': 'mastered' } }),
      ...many(1, { occurredAt: '2025-12-31T23:00:00Z' }), // outside range
    ]);
    const all = await aggregates(route, leadA);
    expect(all.suppressionThreshold).toBe(SUPPRESS_BELOW);
    expect(all.asOf).toBe('2026-11-20T10:00:00.000Z');
    expect(all.totalTransfers).toBe(8);
    expect(all.corridors).toEqual([
      { from: 'mr', to: 'kn', count: 6 },
      { from: 'hi', to: 'kn', count: null },
    ]);
    expect(all.skills).toEqual([{ skillId: 'num.place_value', count: 6 }]);
    expect(all.byMonth).toEqual([
      { month: '2026-03', count: 6 },
      { month: '2026-04', count: null },
    ]);
    const hi = await aggregates(route, leadA, { ...Q, originLang: 'hi' });
    expect(hi.totalTransfers).toBeNull(); // 2 < threshold
    expect(hi.skills).toEqual([]);
    expect((await call(route, 'GET', '/aggregates', { token: leadA, query: { fromMonth: '2026-13', toMonth: '2026-12' } })).status).toBe(400);
    expect((await call(route, 'GET', '/aggregates', { token: leadA, query: {} })).status).toBe(400);
  });

  it('empty school: zero counts, not suppressed', async () => {
    const { route } = await makeApp();
    const r = await aggregates(route, leadA);
    expect(r).toMatchObject({ totalTransfers: 0, corridors: [], skills: [], byMonth: [], coverage: { schoolsReporting: 0, schoolsTotal: 1 } });
  });
});

describe('DELETE /learners/{pseudonym}', () => {
  it('removes the learner events and decrements aggregates', async () => {
    const { route, store } = await makeApp();
    const l = [transferEvent({ learner: 'L-GONE' }), transferEvent({ learner: 'L-GONE', occurredAt: '2026-05-01T00:00:00Z' })];
    await sync(route, teacherA, [...l, ...many(5)]);
    expect((await aggregates(route, leadA)).totalTransfers).toBe(7);
    const res = await call(route, 'DELETE', '/learners/L-GONE', { token: leadA });
    expect(res).toEqual({ status: 200, body: { deleted: 2, asOf: '2026-11-20T10:00:00.000Z' } });
    const after = await aggregates(route, leadA);
    expect(after.totalTransfers).toBe(5);
    expect(after.byMonth).toEqual([{ month: '2026-03', count: 5 }]);
    expect(after.skills).toEqual([{ skillId: 'num.place_value', count: 5 }]);
    const left = (store as unknown as { items(): Record<string, unknown>[] }).items().filter((i) => i.learner === 'L-GONE');
    expect(left).toEqual([]);
    // deleting again is a no-op; a bad pseudonym is 400
    expect((await call(route, 'DELETE', '/learners/L-GONE', { token: leadA })).body).toMatchObject({ deleted: 0 });
    expect((await call(route, 'DELETE', '/learners/x', { token: leadA })).status).toBe(400);
  });
});

describe('GET /trust and POST /sign validation', () => {
  it('any authenticated user gets the trust list with asOf', async () => {
    const { route } = await makeApp();
    const res = await call(route, 'GET', '/trust', { token: teacherA });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ keys: [{ kid: 'k1' }], revoked: [], asOf: '2026-11-20T10:00:00.000Z' });
  });

  it('bad sign request is 400', async () => {
    const { route } = await makeApp();
    expect((await call(route, 'POST', '/sign', { token: teacherA, body: { head: 'not a head' } })).status).toBe(400);
  });
});
