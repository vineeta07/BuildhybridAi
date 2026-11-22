# Chrome Web Store listing (draft)

**Name:** Satark: scam and fine-print shield

**Summary (132 chars max):** Explains scams and fine print in plain words, with the exact quote as proof. On-device AI first, private cloud fallback.

**Category:** Productivity (or Tools)

**Single purpose:** Explain scams and fine print on the page the user chooses to check.

## Permission justifications

| Permission | Why it is needed |
|---|---|
| activeTab | Read the current page only after the user clicks the icon, uses the shortcut, or uses the right-click menu |
| scripting | Inject the extraction script into that one tab |
| sidePanel | Show the verdict and receipt beside the page |
| storage | Settings and the local receipt log; nothing leaves the device |
| contextMenus | "Check selection with Satark" |
| Optional `<all_urls>` | Guardian mode, asked for only when the user turns it on |

## Data disclosure

On the cloud route, redacted page text is sent to Google's Gemini through Firebase AI Logic; on-device it is not sent anywhere. Declared as website content, not sold, not used for anything unrelated to the check.

**Privacy policy URL:** the Firebase Hosting `privacy.html` page.

**Reviewer notes:** the cloud route needs an App Check debug token; put it in the private test-instructions field, not in the listing.

## Assets to prepare

128x128 icon, 1-5 screenshots (1280x800 or 640x400), 440x280 small promo tile. Confirm the sizes in the dashboard.
