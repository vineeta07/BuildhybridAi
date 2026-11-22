# Changelog

## 0.2.0 (2026-11-22)

**Added**
- Production App Check: `appCheckExchange` Cloud Function with per-user rate limits; the extension's custom provider calls it.
- 58 explanation languages with native names and "Same as my browser". On-device verdicts are translated by Chrome's Translator API when it supports the language; otherwise the cloud can answer in it (redacted, with consent). Right-to-left layout for Arabic, Urdu, Persian and Hebrew.
- Firefox build (Manifest V3 sidebar, cloud route) and the source ZIP Mozilla review needs.
- Evaluation page, opt-in Firestore sync of settings and counters, hosted playground, Guardian mode badge, dark-pattern check for pre-ticked paid add-ons, "Copy a warning for family".
- Soft, light visual design with WCAG AA contrast.

**Changed**
- Firebase is loaded only when a check, a Remote Config refresh or sync needs it. The side panel's startup JavaScript dropped from about 104 kB to 80 kB gzipped.
- Low-risk on-device checks no longer sign in to Firebase first. A failed sign-in can no longer block a check that could run on the device.
- "Check again" re-reads the page, so it never checks stale text after you navigate.

**Fixed**
- Every AI check failed with `AI/no-model`: the SDK needs a cloud model name even in hybrid mode. The default `gemini-2.5-flash-lite` is now passed explicitly.
- Dependency advisories in `@grpc/grpc-js` (pulled in by Firestore) resolved with an override; `pnpm audit` reports no known vulnerabilities.

## 0.1.0 (2026-11-22)

First build: router over all four inference modes, redaction and consent, quote verification, Privacy Receipts, side panel, options, hosted site.
