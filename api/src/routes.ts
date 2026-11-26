/**
 * School API routes (task 11): sync, aggregates, signing, trust list, learner deletion.
 * Plug into the router with createRouter(schoolRoutes(deps)).
 *
 * Tenant rule: every read and write uses auth.schoolId / auth.district from the
 * verified token. Nothing in the body or query can select another school.
 */
import {
  MAX_SYNC_BATCH,
  type AggregateQuery,
  type SignResponse,
  type SyncAck,
  type SyncEvent,
  type TrustListResponse,
} from '../../shared/contracts';
import { checkAggregateQuery, checkSignRequest, checkSyncBatch, checkSyncEvent } from '../../shared/guards';
import { authenticate, hasRole, type TokenVerifier } from './auth';
import { summarise } from './aggregate';
import { error, json, type ApiRequest, type ApiResponse, type AuthContext, type Handler, type Role } from './http';
import type { RouteKey } from './router';
import type { IssuerSigner } from './signing';
import type { Counter, SchoolStore } from './store/types';

export type TrustConfig = Omit<TrustListResponse, 'asOf'>;

export interface RouteDeps {
  store: SchoolStore;
  verifier: TokenVerifier;
  signer: IssuerSigner;
  trust: TrustConfig;
  now: () => Date;
  config: { retentionDays: number };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
// Same format as eventId/learner in shared/guards.ts (ID_RE there is not exported).
const PSEUDONYM_RE = /^[A-Za-z0-9-]{4,64}$/;

/** Wraps a handler with authentication and an optional role requirement. */
function guarded(deps: RouteDeps, roles: Role[] | 'any', fn: (req: ApiRequest, auth: AuthContext) => Promise<ApiResponse>): Handler {
  return async (req) => {
    const a = await authenticate(req, deps.verifier);
    if (!a.ok) return a.res;
    if (roles !== 'any' && !hasRole(a.auth, ...roles)) return error(403, 'forbidden');
    return fn({ ...req, auth: a.auth }, a.auth);
  };
}

export function schoolRoutes(deps: RouteDeps): Partial<Record<RouteKey, Handler>> {
  const postEvents = guarded(deps, ['teacher', 'school_lead'], async (req, auth) => {
    const body = req.body;
    if (checkSyncBatch(body) !== null) {
      // Is the batch itself malformed (vs. only some events)? Reuse the guard on the envelope alone.
      if (!isObj(body)) return error(400, 'invalid_request', 'batch: expected object');
      const envelopeErr = checkSyncBatch({ deviceId: body.deviceId, events: [] });
      if (envelopeErr?.startsWith('batch.deviceId')) return error(400, 'invalid_request', envelopeErr);
      if (!Array.isArray(body.events) || body.events.length === 0 || body.events.length > MAX_SYNC_BATCH) {
        return error(400, 'invalid_request', `batch.events: expected 1..${MAX_SYNC_BATCH} events`);
      }
      // An event without a usable eventId cannot be acknowledged, so the batch is malformed.
      const unaddressable = body.events.findIndex((e) => !isObj(e) || typeof e.eventId !== 'string' || !PSEUDONYM_RE.test(e.eventId));
      if (unaddressable >= 0) return error(400, 'invalid_request', `batch.events[${unaddressable}].eventId: missing or bad format`);
    }
    const batch = body as { deviceId: string; events: Record<string, unknown>[] };

    const ack: SyncAck = { accepted: [], duplicate: [], rejected: [], asOf: '' };
    const seen = new Set<string>();
    for (let i = 0; i < batch.events.length; i++) {
      const raw = batch.events[i];
      const eventId = raw.eventId as string;
      if (seen.has(eventId)) continue; // same ID twice in one batch: listed once, by its first occurrence
      seen.add(eventId);
      const reason = checkSyncEvent(raw, `events[${i}]`);
      if (reason) {
        ack.rejected.push({ eventId, reason });
        continue;
      }
      const result = await deps.store.putEvent({
        schoolId: auth.schoolId,
        district: auth.district,
        deviceId: batch.deviceId,
        event: raw as unknown as SyncEvent,
        receivedAt: deps.now(),
        retentionDays: deps.config.retentionDays,
      });
      ack[result].push(eventId);
    }
    ack.asOf = deps.now().toISOString();
    return json(200, ack);
  });

  const getAggregates = guarded(deps, ['school_lead', 'district_lead'], async (req, auth) => {
    const q: Record<string, string> = { fromMonth: req.query.fromMonth, toMonth: req.query.toMonth };
    if (req.query.originLang !== undefined) q.originLang = req.query.originLang;
    if (req.query.district !== undefined) q.district = req.query.district;
    const err = checkAggregateQuery(q);
    if (err) return error(400, 'invalid_request', err);
    const query = q as unknown as AggregateQuery;

    const asDistrict = hasRole(auth, 'district_lead');
    if (asDistrict && !auth.district) return error(403, 'forbidden', 'account has no district');
    // A district filter may only name the caller's own district.
    if (query.district !== undefined && (!asDistrict || query.district !== auth.district)) return error(403, 'forbidden');

    let schools: string[];
    if (asDistrict) {
      schools = await deps.store.schoolsInDistrict(auth.district!);
    } else {
      schools = [auth.schoolId];
    }
    const counters: Counter[] = [];
    for (const s of schools) counters.push(...(await deps.store.readCounters(s, query.fromMonth, query.toMonth)));
    return json(200, summarise(counters, { originLang: query.originLang, schoolsTotal: schools.length, asOf: deps.now().toISOString() }));
  });

  const postSign = guarded(deps, ['teacher'], async (req) => {
    const err = checkSignRequest(req.body);
    if (err) return error(400, 'invalid_request', err);
    const sig = await deps.signer.sign(new TextEncoder().encode((req.body as { head: string }).head));
    if (sig.length !== 64) throw new Error(`signer returned ${sig.length} bytes`);
    const out: SignResponse = { kid: deps.signer.kid, sig: Buffer.from(sig).toString('base64url') };
    return json(200, out);
  });

  const getTrust = guarded(deps, 'any', async () => {
    const out: TrustListResponse = { keys: deps.trust.keys, revoked: deps.trust.revoked, asOf: deps.now().toISOString() };
    return json(200, out);
  });

  const deleteLearner = guarded(deps, ['school_lead'], async (req, auth) => {
    const pseudonym = req.params?.pseudonym ?? '';
    if (!PSEUDONYM_RE.test(pseudonym)) return error(400, 'invalid_request', 'pseudonym: bad format');
    const deleted = await deps.store.deleteLearner(auth.schoolId, pseudonym);
    return json(200, { deleted, asOf: deps.now().toISOString() });
  });

  return {
    'POST /events': postEvents,
    'GET /aggregates': getAggregates,
    'POST /sign': postSign,
    'GET /trust': getTrust,
    'DELETE /learners/{pseudonym}': deleteLearner,
  };
}
