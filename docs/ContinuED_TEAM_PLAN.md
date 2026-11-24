# ContinuED: team plan

## Context
- **Team:** Omkar, Saisagar, Venkat and Ramith. Everyone works with coding agents (Claude Code or Codex).
- **Project:** ContinuED, an offline QR "learning passport" for migrant children (Track 04, UnlockED).
- **Starting point:** **no code**. We build from scratch in the repo `github.com/Saisagar31/ContinuED`.
- **Principles:**
  - Every file has one owner, so nobody collides.
  - Agents get strict prompts, so they don't invent or add extras.
  - Slow tasks (AWS, ElevenLabs, offline PWA) come last, but the design leaves room so they plug in easily later.

## 0. Key dates (from the official site and the Ideathon guide)
| When | What | Stage |
|---|---|---|
| **TODAY, 24 Nov, by 11:59 PM IST** | Submit on Devnovate: **PPT link + YouTube video + public GitHub repo link + Track 4** | Stage 0 |
| 25 Nov → 26 Nov 10 AM | Build the **core MVP** for the online pitch | Stage 1 |
| **26–27 Nov** | **Online pitch:** 5 min presentation + small demo + 3 min Q&A. The repo is judged too. | Stage 1 demo |
| 28 Nov | Shortlist announced | — |
| 28–30 Nov | Full app features (frontend only) | Stage 2 |
| **1–2 Dec** | 24h offline hackathon at RIT. AWS + ElevenLabs + polish + final demo. | Stage 3 |

> ⚠️ **Today isn't only PPT + video.** The FAQ and the Ideathon guide say a **public GitHub repo link is compulsory today**. It's judged on 26–27 Nov, and you can keep pushing until then. The guide also says an early prototype "gives an edge in shortlisting". So today Omkar pushes a **skeleton** (step O3). The real MVP follows on 25 Nov.
>
> ⚠️ **Ask the organisers (coderit@msrit.edu):** may code written before 1 Dec be used on hack day? The guide says hack day is "to scale and polish your final product", which suggests yes, but it isn't stated outright.

---

## 1. Roles and ownership (this prevents collisions)

### 1.1 Roles
| Person | Role | Responsible for | Non-code jobs |
|---|---|---|---|
| **Omkar** | **Team lead + integrator + core logic** | Project setup, shared contracts, QR codec and seal, bottleneck logic, self-check, app shell and wiring, offline PWA, theme (colours/fonts), deployment, **main merger** | Devnovate registration and submission, Architecture slide, demo recording, pitch lead |
| **Saisagar** | **Repo admin + origin-teacher features** | GitHub repo (collaborators, branch protection), Create screen, print slip, classroom roster, **backup merger** | Research with real sources, Problem and Impact slides, deck fact-check |
| **Venkat** | **Destination-teacher features** | Scan screen, root bottleneck and "Start Here Tomorrow" display, camera scanner, skill map, accessibility | Solution and Novelty slides, video script, video recording and editing |
| **Ramith** | **Languages + voice + cloud** | All on-screen text in 3 languages, translation review, device voice, ElevenLabs clips, AWS backend, sync, dashboard | Cover, Tech Stack and Business Model slides, deck design, ElevenLabs and AWS accounts |

### 1.2 File ownership
**Rule: each file has ONE owner. Only the owner's agent edits it.** If you need a change in someone else's file, message them.

| Person | Owns |
|---|---|
| **Omkar** | `package.json`/`package-lock.json` (**only Omkar installs packages**), `vite.config.ts`, `index.html`, `README.md`, `docs/*`, `src/main.tsx`, `src/App.tsx`, `src/config.ts`, `src/index.css` (includes the theme), `src/types/*`, `src/data/*`, `src/utils/capsuleCodec.ts`, `src/utils/bottleneck.ts`, `scripts/selfcheck.ts` |
| **Saisagar** | `src/components/CreateTab.tsx`; later `src/components/RosterTab.tsx` and `src/utils/rosterStore.ts` |
| **Venkat** | `src/components/ScanTab.tsx`; later `src/components/QrScanner.tsx` and `src/components/SkillMap.tsx` |
| **Ramith** | `src/locales/*`, `src/utils/audioPlayer.ts`; later `scripts/generateAudio.mjs`, `.env.example`, `public/audio/*`, `aws/*`, `src/utils/syncService.ts`, `src/components/DashboardTab.tsx` |

### 1.3 Team rules (these keep it safe when people work at different times)
1. **Shared things are add-only.** Text keys (`src/locales/types.ts`), types (`src/types/*`), function names and component props are **never renamed or deleted**, only added to. A rename needs the whole team to agree in chat first, and Omkar makes it.
2. **New on-screen text:** never hard-code words. Send Ramith the key name and the English text, for example `scanCameraButton: "Scan with camera"`. Ramith adds it to `types.ts` and all 3 locale files in one commit.
3. **New package:** ask Omkar. Only Omkar's agent runs `npm install <pkg>`. After pulling, everyone runs `npm install` if `package.json` changed.
4. **App.tsx wiring** (adding a tab or passing a prop): ask Omkar.
5. **Colours and fonts** come only from the theme in `src/index.css` (owned by Omkar). Components use theme classes like `bg-brand` and `text-bad`, never raw colours like `#ff0000`. This makes later UI changes safe (section 10).
6. **The contracts in section 9** are created by Omkar in O3. Everyone codes against them.
7. **After every merge**, post one line in the team chat: "Merged <what>. Run git pull."

