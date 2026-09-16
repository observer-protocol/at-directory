// Gate for the display policy's hide/show rules. apps/web carries no test
// runner, so this is a plain tsx script wired to `pnpm -F @at-directory/web
// test`: it throws on the first failed assertion and fails CI with it.
// Adding vitest here would be a dependency change for four assertions.
import assert from 'node:assert/strict';
import type { Merchant } from '@at-directory/core';
import {
  isLiveOpenCall,
  isOpenCall,
  liveOpenCalls,
  MIN_OPEN_CALLS_TO_SHOW,
} from './display-policy.ts';

const call = (overrides: Partial<Merchant>): Merchant => ({
  id: 'c',
  name: 'C',
  url: 'https://c.example',
  description: '',
  category: 'marketplace',
  rails: [{ rail: 'lightning', health: 'unknown' }],
  op_trust_tier: 1,
  agent_callable_tier: 'human-checkout',
  accepts_usdc: false,
  accepts_x402: false,
  pricing_model: 'per-product',
  source: 'integrated',
  listing_type: 'open-call',
  ...overrides,
});

const NOW = Date.parse('2026-09-15T00:00:00Z');

// The one that matters. A paused call has stopped accepting submissions and
// must still be on the page saying so: hiding it makes "capped this month"
// and "withdrawn" indistinguishable to a submitter, which is exactly what
// publishing a cap was supposed to prevent. If somebody adds 'paused' to the
// hide list in isLiveOpenCall, this is the assertion that stops them.
assert.equal(isLiveOpenCall(call({ challenge_status: 'paused' }), NOW), true);
assert.equal(
  liveOpenCalls([call({ id: 'p', challenge_status: 'paused' })], NOW)
    .map((m) => m.id)
    .join(),
  'p',
);

// The statuses that do hide, unchanged.
assert.equal(isLiveOpenCall(call({ challenge_status: 'closed' }), NOW), false);
assert.equal(isLiveOpenCall(call({ challenge_status: 'winner' }), NOW), false);
assert.equal(isLiveOpenCall(call({ challenge_status: 'judging' }), NOW), true);
assert.equal(isLiveOpenCall(call({}), NOW), true);

// A deadline still hides a call regardless of status, paused included: a
// paused call that never reopens should not outlive its own closing date.
assert.equal(
  isLiveOpenCall(
    call({ challenge_status: 'paused', challenge_deadline: '2026-08-01T00:00:00Z' }),
    NOW,
  ),
  false,
);
assert.equal(isLiveOpenCall(call({ challenge_deadline: '2026-12-31T23:59:59Z' }), NOW), true);

assert.equal(isOpenCall(call({})), true);
assert.equal(isOpenCall(call({ listing_type: 'offer' })), false);
assert.equal(isOpenCall(call({ listing_type: undefined })), false);

assert.equal(typeof MIN_OPEN_CALLS_TO_SHOW, 'number');

console.log('display-policy: all assertions passed');
