import type { AgentIdentityTier } from '@at-directory/core';
import type { ToolContext } from '../context.ts';
import { ANON_RESULT_CAP, CRED_RESULT_CAP } from '../context.ts';

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
      result_cap: authenticated ? CRED_RESULT_CAP : ANON_RESULT_CAP,
      requests_per_minute: authenticated ? 300 : 30,
    },
  };
  if (ctx.credentialDetails) response.credential = ctx.credentialDetails;
  return response;
}
