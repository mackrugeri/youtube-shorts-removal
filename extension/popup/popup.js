const toggle = document.querySelector('#hide-shorts');
const feedback = document.querySelector('#feedback');
const status = document.querySelector('#status');
const error = document.querySelector('#error');
const retry = document.querySelector('#retry');
const confirmation = document.querySelector('#confirmation');
const cancel = document.querySelector('#cancel');
const confirm = document.querySelector('#confirm');

let settings;

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
  renderStatus('pending', saving ? 'Applying changes…' : 'Loading your preference…');

  try {
    const response = await chrome.runtime.sendMessage(
      saving ? { type: 'settings:set', hideShorts } : { type: 'settings:get' },
    );
    if (typeof response?.settings?.hideShorts !== 'boolean') throw new Error('Invalid response');

    settings = response.settings;
    if (response.siteAccessNeeded) {
      renderStatus('warning', 'YouTube access needed.',
        'Allow access to YouTube in Chrome’s Extensions menu, then select Retry.', true);
    } else if (response.needsReload) {
      renderStatus('warning', 'Reload needed.',
        'Reload open YouTube tabs to finish applying your preference, then select Retry.', true);
    } else if (settings.hideShorts) {
      renderStatus('success', 'Hide Shorts is on.');
    } else {
      renderStatus('neutral', 'Hide Shorts is off.');
    }
  } catch {
    // Re-read before allowing another change because a reply can fail after a save.
    settings = undefined;
    const message = saving
      ? 'Could not confirm the change. Select Retry to check the current state.'
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
update();
