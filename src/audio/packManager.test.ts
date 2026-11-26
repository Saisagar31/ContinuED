import { describe, expect, it, vi } from 'vitest';
import type { AudioManifest } from '../../shared/contracts';
import { activePack, cacheNameFor, clipBlobFor, clipUrlFor, installPack, type CacheLike, type CachesLike, type KeyValueLike, type PackDeps } from './packManager';

// --- in-memory fakes -------------------------------------------------------
class FakeCaches implements CachesLike {
  stores = new Map<string, Map<string, ArrayBuffer>>();
  async open(name: string): Promise<CacheLike> {
    if (!this.stores.has(name)) this.stores.set(name, new Map());
    const m = this.stores.get(name)!;
    return {
      put: async (url, res) => void m.set(url, await res.arrayBuffer()),
      match: async (url) => (m.has(url) ? new Response(m.get(url)!.slice(0)) : undefined),
    };
  }
  async delete(name: string) {
    return this.stores.delete(name);
  }
}
class FakeKv implements KeyValueLike {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

const hex = async (b: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', b)), (x) => x.toString(16).padStart(2, '0')).join('');
const BASE = 'https://cdn.test/audio';

/** Builds a served pack: manifest + clip bodies keyed by URL. */
async function pack(version: string, clips: { id: string; file: string; body: Uint8Array; status?: 'approved' | 'unreviewed' }[]) {
  const files: Record<string, Uint8Array> = {};
  const manifest: AudioManifest = {
    packVersion: version,
    contentVersion: 'sample-0.1',
    lang: 'mr',
    voiceId: 'v',
    modelId: 'm',
    createdAt: '2026-11-26T10:00:00Z',
    clips: [],
  };
  for (const c of clips) {
    files[`${BASE}/${c.file}`] = c.body;
    manifest.clips.push({ contentId: c.id, textSha256: 'a'.repeat(64), file: c.file, sha256: await hex(c.body), bytes: c.body.length, reviewStatus: c.status ?? 'approved' });
  }
  return { manifest, files };
}

function server(p: { manifest: AudioManifest; files: Record<string, Uint8Array> }, opts: { throwOn?: string } = {}) {
  return vi.fn(async (url: string) => {
    if (url === `${BASE}/mr/manifest.json`) return new Response(JSON.stringify(p.manifest));
    if (opts.throwOn && url.endsWith(opts.throwOn)) throw new TypeError('network lost');
    const b = p.files[url];
    return b ? new Response(b.slice()) : new Response('', { status: 404 });
  });
}

function deps(fetchImpl: ReturnType<typeof server>, shared?: { caches: FakeCaches; kv: FakeKv }, quota = 1e9): PackDeps & { caches: FakeCaches; kv: FakeKv } {
  return { fetch: fetchImpl as never, caches: shared?.caches ?? new FakeCaches(), kv: shared?.kv ?? new FakeKv(), storage: { estimate: async () => ({ quota, usage: 0 }) } };
}

const A = new Uint8Array([1, 2, 3, 4]);
const B = new Uint8Array([5, 6, 7]);

describe('installPack', () => {
  it('activates a good pack and serves its clips', async () => {
    const p = await pack('v1', [
      { id: 'a.nr.1', file: 'mr/00000000aaaaaaaa.mp3', body: A },
      { id: 'a.nr.2', file: 'mr/00000000aaaaaaaa.mp3', body: A }, // shared file
      { id: 'a.pv.1', file: 'mr/00000000bbbbbbbb.mp3', body: B, status: 'unreviewed' },
    ]);
    const d = deps(server(p));
    const r = await installPack('mr', BASE, d);
    expect(r).toEqual({ ok: true, packVersion: 'v1', clips: 3, alreadyActive: false });
    expect(d.fetch).toHaveBeenCalledTimes(3); // manifest + 2 distinct files
    expect((await activePack('mr', d))?.packVersion).toBe('v1');
    expect(await clipUrlFor('mr', 'a.nr.1', d)).toBe(`${BASE}/mr/00000000aaaaaaaa.mp3`);
    expect(await clipUrlFor('mr', 'a.pv.1', d)).toBeNull(); // unreviewed is not played
    expect(new Uint8Array(await (await clipBlobFor('mr', 'a.nr.1', d))!.arrayBuffer())).toEqual(A);
  });

  it('upgrading deletes the old cache only after the new one verifies', async () => {
    const shared = { caches: new FakeCaches(), kv: new FakeKv() };
    await installPack('mr', BASE, deps(server(await pack('v1', [{ id: 'x1', file: 'mr/00000000aaaaaaaa.mp3', body: A }])), shared));
    const r = await installPack('mr', BASE, deps(server(await pack('v2', [{ id: 'x1', file: 'mr/00000000bbbbbbbb.mp3', body: B }])), shared));
    expect(r.ok).toBe(true);
    expect([...shared.caches.stores.keys()]).toEqual([cacheNameFor('mr', 'v2')]);
  });

  it('hash mismatch rejects the new pack and keeps the old one', async () => {
    const shared = { caches: new FakeCaches(), kv: new FakeKv() };
    await installPack('mr', BASE, deps(server(await pack('v1', [{ id: 'x1', file: 'mr/00000000aaaaaaaa.mp3', body: A }])), shared));
    const bad = await pack('v2', [{ id: 'x1', file: 'mr/00000000bbbbbbbb.mp3', body: B }]);
    bad.files[`${BASE}/mr/00000000bbbbbbbb.mp3`] = new Uint8Array([9, 9, 9]); // same size, wrong bytes
    const r = await installPack('mr', BASE, deps(server(bad), shared));
    expect(r).toMatchObject({ ok: false, error: 'hash_mismatch' });
    expect(shared.caches.stores.has(cacheNameFor('mr', 'v2'))).toBe(false);
    expect((await activePack('mr', { ...deps(server(bad), shared) }))?.packVersion).toBe('v1');
    expect(await clipBlobFor('mr', 'x1', deps(server(bad), shared))).not.toBeNull();
  });

  it('interrupted download keeps the old pack active and usable', async () => {
    const shared = { caches: new FakeCaches(), kv: new FakeKv() };
    await installPack('mr', BASE, deps(server(await pack('v1', [{ id: 'x1', file: 'mr/00000000aaaaaaaa.mp3', body: A }])), shared));
    const p2 = await pack('v2', [
      { id: 'x1', file: 'mr/00000000bbbbbbbb.mp3', body: B },
      { id: 'x2', file: 'mr/00000000cccccccc.mp3', body: A },
    ]);
    const r = await installPack('mr', BASE, deps(server(p2, { throwOn: 'cccccccc.mp3' }), shared));
    expect(r).toMatchObject({ ok: false, error: 'download_failed' });
    expect([...shared.caches.stores.keys()]).toEqual([cacheNameFor('mr', 'v1')]);
    const d = deps(server(p2), shared);
    expect((await activePack('mr', d))?.packVersion).toBe('v1');
    expect(new Uint8Array(await (await clipBlobFor('mr', 'x1', d))!.arrayBuffer())).toEqual(A);
  });

  it('insufficient storage refuses before downloading any clip', async () => {
    const p = await pack('v1', [{ id: 'x1', file: 'mr/00000000aaaaaaaa.mp3', body: A }]);
    const d = deps(server(p), undefined, 500_000); // below the 1 MB margin
    const r = await installPack('mr', BASE, d);
    expect(r).toMatchObject({ ok: false, error: 'insufficient_storage' });
    expect(d.fetch).toHaveBeenCalledTimes(1); // manifest only
    expect(d.caches.stores.size).toBe(0);
    expect(await activePack('mr', d)).toBeNull();
  });

  it('rejects an invalid manifest', async () => {
    const p = await pack('v1', [{ id: 'x1', file: 'mr/00000000aaaaaaaa.mp3', body: A }]);
    p.manifest.lang = 'kn';
    p.manifest.clips[0].file = 'kn/00000000aaaaaaaa.mp3';
    const r = await installPack('mr', BASE, deps(server(p)));
    expect(r).toMatchObject({ ok: false, error: 'invalid_manifest' });
  });
});
