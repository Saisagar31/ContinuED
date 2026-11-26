/**
 * Test helpers for the school API (imported only by *.test.ts files).
 * Fake verifier: a token is "t:<schoolId>:<district>:<role>"; "expired" and anything
 * else unknown throw, like a real verifier would.
 */
import type { SyncEvent } from '../../shared/contracts';
import type { LangCode, SkillStatus } from '../../shared/domain';
import type { TokenVerifier } from './auth';
import type { ApiRequest, Handler } from './http';
import { schoolRoutes, type RouteDeps } from './routes';
import { createRouter } from './router';
import { localSigner } from './signing';
import { memoryStore } from './store/memory';
import type { SchoolStore } from './store/types';

export const fakeVerifier: TokenVerifier = {
  async verify(token) {
    if (token === 'expired') throw new Error('Token expired');
    const m = /^t:([^:]*):([^:]*):([a-z_,]*)$/.exec(token);
    if (!m) throw new Error('invalid token');
    return {
      sub: `user-${m[1]}-${m[3]}`,
      ...(m[1] ? { 'custom:school_id': m[1] } : {}),
      ...(m[2] ? { 'custom:district': m[2] } : {}),
      'cognito:groups': m[3] ? m[3].split(',') : [],
    };
  },
};

export const tok = (school: string, district: string, role: string) => `t:${school}:${district}:${role}`;

export const NOW = new Date('2026-11-20T10:00:00.000Z');

export async function makeApp(over: Partial<RouteDeps> = {}): Promise<{ route: Handler; store: SchoolStore; deps: RouteDeps }> {
  const { signer, publicJwk } = await localSigner('k1');
  const deps: RouteDeps = {
    store: memoryStore(),
    verifier: fakeVerifier,
    signer,
    trust: { keys: [{ kid: 'k1', issuer: 'Test School', publicJwk, notBefore: '2020-01-01', notAfter: '2099-12-31' }], revoked: [] },
    now: () => NOW,
    config: { retentionDays: 30 },
    ...over,
  };
  return { route: createRouter(schoolRoutes(deps)), store: deps.store, deps };
}

export function call(route: Handler, method: string, path: string, opts: { token?: string; body?: unknown; query?: Record<string, string> } = {}) {
  const req: ApiRequest = {
    method,
    path,
    query: opts.query ?? {},
    headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
    body: opts.body,
  };
  return route(req);
}

let seq = 0;
export function transferEvent(over: Partial<SyncEvent> & { statuses?: Record<string, SkillStatus> } = {}): SyncEvent {
  const { statuses = { 'num.place_value': 'developing', 'lit.letter_sounds': 'mastered' }, ...rest } = over;
  seq++;
  return {
    eventId: `ev-${String(seq).padStart(4, '0')}`,
    type: 'transfer_received',
    occurredAt: '2026-03-15T09:00:00.000Z',
    learner: `L-${String(seq).padStart(4, '0')}`,
    contentVersion: 'sample-0.1',
    originLang: 'mr' as LangCode,
    destLang: 'kn' as LangCode,
    summary: Object.entries(statuses).map(([skillId, status]) => ({
      skillId,
      status,
      evidence: { independent: 1, prompted: 0, incorrect: 0, skipped: 0 },
    })),
    ...rest,
  };
}

export const batch = (events: unknown[], deviceId = 'device-1') => ({ deviceId, events });

/** A fetch() that calls the router in-process, so client code can be tested against the real routes. */
export function fetchVia(route: Handler): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => (headers[k] = v));
    const res = await route({
      method: init?.method ?? 'GET',
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      headers,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return new Response(res.body === undefined ? null : JSON.stringify(res.body), { status: res.status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}
