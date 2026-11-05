# Future implementation roadmap

[Overview](../README.md) · [Architecture](architecture.md) · [Acceptance plan](testing.md)

No phase has been implemented. This documentation task does not authorize dependency installation, source implementation, commits or publication.

| Phase | Future deliverable | Exit condition |
| --- | --- | --- |
| 1. Validate feasibility | Inspect current live desktop markup; collect sanitized positive/negative fixtures; prototype route timing in a disposable environment | Confirm wrapper boundaries for every required surface; measure SPA playback race and decide whether extra interception is necessary. |
| 2. Extension skeleton and state | MV3 packaging, popup, local schema, worker listener lifecycle and serialized settings coordinator | Explicit minimum browser version; permissions justified; persistence, errors and rapid toggle tests pass. |
| 3. Navigation enforcement | Shared route specification, packaged DNR redirect rules, content guards and navigation recovery | Direct/SPA/history/cached-route gates pass without Shorts playback or ordinary watch redirects. |
| 4. Surface removal | Central registry, early CSS, bounded observer and wrapper cleanup | All inventory surfaces pass removal and false-positive fixtures plus live visual review; no empty shelves. |
| 5. Restoration and resilience | Off-action warning, teardown/reload, startup/update reconciliation, partial-failure UI | Multi-tab, disabled restart, worker suspension and error-injection tests pass. |
| 6. Release preparation | Performance/a11y/compatibility review, privacy description, packaging and user instructions | Entire acceptance matrix passes; documented limitations agree with observed behavior. Publishing requires separate authorization. |

Implement only after an explicit subsequent request. Prefer a small local build with packaged selectors; choose tooling at that time rather than installing speculative dependencies now. Keep future source, fixtures and tests clearly separated from these proposal documents.

After an initial release, review reported selector breakage with sanitized reproduction steps, add regression fixtures and ship a packaged update. Explore Edge/other Chromium validation next, then separate Firefox/Safari feasibility. Mobile and expanded domains are independent scope decisions. Never silently broaden host permissions or redefine “Shorts” to mean all brief videos.
