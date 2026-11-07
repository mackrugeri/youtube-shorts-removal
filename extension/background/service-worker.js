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
