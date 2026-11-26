/**
 * Record a human listening verdict for clips in a built pack (task 10).
 *
 *   npx tsx scripts/audio/review.ts --lang mr --approve a.nr.1,a.nr.2
 *   npx tsx scripts/audio/review.ts --lang mr --reject a.pv.1
 *
 * Verdicts are stored in <out>/review.json against the clip's text hash, so a
 * later text change automatically puts the clip back to 'unreviewed'.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import type { AudioManifest } from '../../shared/contracts';
import { LANGS, type LangCode } from '../../shared/domain';
import { checkAudioManifest } from '../../shared/guards';
import { applyReview, readReview, type ReviewFile } from './pipeline';

export async function recordReview(outDir: string, lang: LangCode, ids: string[], status: 'approved' | 'rejected', now = new Date()): Promise<AudioManifest> {
  const path = join(outDir, lang, 'manifest.json');
  const manifest = JSON.parse(await readFile(path, 'utf8')) as AudioManifest;
  const review: ReviewFile = await readReview(outDir);
  const forLang = (review[lang] ??= {});
  for (const id of ids) {
    const clip = manifest.clips.find((c) => c.contentId === id);
    if (!clip) throw new Error(`No clip for contentId ${id} in ${path}`);
    forLang[id] = { status, textSha256: clip.textSha256, at: now.toISOString() };
  }
  const updated = applyReview(manifest, review);
  const err = checkAudioManifest(updated);
  if (err) throw new Error(`Manifest invalid after review: ${err}`);
  await writeFile(join(outDir, 'review.json'), JSON.stringify(review, null, 2) + '\n', 'utf8');
  await writeFile(path, JSON.stringify(updated, null, 2) + '\n', 'utf8');
  return updated;
}

// CLI entry (skipped when imported by tests).
if (process.argv[1] && /review\.ts$/.test(process.argv[1])) {
  const { values } = parseArgs({ options: { lang: { type: 'string' }, approve: { type: 'string' }, reject: { type: 'string' }, out: { type: 'string', default: 'audio-out' } } });
  const lang = values.lang as LangCode;
  if (!(LANGS as readonly string[]).includes(lang)) throw new Error('--lang is required (one language)');
  if (!values.approve === !values.reject) throw new Error('Pass exactly one of --approve or --reject');
  const ids = (values.approve ?? values.reject)!.split(',').map((s) => s.trim()).filter(Boolean);
  const m = await recordReview(values.out!, lang, ids, values.approve ? 'approved' : 'rejected');
  console.log(`${lang}: ${m.clips.filter((c) => c.reviewStatus === 'approved').length} approved / ${m.clips.length} clips`);
}
