import { describe, expect, it } from 'vitest';
import { decodeCapsule, encodeCapsule, newTransferId, type TransferEnvelope } from './capsule';
import { EMPTY_TRUST, createTestSigner } from './trust';
import { fromB64u, toB64u, utf8 } from './bytes';

const ev = (i = 0, p = 0, x = 0, s = 0) => ({ independent: i, prompted: p, incorrect: x, skipped: s });

const sample: TransferEnvelope = {
  v: 1,
  tid: 'T-abc123XYZ789',
  lp: 'L-7K3Q-9FX2',
  age: '7-8',
  ol: 'mr',
  ad: '2026-11-20',
  cv: 'sample-0.1',
  s: [
    { skillId: 'num.recognition', status: 'mastered', evidence: ev(3) },
    { skillId: 'num.place_value', status: 'developing', evidence: ev(1, 2, 1) },
    { skillId: 'num.add_no_carry', status: 'not_yet', evidence: ev(0, 0, 2, 1) },
    { skillId: 'lit.initial_sounds', status: 'insufficient', evidence: ev(0, 0, 0, 2) },
  ],
};

async function recheck(body: string) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', utf8(body)));
  return `${body}.${toB64u(h).slice(0, 8)}`;
}

describe('capsule codec', () => {
  it('round-trips an unsigned envelope as unverified', async () => {
    const code = await encodeCapsule(sample);
    expect(code.startsWith('CED1.')).toBe(true);
    expect(code.length).toBeLessThan(400); // fits a comfortable QR version
    const r = await decodeCapsule(code, EMPTY_TRUST);
    expect(r.ok && r.trust).toBe('unverified');
    expect(r.ok && r.envelope).toEqual(sample);
  });

  it('tolerates whitespace and line breaks from pasting', async () => {
    const code = await encodeCapsule(sample);
    const messy = `  ${code.slice(0, 20)}\n${code.slice(20, 60)} \r\n${code.slice(60)} `;
    const r = await decodeCapsule(messy, EMPTY_TRUST);
    expect(r.ok).toBe(true);
  });

  it('verifies a signed envelope against a trusted key', async () => {
    const { signer, trusted } = await createTestSigner('sch-a-2026', 'Test School A');
    const code = await encodeCapsule(sample, signer);
    const r = await decodeCapsule(code, { keys: [trusted], revoked: [] });
    expect(r.ok && r.trust).toBe('verified');
    expect(r.ok && r.issuer).toBe('Test School A');
  });

  it('distinguishes wrong version, malformed, damaged and altered', async () => {
    const { signer, trusted } = await createTestSigner('sch-a-2026', 'Test School A');
    const store = { keys: [trusted], revoked: [] };
    const code = await encodeCapsule(sample, signer);

    const wrongVersion = await decodeCapsule(code.replace(/^CED1/, 'CED2'), store);
    expect(wrongVersion).toMatchObject({ ok: false, reason: 'wrong_version', version: 2 });

    expect(await decodeCapsule('hello world', store)).toMatchObject({ ok: false, reason: 'malformed' });
    expect(await decodeCapsule('CED1.abc', store)).toMatchObject({ ok: false, reason: 'malformed' });

    // Truncated / mistyped character -> damaged (check mismatch)
    const damaged = code.slice(0, 30) + (code[30] === 'A' ? 'B' : 'A') + code.slice(31);
    expect(await decodeCapsule(damaged, store)).toMatchObject({ ok: false, reason: 'damaged' });

    // Deliberate alteration: change the payload and recompute the check -> altered
    const [, , sig] = code.split('.');
    const forged = await encodeCapsule({ ...sample, s: sample.s.map((x) => ({ ...x, status: 'mastered' as const })) });
    const forgedPayload = forged.split('.')[1];
    const tampered = await recheck(`CED1.${forgedPayload}.${sig}`);
    const r = await decodeCapsule(tampered, store);
    expect(r.ok && r.trust).toBe('altered');
  });

  it('reports unknown, revoked and expired keys distinctly', async () => {
    const { signer, trusted } = await createTestSigner('sch-b-2025', 'Test School B', '2025-01-01', '2025-12-31');
    const code = await encodeCapsule(sample, signer);
    expect(await decodeCapsule(code, EMPTY_TRUST)).toMatchObject({ ok: true, trust: 'unknown_key' });
    expect(await decodeCapsule(code, { keys: [trusted], revoked: ['sch-b-2025'] })).toMatchObject({ trust: 'revoked_key' });
    expect(await decodeCapsule(code, { keys: [trusted], revoked: [] })).toMatchObject({ trust: 'expired_key' });
  });

  it('rejects payloads that decode but fail schema validation', async () => {
    const bad = { v: 1, tid: 'x', lp: 'L-1', ol: 'fr', ad: 'yesterday', cv: '', s: [] };
    const bytes = utf8(JSON.stringify(bad));
    const out = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const payload = toB64u(new Uint8Array(await new Response(out).arrayBuffer()));
    const code = await recheck(`CED1.${payload}.-`);
    expect(await decodeCapsule(code, EMPTY_TRUST)).toMatchObject({ ok: false, reason: 'malformed' });
  });

  it('refuses to encode an invalid envelope', async () => {
    await expect(encodeCapsule({ ...sample, ol: 'xx' as never })).rejects.toThrow(/origin language/);
  });

  it('generates distinct transfer ids', () => {
    const ids = new Set(Array.from({ length: 200 }, newTransferId));
    expect(ids.size).toBe(200);
    expect(fromB64u('AQID')).toEqual(new Uint8Array([1, 2, 3]));
  });
});
