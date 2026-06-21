import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAllMerchants, type Merchant } from '@at-directory/core';

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, '..', '..', '..');
const DATA_DIR = join(REPO_ROOT, 'data');

export interface CategoryEntry {
  id: string;
  label: string;
}
export interface RailEntry {
  id: string;
  label: string;
  chains?: Array<{ id: string; label: string }>;
}

let cache: {
  merchants: Merchant[];
  categories: CategoryEntry[];
  rails: RailEntry[];
} | null = null;

function load() {
  if (cache) return cache;
  const merchants = loadAllMerchants();
  const categories = (
    JSON.parse(readFileSync(join(DATA_DIR, 'categories.json'), 'utf8')) as {
      categories: CategoryEntry[];
    }
  ).categories;
  const rails = (
    JSON.parse(readFileSync(join(DATA_DIR, 'rails.json'), 'utf8')) as { rails: RailEntry[] }
  ).rails;
  cache = { merchants, categories, rails };
  return cache;
}

export function allMerchants(): Merchant[] {
  // Tier 3 deferred from v1; only Tier 1/2 are ingested anyway.
  return load().merchants.filter((m) => m.op_trust_tier <= 2);
}

export function allListings(): Merchant[] {
  return load().merchants;
}

export function merchantBySlug(slug: string): Merchant | undefined {
  return allMerchants().find((m) => m.id === slug);
}

export function categories(): CategoryEntry[] {
  return load().categories;
}

export function rails(): RailEntry[] {
  return load().rails;
}

export function categoryLabel(id: string): string {
  return categories().find((c) => c.id === id)?.label ?? id;
}

export function railLabel(id: string): string {
  return rails().find((r) => r.id === id)?.label ?? id;
}

export function countByCategory(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of allMerchants()) out[m.category] = (out[m.category] ?? 0) + 1;
  return out;
}

export function countByRail(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of allMerchants()) {
    for (const r of m.rails) out[r.rail] = (out[r.rail] ?? 0) + 1;
  }
  return out;
}
