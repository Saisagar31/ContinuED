/**
 * Audio pack build CLI (task 10; --sample is the task 05 measurement).
 *
 *   npx tsx scripts/audio/build.ts --dry-run --include-unapproved --lang en
 *   npx tsx scripts/audio/build.ts --sample --lang mr,kn [--sample-file samples.json]
 *   npx tsx scripts/audio/build.ts --lang mr --budget 5000
 *
 * Reads ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID / ELEVENLABS_MODEL_ID from the
 * environment (or .env.local). Real requests happen only when the key is set.
 * Optional: ELEVENLABS_CREDITS_PER_CHAR (estimate, default 1), ELEVENLABS_OUTPUT_FORMAT.
 */
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { LANGS, type LangCode } from '../../shared/domain';
import { DEFAULT_VOICE_SETTINGS, sampleSkillStrings } from './catalog';
import { runBuild, type BuildMode } from './pipeline';

try {
  process.loadEnvFile('.env.local');
} catch {
  // no .env.local — use the real environment only
}

const { values } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    sample: { type: 'boolean', default: false },
    lang: { type: 'string' },
    budget: { type: 'string' },
    out: { type: 'string', default: 'audio-out' },
    'include-unapproved': { type: 'boolean', default: false },
    'sample-file': { type: 'string' },
  },
});

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

const langs = (values.lang ? values.lang.split(',').map((s) => s.trim()) : [...LANGS]) as LangCode[];
for (const l of langs) if (!(LANGS as readonly string[]).includes(l)) fail(`Unknown language: ${l} (expected one of ${LANGS.join(',')})`);
if (values['dry-run'] && values.sample) fail('Choose either --dry-run or --sample');
const mode: BuildMode = values['dry-run'] ? 'dry-run' : values.sample ? 'sample' : 'full';

const budget = values.budget === undefined ? undefined : Number(values.budget);
if (budget !== undefined && !(budget >= 0)) fail('--budget must be a non-negative number of credits');
const creditsPerChar = Number(process.env.ELEVENLABS_CREDITS_PER_CHAR || '1');
if (!(creditsPerChar > 0)) fail('ELEVENLABS_CREDITS_PER_CHAR must be a positive number');

const apiKey = process.env.ELEVENLABS_API_KEY || undefined;
const voiceId = process.env.ELEVENLABS_VOICE_ID || '';
const modelId = process.env.ELEVENLABS_MODEL_ID || '';
if (mode !== 'dry-run' && (!apiKey || !voiceId || !modelId)) {
  fail('Real generation needs ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID and ELEVENLABS_MODEL_ID (see .env.example). Use --dry-run to count without them.');
}

let sampleTexts: Partial<Record<LangCode, string>> | undefined;
if (values['sample-file']) {
  try {
    sampleTexts = JSON.parse(await readFile(values['sample-file'], 'utf8'));
  } catch (err) {
    fail(`Could not read --sample-file: ${(err as Error).message}`);
  }
}

const { contentVersion, strings } = sampleSkillStrings();
const result = await runBuild(
  strings,
  {
    mode,
    langs,
    outDir: values.out!,
    includeUnapproved: values['include-unapproved']!,
    budget,
    creditsPerChar,
    apiKey,
    // Dedupe keys depend on voice/model; dry runs without env use placeholders.
    voice: { voiceId: voiceId || 'unset-voice', modelId: modelId || 'unset-model', settings: DEFAULT_VOICE_SETTINGS },
    outputFormat: process.env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_64',
    apiBase: 'https://api.elevenlabs.io',
    contentVersion,
    maxRetries: 4,
    baseDelayMs: 1000,
    maxDelayMs: 30_000,
    sampleTexts,
  },
  { fetch, sleep: (ms) => new Promise((r) => setTimeout(r, ms)), now: () => new Date(), log: (m) => console.log(m) },
);

console.log(`Mode: ${mode}${values['include-unapproved'] ? ' (including UNAPPROVED text; clips stay unreviewed)' : ''}`);
console.log(`Content version: ${contentVersion}; estimate ${creditsPerChar} credit(s)/character`);
console.table(result.summary);
if (mode !== 'dry-run') {
  console.log(`Generated ${result.generated}, resumed/skipped ${result.skipped}, failed ${result.failed}, credits used ~${result.creditsUsed}`);
  if (result.stopped) console.log(`Stopped early (${result.stopped}): ${result.stopDetail}`);
  for (const m of result.manifests) console.log(`Manifest: ${m}`);
  if (result.sample) console.log(`Sample report: ${values.out}/sample-report.json`);
}
if (result.stopped === 'auth' || result.failed > 0) process.exitCode = 1;
