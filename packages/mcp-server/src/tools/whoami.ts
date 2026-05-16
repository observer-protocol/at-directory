import type { AgentIdentityTier } from '@at-directory/core';
import type { ToolContext } from '../context.ts';
import { READ_MAX_LIMIT, ANON_RPM, CRED_RPM } from '../context.ts';

export interface WhoamiResponse {
  authenticated: boolean;
  tier_cap: AgentIdentityTier;
  limits: {
    result_cap: number;
    requests_per_minute: number;
  };
  credential?: {
    subject_did: string;
    issuer: string;
    valid_until?: string;
  };
}

export interface WhoamiContext extends ToolContext {
  credentialDetails?: {
    subject_did: string;
    issuer: string;
    valid_until?: string;
  };
}

export function whoamiTool(_args: Record<string, never>, ctx: WhoamiContext): WhoamiResponse {
  const authenticated = ctx.identity.authenticated;
  const response: WhoamiResponse = {
    authenticated,
    tier_cap: ctx.identity.tier_cap,
    limits: {
      // Reads are uniform regardless of auth; only the rate limit differs.
      result_cap: READ_MAX_LIMIT,
      requests_per_minute: authenticated ? CRED_RPM : ANON_RPM,
    },
  };
  if (ctx.credentialDetails) response.credential = ctx.credentialDetails;
  return response;
}
