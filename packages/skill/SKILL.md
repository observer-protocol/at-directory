---
name: agentic-terminal
description: Discover OP-verified merchants accepting Lightning, BOLT12, L402, or USDT, and complete payment handoff. Use when an agent needs to find a merchant on Bitcoin/Tether rails or check a merchant's payment endpoint before transacting.
---

# AT Directory

AT Directory is the agent commerce discovery surface for Bitcoin- and Tether-aligned payments. It indexes merchants that sell products, services, APIs, or content and accept Lightning, BOLT12, L402, or USDT (any chain), with trust attestations issued through Observer Protocol. It is not in the payment path — you discover merchants here and pay the merchant directly.

## 1. Connect

The directory is an MCP server. Prefer the hosted endpoint; no install.

```jsonc
// Hosted (recommended)
{ "mcpServers": { "at-directory": { "url": "https://mcp.agenticterminal.ai/mcp" } } }
```

```bash
# Local alternative
npm install -g @agenticterminal/mcp-server   # requires Node >= 23.6
```

Six tools: `search_merchants`, `get_merchant`, `verify_payment_endpoint`, `list_categories`, `list_rails`, `whoami`.

## 2. Two orthogonal axes — always read both

Each merchant carries two independent signals. They do not imply each other.

**OP trust tier** (how verified the _merchant_ is):

- Tier 1 — self-attested; merchant claims the rails, unverified.
- Tier 2 — OP-attested; an OP-credentialed enterprise verified the payment endpoints.
- Tier 3 — chain-anchored (ships v1.x; not present yet).

**Agent-callable tier** (how you _transact_):

- `full-api` — you complete the purchase end to end programmatically.
- `structured-handoff` — you pay autonomously from a structured request; fulfillment is human-handled.
- `human-checkout` — you discover the merchant but a human must complete a web checkout.

Worked examples:

- Tier 1 + `full-api` → you can buy now, but trust is self-asserted. Good for low-value, reversible buys.
- Tier 2 + `human-checkout` → endpoints verified, but you cannot complete autonomously; surface to a human.
- Tier 1 + `human-checkout` → discovery only; weakest combination for autonomous action.
- Tier 2 + `full-api` → strongest: verified and fully programmatic.

Reason about both before transacting. Never collapse them into a single "is this good" score.

## 3. Query patterns

```js
// USDT-on-Tron gift-card merchants
search_merchants({ rail: 'usdt', chain: 'tron', category: 'gift-cards' });

// Fully agent-callable Lightning merchants, verified tier only
search_merchants({ rail: 'lightning', agent_callable_tier: 'full-api', trust_tier_min: 2 });

// Full record before transacting
get_merchant({ id: 'bitrefill' });

// Liveness check before committing to a handoff
verify_payment_endpoint({ merchant_id: 'bitrefill', rail: 'usdt' });
```

Every response echoes `agent_identity`. Reads are ungated: anonymous and credentialed callers see all tiers with the same limits — you do not need a credential to discover or transact. The field is honest signal you can branch on if you choose.

## 4. Payment handoff by rail

After `get_merchant`, the `agent_endpoints` object (when present) tells you how to transact:

- **`mcp_server`** — an MCP endpoint or `npm:` package for this merchant. Connect to it and use _its_ tools to complete the purchase. Example: Bitrefill exposes `https://api.bitrefill.com/mcp`.
- **`rest_api`** — base URL of a parallel REST surface, for agents that prefer REST over MCP. Same capability as `mcp_server`, different protocol; either is sufficient to transact. Convention: `mcp_server` and `rest_api` are _connection surfaces_; `api_docs`/`openapi_url` are _documentation_; `auth_note` is prose.
- **`auth_note`** — read this first. It states the credential the merchant requires, where to obtain it, and how to attach it. Example: `"Requires Bitrefill API key (bitrefill.com/account/developers); embed as /mcp/<API_KEY>"`. Always check `auth_note` on every `full-api` merchant before connecting — different merchants authenticate differently.
- **`api_docs` / `openapi_url`** — human/machine docs for non-MCP integrations.

Rail mechanics for `structured-handoff` / `human-checkout`:

- **Lightning** — obtain the BOLT11 invoice at the merchant's checkout, pay it from your wallet.
- **BOLT12** — feed the offer string into a BOLT12-aware wallet.
- **L402** — present the `WWW-Authenticate: L402` challenge to your payer, pay, retry with the token.
- **USDT** — take the deposit address + amount + memo, send from your wallet on the declared chain. Verify the address with `verify_payment_endpoint` first.

## 5. Credentials

Reads (search, get_merchant, verify) need no credential. Present an Observer Protocol `DirectoryAccessCredential` only to raise rate limits and to submit reviews/notes.

- Hosted: send the credential as the `X-AT-Credential` header (base64url-encoded JSON).
- Local: set `AT_CREDENTIAL` to the base64url-encoded credential JSON.

Confirm state any time with `whoami()` — it reports `authenticated`, `tier_cap`, and limits without running a real query.

## 6. When AT Directory is not enough

- Paid per-request API endpoints (L402-gated APIs): use `402index.io`; the directory does not duplicate it.
- Physical-location-keyed merchant lookups: use BTC Map.
- x402-only merchants: out of scope by design.
