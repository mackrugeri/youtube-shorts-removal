(() => {
  const routes = globalThis.shortsRoutes;
  const selectors = globalThis.shortsSelectors;
  const candidates = Object.values(selectors).join(', ') + ', a[href]';
  const pending = new Set();
  let enabled = false;
  let revision = -1;
  let frame = 0;

  function isShortsLink(link) {
    return routes.isShorts(link.href) || routes.isChannelShorts(link.href);
  }

  function hasOrdinaryVideo(node) {
    return [...node.querySelectorAll('a[href]')].some((link) => {
      const url = routes.parse(link.href);
      return url?.pathname === '/watch' || url?.pathname === '/playlist';
    });
  }

  function removeItem(item) {
    // Keep focus in the document when the focused card or link disappears.
    if (item.contains(document.activeElement)) document.activeElement.blur();
    item.remove();
  }

  function clean(node) {
    if (!node.isConnected) return;
    const channelPage = routes.isChannelShorts(location.href);
    if (channelPage && node.matches(selectors.channelSection) && !hasOrdinaryVideo(node)) {
      removeItem(node);
      return;
    }

    const links = node.matches('a[href]') ? [node] : [...node.querySelectorAll('a[href]')];
    const dedicated = node.matches(selectors.dedicated);
    if (!dedicated && !links.some(isShortsLink)) return;

    const shelf = node.closest(selectors.shelf);
    if (shelf && !hasOrdinaryVideo(shelf) && (dedicated ||
        shelf.querySelector(selectors.dedicated) ||
        shelf.matches('grid-shelf-view-model, yt-grid-shelf-view-model'))) {
      removeItem(shelf);
      return;
    }
    const nav = node.closest(selectors.navigation);
    if (nav && !hasOrdinaryVideo(nav)) {
      removeItem(nav);
      return;
    }

    const card = node.closest(selectors.card);
    if (card && !hasOrdinaryVideo(card) && (dedicated ||
        links.some((link) => routes.isShorts(link.href)))) {
      removeItem(card);
    } else if (dedicated) {
      removeItem(node);
    }
  }

  function flush() {
    frame = 0;
    const deadline = performance.now() + 4;
    for (const node of pending) {
      pending.delete(node);
      clean(node);
      if (performance.now() >= deadline) break;
    }
    schedule();
  }

  function schedule() {
    if (!frame && pending.size) frame = requestAnimationFrame(flush);
  }

  function enqueue(root) {
    if (!(root instanceof Element) || !root.isConnected) return;
    if (root.matches(candidates)) pending.add(root);
    for (const node of root.querySelectorAll(candidates)) pending.add(node);
    schedule();
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes') enqueue(record.target);
      for (const node of record.addedNodes) enqueue(node);
    }
  });

  function apply(settings) {
    if (typeof settings?.hideShorts !== 'boolean' || settings.revision < revision) return;
    revision = settings.revision;
    enabled = settings.hideShorts;
    document.documentElement.toggleAttribute('data-shorts-removal-off', !enabled);
    if (enabled) {
      observer.observe(document, {
        childList: true, subtree: true, attributes: true, attributeFilter: ['href'],
      });
      enqueue(document.documentElement);
    } else {
      observer.disconnect();
      cancelAnimationFrame(frame);
      frame = 0;
      pending.clear();
    }
  }

  function refresh() {
    return chrome.storage.local.get('settings').then(({ settings }) => {
      apply(settings ?? { hideShorts: true, revision: 0 });
    }).catch(() => {
      if (revision < 0) document.documentElement.setAttribute('data-shorts-removal-off', '');
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) refresh();
  });
  addEventListener('pageshow', refresh);
  document.addEventListener('yt-navigate-finish', () => {
    if (enabled) enqueue(document.documentElement);
  });
  setTimeout(() => {
    if (revision < 0) document.documentElement.setAttribute('data-shorts-removal-off', '');
  }, 500);
  refresh();
})();
