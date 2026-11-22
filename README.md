# Satark

**A Chrome side-panel extension that reads what people never read — scam pages and messages, terms and conditions, loan and rent agreements — and explains the risk in plain words, with the exact quote as evidence.**

It runs Gemini Nano on-device when the laptop can, and falls back to Gemini in the cloud through Firebase AI Logic, after redacting personal data and asking, when it can't. After every check it shows a **Privacy Receipt**: where it ran, why, and how much left the device.

Built for #BuildHybridAI 2026 (Web / Chrome). Full design: [`SPEC.md`](SPEC.md).

## Architecture

```
Web page
   |  (activeTab + scripting, injected on click)
   v
EXTRACTOR (unlisted script)  - visible text + page signals, highlights verified quotes
   ^  typed messages
   v
SERVICE WORKER               - action click, shortcut, context menu, injection, relay
   (no AI, no Firebase)        Guardian-mode Tier-0 badge (optional permission)
   ^
   v
SIDE PANEL (React) = ENGINE HOST
   tier0 -> router -> radar -> redact -> consent -> model call -> parse -> verify -> receipt
                         |
          +--------------+---------------+
          v                              v
   Prompt API (Gemini Nano)       Firebase AI Logic -> Gemini (cloud)
   no network                     App Check + anonymous auth

OPTIONS PAGE - mode, language, on-device download, Guardian, debug token, simulate switch
Firebase: AI Logic | App Check | Auth (anonymous) | Remote Config | Hosting
```

- `packages/core` — pure TypeScript: router, redaction, schema + validator, quote verification, Tier-0 heuristics, clause radar, prompts, receipts, and `analyze()` (the only path to a model). `firebase/ai` is imported only in `ai-adapter.ts` and `schema.ts`.
- `apps/extension` — WXT + React + Tailwind. Wires core to Chrome and Firebase.
- `apps/site` — Firebase Hosting: landing page, privacy policy, fictional demo pages, and a no-install **playground** (quick check and redaction preview, runs in the tab, sends nothing).

