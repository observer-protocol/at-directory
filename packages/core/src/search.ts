import type {
  AgentCallableTier,
  Category,
  Merchant,
  MerchantSummary,
  OpTrustTier,
  RailName,
  UsdtChain,
} from './types.ts';

export interface SearchOptions {
  query?: string;
  rail?: RailName;
  chain?: UsdtChain;
  category?: Category;
  agent_callable_tier?: AgentCallableTier;
  trust_tier_min?: OpTrustTier;
  accepts_usdc?: boolean;
  limit?: number;
}

export interface SearchResult {
  results: MerchantSummary[];
  total_matching: number;
  truncated: boolean;
}

const DEFAULT_LIMIT = 50;

export function searchMerchants(merchants: Merchant[], opts: SearchOptions = {}): SearchResult {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const filtered = merchants.filter((m) => matches(m, opts));
  const ranked = filtered.slice().sort(rank);
  const results = ranked.slice(0, limit).map(toSummary);
  return {
    results,
    total_matching: filtered.length,
    truncated: filtered.length > results.length,
  };
}

function matches(m: Merchant, opts: SearchOptions): boolean {
  if (opts.category && m.category !== opts.category) return false;
  if (opts.agent_callable_tier && m.agent_callable_tier !== opts.agent_callable_tier) return false;
  if (opts.trust_tier_min !== undefined && m.op_trust_tier < opts.trust_tier_min) return false;
  if (opts.accepts_usdc !== undefined && m.accepts_usdc !== opts.accepts_usdc) return false;
  if (opts.rail) {
    const rails = m.rails.filter((r) => r.rail === opts.rail);
    if (rails.length === 0) return false;
    if (opts.chain && !rails.some((r) => r.chain === opts.chain)) return false;
  } else if (opts.chain) {
    if (!m.rails.some((r) => r.chain === opts.chain)) return false;
  }
  if (opts.query) {
    const q = opts.query.toLowerCase();
    const hay = [m.name, m.description, ...(m.tags ?? [])].join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function rank(a: Merchant, b: Merchant): number {
  if (a.op_trust_tier !== b.op_trust_tier) return b.op_trust_tier - a.op_trust_tier;
  const av = a.last_verified_at ?? '';
  const bv = b.last_verified_at ?? '';
  if (av !== bv) return bv.localeCompare(av);
  return a.name.localeCompare(b.name);
}

function toSummary(m: Merchant): MerchantSummary {
  return {
    id: m.id,
    name: m.name,
    url: m.url,
    description: m.description,
    category: m.category,
    op_trust_tier: m.op_trust_tier,
    agent_callable_tier: m.agent_callable_tier,
    rails: m.rails.map((r) => (r.chain ? { rail: r.rail, chain: r.chain } : { rail: r.rail })),
    accepts_usdc: m.accepts_usdc,
    accepts_x402: m.accepts_x402,
  };
}
