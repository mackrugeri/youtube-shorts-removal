const assert = require('node:assert/strict');
require('../../extension/shared/routes.js');
require('../../extension/shared/filters.js');
const policy = globalThis.focusFilters;
const initial = { schemaVersion: 1, revision: 0, channels: [], videos: [], keywords: [] };

assert.equal(policy.channelKey('https://www.youtube.com/@Creator/videos'), '/@creator');
assert.equal(policy.channelKey('https://example.com/@creator'), null);
assert.equal(policy.channelKey('/channel/UCAbC'), '/channel/UCAbC');
assert.deepEqual(policy.keywordsFromTitle('Watch the official Prank video today!'), ['prank']);
assert.deepEqual(policy.parseKeywords('Prank, prank, celebrity gossip'), ['prank', 'celebrity gossip']);
let filters = policy.change(initial, {
  operation: 'block', kind: 'video', video: { id: 'testVideo01', title: 'Epic prank' }, keywords: 'Prank',
});
assert.equal(filters.revision, 1);
assert.equal(policy.match(filters, { id: 'testVideo01', title: 'Renamed' }), 'Hidden video');
assert.equal(policy.match(filters, { id: 'different01', title: 'Another PRANK!' }), 'Keyword “prank”');
assert.equal(policy.match(filters, { id: 'different01', title: 'Prankster biography' }), null);
assert.equal(initial.videos.length, 0);
filters = policy.change(filters, {
  operation: 'block', kind: 'channel', channel: { key: '/@creator', label: 'Creator' },
  keywords: 'gardening',
});
assert.equal(policy.match(filters, {
  id: 'different02', title: 'Unrelated title', channel: { key: '/@creator' },
}), 'Blocked channel');
assert.equal(policy.match(filters, { id: 'different03', title: 'Gardening tips' }), 'Keyword “gardening”');
filters = policy.change(filters, { operation: 'remove', field: 'keywords', value: 'prank' });
assert.equal(policy.match(filters, { id: 'different01', title: 'Another prank' }), null);
assert.equal(filters.videos.length, 1);
assert.throws(() => policy.change(filters, { operation: 'block', kind: 'channel', keywords: '' }));
assert.throws(() => policy.change(filters, { operation: 'block', kind: 'video',
  video: { id: 'bad?', title: 'Bad' }, keywords: '' }));
assert.throws(() => policy.change(filters, { operation: 'block', kind: 'video',
  video: { id: 'okay', title: 'Title' }, keywords: 'a' }));
assert.throws(() => policy.validate({ ...filters, schemaVersion: 99 }));
