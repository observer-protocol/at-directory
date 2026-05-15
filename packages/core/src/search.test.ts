import { describe, expect, it } from 'vitest';
import { searchMerchants } from './search.ts';
import type { Merchant } from './types.ts';

const M = (overrides: Partial<Merchant>): Merchant => ({
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
  ...overrides,
});

describe('searchMerchants', () => {
  it('returns all merchants under default limit', () => {
    const merchants = [M({ id: 'a' }), M({ id: 'b' })];
    const r = searchMerchants(merchants);
    expect(r.results).toHaveLength(2);
    expect(r.total_matching).toBe(2);
    expect(r.truncated).toBe(false);
  });

  it('filters by category', () => {
    const merchants = [
      M({ id: 'gc', category: 'gift-cards' }),
      M({ id: 'tv', category: 'travel' }),
    ];
    expect(searchMerchants(merchants, { category: 'travel' }).results.map((m) => m.id)).toEqual([
      'tv',
    ]);
  });

  it('filters by rail and chain', () => {
    const merchants = [
      M({
        id: 'tron',
        rails: [{ rail: 'usdt', chain: 'tron', health: 'unknown' }],
      }),
      M({
        id: 'eth',
        rails: [{ rail: 'usdt', chain: 'ethereum', health: 'unknown' }],
      }),
      M({ id: 'ln', rails: [{ rail: 'lightning', health: 'unknown' }] }),
    ];
    expect(
      searchMerchants(merchants, { rail: 'usdt', chain: 'tron' }).results.map((m) => m.id),
    ).toEqual(['tron']);
    expect(searchMerchants(merchants, { rail: 'lightning' }).results.map((m) => m.id)).toEqual([
      'ln',
    ]);
  });

  it('filters by agent_callable_tier', () => {
    const merchants = [
      M({ id: 'api', agent_callable_tier: 'full-api' }),
      M({ id: 'hum', agent_callable_tier: 'human-checkout' }),
    ];
    expect(
      searchMerchants(merchants, { agent_callable_tier: 'full-api' }).results.map((m) => m.id),
    ).toEqual(['api']);
  });

  it('filters by trust_tier_min', () => {
    const merchants = [
      M({ id: 't1', op_trust_tier: 1 }),
      M({ id: 't2', op_trust_tier: 2, op_attestation_url: 'https://x' }),
    ];
    expect(searchMerchants(merchants, { trust_tier_min: 2 }).results.map((m) => m.id)).toEqual([
      't2',
    ]);
  });

  it('free-text query matches name, description, and tags', () => {
    const merchants = [
      M({ id: 'a', name: 'Alpha', tags: ['esim'] }),
      M({ id: 'b', name: 'Beta', description: 'sells eSIMs' }),
      M({ id: 'c', name: 'Gamma' }),
    ];
    expect(
      searchMerchants(merchants, { query: 'esim' })
        .results.map((m) => m.id)
        .sort(),
    ).toEqual(['a', 'b']);
  });

  it('ranks tier 2 above tier 1', () => {
    const merchants = [
      M({ id: 'low', op_trust_tier: 1, name: 'A' }),
      M({
        id: 'high',
        op_trust_tier: 2,
        name: 'Z',
        op_attestation_url: 'https://x',
      }),
    ];
    expect(searchMerchants(merchants).results.map((m) => m.id)).toEqual(['high', 'low']);
  });

  it('truncates and reports truncated:true when limit exceeded', () => {
    const merchants = Array.from({ length: 5 }, (_, i) => M({ id: `m${i}` }));
    const r = searchMerchants(merchants, { limit: 2 });
    expect(r.results).toHaveLength(2);
    expect(r.total_matching).toBe(5);
    expect(r.truncated).toBe(true);
  });

  it('returns flat rail summaries (no payment_endpoint)', () => {
    const merchants = [
      M({
        id: 'x',
        rails: [
          {
            rail: 'usdt',
            chain: 'tron',
            health: 'healthy',
            payment_endpoint: 'TXXXXXXX',
            last_health_check: '2026-05-15T00:00:00Z',
          },
        ],
      }),
    ];
    const r = searchMerchants(merchants);
    expect(r.results[0]!.rails).toEqual([{ rail: 'usdt', chain: 'tron' }]);
  });
});
