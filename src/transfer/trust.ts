/**
 * Offline issuer trust. Public keys are provisioned to the device during online
 * setup (task 11 owns the signing service and key distribution). Private keys
 * never live in the browser for school-authenticated records.
 *
 * Open decisions recorded here (section 3, "Issuer trust"): key expiry, rotation,
 * revocation freshness, unknown-key behaviour. Current behaviour:
 *  - unknown kid            -> 'unknown_key'  (shown, not trusted)
 *  - assessment date outside key validity -> 'expired_key'
 *  - kid on revocation list -> 'revoked_key'
 *  - signature mismatch     -> 'altered'
 */
import type { TrustState } from '../domain/types';
import type { Signer } from './capsule';

export interface TrustedKey {
  kid: string;
  issuer: string; // school display name
  publicJwk: JsonWebKey;
  notBefore: string; // YYYY-MM-DD
  notAfter: string; // YYYY-MM-DD
}

export interface TrustStore {
  keys: TrustedKey[];
  revoked: string[];
  revocationListAsOf?: string;
}

export const EMPTY_TRUST: TrustStore = { keys: [], revoked: [] };

const ALG = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SIG = { name: 'ECDSA', hash: 'SHA-256' } as const;

export async function verifySignature(
  store: TrustStore,
  kid: string,
  data: Uint8Array,
  sig: Uint8Array,
  assessedOn: string,
  _now: Date,
): Promise<{ state: TrustState; issuer?: string }> {
  const key = store.keys.find((k) => k.kid === kid);
  if (!key) return { state: 'unknown_key' };
  if (store.revoked.includes(kid)) return { state: 'revoked_key', issuer: key.issuer };
  let ok = false;
  try {
    const pub = await crypto.subtle.importKey('jwk', key.publicJwk, ALG, false, ['verify']);
    ok = await crypto.subtle.verify(SIG, pub, sig, data);
  } catch {
    ok = false;
  }
  if (!ok) return { state: 'altered', issuer: key.issuer };
  if (assessedOn < key.notBefore || assessedOn > key.notAfter) return { state: 'expired_key', issuer: key.issuer };
  return { state: 'verified', issuer: key.issuer };
}

/** Test/staging helper only — production signing happens on the school server. */
export async function createTestSigner(kid: string, issuer: string, notBefore = '2020-01-01', notAfter = '2099-12-31') {
  const pair = (await crypto.subtle.generateKey(ALG, true, ['sign', 'verify'])) as CryptoKeyPair;
  const signer: Signer = {
    kid,
    sign: async (d) => new Uint8Array(await crypto.subtle.sign(SIG, pair.privateKey, d)),
  };
  const trusted: TrustedKey = {
    kid,
    issuer,
    publicJwk: await crypto.subtle.exportKey('jwk', pair.publicKey),
    notBefore,
    notAfter,
  };
  return { signer, trusted };
}
