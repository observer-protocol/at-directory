#!/usr/bin/env tsx
// Emits out/data/merchants.bundle.json — the canonical URL the local MCP
// package fetches via AT_DIRECTORY_DATA_URL. Run after `next build` so the
// `out/` dir exists. CI fails if the bundle is missing or empty (spec §11).
import { mkdirSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAllMerchants } from '@at-directory/core';

const here = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(here, '..');
const REPO_ROOT = resolve(WEB_ROOT, '..', '..');
const OUT = join(WEB_ROOT, 'out');
const OUT_DIR = join(OUT, 'data');

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

// Serve the canonical SKILL.md at agenticterminal.ai/SKILL.md (single
// source of truth lives in packages/skill).
copyFileSync(join(REPO_ROOT, 'packages', 'skill', 'SKILL.md'), join(OUT, 'SKILL.md'));
console.log('bundle-data: copied SKILL.md to out/SKILL.md');
