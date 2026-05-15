import { z } from 'zod';
import type { ToolContext } from '../context.ts';
import { verifyRail } from '../verify/index.ts';
import type { ToolError } from './get_merchant.ts';

export const VerifyPaymentEndpointArgs = z.object({
  merchant_id: z.string().min(1),
  rail: z.enum(['lightning', 'bolt12', 'l402', 'usdt']),
});

export type VerifyPaymentEndpointArgs = z.infer<typeof VerifyPaymentEndpointArgs>;

export interface VerifyPaymentEndpointSuccess {
  merchant_id: string;
  rail: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  detail: string;
  checked_at: string;
  evidence: Record<string, unknown>;
  agent_identity: ToolContext['identity'];
}

export async function verifyPaymentEndpointTool(
  args: VerifyPaymentEndpointArgs,
  ctx: ToolContext,
): Promise<VerifyPaymentEndpointSuccess | ToolError> {
  const merchant = ctx.merchants.find((m) => m.id === args.merchant_id);
  if (!merchant) {
    return {
      error: { code: 'unknown_merchant', message: `No merchant '${args.merchant_id}'.` },
      agent_identity: ctx.identity,
    };
  }
  if (!ctx.identity.authenticated && merchant.op_trust_tier > 1) {
    return {
      error: {
        code: 'credential_required',
        message: `Merchant '${args.merchant_id}' is Tier ${merchant.op_trust_tier}; anonymous callers see Tier 1 only.`,
      },
      agent_identity: ctx.identity,
    };
  }
  if (!merchant.rails.some((r) => r.rail === args.rail)) {
    return {
      error: {
        code: 'unsupported_rail',
        message: `Merchant '${args.merchant_id}' does not support the '${args.rail}' rail.`,
      },
      agent_identity: ctx.identity,
    };
  }

  const result = await verifyRail(merchant, args.rail);
  return {
    merchant_id: args.merchant_id,
    rail: args.rail,
    status: result.status,
    detail: result.detail,
    checked_at: new Date().toISOString(),
    evidence: result.evidence,
    agent_identity: ctx.identity,
  };
}
