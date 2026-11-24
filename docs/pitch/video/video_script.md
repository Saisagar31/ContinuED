# ContinuED: video pitch script (wHACKiest 2026, Track 04 "UnlockED")

**Length:** 611 spoken words. That is about 4:22 at 140 words per minute, or about 4:32 with short pauses for slide changes. The official limit is 3 to 5 minutes.
**Speakers:** Omkar → Saisagar → Venkat → Ramith, taking turns.
**Sources of every fact:** `deliverables/ppt/content_final.md` (slide text), `ContinuED/docs/pitch/slide5_architecture.md` (slide 5), and the 4 mockups in `ContinuED/docs/pitch/mockups/`. See the "Claims check" at the end.

> **Honesty rules for the recording**
> - The 4 mockup screens are a **design preview**. Always call them that. Never say the app is "finished", "live" or "fully working".
> - The camera scanner, ElevenLabs voice, the AWS dashboard and the offline PWA are **planned (hack day)**.
> - Raju is an **example child** (an illustrative story, not a real case). The script says "Imagine Raju" so this is clear.

Timestamps are approximate and assume 140 words per minute with no pauses.

---

## 1. Hook / intro

| Time | Speaker | On screen | Spoken words |
|---|---|---|---|
| 0:00–0:18 | Omkar | Slide 1 (cover) | We're team ContinuED, for Track 4, UnlockED. Imagine Raju. He's eight. He moves from a Marathi school in Maharashtra to a Kannada school in Karnataka. His new teacher asks: what can Raju already do? |

## 2. Problem (slide 2)

| Time | Speaker | On screen | Spoken words |
|---|---|---|---|
| 0:18–1:08 | Saisagar | Slide 2 (Problem Statement) | Today, nobody can answer that. When a migrant child changes school, their learning history doesn't travel with them. CPR and UNICEF, citing Census 2011, say 39.2 percent of the 19.64 million people who migrated into Maharashtra in 2001 to 2010 were children. UNESCO's GEM Report says about 80 percent of temporary migrant children in seven Indian cities lacked access to education near work sites. ASER 2024 says only 23.4 percent of rural Std Three children can read a Std Two text. By the RTE Act, admission can't wait for a transfer certificate. APAAR ID stores records, but doesn't say which skill to teach next. So the teacher guesses, or restarts from zero, and Raju falls further behind. |

## 3. Solution (slide 3)

| Time | Speaker | On screen | Spoken words |
|---|---|---|---|
| 1:08–1:20 | Venkat | Slide 3 (Proposed Solution) | Our answer is ContinuED: an offline learning passport in a QR code. The old teacher's skill check travels with the child. Five steps: check, seal, carry, scan, teach. |

## 4. Design preview walkthrough (mockups 01 → 04)

| Time | Speaker | On screen | Spoken words |
|---|---|---|---|
| 1:20–1:34 | Venkat | `mockups/01_create.png` | Here's a design preview: mockups of our planned screens, not a finished app. Raju's old teacher marks 8 foundational reading and maths skills in minutes. Raju needs help with subtraction with borrowing. |
| 1:34–1:43 | Venkat | `mockups/02_sealed_qr.png` | She taps Seal: a QR code of about 140 characters, with zero personal data. Print it, or keep it on a phone. |
| 1:43–1:57 | Venkat | `mockups/03_scan_result.png` | In Karnataka, the new teacher opens it with no internet, and can read it in Kannada, Marathi or English. Seal verified. Start here: subtraction with regrouping, because everything after it depends on it. |
| 1:57–2:08 | Venkat | `mockups/04_start_here.png` | Start Here Tomorrow: two 15-minute activities, like breaking a bundle of ten sticks to borrow. The camera scanner and ElevenLabs voice are planned for hack day. |

## 5. Tech stack (slide 4)

| Time | Speaker | On screen | Spoken words |
|---|---|---|---|
| 2:08–2:30 | Ramith | Slide 4 (Tech Stack) | Our stack costs zero rupees. React, TypeScript, Vite and Tailwind run in any phone browser. lz-string and a QR code work on paper, no internet. An HMAC-SHA256 seal detects edited marks. English, Marathi and Kannada packs are bundled. Planned: an offline Progressive Web App, ElevenLabs voice, and AWS on the free tier. |

