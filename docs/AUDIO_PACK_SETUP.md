# ElevenLabs and offline audio packs

This project generates speech on a trusted build machine, then publishes static MP3s and manifests. The phone downloads a complete pack, checks each file's size and SHA-256 hash, and activates it only after all files pass. Never place the ElevenLabs key in a `VITE_` variable or a browser asset. No learner data belongs in speech requests.

## 1. Prepare the account and approved text

1. Create a project-owned ElevenLabs account, enable MFA, and create a restricted API key with Text to Speech access and a credit limit. Keep the key in `.env.local` or a secret store; `.env.local` is ignored by Git.
2. In the account, inspect available models and voices. Choose a model whose Text to Speech capability and language list cover **en, mr, kn, hi, te, ta, ml**. `eleven_multilingual_v2` does **not** cover all seven. `eleven_v4` is listed for all seven, but verify that the chosen voice and model are available in this account and test pronunciation in each language. A different voice ID can be used for each separate language build.
3. Have the educator and native classroom reviewer approve the question text, oral checks and activities first. Follow `CONTENT_REVIEW.md` and update the pack's `reviewStatus`, reviewer and date only after their actual review. The normal full build excludes unapproved strings.
4. Check the account's remaining credits and usage rights. The script's `--budget` is an estimate, not an account-level spending limit. Set the API key's own credit limit before generating.

Official references: [API keys](https://elevenlabs.io/docs/help-center/technical/how-do-i-authorize-myself-using-an-api-key), [model list](https://elevenlabs.io/docs/api-reference/models/list), [model languages](https://elevenlabs.io/docs/overview/models), [voices](https://elevenlabs.io/docs/api-reference/voices/search), [billing](https://elevenlabs.io/docs/overview/administration/billing).

## 2. Configure and measure

From the repository root, with Node 22+:

```powershell
npm ci
Copy-Item .env.example .env.local
```

Edit `.env.local` locally:

```dotenv
ELEVENLABS_API_KEY=your-private-key
ELEVENLABS_VOICE_ID=the-tested-voice-id
ELEVENLABS_MODEL_ID=eleven_v4
```

The model ID is an example, not a voice-quality verdict. Confirm it with the account's model list. The CLI also accepts `ELEVENLABS_OUTPUT_FORMAT` (default `mp3_44100_64`) and `ELEVENLABS_CREDITS_PER_CHAR` for estimates. It sends the exact approved spoken text, model, voice and language code to the Create Speech API.

Count the current drafts without calling ElevenLabs or creating files:

```powershell
npx tsx scripts/audio/build.ts --dry-run --include-unapproved
```

On 26 Nov 2026 this draft catalog contains **151 clips per language, 1,057 total and 63,404 characters**. Run the command again after content corrections; do not treat the estimate as billed usage.

For the seven-voice trial, create a private `sample-texts.json` with one *reviewer-approved, native-script* sentence for each of the seven language codes. Then run:

```powershell
npx tsx scripts/audio/build.ts --sample --lang en,mr,kn,hi,te,ta,ml --sample-file sample-texts.json --budget 1000
```

If voices differ by language, set `ELEVENLABS_VOICE_ID` for each run and pass one `--lang` at a time. Inspect `audio-out/sample-report.json`, listen to each MP3 with a native reviewer, and record file bytes and actual account credits. Sample mode does not create a publishable manifest. The `sample-texts.json` file is local working material: do not commit it unless its contents are approved for public release.

## 3. Build and review one language at a time

After the content pack is approved, set the selected voice ID, then build a language using a budget chosen from its fresh dry run and account allowance:

```powershell
npx tsx scripts/audio/build.ts --lang mr --budget 10000
```

The job writes `audio-out/mr/*.mp3`, `audio-out/mr/manifest.json` and `audio-out/ledger.jsonl`. A rerun uses the ledger to skip completed clips. If it stops at the budget, increase the approved budget only after checking account usage and rerun. Do not publish a partial pack as full coverage.

Have the Marathi reviewer listen to every clip against the exact source text and confirm pronunciation and arithmetic. Use the `contentId` values in the manifest to record verdicts; for example, after verifying a listed ID:

```powershell
npx tsx scripts/audio/review.ts --lang mr --approve 'verified-content-id'
npx tsx scripts/audio/review.ts --lang mr --reject 'incorrect-content-id'
```

Replace the example IDs with real IDs from `audio-out/mr/manifest.json`. Verdicts are stored in `audio-out/review.json` against text hashes, so a changed text becomes unreviewed. Regenerate a rejected clip after correcting its source or changing the selected voice/model, then review again. Repeat for all seven languages. **Only clips marked `approved` will play in the app.**

## 4. Publish and install

Publish only the language directories under one HTTPS base URL, preserving their relative paths. For a base such as `https://audio.example.org/packs`, these must resolve:

```text
https://audio.example.org/packs/mr/manifest.json
https://audio.example.org/packs/mr/<file-named-in-manifest>.mp3
```

Do not publish `ledger.jsonl`, `review.json`, the API key or sample report. If audio uses a different origin from the app, allow CORS GET requests from the app origin. Prefer immutable versioned releases and check the public manifest and one MP3 URL before telling teachers to download.

Set `VITE_AUDIO_BASE_URL` to the **base only**, for example `https://audio.example.org/packs` (no language suffix), in the app's build environment. Rebuild/redeploy the app because Vite embeds `VITE_` variables at build time. On a connected phone, open **Audio**, download one language, check the installed version and reviewed-clip count, then enter Airplane Mode and play a clip. Try an interrupted download; the previous working pack should remain active. Record the manifest hashes, bytes, reviewer verdicts and phone results in `PILOT_RELEASE_RECORD.md`.
