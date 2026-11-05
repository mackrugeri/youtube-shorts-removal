# Proposed architecture

[Overview](../README.md) · [Requirements](requirements.md) · [Tests](testing.md) · [Sources](references.md)

All components below are proposals. Official API capabilities have been reviewed; YouTube selectors and end-to-end timing have not been validated.

## Components and permissions

| Component | Responsibility |
| --- | --- |
| Popup | Labelled Hide Shorts switch, pending/applied/error status, off-action reload warning and retry. |
| MV3 service worker | Serialize setting changes; reconcile persistent network rules; handle navigation events; coordinate tabs and recovery. Register listeners synchronously at worker startup. |
| Static content script at `document_start` | Read state, manage early styles, classify/remove DOM, intercept recognized links and enforce current route. Use the isolated world. |
| Packaged early CSS | Temporarily suppress known dedicated Shorts structures before DOM cleanup; never blanket-hide YouTube. |
| Selector registry | Named rules, supported surfaces, positive evidence, removal boundary, confidence and test fixtures. Generate CSS and DOM policies from the same reviewed definitions where practical. |
| Declarative redirect rule | Redirect supported top-level Shorts network navigations to the fixed homepage while enabled. |

Planned permissions: `storage`, `declarativeNetRequestWithHostAccess`, `webNavigation`, plus explicit HTTP/HTTPS host grants for `youtube.com` and `www.youtube.com`. Static content-script matches use the same scope. No `activeTab`, `scripting`, `webRequest`, `<all_urls>`, cookies or history permission. Use Tabs API methods for coordination; a broad `tabs` permission is not inherently required for updates/reloads, and matching host permissions cover sensitive URL access on supported pages. Confirm the final manifest against actual API usage. [Chrome Tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs)

The DNR redirect requires host access; use `main_frame` only, exact host/path boundaries, an anchored supported regex and a fixed destination. Validate the compiled pattern with the browser API. Prefer a packaged enabled static ruleset for default-on first installation, then persist its enabled state via ruleset updates. Reconcile it against stored preference on install, update and startup. Do not let an update reset a user's disabled preference. No media/CDN or general API request blocking. DNR rules operate declaratively, but do not cover every service-worker-served response. [Chrome DNR API](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)

## Startup and anti-flash policy

Static CSS loads before `document_start` JavaScript; content scripts can manipulate the DOM in an isolated world. This makes early suppression feasible, not a guarantee about every future YouTube renderer. [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)

Start with narrowly targeted suppression CSS active while the asynchronous preference read is pending. If enabled, keep it active and remove confirmed nodes as they appear. If disabled, override the packaged suppression stylesheet from the content script and do no removal. Keep suppression declarations scoped and avoid `!important` rules that cannot be cleanly overridden. Known Shorts structures may briefly be hidden on a disabled cold load; this is the deliberate tradeoff for reducing enabled flashes. Do not claim synchronous access to extension storage or perfect zero-flash behavior.

If preference reading fails, stop destructive DOM work, release temporary suppression after a bounded timeout (initial target 500 ms), and report degraded state. A persisted network ruleset may still enforce its last state; the UI must surface the mismatch. Test this fallback rather than silently assuming on or off.

## DOM lifecycle and removal boundaries

1. Install one observer on the document as soon as available; scan existing content once. Initially watch `childList` and subtree changes. Observe only necessary attributes such as `href` on relevant candidates to catch reused cards.
2. Queue added subtrees, affected candidates and bounded ancestor checks. Deduplicate work and process batches with an initial 4 ms per-frame budget. Skip disconnected nodes and the extension's own markers. Avoid a full-document query on each mutation.
3. A dedicated Shorts renderer maps to its known outer layout wrapper. A matching link maps only to an approved card or navigation item. Validate the wrapper has no normal content before removing it.
4. Remove the actual node, not just its links or children. Recheck dedicated parent wrappers for leftover heading, controls, padding and empty slots. Never climb unrestrictedly to a feed/grid/page root.
5. On root replacement, route change or `pageshow`, rediscover current roots and reconcile. Clear route-specific queues and detached references; removal is idempotent.

