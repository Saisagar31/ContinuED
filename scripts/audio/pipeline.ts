/**
 * Audio build pipeline (task 10 + task 05 sample measurement).
 *
 * Provider facts used here come from the ElevenLabs docs, text-to-speech/convert page:
 *   POST {apiBase}/v1/text-to-speech/{voice_id}?output_format=mp3_...
 *   header xi-api-key, JSON body { text, model_id, language_code?, voice_settings? }
 * The 'character-cost' response header is NOT documented on that page; we read it
 * if present and otherwise fall back to an estimate (see creditsPerChar).
 *
 * All network access goes through deps.fetch so tests can mock it.
 */
import { appendFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AudioClip, AudioManifest } from '../../shared/contracts';
import type { LangCode } from '../../shared/domain';
import { buildCatalog, sha256Hex, type CatalogClip, type SpokenString, type VoiceConfig } from './catalog';

export type BuildMode = 'dry-run' | 'sample' | 'full';

export interface BuildOptions {
  mode: BuildMode;
  langs: LangCode[];
  outDir: string;
  includeUnapproved: boolean;
  /** Stop before any request that would push credits used above this. */
  budget?: number;
  /** Estimate used for dry runs and budget checks when the provider reports no cost. */
  creditsPerChar: number;
  apiKey?: string;
  voice: VoiceConfig;
  outputFormat: string; // e.g. 'mp3_44100_64' (allowed values listed on the convert page)
  apiBase: string; // e.g. 'https://api.elevenlabs.io'
  contentVersion: string;
  maxRetries: number; // retries after the first attempt, for 429 / 5xx / network errors
  baseDelayMs: number;
  maxDelayMs: number;
  /** --sample only: reviewer-supplied sample text per language, used when the catalog has none. */
  sampleTexts?: Partial<Record<LangCode, string>>;
}

export interface BuildDeps {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => Date;
  log: (msg: string) => void;
}

export interface LangSummary {
  lang: LangCode;
  contentIds: number; // spoken strings that map to a clip
  uniqueClips: number; // recordings after dedupe
  characters: number;
  estimatedCredits: number;
}

export interface LedgerEntry {
  time: string;
  dedupeKey: string;
  contentId: string;
  lang: LangCode;
  status: 'success' | 'retryable_error' | 'failed' | 'fatal';
  httpStatus: number | null;
  bytes: number | null;
  credits: number | null; // as reported by the provider, if it reported anything
  error: string | null;
}

export interface SampleEntry {
  lang: LangCode;
  contentId: string | null;
  characters: number | null;
  bytes: number | null;
  creditsReported: number | null;
  creditsEstimated: number | null;
  httpStatus: number | null;
  file: string | null;
  error: string | null;
}

export interface BuildResult {
  mode: BuildMode;
  summary: LangSummary[];
  generated: number;
  skipped: number; // already done in an earlier run (resume)
  failed: number;
  creditsUsed: number; // reported where available, else estimated
  stopped: 'budget' | 'auth' | null;
  stopDetail: string | null;
  manifests: string[];
  sample?: SampleEntry[];
}

/** Characters as code points. How the provider counts Indic scripts is UNVERIFIED. */
export const charCount = (text: string): number => [...text].length;

export const clipFile = (clip: { lang: LangCode; dedupeKey: string }): string => `${clip.lang}/${clip.dedupeKey.slice(0, 16)}.mp3`;

export function summarise(catalog: CatalogClip[], langs: LangCode[], creditsPerChar: number): LangSummary[] {
  return langs.map((lang) => {
    const clips = catalog.filter((c) => c.lang === lang);
    const characters = clips.reduce((n, c) => n + charCount(c.text), 0);
    return {
      lang,
      contentIds: clips.reduce((n, c) => n + c.contentIds.length, 0),
      uniqueClips: clips.length,
      characters,
      estimatedCredits: Math.ceil(characters * creditsPerChar),
    };
  });
}

// ---------------------------------------------------------------------------
// Ledger (append-only JSONL; makes the job resumable)
// ---------------------------------------------------------------------------

export async function readLedger(outDir: string): Promise<LedgerEntry[]> {
  let raw: string;
  try {
    raw = await readFile(join(outDir, 'ledger.jsonl'), 'utf8');
  } catch {
    return [];
  }
  const entries: LedgerEntry[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line) as LedgerEntry);
    } catch {
      // a torn last line from a killed run is ignored
    }
  }
  return entries;
}

async function appendLedger(outDir: string, e: LedgerEntry): Promise<void> {
  await appendFile(join(outDir, 'ledger.jsonl'), JSON.stringify(e) + '\n', 'utf8');
}

const exists = (p: string) => stat(p).then(() => true, () => false);

// ---------------------------------------------------------------------------
// Provider request with bounded retries
// ---------------------------------------------------------------------------

