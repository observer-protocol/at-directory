import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Merchant } from '@at-directory/core';
import { verifyTokenAddress } from './token-address.ts';
import { verifyBolt12 } from './bolt12.ts';
import { verifyRail } from './index.ts';
import { verifyLightning } from './lightning.ts';
import { base58Decode } from './base58.ts';
import * as guarded from './guarded-request.ts';

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

describe('verifyTokenAddress — tron', () => {
  it('accepts a valid TRC-20 address', () => {
    const r = verifyTokenAddress('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 'tron');
    expect(r.address_valid).toBe(true);
  });

  it('rejects a corrupted TRC-20 address (bad checksum)', () => {
    const r = verifyTokenAddress('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6X', 'tron');
    expect(r.address_valid).toBe(false);
  });

  it('rejects wrong-prefix string', () => {
    const r = verifyTokenAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'tron');
    expect(r.address_valid).toBe(false);
  });
});

describe('verifyTokenAddress — evm', () => {
  it('accepts an all-lowercase address (no checksum)', () => {
    const r = verifyTokenAddress('0xdac17f958d2ee523a2206206994597c13d831ec7', 'ethereum');
    expect(r.address_valid).toBe(true);
  });

  it('accepts a valid EIP-55 checksummed address', () => {
    const r = verifyTokenAddress('0xdAC17F958D2ee523a2206206994597C13D831ec7', 'ethereum');
    expect(r.address_valid).toBe(true);
  });

  it('rejects a mis-checksummed address', () => {
    const r = verifyTokenAddress('0xdAC17F958D2ee523a2206206994597C13D831eC7', 'ethereum');
    expect(r.address_valid).toBe(false);
  });

  it('rejects a non-hex / wrong-length address', () => {
    expect(verifyTokenAddress('0x1234', 'polygon').address_valid).toBe(false);
  });
});

describe('verifyTokenAddress — solana', () => {
  it('accepts a 32-byte base58 pubkey', () => {
    const r = verifyTokenAddress('5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9', 'solana');
    expect(r.address_valid).toBe(true);
  });

  it('rejects too-short input', () => {
    expect(verifyTokenAddress('abc', 'solana').address_valid).toBe(false);
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

describe('verifyRail — usdc rail', () => {
  const usdcMerchant = (
    endpoint: string | null,
    health: Merchant['rails'][number]['health'] = 'unknown',
  ) =>
    perInvoice({
      op_trust_tier: 1,
      source: 'crawled',
      accepts_usdc: true,
      rails: [{ rail: 'usdc', chain: 'base', payment_endpoint: endpoint, health }],
    });

  it('validates a USDC-on-Base address through the shared token verifier', async () => {
    // Canonical USDC contract on Base, used here purely as a well-formed
    // EVM address fixture.
    const r = await verifyRail(usdcMerchant('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'), 'usdc');
    expect(r.status).toBe('healthy');
    expect(r.evidence.chain).toBe('base');
    expect(r.evidence.asset).toBe('USDC');
  });

  it('reports a malformed address as down, naming USDC rather than USDT', async () => {
    const r = await verifyRail(usdcMerchant('0xnope'), 'usdc');
    expect(r.status).toBe('down');
    expect(r.evidence.asset).toBe('USDC');
  });

  it('says USDC (not USDT) when no address is declared', async () => {
    const r = await verifyRail(usdcMerchant(null), 'usdc');
    expect(r.status).toBe('unknown');
    expect(r.detail).toMatch(/No USDC deposit address/);
  });

  // x402 merchants have no static deposit address at all — payment is a
  // per-request signed authorization. They must resolve via the attested
  // branch, not report a data gap that looks like a broken listing.
  it('surfaces attested health for an x402 merchant with no static address', async () => {
    const r = await verifyRail(usdcMerchant(null, 'healthy'), 'usdc');
    expect(r.status).toBe('healthy');
    expect(r.evidence.probe).toBe('not-applicable');
  });
});

describe('verifyLightning — WAF/anti-bot handling', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // The verifiers no longer use fetch — they use guardedRequest over node:https,
  // so the destination is checked against the RESOLVED IP before connect. Stub
  // that seam instead. Stubbing globalThis.fetch here silently intercepted
  // nothing once the transport changed, which is why these tests are mocked at
  // the module boundary rather than at a global.
  const mockProbe = (res: { status: number; body: string }) => {
    vi.spyOn(guarded, 'guardedRequest').mockResolvedValue({
      status: res.status,
      headers: {},
      body: res.body,
      finalUrl: 'https://stubbed.example/',
    });
  };

  it('maps a 403 (WAF block) to unknown, NOT down', async () => {
    mockProbe({ status: 403, body: 'blocked' });
    const r = await verifyLightning('https://bitrefill.com', null);
    expect(r.status).toBe('unknown');
    expect(r.evidence.probe_blocked).toBe(true);
    expect(r.detail).toMatch(/not necessarily down/i);
  });

  it('429 rate-limit is also unknown, not down', async () => {
    mockProbe({ status: 429, body: '' });
    expect((await verifyLightning('https://x.example', null)).status).toBe('unknown');
  });

  it('a genuine network failure is still down', async () => {
    vi.spyOn(guarded, 'guardedRequest').mockRejectedValue(new Error('ECONNREFUSED'));
    expect((await verifyLightning('https://dead.example', null)).status).toBe('down');
  });

  it('200 with no LNURL is unknown (reachable, no probe) — unchanged', async () => {
    mockProbe({ status: 200, body: 'ok' });
    const r = await verifyLightning('https://live.example', null);
    expect(r.status).toBe('unknown');
    expect(r.evidence.probe_blocked).toBeUndefined();
  });

  it('a refused destination is unknown, NOT down (our policy is not their downtime)', async () => {
    vi.spyOn(guarded, 'guardedRequest').mockRejectedValue(
      new guarded.BlockedDestinationError('refusing x: loopback address 127.0.0.1'),
    );
    const r = await verifyLightning('https://blocked.example', null);
    expect(r.status).toBe('unknown');
    expect(r.evidence.blocked).toBe(true);
  });

  // The probe User-Agent moved into guarded-request.ts and is asserted there
  // against a real loopback server, which checks the header actually sent rather
  // than the argument handed to a stub.
});
