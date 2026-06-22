import { searchMerchants } from '@at-directory/core';
import type { MerchantSummary } from '@at-directory/core';
import { z } from 'zod';
import { READ_DEFAULT_LIMIT, READ_MAX_LIMIT, type ToolContext } from '../context.ts';

export const SearchMerchantsArgs = z.object({
  query: z.string().optional(),
  rail: z.enum(['lightning', 'bolt12', 'l402', 'usdt', 'btc', 'fiat']).optional(),
  chain: z.enum(['tron', 'ethereum', 'solana', 'bsc', 'polygon', 'arbitrum', 'base']).optional(),
  category: z.string().optional(),
  agent_callable_tier: z.enum(['full-api', 'structured-handoff', 'human-checkout']).optional(),
  trust_tier_min: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  accepts_usdc: z.boolean().optional(),
  participant_type: z.enum(['merchant', 'agent']).optional(),
  listing_type: z.enum(['offer', 'open-call']).optional(),
  limit: z.number().int().positive().optional(),
});

export type SearchMerchantsArgs = z.infer<typeof SearchMerchantsArgs>;

export interface SearchMerchantsResponse {
  results: MerchantSummary[];
  total_matching: number;
  truncated: boolean;
  agent_identity: ToolContext['identity'];
}

export function searchMerchantsTool(
  args: SearchMerchantsArgs,
  ctx: ToolContext,
): SearchMerchantsResponse {
  // Reads are not credential-gated: anonymous and credentialed callers
  // see all tiers and the same limits. Tier gating moved to writes/rate
  // limits (spec §4.3). agent_identity is still echoed honestly below.
  const limit = Math.min(args.limit ?? READ_DEFAULT_LIMIT, READ_MAX_LIMIT);
  const search = searchMerchants(ctx.merchants, { ...args, limit });
  return {
    results: search.results,
    total_matching: search.total_matching,
    truncated: search.truncated,
    agent_identity: ctx.identity,
  };
}
