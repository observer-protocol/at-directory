'use client';
import type { Merchant } from '@at-directory/core';
import { useDerivedTier } from './useDerivedTier';
import { TrustBadge } from './TrustBadge';
import { RailIcon } from './RailIcon';
import { MerchantTrustPanel } from './MerchantTrustPanel';

const TYPE_LABEL: Record<string, string> = {
  agent: 'Agent',
  human: 'Human',
  merchant: 'Merchant',
};

export function ListingCard({ m }: { m: Merchant }) {
  const { tier, count } = useDerivedTier(m.id, m.op_trust_tier);
  const pType = m.participant_type ?? 'merchant';
  const lType = m.listing_type ?? 'offer';
  const isOpenCall = lType === 'open-call';
  const isNonMerchant = pType !== 'merchant';

  return (
    <div
      className={`card tier${tier}${isNonMerchant ? ` card-${pType}` : ''}${isOpenCall ? ' card-open-call' : ''}`}
    >
      {(isNonMerchant || isOpenCall) && (
        <div className="listing-type-row">
          {isNonMerchant && (
            <span className={`badge type-${pType}`}>{TYPE_LABEL[pType]}</span>
          )}
          {isOpenCall && <span className="badge open-call">Wanted</span>}
        </div>
      )}
      <div className="row cardhead">
        <div
          className="logo"
          style={{ backgroundImage: `url(/logos/${m.id}.svg)`, backgroundSize: 'cover' }}
          aria-hidden
        />
        <h3>
          <a href={`/merchants/${m.id}/`}>{m.name}</a>
        </h3>
      </div>
      <div className="desc">{m.description}</div>
      {m.price_display && <div className="price-display">{m.price_display}</div>}
      <div className="row">
        {m.rails.map((r, i) => (
          <RailIcon key={i} rail={r.rail} chain={r.chain} />
        ))}
      </div>
      <div className="row">
        <TrustBadge tier={tier} count={count} attestationUrl={m.op_attestation_url} />
      </div>
      {m.merchant_vc_url ? (
        <MerchantTrustPanel vcUrl={m.merchant_vc_url} />
      ) : null}
      {m.contact_url && (
        <a className="connect-btn" href={m.contact_url} target="_blank" rel="noreferrer">
          {isOpenCall ? 'Respond →' : 'Connect →'}
        </a>
      )}
    </div>
  );
}
