import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { Merchant } from './types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, '..', '..', '..');
const DATA_DIR = join(REPO_ROOT, 'data');

const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
addFormats.default(ajv);

const schemaPath = join(DATA_DIR, 'schema', 'merchant.schema.json');
const merchantSchema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const validateMerchant = ajv.compile<Merchant>(merchantSchema);

export class MerchantLoadError extends Error {
  constructor(
    message: string,
    public readonly file: string,
    public readonly details?: unknown,
  ) {
    super(`${message} (${file})`);
    this.name = 'MerchantLoadError';
  }
}

export function loadMerchant(filePath: string): Merchant {
  const raw = readFileSync(filePath, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new MerchantLoadError('Invalid JSON', filePath, (e as Error).message);
  }
  if (!validateMerchant(parsed)) {
    throw new MerchantLoadError('Schema validation failed', filePath, validateMerchant.errors);
  }
  return parsed as Merchant;
}

export interface LoadAllOptions {
  dir?: string;
}

export function loadAllMerchants(opts: LoadAllOptions = {}): Merchant[] {
  const merchantsDir = opts.dir ?? join(DATA_DIR, 'merchants');
  const files = readdirSync(merchantsDir).filter((f) => f.endsWith('.json'));
  const merchants = files.map((f) => loadMerchant(join(merchantsDir, f)));
  assertUniqueIds(merchants);
  assertTierRules(merchants);
  assertFilenameMatchesId(merchants, files, merchantsDir);
  return merchants;
}

function assertUniqueIds(merchants: Merchant[]): void {
  const seen = new Set<string>();
  for (const m of merchants) {
    if (seen.has(m.id)) {
      throw new MerchantLoadError('Duplicate merchant id', m.id);
    }
    seen.add(m.id);
  }
}

function assertTierRules(merchants: Merchant[]): void {
  for (const m of merchants) {
    if (m.source !== 'integrated' && m.op_trust_tier > 1 && !m.op_attestation_url) {
      throw new MerchantLoadError(
        `Tier ${m.op_trust_tier} merchant from source '${m.source}' must have op_attestation_url`,
        m.id,
      );
    }
    if (m.op_trust_tier === 3) {
      throw new MerchantLoadError(
        `Tier 3 records are deferred from v1 (see spec §3.3); ingest in v1.x once chain-anchored attestation format is locked`,
        m.id,
      );
    }
  }
}

function assertFilenameMatchesId(merchants: Merchant[], files: string[], dir: string): void {
  for (let i = 0; i < merchants.length; i++) {
    const expected = `${merchants[i]!.id}.json`;
    if (files[i] !== expected) {
      throw new MerchantLoadError(
        `Filename '${files[i]}' does not match merchant id '${merchants[i]!.id}'`,
        join(dir, files[i]!),
      );
    }
  }
}
