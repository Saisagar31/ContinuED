import { generateKeyPairSync, sign as nodeSign } from 'node:crypto';
import { SignCommand } from '@aws-sdk/client-kms';
import { describe, expect, it } from 'vitest';
import { derToRaw, kmsSigner, localSigner } from './signing';

const bytes = (n: number, fill: number) => new Uint8Array(n).fill(fill);
const cat = (...parts: (Uint8Array | number[])[]) => Uint8Array.from(parts.flatMap((p) => [...p]));
const int = (v: Uint8Array) => cat([0x02, v.length], v);
const seq = (...ints: Uint8Array[]) => {
  const body = cat(...ints);
  return cat([0x30, body.length], body);
};

describe('derToRaw', () => {
  it('32-byte integers pass through', () => {
    const r = bytes(32, 0x11);
    const s = bytes(32, 0x22);
    expect(derToRaw(seq(int(r), int(s)))).toEqual(cat(r, s));
  });

  it('33-byte integers (0x00 sign padding before a high bit) are trimmed', () => {
    const r = bytes(32, 0x81);
    const s = bytes(32, 0xff);
    const der = seq(int(cat([0x00], r)), int(cat([0x00], s)));
    expect(der.length).toBe(72);
    expect(derToRaw(der)).toEqual(cat(r, s));
  });

  it('short integers (< 32 bytes) are left-padded with zeros', () => {
    const r = bytes(31, 0x7f);
    const s = Uint8Array.of(0x05);
    const out = derToRaw(seq(int(r), int(s)));
    expect(out).toEqual(cat([0x00], r, bytes(31, 0), [0x05]));
    expect(out.length).toBe(64);
  });

  it('a fixed real-world shaped vector: r 33 bytes, s 30 bytes', () => {
    const r = cat([0x00, 0x9c], bytes(31, 0x01));
    const s = bytes(30, 0x42);
    expect(derToRaw(seq(int(r), int(s)))).toEqual(cat([0x9c], bytes(31, 0x01), [0, 0], s));
  });

  it('rejects malformed input', () => {
    const ok = seq(int(bytes(32, 1)), int(bytes(32, 2)));
    expect(() => derToRaw(cat([0x31], ok.subarray(1)))).toThrow(/SEQUENCE/);
    expect(() => derToRaw(cat(ok, [0x00]))).toThrow();
    expect(() => derToRaw(ok.subarray(0, 40))).toThrow();
    expect(() => derToRaw(seq(int(cat([0x01], bytes(32, 1))), int(bytes(32, 2))))).toThrow(/too large/);
    expect(() => derToRaw(seq(int(bytes(32, 1))))).toThrow();
    expect(() => derToRaw(new Uint8Array())).toThrow();
  });

  it('round-trips real DER signatures from Node crypto into Web Crypto verification', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const pub = await crypto.subtle.importKey('jwk', publicKey.export({ format: 'jwk' }) as JsonWebKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    for (let i = 0; i < 40; i++) {
      const data = new TextEncoder().encode(`CED1.payload-${i}`);
      const der = nodeSign('sha256', data, { key: privateKey, dsaEncoding: 'der' });
      const raw = derToRaw(new Uint8Array(der));
      expect(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, raw, data)).toBe(true);
    }
  });
});

describe('kmsSigner', () => {
  it('sends a RAW ECDSA_SHA_256 SignCommand and converts the DER reply', async () => {
    const sent: SignCommand[] = [];
    const r = bytes(32, 0x90);
    const s = bytes(31, 0x10);
    const client = {
      async send(cmd: SignCommand) {
        sent.push(cmd);
        return { Signature: seq(int(cat([0x00], r)), int(s)) };
      },
    };
    const signer = kmsSigner('alias/continued-issuer-staging', 'staging-1', client);
    const msg = new TextEncoder().encode('CED1.abc');
    const out = await signer.sign(msg);
    expect(signer.kid).toBe('staging-1');
    expect(sent).toHaveLength(1);
    expect(sent[0]).toBeInstanceOf(SignCommand);
    expect(sent[0].input).toEqual({ KeyId: 'alias/continued-issuer-staging', Message: msg, MessageType: 'RAW', SigningAlgorithm: 'ECDSA_SHA_256' });
    expect(out).toEqual(cat(r, [0], s));
  });

  it('throws when KMS returns no signature', async () => {
    const signer = kmsSigner('k', 'kid', { send: async () => ({}) });
    await expect(signer.sign(new Uint8Array([1]))).rejects.toThrow(/no signature/);
  });
});

describe('localSigner', () => {
  it('publishes only the public JWK and produces 64-byte signatures', async () => {
    const { signer, publicJwk } = await localSigner('k-test');
    expect(publicJwk).toEqual({ kty: 'EC', crv: 'P-256', x: expect.any(String), y: expect.any(String) });
    expect((await signer.sign(new Uint8Array([1, 2, 3]))).length).toBe(64);
  });
});
