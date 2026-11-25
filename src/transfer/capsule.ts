/**
 * Transfer capsule codec (task 08).
 *
 * Wire format (text code and QR payload are identical):
 *
 *   CED<ver>.<payload>.<sig>.<check>
 *
 *   ver      envelope version (this codec understands 1)
 *   payload  base64url(deflate-raw(JSON envelope))
 *   sig      "-" when unsigned, otherwise "<kid>~<base64url(ECDSA P-256 / SHA-256 raw sig)>"
 *            signed over the ASCII bytes "CED<ver>.<payload>"
 *   check    first 8 base64url chars of SHA-256 over everything before ".<check>"
 *            — detects copy/scan damage; it is NOT a trust signal.
 *
 * Decode outcomes are deliberately distinct: malformed, wrong_version, damaged,
 * and (for well-formed records) a trust state from the trust store.
 */
import { AGE_BANDS, LANGS, STATUSES } from '../domain/types';
import type { AgeBand, EvidenceCounts, LangCode, SkillStatus, SkillSummary, TrustState } from '../domain/types';
import { fromB64u, toB64u, utf8 } from './bytes';
import { type TrustStore, verifySignature } from './trust';

export const CAPSULE_VERSION = 1;
export const PREFIX = 'CED';
const MAX_CODE_LENGTH = 2000;
const MAX_SKILLS = 32;

export interface TransferEnvelope {
  v: 1;
  tid: string; // transfer ID
  lp: string; // learner pseudonym
  age?: AgeBand;
  ol: LangCode; // origin / assessment language
  ad: string; // assessment date YYYY-MM-DD
  cv: string; // content version
  s: SkillSummary[]; // ordered skill summary
}

// Compact on-wire form keeps QR codes small.
type WireSkill = [string, number, number, number, number, number];
interface WireEnvelope {
  v: 1;
  tid: string;
  lp: string;
  age?: string;
  ol: string;
  ad: string;
  cv: string;
  s: WireSkill[];
}

export type DecodeResult =
  | { ok: true; envelope: TransferEnvelope; trust: TrustState; kid?: string; issuer?: string; code: string }
  | { ok: false; reason: 'malformed' | 'wrong_version' | 'damaged'; detail: string; version?: number };

// ---------- compression ----------

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([data]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}
const deflate = (d: Uint8Array) => pipe(d, new CompressionStream('deflate-raw'));
const inflate = (d: Uint8Array) => pipe(d, new DecompressionStream('deflate-raw'));

async function checkOf(text: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', utf8(text)));
  return toB64u(h).slice(0, 8);
}

// ---------- validation ----------

const ID_RE = /^[A-Za-z0-9-]{4,40}$/;
const SKILL_RE = /^[a-z]+\.[a-z_]{2,40}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CV_RE = /^[A-Za-z0-9.\-]{1,32}$/;

function isCount(n: unknown): n is number {
  return Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 99;
}

export function validateEnvelope(e: TransferEnvelope): string | null {
  if (e.v !== 1) return 'version field mismatch';
  if (!ID_RE.test(e.tid)) return 'bad transfer id';
  if (!ID_RE.test(e.lp)) return 'bad learner pseudonym';
  if (e.age !== undefined && !AGE_BANDS.includes(e.age)) return 'bad age band';
  if (!LANGS.includes(e.ol)) return 'unsupported origin language';
  if (!DATE_RE.test(e.ad) || Number.isNaN(Date.parse(e.ad))) return 'bad assessment date';
  if (!CV_RE.test(e.cv)) return 'bad content version';
  if (!Array.isArray(e.s) || e.s.length > MAX_SKILLS) return 'bad skill summary';
  const seen = new Set<string>();
  for (const s of e.s) {
    if (!SKILL_RE.test(s.skillId) || seen.has(s.skillId)) return `bad skill id ${s.skillId}`;
    seen.add(s.skillId);
    if (!STATUSES.includes(s.status)) return `bad status for ${s.skillId}`;
    const ev = s.evidence;
    if (![ev.independent, ev.prompted, ev.incorrect, ev.skipped].every(isCount)) return `bad evidence for ${s.skillId}`;
  }
  return null;
}

function toWire(e: TransferEnvelope): WireEnvelope {
  return {
    v: 1,
    tid: e.tid,
    lp: e.lp,
    ...(e.age ? { age: e.age } : {}),
    ol: e.ol,
    ad: e.ad,
    cv: e.cv,
    s: e.s.map((x) => [
      x.skillId,
      STATUSES.indexOf(x.status),
      x.evidence.independent,
      x.evidence.prompted,
      x.evidence.incorrect,
      x.evidence.skipped,
    ]),
  };
}

