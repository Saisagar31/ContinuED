# Content and language review (tasks 04 and 09)

Owner: **Ramith**. This page says what content exists, what is still a draft, and exactly what each reviewer must check before a pack can be marked approved.

> **Status today: every language pack, the skill map, the rubric and all activities are DRAFTS.** No educator or native speaker has reviewed them yet. The app shows a "draft" banner for every non-English interface language until its pack is approved.

## Where the content lives

| What | File | Notes |
|---|---|---|
| Skill graph: IDs, prerequisites, common errors, activity IDs | `src/content/skills.ts` | Skill IDs travel inside transfer QR codes, so **never rename one**. `CONTENT_VERSION = draft-1.0`. |
| Rubric, adaptation and stopping rules, offline targets | `src/content/rubric.ts` | `RUBRIC_VERSION = draft-rubric-1`. Every number is an initial rule for educators to pilot. |
| Question families and generators | `src/content/questions.ts` | 20 families, at least 2 per skill at each band. |
| Language packs (UI, skill text, rubric text, activities, question templates, literacy stimuli) | `src/content/packs/<lang>.ts` | `en` is the master. Every other pack must have the same keys and `{placeholders}`. |
| Review sheets for native speakers | `docs/review/<lang>.csv` | Regenerate with `npm run content:review-sheets` after any pack change. |
| Automated checks | `src/content/content.test.ts` | Run in CI with `npm test`. |

## What the automated checks already prove (CI)

- All 7 packs have every interface key (222), all 8 skills, both activities, all three rubric descriptors and all 23 question templates. Every string is non-empty and keeps the English `{placeholders}`.
- Native script: every non-English string is in its own script. No stray Latin, apart from `ContinuED`, `QR`, `PIN`, `ID`, `CED` and `https`, and no characters from another Indian script.
- All **49 origin/interface language combinations** render every skill ID and status. Each one has an oral check in the origin language.
- Every numeracy variant (more than 1,000 checked) meets its constraint, such as no carrying or borrowing required. The expected answer is recomputed independently from what the learner sees.
- Equivalent questions share one repeat-protection ID (23 + 14 = 14 + 23). Numeracy IDs ignore the language, so a learner reassessed in a different language still gets unseen questions.
- Reading stimuli (words and sentences) are never in an audio clip.
- Each language's offline question pack passes the shared `ContentPack` contract (`checkContentPack`) and stays within the variant budget.

These checks cannot judge whether a word is natural, age-appropriate or correctly pronounced. That is the reviewers' job.

## Review status per language

| Language | Pack | Reviewer | Classroom wording | Native script on a phone | Oral-check pronunciation | Cross-language transfer check | Approved on |
|---|---|---|---|---|---|---|---|
| English (master) | draft (content not yet educator-approved) | — | ☐ | ☐ | ☐ | ☐ | — |
| Marathi `mr` | draft | _to assign_ | ☐ | ☐ | ☐ | ☐ | — |
| Kannada `kn` | draft | _to assign_ | ☐ | ☐ | ☐ | ☐ | — |
| Hindi `hi` | draft | _to assign_ | ☐ | ☐ | ☐ | ☐ | — |
| Telugu `te` | draft | _to assign_ | ☐ | ☐ | ☐ | ☐ | — |
| Tamil `ta` | draft | _to assign_ | ☐ | ☐ | ☐ | ☐ | — |
| Malayalam `ml` | draft | _to assign_ | ☐ | ☐ | ☐ | ☐ | — |

## How a native-speaker reviewer works

1. Open `docs/review/<lang>.csv` in Google Sheets or Excel. Each row is one string, with the English master beside the draft.
2. Mark **ok (Y/N)**. If N, write the **correction** and a short **reviewer note** saying why.
3. Pay special attention to:
   - **Classroom words.** Would a Class 1–3 teacher in a government school say this? Flag anything that reads as a formal or machine translation.
   - **Skill names.** Do they match the state textbook terms, for example the local words for "tens and ones", "carrying" and "borrowing"?
   - **Literacy stimuli.** Are the words familiar to a 6–8-year-old? Is band 2 really harder than band 1? Does each "first sound" answer match how teachers teach it?
   - **Number words with digits.** Templates such as "{t} tens and {o} ones" may need a different form for 1, as in "1 tens". Say how to phrase it.
   - **Respect and gender.** Rubric lines describe the learner. Check that the person and plural forms are natural.