## 6. Architecture (slide 5)

| Time | Speaker | On screen | Spoken words |
|---|---|---|---|
| 2:30–3:00 | Omkar | Slide 5 (architecture diagram) | Offline first, cloud later. Everything important happens on the phone. Teacher A's app compresses and seals the skill check into a QR code. Teacher B opens it offline. The app checks the seal, walks our skill graph to find the first skill the child is stuck on, and shows tomorrow's plan in Teacher B's language. Later, a planned sync sends anonymous events to AWS Lambda and DynamoDB for a district dashboard. |

## 7. Novelty (slide 6)

| Time | Speaker | On screen | Spoken words |
|---|---|---|---|
| 3:00–3:19 | Saisagar | Slide 6 (Novelty / Innovation) | ContinuED tells the teacher what to teach tomorrow, not just marks or certificates. It combines a prerequisite skill graph, a sealed offline QR, and mother-tongue voice. It's private by design: only a pseudonymous ID. In our comparison, only ContinuED gives a what-to-teach-tomorrow plan. |

## 8. Impact & feasibility (slide 7)

| Time | Speaker | On screen | Spoken words |
|---|---|---|---|
| 3:19–3:45 | Omkar | Slide 7 (Impact & Feasibility) | It helps migrant children, receiving teachers and district officials. In a pilot, we'll measure days until a child is taught at the right level. A new language is one text file. It's aligned with NIPUN Bharat's goal: every child reaching foundational literacy and numeracy by the end of Grade 3, by 2026–27. It's feasible: four people, a 24-hour build plan, zero rupees. |

## 9. Business model + Track 4 employment link (slide 8)

| Time | Speaker | On screen | Spoken words |
|---|---|---|---|
| 3:45–4:17 | Ramith | Slide 8 (Business Model) | It's free for teachers and families. Customers are state education departments, district officials and NGOs. The UNESCO GEM Report team says about 10 million children lived in rural households with a seasonal-migrant family member in 2013. Revenue comes from government implementation and support contracts, and CSR or NGO grants. We'll pilot on one corridor, like Maharashtra to Karnataka. For Track 4, Phase 2 carries older migrant youth's vocational skills into ITI courses and jobs. |

## 10. Closing line

| Time | Speaker | On screen | Spoken words |
|---|---|---|---|
| 4:17–4:24 | Ramith | Slide 1 (cover), or `mockups/04_start_here.png` | Raju's learning shouldn't restart from zero. ContinuED: a learning passport that travels with the child. Thank you! |

---

## Word count and duration

Counted with `wc -w` on the spoken text only. Duration = words ÷ 140 words per minute.

| # | Section | Speaker | Words | ≈ Duration |
|---|---|---|---|---|
| 1 | Hook / intro | Omkar | 36 | 0:15 |
| 2 | Problem (slide 2) | Saisagar | 117 | 0:50 |
| 3 | Solution (slide 3) | Venkat | 28 | 0:12 |
| 4 | Design preview (mockups 01–04) | Venkat | 111 (32 + 22 + 31 + 26) | 0:48 |
| 5 | Tech stack (slide 4) | Ramith | 52 | 0:22 |
| 6 | Architecture (slide 5) | Omkar | 71 | 0:30 |
| 7 | Novelty (slide 6) | Saisagar | 43 | 0:18 |
| 8 | Impact & feasibility (slide 7) | Omkar | 62 | 0:27 |
| 9 | Business model (slide 8) | Ramith | 74 | 0:32 |
| 10 | Closing line | Ramith | 17 | 0:07 |
| | **Total** | | **611** | **≈ 4:22 (≈ 4:32 with pauses)** |

**Per speaker:** Omkar 167 words (≈1:12) · Saisagar 160 (≈1:09) · Venkat 141 (≈1:00) · Ramith 143 (≈1:01).
Novelty went to Saisagar and Impact went to Omkar to keep the split roughly even. Omkar's part is a little longer because he opens the video.

**If the recording runs over 4:30**, cut these first (none of them a key fact):
- Section 8: drop "A new language is one text file."
- Section 9: drop "like Maharashtra to Karnataka".

