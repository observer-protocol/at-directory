import type { AgentIdentity, Merchant } from '@at-directory/core';

export interface ToolContext {
  merchants: Merchant[];
  identity: AgentIdentity;
}

// v1 launch model: reads are NOT credential-gated. Anonymous and
// credentialed callers see all tiers and the same result limits —
// anonymous discovery is the primary path (an agent with its own
// infra discovers and transacts without any pre-issued AT credential).
// Credentials gate write access and rate limits, not reads (spec §4.3/§4.5).
export const READ_DEFAULT_LIMIT = 50;
export const READ_MAX_LIMIT = 100;

// Rate limits remain credential-gated (spec §4.5).
export const ANON_RPM = 30;
export const CRED_RPM = 300;
