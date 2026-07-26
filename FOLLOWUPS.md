# AT Directory — follow-ups (non-blocking bugs and structural notes)

## Held merchants — qualify on criteria, not listable yet

### Firecrawl, Zyte, Postera (held 2026-07-25) — x402 claimed, no live 402 found

All three were in the 2026-05-17 x402-eco approved mini-batch, and Firecrawl,
Zyte and Postera are all currently listed in the usdc.org/x402 registry. None
could be confirmed live on 2026-07-25:

- **Firecrawl** (`firecrawl.dev`) — the endpoint named in its own Coinbase case
  study, `POST /v1/x402/search`, now 404s, as do `/v2/x402/search` and
  `/v2/x402/scrape`. `docs.firecrawl.dev/x402` 404s. Meanwhile `POST /v2/search`
  and `POST /v2/scrape` return **200 with real results, unauthenticated and
  unpaid** — so the public API answers for free and the x402 lane appears to
  have moved or been withdrawn. No `.well-known/x402`.
- **Zyte** (`zyte.com`) — `POST /v1/extract` returns 401 API-key auth; no x402
  endpoint found and no `.well-known/x402`. The "no account, pay per scrape with
  USDC" phrasing in search results could not be traced to Zyte's own docs and may
  be a conflation with another scraping vendor.
- **Postera** (`postera.dev`) — the site says agents "pay per read in USDC on
  Base", but `/api/posts` returns 405 on GET and 401 on POST, `/api/feed` 404s,
  and there is no `.well-known/x402` or `llms.txt`. The paid-read endpoint was
  not locatable from outside.

**Unhold when** a live 402 is observed. The cheap check for each is
`curl -s -D - <endpoint>` looking for a `payment-required` header, or
`/.well-known/x402`. These are probably wrong-endpoint misses rather than absent
support, so a single documentation link from any of them resolves it.

### Pinata — rejected, not held

`x402` on Pinata is a tool for **its own paying customers to charge third
parties** for their private IPFS files: "you receive payments directly to your
wallet address. Payments go to you", and it requires a paid Pinata account. The
agent's USDC goes to the file owner, not to Pinata. That is the
payment-infrastructure class the 2026-05-17 dry-run explicitly rejects
(plumbing the agent uses to pay, not a service the agent buys). Do not
re-evaluate unless Pinata itself starts selling storage over x402.

### AgentMetal (held 2026-07-25) — USDC settlement not live

`https://agentmetal.dev` — Linux VPS from $1.20/day, provisioned entirely
over an HTTP 402 handshake: no signup, no dashboard, no API key, the
paying wallet IS the account. MCP server (`npx @agentmetal/mcp`, remote
`https://api.agentmetal.dev/mcp`), llms.txt, REST, Claude Code plugin.
Its 402 quotes `network: eip155:8453` — USDC on Base, the same rail
Namefi and InstaDomain settle on.

**Why it is held.** Their own docs page says, verbatim:

> Status: Phase-1 built — the API runs end-to-end (provision · pay · SSH),
> with the MCP server, skills, and discovery surfaces shipped. **Live USDC
> settlement is pending a funded wallet + facilitator.** Nothing here
> requires a dashboard — there isn't one.

So the payment surface is fully built and quotes real prices, but no
USDC has ever settled through it. The card path is `fiat`, which is not
a qualifying rail on its own. Listing it would put a merchant in the
directory that an agent cannot actually pay — the one promise the
directory makes.

**Unhold when** the status line drops the "pending a funded wallet +
facilitator" caveat, or a live x402 payment against
`POST /v1/servers` settles. Then it is a straight add: `usdc`/`base`
rail, `hosting-domains` (or `compute`), `full-api`. It would be the
directory's first x402-native infrastructure merchant, so it is worth
re-checking periodically rather than waiting for it to resurface in a
research pass.

## Trust-tier filter on /merchants ignores derived tier (logged 2026-05-20)

**Symptom.** On `https://agenticterminal.ai/merchants`, the "OP trust min"
filter set to Tier 2+ returns "0 of 50 merchants" — but Cryptorefills
and Bitrefill are both showing the T2 badge on their cards (correctly,
via WI-2 derivation from `merchant_attestations`).

**Root cause.** The filter reads the build-time static snapshot, not
the live API. Two surfaces use different data sources:

- **Tier badge per card** (`components/MerchantCard.tsx` →
  `components/useDerivedTier.ts:27-28`): fetches live per-merchant detail
  from the MCP API, picks up `op_trust.tier` / dynamic `op_trust_tier`
  → shows T2 correctly.
- **Filter logic** (`components/MerchantBrowser.tsx:26`): reads
  `m.op_trust_tier` from the merchants array passed in from
  `lib/data.ts`. That data is loaded at build time from
  `data/merchants/*.json`, where every record has the static seed
  value `op_trust_tier: 1`. The filter always sees all 50 as T1.

The agent API (`mcp.agenticterminal.ai/v1/merchants`) overlays the
derived tier dynamically per request; the Next.js static export does
not. Confirmed 2026-05-20: API returns `cryptorefills.op_trust_tier: 2`
and `op_trust: { tier: 2, distinct_attestors: 1, ... }`, while the
build-time snapshot has `op_trust_tier: 1`.

**Fix shapes (pick one when convenient).**

1. **(cleanest, recommended)** Filter in `MerchantBrowser.tsx` should
   consult the same live source the badge uses. Either pre-fetch all
   derived tiers up-front at page load (one API call hydrates a
   `Record<merchantId, derivedTier>` map; filter consults the map; falls
   back to static when no entry yet), or re-derive via `useDerivedTier`
   per row.
2. **(quick patch)** Have the Next.js page fetch the merchants list
   from `mcp.agenticterminal.ai/v1/merchants` at page load instead of
   reading the static snapshot. Each merchant in the list already
   carries `op_trust_tier` set to the derived value. One-line data
   swap; preserves the existing filter logic.
3. **(coarse)** Re-snapshot the merchants data at build time with
   current derived tiers and redeploy. Fragile — re-deploy needed every
   time a tier promotes.

Option 2 is the smallest diff. Option 1 is more correct architecturally
(separates static catalog data from dynamic trust state). Option 3 is
not recommended.

Related but separate: `lib/data.ts:43` does `.filter((m) =>
m.op_trust_tier <= 2)` — that one's intentional (T3 hidden from v1
display per the spec), unrelated to this filter bug. Don't touch.

**Impact.** User-facing filter visibly contradicts the badges right
next to it. The "trust graph working" demo loses its punch when the
"show me only T2 merchants" button says zero. Worth fixing before any
Tether / Monastery walk-through of the site.

**Not blocking** the today's Cryptorefills T1→T2 tier-promotion artifact
itself (which lives on op-vps in `merchant_attestations` and renders
correctly on the card badges). This is purely the filter UI.
