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

## Project status

The reset and integrated app are on `main`. The dynamic assessment engine, teacher workspace, transfer flow, school API and dashboard have automated coverage. Content and rubrics are still drafts; no reviewed audio packs, staging pilot or production release have been recorded. See the [task status](docs/PLAN_STATUS.md), [first-release brief](docs/PRODUCT_BRIEF.md) and [pilot evidence record](docs/PILOT_RELEASE_RECORD.md) for the remaining approvals and tests.

What changed and why is explained in plain English in [`docs/WHAT_WE_BUILT.md`](docs/WHAT_WE_BUILT.md).

## Team
Sai Sagar (lead) · Omkar Tonne · Venkat Vaishnav · Ramith Nayak, Ramaiah Institute of Technology
