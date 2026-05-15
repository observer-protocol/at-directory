# AT Directory

Agent commerce discovery for Bitcoin- and Tether-aligned payments. Indexes merchants accepting Lightning, BOLT12, L402, or USDT (any chain), with Observer Protocol attestation.

The MCP server is the primary product. The web directory at [agenticterminal.ai](https://agenticterminal.ai) is the human-readable surface.

## Status

Pre-v1. Active build. Target ship is the week of 2026-05-18 for a live demo at the Tether meeting.

## Documents

- [Scope](../AT-Directory-v1-Scope.md) — product positioning, inclusion criteria, definition of done.
- [Spec](../AT-Directory-v1-Spec.md) — implementation contract.

## Layout

```
data/merchants/     One JSON file per merchant.
data/schema/        JSON Schema for merchant records.
data/categories.json, data/rails.json
packages/core/      Shared types, schema validation, search/filter.
packages/mcp-server/  Local stdio + hosted HTTP MCP server. (pending)
packages/skill/     SKILL.md for agent install. (pending)
apps/web/           Next.js static directory at agenticterminal.ai. (pending)
scripts/            One-time crawl + validation tooling.
```

## Development

```bash
pnpm install
pnpm -r test
pnpm validate-data
```

## License

MIT.
