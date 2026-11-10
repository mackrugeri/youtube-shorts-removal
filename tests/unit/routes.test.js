const assert = require('node:assert/strict');
require('../../extension/shared/routes.js');
const fixtures = require('../fixtures/routes.json');
const routes = globalThis.shortsRoutes;
const rule = new RegExp(routes.redirectPattern);

for (const url of fixtures.shorts) {
  assert.equal(routes.isShorts(url), true, url);
  assert.equal(rule.test(new URL(url).href), true, url);
}
for (const url of fixtures.ordinary) {
  assert.equal(routes.isShorts(url), false, url);
  assert.equal(rule.test(new URL(url).href), false, url);
}
assert.equal(routes.isShorts('/shorts/abc', routes.home), true);
assert.equal(routes.isChannelShorts('/@creator/shorts', routes.home), true);
assert.equal(routes.isShorts('not a URL'), false);
