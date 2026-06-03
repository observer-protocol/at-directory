// Aggregation pass v1 — candidate record builder.
//
// This module is the SINGLE rail-mapping chokepoint for the whole aggregation
// pass (spec §6). Scrapers extract loose payment-surface facts; this turns them
// into a schema-shaped record and classifies whether the record can be promoted
// now, must wait for the Track-2 schema change, or fails the inclusion filter.
//
// Why the chokepoint matters: the reframed inclusion filter accepts seven native
// rails, but the deployed schema enum only accepts four (lightning/bolt12/l402/
// usdt). usdc/btc/x402 land when Appendix A ships. Keeping the rail vocabulary
// here means enabling them post-Appendix-A is the ONE-LINE change to
// MERGEABLE_RAILS below — no scraper edits, no re-scrape (spec §9).
//
// Type-only import (erased at runtime) keeps this module AJV-free; the schema
// validate gate lives in promote.ts where it belongs (spec §6).
import type { Merchant, RailName } from '../../../packages/core/src/types.ts';

// The aggregation tooling's OWN rail vocabulary — the full reframe set of seven.
// Deliberately NOT core's `RailName`: that type is the schema's *currently
// mergeable* set (four), and grows to seven only when Appendix A ships. The
// tooling must reason over all seven now (to classify usdc/btc/x402-only
// merchants as `pending-rail-support` rather than reject them), so it carries
// its own type. INVARIANT: MERGEABLE_RAILS ⊆ core RailName at all times — that
// is what makes the cast at the record-emit site sound (see buildCandidate).
export type AggRail = 'lightning' | 'bolt12' | 'l402' | 'usdt' | 'usdc' | 'btc' | 'x402';
const ALL_RAILS: readonly AggRail[] = ['lightning', 'bolt12', 'l402', 'usdt', 'usdc', 'btc', 'x402'];

// ── THE TRACK-2 SWITCH ──────────────────────────────────────────────────────
// Rails the CURRENT deployed schema accepts (spec §3.1). When Appendix A lands
// (and core's RailName grows to seven), change this to `new Set(ALL_RAILS)`
// (one line) and the already-staged usdc/btc/x402 candidates promote unchanged
// in the follow-up batch. Keep the invariant MERGEABLE_RAILS ⊆ core RailName.
const MERGEABLE_RAILS: ReadonlySet<AggRail> = new Set<AggRail>([
  'lightning',
  'bolt12',
  'l402',
  'usdt',
  'btc',
]);
// ────────────────────────────────────────────────────────────────────────────

// Rails that REQUIRE a chain discriminator. Today: usdt only. Post-Appendix-A
// usdc joins (mirrors usdt). btc/x402 never carry a chain (BTC is L1; x402 is a
// protocol rail like l402 — settlement chain is an implementation detail).
const CHAIN_RAILS: ReadonlySet<AggRail> = new Set<AggRail>(['usdt']);

const SUPPORTED_CHAINS = [
  'tron',
  'ethereum',
  'solana',
  'bsc',
  'polygon',
  'arbitrum',
  'base',
] as const;
type SupportedChain = (typeof SUPPORTED_CHAINS)[number];

// Free-text → canonical rail. Returns null when a token cannot be confidently
// mapped; the caller treats an unmappable payment claim as ambiguous (→ hold),
// never as a silent include (conservative posture, spec §7).
export function mapRailToken(raw: string): AggRail | null {
  const t = raw.toLowerCase().trim();
  if (/\b(lightning|lnurl|ln\b|bolt ?11|sats?)\b/.test(t) || t === 'ln') return 'lightning';
  if (/\bbolt ?12\b/.test(t)) return 'bolt12';
  if (/\b(l402|lsat)\b/.test(t)) return 'l402';
  if (/\bx ?402\b/.test(t)) return 'x402';
  if (/\b(usdt|tether)\b/.test(t)) return 'usdt';
  if (/\busdc\b/.test(t)) return 'usdc';
  if (/\b(btc|bitcoin|on[- ]?chain)\b/.test(t)) return 'btc';
  return null;
}

