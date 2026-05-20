# AT Directory — follow-ups (non-blocking bugs and structural notes)

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
