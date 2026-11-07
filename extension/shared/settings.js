export const SETTINGS_KEY = 'settings';

export const DEFAULT_SETTINGS = Object.freeze({
  schemaVersion: 1,
  hideShorts: true,
  revision: 0,
});

export async function readSettings() {
  const { [SETTINGS_KEY]: settings } = await chrome.storage.local.get(SETTINGS_KEY);
  if (settings === undefined) return DEFAULT_SETTINGS;

  if (settings?.schemaVersion !== DEFAULT_SETTINGS.schemaVersion ||
      typeof settings.hideShorts !== 'boolean' ||
      !Number.isSafeInteger(settings.revision) || settings.revision < 0) {
    throw new Error('Invalid settings');
  }

  return settings;
}
