/**
 * Signer backed by the school API's POST /sign (task 11). The private key stays
 * on the server (KMS); the browser only sends the capsule head and gets r||s back.
 *
 * encodeCapsule() reads signer.kid BEFORE it awaits sign(), so the kid must be known
 * up front. Pass the issuing kid (e.g. currentIssuerKid(trustList)); if the server
 * signs with a different kid (key rotated since the trust list was fetched), sign()
 * throws 'issuer_key_mismatch' instead of producing a code that would not verify.
 */
import { checkSignResponse } from '../../shared/guards';
import type { SignResponse } from '../../shared/contracts';
import type { Signer } from './capsule';
import { fromB64u } from './bytes';
import type { TrustStore } from './trust';

export interface ServerSignerOptions {
  apiUrl: string;
  kid: string;
  /** Current ID token, or null when the teacher must sign in again. */
  getToken: () => Promise<string | null>;
  fetch: typeof fetch;
}

export function serverSigner(opts: ServerSignerOptions): Signer {
  return {
    kid: opts.kid,
    async sign(data: Uint8Array): Promise<Uint8Array> {
      const token = await opts.getToken();
      if (!token) throw new Error('unauthorized');
      const res = await opts.fetch(`${opts.apiUrl.replace(/\/$/, '')}/sign`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ head: new TextDecoder().decode(data) }),
      });
      if (res.status === 401) throw new Error('unauthorized');
      if (!res.ok) throw new Error(`sign failed (${res.status})`);
      const body: unknown = await res.json();
      const bad = checkSignResponse(body);
      if (bad) throw new Error(`invalid sign response: ${bad}`);
      const { kid, sig } = body as SignResponse;
      if (kid !== opts.kid) throw new Error('issuer_key_mismatch');
      return fromB64u(sig);
    },
  };
}

/**
 * The kid a server is expected to sign with today: among non-revoked keys valid on
 * `today` (YYYY-MM-DD), the one with the latest notBefore. Undefined if none.
 */
export function currentIssuerKid(trust: TrustStore, today = new Date().toISOString().slice(0, 10)): string | undefined {
  return trust.keys
    .filter((k) => !trust.revoked.includes(k.kid) && k.notBefore <= today && today <= k.notAfter)
    .sort((a, b) => b.notBefore.localeCompare(a.notBefore))[0]?.kid;
}
