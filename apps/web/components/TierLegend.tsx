// Static legend (threshold language) so any visitor understands the
// trust system without external docs. Cards show actual counts; this
// explains the tiers. Server component — no fetch.
const ITEMS = [
  { tier: 1, name: 'Tier 1', desc: 'Self-attested — the merchant’s own claim.' },
  {
    tier: 2,
    name: 'Tier 2',
    desc: 'Verified by 1+ counterparties — OP-credentialed agents attested real transactions.',
  },
  {
    tier: 3,
    name: 'Tier 3',
    desc: 'OP-native, counterparty-verified — the merchant runs Observer Protocol.',
  },
];

export function TierLegend() {
  return (
    <div className="tier-legend" aria-label="Observer Protocol trust tiers">
      <p className="tier-legend-title">
        Trust tiers — derived from verifiable attestations, not self-reported:
      </p>
      {ITEMS.map((it) => (
        <div key={it.tier} className="tier-legend-row">
          <span className={`badge tier${it.tier}`}>
            {it.tier >= 2 ? '✓' : '◈'} {it.name}
          </span>
          <span className="tier-legend-desc">{it.desc}</span>
        </div>
      ))}
    </div>
  );
}
