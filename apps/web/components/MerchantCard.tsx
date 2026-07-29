'use client';
import type { Merchant } from '@at-directory/core';
import { TrustTier } from './TrustTier';
import { RailIcon } from './RailIcon';

// The lead signal on every card now that trust tiers are suppressed
// (see lib/display-policy.ts). Objective, checkable against the merchant's
// own documentation, and populated on all 78 merchants.
const CALLABLE_LABEL: Record<string, string> = {
  'full-api': 'Full API',
  'structured-handoff': 'Structured handoff',
  'human-checkout': 'Human checkout',
};

const TYPE_LABEL: Record<string, string> = {
  agent: 'Agent',
  merchant: 'Merchant',
};

export function MerchantCard({ m }: { m: Merchant }) {
  const pType = m.participant_type ?? 'merchant';
  const isNonMerchant = pType !== 'merchant';
  return (
    <div className={`card${isNonMerchant ? ` card-${pType}` : ''}`}>
      {isNonMerchant && (
        <div className="listing-type-row">
          <span className={`badge type-${pType}`}>{TYPE_LABEL[pType]}</span>
        </div>
      )}
      <div className="row cardhead">
        <div
          className="logo"
          style={{
            backgroundImage: `url(${m.logo_url ?? `/logos/${m.id}.svg`})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          aria-hidden
        />
        <h3>
          <a href={`/merchants/${m.id}/`}>{m.name}</a>
        </h3>
      </div>
      <div className="desc">{m.description}</div>
      <div className="row">
        {m.rails.map((r, i) => (
          <RailIcon key={i} rail={r.rail} chain={r.chain} />
        ))}
      </div>
      <div className="row">
        <span className={`badge callable callable-${m.agent_callable_tier}`}>
          {CALLABLE_LABEL[m.agent_callable_tier]}
        </span>
        {m.accepts_usdc && <span className="badge">+ USDC</span>}
        <TrustTier
          merchantId={m.id}
          fallbackTier={m.op_trust_tier}
          attestationUrl={m.op_attestation_url}
        />
      </div>
    </div>
  );
}