function mapChainToken(raw: string | undefined): SupportedChain | null {
  if (!raw) return null;
  const t = raw.toLowerCase().trim();
  const direct = SUPPORTED_CHAINS.find((c) => t === c);
  if (direct) return direct;
  if (/\btrc[- ]?20\b|\btron\b/.test(t)) return 'tron';
  if (/\berc[- ]?20\b|\bethereum\b|\beth\b/.test(t)) return 'ethereum';
  if (/\bsol(ana)?\b/.test(t)) return 'solana';
  if (/\bbnb\b|\bbsc\b/.test(t)) return 'bsc';
  if (/\bpolygon\b|\bmatic\b/.test(t)) return 'polygon';
  if (/\barbitrum\b|\barb\b/.test(t)) return 'arbitrum';
  if (/\bbase\b/.test(t)) return 'base';
  return null;
}

export function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
  // Schema id pattern requires a leading [a-z0-9]; prefix if slugify stripped it.
  return /^[a-z0-9]/.test(s) ? s : `m-${s}`.slice(0, 64);
}

export interface RawRailClaim {
  rail: string; // free text, e.g. "Lightning Network", "USDT (TRC-20)", "x402"
  chain?: string; // free text chain hint for usdt/usdc
  payment_endpoint?: string | null;
}

// Loose facts a scraper extracts. Everything optional except the essentials so
// each source adapter can fill what it has and the builder applies the spec's
// honest defaults for the rest.
export interface RawMerchant {
  name: string;
  url: string;
  description?: string;
  rail_claims: RawRailClaim[];
  category?: Merchant['category'];
  agent_callable_tier?: Merchant['agent_callable_tier'];
  pricing_model?: Merchant['pricing_model'];
  accepts_usdc?: boolean;
  accepts_x402?: boolean;
  agent_endpoints?: NonNullable<Merchant['agent_endpoints']>;
  // Provenance (always required from the scraper).
  source_directory: string;
  source_url: string;
}

export type CandidateStatus =
  | 'ready' // ≥1 mergeable rail; subject to dedup/verify downstream
  | 'pending-rail-support' // only usdc/btc/x402 rails — stage, promote post-Appendix-A
  | 'hold' // ambiguous payment surface / uncategorisable — manual review
  | 'reject'; // fails inclusion criterion 2 (no native rail at all)

export interface Provenance {
  directory: string;
  source_url: string;
  extracted_at: string; // ISO 8601
  confidence: 'high' | 'medium' | 'low';
}

export interface CandidateResult {
  record: Merchant; // schema-shaped; rails restricted to currently-mergeable
  status: CandidateStatus;
  reasons: string[];
  provenance: Provenance; // rich, tooling-side (report + checklist); the record
  // stores the schema-valid string projection until D2/Appendix-A widens it.
  deferred_rails: AggRail[]; // mapped but not yet schema-mergeable (usdc/btc/x402)
  mappable: boolean;
}

// String projection of provenance — schema-valid TODAY (source_attribution is
// `type:string`). Post-Appendix-A the object form becomes available and oneOf
// keeps this string valid, so no backfill (spec §3.1 / Appendix A).
function attributionString(p: Provenance): string {
  return `${p.directory} | ${p.source_url} | conf=${p.confidence} | ${p.extracted_at}`;
}

