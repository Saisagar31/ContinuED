/**
 * Offline audio pack manager (task 10, browser).
 *
 * Install = fetch manifest -> validate -> check storage -> download every clip
 * into a NEW versioned cache -> verify each SHA-256 -> switch the active pointer
 * -> delete the old cache. Any failure before the switch deletes the new cache
 * and leaves the previous pack active, so an interrupted update never breaks
 * playback. Functions return results; they do not throw to the UI.
 */
import type { AudioClip, AudioManifest } from '../../shared/contracts';
import { checkAudioManifest } from '../../shared/guards';
import type { LangCode } from '../domain/types';

/** The parts of the Cache API we use (lets tests pass an in-memory fake). */
export interface CacheLike {
  put(url: string, res: Response): Promise<void>;
  match(url: string): Promise<Response | undefined>;
}
export interface CachesLike {
  open(name: string): Promise<CacheLike>;
  delete(name: string): Promise<boolean>;
}
export interface StorageLike {
  estimate?: () => Promise<{ quota?: number; usage?: number }>;
}
export interface KeyValueLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface PackDeps {
  fetch: typeof fetch;
  caches: CachesLike;
  storage?: StorageLike; // navigator.storage
  kv?: KeyValueLike; // localStorage
  subtle?: SubtleCrypto;
}

export type InstallError =
  | 'manifest_fetch_failed'
  | 'invalid_manifest'
  | 'insufficient_storage'
  | 'download_failed'
  | 'hash_mismatch'
  | 'activation_failed';

export type InstallResult =
  | { ok: true; packVersion: string; clips: number; alreadyActive: boolean }
  | { ok: false; error: InstallError; detail: string };

/** What the active pointer stores per language. */
interface ActivePointer {
  packVersion: string;
  cacheName: string;
  manifestUrl: string;
  baseUrl: string;
}

/** Extra space required beyond the pack size: 10% plus 1 MB. */
export const STORAGE_MARGIN = (bytes: number) => Math.ceil(bytes * 0.1) + 1_000_000;

export const cacheNameFor = (lang: LangCode, packVersion: string) => `continued-audio-${lang}-${packVersion}`;
const pointerKey = (lang: LangCode) => `continued-audio-active-${lang}`;
const trimSlash = (s: string) => s.replace(/\/+$/, '');

export function defaultPackDeps(): PackDeps {
  let kv: KeyValueLike | undefined;
  try {
    kv = globalThis.localStorage;
  } catch {
    kv = undefined; // storage blocked (private mode, policy)
  }
  return { fetch: globalThis.fetch.bind(globalThis), caches: globalThis.caches, storage: globalThis.navigator?.storage, kv, subtle: globalThis.crypto?.subtle };
}

function readPointer(lang: LangCode, kv?: KeyValueLike): ActivePointer | null {
  try {
    const raw = kv?.getItem(pointerKey(lang));
    return raw ? (JSON.parse(raw) as ActivePointer) : null;
  } catch {
    return null;
  }
}

