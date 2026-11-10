import '../shared/routes.js';

import { readSettings, SETTINGS_KEY } from '../shared/settings.js';

let queue = Promise.resolve();

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.url !== chrome.runtime.getURL('popup/popup.html')) return;
  const { type, hideShorts } = message ?? {};
  if (type !== 'settings:get' &&
      !(type === 'settings:set' && typeof hideShorts === 'boolean')) return;

  const request = queue.then(async () => {
    const current = await readSettings();
    if (type === 'settings:get' || hideShorts === current.hideShorts) return current;

    const settings = { ...current, hideShorts, revision: current.revision + 1 };
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
    return settings;
  });

  queue = request.catch(() => {});
  request.then(
    (settings) => respond({ settings }),
    () => respond({ error: 'settings-unavailable' }),
  );
  return true;
});

const { hosts, home, isShorts } = globalThis.shortsRoutes;
const youtubeNavigation = { url: hosts.map((host) => ({ hostEquals: host, schemes: ['http', 'https'] })) };

async function checkShortsRoute({ frameId, tabId, url, documentId }) {
  if (frameId !== 0 || !isShorts(url)) return;
  try {
    if (!(await readSettings()).hideShorts) return;
    const reply = await chrome.tabs.sendMessage(tabId, { type: 'navigation:check' }, { documentId })
      .catch(() => null);
    if (reply?.blocked) return;

    const current = await chrome.webNavigation.getFrame({ tabId, frameId });
    if (current?.documentId === documentId && isShorts(current.url) &&
        (await readSettings()).hideShorts) {
      await chrome.tabs.update(tabId, { url: home });
    }
  } catch {
    // The tab or its permissions may have changed while checking the route.
  }
}

chrome.webNavigation.onCommitted.addListener(checkShortsRoute, youtubeNavigation);
chrome.webNavigation.onHistoryStateUpdated.addListener(checkShortsRoute, youtubeNavigation);
chrome.webNavigation.onReferenceFragmentUpdated.addListener(checkShortsRoute, youtubeNavigation);
chrome.webNavigation.onTabReplaced.addListener(async ({ tabId }) => {
  const frame = await chrome.webNavigation.getFrame({ tabId, frameId: 0 }).catch(() => null);
  if (frame) await checkShortsRoute({ ...frame, tabId, frameId: 0 });
});
