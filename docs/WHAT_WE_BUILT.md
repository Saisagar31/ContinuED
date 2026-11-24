# What we built: a plain-English log

A running diary of what's in this repo, written so anyone (teammates, judges, future us) can follow it without reading code. **Add a new entry at the top every time you merge something.**

---

## 24 Nov 2026: Stage 0 pitch material (Omkar, branch `omkar/stage0-deliverables`)

**What we made**
- **Architecture diagram** (`docs/pitch/architecture.png`): one picture for slide 5. Top row: the 5 steps (check → seal → carry → scan → teach). Middle: what runs on each teacher's phone. Bottom (dashed): the cloud parts we'll add later (ElevenLabs voice, AWS, the dashboard). Solid boxes = core MVP. Dashed boxes = planned.
- **Slide 5 text** (`docs/pitch/slide5_architecture.md`): title, bullets, block labels and a 30-second script for the slide.
- **Slide 5, ready-made** (`docs/pitch/ContinuED_slide5_filled.pptx`): the official template with **only slide 5 filled in** (diagram + a one-line subtitle). The other 7 slides are untouched and there are still exactly 8 slides. Open it, copy slide 5, and paste it into our shared Google Slides deck. *Checked:* slide count, other slides unchanged, nothing overlapping. *Not checked:* how it looks after pasting into Google Slides. The smallest grey labels in the diagram are hard to read at slide size.
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