async function sha256Hex(buf: ArrayBuffer, subtle: SubtleCrypto): Promise<string> {
  const d = new Uint8Array(await subtle.digest('SHA-256', buf));
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function installPack(lang: LangCode, baseUrl: string, deps: PackDeps = defaultPackDeps()): Promise<InstallResult> {
  const base = trimSlash(baseUrl);
  const manifestUrl = `${base}/${lang}/manifest.json`;
  const subtle = deps.subtle ?? globalThis.crypto?.subtle;
  if (!subtle || !deps.caches) return { ok: false, error: 'activation_failed', detail: 'This browser lacks Cache API or Web Crypto' };

  // 1. Manifest
  let manifest: AudioManifest;
  let manifestText: string;
  try {
    const res = await deps.fetch(manifestUrl, { cache: 'no-store' });
    if (!res.ok) return { ok: false, error: 'manifest_fetch_failed', detail: `HTTP ${res.status}` };
    manifestText = await res.text();
    manifest = JSON.parse(manifestText) as AudioManifest;
  } catch (err) {
    return { ok: false, error: 'manifest_fetch_failed', detail: String((err as Error)?.message ?? err) };
  }
  const bad = checkAudioManifest(manifest) ?? (manifest.lang !== lang ? 'manifest.lang does not match requested language' : null) ?? manifest.clips.map((c) => (c.file.startsWith(`${lang}/`) ? null : `clip file ${c.file} outside ${lang}/`)).find(Boolean) ?? null;
  if (bad) return { ok: false, error: 'invalid_manifest', detail: bad };

  const prev = readPointer(lang, deps.kv);
  if (prev && prev.packVersion === manifest.packVersion) return { ok: true, packVersion: manifest.packVersion, clips: manifest.clips.length, alreadyActive: true };

  // Several content IDs can share one file; download each file once.
  const files = new Map<string, AudioClip>();
  for (const c of manifest.clips) if (!files.has(c.file)) files.set(c.file, c);
  const total = [...files.values()].reduce((n, c) => n + c.bytes, 0);

  // 2. Storage check, before any download
  try {
    const est = await deps.storage?.estimate?.();
    if (est && typeof est.quota === 'number') {
      const free = est.quota - (est.usage ?? 0);
      const need = total + STORAGE_MARGIN(total);
      if (free < need) return { ok: false, error: 'insufficient_storage', detail: `need ~${need} bytes, ${free} free` };
    }
    // No estimate available: proceed; a full disk will surface as download_failed.
  } catch {
    // estimate() failing is not a reason to refuse
  }

  // 3. Download + verify into a fresh cache
  const cacheName = cacheNameFor(lang, manifest.packVersion);
  const abort = async (error: InstallError, detail: string): Promise<InstallResult> => {
    await deps.caches.delete(cacheName).catch(() => false);
    return { ok: false, error, detail };
  };
  try {
    await deps.caches.delete(cacheName); // leftovers of an earlier interrupted attempt
    const cache = await deps.caches.open(cacheName);
    for (const clip of files.values()) {
      const url = `${base}/${clip.file}`;
      let buf: ArrayBuffer;
      try {
        const res = await deps.fetch(url);
        if (!res.ok) return await abort('download_failed', `${clip.file}: HTTP ${res.status}`);
        buf = await res.arrayBuffer();
      } catch (err) {
        return await abort('download_failed', `${clip.file}: ${String((err as Error)?.message ?? err)}`);
      }
      if (buf.byteLength !== clip.bytes || (await sha256Hex(buf, subtle)) !== clip.sha256) {
        return await abort('hash_mismatch', `${clip.file} does not match the manifest`);
      }
      await cache.put(url, new Response(buf, { headers: { 'content-type': 'audio/mpeg' } }));
    }
    await cache.put(manifestUrl, new Response(manifestText, { headers: { 'content-type': 'application/json' } }));
  } catch (err) {
    return await abort('download_failed', String((err as Error)?.message ?? err));
  }

  // 4. Switch pointer only after every clip verified
  const next: ActivePointer = { packVersion: manifest.packVersion, cacheName, manifestUrl, baseUrl: base };
  try {
    if (!deps.kv) throw new Error('no local storage');
    deps.kv.setItem(pointerKey(lang), JSON.stringify(next));
  } catch (err) {
    return await abort('activation_failed', String((err as Error)?.message ?? err));
  }

  // 5. Remove the previous pack
  if (prev && prev.cacheName !== cacheName) await deps.caches.delete(prev.cacheName).catch(() => false);
  return { ok: true, packVersion: manifest.packVersion, clips: manifest.clips.length, alreadyActive: false };
}

/** The active pack's manifest for a language, or null when none is installed. */
export async function activePack(lang: LangCode, deps: PackDeps = defaultPackDeps()): Promise<AudioManifest | null> {
  try {
    const p = readPointer(lang, deps.kv);
    if (!p) return null;
    const res = await (await deps.caches.open(p.cacheName)).match(p.manifestUrl);
    if (!res) return null;
    const m = (await res.json()) as AudioManifest;
    return checkAudioManifest(m) ? null : m;
  } catch {
    return null;
  }
}

/**
 * Cache URL of the clip for contentId in the active pack. Only clips a human has
 * approved are returned; unreviewed or rejected clips are treated as missing.
 */
export async function clipUrlFor(lang: LangCode, contentId: string, deps: PackDeps = defaultPackDeps()): Promise<string | null> {
  const p = readPointer(lang, deps.kv);
  const m = await activePack(lang, deps);
  const clip = m?.clips.find((c) => c.contentId === contentId && c.reviewStatus === 'approved');
  return p && clip ? `${p.baseUrl}/${clip.file}` : null;
}

/** The clip's audio bytes from the active pack's cache, or null. */
export async function clipBlobFor(lang: LangCode, contentId: string, deps: PackDeps = defaultPackDeps()): Promise<Blob | null> {
  try {
    const url = await clipUrlFor(lang, contentId, deps);
    const p = readPointer(lang, deps.kv);
    if (!url || !p) return null;
    const res = await (await deps.caches.open(p.cacheName)).match(url);
    return res ? await res.blob() : null;
  } catch {
    return null;
  }
}