4. Check the **sample question** rows. They show each question exactly as the app does: what the teacher says, what the learner sees (`[shows: …]`), the expected answer, and what may be voiced.
5. On a real phone, switch the interface to your language and walk through roster → assessment → slip → receive → plan. Note any text that wraps badly, is cut off, or shows boxes instead of letters.
6. Read the oral checks aloud and mark any word a device voice or recording would mispronounce.
7. Do one **cross-language transfer**. Assess in your language on phone A. Open the slip on phone B with a different interface language. Check that the statuses and plan match.
8. Correct a word or sentence **in place**. Never reorder, delete or insert in the middle of a list: a stimulus's position is its repeat-protection ID. To retire one, replace it in place; new stimuli go at the end.
9. Send the sheet back to Ramith. He applies only the approved corrections, regenerates the sheets and re-runs `npm test`.

### Marking a pack approved

Only after steps 1–7 are done, Ramith sets these fields in `src/content/packs/<lang>.ts`:

```ts
reviewStatus: 'approved',
reviewedBy: '<reviewer name and role>',
reviewedOn: 'YYYY-MM-DD',
```

The tests refuse an approved pack without a named reviewer. The draft banner then disappears for that language. Fill in the table above in the same PR.

## Educator decisions still needed (task 04)

Each item below is coded as a placeholder that is easy to change. Nothing here has been approved.

| Decision | Current draft | Where |
|---|---|---|
| Skill graph and prerequisites | 5 numeracy and 3 literacy skills, as in plan section 2.1 | `skills.ts` |
| Tie rule across strands | numeracy before literacy | `STRAND_ORDER` in `skills.ts` |
| Mastery rule | at least 2 independent successes, at least 1 at band 2 | `suggestFromAttempts` in `rubric.ts` |
| "Not yet" rule | at least 2 incorrect and no success | `rubric.ts` |
| Stopping rules | 16 items per session, 4 per skill, 2 skips per skill, about 20 minutes | `STOPPING` in `rubric.ts` |
| Band content | see `LEVEL_DESCRIPTORS` | `rubric.ts` |
| Question formats | 20 families; the "point to the word" decoding format has no app audio (the teacher says the word) | `questions.ts` |
| Comprehension question audio | none: the question repeats words from the sentence, so the teacher asks it after the child reads | `sr.comp` in `questions.ts` |
| Numerals | Western digits (0–9) in every language | all packs |
| Offline budget | up to 6 voiced variants per family and band | `OFFLINE_TARGETS` in `rubric.ts` |

## Offline audio catalog, measured from this content

Distinct spoken strings per language for one offline pack. This covers question instructions and voiced variants (a fixed instruction is voiced once per family), plus the oral checks and activity steps.

| Language | Offline question items | Distinct clips | Characters to voice |
|---|---|---|---|
| en | 220 | 147 | 8,671 |
| mr | 220 | 147 | 7,895 |
| kn | 220 | 147 | 9,258 |
| hi | 220 | 147 | 7,846 |
| te | 220 | 147 | 9,111 |
| ta | 220 | 147 | 10,200 |
| ml | 220 | 147 | 9,522 |

**All 7 languages: 1,029 clips and about 62,500 characters.** At the assumed 1 credit per character, that is more than one month of a small ElevenLabs plan's credits. The rate is not verified; check the account's billing page in task 05. Generate one language at a time, after its review, with `--budget`. The full eligible item pool is 8,631 items per language. Only the bounded offline subset above is voiced; any other item shows text, or uses device speech where available.