---

## Recording checklist

- [ ] **Tool (free):** OBS Studio, or PowerPoint's own **Record** feature (Record tab → record from the current slide; it captures your voice and the slides together).
- [ ] **Resolution:** export or record at **1080p** (1920×1080).
- [ ] **Room:** quiet room, door shut, fans off, phones on silent. Use a headset mic if you have one.
- [ ] **Slides ready:** the final deck (slides 1–8) plus the 4 mockups, in order: 01_create → 02_sealed_qr → 03_scan_result → 04_start_here. Each mockup already shows a "Design preview" label. Keep it visible.
- [ ] **Rehearse once with a timer.** Aim for 4:00–4:30, and stay under 5:00.
- [ ] **Speak slowly.** Say numbers clearly ("thirty-nine point two percent", "nineteen point six four million").
- [ ] **Honesty check while recording:** say "design preview" for the mockups. Say "planned" for the camera scanner, ElevenLabs voice, AWS dashboard and offline PWA. Never say "fully working".
- [ ] **Hand-offs:** each speaker starts recording a beat after the previous one stops, or record each person's part separately and join the clips.
- [ ] **Upload to YouTube as Unlisted.**
- [ ] **Title:** `ContinuED – wHACKiest 2026 Track 4`
- [ ] Open the link in a private/incognito window to check that it plays, then paste it into the submission form.

---

## Claims check

Each factual sentence in the script, with the line it comes from. "CF" = `deliverables/ppt/content_final.md`. "S5" = `ContinuED/docs/pitch/slide5_architecture.md`.
The Raju story (age 8, Marathi school in Maharashtra → Kannada school in Karnataka, the family moving for work) is an **illustrative example from the brief, not a sourced fact**. "Age 8" and "TC-4821" also appear in the mockups.

