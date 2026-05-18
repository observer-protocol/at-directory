'use client';
import type { Merchant } from '@at-directory/core';
import { useDerivedTier } from './useDerivedTier';
import { TrustBadge } from './TrustBadge';
import { RailIcon } from './RailIcon';

const CALLABLE_LABEL: Record<string, string> = {
  'full-api': 'Agent-callable: full API',
  'structured-handoff': 'Agent-callable: structured handoff',
  'human-checkout': 'Human checkout',
};

export function MerchantCard({ m }: { m: Merchant }) {
  // One derived-tier fetch per card, hoisted so the whole card (border,
  // header tint, glow) reflects the tier — not just the badge. Renders
  // the static fallback tier instantly, upgrades on resolve.
  const { tier, count } = useDerivedTier(m.id, m.op_trust_tier);
  return (
    <div className={`card tier${tier}`}>
      <div className="row cardhead">
        <div
          className="logo"
          style={{
            backgroundImage: `url(/logos/${m.id}.svg)`,
            backgroundSize: 'cover',
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
        <TrustBadge tier={tier} count={count} attestationUrl={m.op_attestation_url} />
        <span className="badge callable">{CALLABLE_LABEL[m.agent_callable_tier]}</span>
        {m.accepts_usdc && <span className="badge">+ USDC</span>}
      </div>
    </div>
  );
}
