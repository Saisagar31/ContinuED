import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkAudioManifest } from '../../shared/guards';
import type { AudioManifest } from '../../shared/contracts';
import { buildCatalog, dedupeKey, DEFAULT_VOICE_SETTINGS, sampleSkillStrings, type SpokenString, type VoiceConfig } from './catalog';
import { readLedger, runBuild, type BuildDeps, type BuildOptions } from './pipeline';
import { recordReview } from './review';

const voice: VoiceConfig = { voiceId: 'voice1', modelId: 'eleven_v3', settings: DEFAULT_VOICE_SETTINGS };
const s = (contentId: string, text: string, approved = true, lang: SpokenString['lang'] = 'mr'): SpokenString => ({ contentId, lang, text, approved, kind: 'instruction' });

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'audio-test-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function opts(over: Partial<BuildOptions> = {}): BuildOptions {
  return {
    mode: 'full',
    langs: ['mr'],
    outDir: dir,
    includeUnapproved: false,
    creditsPerChar: 1,
    apiKey: 'test-key',
    voice,
    outputFormat: 'mp3_44100_64',
    apiBase: 'https://api.test',
    contentVersion: 'sample-0.1',
    maxRetries: 3,
    baseDelayMs: 1,
    maxDelayMs: 4,
    ...over,
  };
}