type RequestOutcome =
  | { ok: true; bytes: Uint8Array; credits: number | null; httpStatus: number }
  | { ok: false; fatal: boolean; httpStatus: number | null; error: string };

async function requestClip(clip: CatalogClip, opts: BuildOptions, deps: BuildDeps): Promise<RequestOutcome> {
  const url = `${opts.apiBase}/v1/text-to-speech/${encodeURIComponent(opts.voice.voiceId)}?output_format=${encodeURIComponent(opts.outputFormat)}`;
  const body: Record<string, unknown> = { text: clip.text, model_id: opts.voice.modelId, voice_settings: opts.voice.settings };
  // The docs say language_code is not supported for multilingual_v2 models.
  if (!opts.voice.modelId.includes('multilingual_v2')) body.language_code = clip.lang;

  const base = { dedupeKey: clip.dedupeKey, contentId: clip.contentIds[0], lang: clip.lang };
  let last: RequestOutcome = { ok: false, fatal: false, httpStatus: null, error: 'not attempted' };

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    if (attempt > 0) await deps.sleep(Math.min(opts.maxDelayMs, opts.baseDelayMs * 2 ** (attempt - 1)));
    const time = deps.now().toISOString();
    let res: Response;
    try {
      res = await deps.fetch(url, {
        method: 'POST',
        headers: { 'xi-api-key': opts.apiKey ?? '', 'content-type': 'application/json', accept: 'audio/mpeg' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      const error = `network: ${(err as Error).message}`;
      await appendLedger(opts.outDir, { ...base, time, status: 'retryable_error', httpStatus: null, bytes: null, credits: null, error });
      last = { ok: false, fatal: false, httpStatus: null, error };
      continue;
    }

    if (res.ok) {
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length === 0) {
        const error = 'empty audio body';
        await appendLedger(opts.outDir, { ...base, time, status: 'failed', httpStatus: res.status, bytes: 0, credits: null, error });
        return { ok: false, fatal: false, httpStatus: res.status, error };
      }
      const h = res.headers.get('character-cost'); // UNVERIFIED header name
      const credits = h !== null && Number.isFinite(Number(h)) ? Number(h) : null;
      await appendLedger(opts.outDir, { ...base, time, status: 'success', httpStatus: res.status, bytes: bytes.length, credits, error: null });
      return { ok: true, bytes, credits, httpStatus: res.status };
    }

    const detail = (await res.text().catch(() => '')).slice(0, 300);
    const error = `HTTP ${res.status}${detail ? `: ${detail}` : ''}`;
    if (res.status === 401 || res.status === 402 || res.status === 403) {
      await appendLedger(opts.outDir, { ...base, time, status: 'fatal', httpStatus: res.status, bytes: null, credits: null, error });
      return { ok: false, fatal: true, httpStatus: res.status, error };
    }
    if (res.status === 429 || res.status >= 500) {
      await appendLedger(opts.outDir, { ...base, time, status: 'retryable_error', httpStatus: res.status, bytes: null, credits: null, error });
      last = { ok: false, fatal: false, httpStatus: res.status, error };
      continue;
    }
    // Other 4xx (e.g. 400/422 validation) will not succeed on retry.
    await appendLedger(opts.outDir, { ...base, time, status: 'failed', httpStatus: res.status, bytes: null, credits: null, error });
    return { ok: false, fatal: false, httpStatus: res.status, error };
  }
  return last;
}

// ---------------------------------------------------------------------------
// Review state and manifests
// ---------------------------------------------------------------------------

/** review.json: per language, per contentId. Only applies while the text hash still matches. */
export type ReviewFile = Partial<Record<LangCode, Record<string, { status: 'approved' | 'rejected'; textSha256: string; at: string }>>>;

export async function readReview(outDir: string): Promise<ReviewFile> {
  try {
    return JSON.parse(await readFile(join(outDir, 'review.json'), 'utf8')) as ReviewFile;
  } catch {
    return {};
  }
}

export function applyReview(manifest: AudioManifest, review: ReviewFile): AudioManifest {
  const r = review[manifest.lang] ?? {};
  return {
    ...manifest,
    clips: manifest.clips.map((c) => {
      const e = r[c.contentId];
      return { ...c, reviewStatus: e && e.textSha256 === c.textSha256 ? e.status : 'unreviewed' };
    }),
  };
}

async function writeManifest(lang: LangCode, clips: CatalogClip[], opts: BuildOptions, createdAt: Date, review: ReviewFile): Promise<string | null> {
  const entries: AudioClip[] = [];
  for (const c of clips) {
    const file = clipFile(c);
    let bytes: Buffer;
    try {
      bytes = await readFile(join(opts.outDir, file));
    } catch {
      continue; // not generated (yet) — the phone falls back to text/device speech
    }
    const sha256 = sha256Hex(bytes);
    for (const contentId of c.contentIds) entries.push({ contentId, textSha256: c.textSha256, file, sha256, bytes: bytes.length, reviewStatus: 'unreviewed' });
  }
  if (entries.length === 0) return null;
  const stamp = createdAt.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const manifest = applyReview(
    {
      packVersion: `${opts.contentVersion}.${stamp}`,
      contentVersion: opts.contentVersion,
      lang,
      voiceId: opts.voice.voiceId,
      modelId: opts.voice.modelId,
      createdAt: createdAt.toISOString(),
      clips: entries,
    },
    review,
  );
  const path = join(opts.outDir, lang, 'manifest.json');
  await writeFile(path, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return path;
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function runBuild(strings: SpokenString[], opts: BuildOptions, deps: BuildDeps): Promise<BuildResult> {
  const catalog = buildCatalog(strings, opts.voice, { includeUnapproved: opts.includeUnapproved, langs: opts.langs });
  const summary = summarise(catalog, opts.langs, opts.creditsPerChar);
  const result: BuildResult = { mode: opts.mode, summary, generated: 0, skipped: 0, failed: 0, creditsUsed: 0, stopped: null, stopDetail: null, manifests: [] };
  if (opts.mode === 'dry-run') return result; // no network, no files

  if (!opts.apiKey) throw new Error('ELEVENLABS_API_KEY is not set');

  // --sample: one clip per language (task 05 measurement).
  let work = catalog;
  const sample: SampleEntry[] = [];
  if (opts.mode === 'sample') {
    work = [];
    for (const lang of opts.langs) {
      const supplied = opts.sampleTexts?.[lang];
      const clip = supplied
        ? buildCatalog([{ contentId: `sample.${lang}`, lang, text: supplied, approved: true, kind: 'instruction' }], opts.voice)[0]
        : catalog.find((c) => c.lang === lang);
      if (clip) work.push(clip);
      else sample.push({ lang, contentId: null, characters: null, bytes: null, creditsReported: null, creditsEstimated: null, httpStatus: null, file: null, error: 'no approved text for this language' });
    }
  }

  await mkdir(opts.outDir, { recursive: true });
  const ledger = await readLedger(opts.outDir);
  const done = new Map<string, LedgerEntry>();
  for (const e of ledger) if (e.status === 'success') done.set(e.dedupeKey, e);

  for (const clip of work) {
    const file = clipFile(clip);
    const path = join(opts.outDir, file);
    const est = Math.ceil(charCount(clip.text) * opts.creditsPerChar);
    const prior = done.get(clip.dedupeKey);

    if (prior && (await exists(path))) {
      result.skipped++;
      if (opts.mode === 'sample') {
        sample.push({ lang: clip.lang, contentId: clip.contentIds[0], characters: charCount(clip.text), bytes: prior.bytes, creditsReported: prior.credits, creditsEstimated: est, httpStatus: prior.httpStatus, file, error: null });
      }
      continue;
    }

    if (opts.budget !== undefined && result.creditsUsed + est > opts.budget) {
      result.stopped = 'budget';
      result.stopDetail = `next clip needs ~${est} credits; ${result.creditsUsed} of ${opts.budget} used`;
      deps.log(`Budget stop: ${result.stopDetail}`);
      break;
    }

    const out = await requestClip(clip, opts, deps);
    if (out.ok) {
      await mkdir(join(opts.outDir, clip.lang), { recursive: true });
      await writeFile(path, out.bytes);
      result.generated++;
      result.creditsUsed += out.credits ?? est;
      if (opts.mode === 'sample') {
        sample.push({ lang: clip.lang, contentId: clip.contentIds[0], characters: charCount(clip.text), bytes: out.bytes.length, creditsReported: out.credits, creditsEstimated: est, httpStatus: out.httpStatus, file, error: null });
      }
      continue;
    }

    result.failed++;
    if (opts.mode === 'sample') {
      sample.push({ lang: clip.lang, contentId: clip.contentIds[0], characters: charCount(clip.text), bytes: null, creditsReported: null, creditsEstimated: est, httpStatus: out.httpStatus, file: null, error: out.error });
    }
    if (out.fatal) {
      result.stopped = 'auth';
      result.stopDetail = out.error;
      deps.log(`Stopping: provider refused the account (${out.error})`);
      break;
    }
    deps.log(`Failed ${clip.contentIds[0]}: ${out.error}`);
  }

  if (opts.mode === 'sample') {
    result.sample = sample;
    await writeFile(join(opts.outDir, 'sample-report.json'), JSON.stringify({ createdAt: deps.now().toISOString(), voiceId: opts.voice.voiceId, modelId: opts.voice.modelId, outputFormat: opts.outputFormat, entries: sample }, null, 2) + '\n', 'utf8');
    return result;
  }

  const review = await readReview(opts.outDir);
  const createdAt = deps.now();
  for (const lang of opts.langs) {
    const p = await writeManifest(lang, catalog.filter((c) => c.lang === lang), opts, createdAt, review);
    if (p) result.manifests.push(p);
  }
  return result;
}
