import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadAllMerchants, loadMerchant, MerchantLoadError } from './load.ts';

function scratchDir(): string {
  return mkdtempSync(join(tmpdir(), 'at-directory-test-'));
}

function writeJson(file: string, data: unknown): void {
  writeFileSync(file, JSON.stringify(data, null, 2));
}

const baseMerchant = {
  id: 'example',
  name: 'Example',
  url: 'https://example.com',
  description: 'Sells things for sats.',
  category: 'gift-cards',
  rails: [{ rail: 'lightning', health: 'unknown' }],
  op_trust_tier: 1,
  agent_callable_tier: 'full-api',
  accepts_usdc: false,
  accepts_x402: false,
  pricing_model: 'per-product',
  source: 'crawled',
};

describe('loadMerchant', () => {
  it('loads a valid merchant record', () => {
    const dir = scratchDir();
    const file = join(dir, 'example.json');
    writeJson(file, baseMerchant);
    const m = loadMerchant(file);
    expect(m.id).toBe('example');
    expect(m.rails[0]!.rail).toBe('lightning');
  });

  it('rejects invalid JSON', () => {
    const dir = scratchDir();
    const file = join(dir, 'bad.json');
    writeFileSync(file, '{not json');
    expect(() => loadMerchant(file)).toThrow(MerchantLoadError);
  });

  it('rejects records missing required fields', () => {
    const dir = scratchDir();
    const file = join(dir, 'missing.json');
    const { name: _name, ...incomplete } = baseMerchant;
    writeJson(file, incomplete);
    expect(() => loadMerchant(file)).toThrow(/Schema validation failed/);
  });

  it('rejects USDT rail without chain discriminator', () => {
    const dir = scratchDir();
    const file = join(dir, 'usdt-no-chain.json');
    writeJson(file, {
      ...baseMerchant,
      rails: [{ rail: 'usdt', health: 'unknown' }],
    });
    expect(() => loadMerchant(file)).toThrow(/Schema validation failed/);
  });

  it('rejects non-USDT rail with chain set', () => {
    const dir = scratchDir();
    const file = join(dir, 'ln-with-chain.json');
    writeJson(file, {
      ...baseMerchant,
      rails: [{ rail: 'lightning', chain: 'tron', health: 'unknown' }],
    });
    expect(() => loadMerchant(file)).toThrow(/Schema validation failed/);
  });

  it('rejects bad mcp_server prefix', () => {
    const dir = scratchDir();
    const file = join(dir, 'bad-endpoint.json');
    writeJson(file, {
      ...baseMerchant,
      agent_endpoints: { mcp_server: 'ftp://example.com' },
    });
    expect(() => loadMerchant(file)).toThrow(/Schema validation failed/);
  });
});

describe('loadAllMerchants', () => {
  it('rejects duplicate ids', () => {
    const dir = scratchDir();
    mkdirSync(join(dir, 'merchants'));
    writeJson(join(dir, 'merchants', 'dup.json'), { ...baseMerchant, id: 'dup' });
    writeJson(join(dir, 'merchants', 'dup2.json'), { ...baseMerchant, id: 'dup' });
    expect(() => loadAllMerchants({ dir: join(dir, 'merchants') })).toThrow(
      /Duplicate merchant id/,
    );
  });

  it('rejects filenames that do not match id', () => {
    const dir = scratchDir();
    mkdirSync(join(dir, 'merchants'));
    writeJson(join(dir, 'merchants', 'wrong-name.json'), { ...baseMerchant, id: 'example' });
    expect(() => loadAllMerchants({ dir: join(dir, 'merchants') })).toThrow(
      /does not match merchant id/,
    );
  });

  it('rejects Tier 3 records (deferred from v1)', () => {
    const dir = scratchDir();
    mkdirSync(join(dir, 'merchants'));
    writeJson(join(dir, 'merchants', 'tier3.json'), {
      ...baseMerchant,
      id: 'tier3',
      op_trust_tier: 3,
      source: 'integrated',
      op_attestation_url: 'https://example.com/attestations/tier3',
    });
    expect(() => loadAllMerchants({ dir: join(dir, 'merchants') })).toThrow(
      /Tier 3 records are deferred/,
    );
  });

  it('rejects Tier 2 records without op_attestation_url unless integrated', () => {
    const dir = scratchDir();
    mkdirSync(join(dir, 'merchants'));
    writeJson(join(dir, 'merchants', 'tier2.json'), {
      ...baseMerchant,
      id: 'tier2',
      op_trust_tier: 2,
      source: 'crawled',
    });
    expect(() => loadAllMerchants({ dir: join(dir, 'merchants') })).toThrow(
      /must have op_attestation_url/,
    );
  });

  it('loads a clean set', () => {
    const dir = scratchDir();
    mkdirSync(join(dir, 'merchants'));
    writeJson(join(dir, 'merchants', 'a.json'), { ...baseMerchant, id: 'a' });
    writeJson(join(dir, 'merchants', 'b.json'), { ...baseMerchant, id: 'b', name: 'B' });
    const all = loadAllMerchants({ dir: join(dir, 'merchants') });
    expect(all.map((m) => m.id).sort()).toEqual(['a', 'b']);
  });
});
