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
  | 'gaming'
  | 'agent-services'
  | 'proxy';

export type RailName = 'lightning' | 'bolt12' | 'l402' | 'usdt' | 'btc' | 'fiat';

export type UsdtChain = 'tron' | 'ethereum' | 'solana' | 'bsc' | 'polygon' | 'arbitrum' | 'base';

export type RailHealth = 'healthy' | 'degraded' | 'down' | 'unknown';

export type AgentCallableTier = 'full-api' | 'structured-handoff' | 'human-checkout';

export type OpTrustTier = 1 | 2 | 3;

export type PricingModel = 'subscription' | 'per-product' | 'per-request' | 'variable' | 'free';

export type Source = 'crawled' | 'self-registered' | 'integrated';

export type ParticipantType = 'merchant' | 'agent';

export type ChallengeWhoCanApply = 'agents' | 'humans' | 'both';
export type ChallengeStatus = 'open' | 'judging' | 'closed' | 'winner';

export type ListingType = 'offer' | 'open-call';

export interface Rail {
  rail: RailName;
  chain?: UsdtChain;
  payment_endpoint?: string | null;
  health: RailHealth;
  last_health_check?: string | null;
}

export interface AgentEndpoints {
  mcp_server?: string;
  rest_api?: string;
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
  merchant_did?: string | null;
  merchant_vc_url?: string | null;
  merchant_controlled_key_ref?: string | null;
  participant_type?: ParticipantType;
  listing_type?: ListingType;
  price_display?: string | null;
  contact_url?: string | null;
  logo_url?: string;
  tags?: string[];
  is_challenge?: boolean;
  challenge_prize?: string | null;
  challenge_deadline?: string | null;
  challenge_who_can_apply?: ChallengeWhoCanApply;
  challenge_status?: ChallengeStatus;
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
  participant_type?: ParticipantType;
  listing_type?: ListingType;
  price_display?: string | null;
  contact_url?: string | null;
}

export type AgentIdentityTier = 'anonymous' | 'basic' | 'elevated' | 'premium';

export interface AgentIdentity {
  authenticated: boolean;
  tier_cap: AgentIdentityTier;
}
