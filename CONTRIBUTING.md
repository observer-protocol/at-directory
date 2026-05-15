# Contributing

## Adding or editing a merchant

The merchant data is the source of truth: one JSON file per merchant at `data/merchants/<id>.json`, validated against `data/schema/merchant.schema.json`.

Two paths:

1. **Self-registration form** — [agenticterminal.ai/submit](https://agenticterminal.ai/submit). Opens a PR automatically. Easiest for merchants.
2. **Direct PR** — add/edit the JSON file and open a PR.

### Rules enforced by `pnpm validate-data` (and CI)

- `id` is slug-form and the filename is `<id>.json`.
- Every USDT rail has a `chain`; non-USDT rails must not.
- `op_trust_tier` is `1` or `2`. **Tier 3 is rejected in v1** (chain-anchored attestation format not yet locked; ships v1.x).
- A Tier 2 record from a non-`integrated` source must have an `op_attestation_url`.
- `agent_endpoints.mcp_server`, if present, starts with `npm:`, `http:`, or `https:`.

New entries land at **Tier 1** (self-attested). Promotion to Tier 2 happens through an Observer Protocol attestation, not by editing the field directly.

### Inclusion criteria

A merchant qualifies only if **both**: (1) it does commerce — sells products, services, APIs, or content (pure wallets/exchanges/processors excluded), and (2) it accepts at least one of Lightning, BOLT12, L402, or USDT (any chain). x402-only merchants are out of scope by design; x402/USDC are recorded as supplementary metadata when a qualifying rail is present.

## Code

```bash
pnpm install
pnpm -r lint && pnpm -r typecheck && pnpm -r test && pnpm validate-data
```

All four must pass; CI runs the same. Format with Prettier (`npx prettier --write`). Conventions:

- `packages/core` is the single source of types, schema validation, and search. `mcp-server` and `web` import it; no data logic is duplicated in consumers.
- Keep the MCP tool surface in sync with the spec (`AT-Directory-v1-Spec.md` §4) and the `/api-docs` page.
- The MCP server is published bundled (core inlined → plain JS); don't add Node-version-specific syntax assumptions to runtime paths.
- No secrets in commits. The submission GitHub App is fine-scoped and cannot merge — branch protection requires human review.

## Commits & PRs

Small, focused commits with a why-oriented message. Branch protection on `main`: PRs require review; Boyd and Maxi merge. CI must be green.

## Scope discipline

`AT-Directory-v1-Spec.md` is the contract. Anything beyond it is scope creep; anything in the scope but missing is a spec bug — flag and reconcile rather than silently extending.
