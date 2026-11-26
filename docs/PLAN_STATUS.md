# Execution plan status (26 Nov 2026)

Where each task in [`PROJECT_EXECUTION_PLAN.md`](PROJECT_EXECUTION_PLAN.md) stands. **"Code done" means built and tested in CI, not deployed or piloted.** Nothing below is merged into `main` yet.

## Status by task

| ID | Task | Code | PR | What is still open, and who |
|---|---|---|---|---|
| 00 | Reset the repo | ✅ ready | #3 | **Merge after the 26–27 Nov pitch** (Omkar or Sai). Then everyone rebases. |
| 01 | Product walkthrough | — | — | **Sai + whole team, with real teachers:** <ul><li>paper walkthrough</li><li>record decisions (owner, retention, revocation, device policy, "verified", suppression rule)</li></ul> |
| 02 | Foundation, contracts, CI | ✅ | #4 | **Sai (repo admin):** turn on branch protection for `main` (1 approval + the `check` status). |
| 03 | Prototype screens | ✅ | Venkat's branch | **Sai + Venkat:** a walkthrough "without coaching" with teachers; log the friction. |
| 04 | Skill map, questions, rubric | ✅ drafts | #9 | **Ramith + educators:** approve the graph, rubric, stopping rules and activities (list in `CONTENT_REVIEW.md`). |
| 05 | Accounts and samples | tooling ✅ | #6 | **Ramith + Omkar:**<ul><li>create the AWS, ElevenLabs and Cloudflare accounts, with MFA and budgets</li><li>run `scripts/audio/build.ts --sample` in all 7 languages and listen to the results</li><li>record bytes and credits</li></ul> |
| 06 | Assessment engine | ✅ | #10 | **Sai:** review as the owner. **Educators:** pilot the adaptation and stopping rules. |
| 07 | Teacher workspace | ✅ | Venkat's branch | Device-policy decision (task 01): local data is not encrypted at rest. |
| 08 | Transfer, QR, plan | ✅ + school signing wired | Venkat's branch, integration PR | **Two real phones:** offline open, printed-QR distance and contrast. |
| 09 | Seven language packs | ✅ drafts (303 strings + content per language) | #9, #10, integration PR | **Seven native reviewers:** the sheets are in `docs/review/*.csv`, and `CONTENT_REVIEW.md` has the steps. |
| 10 | Audio pipeline and packs | ✅ pipeline, packs screen, playback | #6, #11, integration PR | **Needs accounts (05):**<ul><li>generate approved clips</li><li>listening review</li><li>publish packs</li><li>set `VITE_AUDIO_BASE_URL`</li></ul> |
| 11 | School services | ✅ API, sign-in, sync, signing (wired) | #7, #12, integration PR | **Never run on real AWS:** `sam deploy` to staging, then the drills in `DEPLOY.md`. |
| 12 | Trends dashboard | ✅ wired to the API | Venkat's branch, integration PR | Real data after 11 is deployed; school-approved suppression rule (01). |
| 13 | Staging and rollback | runbook ✅ | #8 | **Nothing deployed.**<ul><li>Sai connects Cloudflare Pages.</li><li>Omkar deploys staging.</li><li>Rehearse the 3 drills.</li></ul> |
| 14 | Classroom pilot and device matrix | — | — | After 13: run section 5 of the plan on the staging release candidate. |
| 15 | Production | — | — | After 14: promote, smoke-test with two phones, write the release record. |

## Merge order

All of these are stacked, so merge from the bottom up:
1. Venkat's branch (`venkat/teacher-workspace-transfer-dashboard`) → #4.
2. #6 and #7. They are independent.
3. #8 and #12, both on #7.
4. #9, then #10.
5. #11 (after #6 and #10).
6. The integration PR (`ramith/integration`). It only adds the wiring once the others are in.
7. #3, the reset. **After the pitch only.** Because it deletes everything on `main`, merge it *before* step 1 instead if the team wants `main` to contain only the new app. Then rebase the stack onto it.

## Configuration (all optional; empty = feature off, app works offline)

| Variable | Turns on |
|---|---|
| `VITE_API_URL`, `VITE_COGNITO_REGION`, `VITE_COGNITO_CLIENT_ID` | School sign-in, sync, signed transfers, real trends |
| `VITE_AUDIO_BASE_URL` | Audio pack downloads (`<base>/<lang>/manifest.json`) |
