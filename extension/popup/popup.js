const toggle = document.querySelector('#hide-shorts');
const status = document.querySelector('#status');
const error = document.querySelector('#error');
const retry = document.querySelector('#retry');
const confirmation = document.querySelector('#confirmation');
const cancel = document.querySelector('#cancel');
const confirm = document.querySelector('#confirm');

let settings;

function showConfirmation(open) {
  confirmation.hidden = !open;
  if (open) cancel.focus();
}

async function update(hideShorts) {
  const saving = hideShorts !== undefined;
  const restoreFocus = [toggle, retry, confirm].includes(document.activeElement);

  toggle.disabled = true;
  retry.hidden = true;
  showConfirmation(false);
  error.textContent = '';
  status.textContent = saving ? 'Saving your preference…' : 'Loading your preference…';

  try {
    const response = await chrome.runtime.sendMessage(
      saving ? { type: 'settings:set', hideShorts } : { type: 'settings:get' },
    );
    if (typeof response?.settings?.hideShorts !== 'boolean') throw new Error('Invalid response');

    settings = response.settings;
    status.textContent = settings.hideShorts ? 'Preference: On' : 'Preference: Off';
  } catch {
    // Re-read before allowing another change because a reply can fail after a save.
    settings = undefined;
    status.textContent = '';
    error.textContent = saving
      ? 'Could not confirm the save. Retry to check your preference.'
      : 'Could not load your preference.';
    retry.hidden = false;
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
