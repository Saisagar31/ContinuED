/**
 * Runtime validators for the shared contracts. Each returns null when the
 * value is valid, or a short human-readable reason when it is not.
 * Used by the API (server-side validation) and by fixtures/fixtures.test.ts.
 */
import { LANGS, STATUSES, type LangCode } from './domain';
import { MAX_SYNC_BATCH } from './contracts';

type Check = (v: unknown, path: string) => string | null;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isLang = (v: unknown): v is LangCode => typeof v === 'string' && (LANGS as readonly string[]).includes(v);

const ID_RE = /^[A-Za-z0-9-]{4,64}$/;
const SKILL_RE = /^[a-z]+\.[a-z_]{2,40}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const B64U_RE = /^[A-Za-z0-9_-]+$/;
const HEX64_RE = /^[0-9a-f]{64}$/;

function str(v: unknown, path: string, re?: RegExp, max = 2000): string | null {
  if (typeof v !== 'string' || v.length === 0) return `${path}: expected non-empty string`;
  if (v.length > max) return `${path}: too long`;
  if (re && !re.test(v)) return `${path}: bad format`;
  return null;
}
function isoDate(v: unknown, path: string): string | null {
  if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) return `${path}: expected ISO date-time`;
  return null;
}
function count(v: unknown, path: string, max = 1_000_000): string | null {
  return Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max ? null : `${path}: expected count`;
}
function arr(v: unknown, path: string, item: Check, min = 0, max = 10_000): string | null {
  if (!Array.isArray(v)) return `${path}: expected array`;
  if (v.length < min) return `${path}: needs at least ${min}`;
  if (v.length > max) return `${path}: at most ${max} allowed`;
  for (let i = 0; i < v.length; i++) {
    const e = item(v[i], `${path}[${i}]`);
    if (e) return e;
  }
  return null;
}
const first = (...errs: (string | null)[]) => errs.find((e) => e !== null) ?? null;

const skillSummary: Check = (v, p) => {
  if (!isObj(v)) return `${p}: expected object`;
  if (!isObj(v.evidence)) return `${p}.evidence: expected object`;
  const e = v.evidence;
  return first(
    str(v.skillId, `${p}.skillId`, SKILL_RE),
    STATUSES.includes(v.status as never) ? null : `${p}.status: unknown status`,
    count(e.independent, `${p}.evidence.independent`, 99),
    count(e.prompted, `${p}.evidence.prompted`, 99),
    count(e.incorrect, `${p}.evidence.incorrect`, 99),
    count(e.skipped, `${p}.evidence.skipped`, 99),
  );
};

export const checkSyncEvent: Check = (v, p = 'event') => {
  if (!isObj(v)) return `${p}: expected object`;
  const types = ['assessment_completed', 'transfer_issued', 'transfer_received'];
  return first(
    str(v.eventId, `${p}.eventId`, ID_RE),
    types.includes(v.type as string) ? null : `${p}.type: unknown event type`,
    isoDate(v.occurredAt, `${p}.occurredAt`),
    str(v.learner, `${p}.learner`, ID_RE),
    str(v.contentVersion, `${p}.contentVersion`, /^[A-Za-z0-9.\-]{1,32}$/),
    isLang(v.originLang) ? null : `${p}.originLang: unsupported language`,
    v.destLang === undefined || isLang(v.destLang) ? null : `${p}.destLang: unsupported language`,
    v.type === 'transfer_received' && v.destLang === undefined ? `${p}.destLang: required for transfer_received` : null,
    arr(v.summary, `${p}.summary`, skillSummary, 1, 32),
  );
};

export function checkSyncBatch(v: unknown): string | null {
  if (!isObj(v)) return 'batch: expected object';
  return first(str(v.deviceId, 'batch.deviceId', ID_RE), arr(v.events, 'batch.events', checkSyncEvent, 1, MAX_SYNC_BATCH));
}

export function checkSyncAck(v: unknown): string | null {
  if (!isObj(v)) return 'ack: expected object';
  const ids: Check = (x, p) => str(x, p, ID_RE);
  const rej: Check = (x, p) => (isObj(x) ? first(str(x.eventId, `${p}.eventId`, ID_RE), str(x.reason, `${p}.reason`)) : `${p}: expected object`);
  return first(arr(v.accepted, 'ack.accepted', ids), arr(v.duplicate, 'ack.duplicate', ids), arr(v.rejected, 'ack.rejected', rej), isoDate(v.asOf, 'ack.asOf'));
}

export function checkSignRequest(v: unknown): string | null {
  if (!isObj(v)) return 'sign: expected object';
  return str(v.head, 'sign.head', /^CED\d+\.[A-Za-z0-9_-]+$/, 2000);
}

export function checkSignResponse(v: unknown): string | null {
  if (!isObj(v)) return 'signed: expected object';
  const e = first(str(v.kid, 'signed.kid', /^[A-Za-z0-9._-]{1,64}$/), str(v.sig, 'signed.sig', B64U_RE));
  if (e) return e;
  // 64 raw bytes encode to 86 base64url chars without padding.
  return (v.sig as string).length === 86 ? null : 'signed.sig: expected 64-byte raw P-256 signature';
}

