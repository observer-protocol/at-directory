# AT Directory

**Where agents discover OP-verified merchants on the rails Bitcoin and Tether actually use.**

AT Directory indexes merchants that sell products, services, APIs, or content and accept Lightning, BOLT12, L402, or USDT (any chain), with trust attestations issued through [Observer Protocol](https://observerprotocol.org). It is the verified, agent-callable layer on top of the fragmented agent-payment landscape. It is **not** in the payment path — agents discover here and pay merchants directly.

- **MCP server** (primary product) — `@agenticterminal/mcp-server`, hosted at `mcp.agenticterminal.ai`.
- **Web directory** — [agenticterminal.ai](https://agenticterminal.ai), same data rendered for humans.
- **SKILL.md** — teaches an agent how to query and complete payment handoff.

## Status

Pre-v1, active build. Target: week of 2026-05-18 for a live Tether-meeting demo. v1 ships Tiers 1–2; Tier 3 (chain-anchored) is v1.x.

## Use it from an agent

```jsonc
// Hosted (recommended, no install)
{ "mcpServers": { "at-directory": { "url": "https://mcp.agenticterminal.ai/mcp" } } }
```

```bash
npm install -g @agenticterminal/mcp-server   # local alternative
```

Six tools: `search_merchants`, `get_merchant`, `verify_payment_endpoint`, `list_categories`, `list_rails`, `whoami`. Anonymous callers see Tier 1 (capped); present an Observer Protocol `DirectoryAccessCredential` for full access. Full reference: [agenticterminal.ai/api-docs](https://agenticterminal.ai/api-docs).

## Repo layout

```
data/merchants/         One JSON file per merchant (the source of truth).
data/schema/            JSON Schema (Draft 2020-12) for merchant records.
data/categories.json    Category taxonomy.
data/rails.json         Supported rails + USDT chains.
data/LOGO-AUDIT.md      Logo sourcing checklist.
packages/core/          Types, schema-validated load, search/filter.
packages/mcp-server/    stdio + hosted HTTP MCP server, rail verification.
packages/skill/         SKILL.md (canonical).
apps/web/               Next.js static directory + Netlify Functions.
deploy/mcp-server/      Dockerfile, systemd unit, DEPLOY runbook.
scripts/                Data validation (and one-time crawl tooling).
```

## Development

```bash
pnpm install
pnpm -r test          # core + mcp-server unit/integration tests
pnpm -r typecheck
pnpm validate-data    # schema-validate every merchant record
pnpm -F @at-directory/web dev          # web at localhost:3000
pnpm -F @agenticterminal/mcp-server start:stdio   # MCP over stdio
```

Local MCP with the mock verifier (until the real AT route lands):

```bash
pnpm -F @agenticterminal/mcp-server exec tsx src/dev/mock-verifier.ts &
AT_VERIFIER_URL=http://127.0.0.1:8787 \
  pnpm -F @agenticterminal/mcp-server start:stdio
```

## Data model

Every merchant carries two **orthogonal** signals — read both:

- **OP trust tier** (the merchant): 1 self-attested · 2 OP-attested · 3 chain-anchored (v1.x).
- **Agent-callable tier** (the integration): `full-api` · `structured-handoff` · `human-checkout`.

Schema is enforced in CI (`pnpm validate-data`) and on every load. USDT rails require a `chain`; Tier 2+ non-integrated records require an `op_attestation_url`; Tier 3 is rejected in v1.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Merchants can self-register at [agenticterminal.ai/submit](https://agenticterminal.ai/submit) — submissions open a PR for review and land at Tier 1 until verified.

## Documents

- [Scope](../AT-Directory-v1-Scope.md) — positioning, inclusion criteria, definition of done.
- [Spec](../AT-Directory-v1-Spec.md) — implementation contract.

## License

MIT.
