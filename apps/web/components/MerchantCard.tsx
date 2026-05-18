import type { Merchant } from '@at-directory/core';
import { LiveTrustBadge } from './LiveTrustBadge';
import { RailIcon } from './RailIcon';

const CALLABLE_LABEL: Record<string, string> = {
  'full-api': 'Agent-callable: full API',
  'structured-handoff': 'Agent-callable: structured handoff',
  'human-checkout': 'Human checkout',
};

export function MerchantCard({ m }: { m: Merchant }) {
  return (
    <div className="card">
      <div className="row">
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
        <LiveTrustBadge
          merchantId={m.id}
          fallbackTier={m.op_trust_tier}
          attestationUrl={m.op_attestation_url}
        />
        <span className="badge callable">{CALLABLE_LABEL[m.agent_callable_tier]}</span>
        {m.accepts_usdc && <span className="badge">+ USDC</span>}
      </div>
    </div>
  );
}
