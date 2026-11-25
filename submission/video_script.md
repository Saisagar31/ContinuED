# 🎬 Video script (one presenter, about 4½ minutes)

**Presenter: Venkat** (one speaker is fine; the official FAQ 06 and 09 only require the video to explain the PPT, problem, solution and architecture).
**Length:** about 4:20–4:30 at a calm pace. The limit is 3–5 minutes.
**Every number** said below is on the slides and listed in [sources.md](sources.md).

> **3 honesty rules while recording**
> 1. The 4 screen pictures in `mockups/` are a **"design preview"**. Say that out loud.
> 2. Camera scanner, ElevenLabs voice, airplane-mode install and the AWS dashboard are **"planned"**.
> 3. Raju is an **example child**. Say "Imagine Raju".

---

| # | Time | On screen | Say this |
|---|---|---|---|
| 1 | 0:00 | **Slide 1** (cover) | We're team ContinuED, for Track 4, UnlockED. Imagine Raju. He's eight. He moves from a Marathi school in Maharashtra to a Kannada school in Karnataka. His new teacher asks: what can Raju already do? |
| 2 | 0:15 | **Slide 2** (Problem) | Today, nobody can answer that. When a migrant child changes school, their learning history doesn't travel with them. CPR and UNICEF, citing Census 2011, say 39.2 percent of the 19.64 million people who migrated into Maharashtra in 2001 to 2010 were children. UNESCO's GEM Report says about 80 percent of temporary migrant children in seven Indian cities lacked access to education near work sites. And foundations are weak: ASER 2024 found only 33.7 percent of Std Three children in rural India can do subtraction. By the RTE Act, admission can't wait for a transfer certificate. APAAR ID stores records, but doesn't say which skill to teach next. So the teacher guesses, or restarts from zero, and Raju falls further behind. |
| 3 | 1:05 | **Slide 3** (Solution) | Our answer is ContinuED: an offline learning passport in a QR code. The old teacher's skill check travels with the child. Five steps: check, seal, carry, scan, teach. |
| 4 | 1:17 | **mockups/01_create.png** | Here's a design preview: mockups of our planned screens, not a finished app. Raju's old teacher marks 8 foundational reading and maths skills in minutes. Raju needs help with subtraction with borrowing. |
| 5 | 1:31 | **mockups/02_sealed_qr.png** | She taps Seal: a QR code of about 140 characters, with zero personal data. Print it, or keep it on a phone. |
| 6 | 1:40 | **mockups/03_scan_result.png** | In Karnataka, the new teacher opens it with no internet, and can read it in Kannada, Marathi or English. Seal verified. Start here: subtraction with regrouping, because everything after it depends on it. |
| 7 | 1:54 | **mockups/04_start_here.png** | Start Here Tomorrow: two 15-minute activities, like breaking a bundle of ten sticks to borrow. The camera scanner and ElevenLabs voice are planned for hack day. |
| 8 | 2:05 | **Slide 4** (Tech Stack) | Our stack costs zero rupees. React, TypeScript, Vite and Tailwind run in any phone browser. lz-string and a QR code work on paper, no internet. An HMAC-SHA256 seal detects edited marks. English, Marathi and Kannada packs are bundled. Planned: an offline Progressive Web App, ElevenLabs voice, and AWS on the free tier. |
| 9 | 2:27 | **Slide 5** (Architecture) | Offline first, cloud later. Everything important happens on the phone. Teacher A's app compresses and seals the skill check into a QR code. Teacher B opens it with no internet. The app checks the seal, walks our skill graph to find the first skill the child is stuck on, and shows tomorrow's plan in Teacher B's language. Later, a planned sync sends anonymous events to AWS Lambda and DynamoDB for a district dashboard. |
| 10 | 2:57 | **Slide 6** (Novelty) | ContinuED tells the teacher what to teach tomorrow, not just marks or certificates. It combines a prerequisite skill graph and a sealed offline QR, and will add mother-tongue voice. It's private by design: only a pseudonymous ID. In our comparison, only ContinuED gives a what-to-teach-tomorrow plan. |
| 11 | 3:17 | **Slide 7** (Impact & Feasibility) | It helps migrant children, receiving teachers and district officials. In a pilot, we'll measure days until a child is taught at the right level. A new language is one text file. It's aligned with NIPUN Bharat's goal: every child reaching foundational literacy and numeracy by the end of Grade 3, by 2026–27. It's feasible: four people, a 24-hour build plan, zero rupees. |
| 12 | 3:43 | **Slide 8** (Business Model) | It's free for teachers and families. Customers are state education departments, district officials and NGOs. The UNESCO GEM Report team says about 10 million children lived in rural households with a seasonal-migrant family member in 2013. Revenue comes from government implementation and support contracts, and CSR or NGO grants. We'll pilot on one corridor, like Maharashtra to Karnataka. For Track 4, Phase 2 carries older migrant youth's vocational skills into ITI courses and jobs. |
| 13 | 4:15 | **Slide 1** (cover) | Raju's learning shouldn't restart from zero. ContinuED: a learning passport that travels with the child. Thank you! |

---

## How to record (free, about 30 minutes)
1. Open `ContinuED_Track4.pptx` in PowerPoint → **Record** tab → **Record from beginning**. This captures your voice and the slides together. **OBS Studio** also works.
2. For lines 4–7, show the 4 pictures from `mockups/`. You can insert them as temporary slides **only for recording**. Don't add them to the PPT you submit, because it must stay at 8 slides.
3. Use a quiet room, speak slowly, and say numbers clearly ("thirty-three point seven percent").
4. Rehearse once with a timer. Aim for 4:00–4:30, and stay under 5:00.
5. Export at **1080p**, then upload to **YouTube as Unlisted** with the title **`ContinuED – wHACKiest 2026 Track 4`**.
6. Open the link in an **incognito** window to check it plays, then paste it into Devnovate.
