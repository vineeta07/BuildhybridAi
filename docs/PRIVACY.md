# Privacy summary

- **On-device route:** text is analysed by Gemini Nano inside Chrome. Page content never leaves the device.
- **Cloud route:** only after consent. Personal data patterns are replaced with placeholders (`redact.ts`) before the request; the consent sheet shows exactly what will be sent. Satark removes common patterns but cannot guarantee that nothing sensitive remains.
- **Storage:** settings and the last 50 Privacy Receipts in `chrome.storage.local`. Receipts are metadata only (see `Receipt` in `packages/core/src/types.ts`); a unit test asserts that a serialized receipt contains none of the input text.
- **Firebase:** anonymous Auth and App Check run only before the first cloud check (`ensureCloud()`); Remote Config delivers data only (thresholds, phrase list, kill switch), never code.
- **Permissions:** `activeTab`, `scripting`, `sidePanel`, `storage`, `contextMenus`; optional `<all_urls>` only for Guardian mode. No `tabs`, `history`, `cookies`, `webRequest`, `downloads` or `identity`.
- **No remote code:** everything is bundled; no CDN scripts and no `eval`.

The public policy page is `apps/site/public/privacy.html`.
