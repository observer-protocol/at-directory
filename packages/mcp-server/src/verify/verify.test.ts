import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Merchant } from '@at-directory/core';
import { verifyUsdtAddress } from './usdt.ts';
import { verifyBolt12 } from './bolt12.ts';
import { verifyRail } from './index.ts';
import { verifyLightning } from './lightning.ts';
import { base58Decode } from './base58.ts';

describe('base58Decode', () => {
  it('decodes a known Tron address to 25 bytes', () => {
    const decoded = base58Decode('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
    expect(decoded).not.toBeNull();
    expect(decoded!.length).toBe(25);
    expect(decoded![0]).toBe(0x41);
  });

  it('rejects characters outside the base58 alphabet', () => {
    expect(base58Decode('0OIl')).toBeNull(); // 0 O I l are the excluded ambiguous chars
    expect(base58Decode('!!!')).toBeNull();
  });
});

describe('verifyUsdtAddress — tron', () => {
  it('accepts a valid TRC-20 address', () => {
    const r = verifyUsdtAddress('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 'tron');
    expect(r.address_valid).toBe(true);
  });

  it('rejects a corrupted TRC-20 address (bad checksum)', () => {
    const r = verifyUsdtAddress('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6X', 'tron');
    expect(r.address_valid).toBe(false);
  });

  it('rejects wrong-prefix string', () => {
    const r = verifyUsdtAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'tron');
    expect(r.address_valid).toBe(false);
  });
});

describe('verifyUsdtAddress — evm', () => {
  it('accepts an all-lowercase address (no checksum)', () => {
    const r = verifyUsdtAddress('0xdac17f958d2ee523a2206206994597c13d831ec7', 'ethereum');
    expect(r.address_valid).toBe(true);
  });

  it('accepts a valid EIP-55 checksummed address', () => {
    const r = verifyUsdtAddress('0xdAC17F958D2ee523a2206206994597C13D831ec7', 'ethereum');
    expect(r.address_valid).toBe(true);
  });

  it('rejects a mis-checksummed address', () => {
    const r = verifyUsdtAddress('0xdAC17F958D2ee523a2206206994597C13D831eC7', 'ethereum');
    expect(r.address_valid).toBe(false);
  });

  it('rejects a non-hex / wrong-length address', () => {
    expect(verifyUsdtAddress('0x1234', 'polygon').address_valid).toBe(false);
  });
});

describe('verifyUsdtAddress — solana', () => {
  it('accepts a 32-byte base58 pubkey', () => {
    const r = verifyUsdtAddress('5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9', 'solana');
    expect(r.address_valid).toBe(true);
  });

  it('rejects too-short input', () => {
    expect(verifyUsdtAddress('abc', 'solana').address_valid).toBe(false);
  });
});

describe('verifyBolt12', () => {
  it('accepts a structurally valid offer', () => {
    const r = verifyBolt12('lno1pqps7sjqpgtyzm3qv4uxzmtsd3jjqer9wd3hy6tsw35k7msjzfpy7nz5yqcn');
    expect(r.status).toBe('healthy');
    expect(r.evidence.offer_valid).toBe(true);
  });

  it('rejects a non-offer string', () => {
    const r = verifyBolt12('lnbc1...');
    expect(r.status).toBe('down');
    expect(r.evidence.offer_valid).toBe(false);
  });

  it('flags non-bech32 characters as degraded', () => {
    const r = verifyBolt12('lno1bbbbbbbbbbbio');
    expect(r.status).toBe('degraded');
  });
});

const perInvoice = (overrides: Partial<Merchant>): Merchant => ({
  id: 'm',
  name: 'M',
  url: 'https://m.example',
  description: '',
  category: 'gift-cards',
  rails: [{ rail: 'usdt', chain: 'tron', payment_endpoint: null, health: 'healthy' }],
  op_trust_tier: 2,
  agent_callable_tier: 'full-api',
  accepts_usdc: false,
  accepts_x402: false,
  pricing_model: 'per-product',
  source: 'integrated',
  last_verified_at: '2026-05-17T00:00:00Z',
  ...overrides,
});

describe('verifyRail — per-invoice / attested merchant', () => {
  it('surfaces attested health (not a misleading "unknown") when endpoint is null but health is set', async () => {
    const r = await verifyRail(perInvoice({}), 'usdt');
    expect(r.status).toBe('healthy');
    expect(r.evidence.probe).toBe('not-applicable');
    expect(r.evidence.attested).toBe(true);
    expect(r.evidence.last_verified_at).toBe('2026-05-17T00:00:00Z');
    expect(r.detail).toMatch(/per-invoice/i);
    expect(r.detail).toMatch(/enterprise-attested \(Tier 2\)/);
  });

  it('applies to lightning too (no false "down" from an unreachable marketing site)', async () => {
    const r = await verifyRail(
      perInvoice({ rails: [{ rail: 'lightning', payment_endpoint: null, health: 'healthy' }] }),
      'lightning',
    );
    expect(r.status).toBe('healthy');
    expect(r.evidence.probe).toBe('not-applicable');
  });

  it('still reports a genuine data gap as unknown when health is unknown', async () => {
    const r = await verifyRail(
      perInvoice({
        op_trust_tier: 1,
        source: 'crawled',
        rails: [{ rail: 'usdt', chain: 'tron', payment_endpoint: null, health: 'unknown' }],
      }),
      'usdt',
    );
    expect(r.status).toBe('unknown');
    expect(r.evidence.attested).toBeUndefined();
  });
});

describe('verifyLightning — WAF/anti-bot handling', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('maps a 403 (WAF block) to unknown, NOT down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('blocked', { status: 403 })),
    );
    const r = await verifyLightning('https://bitrefill.com', null);
    expect(r.status).toBe('unknown');
    expect(r.evidence.probe_blocked).toBe(true);
    expect(r.detail).toMatch(/not necessarily down/i);
  });

  it('429 rate-limit is also unknown, not down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 429 })),
    );
    expect((await verifyLightning('https://x.example', null)).status).toBe('unknown');
  });

  it('a genuine network failure is still down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
    );
    expect((await verifyLightning('https://dead.example', null)).status).toBe('down');
  });

  it('200 with no LNURL is unknown (reachable, no probe) — unchanged', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('ok', { status: 200 })),
    );
    const r = await verifyLightning('https://live.example', null);
    expect(r.status).toBe('unknown');
    expect(r.evidence.probe_blocked).toBeUndefined();
  });

  it('sends an identifying User-Agent on the probe', async () => {
    const spy = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response('ok', { status: 200 }),
    );
    vi.stubGlobal('fetch', spy);
    await verifyLightning('https://ua.example', null);
    const init = spy.mock.calls[0]?.[1];
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers['User-Agent']).toMatch(/AT-Directory-Verifier/);
  });
});
