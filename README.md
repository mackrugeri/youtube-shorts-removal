# YouTube Shorts Removal

Design for a desktop browser extension that lets the user turn **Hide Shorts** on or off. When on, recognized YouTube Shorts surfaces and their complete dedicated containers are removed, and direct Shorts routes are redirected away. Ordinary YouTube remains usable.

**Status: loadable Chrome UI preview.** The popup saves the Hide Shorts preference locally. Shorts filtering, route redirects, and tab restoration are planned.

To try the popup, open Chrome's Extensions page, enable Developer mode, and choose **Load unpacked**. Select the project's `extension` folder, then open **YouTube Shorts Removal** from the Extensions menu.

## Project documentation

- [Requirements and coverage](docs/requirements.md): product boundaries and required behavior.
- [Architecture](docs/architecture.md): components, state, removal and navigation enforcement.
- [Testing and acceptance](docs/testing.md): concrete release gates and coverage matrix.
- [Implementation roadmap](docs/roadmap.md): phased future work.
- [Technical references](docs/references.md): official sources reviewed on November 6, 2026.

## Initial decisions

Desktop Chromium Manifest V3 first, with Chrome as the reference browser. Default Hide Shorts to on after successful installation initialization. Store the preference locally and apply it to all supported tabs. Use early CSS to reduce flashes, then physically remove confirmed dedicated Shorts containers. Use declarative network redirects plus content-script and navigation guards for direct routes. Redirect to the fixed YouTube homepage, never to a normal watch URL for the same video.

Scope is YouTube's Shorts classification and routes, not every short-duration video. Other browsers, mobile, embedded players, and unsupported hosts require separate work. YouTube can change its DOM; compatibility must be maintained and cannot be guaranteed indefinitely. Zero transient playback across every SPA timing race is a release validation challenge, not a proven capability. See the linked requirements and tests for the precise contract.