export function buildCandidate(raw: RawMerchant, extractedAt = new Date().toISOString()): CandidateResult {
  const reasons: string[] = [];

  // 1. Map every rail claim. Track mapped, deferred (non-mergeable), unmapped.
  const mapped: { rail: AggRail; chain?: SupportedChain }[] = [];
  let hadUnmappable = false;
  for (const claim of raw.rail_claims) {
    const rail = mapRailToken(claim.rail);
    if (!rail) {
      hadUnmappable = true;
      continue;
    }
    let chain: SupportedChain | undefined;
    if (CHAIN_RAILS.has(rail)) {
      const c = mapChainToken(claim.chain);
      if (!c) {
        // A chain-requiring rail with no resolvable chain can't be a valid
        // record; flag rather than guess (conservative posture).
        hadUnmappable = true;
        reasons.push(`rail '${rail}' claimed without a resolvable chain`);
        continue;
      }
      chain = c;
    }
    if (!mapped.some((m) => m.rail === rail && m.chain === chain)) mapped.push({ rail, chain });
  }

  const mergeable = mapped.filter((m) => MERGEABLE_RAILS.has(m.rail));
  const deferred = mapped.filter((m) => !MERGEABLE_RAILS.has(m.rail)).map((m) => m.rail);

  // 2. Confidence (drives §7 review routing). Conservative: a single weak claim
  //    or any unmappable noise caps confidence; downstream verify can only lower
  //    it further, never raise it.
  let confidence: Provenance['confidence'] = 'medium';
  if (raw.rail_claims.length >= 2 && !hadUnmappable && mapped.length >= 1) confidence = 'high';
  if (hadUnmappable || mapped.length === 0) confidence = 'low';

  const provenance: Provenance = {
    directory: raw.source_directory,
    source_url: raw.source_url,
    extracted_at: extractedAt,
    confidence,
  };

  // 3. Schema-shaped record. Honest defaults per spec §3.1/§4: Tier 1, crawled,
  //    last_verified_at null, no attestation, human-checkout unless evidence.
  const tags = ['crawled', slugify(raw.source_directory), 'rail-unverified'];
  for (const d of deferred) tags.push(`rail-${d}-pending`);

  const record: Merchant = {
    id: slugify(raw.name),
    name: raw.name.trim(),
    url: raw.url.trim(),
    description: (raw.description ?? raw.name).trim(),
    category: raw.category ?? 'marketplace', // best-fit placeholder; 'hold' if absent (below)
    // `rail as RailName` is sound by the MERGEABLE_RAILS ⊆ core-RailName
    // invariant: only mergeable rails reach this map, and every mergeable rail
    // is a valid schema enum value. promote.ts's AJV validate is the runtime
    // backstop if the invariant is ever violated by a bad Track-2 edit.
    rails: mergeable.map(({ rail, chain }) => ({
      rail: rail as RailName,
      ...(chain ? { chain } : {}),
      payment_endpoint: null,
      health: 'unknown' as const,
      last_health_check: null,
    })),
    op_trust_tier: 1,
    agent_callable_tier: raw.agent_callable_tier ?? 'human-checkout',
    accepts_usdc: raw.accepts_usdc ?? mapped.some((m) => m.rail === 'usdc'),
    accepts_x402: raw.accepts_x402 ?? mapped.some((m) => m.rail === 'x402'),
    pricing_model: raw.pricing_model ?? 'variable',
    last_verified_at: null,
    source: 'crawled',
    source_attribution: attributionString(provenance),
    op_attestation_url: null,
    tags,
  };
  if (raw.agent_endpoints && Object.keys(raw.agent_endpoints).length > 0) {
    record.agent_endpoints = raw.agent_endpoints;
  }

  // 4. Classify.
  let status: CandidateStatus;
  if (mapped.length === 0) {
    status = 'reject';
    reasons.push('no native crypto rail mapped — fails inclusion criterion 2');
  } else if (mergeable.length === 0) {
    status = 'pending-rail-support';
    reasons.push(`only deferred rails [${deferred.join(', ')}] — stage until Appendix A`);
  } else if (!raw.category) {
    status = 'hold';
    reasons.push('category not assigned by source — manual category review');
  } else if (hadUnmappable) {
    status = 'hold';
    reasons.push('partially ambiguous rail claims — manual review');
  } else {
    status = 'ready';
  }

  return {
    record,
    status,
    reasons,
    provenance,
    deferred_rails: deferred,
    mappable: mapped.length > 0,
  };
}
