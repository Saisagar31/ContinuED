# Slide 5: Process Flow / Architecture (owner: Omkar)

Paste this into **slide 5** of the official template.
**Image:** `docs/pitch/architecture.png` (1920×1080, sized to fill a 16:9 slide).

> The template asks for: a step-by-step process flow (input → processing → output), an architecture diagram (frontend, backend, database, AI/ML, APIs), arrows showing how data moves, and each block labelled with the tech used. The image covers all four.

---

## Slide title
**How ContinuED works: offline first, cloud later**

## Bullets (if the template has a text box next to the image)
- **Input:** the old teacher marks 8 basic reading and maths skills
- **Processing:** compress + tamper-evident seal → a ~140-character QR code
- **Transfer:** paper slip or phone, with **no internet and no name**
- **Output:** the new teacher sees the root bottleneck + "Start Here Tomorrow" in their own language
- **Later, when online:** anonymous events → AWS Lambda → DynamoDB → district dashboard
- **Voice:** ElevenLabs clips generated once, then played offline

## Block labels (already in the image)
| Block | Tech | Status |
|---|---|---|
| Create and Scan screens | React + TypeScript + Tailwind CSS (runs on the phone, no server) | MVP |
| Install for airplane mode | Progressive Web App (service worker) | Planned |
| Capsule codec | lz-string compression + Web Crypto HMAC-SHA256 seal | MVP |
| Skill graph + bottleneck engine | 8 foundational skills with prerequisites | MVP |
| QR generator | qrcode.react | MVP |
| Language packs | English, मराठी, ಕನ್ನಡ, bundled in the app | MVP |
| Voice | Device voice now → ElevenLabs clips (planned) | Partly planned |
| Camera scanner | html5-qrcode | Planned |
| Sync outbox | IndexedDB (idb-keyval) | Planned |
| Cloud | AWS Lambda Function URL + Amazon DynamoDB (free tier) | Planned |
| District dashboard | Reads `/stats` from AWS | Planned |

## Speaker notes (about 30 seconds)
"Everything important happens on the phone, with no internet. Teacher A's app turns the skill check into a compressed, sealed QR code, about 140 characters with no name in it. Teacher B scans it offline. The app checks the seal, walks our skill graph to find the first skill the child is stuck on, and shows tomorrow's plan in Teacher B's own language. Voice clips are generated once with ElevenLabs and stored in the app, so they also play offline. Only when the phone gets internet do anonymous events sync to AWS Lambda and DynamoDB, which power a district dashboard of migration routes and common skill gaps."

## Be honest in Q&A
- **Solid boxes** are the core MVP for the 26–27 Nov demo. **Dashed boxes** are planned for hack day.
- The seal is **tamper-evident** (it detects edited marks), not proof of identity. Official state signatures are on the roadmap.
