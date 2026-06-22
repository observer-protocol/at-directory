'use client';
import type { Merchant } from '@at-directory/core';
import { useDerivedTier } from './useDerivedTier';
import { TrustBadge } from './TrustBadge';
import { RailIcon } from './RailIcon';
import { MerchantTrustPanel } from './MerchantTrustPanel';

const TYPE_LABEL: Record<string, string> = {
  agent: 'Agent',
  merchant: 'Merchant',
};

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  judging: 'Judging',
  closed: 'Closed',
  winner: 'Winner announced',
};

const WHO_LABEL: Record<string, string> = {
  agents: 'Agents only',
  humans: 'Humans only',
  both: 'Agents & humans',
};

export function ListingCard({ m }: { m: Merchant }) {
  const { tier, count } = useDerivedTier(m.id, m.op_trust_tier);
  const pType = m.participant_type ?? 'merchant';
  const lType = m.listing_type ?? 'offer';
  const isOpenCall = lType === 'open-call';
  const isChallenge = Boolean(m.is_challenge);
  const isNonMerchant = pType !== 'merchant';

  const status = m.challenge_status ?? 'open';
  const deadlineStr = m.challenge_deadline
    ? new Date(m.challenge_deadline).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div
      className={`card tier${tier}${isNonMerchant ? ` card-${pType}` : ''}${isOpenCall ? ' card-open-call' : ''}${isChallenge ? ' card-challenge' : ''}`}
    >
      <div className="listing-type-row">
        {isNonMerchant && <span className={`badge type-${pType}`}>{TYPE_LABEL[pType]}</span>}
        {isChallenge && (
          <span className={`badge challenge-status status-${status}`}>
            {STATUS_LABEL[status]} Challenge
          </span>
        )}
        {isOpenCall && !isChallenge && <span className="badge open-call">Wanted</span>}
      </div>

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

      {isChallenge && (
        <div className="challenge-meta">
          {m.challenge_prize && (
            <div className="challenge-row">
              <span className="challenge-label">Prize</span>
              <span className="challenge-value prize">{m.challenge_prize}</span>
            </div>
          )}
          {m.challenge_who_can_apply && (
            <div className="challenge-row">
              <span className="challenge-label">Open to</span>
              <span className="challenge-value">{WHO_LABEL[m.challenge_who_can_apply]}</span>
            </div>
          )}
          {deadlineStr && (
            <div className="challenge-row">
              <span className="challenge-label">Deadline</span>
              <span className="challenge-value">{deadlineStr}</span>
            </div>
          )}
        </div>
      )}

      {!isChallenge && m.price_display && <div className="price-display">{m.price_display}</div>}

      {!isOpenCall && (
        <div className="row">
          {m.rails.map((r, i) => (
            <RailIcon key={i} rail={r.rail} chain={r.chain} />
          ))}
        </div>
      )}

      <div className="row">
        <TrustBadge tier={tier} count={count} attestationUrl={m.op_attestation_url} />
      </div>

      {m.merchant_vc_url ? <MerchantTrustPanel vcUrl={m.merchant_vc_url} /> : null}

      {m.contact_url && (
        <a className="connect-btn" href={m.contact_url} target="_blank" rel="noreferrer">
          {isChallenge ? 'Apply →' : isOpenCall ? 'Respond →' : 'Connect →'}
        </a>
      )}
    </div>
  );
}
