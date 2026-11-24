# What we built: a plain-English log

A running diary of what's in this repo, written so anyone (teammates, judges, future us) can follow it without reading code. **Add a new entry at the top every time you merge something.**

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
