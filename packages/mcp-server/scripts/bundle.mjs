// Bundles the MCP server to dist/ for npm publish and the Docker image.
// Inlines @at-directory/core (a private workspace package) and the local
// TS source so the published artifact is plain JS with only real npm
// deps. This also removes the Node >= 23.6 native-TS requirement —
// the published package runs on Node 20+.
import { build } from 'esbuild';
import { mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const dist = join(pkgRoot, 'dist');
mkdirSync(dist, { recursive: true });
mkdirSync(join(dist, 'fixtures'), { recursive: true });

const external = ['@modelcontextprotocol/sdk', '@modelcontextprotocol/sdk/*', 'zod'];

await build({
  entryPoints: [join(pkgRoot, 'src/stdio.ts'), join(pkgRoot, 'src/http.ts')],
  outdir: dist,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  external,
  banner: { js: '#!/usr/bin/env node' },
  logLevel: 'info',
});

copyFileSync(
  join(pkgRoot, 'fixtures/demo-credential.json'),
  join(dist, 'fixtures/demo-credential.json'),
);

// Emit a clean package.json for publishing: no workspace deps (core is
// inlined), bin/exports point at dist, engines relaxed to node >= 20.
const src = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'));
const publish = {
  name: src.name,
  version: src.version,
  description: src.description,
  license: src.license,
  repository: src.repository,
  homepage: src.homepage,
  type: 'module',
  engines: { node: '>=20' },
  bin: { 'at-directory-mcp': './stdio.js' },
  exports: { '.': './http.js', './stdio': './stdio.js', './http': './http.js' },
  dependencies: {
    '@modelcontextprotocol/sdk': src.dependencies['@modelcontextprotocol/sdk'],
    zod: src.dependencies.zod,
  },
  keywords: src.keywords,
};
writeFileSync(join(dist, 'package.json'), JSON.stringify(publish, null, 2) + '\n');

// The bundled server resolves data via AT_DIRECTORY_DATA_URL (hosted) or
// this snapshot; emit a complete DirectoryData (merchants + category
// labels + rails manifest) read from the repo data dir at bundle time.
const repoData = resolve(pkgRoot, '..', '..', 'data');
const { loadAllMerchants } = await import('@at-directory/core');
const merchants = loadAllMerchants().filter((m) => m.op_trust_tier <= 2);
const categories = JSON.parse(readFileSync(join(repoData, 'categories.json'), 'utf8')).categories;
const railsManifest = JSON.parse(readFileSync(join(repoData, 'rails.json'), 'utf8'));
const categoryLabels = Object.fromEntries(categories.map((c) => [c.id, c.label]));
writeFileSync(
  join(dist, 'merchants.snapshot.json'),
  JSON.stringify({ merchants, categoryLabels, railsManifest }),
);

console.log('bundle: wrote dist/{stdio,http}.js + package.json + snapshot');