### 1.4 Git workflow (everyone, every task)
1. **One-time setup (Saisagar):**
   - Add Omkar, Venkat and Ramith as collaborators.
   - Make the repo **Public**.
   - **Only after Omkar's first push (O3) is on GitHub**, turn on **branch protection** for `main` (GitHub → Settings → Branches → add a rule for `main` → "Require a pull request before merging"). After that, nobody's agent can push to `main` by mistake. If it's turned on earlier, it blocks O3.
2. **Start a task:** `git checkout main` → `git pull` → `npm install` → `git checkout -b <you>/<task>`, for example `venkat/scan-tab`.
3. **Before opening a PR**, bring in the latest work, because someone else may have merged while you worked:
   - `git fetch origin`
   - `git merge origin/main`
   - `npm install`
   - `npm run build`, which must pass. Also run `npm run selfcheck` once it exists.
4. **Open a small PR** (one feature each) that lists the files changed.
5. **Merge:**
   - **Omkar** merges. If he's unavailable for more than 2 hours, **Saisagar** merges.
   - Only merge if the build passes and the PR touches only the author's own files (section 1.2).
6. **Never commit `.env`**, API keys or `node_modules`. Check `git status` before every commit.

### 1.5 New laptop setup (anyone, any time; needs no chat history)
1. Install **Node.js 22 LTS or newer** from nodejs.org (it includes npm), **git**, and VS Code.
2. `git clone https://github.com/Saisagar31/ContinuED.git` → `cd ContinuED` → `npm install` → `npm run dev`. Open the URL it prints.
3. Read `docs/ContinuED_TEAM_PLAN.md`: your role (section 1), your stage task, and the contracts (section 9).
4. Start your coding agent **inside the ContinuED folder**. Paste the **SAFETY HEADER** (section 6.1) followed by your task prompt.

---

## 2. STAGE 0: TODAY (24 Nov). PPT + video + skeleton repo + registration
The official template has 8 fixed slides with no extras allowed. Name the file `TeamName_Track4`, put it on Google Drive with "Anyone with the link can view", and submit everything on Devnovate.

| Time | Omkar | Saisagar | Venkat | Ramith |
|---|---|---|---|---|
| **Now–1 PM** | **O1.** Register the team on Devnovate and invite everyone. **O2.** Copy the official template and share it with the team. | **S0.** Add collaborators and make the repo public. **S1.** Research with real, cited facts (P-RESEARCH). | **V1.** Write slides 3 (Solution) and 6 (Novelty) (P-SLIDES). | **R1.** Write slides 4 (Tech Stack) and 8 (Business Model) (P-SLIDES). |
| **1–4 PM** | **O3.** Build the skeleton repo with the contracts (prompt P-O3) and push it. Write slide 5 (Architecture). | **S2.** Write slides 2 (Problem) and 7 (Impact & Feasibility). | **V2.** Write the video script (P-VIDEO). | **R2.** Fill in the cover slide (names, USNs, team ID). Make the deck visually consistent. |
| **4 PM** | — | **S0b.** After O3's push is on GitHub, turn on branch protection for `main` (section 1.4). | — | — |
| **4–6 PM** | **O4.** Draw the architecture diagram and a clickable mock flow, as images for the video. | **S3.** Review the deck: no stat without a source, and no claims we can't back up. | **V3.** Rehearse the narration. | **R3.** Final deck → Drive → "Anyone with the link can view". |
| **6–9:30 PM** | Help record | Record voiceover | **V4.** Record and edit the video. Upload to YouTube as **Unlisted**. | Help edit |
| **10:00 PM** | **O5.** Submit on Devnovate: PPT, YouTube, GitHub, **Track 4** | Check all links in incognito | Check | Check |

> **About the video:** the guide asks for "a quick walkthrough of your prototype". Tonight there is only a skeleton, so show the **architecture diagram + a screen-by-screen mock** (images or Figma), and say "working MVP demo at the pitch on 26–27 Nov". Don't claim features that don't exist yet.

---

## 3. STAGE 1: core MVP (25 Nov → freeze 26 Nov 10 AM)
**MVP = these 5 things only:**
1. **Create:** enter ID + age, mark 8 skills, seal → QR code + copyable code.
2. **Scan:** paste the code → verify the seal → show skills colour-coded in the *current* UI language.
3. **Root bottleneck** + "Start Here Tomorrow" (peer group + 15-min activity).
4. **3 languages** (English, Marathi, Kannada) with a language switcher and a "Load demo: Raju" button.
5. A **Listen** button using the **device's built-in voice** (ElevenLabs comes later).

**NOT in the MVP:** camera scanner, roster, offline PWA, ElevenLabs, AWS, dashboard.

The work runs in parallel because the contracts from O3 already exist:
| Person | 25 Nov task | Prompt |
|---|---|---|
| **Omkar** | **O6.** Real codec + bottleneck + selfcheck (replacing the O3 stubs). **O7.** App shell: tabs, language switcher, Raju demo button, wiring. **O8.** Deploy to Vercel, merge PRs, rehearse the pitch. | P-O6, P-O7 |
| **Saisagar** | **S4.** CreateTab | P-S4 |
| **Venkat** | **V5.** ScanTab | P-V5 |
| **Ramith** | **R4.** Locale text for en, mr and kn + audioPlayer (device voice). **R5.** Native-speaker review of the translations. | P-R4, P-R5 |
| **All** | Q&A prep | P-QA |

