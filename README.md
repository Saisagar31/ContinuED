# ContinuED

**Learning that travels with the child.** wHACKiest 2026 · Track 04 (UnlockED)

> 🚧 **Work in progress.** This repo is a skeleton with shared contracts. The working core MVP is due 26 Nov 2026. Features below marked *planned* are not built yet.

## The problem
When migrant families move between states, their children change schools and often languages. The new teacher has no record of what the child can already do, so the child is placed at the wrong level and can fall behind.

## The solution
An offline **learning passport in a QR code**:
1. **Check:** the old school's teacher marks 8 foundational reading and maths skills.
2. **Seal:** the app packs the results into a small, tamper-evident QR code. It holds no name, only an ID like `TC-4821`.
3. **Carry:** the family carries the QR on paper or a phone.
4. **Scan:** the new teacher opens it **without internet**, in **their own language**.
5. **Teach:** the app shows the child's **root bottleneck** and a **"Start Here Tomorrow"** plan.

## Architecture
| Part | Tech | Status |
|---|---|---|
| App | React + TypeScript + Vite + Tailwind CSS | Skeleton |
| QR code + compression | `qrcode.react`, `lz-string` | Planned (MVP) |
| Tamper-evident seal | Web Crypto HMAC-SHA256 | Planned (MVP) |
| Languages | English, Marathi, Kannada | Planned (MVP) |
| Voice | Device voice → ElevenLabs clips stored in the app | Planned |
| Works offline | Progressive Web App (PWA) | Planned |
| Anonymous sync + district dashboard | AWS Lambda Function URL + DynamoDB | Planned |

**Privacy:** no names or personal data are stored or sent. The seal is *tamper-evident*: it detects edited marks. Signatures issued by state education departments are on the roadmap.

## Run it
Requires **Node.js 22.6+** and git.
```bash
git clone https://github.com/Saisagar31/ContinuED.git
cd ContinuED
npm install
npm run dev
```

## Team
Omkar · Saisagar · Venkat · Ramith

For roles, file ownership, the timeline and the agent prompts, see **[docs/ContinuED_TEAM_PLAN.md](docs/ContinuED_TEAM_PLAN.md)**.
