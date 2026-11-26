# Venkat's slices of the ContinuED plan — status

Venkat is named on tasks **03, 07, 08, 12** (and 14, the pilot, which needs a staging release first).
This build covers the code side of 03/07/08/12 as a React + TypeScript + Vite PWA. Everything uses
**synthetic learners and sample content** — no real learner data.

## Run it

```powershell
npm install
npm run dev     # http://localhost:5173 (use a phone-sized window)
npm test        # 26 unit tests
npm run build   # typecheck + production bundle with offline app shell
```

## What exists, by task

| Task | Built | Where | Still open (owner) |
| --- | --- | --- | --- |
| **03** Prototype screens | Sign-in/profile switch, roster + search, resume drafts, assessment, result review, transfer slip, receive (scan / photo / paste), receiving plan, groups, dashboard. Teacher-language and learner-language controls are separate. Loading, empty, failure, offline and draft-translation states. Focus moves to main on navigation; 44px+ touch targets; dark mode; print CSS. | `src/screens/*`, `src/App.tsx`, `src/styles.css` | Walkthrough with real teachers ("without coaching"), friction log (Sai + Venkat) |
| **07** Teacher workspace | IndexedDB workspace scoped per teacher; local profiles with PIN on a shared phone; learners with random pseudonymous IDs; teacher-local nickname never leaves the device; history; progress comparison between last two assessments; atomic answer-commit + cursor advance; item persisted before display so restart resumes the same question; reassessment linked to predecessor; delete learner (cascade) and delete whole workspace; print layout. | `src/store/db.ts` (+ tests) | Device policy decision (task 01): app-level isolation today, **not encryption at rest**. Cognito sign-in replaces PIN profiles (task 11). |
| **08** Transfer | Versioned capsule `CED1.<payload>.<sig>.<check>` (deflate + base64url, ~200 chars for 2 skills); bounded schema validation; ECDSA P-256 signature verification against provisioned public keys; QR generation; print; camera scan with lifecycle (stops on cancel / tab hidden / unmount) and denied / no-camera / insecure-context states; photo upload decode; paste with whitespace tolerance; localized destination plan. Distinct outcomes: `malformed`, `wrong_version`, `damaged`, and trust `verified / unverified / unknown_key / expired_key / revoked_key / altered`. | `src/transfer/*`, `src/plan/plan.ts`, `Receive.tsx`, `PlanScreen.tsx`, `TransferSlip.tsx` | Server signing + key distribution (task 11). Two-phone offline test, printed-QR scan distance/contrast on target phones (needs the two test phones). Educator approval of plan tie rule (task 04). |
| **12** Dashboard | Corridors, skills needing support, by-month; filters (dates, district, origin language); as-of time + coverage; offline cached view; empty and unavailable states; small-cohort suppression (`<5`); retried events counted once. `AggregateSource` interface is the contract the sync API should meet. | `src/dashboard/aggregates.ts`, `Dashboard.tsx` | Real sync API + server-side permissions (task 11); school-approved suppression rule (task 01). Currently a synthetic fixture source. |

## Placeholders other owners replace

- `src/assess/stubEngine.ts` — **stub** adaptive selection so the journey works end to end. Task 06 (Sai) replaces `nextItem` / `suggestStatus` behind the same signatures.
- `src/content/skills.ts` — sample skill map and activities (`sample-0.1`). Task 04 (Ramith + educators).
- `src/content/i18n.ts` — English complete; Hindi and Marathi have a **small unreviewed draft** set (statuses, skill names, two headings) so native-script rendering can be checked; other languages fall back to English with a visible banner. Task 09 owns reviewed packs.
- Audio: plan screen shows an explicit "no reviewed pack installed" state; device speech only for English. Task 10.
- `src/domain/types.ts` — shared types; move into Omkar's shared-types package when task 02 lands.

## Verified in this build

- 26 unit tests: codec round-trip, paste tolerance, signature verify, wrong version / malformed / damaged / altered, unknown / revoked / expired keys, plan states and prerequisite walk, workspace isolation between two teachers, exact resume after restart, reassessment linking, deletion, stub engine path divergence and arithmetic validity, aggregate dedupe / suppression / independent totals.
- In the browser at 375×812: created profile → added learner → answered 3 items → reloaded → signed in → resumed on the **same** question → finished → confirmed statuses (blocked until every skill confirmed) → slip with QR → QR pixels decode back to the exact code → truncated code rejected as damaged → full code opens the plan → interface switched to Hindi without changing the recommendation → dashboard and groups render.

## Not verified

- Real phones, real camera scanning, printed slips, Airplane-mode two-phone test.
- Service worker offline reopen (only registered in production builds; run `npm run build && npm run preview`).
- Screen-reader pass and large-text testing on target devices.