**Timing rules for Stage 1 (works even when people work at different hours):**
- **Omkar's codec PR (O6) must be merged by 25 Nov, 12 PM.** Until then, Saisagar and Venkat build and style their screens. The Seal and Open buttons show "not implemented", which is expected.
- **Ramith's locale PR (R4) must be merged by 25 Nov, 2 PM.** Until then, screens show "TODO" text, which is expected.
- **CreateTab and ScanTab PRs are due by 25 Nov, 8 PM.**
- **Omkar wires App.tsx (O7) and runs the full Raju test by 11 PM.** Everyone fixes their own bugs before the freeze.
- If someone misses a deadline, the merger merges whatever builds. The missing part shows its placeholder, so the app never breaks.

**Merge order (Omkar, or Saisagar as backup):** codec PR → locales PR → CreateTab PR → ScanTab PR → App wiring. Test the Raju demo after each merge.
**Freeze:** 26 Nov 10 AM. After that, bug fixes only.

---

## 4. STAGE 2: full app features, frontend only (28–30 Nov, if shortlisted)
| Person | Task | Prompt |
|---|---|---|
| **Omkar** | **O9.** Offline PWA (`vite-plugin-pwa`) + bundled Noto Sans fonts. Test in airplane mode. | P-O9 |
| **Saisagar** | **S5.** Classroom roster saved on the phone (`idb-keyval`). **S6.** Print paper slip. | P-S5 |
| **Venkat** | **V6.** Camera QR scanner (`html5-qrcode`) + prerequisite skill map. | P-V6 |
| **Ramith** | **R6.** ElevenLabs clip script + generate clips. **R7.** Create the AWS account with UPI and a $1 budget alert. **Don't build AWS yet.** | P-R6 |

## 5. STAGE 3: hack day, 24 hours (1–2 Dec). AWS last
| Hours | Omkar | Saisagar | Venkat | Ramith |
|---|---|---|---|---|
| 0–4 | Merge leftovers, keep the build green | Roster polish | Scanner on real phones | **R8.** Lambda handler + DynamoDB + Function URL (P-R8) |
| 4–10 | Wire Dashboard tab + sync status | **Optional:** Hindi text (Ramith reviews it) | Accessibility: large text, contrast | **R9.** Client sync outbox (P-R9) |
| 10–16 | Redeploy with `VITE_AWS_SYNC_URL` | Help with dashboard UI | Test on 2 phones | **R10.** Dashboard tab (P-R10) |
| 16–20 | **Feature freeze**, bug fixes only | Test | Test | Test sync end-to-end |
| 20–24 | Rehearse the 2-phone airplane-mode demo. **Record a backup video.** | Rehearse | Rehearse | Rehearse |

**If AWS isn't working by hour 10:** drop it. The app works fully offline. Show the AWS design as the next step.

---

## 6. Prompts for coding agents (copy-paste)

### 6.1 SAFETY HEADER: paste this at the start of EVERY coding prompt
```
You are working in the ContinuED repo (React + TypeScript + Vite + Tailwind CSS).
STRICT RULES:
1. First READ docs/ContinuED_TEAM_PLAN.md (sections 1 and 9), README.md,
   src/types/*.ts, src/locales/types.ts (if they exist) and every file named in
   the TASK. Do not guess their contents.
2. Only edit the files listed under "FILES YOU MAY EDIT". Do not create, rename or
   delete any other file. If another file must change, STOP and tell me which and why.
3. Do not install, remove or upgrade packages, and do not edit package.json,
   unless the TASK explicitly says so. If a package is needed, STOP and name it.
4. Build ONLY what the TASK asks. No extra features, no unrelated refactors, no
   new pages, no styling changes outside the task.
5. Never hard-code user-visible text in components; use locale.ui.<key>. If a new
   key is needed, STOP and list key names with English text.
6. Only use functions/APIs that really exist in this repo or in installed
   packages (check node_modules/<pkg>/README if unsure). Never invent an API.
7. Never put API keys or secrets in code. Never commit .env.
8. Never rename or delete existing types, functions, props or text keys (they
   are add-only). Use colours only from the theme in src/index.css (classes like
   bg-brand, text-ok, text-warn, text-bad, text-muted), never raw hex colours.
9. Never commit or push to main. Work only on my current branch.
10. When done: run `npm run build` (and `npm run selfcheck` if it exists), paste
   the output, then list: files changed, what changed, what you did NOT test.
```

### P-O3: Omkar, skeleton + shared contracts (TODAY)
```
[SAFETY HEADER]
EXCEPTION to rule 3: you may create the project and install exactly:
react, react-dom, lz-string, qrcode.react (dependencies) and tailwindcss,
@tailwindcss/vite, typescript, vite, @vitejs/plugin-react, @types/react,
@types/react-dom, @types/node (devDependencies). Nothing else.

BEFORE RUNNING THIS PROMPT (Omkar does it by hand): `git clone
https://github.com/Saisagar31/ContinuED.git`, `cd ContinuED`, create a folder `docs`, and
copy ContinuED_TEAM_PLAN.md into it. Run the agent inside ContinuED.
EXCEPTION to rule 9: this one task may commit to main, because the repo is empty
and branch protection isn't on yet. Ask me before pushing.

