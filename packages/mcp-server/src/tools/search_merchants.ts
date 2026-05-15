import { searchMerchants } from '@at-directory/core';
import type { MerchantSummary } from '@at-directory/core';
import { z } from 'zod';
import {
  ANON_RESULT_CAP,
  ANON_RESULT_DEFAULT,
  CRED_RESULT_CAP,
  CRED_RESULT_DEFAULT,
  type ToolContext,
} from '../context.ts';

export const SearchMerchantsArgs = z.object({
  query: z.string().optional(),
  rail: z.enum(['lightning', 'bolt12', 'l402', 'usdt']).optional(),
  chain: z.enum(['tron', 'ethereum', 'solana', 'bsc', 'polygon', 'arbitrum', 'base']).optional(),
  category: z.string().optional(),
  agent_callable_tier: z.enum(['full-api', 'structured-handoff', 'human-checkout']).optional(),
  trust_tier_min: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  accepts_usdc: z.boolean().optional(),
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
  const authenticated = ctx.identity.authenticated;
  const cap = authenticated ? CRED_RESULT_CAP : ANON_RESULT_CAP;
  const defaultLimit = authenticated ? CRED_RESULT_DEFAULT : ANON_RESULT_DEFAULT;
  const limit = Math.min(args.limit ?? defaultLimit, cap);

  const trustCeil = authenticated ? 3 : 1;
  const eligible = ctx.merchants.filter((m) => m.op_trust_tier <= trustCeil);

  const search = searchMerchants(eligible, { ...args, limit });
  return {
    results: search.results,
    total_matching: search.total_matching,
    truncated: search.truncated,
    agent_identity: ctx.identity,
  };
}
