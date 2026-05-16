import { describe, expect, it } from 'vitest';
import type { Merchant } from '@at-directory/core';
import type { ToolContext } from '../context.ts';
import { searchMerchantsTool } from './search_merchants.ts';
import { getMerchantTool } from './get_merchant.ts';
import { listCategoriesTool } from './list_categories.ts';
import { listRailsTool, type RailsManifest } from './list_rails.ts';
import { whoamiTool } from './whoami.ts';
import { ANONYMOUS_IDENTITY } from '../auth.ts';

const M = (o: Partial<Merchant>): Merchant => ({
  id: 'm',
  name: 'M',
  url: 'https://m.example',
  description: '',
  category: 'gift-cards',
  rails: [{ rail: 'lightning', health: 'unknown' }],
  op_trust_tier: 1,
  agent_callable_tier: 'full-api',
  accepts_usdc: false,
  accepts_x402: false,
  pricing_model: 'per-product',
  source: 'crawled',
  ...o,
});

const anon = (merchants: Merchant[]): ToolContext => ({
  merchants,
  identity: ANONYMOUS_IDENTITY,
});
const cred = (merchants: Merchant[]): ToolContext => ({
  merchants,
  identity: { authenticated: true, tier_cap: 'elevated' },
});

describe('search_merchants tool', () => {
  it('anonymous callers see all tiers, uncapped reads (primary launch path)', () => {
    const merchants = [
      ...Array.from({ length: 30 }, (_, i) => M({ id: `t1-${i}` })),
      M({ id: 't2', op_trust_tier: 2, name: 'AAA', op_attestation_url: 'https://x' }),
    ];
    const r = searchMerchantsTool({}, anon(merchants));
    // No Tier-1 ceiling, no 20-result anon cap; Tier 2 ranks first.
    expect(r.results.some((m) => m.id === 't2')).toBe(true);
    expect(r.results.length).toBe(31);
    expect(r.results[0]!.op_trust_tier).toBe(2);
    expect(r.agent_identity.authenticated).toBe(false);
  });

  it('anonymous and credentialed get identical read access', () => {
    const merchants = [
      M({ id: 't1' }),
      M({ id: 't2', op_trust_tier: 2, name: 'Z', op_attestation_url: 'https://x' }),
    ];
    const a = searchMerchantsTool({}, anon(merchants));
    const c = searchMerchantsTool({}, cred(merchants));
    expect(a.results.map((m) => m.id).sort()).toEqual(c.results.map((m) => m.id).sort());
    expect(a.agent_identity.authenticated).toBe(false);
    expect(c.agent_identity.tier_cap).toBe('elevated');
  });
});

describe('get_merchant tool', () => {
  it('returns unknown_merchant for missing id', () => {
    const r = getMerchantTool({ id: 'nope' }, anon([M({ id: 'a' })]));
    expect('error' in r && r.error.code).toBe('unknown_merchant');
  });

  it('anonymous callers get the full Tier 2 record (reads not gated)', () => {
    const merchants = [M({ id: 't2', op_trust_tier: 2, op_attestation_url: 'https://x' })];
    const r = getMerchantTool({ id: 't2' }, anon(merchants));
    expect('merchant' in r && r.merchant.id).toBe('t2');
  });

  it('returns the full record for a credentialed caller too', () => {
    const merchants = [M({ id: 't2', op_trust_tier: 2, op_attestation_url: 'https://x' })];
    const r = getMerchantTool({ id: 't2' }, cred(merchants));
    expect('merchant' in r && r.merchant.id).toBe('t2');
  });
});

describe('list_categories tool', () => {
  it('counts merchants per category and sorts by count', () => {
    const merchants = [
      M({ id: 'a', category: 'gift-cards' }),
      M({ id: 'b', category: 'gift-cards' }),
      M({ id: 'c', category: 'travel' }),
    ];
    const r = listCategoriesTool({}, anon(merchants), {
      'gift-cards': 'Gift cards',
      travel: 'Travel',
      gaming: 'Gaming',
    });
    expect(r.categories[0]).toEqual({
      id: 'gift-cards',
      label: 'Gift cards',
      merchant_count: 2,
    });
    expect(r.categories.find((c) => c.id === 'gaming')?.merchant_count).toBe(0);
  });
});

describe('list_rails tool', () => {
  const manifest: RailsManifest = {
    rails: [
      { id: 'lightning', label: 'Lightning Network' },
      {
        id: 'usdt',
        label: 'USDT',
        chains: [
          { id: 'tron', label: 'Tron' },
          { id: 'ethereum', label: 'Ethereum' },
        ],
      },
    ],
  };

  it('counts rails and chains', () => {
    const merchants = [
      M({ id: 'a', rails: [{ rail: 'lightning', health: 'unknown' }] }),
      M({
        id: 'b',
        rails: [{ rail: 'usdt', chain: 'tron', health: 'unknown' }],
      }),
    ];
    const r = listRailsTool({}, anon(merchants), manifest);
    expect(r.rails.find((x) => x.rail === 'lightning')?.merchant_count).toBe(1);
    const usdt = r.rails.find((x) => x.rail === 'usdt');
    expect(usdt?.chains?.find((c) => c.chain === 'tron')?.merchant_count).toBe(1);
    expect(usdt?.chains?.find((c) => c.chain === 'ethereum')?.merchant_count).toBe(0);
  });
});

describe('whoami tool', () => {
  it('reports anonymous: uniform read cap, lower rate limit', () => {
    const r = whoamiTool({}, anon([]));
    expect(r.authenticated).toBe(false);
    expect(r.tier_cap).toBe('anonymous');
    expect(r.limits.result_cap).toBe(100);
    expect(r.limits.requests_per_minute).toBe(30);
  });

  it('reports credentialed limits and credential details', () => {
    const r = whoamiTool(
      {},
      {
        merchants: [],
        identity: { authenticated: true, tier_cap: 'premium' },
        credentialDetails: { subject_did: 'did:key:zABC', issuer: 'did:web:agenticterminal.ai' },
      },
    );
    expect(r.authenticated).toBe(true);
    expect(r.tier_cap).toBe('premium');
    expect(r.limits.result_cap).toBe(100);
    expect(r.limits.requests_per_minute).toBe(300);
    expect(r.credential?.subject_did).toBe('did:key:zABC');
  });
});
