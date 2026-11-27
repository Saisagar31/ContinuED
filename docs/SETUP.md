# Local setup (clean machine)

You need **Node.js 22 or newer** (`.nvmrc` says 22) and **Git**. Nothing else, and no accounts.

```bash
git clone https://github.com/Saisagar31/ContinuED.git
cd ContinuED
npm ci                 # exact versions from package-lock.json
```

| Command | What it does |
|---|---|
| `npm run dev` | Teacher app at http://localhost:5173. Use a phone-sized browser window. |
| `npm run api:dev` | School API at http://localhost:8787. Check `GET /health` → `{"ok":true,...}`. |
| `npm run api:bundle` | Bundles the Lambda into `api/dist/lambda.js` for `infra/` (see `infra/README.md`). |
| `npm test` | All tests: app, API, and the frozen interface fixtures |
| `npm run typecheck` | TypeScript checks for the app (`tsconfig.json`) and for Node code (`tsconfig.node.json`) |
| `npm run build` | Production bundle in `dist/`, with the offline app shell |
| `npm run ci` | Typecheck + test + build, the same as GitHub CI |
| `npm run android:sync` | Build the web app and copy it into the Android project. |
| `npm run android:open` | Open the Android project in Android Studio. |

## Android app

Install Android Studio and its Android SDK, then run `npm ci` and `npm run android:sync` from the repository root. Run `npm run android:open` and select a phone or emulator in Android Studio. Use **Run** to install the debug app. For a debug APK, run `./gradlew.bat assembleDebug` inside `android/`; the file is written to `android/app/build/outputs/apk/debug/`.

After changing the web app, run `npm run android:sync` again before building or running it in Android Studio. The app's local learner data is stored on the device. The QR scanner requests camera permission when used. Online school features require a reachable HTTPS `VITE_API_URL` and valid Cognito settings at build time; `localhost` points to the phone, not your PC.

### Dev sign-in for the local API
The local API uses fake dev sign-in. Send `Authorization: Bearer dev:<schoolId>:<district>:<role>`, where role is `teacher`, `school_lead` or `district_lead`. The district can be left empty, for example `dev:SCH-A::teacher`.
- These tokens are not signed, so anyone can claim to be any school.
- Data is kept in memory and is lost when the server stops.
- Dev sign-in works only in `api/dev-server.ts` and is refused when `NODE_ENV=production`. The deployed Lambda only accepts real Cognito tokens.

## Environment
Copy `.env.example` to `.env.local` only if you need it. Every value is optional for local work. **Never commit `.env*` files.**
- Variables starting with `VITE_` end up in the browser bundle, so they must never hold secrets.
- The `ELEVENLABS_*` keys are used only by the audio build job, never by the app.

## Where things live
| Folder | Owner | What |
|---|---|---|
| `src/` | Venkat (UI, workspace, transfer, dashboard); Sai (assessment engine) | Teacher PWA |
| `shared/` | Omkar | Shared types and contracts. **Add-only.** |
| `shared/guards.ts` | Omkar | Runtime validators used by the API and the fixture tests |
| `fixtures/` | Omkar | One success and one failure example per interface. A broken fixture fails CI. |
| `api/` | Omkar + Ramith | School API: handlers, Lambda adapter, local dev server |
| `docs/PROJECT_EXECUTION_PLAN.md` | Team | The plan we follow |

## Changing a shared contract
1. Edit `shared/contracts.ts`. Add fields; don't rename or retype them.
2. Update the matching validator in `shared/guards.ts` and both fixtures in `fixtures/<name>/`.
3. Run `npm run ci`, then open a PR. Omkar reviews contract changes.

## Branch rules (once Sai turns on protection for `main`)
- Never push to `main`. Use one branch per task, for example `omkar/11-school-services`.
- Open a PR. CI must be green and one teammate must approve before merging.
