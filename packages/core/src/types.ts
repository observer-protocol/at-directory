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

export type RailName = 'lightning' | 'bolt12' | 'l402' | 'usdt' | 'usdc' | 'btc' | 'fiat';

// Settlement chain for a token rail. USDT and USDC both ship on several
// chains, so the chain is part of the payment instruction, not decoration.
export type TokenChain = 'tron' | 'ethereum' | 'solana' | 'bsc' | 'polygon' | 'arbitrum' | 'base';

export type RailHealth = 'healthy' | 'degraded' | 'down' | 'unknown';

export type AgentCallableTier = 'full-api' | 'structured-handoff' | 'human-checkout';

// Can an agent complete a purchase here without a human driving a browser?
//
// Declared as a total map rather than `tier !== 'human-checkout'` so that
// adding a fourth tier to the union above fails typecheck here until
// somebody classifies it. The default matters in money: the directory
// bounty pays 10,000 sats for an agent-callable merchant and 2,000 for a
// human-checkout one, so a tier that lands on the wrong side of this line
// by omission underpays a submitter against published terms.
export const AGENT_CALLABLE: Record<AgentCallableTier, boolean> = {
  'full-api': true,
  'structured-handoff': true,
  'human-checkout': false,
};

export function isAgentCallable(tier: AgentCallableTier): boolean {
  return AGENT_CALLABLE[tier];
}

export type OpTrustTier = 1 | 2 | 3;

export type PricingModel = 'subscription' | 'per-product' | 'per-request' | 'variable' | 'free';

export type Source = 'crawled' | 'self-registered' | 'integrated';

export type ParticipantType = 'merchant' | 'agent';

export type ChallengeWhoCanApply = 'agents' | 'humans' | 'both';
export type ChallengeStatus = 'open' | 'judging' | 'paused' | 'closed' | 'winner';

export type ListingType = 'offer' | 'open-call';

export interface Rail {
  rail: RailName;
  chain?: TokenChain;
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
  terms_url?: string | null;
  contact_url?: string | null;
  logo_url?: string;
  tags?: string[];
  is_challenge?: boolean;
  challenge_prize?: string | null;
  challenge_deadline?: string | null;
  challenge_who_can_apply?: ChallengeWhoCanApply;
  challenge_status?: ChallengeStatus;
  posted_at?: string | null;
  poster_name?: string | null;
  poster_did?: string | null;
  poster_did_verified?: boolean | null;
  pinned?: boolean | null;
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
  terms_url?: string | null;
  contact_url?: string | null;
}

export type AgentIdentityTier = 'anonymous' | 'basic' | 'elevated' | 'premium';

export interface AgentIdentity {
  authenticated: boolean;
  tier_cap: AgentIdentityTier;
}
