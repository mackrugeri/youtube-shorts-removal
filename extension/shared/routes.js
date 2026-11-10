globalThis.shortsRoutes = (() => {
  const hosts = ['www.youtube.com', 'youtube.com'];
  const home = 'https://www.youtube.com/';
  const redirectPattern = '^https?://(www\\.)?youtube\\.com(:[0-9]+)?/shorts([/?#]|$)';

  function parse(value, base) {
    try {
      const url = new URL(value, base);
      if (['https:', 'http:'].includes(url.protocol) && hosts.includes(url.hostname)) return url;
    } catch {
      // Invalid URLs are outside the extension's scope.
    }
    return null;
  }

  function isShorts(value, base) {
    const url = parse(value, base);
    return url !== null && (url.pathname === '/shorts' || url.pathname.startsWith('/shorts/'));
  }

  function isChannelShorts(value, base) {
    const url = parse(value, base);
    return url !== null && /^\/(?:@[^/]+|(?:channel|c|user)\/[^/]+)\/shorts\/?$/.test(url.pathname);
  }

  return { hosts, home, redirectPattern, parse, isShorts, isChannelShorts };
})();
