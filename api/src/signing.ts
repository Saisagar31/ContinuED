/**
 * Issuer signing (task 11). The private key never leaves the server: in AWS it
 * stays inside KMS (ECC_NIST_P256, SIGN_VERIFY). The client verifies with Web
 * Crypto, which expects a raw 64-byte r||s signature, while KMS returns DER —
 * derToRaw() converts.
 */
import { KMSClient, SignCommand } from '@aws-sdk/client-kms';

export interface IssuerSigner {
  kid: string;
  /** Signs bytes with ECDSA P-256 / SHA-256. Returns the raw 64-byte r||s signature. */
  sign(bytes: Uint8Array): Promise<Uint8Array>;
}

/** Converts a DER ECDSA-Sig-Value (SEQUENCE { INTEGER r, INTEGER s }) to raw r||s, each 32 bytes. */
export function derToRaw(der: Uint8Array, size = 32): Uint8Array {
  let i = 0;
  const fail = (why: string): never => {
    throw new Error(`bad DER signature: ${why}`);
  };
  const readLen = (): number => {
    if (i >= der.length) fail('truncated');
    const b = der[i++];
    if (b < 0x80) return b;
    const n = b & 0x7f;
    if (n === 0 || n > 2) fail('unsupported length');
    let len = 0;
    for (let k = 0; k < n; k++) {
      if (i >= der.length) fail('truncated');
      len = (len << 8) | der[i++];
    }
    return len;
  };
  const readInt = (): Uint8Array => {
    if (der[i++] !== 0x02) fail('expected INTEGER');
    const len = readLen();
    if (len === 0 || i + len > der.length) fail('bad INTEGER length');
    let v = der.subarray(i, i + len);
    i += len;
    while (v.length > 1 && v[0] === 0) v = v.subarray(1); // drop sign padding / leading zeros
    if (v.length > size) fail('INTEGER too large');
    const out = new Uint8Array(size);
    out.set(v, size - v.length); // left-pad short integers
    return out;
  };

  if (der[i++] !== 0x30) fail('expected SEQUENCE');
  const seqLen = readLen();
  if (i + seqLen !== der.length) fail('length mismatch');
  const r = readInt();
  const s = readInt();
  if (i !== der.length) fail('trailing bytes');
  const raw = new Uint8Array(size * 2);
  raw.set(r, 0);
  raw.set(s, size);
  return raw;
}

/** The KMS call we make; tests pass a mock. */
export interface KmsSender {
  send(command: SignCommand): Promise<{ Signature?: Uint8Array }>;
}

export function kmsSigner(keyId: string, kid: string, client: KmsSender = new KMSClient({})): IssuerSigner {
  return {
    kid,
    async sign(bytes) {
      const res = await client.send(new SignCommand({ KeyId: keyId, Message: bytes, MessageType: 'RAW', SigningAlgorithm: 'ECDSA_SHA_256' }));
      if (!res.Signature) throw new Error('KMS returned no signature');
      return derToRaw(res.Signature);
    },
  };
}

const ALG = { name: 'ECDSA', namedCurve: 'P-256' } as const;

/** Dev/test signer: an in-memory Web Crypto P-256 key. Not for production use. */
export async function localSigner(kid = 'dev-local-1'): Promise<{ signer: IssuerSigner; publicJwk: JsonWebKey }> {
  const pair = (await crypto.subtle.generateKey(ALG, true, ['sign', 'verify'])) as CryptoKeyPair;
  const { kty, crv, x, y } = await crypto.subtle.exportKey('jwk', pair.publicKey);
  return {
    signer: {
      kid,
      sign: async (bytes) => new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, bytes)),
    },
    publicJwk: { kty, crv, x, y },
  };
}
