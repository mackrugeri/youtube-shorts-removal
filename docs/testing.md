# Testing and acceptance plan

[Requirements](requirements.md) · [Architecture](architecture.md) · [Roadmap](roadmap.md)

**Nothing in this matrix has been executed.** These are future release gates. Documentation link checks are not extension tests.

## Test approach

Use unit tests for URL classifiers, wrapper selection, selector failures and setting reconciliation; DOM fixtures for full removal and false positives; an unpacked-extension browser harness for real DNR/storage/worker behavior; and manual live YouTube review for current markup, visual spacing, audio and accessibility. Fixtures alone cannot establish live compatibility. Record browser/OS/build, extension revision, selector revision, account state, locale, URL category and result without retaining personal browsing data.

| Case | Setup/action | Required result | Requirement |
| --- | --- | --- | --- |
| A1 | Fresh profile, initialize installation, open home | Default on; complete known Shorts shelves absent; no blank heading/control/spacing | R1–R3 |
| A2 | Home/subscriptions/search/watch/channel; scroll and lazy-load | Dedicated Shorts containers and navigation entries removed, mixed normal content retained | R2–R3, R5 |
| A3 | New dedicated renderer fixture and unsupported variant | Known wrapper fully removed; unknown structure does not delete generic parent; coverage gap recorded | R2, R5, R8 |
| A4 | Normal `/watch` short video; normal card containing a comment/link mentioning Shorts | Normal content and controls remain | R3, R5 |
| A5 | Address bar, external link, new tab, reload on `/shorts` and `/shorts/id` | Fixed homepage; no Shorts playback; query/hash discarded | R4 |
| A6 | `/shorts/`, `/shorts/id?feature=share`, `/shorts/id#x`, query+fragment | Same blocking behavior; no redirect loop | R4 |
| A7 | `/shortsXYZ`, `/watch?next=/shorts/id`, other domains and unsupported hosts | No erroneous route redirect; unsupported scope documented | R4–R5 |
| A8 | Bare/www host, HTTP→HTTPS, canonical redirects, percent encoding and case variants | Classifier/DNR agreement for supported canonical routes; exceptions explicitly recorded | R4–R5 |
| A9 | SPA link, keyboard/middle/modified activation, context-menu new tab, programmatic pushState/replaceState | Route guard wins; no visible or audible Shorts playback | R4 |
| A10 | Back/forward, BFCache, hash-only changes, tab replacement and restored browser session | Guard rechecks current route; ordinary history usable; no redirect loop | R4–R5, R8 |
| A11 | Enable while Shorts is already playing | Media stops, player disappears, fixed homepage loads | R1, R4 |
| A12 | Toggle off with multiple supported tabs, including normal playback | Warning precedes action; rules off; teardown and one reload per tab restore native content; future Shorts allowed | R1, R6 |
| A13 | Toggle on/off rapidly; open/close tabs during pending transition | Latest revision wins, no stale redirect/reload after off, status accurately reflects failures | R1, R6, R8 |
| A14 | Suspend worker, restart browser, extension update while off/on | Preference survives; actual rules reconcile; no worker-global dependence; stale pages get reload guidance | R1, R8 |
| A15 | Inject storage/rules errors, deny host access, invalidate content context | No false “applied” status; bounded anti-flash fallback; rollback/retry or manual reload guidance | R1, R8 |
| A16 | Search, playlist playback, comments, subscriptions, ordinary channel tabs | No unrelated removal, interruption or route redirect while on | R5 |
| A17 | Keyboard and screen reader; focused card removed | No invisible tab stops, sensible focus recovery, labelled switch and announced state/errors | R1–R3 |
| A18 | Locale variants, themes, desktop widths, zoom, signed-in/out, layout extension | Correct supported surfaces; no English-label dependence or ordinary content damage | R2–R5 |
| A19 | Page/service-worker cached document, slow CPU/network, cold start | DNR gaps covered by guards; no Shorts playback; flashes measured and failures retained | R4, R8 |
| A20 | Install into already-open pages; browser disables/uninstalls extension | Clearly request reload when needed; do not claim restoration or protection before scripts attach | R6, R8 |

Run A2 per surface in the [coverage inventory](requirements.md#surface-inventory), including channel Shorts-only routes and responsive menus. For A5–A10, use shared positive/negative URL fixtures in both parser tests and actual browser rule tests. Inspect redirects, not just final screenshots. Validate normal watch playback continuously across navigation and toggles.

## Performance and visual gates

Initial engineering targets, to be measured on a recorded reference desktop: 4 ms scheduled DOM work per frame; no extension-attributed long task over 50 ms during routine scrolling; no polling loop or repeated whole-document mutation scan; no monotonically growing detached-node memory after 50 route changes. Establish an extension-off baseline and record CPU, heap and task traces. Adjust targets only with documented evidence.

Capture cold/warm loads and dynamic insertion with filmstrip/high-frame-rate recording. Inspect complete shelf boundaries and surrounding spacing, not only hidden anchors. Record flashes independently of playback: no audible/visible Shorts playback is a strict gate; early CSS aims to prevent known-surface flashes, and any observed flash needs investigation and an explicit release decision. Test with normal watch audio as a negative control.

## Release decision

Require all applicable matrix rows to pass on the declared supported Chrome version, no normal-content deletion, no leftover dedicated empty Shorts sections, no observed Shorts playback, and no unresolved toggle-state mismatch. Set the minimum Chrome version from the APIs actually used and run both minimum and current supported versions. Manual live review must accompany fixtures for each release. If SPA timing, cached responses or a new renderer defeats protection, block release or explicitly narrow the product claim with approval; do not mark the case passing because a later redirect eventually occurred.