function fromWire(w: unknown): TransferEnvelope | string {
  if (!w || typeof w !== 'object') return 'payload is not an object';
  const o = w as Partial<WireEnvelope>;
  if (!Array.isArray(o.s)) return 'missing skill summary';
  const s: SkillSummary[] = [];
  for (const row of o.s) {
    if (!Array.isArray(row) || row.length !== 6 || typeof row[0] !== 'string') return 'bad skill row';
    const status = STATUSES[row[1] as number];
    if (!status) return 'bad status code';
    const evidence: EvidenceCounts = { independent: row[2], prompted: row[3], incorrect: row[4], skipped: row[5] };
    s.push({ skillId: row[0], status: status as SkillStatus, evidence });
  }
  const env: TransferEnvelope = {
    v: o.v as 1,
    tid: String(o.tid ?? ''),
    lp: String(o.lp ?? ''),
    ...(o.age !== undefined ? { age: o.age as AgeBand } : {}),
    ol: o.ol as LangCode,
    ad: String(o.ad ?? ''),
    cv: String(o.cv ?? ''),
    s,
  };
  return validateEnvelope(env) ?? env;
}

// ---------- encode ----------

export interface Signer {
  kid: string;
  sign(data: Uint8Array): Promise<Uint8Array>;
}

export async function encodeCapsule(env: TransferEnvelope, signer?: Signer): Promise<string> {
  const err = validateEnvelope(env);
  if (err) throw new Error(`Invalid envelope: ${err}`);
  const payload = toB64u(await deflate(utf8(JSON.stringify(toWire(env)))));
  const head = `${PREFIX}${CAPSULE_VERSION}.${payload}`;
  const sig = signer ? `${signer.kid}~${toB64u(await signer.sign(utf8(head)))}` : '-';
  const body = `${head}.${sig}`;
  const code = `${body}.${await checkOf(body)}`;
  if (code.length > MAX_CODE_LENGTH) throw new Error('Capsule exceeds the size bound');
  return code;
}

// ---------- decode ----------

/** Normalises pasted text: strips whitespace/newlines a chat app or print scan may add. */
export function normaliseCode(raw: string): string {
  return raw.replace(/\s+/g, '');
}

export async function decodeCapsule(raw: string, trust: TrustStore, now = new Date()): Promise<DecodeResult> {
  const code = normaliseCode(raw);
  if (!code) return { ok: false, reason: 'malformed', detail: 'empty code' };
  if (code.length > MAX_CODE_LENGTH) return { ok: false, reason: 'malformed', detail: 'code too long' };
  const m = /^CED(\d{1,3})\./.exec(code);
  if (!m) return { ok: false, reason: 'malformed', detail: 'not a ContinuED transfer code' };
  const version = Number(m[1]);
  if (version !== CAPSULE_VERSION) {
    return { ok: false, reason: 'wrong_version', version, detail: `transfer version ${version}; this app reads version ${CAPSULE_VERSION}` };
  }
  const parts = code.split('.');
  if (parts.length !== 4) return { ok: false, reason: 'malformed', detail: 'wrong number of sections' };
  const [, payload, sig, check] = parts;
  const body = parts.slice(0, 3).join('.');
  if ((await checkOf(body)) !== check) {
    return { ok: false, reason: 'damaged', detail: 'check characters do not match — the code was copied or scanned incompletely' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(await inflate(fromB64u(payload))));
  } catch {
    return { ok: false, reason: 'malformed', detail: 'payload could not be decoded' };
  }
  const env = fromWire(parsed);
  if (typeof env === 'string') return { ok: false, reason: 'malformed', detail: env };

  if (sig === '-') return { ok: true, envelope: env, trust: 'unverified', code };

  const [kid, sigB64] = sig.split('~');
  if (!kid || !sigB64) return { ok: false, reason: 'malformed', detail: 'bad signature section' };
  const v = await verifySignature(trust, kid, utf8(`${parts[0]}.${payload}`), fromB64u(sigB64), env.ad, now);
  return { ok: true, envelope: env, trust: v.state, kid, issuer: v.issuer, code };
}

export function newTransferId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return 'T-' + toB64u(bytes).replace(/[_-]/g, 'x').slice(0, 12);
}
