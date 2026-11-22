# Decisions and VERIFY log

Each item marked VERIFY in `SPEC.md`, and each place the code deviates from the spec.
"Pending" means it still has to be tested on a real Chrome with a Firebase project.

## VERIFY items

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | `initializeAppCheck` with a `CustomProvider` plus the debug token works from the side panel origin | Pending | Code is in `apps/extension/lib/firebase.ts`. Auto refresh starts off and is switched on in `ensureCloud()`. |
| 2 | Remote Config fetches from an extension page | Pending | `loadRemote()` falls back to the cached values, then the baked-in defaults, on any error. |
| 3 | The API key works from `chrome-extension://<id>` | Pending | If the key has an HTTP-referrer restriction, add `chrome-extension://<id>/*`. A fixed `key` (env `EXTENSION_PUBLIC_KEY`) keeps the ID stable. |
| 4 | Exact spelling of `inferenceSource` | Done (typings) | firebase 12.19 types: `InferenceSource.ON_DEVICE = "on_device"`, `IN_CLOUD = "in_cloud"`. `normalizeSource()` accepts either case. |
| 5 | Content-script build without a `content_scripts` entry or host permissions | Done | Used a WXT **unlisted script** (`entrypoints/extract.ts` -> `/extract.js`) instead of `registration: 'runtime'`, because runtime registration in WXT adds the script's `matches` to `host_permissions`. The built manifest has no `content_scripts` and no `host_permissions`. |
| 6 | Built path of the injected script | Done | `/extract.js` at the root of `.output/chrome-mv3/`. |
| 7 | Real on-device input limit (`on_device_max_chars`) | Pending | Default 9,000 characters. Measure with prompts of growing size on a laptop that runs Nano. |
| 8 | App Check "Custom" provider offered for web apps in the console | Pending | |
| 9 | `chrome://flags` name to switch the on-device model off (manual matrix #3) | Pending | |
| 10 | `chrome://flags/#optimization-guide-on-device-model` "BypassPerfRequirement" for development | Pending, unofficial | |

## Deviations from the spec

- **Core holds the orchestrator.** `analyze()` lives in `packages/core/src/analyze.ts` with its dependencies (model call, consent, lazy cloud init) injected, so the failure ladder is unit-tested without a browser. `apps/extension/lib/engine.ts` wires it to Firebase and Chrome storage.
- **`@satark/core/pure` entry.** The service worker and the extractor import from it so no Firebase code is bundled into them (the worker is about 7 kB).
- **Lazy cloud setup.** `initFirebase()` only creates the app, App Check (auto refresh off) and the AI instance. `ensureCloud()` turns App Check refresh on and signs in anonymously, and is called by `analyze()` only right before a cloud-capable route (anything other than `ONLY_ON_DEVICE`). Private mode and on-device checks therefore make no content-bearing request.
- **Unconfigured builds.** Without `VITE_FIREBASE_*` values the app is created with placeholder config so `ONLY_ON_DEVICE` still works; the cloud is treated as off (router rule 2) and the panel says the build has no cloud setup.
- **Failure ladder tweaks.** A size error retries the same route once at 60% of the input; a parse error retries once with "Return valid JSON only"; then the route switches as the spec says. At most 5 rounds per check.
- **Lookalike hosts.** Edit distance 1 for brand tokens of 5-7 letters, 2 for 8+ letters, and exact brand tokens on someone else's domain (for example `sbi-kyc-update.com`) also count. A short list of ordinary words (`apply`, `amazing`, ...) is excluded to cut false positives.
- **Highlights across nodes.** The extractor builds one normalized string with a character-to-node map, so quotes that span several text nodes (bold words, links) are highlighted. This was a P1 item in the spec.
- **Guardian mode (P1) included, minimal.** With the optional `<all_urls>` permission granted from Options, the worker runs Tier-0 on each loaded page and sets a badge. No AI and no network.
- **"Copy a warning for family" (P1) included.**
- **Not built yet (P1/P2):** evaluation page (samples are in `eval/samples.json`), Firestore sync, hosted playground, offscreen document, production App Check provider, Translator API pass, Firefox build.
