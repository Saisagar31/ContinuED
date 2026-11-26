# ContinuED first-release brief

**Owner:** Sai Sagar. **Status:** working brief for a paper walkthrough with an origin teacher, a receiving teacher, and a school decision maker. The journeys and cases below are proposed acceptance examples, not evidence that a teacher or school has approved them. Use synthetic learners until the school authorizes a pilot.

## Outcome and release boundary

An origin teacher records a short, evidence-based reading and maths assessment in the learner's strongest language. A receiving teacher can open the transfer offline, understand the evidence in their own interface language, and choose an activity for the next class. With school services configured, authorized staff can sync records and read aggregate trends.

The first release includes a local roster and draft history; dynamic questions, pause/resume, skips and teacher-confirmed status; a bounded QR or printable transfer; offline receive by camera, image or pasted code; a prerequisite-based teaching plan; and optional authenticated sync, signing, trends and reviewed audio packs. English, Marathi, Kannada, Hindi, Telugu, Tamil and Malayalam have draft content. **No language pack, rubric, adaptation rule, voice, or classroom flow is approved for real learners yet.**

## Paper walkthroughs to conduct

| Journey | Steps to act out with paper and two teacher roles | Acceptance example |
| --- | --- | --- |
| Origin teacher | Choose a pseudonymous learner and assessment language; present a question; record an independent answer, a prompted answer and a skip; pause; resume; confirm statuses; give the transfer slip to the agreed holder. | Resume shows the exact pending question. A skip does not become failure or mastery. The slip contains no local nickname. |
| Receiving teacher | Work offline with an interface language different from the assessment language; scan or paste the slip; inspect trust state and evidence; hear an oral check where a reviewed recording exists; choose one 15-minute activity. | The status and skill IDs are unchanged by interface language. The teacher can explain why the activity was suggested. Damaged and unknown-key slips have distinct outcomes. |
| Shared phone | Teacher A pauses a draft and signs out. Teacher B signs in and searches the roster. Teacher A returns and completes the draft. | B cannot open A's local learners, sessions or received transfers through the app. The school decides whether app-level separation is sufficient on a shared device. |
| School lead | Sync synthetic records from two schools, retry an event, open the trends view and inspect last-sync time. | Counts are not doubled and a lead sees only authorized aggregates. Small-cohort suppression awaits a school rule. |

During the walkthrough, record who physically keeps the slip, whether teachers share phones, typical offline duration, browser and device models, the next-day activity they need, friction, and the teacher's own wording for trust and mastery. Record participant role and consent; do not enter real learner data into notes or screenshots.

## Review assignments

| Area | Accountable owner | Required reviewer or decision maker | State |
| --- | --- | --- | --- |
| Teacher journeys, first-release scope, acceptance cases | Sai | Origin and receiving teachers | Awaiting walkthrough |
| Assessment adaptation, stopping and mastery rubric | Sai | Educators designated by the pilot school | Draft code; classroom approval pending |
| Workspace, transfer and phone usability | Sai with Venkat | Both teacher roles on target phones | Browser prototype built; device walkthrough pending |
| Seven content and pronunciation reviews | Ramith coordinates | One named native classroom reviewer per language | Reviewer names and verdicts pending; sheets in `docs/review/` |
| School policy, privacy, retention and pilot permission | Sai coordinates | School lead or delegated data owner | Decision pending |
| Staging and production technical readiness | Omkar | Sai accepts teacher experience | No release candidate or deployment evidence yet |

## Decisions to close before a real pilot

| Decision and owner | Provisional engineering assumption | Approval and acceptance example needed |
| --- | --- | --- |
| Record ownership and access — Sai obtains school decision | One school owns its issued record; local workspaces are scoped by teacher. | School names authorized roles and cross-school transfer permissions; two-school isolation test passes. |
| Slip custody and retention — Sai with both teachers | Whoever holds a QR or text code can read its summary; the app stores the received summary locally. | Teachers agree who holds and may retain a slip, and how a lost slip is handled. |
| Local storage and shared devices — Sai with school data owner | IndexedDB holds drafts and history. Local PIN profiles isolate app views, but data is **not encrypted at rest**. | School approves this policy or requires managed/encrypted devices before real data. A sign-out and device-loss drill passes. |
| Server retention, deletion and backup — Sai obtains school decision; Omkar implements | No school-specific retention period has been approved. | Written period and deletion/restore expectations; staging deletion and backup-restore evidence. |
| Meaning of “verified” and key freshness — Sai with school lead | A server-signed slip can be verified against a provisioned public key; an offline-created slip is labeled unverified. | School approves issuer enrollment, key expiry, rotation and stale-revocation wording. |
| Small-cohort suppression — Sai with school data owner | No threshold should be claimed as approved. | Written threshold and scope; API tests show suppressed counts for small groups. |
| Devices, offline duration and audio budget — Sai with teachers, Ramith and Omkar | Content and audio packs are bounded; missing reviewed audio leaves readable text. | Target phone/browser list, maximum offline interval, storage budget and measured seven-language clip costs. |
| Handoff time target — Sai with both teachers | No time target has been agreed. | Teachers choose a target; timed, uncoached walkthrough meets it. |

## Release acceptance cases

1. Two synthetic learners with different responses receive different follow-ups. Reassessment avoids earlier shown questions, and pause/resume restores the same pending item.
2. The teacher explicitly confirms every reported skill status. A single answer, a skip, a timeout, or missing audio never assigns mastery silently.
3. An origin-language assessment opens offline on a second phone in another interface language. The receiving plan identifies its supporting observation, prerequisite and two activities.
4. Each shipped audio-enabled item maps to the exact reviewed recording for its content version. Reading stimuli are not spoken as answers; a missing recording has a visible text fallback.
5. School services reject unauthorized cross-school access. Retried sync events count once; the dashboard reports coverage and last-sync time under the approved suppression rule.
6. The exact release candidate passes CI, a signed language/device matrix, backup and rollback drills, and a synthetic two-phone production smoke test before Sai records acceptance.

The first four cases have partial automated coverage in this repository. Human, device, audio-account, staging and school-approval evidence remains open in `PILOT_RELEASE_RECORD.md`.
