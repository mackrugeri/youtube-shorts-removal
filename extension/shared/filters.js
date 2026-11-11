globalThis.focusFilters = (() => {
  const key = 'focusFilters';
  const empty = { schemaVersion: 1, revision: 0, channels: [], videos: [], keywords: [] };
  const stopWords = new Set(
    'the and for with from this that these those your you our are was were have has had will can how what why when where who into about after before most more best new video videos official full watch today latest live part episode subscribe like share shorts youtube'.split(' '),
  );

  function normalize(text) {
    return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
  }

  function channelKey(value) {
    const url = globalThis.shortsRoutes.parse(value, globalThis.shortsRoutes.home);
    if (!url) return null;
    const match = url.pathname.match(/^\/(?:@[^/]+|(?:channel|c|user)\/[^/]+)(?=\/|$)/);
    if (!match) return null;
    return match[0].startsWith('/@') ? match[0].toLowerCase() : match[0];
  }

  function keywordsFromTitle(title) {
    return [...new Set(normalize(title).split(' '))]
      .filter((word) => word.length >= 3 && /\p{L}/u.test(word) && !stopWords.has(word))
      .slice(0, 5);
  }

  function parseKeywords(text) {
    return [...new Set(text.split(/[,\n]/).map(normalize).filter(Boolean))];
  }

  function match(filters, video) {
    if (filters.videos.some(({ id }) => id === video.id)) return 'Hidden video';
    if (video.channel && filters.channels.some(({ key }) => key === video.channel.key)) {
      return 'Blocked channel';
    }
    const title = ' ' + normalize(video.title) + ' ';
    const keyword = filters.keywords.find((word) => title.includes(' ' + word + ' '));
    return keyword ? 'Keyword “' + keyword + '”' : null;
  }

  function validate(filters) {
    if (filters?.schemaVersion !== 1 || !Number.isSafeInteger(filters.revision) || filters.revision < 0 ||
        !Array.isArray(filters.channels) || !Array.isArray(filters.videos) ||
        !Array.isArray(filters.keywords)) throw new Error('Invalid saved filters');
    if ([filters.channels, filters.videos, filters.keywords].some((list) => list.length > 500)) {
      throw new Error('Too many saved filters');
    }
    if (!filters.channels.every((channel) => channel && typeof channel.key === 'string' &&
        channelKey(channel.key) === channel.key &&
        typeof channel.label === 'string' && channel.label.length <= 160) ||
        !filters.videos.every((video) => video && typeof video.id === 'string' && /^[\w-]{1,64}$/.test(video.id) &&
          typeof video.title === 'string' && video.title.length <= 240) ||
        !filters.keywords.every((word) => typeof word === 'string' && word.length <= 80 &&
          word.length >= 2 && normalize(word) === word)) {
      throw new Error('Invalid saved filters');
    }
    return filters;
  }

  async function read() {
    const data = await chrome.storage.local.get(key);
    return data[key] === undefined ? structuredClone(empty) : validate(data[key]);
  }

  function change(current, action) {
    const next = structuredClone(current);
    next.revision += 1;
    if (action.operation === 'block') {
      const words = parseKeywords(action.keywords);
      if (words.length > 12) throw new Error('Use up to 12 keywords at a time');
      next.keywords = [...new Set([...next.keywords, ...words])];
      if (action.kind === 'channel') {
        const channel = action.channel;
        if (!channel) throw new Error('Channel unavailable');
        if (!next.channels.some(({ key }) => key === channel.key)) next.channels.push(channel);
      } else if (action.kind === 'video') {
        if (!next.videos.some(({ id }) => id === action.video.id)) next.videos.push(action.video);
      } else {
        throw new Error('Unknown block type');
      }
    } else if (action.operation === 'remove') {
      const field = action.field;
      if (!['channels', 'videos', 'keywords'].includes(field)) throw new Error('Unknown filter');
      next[field] = next[field].filter((entry) =>
        (field === 'keywords' ? entry : field === 'channels' ? entry.key : entry.id) !== action.value);
    } else {
      throw new Error('Unknown operation');
    }
    return validate(next);
  }

  return { key, normalize, channelKey, keywordsFromTitle, parseKeywords, match, validate, read, change };
})();
