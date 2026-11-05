# YouTube Shorts Removal

Design for a desktop browser extension that lets the user turn **Hide Shorts** on or off. When on, recognized YouTube Shorts surfaces and their complete dedicated containers are removed, and direct Shorts routes are redirected away. Ordinary YouTube remains usable.

**Status: documentation and proposed architecture only.** There is no extension, manifest, source code, dependency setup, or verified browser behavior in this project yet. Do not treat the acceptance criteria as completed tests.

## Project documentation

- [Requirements and coverage](docs/requirements.md): product boundaries and required behavior.
- [Architecture](docs/architecture.md): components, state, removal and navigation enforcement.
- [Testing and acceptance](docs/testing.md): concrete release gates and coverage matrix.
- [Implementation roadmap](docs/roadmap.md): phased future work.
- [Technical references](docs/references.md): official sources reviewed on November 6, 2026.

## Initial decisions

Desktop Chromium Manifest V3 first, with Chrome as the reference browser. Default Hide Shorts to on after successful installation initialization. Store the preference locally and apply it to all supported tabs. Use early CSS to reduce flashes, then physically remove confirmed dedicated Shorts containers. Use declarative network redirects plus content-script and navigation guards for direct routes. Redirect to the fixed YouTube homepage, never to a normal watch URL for the same video.

Scope is YouTube's Shorts classification and routes, not every short-duration video. Other browsers, mobile, embedded players, and unsupported hosts require separate work. YouTube can change its DOM; compatibility must be maintained and cannot be guaranteed indefinitely. Zero transient playback across every SPA timing race is a release validation challenge, not a proven capability. See the linked requirements and tests for the precise contract.
