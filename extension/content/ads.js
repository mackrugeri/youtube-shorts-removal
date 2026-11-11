(() => {
  const { units, wrappers } = globalThis.youtubeAdSelectors;
  const pending = new Set();
  let frame = 0;
  let attemptedSkip;

  function removeUnit(unit) {
    if (!unit.isConnected) return;
    // Remove the ad's dedicated card, not a surrounding feed or mixed section.
    const card = unit.closest(wrappers);
    (card ?? unit).remove();
  }

  function flush() {
    frame = 0;
    const deadline = performance.now() + 4;
    for (const unit of pending) {
      pending.delete(unit);
      removeUnit(unit);
      if (performance.now() >= deadline) break;
    }
    if (pending.size) frame = requestAnimationFrame(flush);
  }

  function scan(root) {
    if (!(root instanceof Element)) return;
    if (root.matches(units)) pending.add(root);
    for (const unit of root.querySelectorAll(units)) pending.add(unit);
    if (!frame && pending.size) frame = requestAnimationFrame(flush);
  }

  function skipAvailableAd() {
    const player = document.querySelector('#movie_player.ad-showing');
    const skip = player?.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button');
    if (!(skip instanceof HTMLElement) || skip.matches(':disabled, [aria-disabled="true"]') ||
        !skip.getClientRects().length) {
      attemptedSkip = undefined;
      return;
    }
    if (attemptedSkip !== skip) {
      attemptedSkip = skip;
      skip.click();
    }
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) scan(node);
    }
    skipAvailableAd();
  });
  observer.observe(document, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'disabled', 'aria-disabled'],
  });
  addEventListener('pageshow', () => {
    scan(document.documentElement);
    skipAvailableAd();
  });
  document.addEventListener('yt-navigate-finish', () => scan(document.documentElement));
  scan(document.documentElement);
  skipAvailableAd();
})();
