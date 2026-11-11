import '../shared/routes.js';
import '../shared/filters.js';

const details = document.querySelector('.saved-filters');
const lists = document.querySelector('#filters-lists');
const count = document.querySelector('#filters-count');
const status = document.querySelector('#filters-status');
const retry = document.querySelector('#filters-retry');
let filters;
let busy = false;

function render(next) {
  globalThis.focusFilters.validate(next);
  if (filters && next.revision < filters.revision) return;
  filters = next;
  lists.replaceChildren();
  count.textContent = '(' + (next.channels.length + next.videos.length + next.keywords.length) + ')';
  for (const [field, title] of [
    ['channels', 'Channels'], ['videos', 'Videos'], ['keywords', 'Keywords'],
  ]) {
    const heading = document.createElement('h2');
    heading.textContent = title;
    lists.append(heading);
    const list = document.createElement('ul');
    if (!next[field].length) {
      const empty = document.createElement('li');
      empty.textContent = 'None saved';
      list.append(empty);
    }
    for (const entry of next[field]) {
      const value = field === 'keywords' ? entry : field === 'channels' ? entry.key : entry.id;
      const label = field === 'keywords' ? entry : field === 'channels' ? entry.label : entry.title;
      const item = document.createElement('li');
      const text = document.createElement('span');
      text.textContent = label;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.disabled = busy;
      remove.setAttribute('aria-label', 'Remove ' + label);
      remove.addEventListener('click', () => request({
        type: 'filters:change', action: { operation: 'remove', field, value },
      }));
      item.append(text, remove);
      list.append(item);
    }
    lists.append(list);
  }
}

async function request(message = { type: 'filters:get' }) {
  if (busy) return;
  busy = true;
  retry.hidden = true;
  status.textContent = message.type === 'filters:get' ? 'Loading saved blocks…' : 'Removing block…';
  lists.querySelectorAll('button').forEach((button) => { button.disabled = true; });
  try {
    const reply = await chrome.runtime.sendMessage(message);
    if (!reply?.filters) throw new Error(reply?.error || 'Could not load your saved blocks.');
    busy = false;
    render(reply.filters);
    status.textContent = message.type === 'filters:get' ? '' : 'Block removed.';
  } catch (failure) {
    busy = false;
    status.textContent = failure.message;
    retry.hidden = false;
    lists.querySelectorAll('button').forEach((button) => { button.disabled = false; });
  }
}

details.addEventListener('toggle', () => {
  if (details.open) request();
});
retry.addEventListener('click', () => request());
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.focusFilters && details.open && !busy) request();
});
if (details.open) request();
