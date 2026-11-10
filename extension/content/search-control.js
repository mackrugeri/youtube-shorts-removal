(() => {
  const button = document.createElement('button');
  button.id = 'shorts-removal-search-control';
  button.type = 'button';
  button.setAttribute('role', 'switch');
  button.setAttribute('aria-label', 'Hide Shorts');
  const label = document.createElement('span');
  label.className = 'shorts-removal-control-label';
  label.textContent = 'Hide Shorts';
  const state = document.createElement('span');
  state.className = 'shorts-removal-control-state';
  state.setAttribute('aria-hidden', 'true');
  state.textContent = '…';
  button.append(label, state);
  button.disabled = true;

  const dialog = document.createElement('dialog');
  dialog.id = 'shorts-removal-confirmation';
  dialog.setAttribute('aria-labelledby', 'shorts-removal-confirmation-title');
  dialog.setAttribute('aria-describedby', 'shorts-removal-confirmation-description');
  dialog.innerHTML = `
    <h2 id="shorts-removal-confirmation-title">Turn off Hide Shorts?</h2>
    <p id="shorts-removal-confirmation-description">Open YouTube tabs will reload. Playback will stop and unsaved changes may be lost.</p>
    <div class="shorts-removal-dialog-actions">
      <button type="button" autofocus>Cancel</button>
      <button type="button">Turn off</button>
    </div>
  `;
  const [cancel, turnOff] = dialog.querySelectorAll('button');
  cancel.addEventListener('click', () => dialog.close());
  turnOff.addEventListener('click', (event) => {
    if (!event.isTrusted) return;
    dialog.close();
    apply(false);
  });
  dialog.addEventListener('close', () => button.focus());

  let enabled;
  let revision = -1;
  let applying = false;

  function showState(settings) {
    if (typeof settings?.hideShorts !== 'boolean' ||
        !Number.isSafeInteger(settings.revision) || settings.revision < revision) return;
    revision = settings.revision;
    enabled = settings.hideShorts;
    button.setAttribute('aria-checked', String(enabled));
    state.textContent = enabled ? 'On' : 'Off';
    button.title = enabled ? 'Hide Shorts is on' : 'Hide Shorts is off';
  }

  async function refresh() {
    try {
      const { settings } = await chrome.storage.local.get('settings');
      showState(settings ?? { hideShorts: true, revision: 0 });
      button.disabled = applying || enabled === undefined;
    } catch {
      button.title = 'Open the extension popup to check Hide Shorts settings';
    }
  }

  button.addEventListener('click', (event) => {
    if (!event.isTrusted || button.disabled || enabled === undefined) return;
    if (enabled) {
      if (!dialog.isConnected) document.body.append(dialog);
      dialog.showModal();
    } else {
      apply(true);
    }
  });

  async function apply(hideShorts) {
    applying = true;
    button.disabled = true;
    button.title = 'Applying changes…';
    try {
      const reply = await chrome.runtime.sendMessage({ type: 'settings:set', hideShorts });
      if (!reply?.settings) throw new Error('Settings unavailable');
      showState(reply.settings);
      if (reply.siteAccessNeeded || reply.needsReload) {
        button.title = 'Open the extension popup for help applying Hide Shorts';
      }
    } catch {
      button.title = 'Could not apply changes. Try again or open the extension popup.';
    } finally {
      applying = false;
      button.disabled = false;
      if (document.activeElement === document.body) button.focus();
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings?.newValue) showState(changes.settings.newValue);
  });
  addEventListener('pageshow', refresh);

  const mastheadSelector = 'ytd-masthead, yt-masthead';

  function mount() {
    const masthead = document.querySelector(mastheadSelector);
    if (!masthead) return;
    const voice = masthead.querySelector('#voice-search-button, #voice-search');
    const center = masthead.querySelector('#center');
    const actions = masthead.querySelector('#end, #buttons');
    if (voice && voice.nextElementSibling !== button) {
      voice.after(button);
    } else if (!voice) {
      const destination = center ?? actions;
      if (destination && button.parentElement !== destination) destination.append(button);
    }
  }

  // YouTube can insert or replace its masthead after the document starts.
  const observer = new MutationObserver((records) => {
    if (!button.isConnected || records.some(({ target }) => target.closest?.(mastheadSelector))) mount();
  });
  observer.observe(document, { childList: true, subtree: true });
  mount();
  refresh();
})();
