# Technical reference review

[Overview](../README.md) · [Architecture](architecture.md)

Reviewed November 6, 2026 using primary official documentation. This verifies platform concepts, not this unbuilt extension or YouTube's current DOM. API behavior must still be tested on the selected minimum browser version. Architecture choices are our proposals; these sources do not endorse or guarantee them.

| Official source | Verified platform fact | Proposed use / limit |
| --- | --- | --- |
| [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) | Static declarations can inject CSS/JS; `document_start` runs after CSS and before page scripts; isolated-world variables differ from page-world variables. | Early suppression and DOM controller. Cannot assume isolated-world history patches intercept YouTube's own calls. |
| [Chrome declarativeNetRequest](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest) | Declarative redirect rules support top-level request filtering; redirect permissions matter; requests served by site service workers/CacheStorage have limitations. | Fixed homepage redirect with exact host/path and `main_frame`; additional guards needed for SPA/cache behavior. |
| [Chrome webNavigation](https://developer.chrome.com/docs/extensions/reference/api/webNavigation) | Navigation, History API and fragment events are available with permission; BFCache may omit DOMContentLoaded. | Recovery signals, not a synchronous cancellation or guaranteed pre-playback barrier. |
| [Chrome storage](https://developer.chrome.com/docs/extensions/reference/api/storage) | Extension storage is asynchronous, available across contexts and supports change tracking. | Local preference/revision and propagation, with explicit read/write races and error handling. |
| [Chrome extension worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) | Workers can terminate; global variables are lost; persistent state belongs in storage. | Event-driven coordinator and startup reconciliation, without keepalive polling. |
| [Chrome Tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs) | Tab operations do not universally require the broad `tabs` permission; sensitive tab properties require appropriate access. | Coordinate supported tabs using scoped host access; verify actual methods against final manifest. |
| [WHATWG DOM Standard: MutationObserver](https://dom.spec.whatwg.org/#interface-mutationobserver) | Defines subtree/child-list/attribute observation and mutation record delivery. | Batched incremental cleanup; the extension must supply all semantic classification and performance limits. |

No official source here specifies YouTube renderer tags, guarantees a stable DOM, or proves prevention of every transient SPA playback. Current selectors, route normalization, timing, compatibility and restoration remain future implementation validation work.