TASK: This folder is an existing git repo (it may contain README.md, LICENSE and
docs/). Do NOT delete them. Create a Vite React-TypeScript app IN THIS FOLDER
(if the Vite create tool refuses a non-empty folder, scaffold into a temp folder
and copy the files in, without overwriting docs/ or LICENSE; README.md will be
rewritten below). Add Tailwind v4 via @tailwindcss/vite. In src/index.css add:
  @import "tailwindcss";
  @theme { --color-brand: #5b2a9a; --color-ok: #15803d; --color-warn: #b45309;
           --color-bad: #b91c1c; --color-muted: #6b7280; }
(this creates classes like bg-brand / text-ok; all components must use these).
Add "engines": { "node": ">=22.6" } to package.json.
Then create ONLY these files with exactly these contracts:

src/config.ts
  export const APP_NAME = 'ContinuED';
  export const CAPSULE_PREFIX = 'TC1:';
  export const DEMO_HMAC_KEY = 'continued-demo-key-v1'; // comment: demo only,
  // tamper-evident not secure; future: Ed25519 state signatures

src/types/language.ts
  export type LangCode = 'en' | 'mr' | 'kn';
  export const SUPPORTED_LANGUAGES: Record<LangCode,{nativeName:string;
    englishName:string; speechLocale:string}> // en-IN, mr-IN, kn-IN;
    // nativeName: 'English', 'मराठी', 'ಕನ್ನಡ'
  export const LANG_CODES: LangCode[]; export function isLangCode(x:unknown): x is LangCode

src/data/competencyGraph.ts
  export type SkillId = 'NUM_01'|'NUM_02'|'NUM_03'|'NUM_04'|'NUM_05'|'LIT_01'|'LIT_02'|'LIT_03';
  export type Strand = 'numeracy'|'literacy';
  export const SKILLS: readonly {id:SkillId; strand:Strand; prerequisite:SkillId|null}[]
    // chain NUM_01→NUM_02→NUM_03→NUM_04→NUM_05 and LIT_01→LIT_02→LIT_03,
    // in exactly this order (it is the QR wire order — comment: never reorder)
  export const SKILL_IDS: readonly SkillId[]

src/types/capsule.ts
  export type MasteryStatus = 'mastered'|'in_progress'|'needs_help'|'not_assessed';
  export type SkillMap = Record<SkillId, MasteryStatus>;
  export interface CapsulePayload { v:1; id:string; age:number; originLang:LangCode;
    ts:number /* unix seconds */; skills:SkillMap }
  export interface DecodeResult { valid:boolean; data?:CapsulePayload;
    error?:'format'|'corrupt'|'signature'|'crypto' }
  export interface StartPoint { strand:Strand; skillId:SkillId; status:MasteryStatus }

src/locales/types.ts
  export interface SkillText { title:string; prompt:string; activity:string; group:string }
  export interface UiText { /* every key listed in section 9 of
    docs/ContinuED_TEAM_PLAN.md, each typed string */ }
  export interface Locale { ui: UiText; skills: Record<SkillId, SkillText> }
src/locales/en.ts, mr.ts, kn.ts: default export Locale with PLACEHOLDER text
  "TODO" for every field (Ramith fills them).
src/locales/index.ts: export const LOCALES: Record<LangCode, Locale>

src/utils/capsuleCodec.ts (STUBS that throw 'not implemented'):
  export async function encodeCapsule(p: CapsulePayload): Promise<string>
  export async function decodeCapsule(raw: string): Promise<DecodeResult>
src/utils/bottleneck.ts (STUBS):
  export function findStartPoints(skills: SkillMap): StartPoint[]
  export function findRootBottleneck(skills: SkillMap): StartPoint | null
src/utils/audioPlayer.ts (STUB): export function speak(lang: LangCode, text: string): void
src/components/CreateTab.tsx (placeholder component, props in section 9)
src/components/ScanTab.tsx (placeholder component, props in section 9)
src/App.tsx: header with APP_NAME, two tabs (Create, Scan) rendering the placeholders.
README.md: project summary (problem, solution, planned architecture, team, how to
run, link to docs/ContinuED_TEAM_PLAN.md). Clearly say "Work in progress — MVP
by 26 Nov". Do not describe unbuilt features as finished.
.gitignore must include node_modules, dist, .env.
Finally: `npm run build` must pass (stubs compile; they only throw when called).

FILES YOU MAY EDIT: everything listed above (new project). Do not touch docs/.
```

### P-O6: Omkar, real codec + bottleneck + selfcheck
```
[SAFETY HEADER]
TASK: Replace the stubs in src/utils/capsuleCodec.ts and src/utils/bottleneck.ts.
Codec:
- Wire JSON (short keys): {v:1,i:id,a:age,o:originLang,t:ts,s:<8 letters>,g:<sig>}
  where s has one letter per skill in SKILL_IDS order: M=mastered, P=in_progress,
  N=needs_help, U=not_assessed.
- g = HMAC-SHA256 (crypto.subtle) with DEMO_HMAC_KEY over
  JSON.stringify([v,i,a,o,t,s]); first 16 bytes; base64url without padding.
- Output = CAPSULE_PREFIX + LZString.compressToEncodedURIComponent(JSON).
- decodeCapsule: accept a raw code OR any text containing "TC1:" (use the part
  from TC1: onward); errors: 'format' (no prefix), 'corrupt' (decompress/parse/
  shape fails, unknown language, wrong length), 'signature' (sig mismatch),
  'crypto' (crypto.subtle missing — only exists on https or localhost).
Bottleneck:
- findStartPoints: for each strand in order (numeracy, literacy), the first
  skill in the chain whose status is not 'mastered'.
- findRootBottleneck: the start point with the most urgent status
  (needs_help > in_progress > not_assessed); null if all mastered.
Also create scripts/selfcheck.ts (runs with `node scripts/selfcheck.ts` on
Node 22.6+) and add "selfcheck" to package.json scripts. It must check, for each
language: round trip equal, code length < 350; and: an edited code fails with
'signature', garbage fails, truncated fails, Raju demo
(NUM_01–03 M, NUM_04 N, NUM_05 N, LIT_01 M, LIT_02 P, LIT_03 N) gives root
NUM_04 and start points NUM_04 and LIT_02; all mastered gives null.
FILES YOU MAY EDIT: src/utils/capsuleCodec.ts, src/utils/bottleneck.ts,
scripts/selfcheck.ts (new), package.json (scripts section only)
```

### P-O7: Omkar, app shell and wiring
```
[SAFETY HEADER]
TASK: In App.tsx: language dropdown (native names from SUPPORTED_LANGUAGES,
saved in localStorage inside try/catch), tabs Create / Scan, an
online/offline pill (navigator.onLine + 'online'/'offline' events),
a "Load demo: Raju (Marathi → Kannada)" button that pre-fills CreateTab with the
Raju marks (ID TC-4821, age 8, origin mr), and when a capsule is sealed in
CreateTab, the code is passed to ScanTab via the onOpenInScan prop. If the page
URL hash starts with "#TC1:", open the Scan tab with that code. Footer text from
locale.ui.footer. Mobile-first layout (max width ~640px, 16px side padding).
FILES YOU MAY EDIT: src/App.tsx, src/index.css
```

### P-S4: Saisagar, CreateTab
```
[SAFETY HEADER]
TASK: Implement src/components/CreateTab.tsx with EXACTLY the props in section 9
of docs/ContinuED_TEAM_PLAN.md. If encodeCapsule still throws "not implemented"
(Omkar's codec not merged yet), show the error text in the UI instead of crashing.
UI:
- Student ID input (letters, numbers, dashes, max 24; "New ID" button makes
  "TC-" + 4 random digits) and Age (3–18) with validation messages.
- 8 skill cards grouped by strand (locale.ui.numeracy / literacy), each showing
  locale.skills[id].title, the prompt text, a Listen button calling
  speak(lang, prompt), and 3 large buttons: Mastered / In progress / Needs help
  (default not_assessed).
- "Seal" button → encodeCapsule({...}) → show a QRCodeSVG (from qrcode.react)
  whose value is `${location.origin}${location.pathname}#${code}`, the code length
  in characters, badges "Zero personal data" and "Tamper-sealed", a Copy code
  button (navigator.clipboard, with try/catch), and an "Open in Scan" button
  calling props.onOpenInScan(code).
All text from locale.ui / locale.skills. One column, works at 360px width.
FILES YOU MAY EDIT: src/components/CreateTab.tsx
```

### P-V5: Venkat, ScanTab
```
[SAFETY HEADER]
TASK: Implement src/components/ScanTab.tsx with EXACTLY the props in section 9 of
docs/ContinuED_TEAM_PLAN.md. If decodeCapsule still throws "not implemented"
(codec not merged yet), show the error text instead of crashing.
- Textarea to paste a code or link + "Open" button → decodeCapsule(text).
  If props.initialCode is given, decode it automatically.
- On error show the right message: ui.errFormat / errCorrupt / errSignature /
  errCrypto (red box).
- On success: green banner ui.verified, origin language native name, date
  (from ts), student ID and age.
- Root bottleneck card (findRootBottleneck) at the top, or ui.allMastered.
- Skill list grouped by strand with colour + text label for status
  (green mastered, amber in progress, red needs help, grey not assessed).
- "Start Here Tomorrow" card: for each start point (findStartPoints): skill title,
  peer group (locale.skills[id].group), activity, and a Listen button →
  speak(currentLang, activity).
- "Play oral check in <origin language>" button →
  speak(originLang, LOCALES[originLang].skills[root].prompt).
All text from locale; works at 360px width. Use the existing functions — do not
reimplement decoding or bottleneck logic.
FILES YOU MAY EDIT: src/components/ScanTab.tsx
```

### P-R4: Ramith, locale text + device voice
```
[SAFETY HEADER]
TASK 1: Fill src/locales/en.ts, mr.ts, kn.ts (replace every "TODO") for all UI
keys in src/locales/types.ts and all 8 skills:
NUM_01 Number Recognition (1–99); NUM_02 Place Value (Tens & Ones); NUM_03
Addition Without Regrouping; NUM_04 Subtraction With Regrouping (Borrowing);
NUM_05 Introduction to Fractions (Halves & Quarters); LIT_01 Phonemic Awareness &
Letter Sounds; LIT_02 Decoding 2- & 3-Syllable Familiar Words; LIT_03 Reading
Short Sentences with Comprehension.
For each skill: title (school-style term in native script, never transliterated),
prompt (one oral question to a Class 1–3 child, 60–85 characters), activity
(a concrete 15-minute classroom activity, 95–125 characters, no special
materials beyond sticks, paper, chalk, cards), group (a short peer-group name).
Simple words a village teacher and a child would use. Add a comment at the top of
mr.ts and kn.ts: "DRAFT — needs native-speaker review".
TASK 2: Implement src/utils/audioPlayer.ts: speak(lang, text) uses
window.speechSynthesis with SUPPORTED_LANGUAGES[lang].speechLocale, rate 0.9,
cancels any current speech first, and does nothing if speechSynthesis is missing.
(Later it will first try /audio/{lang}/{skillId}_{type}.mp3 — do NOT build that now.)
FILES YOU MAY EDIT: src/locales/en.ts, src/locales/mr.ts, src/locales/kn.ts,
src/utils/audioPlayer.ts
```

### P-R5: Ramith, native-speaker review (chat AI, not a coding agent)
```
I'm pasting three files with UI text and 8 skills (title, prompt, activity,
group) in English, Marathi and Kannada for a Class 1–3 literacy/numeracy app.
Make a table: Key | English | Marathi | Kannada | Correct? | Suggested fix.
Flag lines that sound machine-translated, too formal, or use words a Class 2–3
child or a village teacher wouldn't use. Do NOT rewrite silently; mark
"needs native check". [paste the 3 files]
```
Give the table to a Marathi speaker and a Kannada speaker. Then have the coding agent apply **only** the approved fixes, editing `mr.ts` and `kn.ts` only.

### P-O9: Omkar, offline PWA (Stage 2)
```
[SAFETY HEADER]
EXCEPTION to rule 3: install exactly `vite-plugin-pwa` (dev dependency).
TASK: Make the app work fully offline after first load: precache app shell,
JS/CSS, fonts in public/fonts/ (Noto Sans, Noto Sans Devanagari, Noto Sans
Kannada .woff2 — tell me where to download them; do not invent URLs) and
public/audio/** (globPatterns **/*.{js,css,html,ico,png,svg,woff2,mp3}). Add a
manifest using APP_NAME. Don't change app logic. Give me exact test steps:
build → preview → load once → airplane mode → reload → create + scan.
FILES YOU MAY EDIT: vite.config.ts, index.html, package.json, package-lock.json,
src/index.css (font-face only), public/ (icons, fonts)
```

### P-S5: Saisagar, roster + print slip (Stage 2)
```
[SAFETY HEADER]
Omkar has installed idb-keyval. TASK: (1) src/utils/rosterStore.ts exporting
saveToRoster(entry), listRoster(), removeFromRoster(id) where entry =
{ id, age, originLang, ts, code, source:'created'|'scanned' } — no names.
(2) src/components/RosterTab.tsx listing entries with origin language, date,
root bottleneck title (decode the code with decodeCapsule +
findRootBottleneck), and buttons Show QR / Open in Scan / Remove.
(3) In CreateTab, a "Print paper slip" view showing only APP_NAME, the QR code,
ID, date and origin language (use window.print and a print stylesheet scoped
to the slip). Do NOT wire RosterTab into App.tsx — give me the exact props and
lines for Omkar.
FILES YOU MAY EDIT: src/utils/rosterStore.ts (new), src/components/RosterTab.tsx
(new), src/components/CreateTab.tsx
```

### P-V6: Venkat, camera scanner + skill map (Stage 2)
```
[SAFETY HEADER]
Omkar has installed html5-qrcode. Read node_modules/html5-qrcode/README.md first
and use only APIs documented there.
TASK: (1) src/components/QrScanner.tsx with props { onCode:(text:string)=>void }:
opens the back camera, stops after a successful scan and on unmount, shows
ui.cameraDenied if permission is refused. (2) src/components/SkillMap.tsx: two
horizontal chains (numeracy, literacy) of skill boxes with arrows, coloured by
status, root bottleneck outlined. (3) In ScanTab, add QrScanner above the paste
box and SkillMap below the banner.
FILES YOU MAY EDIT: src/components/QrScanner.tsx (new),
src/components/SkillMap.tsx (new), src/components/ScanTab.tsx
```

### P-R6: Ramith, ElevenLabs voice pack (Stage 2)
```
[SAFETY HEADER]
TASK: Create scripts/generateAudio.mjs (Node 22.6+, no extra packages, uses
built-in fetch and process.loadEnvFile). It:
- reads ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL_ID
  (default eleven_v4_turbo) from .env;
