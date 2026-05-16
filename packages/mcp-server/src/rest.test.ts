import { describe, expect, it } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Merchant } from '@at-directory/core';
import type { DirectoryData } from './bootstrap.ts';
import { tryHandleRest } from './rest.ts';

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

const data: DirectoryData = {
  merchants: [
    M({ id: 'bitrefill', name: 'Bitrefill', category: 'gift-cards' }),
    M({
      id: 't2',
      name: 'T2',
      category: 'travel',
      op_trust_tier: 2,
      op_attestation_url: 'https://x',
      rails: [{ rail: 'usdt', chain: 'tron', payment_endpoint: null, health: 'healthy' }],
    }),
  ],
  categoryLabels: { 'gift-cards': 'Gift cards & top-ups', travel: 'Travel' },
  railsManifest: {
    rails: [
      { id: 'lightning', label: 'Lightning' },
      { id: 'usdt', label: 'USDT', chains: [{ id: 'tron', label: 'Tron' }] },
    ],
  },
};

function call(method: string, url: string) {
  const req = { method, url } as IncomingMessage;
  let status = 0;
  let body = '';
  const res = {
    writeHead(s: number) {
      status = s;
      return res;
    },
    end(b?: string) {
      body = b ?? '';
    },
    headersSent: false,
  } as unknown as ServerResponse;
  return tryHandleRest(req, res, data).then((handled) => ({
    handled,
    status,
    json: body ? JSON.parse(body) : null,
  }));
}

describe('REST surface', () => {
  it('ignores non-/v1 paths (lets caller continue)', async () => {
    const r = await call('GET', '/healthz');
    expect(r.handled).toBe(false);
  });

  it('GET /v1/merchants returns all tiers, anonymous', async () => {
    const r = await call('GET', '/v1/merchants');
    expect(r.status).toBe(200);
    expect(r.json.results.map((m: Merchant) => m.id).sort()).toEqual(['bitrefill', 't2']);
    expect(r.json.agent_identity).toEqual({ authenticated: false, tier_cap: 'anonymous' });
  });

  it('GET /v1/merchants filters + coerces query params', async () => {
    const r = await call('GET', '/v1/merchants?rail=usdt&chain=tron&trust_tier_min=2');
    expect(r.status).toBe(200);
    expect(r.json.results.map((m: Merchant) => m.id)).toEqual(['t2']);
  });

  it('GET /v1/merchants rejects bad params with 400', async () => {
    const r = await call('GET', '/v1/merchants?trust_tier_min=9');
    expect(r.status).toBe(400);
    expect(r.json.error).toBe('invalid_query');
  });

  it('GET /v1/merchants/{id} returns the record', async () => {
    const r = await call('GET', '/v1/merchants/bitrefill');
    expect(r.status).toBe(200);
    expect(r.json.merchant.id).toBe('bitrefill');
  });

  it('GET /v1/merchants/{id} 404 for unknown', async () => {
    const r = await call('GET', '/v1/merchants/nope');
    expect(r.status).toBe(404);
    expect(r.json.error.code).toBe('unknown_merchant');
  });

  it('GET /v1/categories counts', async () => {
    const r = await call('GET', '/v1/categories');
    expect(r.status).toBe(200);
    expect(
      r.json.categories.find((c: { id: string }) => c.id === 'gift-cards').merchant_count,
    ).toBe(1);
  });

  it('GET /v1/rails counts with chains', async () => {
    const r = await call('GET', '/v1/rails');
    expect(r.status).toBe(200);
    const usdt = r.json.rails.find((x: { rail: string }) => x.rail === 'usdt');
    expect(usdt.chains.find((c: { chain: string }) => c.chain === 'tron').merchant_count).toBe(1);
  });

  it('POST /v1/merchants/{id}/verify?rail= runs verification', async () => {
    const r = await call('POST', '/v1/merchants/t2/verify?rail=usdt');
    expect(r.status).toBe(200);
    expect(r.json.rail).toBe('usdt');
    expect(r.json.status).toBe('healthy'); // per-invoice attested path
  });

  it('verify rejects GET with 405', async () => {
    const r = await call('GET', '/v1/merchants/t2/verify?rail=usdt');
    expect(r.status).toBe(405);
  });

  it('trailing slash tolerated', async () => {
    const r = await call('GET', '/v1/merchants/');
    expect(r.status).toBe(200);
  });

  it('unknown /v1 route → 404', async () => {
    const r = await call('GET', '/v1/bogus');
    expect(r.status).toBe(404);
    expect(r.json.error).toBe('not_found');
  });
});
