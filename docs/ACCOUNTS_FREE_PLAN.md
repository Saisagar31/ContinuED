# Project accounts on free plans only (₹0)

Tracks issue #18. These are the account steps for task 05. Every step stays on a **free plan**. If a page asks for anything paid, stop and tell the team before continuing.

> 🔒 **Never post passwords, API keys, secret keys, MFA codes or recovery codes** in GitHub, WhatsApp or any chat. Share keys in person only. Keys go only in each person's local `.env.local`, which git ignores. When a step is done, reply **"done"** on issue #18, with no secrets.

Only the account holder can do these parts: choosing the password, entering email or phone verification codes, solving a CAPTCHA, scanning the MFA QR code, and copying the API key. A coding agent must not do them.

| Account | Owner | Plan | Status |
|---|---|---|---|
| AWS | Ramith | Free plan | open |
| ElevenLabs | Ramith | Free | open |
| Cloudflare Pages | Sai (owns the GitHub repo) | Free | open |

## 1. AWS (Ramith)

1. Sign up at <https://aws.amazon.com/free> with a **project email that has never had an AWS account**. Only new customers get the free plan.
2. When asked to pick a plan, choose **Free plan**, not Paid plan.
   - You get $100 in credits at sign-up, and up to $100 more by trying some services.
   - The plan lasts 6 months or until the credits run out, whichever comes first. AWS says free-plan accounts aren't charged unless someone upgrades to a paid plan.
3. **Card:** AWS's pages disagree on whether a payment method is needed. If the sign-up asks for a card, **stop and tell the team before entering one**.
4. ⚠️ **When the free plan ends, the account closes**, and its data is deleted unless someone upgrades it. That's fine for the pilot. **Write the end date here:** `____-__-__` (find it in Billing → Credits).
5. Turn on **MFA for the root user**. After that, don't use root for daily work.
6. **Region: Mumbai (`ap-south-1`).** `infra/samconfig.toml` already assumes this. If you pick another region, tell Omkar.
7. **Budget alert:** in AWS Budgets, create a cost budget of **$1** that excludes credits, so any real charge sends an email to the team address.
   - The KMS signing key costs about $1 a month (check the AWS pricing page). The credits cover it, so it won't trip this alert.
8. **Create a separate login for Omkar** with MFA. Use an IAM Identity Center user, or an IAM user.
   - Give it permission to deploy CloudFormation/SAM. See `docs/DEPLOY.md` and `infra/README.md`.
   - Omkar sets up his own MFA device and his own access keys.
9. Check that these services are available in `ap-south-1`: Cognito, API Gateway (HTTP API), Lambda (Node 22), DynamoDB and KMS.

## 2. ElevenLabs (Ramith)

1. Sign up at <https://elevenlabs.io>.
   - The free plan gives **10,000 credits a month**, and no card is needed.
   - Free-plan accounts can create an API key.
2. The free plan is **non-commercial and requires attribution**. That's fine for the hackathon.
   - The app already shows "Voice by ElevenLabs" wherever an ElevenLabs recording plays (PR #20).
   - Before any commercial pilot, re-check the billing page.
3. **Model:** use `eleven_v3`, or a newer model if one is listed.
   - Per issue #18, the older `multilingual_v2` and `flash_v2_5` models don't support Marathi, Kannada, Telugu or Malayalam.
   - Confirm this on the [models page](https://elevenlabs.io/docs/api-reference/models/list) before generating.
4. **Credits plan:**
   - The full content is about **63,400 characters** across 7 languages, which is more than one month of free credits.
   - Do **only the samples first**: one short clip per language, using `scripts/audio/sample-texts.example.json`, about 513 characters.
   - Generate the rest gradually across months, after the review fixes.
5. Pick one voice per language. Then run the sample check in `docs/AUDIO_PACK_SETUP.md` (#17) with `--budget 1000`. Report the bytes, the credits used and a listening verdict for each language.
6. Copy the API key and **give it to Omkar in person only**. Each person puts `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` and `ELEVENLABS_MODEL_ID` in their own `.env.local`.

## 3. Cloudflare Pages (Sai)

Cloudflare only lists repos owned by the person who connects them, so **Sai has to do this**. The free plan's 500 builds a month is enough for us.

Follow issue #18 §3 and `docs/DEPLOY.md`:

1. Create two Pages projects:
   - `continued-staging`, with production branch `staging`
   - `continued`, with production branch `main`
2. For both projects, set:
   - build command: `npm run build`
   - output directory: `dist`
   - environment variable: `NODE_VERSION=22`
   - preview builds: **None**
3. Give the Cloudflare GitHub app access to **only this repository**.

## Sources (checked 26 Nov 2026)

- [AWS Free Tier FAQs](https://aws.amazon.com/free/faqs/)
- [Choosing an AWS Free Tier plan](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html)
- [AWS free plan announcement (July 2025)](https://aws.amazon.com/about-aws/whats-new/2025/07/aws-free-tier-credits-month-free-plan)
- [ElevenLabs API pricing](https://elevenlabs.io/pricing/api)
- [ElevenLabs models](https://elevenlabs.io/docs/api-reference/models/list)

Provider terms change, so check the live pages before signing up.
