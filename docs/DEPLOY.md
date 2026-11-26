# Deploying ContinuED: staging, production, rollback (tasks 13 and 15)

> **Status: runbook only. Nothing has been deployed.** Every step below needs accounts the team doesn't have yet (task 05). Mark each step done in the release record (end of this file) as you go.

## 0. Before the first deploy (task 05 decisions)
| Decision | Owner | Notes |
|---|---|---|
| AWS account, region, MFA, budget | Ramith + Omkar | `infra/samconfig.toml` assumes `ap-south-1`. A KMS key is billed monthly, so a $1 budget alert will likely fire on its own; pick a real budget. |
| Cloudflare account | **Sai** | The repo belongs to Sai's personal GitHub account. Cloudflare's docs say other users' accounts "are not listed, even if they have given you access", so **Sai must connect it** (or the repo must move to a GitHub organisation that has the Cloudflare app installed). |
| ElevenLabs account, model, voices | Ramith + Omkar | See PR #6. Marathi, Kannada, Telugu and Malayalam need a v3/v4 model (confirm on the models page). |
| Audio pack hosting URL | Omkar | It must be HTTPS. The pack manager downloads `<base>/<lang>/manifest.json` and the MP3s. |

## 1. Two environments, kept apart
| | Staging | Production |
|---|---|---|
| Web app | Cloudflare Pages project `continued-staging` | Cloudflare Pages project `continued` |
| Git branch that deploys | `staging` | `main` |
| Backend | `sam deploy --config-env staging` (stack `continued-staging`) | `sam deploy --config-env prod` (stack `continued-prod`) |
| Data | **Synthetic only** | Real school data, only after the pilot sign-off |
| Cognito pool, table, KMS key | Separate | Separate |

**Why two Pages projects?** A Pages project has one production branch, and every other branch gets a preview build. With separate projects, staging never shares a URL, settings or env vars with production. In each project, turn preview builds to **None** (Settings → Builds → Branch control), so only the chosen branch deploys.

## 2. Web app on Cloudflare Pages (done once per project, by Sai)
1. Cloudflare dashboard → Workers & Pages → Create → Pages → **Connect to Git** → pick `Saisagar31/ContinuED`. Give the GitHub app access to **only this repository**.
2. Production branch: `staging` for the staging project, `main` for production.
3. Build command `npm run build`, output directory `dist`, root directory = repo root. Set env var `NODE_VERSION=22`.
4. Environment variables (Settings → Variables), from `sam deploy` outputs:
   - `VITE_API_URL`
   - `VITE_COGNITO_REGION`
   - `VITE_COGNITO_USER_POOL_ID`
   - `VITE_COGNITO_CLIENT_ID`
   - `VITE_AUDIO_BASE_URL` (where the audio packs are published, e.g. `https://<audio-host>/packs`; each language at `<base>/<lang>/manifest.json`)
   - **Never put a secret here.** Every `VITE_*` value is visible in the browser.
5. Caching is set in [`public/_headers`](../public/_headers), which Vite copies into `dist/`:
   - `sw.js`, `index.html` and the manifest are `no-cache`, so updates reach phones.
   - `/assets/*` (hashed names) are cached for a year as immutable.
6. Camera scanning and the service worker need HTTPS. Pages serves HTTPS by default.

## 3. Backend on AWS
Follow [`infra/README.md`](../infra/README.md):
- `npm run api:bundle`, then `sam validate --lint`, then `sam deploy --config-env staging`
- enrol staff in Cognito groups
- publish the trust list

**After the first deploy:**
- Add the Pages URL to the Cognito app client's **callback and sign-out URLs** and to the HTTP API's **CORS allowed origins**.
- Copy the stack outputs into the Pages env vars (step 2.4) and redeploy Pages.

## 4. Audio packs (task 10)
1. **Build:**
   ```
   npx tsx scripts/audio/build.ts --lang <xx> --budget <credits>
   ```
   Run it only with **approved** content (task 09) and the ElevenLabs key in `.env.local`. The key stays off the browser.
2. **Review:** listening reviewers approve clips with `scripts/audio/review.ts`. Only approved clips play on phones.
3. **Upload:** upload `audio-out/<lang>/` to the pack host, under a **new versioned folder**. Never overwrite a published pack.
4. **Record** the pack version and manifest SHA-256 in the release record.

## 5. Staging checks (task 13 evidence)
| Check | How |
|---|---|
| Clean install | Fresh browser profile → open the staging URL → sign in → the app shell loads; Airplane Mode → reload → it still opens |
| Correct versions | The footer/About shows the commit SHA, *(to add)*, and the audio pack version matches the release record |
| API | `GET /health` → 200; a teacher token → `POST /events` accepted; replay → `duplicate` |
| Bad app rollout drill | Deploy a commit with a visible marker → roll back in Pages → the marker is gone after reload |
| Failed content update drill | Publish a pack with one wrong hash → the phone keeps the previous pack (`hash_mismatch`) |
| Backend restore drill | Restore the DynamoDB table with PITR **into a new table** → compare sample records → delete the restored copy |

## 6. Rollback
- **Web app:**
  - Pages → Deployments → All deployments → ⋯ → **Rollback to this deployment**.
  - Only successful **production** deployments can be rollback targets. Deployments older than 30 days are deleted, except the 100 most recent and the current one.
- **Backend:**
  - Redeploy the previous commit with `sam deploy --config-env <env>`.
  - Schema changes must stay backward-compatible. If a downgrade would destroy records, fix forward instead.
- **Audio pack:** point the app back at the previous pack version. Phones keep their working pack until a new one fully verifies.
- **Data:** DynamoDB point-in-time restore goes into a new table, then you switch `TABLE_NAME`. Don't restore over live data.
- **Stop the rollout** if a release loses assessments, exposes another school's data, breaks offline transfers or misstates learning results (plan §6).

## 7. Production (task 15, only after the task 14 pilot sign-off)
1. Merge the exact tested staging commit to `main`. It's the same artifacts and the same pack versions.
2. `sam deploy --config-env prod` with production parameters.
3. Two-phone smoke test with **synthetic** records: create → transfer offline → receive → reconnect → sync acknowledged once → the dashboard count moves.
4. Watch the API logs and errors for the first day.
5. Fill in the release record. Sai accepts the teacher experience; Omkar signs technical readiness.

## Release record (copy for each release)
```
Release:            <name>        Date: <YYYY-MM-DD>
Commit:             <sha>         CI run: <url>
Web (Pages) deploy: <deployment id / url>
Backend stack:      continued-<env>, template sha256: <hash>
Audio packs:        en=<ver> mr=<ver> kn=<ver> hi=<ver> te=<ver> ta=<ver> ml=<ver>
Migrations:         <none | list>
Device results:     <phones, browsers, pass/fail>
Known limitations:  <list>
Rollback target:    web <deployment id>, backend <commit>, packs <versions>
Backup reference:   PITR window / restore test date
Support contact:    <name>
Decision:           <go / no-go>, signed Sai (teacher experience), Omkar (technical)
```