| # | Script sentence (short) | Source |
|---|---|---|
| 1 | "Track 4, UnlockED" | CF line 9 (`TRACK: Track 04 – UnlockED`) |
| 2 | "a migrant child changes school, their learning history doesn't travel with them" | CF line 19 (slide 2 subtitle) |
| 3 | "CPR and UNICEF, citing Census 2011 … 39.2 percent of the 19.64 million … into Maharashtra in 2001 to 2010 were children" | CF line 22; source named on CF line 30 ("CPR & UNICEF India (2021), citing Census 2011") |
| 4 | "UNESCO's GEM Report … about 80 percent of temporary migrant children in seven Indian cities lacked access to education near work sites" | CF line 23; source on CF line 30 ("UNESCO GEM Report 2019") |
| 5 | "ASER 2024 … only 23.4 percent of Std Three children can read a Std Two text" | CF line 24 |
| 6 | "By the RTE Act, admission can't wait for a transfer certificate" | CF line 27 (RTE Act, Sec. 5) |
| 7 | "APAAR ID stores records, but doesn't say which skill to teach next" | CF line 28 |
| 8 | "the teacher guesses, or restarts from zero, and … falls further behind" | CF line 25 |
| 9 | "an offline learning passport in a QR code" | CF line 34 |
| 10 | "The old teacher's skill check travels with the child" | CF line 35 |
| 11 | "Five steps: check, seal, carry, scan, teach" | CF line 42 |
| 12 | "marks 8 foundational reading and maths skills in minutes" | CF line 37; screen: mockup 01 |
| 13 | "needs help with subtraction with borrowing" | Mockup 01 (example data shown on screen; not a statistic) |
| 14 | "a QR code of about 140 characters, with zero personal data" | CF line 38 ("~140 characters: no name"); CF line 68 ("zero personal data in the QR"); mockup 02 badges |
| 15 | "Print it, or keep it on a phone" | CF line 42 ("Carry (paper/phone)"); mockup 02 ("Print paper slip") |
| 16 | "the new teacher opens it offline" | CF line 42 ("Scan (offline)") |
| 17 | "can read it in Kannada, Marathi or English" | CF line 39 |
| 18 | "Seal verified. Start here: subtraction with regrouping, because everything after it depends on it" | Mockup 03 (on-screen text); "root skill gap" on CF line 40 |
| 19 | "two 15-minute activities, like breaking a bundle of ten sticks to borrow" | Mockup 04 (on-screen text); "15-minute plan" on CF line 40 |
| 20 | "camera scanner and ElevenLabs voice are planned for hack day" | CF line 43 ("Hack day adds: camera scanner, ElevenLabs voice, AWS dashboard"); S5 lines 29–30 |
| 21 | "Our stack costs zero rupees" | CF line 47 |
| 22 | "React, TypeScript, Vite and Tailwind run in any phone browser" | CF line 49 |
| 23 | "lz-string and a QR code work on paper, no internet" | CF line 51 |
| 24 | "An HMAC-SHA256 seal detects edited marks" | CF line 52 |
| 25 | "English, Marathi and Kannada packs are bundled" | CF line 53 |
| 26 | "Planned: an offline Progressive Web App, ElevenLabs voice, and AWS on the free tier" | CF lines 50, 54, 56. "Planned" status: CF line 43 and S5 lines 29–33. The brief also asked for the PWA to be called planned. Note: S5 line 24 lists the "offline web app / PWA" as MVP; see the note below. |
| 27 | "Offline first, cloud later. Everything important happens on the phone" | S5 line 11 (title); S5 line 36 (speaker notes) |
| 28 | "Teacher A's app compresses and seals the skill check into a QR code" | S5 line 15; S5 line 36 |
| 29 | "Teacher B opens it offline … checks the seal, walks our skill graph to find the first skill the child is stuck on, and shows tomorrow's plan in Teacher B's language" | S5 line 36; S5 line 17 |
| 30 | "a planned sync sends anonymous events to AWS Lambda and DynamoDB for a district dashboard" | S5 line 18; planned status: S5 lines 31–33 and 39 |
| 31 | "tells the teacher what to teach tomorrow, not just marks or certificates" | CF line 66 |
| 32 | "combines a prerequisite skill graph, a sealed offline QR, and mother-tongue voice" | CF line 67 |
| 33 | "private by design: only a pseudonymous ID" | CF line 68 |
| 34 | "In our comparison, only ContinuED gives a what-to-teach-tomorrow plan" | CF line 73 (✔ for ContinuED, ✘ for the other three) |
| 35 | "helps migrant children, receiving teachers and district officials" | CF line 83 |
| 36 | "In a pilot, we'll measure days until a child is taught at the right level" | CF line 84 |
| 37 | "A new language is one text file" | CF line 85 |
| 38 | "aligned with NIPUN Bharat's goal: every child reaching foundational literacy and numeracy by the end of Grade 3, by 2026–27" | CF line 86; source on CF line 96 |
| 39 | "four people, a 24-hour build plan, zero rupees" | CF lines 89–90 |
| 40 | "free for teachers and families" | CF line 100; CF line 104 |
| 41 | "Customers are state education departments, district officials and NGOs" | CF line 102 |
| 42 | "The UNESCO GEM Report team says about 10 million children lived in rural households with a seasonal-migrant family member in 2013" | CF line 103; source on CF line 108 |
| 43 | "government implementation and support contracts, and CSR or NGO grants" | CF line 104 ("B2G implementation + support contracts · CSR / NGO grants") |
| 44 | "pilot on one corridor, like Maharashtra to Karnataka" | CF line 105 |
| 45 | "Phase 2 carries older migrant youth's vocational skills into ITI courses and jobs" | CF line 107 |
| 46 | "a learning passport that travels with the child" | CF line 15 (slide 1 tagline) |

**Notes for the team (things to double-check)**
- **ASER 23.4% (resolved):** the official PIB summary gives 23.4% as the overall Std III figure (20.9% in 2018 → 23.4% in 2024). ASER only surveys **rural** India, so the slide and script now say "rural Std III children".
- **Offline status (resolved):** the 26 Nov MVP runs entirely on the phone, with no server and no internet needed once the page is opened. Installing it to work in airplane mode, even after a reload (the PWA), is planned for hack day. Slide 3 and the slide 5 notes now say the same.
- **Subtraction statistic (33.7%, CF line 24)** was left out to save time. It can be added back after the 23.4% figure.
- **Guarantee Card (CF line 29) and "Works across states" (CF line 75)** are on the slides but not spoken, to save time.