- imports LOCALES from ../src/locales/index.ts and SKILL_IDS from
  ../src/data/competencyGraph.ts;
- for each language × skill × type (prompt, activity) POSTs to
  https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_22050_32
  with header xi-api-key and JSON {text, model_id, language_code: lang};
- writes public/audio/{lang}/{skillId}_{type}.mp3, skips files that exist;
- supports --dry-run (count clips + characters, no calls), --lang xx, --limit n;
- stops on HTTP 401/402/429.
Before writing, check the current ElevenLabs API docs for this endpoint and
tell me if anything differs. Then update src/utils/audioPlayer.ts: add
playClip(lang, skillId, type, fallbackText) that tries the mp3 first and falls back
to speak(). Also add .env.example with the 3 variables (empty values).
FILES YOU MAY EDIT: scripts/generateAudio.mjs (new), src/utils/audioPlayer.ts, .env.example (new)
```
Run order: `--dry-run`, then `--lang mr --limit 2`. Listen to those. If they're good, run it fully. The ElevenLabs free plan needs no card and gives about 10k credits a month. Check whether the model supports Marathi and Kannada.

### P-R8: Ramith, AWS backend (Stage 3, hack day)
```
[SAFETY HEADER]
TASK: Create aws/syncHandler.mjs — one AWS Lambda (Node.js 20.x+) behind a
Lambda Function URL (no API Gateway), using @aws-sdk/client-dynamodb and
@aws-sdk/lib-dynamodb (included in the Lambda Node runtime — verify in AWS docs).
Routes: POST /sync body {events:[...]} (max 100) → BatchWrite to table
TransferEvents (pk = "CORRIDOR#"+originLang+"_"+destLang, sk = ts+"#"+eventId),
storing ONLY whitelisted fields {eventId, capsuleId, eventType
('created'|'scanned'), originLang, destLang, age (3–18), rootBottleneck, skills
(M/P/N/U letters), ts}; invalid events are counted as rejected; returns 200
{synced, rejected}. GET /stats → {total (unique capsules), corridors
{"mr->kn":n}, bottlenecks {"NUM_04":n}} counting scanned events. CORS is set on
the Function URL, not in code. Also write aws/README_AWS_SETUP.md: DynamoDB
PROVISIONED 5 RCU/5 WCU (not on-demand), Lambda + env TABLE_NAME, least-privilege
IAM policy, Function URL with CORS, $1 budget alert, and curl tests. Walk me
through the console step by step, stopping after each step.
FILES YOU MAY EDIT: aws/syncHandler.mjs (new), aws/README_AWS_SETUP.md (new)
```
### P-R9: Ramith, client sync outbox (Stage 3)
```
[SAFETY HEADER]
TASK: src/utils/syncService.ts using idb-keyval: enqueueEvent(event) stores in an
IndexedDB "syncQueue"; flushSyncQueue() POSTs to
`${import.meta.env.VITE_AWS_SYNC_URL}/sync` in batches of ≤100 and removes items
ONLY after HTTP 200; does nothing if VITE_AWS_SYNC_URL is empty or offline;
registers window 'online' → flush. Export pendingCount(). Do not wire into
components — give Omkar the exact calls to add after seal (eventType 'created')
and after a successful scan (eventType 'scanned').
FILES YOU MAY EDIT: src/utils/syncService.ts (new)
```
### P-R10: Ramith, dashboard tab (Stage 3)
```
[SAFETY HEADER]
TASK: src/components/DashboardTab.tsx: fetch GET `${VITE_AWS_SYNC_URL}/stats`
when online; show 3 KPI cards (total transfers, number of corridors, top
bottleneck skill title) and two simple bar lists (corridors, bottlenecks) using
plain divs (no chart library). Offline: show the last stats saved in
localStorage (try/catch) with a "last updated" time. Props: { locale, lang }.
FILES YOU MAY EDIT: src/components/DashboardTab.tsx (new)
```

### Prompts for the PPT and video (chat AI)
**Context block: paste this first**
```
Hackathon: wHACKiest 2026 (CodeRIT, RIT Bengaluru), Track 04 "UnlockED"
(EdTech, Skills, Employment): "Bridge the gap between learning and employment".
Judging: problem understanding, thought process, presentation.
Sponsor awards: Best Use of ElevenLabs, Best Use of AWS.
Project: ContinuED — an offline QR "learning passport" for children of migrant
families. Old teacher checks 8 basic reading/maths skills; the app seals results
(no name, only an ID like TC-4821) into a small QR. The new teacher, maybe in a
different language, scans it offline and sees the skills in their language, the
root bottleneck (first skill the child is stuck on), and a "Start Here Tomorrow"
plan (15-min activity + peer group). Planned: voice clips in the child's mother
tongue (ElevenLabs) that play offline; anonymous sync to AWS (Lambda + DynamoDB)
for a district dashboard of migration routes and common skill gaps.
Demo: Raju, 8, Marathi school in Maharashtra → Kannada school in Karnataka.
Tech: React + TypeScript offline web app (PWA), QR, compression, tamper-evident
seal, ElevenLabs, AWS.
Status: today only a skeleton + design; working MVP by 26 Nov.
Honest limits: seal is tamper-evident not secure; translations are drafts; no pilot yet.
RULES: Never invent statistics, quotes or sources. Every number needs a real
source with a link I can open. If none, write [STAT NEEDED]. Mark uncertain
things UNVERIFIED. Simple English. Never describe planned features as finished.
```
- **P-RESEARCH (Saisagar):** "Find real, linked sources on:
  (a) how many children in India migrate with their families
  (b) how migration disrupts schooling or learning
  (c) foundational literacy and numeracy levels (e.g. ASER, NIPUN Bharat)
  (d) what APAAR ID and UDISE+ actually do, from official sites

  Output a table with columns Fact | Number | Source | Link | Year. Flag weak sources."
- **P-SLIDES:** "Write content for slide [N: title]. Template guidance: [paste that slide's INCLUDE list from section 7]. Give a title, 3–6 bullets of 12 words or fewer, one visual idea, and 2–3 lines of speaker notes."
- **P-VIDEO (Venkat):** "Write a 3–5 min spoken script (550–650 words) with timestamps and on-screen directions:
  - 0:00 Problem (Raju + 1–2 verified stats)
  - 0:40 Solution
  - 1:30 Architecture diagram
  - 2:15 Screen-by-screen mock walkthrough, clearly called a design preview
  - 3:45 Impact + roadmap (more languages, state pilot, youth skills → jobs)
  - Closing line"
- **P-QA (all):** "Give 10 tough judge questions with honest 2–3 sentence answers. Include: Why not APAAR? Who adopts it? What if the QR is lost? Is the seal secure? How does it connect to employment? What does it cost a state? How do you ensure translation quality?"

---

## 7. Official PPT template: 8 slides (no extra slides allowed)
1. **Cover:** team name, college, track, team ID, members 1–4 with USNs. (Owner: Ramith)
2. **Problem Statement:** what the problem is in one line; who it affects and how many; why it matters (a stat or real example); existing solutions and their gaps. (Owner: Saisagar)
3. **Proposed Solution:** solution in one line; key features; user flow; what you'll build in 24 hours (MVP). (Owner: Venkat)
4. **Tech Stack:** frontend, backend, database, AI/ML, cloud, APIs; why each was chosen. (Owner: Ramith)
5. **Process Flow / Architecture:** input → processing → output; the components; arrows; each block labelled with its tech. (Owner: Omkar)
6. **Novelty / Innovation:** USP; the new approach; a comparison table against existing solutions. (Owner: Venkat)
7. **Impact & Feasibility:** who benefits, measurable outcomes, scalability; technical, time and cost feasibility; risks and how we'll handle them. (Owner: Saisagar)
8. **Business Model:** customers and market size; revenue model; go-to-market; key costs and partnerships; sustainability. (Owner: Ramith)

**Track-fit tip:** on slides 7 and 8, add "Phase 2: the same capsule carries vocational skills for older migrant youth into ITI courses and jobs". This links the project to Track 4's "employment" theme.

## 8. Designed in now, built later (so it's easy to add)
- **More languages (hi, te, ta, ml):** extend `LangCode` (Omkar) and add a locale file (Ramith). The codec and screens don't change.
- **ElevenLabs:** `audioPlayer` gets `playClip()` (try the MP3, then fall back to the device voice), so the MP3s can be dropped in at any time.
- **AWS:** sync stays switched off until `VITE_AWS_SYNC_URL` is set. The app always works without it.
- **Official signatures (Ed25519):** the wire format has a version field (`v`), so a v2 capsule can add signatures. This is roadmap only.

## 9. Shared contracts (Omkar creates these in O3; everyone codes against them)
**Component props**
```ts
// CreateTab
{ lang: LangCode; locale: Locale;
  demo?: { id: string; age: number; skills: SkillMap } | null; // filled by "Load demo"
  onOpenInScan: (code: string) => void }
