# Pilot and release evidence record

**Owner:** Sai Sagar for teacher experience; Omkar for technical readiness. **State:** preparation only. No classroom pilot, physical two-phone test, staging deployment, account review, or production acceptance has been recorded. Do not mark a row passed without the named reviewer and evidence link.

## Candidate identity

| Field | Recorded value |
| --- | --- |
| Candidate commit and build artifact hash | Pending exact staging candidate |
| Staging URL, API version and school test tenants | Pending Omkar deployment |
| Content/rubric version and seven audio pack hashes | Pending approved packs |
| Device A and B make, OS, browser, app install mode | Pending target-phone inventory |
| Origin and receiving teacher reviewers | Pending school nomination |
| Support contact, backup reference and rollback target | Pending school and Omkar |

Use only synthetic learner IDs and approved test accounts. Capture screenshots without names or credentials. For every failed step, record severity, reproduction steps, owner, fix commit, and the result of rerunning the same journey on the same candidate or a new identified candidate.

## Task 03: uncoached teacher walkthrough

1. Give each teacher only the role goal from `PRODUCT_BRIEF.md`. Observe without coaching; record where they hesitate, what they expect, task time, and whether the next action is clear.
2. Origin teacher: find a synthetic learner, choose assessment language, record independent/prompted/skipped responses, pause, resume, review mastery, and show or print a slip.
3. Receiving teacher: with a different interface language, scan the slip or use image/paste fallback, inspect evidence and trust wording, and choose tomorrow's activity.
4. Repeat with large text, screen reader, keyboard/focus order and a denied camera. Check loading, empty, failure and offline states.

| Role | Reviewer | Device/browser | Time and friction log | Result and sign-off |
| --- | --- | --- | --- | --- |
| Origin teacher | Pending | Pending | Pending | Pending |
| Receiving teacher | Pending | Pending | Pending | Pending |

## Task 14: exact staging candidate on two phones

| Check | Expected evidence | Result |
| --- | --- | --- |
| Fresh install and pack download | App/content versions, seven approved audio manifest hashes, storage bytes and offline reopen on both phones | Pending |
| Dynamic assessment and reassessment | Two learner paths, one skip, alternate item, pause/restart, exact restored item, distinct prior exposure | Pending |
| Offline handoff | Phone A creates and prints/displays a slip; Phone B opens it in Airplane Mode by camera and image/paste fallback | Pending |
| Trust and malformed input | Unsigned, signed, altered, unknown-key, expired-key and wrong-version outcomes are distinct and understood | Pending |
| Cross-language plan | Each of seven assessment languages opens in another interface language; skill/status mapping and two activities match | Pending |
| Audio safety | Reviewed clip matches exact text; reading target is never spoken; missing clip shows text; no lost observations | Pending |
| Shared phone and data recovery | Teacher B cannot see A's workspace after sign-out; unfinished draft and unsynced event survive reopen/upgrade | Pending |
| Sync and trends | Two tenants isolated; retry/partial acknowledgement count once; suppressed small cohorts and last-sync time match policy | Pending |
| Accessibility and print | Native-script wrapping, large text, touch targets, focus order, camera cancellation, QR distance and contrast | Pending |
| Recovery drills | Bad app rollout, interrupted pack update and backend restore recover the previous working state | Pending |

For each of the seven languages, name the native classroom reviewer, record content and pronunciation verdicts, corrections, device screenshot, and one receiving-teacher walkthrough. The review sheets in `docs/review/` are drafts; blank approval cells are not a pass. Record all 49 origin/interface language combinations from the automated check separately from the human evidence.

| Language | Reviewer | Content approval | Pronunciation and bytes/credits | Phone and cross-language evidence |
| --- | --- | --- | --- | --- |
| English | Pending | Pending | Pending | Pending |
| Marathi | Pending | Pending | Pending | Pending |
| Kannada | Pending | Pending | Pending | Pending |
| Hindi | Pending | Pending | Pending | Pending |
| Telugu | Pending | Pending | Pending | Pending |
| Tamil | Pending | Pending | Pending | Pending |
| Malayalam | Pending | Pending | Pending | Pending |

## Task 15: release decision

**Sai's teacher-experience acceptance:** Pending. **Omkar's technical-readiness sign-off:** Pending. The release must stay unaccepted until the pilot rows above, school privacy decisions, seven content/audio reviews, authorization checks, backup restore and rollback rehearsal are recorded for one exact candidate.

| Production field | Value |
| --- | --- |
| Production URL and release commit | Pending |
| App, API, content and active pack versions | Pending |
| Two-phone synthetic smoke test and API/sync monitoring | Pending |
| Backup reference and compatible rollback target | Pending |
| Known limitations and support contact | Pending |
| Release decision, date, Sai and Omkar sign-off | Pending |

If a candidate loses assessments, leaks another school's data, breaks offline transfers or misstates learning results, stop rollout and follow `DEPLOY.md`. Preserve unsynced local work and document any forward data repair.
