import type { Merchant } from '@at-directory/core';
import { z } from 'zod';
import type { ToolContext } from '../context.ts';

export const GetMerchantArgs = z.object({
  id: z.string().min(1),
});

export type GetMerchantArgs = z.infer<typeof GetMerchantArgs>;

export interface GetMerchantSuccess {
  merchant: Merchant;
  agent_identity: ToolContext['identity'];
}

export interface ToolError {
  error: {
    code: ToolErrorCode;
    message: string;
    retriable?: boolean;
  };
  agent_identity: ToolContext['identity'];
}

export type ToolErrorCode =
  | 'credential_required'
  | 'credential_invalid'
  | 'credential_expired'
  | 'rate_limited'
  | 'unknown_merchant'
  | 'unsupported_rail'
  | 'verification_unavailable';

export function getMerchantTool(
  args: GetMerchantArgs,
  ctx: ToolContext,
): GetMerchantSuccess | ToolError {
  const merchant = ctx.merchants.find((m) => m.id === args.id);
  if (!merchant) {
    return {
      error: { code: 'unknown_merchant', message: `No merchant found with id '${args.id}'.` },
      agent_identity: ctx.identity,
    };
  }
  if (!ctx.identity.authenticated && merchant.op_trust_tier > 1) {
    return {
      error: {
        code: 'credential_required',
        message: `Merchant '${args.id}' is Tier ${merchant.op_trust_tier} and requires an AT credential. Anonymous callers see Tier 1 only.`,
      },
      agent_identity: ctx.identity,
    };
  }
  return { merchant, agent_identity: ctx.identity };
}
