import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAllMerchants, type Merchant } from '@at-directory/core';
import type { RailsManifest } from './tools/list_rails.ts';

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, '..', '..', '..');
const DATA_DIR = join(REPO_ROOT, 'data');

export interface DirectoryData {
  merchants: Merchant[];
  categoryLabels: Record<string, string>;
  railsManifest: RailsManifest;
}

export interface BootstrapOptions {
  dataUrl?: string;
  cacheTtlSeconds?: number;
}

function loadLocal(): DirectoryData {
  const merchants = loadAllMerchants();
  const categories = JSON.parse(readFileSync(join(DATA_DIR, 'categories.json'), 'utf8')) as {
    categories: Array<{ id: string; label: string }>;
  };
  const rails = JSON.parse(readFileSync(join(DATA_DIR, 'rails.json'), 'utf8')) as RailsManifest;
  const categoryLabels: Record<string, string> = {};
  for (const c of categories.categories) categoryLabels[c.id] = c.label;
  return { merchants, categoryLabels, railsManifest: rails };
}

// Remote bundle takes precedence when AT_DIRECTORY_DATA_URL is set and reachable;
// falls back to the snapshot bundled in the repo/package.
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
    // Network failure or timeout: silently fall back to bundled snapshot.
  }
  return local;
}