MutationObserver supports filtered observation of DOM changes, not semantic knowledge of Shorts. [WHATWG DOM Standard](https://dom.spec.whatwg.org/#interface-mutationobserver)

Do not retain detached subtrees for restoration: framework listeners and internal state may become stale. Bound caches by document/route and use weak references where appropriate. If mutation churn exceeds the budget, retain early suppression, drain incrementally and expose local diagnostics; do not enter an infinite remove/reinsert loop or permanently disconnect the only observer. Selector errors disable the individual rule and flag coverage degradation. Packaged registry revisions require positive and negative fixtures and a live review. Unknown structure must not trigger deletion of large generic parents.

## Direct URL and SPA enforcement

Use one shared route specification for DNR generation, content-script parsing and worker validation; test all three against the same cases. DNR covers matching network requests such as address-bar entry, reload and new tabs. History changes may have no matching network request.

Content scripts check the route at startup, `pageshow`, `popstate`, `hashchange`, recognized user link activation and DOM batches. Capturing activation handlers prevent known Shorts links before navigation; they also account for keyboard activation and modified/middle clicks where interceptable. Browser context-menu “open in new tab” is covered by the destination network rule. Do not rely on click interception alone.

Worker listeners use top-frame committed navigation, history-state and fragment-update events, with tab-replacement handling, and ask the current content script to reconcile. Read the latest state and validate the current tab URL/document before acting on delayed events. WebNavigation reports History API changes and notes that BFCache restoration may omit DOMContentLoaded; its notifications are not synchronous navigation cancellation. [Chrome webNavigation](https://developer.chrome.com/docs/extensions/reference/api/webNavigation)

On an enabled Shorts route, immediately suppress the known Shorts player/root, pause present media, intercept subsequent play attempts while the route is blocked, and replace location with `https://www.youtube.com/`. The worker supplies a tab-update fallback if the content script cannot respond. Suppression and pausing on this route must never leak to an ordinary watch route. Prefer replacement to avoid a Back-button redirect loop. Do not use `history.back()` or a user-controlled redirect query. Discard the original query/hash at the safe destination; never auto-open the blocked video after disabling.

An isolated-world script cannot assume that patching its own `history.pushState` intercepts page-world calls. No page-world monkey patch is planned initially. SPA navigation notifications and observers are asynchronous, so a transient render/audio race is possible. Strict no-playback acceptance remains a release blocker: if tests expose it, investigate a narrowly scoped page-world interception design with its own review, or revise the supported claim before release. Hiding a player alone does not stop audio. DNR also has service-worker/cache limitations, so it cannot be the sole guard.

## Settings, disable restoration and recovery

Store `{schemaVersion, hideShorts, revision}` in `chrome.storage.local`; default missing valid state to on. Keep desired preference distinct from per-context applied revision/error state. Popup sends a command to the worker, which serializes changes. Subscribe before initial reads and discard stale reads/events by revision. Content scripts observe local storage changes and reconcile. Storage is asynchronous and supports change notifications across extension contexts. [Chrome storage](https://developer.chrome.com/docs/extensions/reference/api/storage)

On enable: mark pending, apply content suppression/route guards in open supported tabs, enable the network ruleset, persist the new revision and reconcile tabs. A tab can provisionally apply the pending command before persistence; reconcile or roll back on failure. Acknowledge success only after the ruleset and reachable target tabs agree. New content scripts also read current persisted state. There is no atomic transaction across storage, DNR and tabs; pending windows and partial failures must be visible.

On disable: show the reload warning in the popup before the user applies the off action; serialize command, disable DNR, persist off and broadcast teardown. Disconnect removal observers, release suppression and route/media handlers, then reload open supported pages to reconstruct removed HTML. Recheck revision before each reload; ignore closed tabs, avoid duplicate reloads, and flag failed/unreachable tabs as needing manual reload. A tab already redirected stays on its current homepage. Once off is applied, future navigation receives no extension filtering.

If storage persistence fails, roll back the ruleset and provisional tab state to the previous committed preference, report errors, and offer retry. If rollback fails, retain pending/error status and reconcile on the next worker event. Startup compares stored desired state with actual ruleset state. Worker globals are caches only: termination loses them, so recover from storage and browser rule state without keepalive loops. [Chrome worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)

Browser-level disabling/uninstalling the extension cannot reliably restore already removed nodes in live pages; reload is required. Existing pages open at installation may need a reload before static scripts attach; report that requirement rather than claiming immediate protection.

## Privacy, accessibility and compatibility

Process page structure locally, without storing page titles, video IDs, URLs or account data. Optional development diagnostics contain aggregate counts and rule identifiers only, stay local and are off in production. No network selector download, analytics or backend. Use packaged executable resources and restrictive extension-page CSP.

Removed nodes must disappear from layout, tab order and accessibility tree. If focused content is removed, move focus to a stable visible page landmark without repeatedly stealing focus. The popup switch exposes checked state, accessible name, keyboard activation, visible focus and pending/error announcements. Explain reload behavior in plain language.

Test light/dark themes, zoom, responsive desktop layouts, signed-in/out pages, localized labels, lazy content and other layout extensions. Grant denial, invalidated content scripts after extension updates, prerender/BFCache, root replacement and changed selectors can degrade coverage. Provide a readable status and manual reload guidance. Compatibility is maintained through testing and releases, not guaranteed by browser APIs.
