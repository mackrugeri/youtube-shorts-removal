const toggle = document.querySelector('#hide-shorts');
const feedback = document.querySelector('#feedback');
const status = document.querySelector('#status');
const error = document.querySelector('#error');
const retry = document.querySelector('#retry');
const confirmation = document.querySelector('#confirmation');
const cancel = document.querySelector('#cancel');
const confirm = document.querySelector('#confirm');

let settings;

// Open the popup page with ?preview=<state> to inspect release copy and styling.
const releasePreviews = new Map([
  ['applying', ['pending', 'Applying changes…', 'Updating your YouTube tabs.', true]],
  ['hidden', ['success', 'Shorts hidden', 'Hide Shorts is active on supported YouTube tabs.', true]],
  ['off', ['neutral', 'Hide Shorts is off', 'YouTube is back to its usual layout.', false]],
  ['site-access', ['warning', 'YouTube access needed',
    'Allow this extension to access YouTube in Chrome’s Extensions menu, then reopen the popup.', true]],
  ['reload', ['warning', 'Reload needed',
    'Reload any open YouTube tabs that still show the previous layout.', false]],
]);

function renderStatus(state, title, detail = '', canRetry = false) {
  feedback.dataset.state = state;
  const isError = state === 'error';
  status.textContent = isError ? '' : [title, detail].filter(Boolean).join(' ');
  error.textContent = isError ? title : '';
  retry.hidden = !canRetry;
}

function showConfirmation(open) {
  confirmation.hidden = !open;
  if (open) cancel.focus();
}

async function update(hideShorts) {
  const saving = hideShorts !== undefined;
  const restoreFocus = [toggle, retry, confirm].includes(document.activeElement);

  toggle.disabled = true;
  showConfirmation(false);
  renderStatus('pending', saving ? 'Saving your preference…' : 'Loading your preference…');

  try {
    const response = await chrome.runtime.sendMessage(
      saving ? { type: 'settings:set', hideShorts } : { type: 'settings:get' },
    );
    if (typeof response?.settings?.hideShorts !== 'boolean') throw new Error('Invalid response');

    settings = response.settings;
    renderStatus('success', settings.hideShorts ? 'Preference saved: On' : 'Preference saved: Off');
  } catch {
    // Re-read before allowing another change because a reply can fail after a save.
    settings = undefined;
    const message = saving
      ? 'Could not confirm the save. Retry to check your preference.'
      : 'Could not load your preference. Select Retry to check again.';
    renderStatus('error', message, '', true);
  } finally {
    toggle.checked = settings?.hideShorts ?? false;
    toggle.disabled = !settings;
    if (restoreFocus && document.activeElement === document.body) {
      (settings ? toggle : retry).focus();
    }
  }
}

toggle.addEventListener('change', () => {
  const requested = toggle.checked;
  toggle.checked = settings.hideShorts;
  if (requested) {
    update(true);
  } else {
    showConfirmation(true);
  }
});

cancel.addEventListener('click', () => {
  showConfirmation(false);
  toggle.focus();
});

confirmation.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    cancel.click();
  }
});

confirm.addEventListener('click', () => update(false));
retry.addEventListener('click', () => update());
const preview = releasePreviews.get(new URLSearchParams(location.search).get('preview'));
if (preview) {
  const [state, title, detail, checked] = preview;
  toggle.checked = checked;
  document.querySelector('footer').textContent = 'Sample status for the release popup.';
  renderStatus(state, title, detail);
} else {
  update();
}
