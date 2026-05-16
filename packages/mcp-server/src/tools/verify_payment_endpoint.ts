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
  // Not credential-gated: verifying an endpoint is a read/diagnostic an
  // autonomous agent runs before transacting. Consistent with the
  // ungated get_merchant/search_merchants reads (spec §4.3). Abuse of
  // the live probe is bounded by rate limits (§4.5), not tier gating.
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
