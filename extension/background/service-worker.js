import '../shared/routes.js';

import { readSettings, SETTINGS_KEY } from '../shared/settings.js';

const rulesetId = 'shorts_redirect';
const { hosts, home, isShorts } = globalThis.shortsRoutes;
const youtubePatterns = hosts.map((host) => `*://${host}/*`);
let queue = Promise.resolve();

function serialize(task) {
  const request = queue.then(task);
  queue = request.catch(() => {});
  return request;
}

async function syncRules(enabled) {
  const active = await chrome.declarativeNetRequest.getEnabledRulesets();
  if (active.includes(rulesetId) === enabled) return;
  await chrome.declarativeNetRequest.updateEnabledRulesets(enabled
    ? { enableRulesetIds: [rulesetId] }
    : { disableRulesetIds: [rulesetId] });
}

async function applySettings(current, hideShorts) {
  const settings = { ...current, hideShorts, revision: current.revision + 1 };
  await syncRules(hideShorts);
  try {
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  } catch (error) {
    await syncRules(current.hideShorts);
    throw error;
  }

  const tabs = await chrome.tabs.query({ url: youtubePatterns }).catch(() => null);
  if (!tabs) return { settings, needsReload: true };
  const applied = await Promise.allSettled(tabs.map(async ({ id }) => {
    if (hideShorts) {
      const reply = await chrome.tabs.sendMessage(id, { type: 'settings:refresh' }, { frameId: 0 });
      if (reply?.revision !== settings.revision) throw new Error('Tab has not applied settings');
    } else {
      await chrome.tabs.reload(id);
    }
  }));
  return { settings, needsReload: applied.some((result) => result.status === 'rejected') };
}

function reconcileRules() {
  serialize(async () => syncRules((await readSettings()).hideShorts)).catch(() => {
    // The next settings request will retry reconciliation.
  });
}

chrome.runtime.onInstalled.addListener(reconcileRules);
chrome.runtime.onStartup.addListener(reconcileRules);

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.url !== chrome.runtime.getURL('popup/popup.html')) return;
  const { type, hideShorts } = message ?? {};
  if (type !== 'settings:get' &&
      !(type === 'settings:set' && typeof hideShorts === 'boolean')) return;

  const request = serialize(async () => {
    const current = await readSettings();
    if (type === 'settings:get' || hideShorts === current.hideShorts) {
      await syncRules(current.hideShorts);
      return { settings: current };
    }

    return applySettings(current, hideShorts);
  });

  request.then(
    respond,
    () => respond({ error: 'settings-unavailable' }),
  );
  return true;
});

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
