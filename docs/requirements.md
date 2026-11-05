# Requirements and coverage

[Project overview](../README.md) · [Architecture](architecture.md) · [Acceptance](testing.md)

This is the intended release contract, not implemented behavior.

## Scope

Initial support: desktop Chrome, Manifest V3, top-level documents on `https://www.youtube.com/*` and `https://youtube.com/*`. Redirect rules also cover HTTP on these exact hosts before normal HTTPS canonicalization. Content scripts and host grants should cover HTTP and HTTPS on those two hosts for defense in depth. No wildcard YouTube subdomain permission. Verify bare-host redirects during implementation.

Edge and other Chromium browsers are candidates after separate validation. Firefox and Safari need API, packaging and store review. Mobile browsers/apps, `m.youtube.com`, `music.youtube.com`, `studio.youtube.com`, `youtu.be`, third-party embeds and `youtube-nocookie.com` are outside the first release. An external short link that ultimately navigates to a supported Shorts URL is caught at that supported destination. Incognito is unsupported initially and must not be claimed as protected.

## Required behavior

| ID | Requirement |
| --- | --- |
| R1 | A keyboard-accessible, clearly labelled Hide Shorts setting defaults on after initialization, persists locally and propagates to supported open tabs. Show pending/error state until application succeeds. |
| R2 | While on, remove complete confirmed dedicated Shorts shelves/sections, including headings, controls, wrappers and spacing. Hidden cards inside a still-empty shelf do not satisfy this requirement. |
| R3 | Remove Shorts entry points and individual Shorts cards on mixed pages without deleting surrounding normal content. Remove a mixed parent only if it becomes empty and is positively identified as a disposable content wrapper. |
| R4 | Prevent supported `/shorts` routes from remaining open or playing Shorts; redirect to `https://www.youtube.com/`. Cover direct entry, reload, new tab, history and SPA navigation. Any observed transient Shorts playback fails the release gate. |
| R5 | Preserve normal watch videos, search, subscriptions, channels, playlists, navigation, comments and player controls outside Shorts routes. |
| R6 | Turning off removes suppression and redirects. Since actual DOM removal is destructive, restore current page content by reloading supported tabs after rules are disabled. Warn that reload interrupts playback and loses unsaved page state before applying the off action. |
| R7 | No telemetry, browsing history collection, account access, remote executable code or backend. Package selectors with releases. |
| R8 | Bound DOM processing; recover from root replacement, worker suspension and stale events. Report incomplete toggle application honestly. |

## Surface inventory

| Surface | Removal boundary | Notes |
| --- | --- | --- |
| Home and subscriptions Shorts shelves | Dedicated shelf outer wrapper | Include header, carousel controls and reserved spacing. |
| Search Shorts shelves | Dedicated section | Preserve adjacent normal search results. |
| Mixed search/recommendation/feed cards | Individual Shorts card and its dedicated grid slot | A Shorts link elsewhere in a normal card is insufficient to delete the card. |
| Watch-page Shorts recommendations | Dedicated shelf or confirmed Shorts card | Keep ordinary recommendations and main video. |
| Channel Shorts tab and Shorts-only content section | Dedicated tab entry and section | Preserve channel header, Videos, Live and other tabs. Direct `/@channel/shorts` and legacy channel Shorts pages require DOM coverage; they are not `/shorts` player-route matches. |
| Expanded/collapsed sidebar, mini-guide, responsive menus | Dedicated Shorts navigation item | Account for lazy rendering and locale changes. |
| Shorts player and feed route | Navigation guard, early suppression and redirect | Do not convert to `/watch?v=…`, which would allow the content to play. |
| New or experimental Shorts surfaces | Future selector coverage | Unknown structures are a compatibility gap, not proof of absence. |

## Classification and limitations

Shorts route classification uses an exact supported host and pathname equal to `/shorts` or beginning `/shorts/`. Query and fragment do not exempt a route. `/shortsXYZ`, `/watch?next=/shorts/id`, a Shorts URL in comments and an unrelated domain containing “youtube.com” are not route matches. Browser-normalized URLs, encoded path variants and case behavior need explicit tests before declaring coverage; do not decode arbitrary URLs into a broader destructive match.

DOM classification combines dedicated renderer structure and parsed Shorts destination links. Do not rely on English “Shorts” text, aspect ratio, duration, thumbnails or a generic ancestor containing one matching anchor. Normal `/watch` videos remain permitted even when short or also available as Shorts. This is a focus tool, not tamper-proof parental control: disabling/uninstalling it, withholding site access or using unsupported clients bypasses protection.
