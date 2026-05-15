import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAllMerchants, type Merchant } from '@at-directory/core';
import type { RailsManifest } from './tools/list_rails.ts';

const here = dirname(fileURLToPath(import.meta.url));

export interface DirectoryData {
  merchants: Merchant[];
  categoryLabels: Record<string, string>;
  railsManifest: RailsManifest;
}

export interface BootstrapOptions {
  dataUrl?: string;
  cacheTtlSeconds?: number;
}

function toCategoryLabels(
  categories: Array<{ id: string; label: string }>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of categories) out[c.id] = c.label;
  return out;
}

// Dev / workspace path: read the live data dir via core's loader.
function loadFromDisk(): DirectoryData | null {
  const dataDir = resolve(here, '..', '..', '..', 'data');
  if (!existsSync(join(dataDir, 'merchants'))) return null;
  // core is side-effect-free on import (schema compiles lazily), so it is
  // safe to inline into the bundle; the existsSync guard above ensures
  // loadAllMerchants only runs where the data dir actually exists.
  const merchants = loadAllMerchants();
  const categories = (
    JSON.parse(readFileSync(join(dataDir, 'categories.json'), 'utf8')) as {
      categories: Array<{ id: string; label: string }>;
    }
  ).categories;
  const railsManifest = JSON.parse(
    readFileSync(join(dataDir, 'rails.json'), 'utf8'),
  ) as RailsManifest;
  return { merchants, categoryLabels: toCategoryLabels(categories), railsManifest };
}

// Bundled / published path: a complete snapshot shipped next to the
// running module (written by scripts/bundle.mjs).
function loadFromSnapshot(): DirectoryData | null {
  const candidates = [
    process.env.AT_DIRECTORY_SNAPSHOT,
    join(here, 'merchants.snapshot.json'),
    join(here, '..', 'merchants.snapshot.json'),
  ].filter((p): p is string => Boolean(p));
  for (const path of candidates) {
    if (path && existsSync(path)) {
      const snap = JSON.parse(readFileSync(path, 'utf8')) as DirectoryData;
      return snap;
    }
  }
  return null;
}

function loadLocal(): DirectoryData {
  const data = loadFromDisk() ?? loadFromSnapshot();
  if (!data) {
    throw new Error(
      'no merchant data: not in a workspace and no snapshot found. Set AT_DIRECTORY_SNAPSHOT or AT_DIRECTORY_DATA_URL.',
    );
  }
  return data;
}

// Remote bundle takes precedence when AT_DIRECTORY_DATA_URL is set and
// reachable; falls back to disk (dev) or the bundled snapshot.
export async function bootstrap(opts: BootstrapOptions = {}): Promise<DirectoryData> {
  const local = loadLocal();
  const dataUrl = opts.dataUrl ?? process.env.AT_DIRECTORY_DATA_URL;
  if (!dataUrl) return local;

  try {
    const res = await fetch(dataUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return local;
    const remote = (await res.json()) as { merchants?: Merchant[] };
    if (Array.isArray(remote.merchants) && remote.merchants.length > 0) {
      return { ...local, merchants: remote.merchants };
    }
  } catch {
    // Network failure or timeout: silently fall back.
  }
  return local;
}
