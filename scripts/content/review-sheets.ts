/**
 * Writes one review sheet per language to docs/review/<lang>.csv (task 09).
 *
 *   npm run content:review-sheets
 *
 * Each row is one string a native-speaker reviewer must check, next to the
 * English master. Sample questions are rendered exactly as the app shows them.
 * The reviewer fills in the last three columns; Ramith applies the approved
 * corrections to src/content/packs/<lang>.ts. Open the CSV in Google Sheets or
 * Excel (it is UTF-8 with a byte-order mark so native scripts display).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LANGS, type LangCode } from '../../shared/domain';
import { PACKS, en, type SkillId } from '../../src/content/packs';
import { BANDS } from '../../src/content/rubric';
import { FAMILIES, buildItem } from '../../src/content/questions';
import { CONTENT_VERSION } from '../../src/content/skills';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = join(root, 'docs', 'review');

const HEADER = ['section', 'key', 'english', 'draft', 'ok (Y/N)', 'correction', 'reviewer note'];
const csv = (cells: string[]) => cells.map((c) => `"${c.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`).join(',');

function rows(lang: LangCode): string[][] {
  const p = PACKS[lang];
  const out: string[][] = [];
  const add = (section: string, key: string, english: string, draft: string) => out.push([section, key, english, draft, '', '', '']);

  for (const k of Object.keys(en.ui) as (keyof typeof en.ui)[]) add('interface', k, en.ui[k], p.ui[k]);

  for (const id of Object.keys(en.skills) as SkillId[]) {
    const e = en.skills[id];
    const d = p.skills[id];
    add('skill', `${id}.name`, e.name, d.name);
    add('skill', `${id}.group`, e.group, d.group);
    add('skill', `${id}.oral`, e.oral, d.oral);
    add('rubric', `${id}.mastered`, e.rubric.mastered, d.rubric.mastered);
    add('rubric', `${id}.developing`, e.rubric.developing, d.rubric.developing);
    add('rubric', `${id}.not_yet`, e.rubric.not_yet, d.rubric.not_yet);
    e.activities.forEach((a, i) => {
      add('activity', `${id}.activity${i + 1}.title`, a.title, d.activities[i].title);
      add('activity', `${id}.activity${i + 1}.steps`, a.steps, d.activities[i].steps);
    });
  }

  for (const k of Object.keys(en.q) as (keyof typeof en.q)[]) add('question template', k, en.q[k], p.q[k]);

  // Literacy stimuli are authored per language, so there is no English equivalent to compare.
  p.lit.sounds.forEach((band, b) => band.forEach((s, i) => add('stimulus: first sound', `band${b + 1}.${i + 1}`, '(authored in this language)', `${s.w} → ${s.s}`)));
  p.lit.words.forEach((band, b) => band.forEach((w, i) => add('stimulus: word', `band${b + 1}.${i + 1}`, '(authored in this language)', w)));
  p.lit.sentences.forEach((band, b) =>
    band.forEach((s, i) => add('stimulus: sentence', `band${b + 1}.${i + 1}`, '(authored in this language)', `${s.text} | Q: ${s.q} | A: ${s.a}`)),
  );

  // One rendered example per question family and band, exactly as the app shows it.
  for (const f of FAMILIES) {
    for (const band of BANDS) {
      if (!f.bands.includes(band)) continue;
      const keys = f.keys(band, lang);
      const key = keys[Math.floor(keys.length / 2)];
      const shown = buildItem(f.id, key, band, lang);
      const enKeys = f.keys(band, 'en');
      const enKey = f.skillId.startsWith('num.') ? key : enKeys[Math.floor(enKeys.length / 2)];
      const eng = buildItem(f.id, enKey, band, 'en');
      const render = (x: typeof shown) => `${x.prompt}${x.stimulus ? ` [shows: ${x.stimulus}]` : ''} → ${x.expected} (audio: ${x.audio})`;
      add('sample question', `${f.id}@band${band}`, render(eng), render(shown));
    }
  }
  return out;
}

mkdirSync(outDir, { recursive: true });
for (const lang of LANGS) {
  if (lang === 'en') continue;
  const body = [csv(HEADER), ...rows(lang).map(csv)].join('\r\n');
  const file = join(outDir, `${lang}.csv`);
  writeFileSync(file, '﻿' + body + '\r\n', 'utf8');
  console.log(`${file}: ${rows(lang).length} rows (content ${CONTENT_VERSION}, pack ${PACKS[lang].reviewStatus})`);
}