export function checkTrustList(v: unknown): string | null {
  if (!isObj(v)) return 'trust: expected object';
  const key: Check = (k, p) =>
    isObj(k)
      ? first(
          str(k.kid, `${p}.kid`),
          str(k.issuer, `${p}.issuer`),
          isObj(k.publicJwk) && k.publicJwk.kty === 'EC' && k.publicJwk.crv === 'P-256' && !('d' in k.publicJwk)
            ? null
            : `${p}.publicJwk: expected public EC P-256 key (no private part)`,
          str(k.notBefore, `${p}.notBefore`, /^\d{4}-\d{2}-\d{2}$/),
          str(k.notAfter, `${p}.notAfter`, /^\d{4}-\d{2}-\d{2}$/),
        )
      : `${p}: expected object`;
  return first(arr(v.keys, 'trust.keys', key), arr(v.revoked, 'trust.revoked', (x, p) => str(x, p)), isoDate(v.asOf, 'trust.asOf'));
}

export function checkAggregateQuery(v: unknown): string | null {
  if (!isObj(v)) return 'query: expected object';
  const e = first(
    str(v.fromMonth, 'query.fromMonth', MONTH_RE),
    str(v.toMonth, 'query.toMonth', MONTH_RE),
    v.district === undefined ? null : str(v.district, 'query.district', undefined, 80),
    v.originLang === undefined || isLang(v.originLang) ? null : 'query.originLang: unsupported language',
  );
  if (e) return e;
  if ((v.fromMonth as string) > (v.toMonth as string)) return 'query: fromMonth after toMonth';
  const [fy, fm] = (v.fromMonth as string).split('-').map(Number);
  const [ty, tm] = (v.toMonth as string).split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm) <= 24 ? null : 'query: range is limited to 24 months';
}

export function checkAggregateResponse(v: unknown): string | null {
  if (!isObj(v)) return 'aggregate: expected object';
  const c = (x: unknown, p: string) => (x === null ? null : count(x, p));
  if (!isObj(v.coverage)) return 'aggregate.coverage: expected object';
  return first(
    isoDate(v.asOf, 'aggregate.asOf'),
    count(v.coverage.schoolsReporting, 'aggregate.coverage.schoolsReporting'),
    count(v.coverage.schoolsTotal, 'aggregate.coverage.schoolsTotal'),
    c(v.totalTransfers, 'aggregate.totalTransfers'),
    arr(v.corridors, 'aggregate.corridors', (x, p) =>
      isObj(x) ? first(isLang(x.from) ? null : `${p}.from: bad lang`, isLang(x.to) ? null : `${p}.to: bad lang`, c(x.count, `${p}.count`)) : `${p}: expected object`,
    ),
    arr(v.skills, 'aggregate.skills', (x, p) => (isObj(x) ? first(str(x.skillId, `${p}.skillId`, SKILL_RE), c(x.count, `${p}.count`)) : `${p}: expected object`)),
    arr(v.byMonth, 'aggregate.byMonth', (x, p) => (isObj(x) ? first(str(x.month, `${p}.month`, MONTH_RE), c(x.count, `${p}.count`)) : `${p}: expected object`)),
    count(v.suppressionThreshold, 'aggregate.suppressionThreshold', 1000),
  );
}

export function checkAudioManifest(v: unknown): string | null {
  if (!isObj(v)) return 'manifest: expected object';
  const clip: Check = (x, p) =>
    isObj(x)
      ? first(
          str(x.contentId, `${p}.contentId`),
          str(x.textSha256, `${p}.textSha256`, HEX64_RE),
          str(x.file, `${p}.file`, /^[a-z]{2}\/[0-9a-f]{8,64}\.mp3$/),
          str(x.sha256, `${p}.sha256`, HEX64_RE),
          Number.isInteger(x.bytes) && (x.bytes as number) > 0 ? null : `${p}.bytes: expected positive integer`,
          ['unreviewed', 'approved', 'rejected'].includes(x.reviewStatus as string) ? null : `${p}.reviewStatus: unknown`,
        )
      : `${p}: expected object`;
  return first(
    str(v.packVersion, 'manifest.packVersion'),
    str(v.contentVersion, 'manifest.contentVersion'),
    isLang(v.lang) ? null : 'manifest.lang: unsupported language',
    str(v.voiceId, 'manifest.voiceId'),
    str(v.modelId, 'manifest.modelId'),
    isoDate(v.createdAt, 'manifest.createdAt'),
    arr(v.clips, 'manifest.clips', clip),
  );
}

export function checkContentPack(v: unknown): string | null {
  if (!isObj(v)) return 'pack: expected object';
  const lang = v.lang;
  const item: Check = (x, p) =>
    isObj(x)
      ? first(
          str(x.itemId, `${p}.itemId`),
          str(x.skillId, `${p}.skillId`, SKILL_RE),
          str(x.version, `${p}.version`),
          Number.isInteger(x.band) && (x.band as number) >= 1 && (x.band as number) <= 10 ? null : `${p}.band: expected 1–10`,
          x.lang === lang ? null : `${p}.lang: must match pack language`,
          str(x.prompt, `${p}.prompt`),
          x.stimulus === undefined ? null : str(x.stimulus, `${p}.stimulus`),
          str(x.expected, `${p}.expected`),
          str(x.scoring, `${p}.scoring`),
          ['none', 'instruction', 'full'].includes(x.audio as string) ? null : `${p}.audio: unknown`,
          // A reading stimulus must not be voiced in full: hearing it reveals the answer.
          x.stimulus !== undefined && x.audio === 'full' && (x.skillId as string).startsWith('lit.')
            ? `${p}.audio: reading stimulus cannot be fully voiced`
            : null,
          ['draft', 'approved'].includes(x.reviewStatus as string) ? null : `${p}.reviewStatus: unknown`,
        )
      : `${p}: expected object`;
  return first(str(v.contentVersion, 'pack.contentVersion'), isLang(lang) ? null : 'pack.lang: unsupported language', arr(v.items, 'pack.items', item, 1));
}