// ScanTab
{ lang: LangCode; locale: Locale; initialCode?: string | null }
```
**UiText keys (MVP)**
- **App:** `tagline`, `online`, `offline`, `language`, `loadDemo`, `tabCreate`, `tabScan`, `footer`
- **Create:** `studentId`, `newId`, `age`, `ageError`, `idError`, `numeracy`, `literacy`, `mastered`, `inProgress`, `needsHelp`, `notAssessed`, `listen`, `seal`, `capsuleReady`, `characters`, `zeroPii`, `sealed`, `copyCode`, `copied`, `openInScan`
- **Scan:** `pasteHint`, `pastePlaceholder`, `open`, `verified`, `origin`, `assessedOn`, `errFormat`, `errCorrupt`, `errSignature`, `errCrypto`, `rootBottleneck`, `allMastered`, `skillMap`, `startHere`, `peerGroup`, `activity`, `playInOrigin` (contains `{lang}`)
- **Added later by Ramith when asked:** `cameraDenied`, roster and dashboard keys.

## 10. Changing the UI later: yes, safely
**You can redesign the look at any time after the MVP** without breaking anything, because the app is split into layers:

| Layer | Files | Changes during a UI redesign? |
|---|---|---|
| Logic (QR, seal, bottleneck) | `src/utils/capsuleCodec.ts`, `bottleneck.ts`, `src/data/*`, `src/types/*` | ❌ Never touched. `npm run selfcheck` proves it still works. |
| Text (3 languages) | `src/locales/*` | ❌ Not needed. The same keys keep working. |
| Theme (colours, fonts) | `src/index.css` `@theme` block (Omkar) | ✅ Change colours **once here** and the whole app updates. |
| Layout and look | `src/components/*`, `src/App.tsx` | ✅ Each owner restyles **their own** screen. |

**When:**
- **Allowed:** Stage 2 (28–30 Nov), and hack-day hours 10–16 (UI polish).
- **Never:** during a freeze (26 Nov 10 AM → pitch; hack-day hour 16 onwards).

**How:**
1. Agree the new look first. Venkat makes a simple mockup (Figma, or a screenshot plus notes) and the team approves it in chat.
2. Omkar updates the theme colours and fonts in `src/index.css` (one PR).
3. Each owner restyles their own screen, using P-UI on their own branch.
4. Run the Raju demo again after each merge.

**P-UI: restyle a screen (each owner, for their own file)**
```
[SAFETY HEADER]
TASK: Restyle ONLY the visual layout of <your component file> to match this
design: <paste mockup description or link>. Change only Tailwind classes and JSX
layout/structure. Do NOT change: props, function calls, logic, state handling,
text keys, or any other file. Use only theme colours (bg-brand, text-ok,
text-warn, text-bad, text-muted). Keep it working at 360px width.
FILES YOU MAY EDIT: <your component file only>
```

---

## Verification checklist
- **Stage 0:** the 3 links open in incognito; the PPT has exactly 8 slides and is named `TeamName_Track4`; the video is 3–5 min and is unlisted; the repo is public with a README and has no `.env`.
- **Stage 1:** `npm run build` and `npm run selfcheck` pass; the Raju demo (Marathi → Kannada) shows root NUM_04 and start points NUM_04 and LIT_02 on the live Vercel link on a phone; translations have been checked or are labelled as drafts.
- **Stage 2:** the app reloads and works in airplane mode; the camera scans a printed QR; ElevenLabs clips play offline.
- **Stage 3:** an event created offline appears on the dashboard after going online; the backup demo video is recorded.
