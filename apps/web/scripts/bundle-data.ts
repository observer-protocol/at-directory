#!/usr/bin/env tsx
// Emits out/data/merchants.bundle.json — the canonical URL the local MCP
// package fetches via AT_DIRECTORY_DATA_URL. Run after `next build` so the
// `out/` dir exists. CI fails if the bundle is missing or empty (spec §11).
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAllMerchants } from '@at-directory/core';

const here = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(here, '..');
const OUT_DIR = join(WEB_ROOT, 'out', 'data');

const merchants = loadAllMerchants().filter((m) => m.op_trust_tier <= 2);
if (merchants.length === 0) {
  console.error('bundle-data: refusing to emit an empty bundle');
  process.exit(1);
}

if (!existsSync(join(WEB_ROOT, 'out'))) {
  console.error('bundle-data: out/ does not exist — run `next build` first');
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
const bundle = { generated_at: new Date().toISOString(), merchants };
writeFileSync(join(OUT_DIR, 'merchants.bundle.json'), JSON.stringify(bundle));
console.log(`bundle-data: wrote ${merchants.length} merchants to out/data/merchants.bundle.json`);
