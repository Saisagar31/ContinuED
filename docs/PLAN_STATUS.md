# Execution plan status

Updated 26 Nov 2026 against `PROJECT_EXECUTION_PLAN.md`. The reset and integrated application code are on `main`; the earlier PR merge order is complete. **Code passing CI is not a classroom approval, an installed audio pack, a staging deployment or a production release.**

| ID | Owner | Repository state | Remaining acceptance evidence |
| --- | --- | --- | --- |
| 00 | Omkar; Sai coordinates | Reset and backup history retained; application work restored on `main` | None for the Git reset |
| 01 | Sai + team | First-release brief, proposed journeys, review assignments and decision log in `PRODUCT_BRIEF.md` | Paper walkthrough with both teacher roles; school privacy and device decisions |
| 02 | Omkar; Sai administers repo | App/API skeleton, fixtures, lockfile, setup and CI on `main` | GitHub branch protection is managed outside source; verify required review and `check` status in repository settings |
| 03 | Sai + Venkat | Phone-sized teacher flows implemented | Uncoached teacher walkthrough and logged revisions on target phones |
| 04 | Ramith + educators | Draft skill map, rubrics and content generators | Educator approval of graph, mastery and stopping rules |
| 05 | Ramith + Omkar | Audio tooling and cloud templates | Project accounts, MFA/budgets, seven voice samples, actual costs and account capability checks |
| 06 | Sai | Dynamic engine, exposure, alternate, pause/resume, evidence and review implemented; automated checks pass | Educator pilot of adaptation/stopping rules; real-phone assessment walkthrough |
| 07 | Sai + Venkat | Local teacher-scoped roster, drafts, history, switching and deletion implemented | School shared-device policy; uncoached two-teacher phone test |
| 08 | Omkar + Venkat | Capsule, QR, camera/image/paste and plan implemented | Offline two-phone and printed-QR tests; school trust policy |
| 09 | Ramith + seven reviewers | Seven draft content/UI packs and review sheets | Named native classroom approval, corrections and cross-language device evidence |
| 10 | Ramith + Omkar | Audio catalog, generation job, download manager and playback implemented | Account-backed generation, listening review, published packs, measured bytes/credits |
| 11 | Omkar + Ramith | Authenticated API, signing, sync and aggregates implemented | Staging deploy, two-tenant authorization, key/device/backup drills and school retention policy |
| 12 | Venkat + Ramith | Trends dashboard wired to API | Known-data staging comparison and school-approved small-cohort rule |
| 13 | Omkar; Sai connects hosting | Deploy and rollback runbook exists | Cloudflare account/repository connection, staging install and recovery drills |
| 14 | Sai + Venkat + reviewers | `PILOT_RELEASE_RECORD.md` defines the evidence matrix | Exact-candidate classroom pilot, seven reviews, device results and sign-offs |
| 15 | Omkar deploys; Sai accepts | Release decision template exists | Production promotion only after 14 and all release gates; live two-phone smoke test |

## Omkar's remaining work (updated 26 Nov 2026)

All of Omkar's code is merged on `main`. What's left needs accounts, devices or the pilot. Account setup is requested in issue #18.

| Task | Omkar still has to | Blocked on |
| --- | --- | --- |
| 05 | Help Ramith set up the AWS and ElevenLabs accounts (MFA, region, realistic budget, deploy access for Omkar). Run the voice sample per language (`scripts/audio/build.ts --sample`) and record bytes, credits and listening verdicts. | Ramith creating the accounts (#18) |
| 13 | Deploy staging (AWS stack + Cloudflare Pages), set the Cognito callback and CORS URLs, then run the three drills: bad app rollout, failed audio-pack update, DynamoDB restore into a new table. | AWS account; Sai connecting Cloudflare (#18) |
| 11 | On staging: two test schools stay isolated, replay and partial acknowledgement keep counts correct, expired login requires re-sign-in, key rotation, device loss and backup restore. Decide the real budget (the KMS key alone is billed monthly). | Staging deploy |
| 10 | Generate the seven voice packs from approved content, get listening reviews (`scripts/audio/review.ts`), publish versioned packs, and record actual bytes and credits. | ElevenLabs account; approved content (task 09) |
| 08 | With Venkat: two-phone offline transfer test and a printed-QR scan test, then verified issuance using staging signing keys. | Two phones; staging |
| 15 | Promote the exact tested release to production, run the live two-phone smoke test and fill in the release record. | Task 14 pilot sign-off |

The local prototype uses synthetic learners and draft content. Do not use it for real learner records until the school approves the pilot and the applicable privacy, content, trust and device decisions. See `PRODUCT_BRIEF.md` for decision owners and `PILOT_RELEASE_RECORD.md` for the evidence still needed.
