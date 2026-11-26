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
| `npm test` | All tests: app, API, and the frozen interface fixtures |
| `npm run typecheck` | TypeScript checks for the app (`tsconfig.json`) and for Node code (`tsconfig.node.json`) |
| `npm run build` | Production bundle in `dist/`, with the offline app shell |
| `npm run ci` | Typecheck + test + build, the same as GitHub CI |

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
