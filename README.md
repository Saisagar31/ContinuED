# ContinuED

**Learning that travels with the child.** wHACKiest 2026 · Track 04 (UnlockED)

> 🚧 **Work in progress.** We're rebuilding to [`docs/PROJECT_EXECUTION_PLAN.md`](docs/PROJECT_EXECUTION_PLAN.md). Everything uses **synthetic learners and sample content**. Nothing is educator-approved or piloted yet.

## What it does
1. **Assess:** the origin teacher assesses a learner on foundational reading and maths skills, in the learner's language.
2. **Transfer:** the result travels as a QR code or printed slip (`CED1.…`). It holds a pseudonymous ID, never a name.
3. **Receive:** the destination teacher opens it **offline**, in their own language, and gets a lesson plan for tomorrow.
4. **Sync and see trends** *(in progress)*: schools sync de-identified records when they're online, and leads see aggregate transfer and skill trends.

## Run it
See [`docs/SETUP.md`](docs/SETUP.md). In short: `npm ci`, then `npm run dev` (app), `npm run api:dev` (API) and `npm test`.

## Status by task (plan section 4)
| Task | Owner | Status |
|---|---|---|
| 00 Reset | Omkar | PR ready. Merging waits until after the pitch. |
| 02 Foundation, CI, contracts | Omkar | This branch |
| 03 / 07 / 08 / 12 App screens, workspace, transfer, dashboard | Venkat (+ Sai, Omkar) | Built with sample data. Needs device testing. |
| 04 / 09 Content and 7 language packs | Ramith + educators + reviewers | Sample content only |
| 05 / 10 Accounts, ElevenLabs audio | Ramith + Omkar | Not started. Needs project accounts. |
| 06 Assessment engine | Sai | Stub engine in place |
| 11 School services | Omkar + Ramith | In progress |
| 13–15 Staging, pilot, production | Team | Not started |

What changed and why is explained in plain English in [`docs/WHAT_WE_BUILT.md`](docs/WHAT_WE_BUILT.md).

## Team
Sai Sagar (lead) · Omkar Tonne · Venkat Vaishnav · Ramith Nayak, Ramaiah Institute of Technology
