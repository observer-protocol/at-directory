import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { Merchant } from './types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, '..', '..', '..');
const DATA_DIR = join(REPO_ROOT, 'data');

// Lazily compiled so importing this module has no filesystem side effect
// (it gets bundled into the MCP server, which runs where the schema path
// does not exist and uses a data snapshot instead).
let _validate: ReturnType<typeof compileValidator> | null = null;

function compileValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats.default(ajv);
  const schemaPath = join(DATA_DIR, 'schema', 'merchant.schema.json');
  const merchantSchema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  return ajv.compile<Merchant>(merchantSchema);
}

function validateMerchant(obj: unknown): boolean {
  if (!_validate) _validate = compileValidator();
  return _validate(obj) as boolean;
}

validateMerchant.errorText = (): string[] => {
  if (!_validate) return [];
  return (_validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? 'invalid'}`);
};

export class MerchantLoadError extends Error {
  readonly file: string;
  readonly details?: unknown;
  constructor(message: string, file: string, details?: unknown) {
    super(`${message} (${file})`);
    this.name = 'MerchantLoadError';
    this.file = file;
    this.details = details;
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Validate an in-memory object (e.g. a form submission) against the
// merchant schema without touching disk. Does not apply the cross-record
// rules (unique id, filename match) — those only make sense on a set.
export function validateMerchantRecord(obj: unknown): ValidationResult {
  if (validateMerchant(obj)) return { valid: true, errors: [] };
  return { valid: false, errors: validateMerchant.errorText() };
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
    throw new MerchantLoadError('Schema validation failed', filePath, validateMerchant.errorText());
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
    // Two fields carry "does this merchant speak x402": the older
    // accepts_x402 boolean and the payment_protocols array that replaces it.
    // Leaving them to agree by convention is how they diverge, so this is a
    // gate rather than a note: a record that sets one without the other
    // fails to load, here and in CI.
    const declaresX402 = (m.payment_protocols ?? []).includes('x402');
    if (declaresX402 !== m.accepts_x402) {
      throw new MerchantLoadError(
        `accepts_x402 is ${m.accepts_x402} but payment_protocols ${
          declaresX402 ? 'includes' : 'does not include'
        } 'x402'; the two describe the same fact and must agree`,
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