const audio = (n = 100) => new Response(new Uint8Array(n).fill(7), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
function deps(fetchImpl: (...a: unknown[]) => Promise<Response>): BuildDeps & { fetch: ReturnType<typeof vi.fn> } {
  return { fetch: vi.fn(fetchImpl) as never, sleep: async () => {}, now: () => new Date('2026-11-26T10:00:00Z'), log: () => {} };
}

describe('catalog', () => {
  it('dedupes identical text into one clip with both content IDs', () => {
    const c = buildCatalog([s('a1', 'Say the number.'), s('a2', 'Say the number.')], voice);
    expect(c).toHaveLength(1);
    expect(c[0].contentIds).toEqual(['a1', 'a2']);
  });
  it('different voice, model or settings give a different key', () => {
    const k = dedupeKey('Hi', 'mr', voice);
    expect(dedupeKey('Hi', 'mr', { ...voice, voiceId: 'voice2' })).not.toBe(k);
    expect(dedupeKey('Hi', 'mr', { ...voice, modelId: 'other' })).not.toBe(k);
    expect(dedupeKey('Hi', 'mr', { ...voice, settings: { ...voice.settings, speed: 0.9 } })).not.toBe(k);
    expect(dedupeKey('Hi', 'kn', voice)).not.toBe(k);
  });
  it('drops unapproved strings unless asked', () => {
    expect(buildCatalog([s('a1', 'x', false)], voice)).toHaveLength(0);
    const c = buildCatalog([s('a1', 'x', false)], voice, { includeUnapproved: true });
    expect(c).toHaveLength(1);
    expect(c[0].approved).toBe(false);
  });
  it('sample skills are English, unapproved, content-only', () => {
    const { strings } = sampleSkillStrings();
    expect(strings.length).toBeGreaterThan(0);
    expect(strings.every((x) => x.lang === 'en' && !x.approved)).toBe(true);
  });
});

describe('runBuild', () => {
  it('dry run counts clips, characters and credits without fetching', async () => {
    const d = deps(async () => audio());
    const r = await runBuild([s('a1', 'abcd'), s('a2', 'abcd'), s('a3', 'xy')], opts({ mode: 'dry-run', creditsPerChar: 0.5, apiKey: undefined }), d);
    expect(d.fetch).not.toHaveBeenCalled();
    expect(r.summary).toEqual([{ lang: 'mr', contentIds: 3, uniqueClips: 2, characters: 6, estimatedCredits: 3 }]);
  });

  it('stops before a request that would exceed the budget', async () => {
    const d = deps(async () => audio());
    const r = await runBuild([s('a1', '12345'), s('a2', '67890')], opts({ budget: 7 }), d);
    expect(d.fetch).toHaveBeenCalledTimes(1);
    expect(r.generated).toBe(1);
    expect(r.stopped).toBe('budget');
  });

  it('retries 429 then succeeds; sends documented endpoint and header', async () => {
    let n = 0;
    const d = deps(async () => (n++ === 0 ? new Response('slow down', { status: 429 }) : audio()));
    const r = await runBuild([s('a1', 'hello')], opts(), d);
    expect(r.generated).toBe(1);
    expect(d.fetch).toHaveBeenCalledTimes(2);
    const [url, init] = d.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.test/v1/text-to-speech/voice1?output_format=mp3_44100_64');
    expect((init.headers as Record<string, string>)['xi-api-key']).toBe('test-key');
    expect(JSON.parse(init.body as string)).toMatchObject({ text: 'hello', model_id: 'eleven_v3', language_code: 'mr' });
    const ledger = await readLedger(dir);
    expect(ledger.map((e) => e.status)).toEqual(['retryable_error', 'success']);
  });

  it('gives up after bounded retries on 5xx', async () => {
    const d = deps(async () => new Response('', { status: 503 }));
    const r = await runBuild([s('a1', 'hello')], opts({ maxRetries: 2 }), d);
    expect(d.fetch).toHaveBeenCalledTimes(3);
    expect(r.failed).toBe(1);
  });

  it('401 stops the whole run', async () => {
    const d = deps(async () => new Response('bad key', { status: 401 }));
    const r = await runBuild([s('a1', 'one'), s('a2', 'two')], opts(), d);
    expect(d.fetch).toHaveBeenCalledTimes(1);
    expect(r.stopped).toBe('auth');
  });

  it('resumes: clips already in the ledger with a file are skipped', async () => {
    const strings = [s('a1', 'one'), s('a2', 'two')];
    await runBuild(strings, opts(), deps(async () => audio()));
    const d2 = deps(async () => audio());
    const r = await runBuild([...strings, s('a3', 'three')], opts(), d2);
    expect(d2.fetch).toHaveBeenCalledTimes(1);
    expect(r.skipped).toBe(2);
    expect(r.generated).toBe(1);
  });

  it('writes MP3s and a manifest that passes checkAudioManifest', async () => {
    const r = await runBuild([s('a1', 'one'), s('a2', 'one'), s('a3', 'two')], opts(), deps(async () => audio(321)));
    expect(r.manifests).toHaveLength(1);
    const m = JSON.parse(await readFile(join(dir, 'mr', 'manifest.json'), 'utf8')) as AudioManifest;
    expect(checkAudioManifest(m)).toBeNull();
    expect(m.clips).toHaveLength(3);
    expect(m.clips.every((c) => c.reviewStatus === 'unreviewed' && c.bytes === 321)).toBe(true);
    expect(m.clips[0].file).toBe(m.clips[1].file);
    expect((await stat(join(dir, m.clips[0].file))).size).toBe(321);
  });

  it('review marks a clip approved, and survives a rebuild', async () => {
    await runBuild([s('a1', 'one')], opts(), deps(async () => audio()));
    const m = await recordReview(dir, 'mr', ['a1'], 'approved');
    expect(m.clips[0].reviewStatus).toBe('approved');
    await runBuild([s('a1', 'one')], opts(), deps(async () => audio()));
    const again = JSON.parse(await readFile(join(dir, 'mr', 'manifest.json'), 'utf8')) as AudioManifest;
    expect(again.clips[0].reviewStatus).toBe('approved');
  });

  it('sample mode records bytes, characters and reported credits per language', async () => {
    const d = deps(async () => new Response(new Uint8Array(50), { status: 200, headers: { 'character-cost': '9' } }));
    const r = await runBuild([s('a1', 'नमस्कार')], opts({ mode: 'sample', langs: ['mr', 'kn'], sampleTexts: { kn: 'ನಮಸ್ಕಾರ' } }), d);
    const report = JSON.parse(await readFile(join(dir, 'sample-report.json'), 'utf8'));
    expect(report.entries).toHaveLength(2);
    expect(r.sample!.map((e) => [e.lang, e.bytes, e.creditsReported])).toEqual([
      ['mr', 50, 9],
      ['kn', 50, 9],
    ]);
    expect(r.manifests).toHaveLength(0);
  });

  it('refuses real modes without an API key', async () => {
    await expect(runBuild([s('a1', 'x')], opts({ apiKey: undefined }), deps(async () => audio()))).rejects.toThrow(/ELEVENLABS_API_KEY/);
  });
});
