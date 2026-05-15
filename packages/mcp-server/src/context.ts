import type { AgentIdentity, Merchant } from '@at-directory/core';

export interface ToolContext {
  merchants: Merchant[];
  identity: AgentIdentity;
}

export const ANON_RESULT_CAP = 20;
export const CRED_RESULT_CAP = 100;
export const CRED_RESULT_DEFAULT = 50;
export const ANON_RESULT_DEFAULT = 20;
