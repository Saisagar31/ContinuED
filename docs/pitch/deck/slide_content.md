# ContinuED deck: FINAL content for the build agent
Use this text EXACTLY as written. Don't add facts or numbers. Keep `[FILL: …]` markers visible (the team fills them later).
Each content slide keeps the template's title; replace the subtitle with the given subtitle; remove the template's "INCLUDE:" box and instruction bullets; then lay out the content below. Each "Sources:" line goes at the bottom of the content area in small (9–10 pt) grey text.

---
## SLIDE 1: Cover (fill the existing fields; don't remove any)
TEAM NAME: [FILL: Team name]
COLLEGE NAME: [FILL: College name]
TRACK: Track 04 – UnlockED
TEAM ID: [FILL: Team ID]
Member 1 (Lead): Omkar | USN: [FILL]
Member 2: Saisagar | USN: [FILL]
Member 3: Venkat | USN: [FILL]
Member 4: Ramith | USN: [FILL]
Add one text box where it fits without overlap (e.g. right side or under the title): **ContinuED** (bold, large, brand purple #5b2a9a) and below it "A learning passport that travels with the child".

---
## SLIDE 2: Problem Statement
Subtitle: When a migrant child changes school, their learning history doesn't travel with them.
LEFT column (bullets):
- **The problem:** the child arrives at a new school, often in a new state and language, with no record of what they can do.
- **Who it affects:** children of migrant families. 39.2% of the 19.64 million people who migrated into Maharashtra in 2001–10 were children.
- **Why it matters:** about 80% of temporary migrant children in seven Indian cities lacked access to education near work sites.
- **Weak foundations:** only 23.4% of Std III children can read a Std II text; 33.7% can do subtraction (ASER 2024).
- **The result:** the new teacher guesses or restarts from zero → wrong level → the child falls further behind.
RIGHT column, box titled "Existing solutions & their gaps":
- **Transfer certificate:** by law, admission can't wait for it (RTE Act, Sec. 5), so a child can be admitted with no learning record at all.
- **APAAR ID / DigiLocker:** stores IDs, records and credentials online; it doesn't say which skill to teach next.
- **Maharashtra Education Guarantee Card (2015 pilot):** recorded competencies, but children still lacked schools near work sites.
Sources: CPR & UNICEF India (2021), citing Census 2011 · UNESCO GEM Report 2019 · ASER 2024 via PIB (2025) · RTE Act 2009 s.5 · Ministry of Education APAAR brochure (2024) & PIB (2026)

---
## SLIDE 3: Proposed Solution
Subtitle: ContinuED, an offline "learning passport" in a QR code.
TOP line (bold, larger): The old teacher's skill check travels with the child, and the new teacher resumes in their own language.
LEFT, "Key features":
- 8 foundational reading & maths skills, marked in minutes
- Sealed QR code of ~140 characters: no name, no internet
- Opens in the new teacher's language (English · मराठी · ಕನ್ನಡ)
- Finds the root skill gap + a "Start Here Tomorrow" 15-minute plan
- Oral check in the child's mother tongue (voice)
RIGHT, "User flow" (5 small boxes with arrows, or a numbered list): ① Check → ② Seal → ③ Carry (paper/phone) → ④ Scan (offline) → ⑤ Teach
BOTTOM box, "What we'll build in 24 hours (MVP)": create + seal + scan + root gap + plan in 3 languages, fully offline. Hack day adds: camera scanner, ElevenLabs voice, AWS dashboard.

---
## SLIDE 4: Tech Stack
Subtitle: A ₹0, offline-first stack built for low-connectivity schools.
TABLE (3 columns: Layer | Tool | Why we picked it):
- Frontend | React + TypeScript + Vite, Tailwind CSS | Fast to build, typed, runs in any phone browser
- Offline | Progressive Web App (service worker) | Works in airplane mode after first load
- Transfer | QR code (qrcode.react) + lz-string compression | Works on paper, no internet, no app install
- Integrity | Web Crypto HMAC-SHA256 seal | Detects edited marks (tamper-evident)
- Languages | Bundled language packs (EN, MR, KN) | The teacher reads the child's data in their own language
- Voice AI | ElevenLabs text-to-speech, clips cached offline | Natural mother-tongue voice for the child's oral check
- Storage | IndexedDB (on the phone) | Keeps the class roster and sync queue offline
- Cloud | AWS Lambda + DynamoDB (free tier) | Anonymous sync → district dashboard at ₹0

---
## SLIDE 5: Process Flow / Architecture
COPY slide 5 exactly from g:\whackiest hackathon\ContinuED\docs\pitch\ContinuED_slide5_filled.pptx (image + subtitle). Don't change it.

---
## SLIDE 6: Novelty / Innovation
Subtitle: A skill-level handover that works offline, in any teacher's language.
TOP, 3 short USP lines (bold lead-in):
- **Tells the teacher what to teach tomorrow,** not just marks or certificates
- **New combination:** prerequisite skill graph + sealed offline QR + mother-tongue voice
- **Privacy by design:** zero personal data in the QR, only a pseudonymous ID
TABLE (5 columns: Feature | ContinuED | APAAR ID / DigiLocker | Transfer certificate | Guarantee Card (Maharashtra)):
- Works with no internet | ✔ | Digital (DigiLocker) | ✔ Paper | Card-based
- Skill-level detail (FLN) | ✔ 8 skills | Records & credentials | ✘ | ✔ Competencies
- In the new teacher's language | ✔ | — | ✘ | —
- "What to teach tomorrow" plan | ✔ | ✘ | ✘ | ✘
- No personal data in transfer | ✔ | ✘ ID-linked | ✘ Named | —
- Works across states | ✔ | ✔ | ✔ | —
Sources: Ministry of Education APAAR brochure (2024) · PIB (2026) · CPR & UNICEF India (2021) · RTE Act 2009
(If the table is too wide, reduce font to 11–12pt; keep all rows.)

---
## SLIDE 7: Impact & Feasibility
Subtitle: Small to build, big to scale.
LEFT, "Impact":
- **Who benefits:** migrant children, receiving teachers, district education officials
- **What we'll measure in a pilot:** days until a child is taught at the right level · % of capsules scanned · teacher time saved
- **Scale:** a new language = one text file; new skills = append to the graph; any phone works
- **Aligned with NIPUN Bharat:** every child to reach foundational literacy & numeracy by end of Grade 3 by 2026–27
RIGHT, "Feasibility":
- **Technical:** runs fully on the phone; core MVP demo by 26 Nov
- **Time:** 4-person team, files split by owner, 24-hour build plan
- **Cost:** ₹0, using free tiers (AWS, ElevenLabs, hosting)
BOTTOM, small table "Risks → how we handle them":
- Translation quality → native-speaker review of every text
- Adoption → pilot with one NGO + district on one migration corridor
- Forged capsules → official state-signed capsules (roadmap)
- Lost QR → printed slip + copy in the teacher's roster
Sources: NIPUN Bharat Guidelines, Ministry of Education (2021)

---
## SLIDE 8: Business Model
Subtitle: Free for teachers and families, funded by those who run schools.
Bullets (two columns if space allows):
- **Customers:** state education departments, district officials, NGOs working with migrant children
- **Market size:** about 10 million children lived in rural households with a seasonal-migrant family member (2013)
- **Revenue model:** free for teachers & families · B2G implementation + support contracts · CSR / NGO grants
- **Go-to-market:** pilot on one migration corridor (e.g. Maharashtra → Karnataka) with an NGO and a district
- **Key costs & partners:** translation review, voice credits, cloud (free tier at first), teacher training · partners: SCERTs, NGOs
- **Growth (Track 4):** Phase 2 carries older migrant youth's vocational skills into ITI courses and jobs
Sources: UNESCO GEM Report team, World Education Blog (2018)
