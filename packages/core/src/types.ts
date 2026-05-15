export type Category =
  | 'gift-cards'
  | 'travel'
  | 'vpn-privacy'
  | 'hosting-domains'
  | 'physical-goods'
  | 'content-creator'
  | 'marketplace'
  | 'compute'
  | 'communication'
  | 'payment-network'
  | 'concierge'
  | 'gaming';

export type RailName = 'lightning' | 'bolt12' | 'l402' | 'usdt';

export type UsdtChain = 'tron' | 'ethereum' | 'solana' | 'bsc' | 'polygon' | 'arbitrum' | 'base';

export type RailHealth = 'healthy' | 'degraded' | 'down' | 'unknown';

export type AgentCallableTier = 'full-api' | 'structured-handoff' | 'human-checkout';

export type OpTrustTier = 1 | 2 | 3;

export type PricingModel = 'subscription' | 'per-product' | 'per-request' | 'variable' | 'free';

export type Source = 'crawled' | 'self-registered' | 'integrated';

export interface Rail {
  rail: RailName;
  chain?: UsdtChain;
  payment_endpoint?: string | null;
  health: RailHealth;
  last_health_check?: string | null;
}

export interface AgentEndpoints {
  mcp_server?: string;
  auth_note?: string;
  api_docs?: string;
  openapi_url?: string;
}

export interface Merchant {
  id: string;
  name: string;
  url: string;
  description: string;
  category: Category;
  rails: Rail[];
  op_trust_tier: OpTrustTier;
  agent_callable_tier: AgentCallableTier;
  agent_endpoints?: AgentEndpoints;
  accepts_usdc: boolean;
  accepts_x402: boolean;
  pricing_model: PricingModel;
  last_verified_at?: string | null;
  source: Source;
  source_attribution?: string;
  op_attestation_url?: string | null;
  logo_url?: string;
  tags?: string[];
}

export interface MerchantSummary {
  id: string;
  name: string;
  url: string;
  description: string;
  category: Category;
  op_trust_tier: OpTrustTier;
  agent_callable_tier: AgentCallableTier;
  rails: Array<Pick<Rail, 'rail' | 'chain'>>;
  accepts_usdc: boolean;
  accepts_x402: boolean;
}

export type AgentIdentityTier = 'anonymous' | 'basic' | 'elevated' | 'premium';

export interface AgentIdentity {
  authenticated: boolean;
  tier_cap: AgentIdentityTier;
}