Also included: **production App Check** through a Cloud Function (`functions/`), **verdicts in 58 languages** (Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia, Urdu and more; translated on-device by Chrome's Translator API when it supports the language, otherwise answered by the cloud on request; right-to-left scripts supported; quotes always stay verbatim), a **Firefox build**, a developer **evaluation page** (Options > Developer) that runs `eval/samples.json` through both routes, **opt-in Firestore sync** of settings and counters (never page text), **Guardian mode**, and a dark-pattern check for pre-ticked paid add-ons.

## Design

Calm and readable rather than flashy: warm paper background, dark warm text, one muted sage-teal accent, and soft pastel only where attention is needed (the verdict and the quick-check chip). Serif headings, no gradients or glow. Every text colour meets WCAG AA contrast, verdicts always pair colour with an icon and words, and everything works by keyboard.

## The router

Every check picks one of Firebase AI Logic's four `InferenceMode` values. First match wins:

| # | Condition | Decision | Reason code |
|---|---|---|---|
| 1 | Mode is Private | `ONLY_ON_DEVICE` | `USER_PRIVATE` |
| 2 | Remote Config `cloud_enabled` is false | On-device only, else Tier-0 | `RC_CLOUD_OFF` |
| 3 | Mode is Cloud only | `ONLY_IN_CLOUD`, redacted | `USER_CLOUD` |
| 4 | Mode is Best quality | `PREFER_IN_CLOUD`, redacted | `USER_QUALITY` |
| 5 | On-device ready, language supported, fits budget, no personal data | `PREFER_ON_DEVICE` | `ON_DEVICE_OK_LOW_RISK` |
| 6 | On-device ready, language supported, fits budget | `ONLY_ON_DEVICE` | `ON_DEVICE_OK` |
| 7 | Model downloadable or downloading | `ONLY_IN_CLOUD` with consent | `MODEL_NOT_READY` |
| 8 | Language not en/es/ja/de/fr | `ONLY_IN_CLOUD`, redacted | `LANG_UNSUPPORTED` |
| 9 | Too long even for the clause radar | `ONLY_IN_CLOUD`, redacted | `TOO_LONG` |
| 10 | On-device unavailable, or simulation switch on | `ONLY_IN_CLOUD`, redacted | `NO_ON_DEVICE` |
| 11 | Offline and no on-device model | Tier-0 only | `OFFLINE_NO_MODEL` |

Smart mode never uses `PREFER_ON_DEVICE` for text that contains personal data, because that mode can silently fall back to the cloud. Failures follow a ladder (shrink and retry, strict-JSON retry, switch route, Tier-0), logged in the receipt as `attempts`.

**Evidence over scores:** every reason carries a quote that must be an exact (normalized) substring of the text sent to the model. Unverifiable reasons are dropped and counted; a "danger" verdict with no verified reason is downgraded to "caution".

## Install

Requirements: Node 22+, pnpm 10, desktop Chrome 139+.

```bash
pnpm install
```

```bash
cp .env.example apps/extension/.env.local   # fill in your public Firebase web config
```

```bash
pnpm build
```

Then open `chrome://extensions`, turn on Developer mode, choose **Load unpacked**, and select `apps/extension/.output/chrome-mv3`. Pin the icon, open Options, and paste your App Check debug token under Developer. `pnpm zip` produces the same build as a ZIP for a GitHub release.

**Firefox:** `pnpm zip:firefox`, then open `about:debugging#/runtime/this-firefox` and choose *Load Temporary Add-on* on the `manifest.json` in `apps/extension/.output/firefox-mv3`. Satark opens as a sidebar. Firefox has no on-device AI, so checks use the cloud route (always redacted, always with consent). Needs Firefox 140+. For Mozilla review, upload `satark-<version>-sources.zip` as the source code; it builds with `pnpm install && pnpm zip:firefox` on Node 22 and pnpm 10.

Without a Firebase config the build still works for on-device checks and the instant Tier-0 checks; cloud checks are off.

On-device AI needs desktop Chrome with 22 GB of free disk and a GPU with more than 4 GB of VRAM, or 16 GB of RAM with 4+ cores. Check `chrome://on-device-internals` for model status.

### Firebase setup

1. Create a project (Spark plan), add a Web app, and copy its config into `apps/extension/.env.local`.
2. Build > AI Logic: run the guided setup with the Gemini Developer API.
3. App Check: register the web app (Custom provider) and enforce it for AI Logic. In Options, type `true` as the debug token, reopen the side panel, copy the token the SDK logs in the panel's DevTools console, register it under *Manage debug tokens*, then paste the real token in Options.
4. Authentication: enable the Anonymous provider.
5. Remote Config: `firebase deploy --only remoteconfig` (template in `remoteconfig.template.json`).
6. Production App Check (Blaze plan): set the params when prompted and run `firebase deploy --only functions`. `SATARK_WEB_APP_ID` is your Web App ID; `SATARK_ALLOWED_ORIGINS` is `chrome-extension://<your extension id>,moz-extension://*`. Put the function URL in `VITE_APPCHECK_EXCHANGE_URL` and rebuild. Do not enforce App Check on Authentication.
6b. Hosting: `firebase deploy --only hosting` (builds the playground, then serves `apps/site/public`).
7. Firestore (optional sync): create a database and `firebase deploy --only firestore`.

Never commit `.env.local` or the debug token.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | WXT dev server with hot reload |
| `pnpm build` | Production build to `apps/extension/.output/chrome-mv3` |
| `pnpm zip` | Store / release ZIP |
| `pnpm test` | Vitest unit tests (router, redaction, verification, Tier-0, radar, parsing, receipts, `analyze()`) |
| `pnpm typecheck` | TypeScript strict mode, all packages |
| `pnpm zip:firefox` | Firefox MV3 add-on ZIP plus the source ZIP for Mozilla review |
| `pnpm build:site` | Bundle the hosted playground (`apps/site/public/playground.js`) |
| `pnpm lint` | ESLint (bans `innerHTML`, `eval`, Firebase or `chrome.*` inside core) |

## Privacy

- On-device: page content never leaves the device.
- Cloud: redacted first, with consent, and the consent sheet shows exactly what will be sent.
- Receipts are metadata only (a test asserts a serialized receipt contains none of the input text).
- Permissions: `activeTab`, `scripting`, `sidePanel`, `storage`, `contextMenus`, and optional `<all_urls>` only for Guardian mode.

See [`docs/PRIVACY.md`](docs/PRIVACY.md) and the hosted [privacy policy](apps/site/public/privacy.html).

## Limitations

- Satark helps people notice red flags before they act. It does not prevent losses, and it does not replace a bank or the police.
- Redaction is pattern-based and cannot guarantee that nothing sensitive remains.
- On-device input languages are English, Spanish, Japanese, German and French; other languages use the cloud.
- The hybrid SDK is in Preview. The App Check debug token is for testing; a production attestation provider is future work.
- Evaluation numbers will be added here after running `eval/samples.json` through both routes on real hardware.

## Licence

[Apache-2.0](LICENSE)
