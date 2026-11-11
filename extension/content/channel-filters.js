(() => {
  const policy = globalThis.focusFilters;
  const cardSelector = globalThis.shortsSelectors.card;
  const pending = new Set();
  let filters;
  let frame = 0;
  let selection;
  let opener;
  let saving = false;
  let contextInvalidated = false;

  const dialog = document.createElement('dialog');
  dialog.id = 'focus-filter-dialog';
  dialog.setAttribute('aria-labelledby', 'focus-filter-title');
  dialog.innerHTML = `
    <form>
      <h2 id="focus-filter-title"></h2>
      <p class="focus-filter-target"></p>
      <label for="focus-filter-keywords">Also block these keywords</label>
      <textarea id="focus-filter-keywords" rows="3" maxlength="1000" aria-describedby="focus-filter-help"></textarea>
      <p id="focus-filter-help">Suggested from this title. Edit or remove broad words before saving. Separate words or phrases with commas. Matching video titles from any channel will be hidden. Your blocks are kept in this Chrome profile after you restart.</p>
      <p class="focus-filter-error" role="alert"></p>
      <div class="focus-filter-actions">
        <button type="button">Cancel</button>
        <button type="button" id="focus-filter-reload" hidden>Reload YouTube</button>
        <button type="submit">Save block</button>
      </div>
    </form>`;
  const form = dialog.querySelector('form');
  const keywords = dialog.querySelector('textarea');
  const save = dialog.querySelector('[type="submit"]');
  const cancel = dialog.querySelector('[type="button"]');
  const error = dialog.querySelector('.focus-filter-error');
  const reload = dialog.querySelector('#focus-filter-reload');

  function needsReload(failure) {
    return !chrome.runtime?.id || /extension context invalidated/i.test(failure?.message ?? '');
  }

  function showReloadRequired() {
    contextInvalidated = true;
    error.textContent = 'The extension was updated or reloaded. Reload YouTube, then try saving again. Your existing saved blocks are safe.';
    save.hidden = true;
    save.disabled = true;
    reload.hidden = false;
  }

  reload.addEventListener('click', () => location.reload());

  function controlsHost(card) {
    // Keep actions inside the metadata flow. Adding a second child to YouTube's
    // full-height outer card can push it to the bottom of the entire grid row.
    return card.querySelector('.yt-lockup-metadata-view-model__text-container') ??
      card.querySelector('#meta') ??
      card.querySelector('ytd-video-meta-block') ??
      card.querySelector('h3')?.parentElement ??
      card;
  }

  function actionIcon(path) {
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    const shape = document.createElementNS(icon.namespaceURI, 'path');
    shape.setAttribute('d', path);
    icon.append(shape);
    return icon;
  }

  function metadata(card) {
    const titleLink = card.querySelector(
      'a#video-title, a#video-title-link, .yt-lockup-metadata-view-model__title a, h3 a',
    ) ?? card.querySelector('a[href*="/watch?"], a[href*="/shorts/"]');
    if (!titleLink) return null;
    const url = globalThis.shortsRoutes.parse(titleLink.href);
    const id = url?.pathname === '/watch' ? url.searchParams.get('v') :
      url?.pathname.startsWith('/shorts/') ? url.pathname.split('/')[2] : null;
    const title = (titleLink.textContent.trim() || titleLink.getAttribute('title') || '').slice(0, 240);
    if (!id || !/^[\w-]{1,64}$/.test(id) || !title) return null;

    const channelLink = [...card.querySelectorAll('a[href]')].find((link) =>
      policy.channelKey(link.href));
    const channel = channelLink ? {
      key: policy.channelKey(channelLink.href),
      label: (channelLink.textContent.trim() || policy.channelKey(channelLink.href)).slice(0, 160),
    } : null;
    return { id, title, channel };
  }

  function open(card, kind, trigger) {
    const video = metadata(card);
    if (!video || (kind === 'channel' && !video.channel)) return;
    selection = { video, kind };
    opener = trigger;
    dialog.querySelector('h2').textContent = kind === 'channel' ? 'Block this channel' : 'Hide this video';
    dialog.querySelector('.focus-filter-target').textContent =
      kind === 'channel' ? video.channel.label : video.title;
    keywords.value = policy.keywordsFromTitle(video.title).join(', ');
    error.textContent = '';
    if (!dialog.isConnected) document.body.append(dialog);
    dialog.showModal();
    if (contextInvalidated || needsReload()) {
      showReloadRequired();
      reload.focus();
    } else {
      keywords.focus();
    }
  }

  cancel.addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', (event) => {
    if (saving) event.preventDefault();
  });
  dialog.addEventListener('close', () => {
    if (opener?.isConnected && !opener.closest('[data-focus-filter-hidden]')) opener.focus();
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!event.isTrusted || save.disabled || !selection) return;
    if (needsReload()) {
      showReloadRequired();
      reload.focus();
      return;
    }
    const words = policy.parseKeywords(keywords.value);
    if (words.length > 12 || words.some((word) => word.length < 2 || word.length > 80)) {
      error.textContent = 'Use up to 12 keywords or phrases, each between 2 and 80 characters.';
      return;
    }

    save.disabled = true;
    saving = true;
    cancel.disabled = true;
    error.textContent = '';
    save.textContent = 'Saving…';
    try {
      const { video, kind } = selection;
      const reply = await chrome.runtime.sendMessage({
        type: 'filters:change',
        action: {
          operation: 'block', kind, video: { id: video.id, title: video.title },
          channel: video.channel, keywords: keywords.value,
        },
      });
      if (!reply?.filters) throw new Error(reply?.error || 'Could not confirm this save. Please try again.');
      setFilters(reply.filters);
      dialog.close();
    } catch (failure) {
      if (needsReload(failure)) {
        showReloadRequired();
        reload.focus();
      } else {
        error.textContent = failure.message;
      }
    } finally {
      saving = false;
      save.disabled = contextInvalidated;
      cancel.disabled = false;
      save.textContent = 'Save block';
    }
  });

  function process(card) {
    if (!card.isConnected) return;
    const video = metadata(card);
    const reason = video && filters ? policy.match(filters, video) : null;
    card.toggleAttribute('data-focus-filter-hidden', Boolean(reason));
    if (reason) return;
    const existing = card.querySelector('[data-focus-filter-controls]');
    if (!video) {
      existing?.remove();
      return;
    }
    if (existing) {
      existing.querySelector('[data-block-channel]').disabled = !video.channel;
      const host = controlsHost(card);
      if (existing.parentElement !== host) host.append(existing);
      return;
    }

    const controls = document.createElement('div');
    controls.setAttribute('data-focus-filter-controls', '');
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', 'Video filtering');
    const hide = document.createElement('button');
    hide.type = 'button';
    hide.textContent = 'Hide video';
    hide.title = 'Hide this video and choose related keywords';
    hide.prepend(actionIcon('M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.8 5.2A11.6 11.6 0 0112 5c6 0 10 7 10 7a17 17 0 01-3.1 3.8M6.2 6.2A20.8 20.8 0 002 12s4 7 10 7a11 11 0 005.8-1.8'));
    hide.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.isTrusted) open(card, 'video', hide);
    });
    const channel = document.createElement('button');
    channel.type = 'button';
    channel.textContent = 'Block channel';
    channel.prepend(actionIcon('M21 12a9 9 0 11-18 0 9 9 0 0118 0ZM5.6 5.6l12.8 12.8'));
    channel.setAttribute('data-block-channel', '');
    channel.disabled = !video.channel;
    channel.title = video.channel ? 'Block this channel and related keywords' : 'Channel link unavailable on this card';
    channel.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.isTrusted) open(card, 'channel', channel);
    });
    controls.append(hide, channel);
    controlsHost(card).append(controls);
  }

  function flush() {
    frame = 0;
    const deadline = performance.now() + 4;
    for (const card of pending) {
      pending.delete(card);
      process(card);
      if (performance.now() >= deadline) break;
    }
    if (pending.size) frame = requestAnimationFrame(flush);
  }

  function queue(root) {
    const element = root instanceof Element ? root : root.parentElement;
    if (!element || element.closest('[data-focus-filter-controls], #focus-filter-dialog')) return;
    const card = element.closest(cardSelector);
    if (card) pending.add(card.closest('ytd-rich-item-renderer') ?? card);
    for (const candidate of element.querySelectorAll(cardSelector)) {
      if (!candidate.parentElement?.closest(cardSelector)) pending.add(candidate);
    }
    if (!frame && pending.size) frame = requestAnimationFrame(flush);
  }

  function setFilters(next) {
    policy.validate(next);
    if (filters && next.revision < filters.revision) return;
    filters = next;
    queue(document.documentElement);
  }

  async function refresh() {
    try {
      setFilters(await policy.read());
    } catch (failure) {
      if (needsReload(failure)) {
        contextInvalidated = true;
        if (dialog.open) showReloadRequired();
        return;
      }
      // Leave videos visible when saved filters cannot be read.
      filters = undefined;
      queue(document.documentElement);
    }
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type !== 'childList' || record.removedNodes.length) queue(record.target);
      for (const added of record.addedNodes) queue(added);
    }
  });
  observer.observe(document, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: ['href', 'title'],
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[policy.key]) refresh();
  });
  addEventListener('pageshow', refresh);
  document.addEventListener('yt-navigate-finish', () => queue(document.documentElement));
  refresh();
})();
