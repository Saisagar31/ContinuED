# What we built: a plain-English log

A running diary of what's in this repo, written so anyone (teammates, judges, future us) can follow it without reading code. **Add a new entry at the top every time you merge something.**

---

## 26 Nov 2026: Everything connected: one app from question to dashboard (Ramith, integration, branch `ramith/integration`)

**In simple terms:** until now each teammate's part worked on its own branch. This joins them, so the app does the plan's whole journey. The online parts switch on only when the school services are set up; with nothing set up, the app works fully offline as before.
- **School sign-in** (Omkar's #12) has a "School" link in the top bar. Each teacher on a shared phone has their own sign-in.
- **Signed transfer slips:** when a teacher is online and signed in, the slip is stamped by the school's key, and the receiving phone shows "verified". If that isn't possible, the slip is unsigned as before and says so.
- **Sync:** finishing an assessment, giving out a slip and receiving one each queue an anonymous record on the phone. Records are sent when online and signed in, each counted once. A line at the top says what is waiting and what to do.
- **Trends** show the school's real numbers when signed in, and practice data otherwise. Saved copies of the two are never mixed up.
- **Audio:** a new "Audio" screen downloads each language's recordings once. The question screen and the oral check then play the reviewed recording, fall back to the phone's voice, or say that there is none. The question picker prefers questions that have a recording.
- **Sign-in screen in all 7 languages:** its 43 messages moved into the language packs, plus 24 new ones. That is 303 interface strings per language now.
- **`docs/PLAN_STATUS.md`:** task-by-task status of the execution plan and the merge order.

**Checked:**
- All tests pass, including new checks that the app's sync records pass the server's own validator and that nothing is stored when sync is off.
- Typecheck and build pass.

**Not checked:**
- A browser or a phone.
- Real AWS, Cognito or ElevenLabs. None exist yet.

---

## 26 Nov 2026: Audio tool now reads all seven language packs (Omkar, task 10, branch `omkar/10b-audio-from-packs`)

**In simple terms:** the tool that makes voice recordings used to know only the old English sample. Now it reads Ramith's seven language packs and lists every line the app may say out loud in each language.
- **What gets recorded:** question instructions and spoken questions from the offline question set, plus the oral checks and activities. That is 159 recordings per language. It uses the same 6-questions-per-format-and-level limit the offline pack uses (`OFFLINE_TARGETS` in `src/content/rubric.ts`).
- **Reading words and sentences are never recorded.** For reading questions only the instruction ("Read this word") is voiced. The tool refuses to run if a reading question would read out its own word or sentence.
- **Same IDs as the app.** Each recording's ID is taken straight from the question the app shows, so the phone always finds the right recording.
- **Bug fixed:** two kinds of first-sound question ("what sound does it begin with?" and "say another word with the same sound") shared one recording ID, so one could have played the other's recording. Each now has its own ID (`src/content/questions.ts`).
- **Drafts stay out.** All packs are still drafts, so a normal run records nothing. `--include-unapproved` lists them for counting: about 66,000 characters for all seven languages.

**Checked:**
- 184 tests pass (32 new in `scripts/audio/catalog.test.ts`; one old English-sample test removed). They check that every language has recordings, drafts are left out, no reading word or sentence is recorded, recording IDs match the questions the engine actually picks, and identical text is still recorded once. Typecheck and build pass.

**Not checked:**
- No real recordings were made (no API key).
- The engine can still pick a question that isn't in the offline set; that question then has no recording and falls back to text. In a simulated run about 59% of spoken questions had a recording.

---

## 26 Nov 2026: The real assessment engine (task 06, built by Ramith for Sai to review, branch `ramith/06-assessment-engine`)

**In simple terms:** the app now picks each next question based on how the child answered, instead of following a fixed script.
- **Right on their own:** the child gets a harder question, then a different kind of question to confirm. Once there is enough evidence, the app moves to the next skill.
- **Needed a hint:** another example at the same level, asked a different way.
- **Wrong:** the app first checks the earlier skill this one depends on. If a child can't yet read numbers, the app won't test subtraction; it moves to the reading skills instead.
- **Skipped:** a different question. After two skips the skill is left "undecided", never marked as failed.
- **Fresh questions every time.** A child never sees a question they have seen before, even in a later session or in another language. If the questions run out, the app says so.
- **The teacher sees why** each question was picked, in their own language.
- **The question screen** now separates "say to the learner" from "show the learner". For reading tasks it reminds the teacher not to read the word aloud.
- **Old stub removed** (`src/assess/stubEngine.ts`).

**Checked:**
- 127 tests pass, including 14 new engine tests built from the plan's acceptance list:
  - different children follow different paths
  - formats vary
  - reassessment avoids seen questions
  - "different question" isn't counted as an attempt
  - running out of questions is handled
  - the session limit stops the session
  - a single answer never means "mastered"
- Typecheck and build pass.

**Not checked:**
- A walk-through on a real phone.
- The adaptation rules with real teachers (they are starting rules to pilot).

---

## 26 Nov 2026: Skill map, question bank and seven language packs (Ramith, tasks 04 + 09, branch `ramith/04-09-content-language-packs`)

**In simple terms:** the app now speaks all seven languages, and the questions it asks come from a real question bank instead of a placeholder. **Everything is a draft:** no educator or native speaker has checked it yet, and the app says so with a banner.
- **Seven language packs (`src/content/packs/`):** English, Marathi, Kannada, Hindi, Telugu, Tamil and Malayalam. Each pack has every on-screen word (221 labels and messages), the 8 skill names, peer groups, oral checks, rubric descriptions, activities, question wording, and reading words and sentences written for that language and script.
- **Every screen now uses them.** A teacher can switch the app language on the sign-in screen and the top bar. The learner's assessment language stays separate.
- **The receiving plan** shows activities and peer groups in the teacher's language. It shows the oral check in the child's origin language, with a translation underneath.
- **Question bank (`src/content/questions.ts`):** 20 question formats, at least two for every skill at both levels. Arithmetic questions are generated with built-in checks, for example "no carrying" really means no carrying. Each question has an ID, so a child isn't asked the same thing twice, even after switching language.
- **Rubric (`src/content/rubric.ts`):** when a skill counts as mastered, developing or not yet, plus when to stop and how many voiced questions go into an offline pack. These are starting rules for teachers to pilot.
- **Review sheets (`docs/review/*.csv`):** one spreadsheet per language for native-speaker reviewers. `docs/CONTENT_REVIEW.md` explains what to check and how a pack gets approved.
- **Audio budget measured:** about 147 clips and 8–10k characters per language, so about 62,500 characters for all seven.

**Checked:**
- 117 tests pass (65 new). They check every pack is complete and in its own script, all 49 language pairs, more than 1,000 generated arithmetic questions, repeat protection, and that reading words are never read aloud by the app.
- Typecheck and build pass.

**Not checked:**
- Any native-speaker or educator review.
- Real phones (font rendering, text wrapping).
- Pronunciation.
## 26 Nov 2026: Audio pipeline and offline audio packs (Omkar, task 10 + task 05 tooling, branch `omkar/10-audio-pipeline`)

**In simple terms:** the tools that turn approved lesson text into ElevenLabs voice clips, and the phone code that downloads those clips safely for offline use.
- **Build tool (`scripts/audio/`):** lists every distinct spoken sentence per language, and gives the same sentence in the same voice one recording only.
  - `--dry-run` counts clips, characters and estimated credits without calling anyone.
  - `--sample` makes one clip per language and records its size and cost (task 05).
  - A real run retries busy errors, stops at once on a bad key or empty account, respects a `--budget`, and keeps a log, so a stopped run can pick up where it left off.
  - It writes the MP3s plus a checked list of files (manifest).
- **Review (`scripts/audio/review.ts`):** a person marks clips approved or rejected after listening. If the text later changes, the verdict resets.
- **Phone side (`src/audio/`):** downloads a whole language pack, checks every file's fingerprint, and switches over only when everything is correct. If the download breaks, the file is wrong or the phone is full, the old pack keeps working. Playback order: reviewed clip, then the phone's own voice, then text only.

**Checked:** 26 new tests (78 total), typecheck and build pass. With no API key, nothing calls ElevenLabs.
**Not checked:** real ElevenLabs calls, real phones, the real browser Cache API. Venkat's screens are not wired up yet.

---

## 26 Nov 2026: Two new optional fields on a saved session (Omkar, task 02, branch `omkar/02-foundation`)

**In simple terms:** after reviewing Ramith's assessment engine, we added two optional fields to what's saved for each assessment session.
- **`rubricVersion`:** which version of the marking rules was used. The plan says evidence and rules must stay together.
- **`shownNotAttempted`:** questions the teacher swapped out with "Different question", so they don't come back later in the same session.

Both are optional, so sessions saved earlier still open. The example audio list now uses the same clip names as Ramith's language packs (`num.sub_borrow.oral`).

---

## 26 Nov 2026: Deploy and rollback runbook (Omkar, task 13, branch `omkar/13-staging-runbook`)

**In simple terms:** step-by-step instructions for putting the app online safely, and for undoing a bad release. **Nothing has been deployed yet:** we still need the AWS, Cloudflare and ElevenLabs accounts.
- **`docs/DEPLOY.md`** covers:
  - two separate environments, staging (fake data only) and production
  - how to connect Cloudflare Pages
  - how to deploy the AWS backend and audio packs
  - the checks and drills to run on staging
  - how to roll back each part
  - a "release record" form to fill in for every release
- **`public/_headers`:** tells phones to always re-check the app's start-up files (so updates arrive), and lets them keep the rest for a year.
- **Important:** the repo is on Sai's personal GitHub account, so **Sai has to connect Cloudflare Pages** (Cloudflare won't list another person's repos).

---

## 26 Nov 2026: Staff sign-in for school services (Omkar, task 11, branch `omkar/11b-staff-sign-in`)

**In simple terms:** teachers can now sign in to their school account on the phone, so the upload queue, the transfer stamp and the school trends have a real login to use. The app still works fully offline without it.
- **Talking to Amazon Cognito (`src/auth/cognito.ts`):** signs in with email and password, handles the "choose a new password" step for new staff and the 6-digit authenticator code step, and renews the login quietly when it is about to run out. Plain web requests, no new libraries.
- **Keeping each teacher's login separate (`src/auth/session.ts`):** on a shared phone, each local teacher profile has its own school login. The short-lived login tokens stay in memory only. The phone saves just the renewal token and the school, district, roles and email, filed under that teacher's local profile. Through the app, Teacher B can never pick up Teacher A's school login (this is app-level separation, not encryption). Signing out removes the saved renewal token.
- **Expired logins:** if Cognito refuses to renew the login, the app forgets it and the upload queue shows "sign in again". If the phone is just offline, nothing is forgotten.
- **Trusted schools list:** right after sign-in, the phone downloads the list of school stamp keys (`GET /trust`) and saves it, so stamped transfers can be checked offline later.
- **Sign-in screen (`src/screens/StaffSignIn.tsx`):** a phone-sized form with clear messages (wrong password, too many tries, password reset needed, offline). Not wired into the app yet; the suggested wiring is in the task report.
- **Cloud setup (`infra/`):** the sign-in app setting now allows this password sign-in. The password travels encrypted (TLS) to Cognito. A stronger method (SRP) is a later improvement.

**Checked:**
- 124 tests pass (17 new), with Cognito and the API faked.
- Typecheck and build pass.

**Not checked:**
- Real Cognito (there is no AWS account yet), and the screen in a real browser.

---

## 26 Nov 2026: School services: sign-in, sync, signing, dashboard numbers (Omkar, task 11, branch `omkar/11-school-services`)

**In simple terms:** the school server can now take sync uploads from teacher phones, stamp transfers as genuine, and give school and district leads their counts. One school can never see another school's data.
- **Sign-in check (`api/src/auth.ts`):** every request needs a staff login token (Amazon Cognito). The token decides which school the person belongs to and what role they have: teacher, school lead or district lead. Nothing a phone sends can change the school.
- **Sync (`POST /events`):** phones send up to 100 events at a time. The server answers for each event: stored now, already had it, or rejected with a reason. A phone that resends the same batch never gets counted twice. Storing an event and updating its counts happen together, or not at all.
- **Counts (`GET /aggregates`):** transfers by language route, by skill that needs support, and by month. A school lead sees their own school. A district lead sees the total for their district. Counts below 5 are hidden, the same rule the dashboard uses.
- **Stamping transfers (`POST /sign`, `GET /trust`):** the school's private key stays on the server (Amazon KMS). Phones get the list of public keys, so they can check a stamp offline. Old keys keep working until they expire, and revoked keys show as revoked.
- **Deleting a learner (`DELETE /learners/{id}`):** a school lead can remove a learner's records, and the counts go down to match.
- **Phone side (`src/sync/`, `src/transfer/serverSigner.ts`):** an upload queue that only deletes events once the server confirms them. If the login has expired, the queue stops and keeps everything until the teacher signs in again. If there's no internet, nothing is lost.
- **Cloud setup (`infra/`):** a template that creates the AWS resources (sign-in, API, database, signing key, $1 budget alert). **Not deployed yet.**

**Checked:**
- 107 tests pass (55 new).
- Typecheck and build pass.
- The local server was tried with curl.

**Not checked:**
- Real AWS, real Cognito, real KMS. The AWS parts are tested only with stand-ins.
- The phone screens are not wired up to these modules yet.

---

## 26 Nov 2026: Foundation: shared contracts, API skeleton, test fixtures, CI (Omkar, task 02, branch `omkar/02-foundation`)

**In simple terms:** we set up the ground rules and safety checks so 4 people can build at once without breaking each other's work.
- **Shared contracts (`shared/`):** one place that defines the exact shape of everything that moves between parts of the system:
  - the content questions
  - the sync messages a phone sends to the school server, and the server's reply
  - the signing request (how a school "stamps" a transfer as genuine)
  - the trusted-keys list
  - the dashboard numbers
  - the audio pack list

  Venkat's existing types moved here unchanged, and his code still imports them from the same place.
- **Validators (`shared/guards.ts`):** small checks that say "this message is valid" or exactly why not. For example: no private key ever goes out in the trusted-keys list, a reading word can't be fully read aloud (that would give away the answer), and a dashboard query can't ask for more than 24 months.
- **Frozen examples (`fixtures/`):** for each contract, one good example and one bad example. A test checks that the good one passes and the bad one fails *for the right reason*. If anyone breaks a contract, the tests go red.
- **API skeleton (`api/`):** the start of the school server. It runs on AWS Lambda later, and on your laptop now with `npm run api:dev`. Today it only answers `GET /health`.
- **CI (`.github/workflows/ci.yml`):** GitHub now runs typecheck, tests and build on every pull request.
- **Setup guide (`docs/SETUP.md`):** how to run everything on a fresh laptop.

**This branch is built on Venkat's branch** (`venkat/teacher-workspace-transfer-dashboard`), because that's the app. Merge Venkat's PR first.

**Checked:**
- 52 tests pass (Venkat's 26 + 21 fixture tests + 5 API tests).
- Typecheck and build pass.
- `curl /health` → 200.

**Not done here:** branch protection on `main`. Omkar's account isn't a repo admin, so Sai needs to switch it on. The steps are in the PR.

---

## 26 Nov 2026: Reset prepared (Omkar, task 00, PR "Task 00: reset", branch `chore/rebuild-reset`)

**In simple terms:** the plan says to start the repo fresh. We prepared a pull request that removes all the old files (old skeleton app, submission PPT and mockups) and keeps only the plan.
- **Nothing is lost:** the old state is saved on the branch `backup/pre-rebuild-c5e808c`.
- **Not merged yet**, on purpose: judges may look at the repo during the 26–27 Nov pitch. Merge it after the pitch, then everyone rebases.

---

## 24 Nov 2026: Cover slide filled in (Omkar)

**In simple terms:** the PPT's first slide now shows our details.
- **Filled in:** team name **ContinuED**, college **Ramaiah Institute of Technology**, and full names with USNs: **Sai Sagar, team lead** (1MS24CI104), Omkar Tonne (1MS24CI086), Venkat Vaishnav (1MS24CI139), Ramith Nayak (1MS24CI098).
- **The footer** on slides 2–8 now says "Team Name: ContinuED".
- **Still blank:** the **Team ID**, on the cover and in the footer. Add it once we have it.
- **Checked:** slides 1, 2 and 4 were rendered in PowerPoint and looked at. Nothing is cut off, and the deck still has 8 slides.

---

## 24 Nov 2026: Cleaned up. Everything for today is in `submission/` (Omkar)

**In simple terms:** we moved the files we need for tonight's submission into **one folder, `submission/`**, and removed the working files (drafts, design sources, old copies) from this branch.
- `submission/ContinuED_Track4.pptx`: **the PPT** (8 slides)
- `submission/video_script.md`: the video script (one presenter: Venkat, about 4½ min)
- `submission/mockups/`: 4 screen pictures for the video
- `submission/sources.md`: where every number in the PPT comes from

The older entries below mention paths like `docs/pitch/...`. Those working files were removed from the branch, but they're still in the git history if we ever need them.

---

## 24 Nov 2026: Video script + deck fixes (Omkar, branch `omkar/stage0-deliverables`)

**What we made:** the video script, `docs/pitch/video/video_script.md`.
- **Length:** 4–4.5 minutes (611 spoken words), shared between Omkar, Saisagar, Venkat and Ramith.
- **Format:** each part says what's on screen (slide number or mockup) and exactly what to say.
- **Also included:** a recording checklist (OBS Studio or PowerPoint's Record, 1080p, YouTube Unlisted) and a "claims check" that links every fact in the script back to the slides.

**Fixes so the slides and script say the same thing:**
- **Slide 2** now says "23.4% of **rural** Std III children". ASER only surveys rural India.
- **Slide 3's MVP box** no longer says "fully offline". It now says the app works "with no server or internet once opened". Installing it for airplane mode (the PWA) is planned for hack day, and the slide 5 notes now say this too.
- **Renamed** the slide-5-only file to `OLD_slide5_only_NOT_the_full_deck.pptx`, because opening it made the deck look empty. **Use `docs/pitch/deck/ContinuED_Track4.pptx`.**

**Honesty rules for recording:** call the mockups a "design preview", call voice / camera / AWS / airplane mode "planned", and Raju is an example child.

---

## 24 Nov 2026: Full 8-slide pitch deck (Omkar, branch `omkar/stage0-deliverables`)

**What we made:** the complete deck in the official template: `docs/pitch/deck/ContinuED_Track4.pptx`. There are exactly 8 slides and no extras.
- **Slides:** cover, Problem, Solution, Tech Stack, Architecture, Novelty (comparison table), Impact & Feasibility, Business Model.
- **Previews:** images of each slide are in `docs/pitch/deck/render/`.
- **Slide text:** all of it is in `docs/pitch/deck/slide_content.md`.

**Where the numbers come from:** every statistic on the slides comes from a source we actually opened. They're listed with exact quotes and links in `docs/pitch/research/verified_facts.md`. The two headline stats were checked twice:
- UNESCO GEM 2019: ~80% of temporary migrant children in 7 cities had no school near work sites.
- ASER 2024: 23.4% of Std III children can read a Std II text, and 33.7% can do subtraction.

We dropped the popular "10.7 million children" figure because nobody could verify it.

**Still to do before submitting:**
- Fill the `[FILL]` boxes on the cover: team name, college, Team ID, USNs.
- Fill the footer "Team Name / Team ID" (on every slide).
- Rename the file to `TeamName_Track4`.
- If the deck is moved to Google Slides, check the ✓/✗ marks and the Marathi/Kannada words.

**How it was checked:** every slide was rendered in PowerPoint and looked at. Nothing is cut off or overlapping, and there are exactly 8 slides.

---

## 24 Nov 2026: Stage 0 pitch material (Omkar, branch `omkar/stage0-deliverables`)

**What we made**
- **Architecture diagram** (`docs/pitch/architecture.png`): one picture for slide 5. Top row: the 5 steps (check → seal → carry → scan → teach). Middle: what runs on each teacher's phone. Bottom (dashed): the cloud parts we'll add later (ElevenLabs voice, AWS, the dashboard). Solid boxes = core MVP. Dashed boxes = planned.
- **Slide 5 text** (`docs/pitch/slide5_architecture.md`): title, bullets, block labels and a 30-second script for the slide.
- **Slide 5, ready-made** (now renamed `docs/pitch/OLD_slide5_only_NOT_the_full_deck.pptx`; use the full deck instead): the official template with **only slide 5 filled in** (diagram + a one-line subtitle). The other 7 slides are untouched and there are still exactly 8 slides. Open it, copy slide 5, and paste it into our shared Google Slides deck. *Checked:* slide count, other slides unchanged, nothing overlapping. *Not checked:* how it looks after pasting into Google Slides. The smallest grey labels in the diagram are hard to read at slide size.
- **Screen mockups** (`docs/pitch/mockups/`): 4 phone-screen pictures for the video (Create, sealed QR code, Scan result, Start Here Tomorrow). Each one is marked **"Design preview"**, because the real screens are built on 25 Nov.

**Why:** tonight's submission needs a PPT and a 3–5 min video that explains the idea and shows a prototype walkthrough. The working app comes next, so for now these images show what it will look like.

**What did NOT change:** no app code. The `src/` folder is untouched on this branch.

---

## 24 Nov 2026: Skeleton app (Omkar, commit `6df7976` on `main`)

**In simple terms:** we set up the empty "house" for the app. The rooms and the agreements are in place, but the furniture isn't in yet.

**What's in it**
- **Project setup:** a React + TypeScript website project (Vite) with Tailwind for styling. `npm install` → `npm run dev` opens it.
- **The skill list:** the 8 basic skills and which one comes before which (for example, you need addition before subtraction with borrowing). File: `src/data/competencyGraph.ts`.
- **Shared agreements ("contracts"):** the exact names and shapes everyone codes against, so 4 people can work at the same time without breaking each other's work:
  - what a "capsule" contains (ID, age, language, date, skill marks): `src/types/capsule.ts`
  - the 3 languages (English, Marathi, Kannada): `src/types/language.ts`
  - every on-screen text label (45 of them): `src/locales/types.ts`
- **Placeholders**, each one marked with its owner:
  - **Language files** say "TODO" (Ramith fills them).
  - **Create and Scan screens** show "coming soon" (Saisagar and Venkat).
  - **The QR packing/sealing and the "where is the child stuck" logic** say "not implemented" (Omkar, 25 Nov).
- **Theme:** all colours defined in one place (`src/index.css`), so the look can be changed later without touching the logic.
- **Safety:** `.env` (secret keys) is never uploaded to GitHub.
- **Team plan:** `docs/ContinuED_TEAM_PLAN.md` covers who does what, when, and the exact prompts for our coding agents.

**What works right now:** the app opens and shows the two tabs. Nothing else yet. That's expected.
