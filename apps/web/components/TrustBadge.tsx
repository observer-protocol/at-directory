// Presentational only — tier/count come resolved from useDerivedTier
// (via MerchantCard or LiveTrustBadge). No fetching here.
function label(tier: number, count: number | null): string {
  const n = count ?? 1;
  const cp = `${n} counterpart${n === 1 ? 'y' : 'ies'}`;
  if (tier >= 3) return `Tier 3 — OP-native, verified by ${cp}`;
  if (tier >= 2) return `Tier 2 — Verified by ${cp}`;
  return 'Tier 1 — Self-attested';
}

export function TrustBadge({
  tier,
  count,
  attestationUrl,
}: {
  tier: number;
  count: number | null;
  attestationUrl?: string | null;
}) {
  const icon = tier >= 2 ? '✓' : '◈';
  const badge = (
    <span
      className={`badge tier${tier}`}
      title="Observer Protocol trust tier (derived from attestations)"
    >
      {icon} {label(tier, count)}
    </span>
  );
  if (tier >= 2 && attestationUrl) {
    return (
      <a href={attestationUrl} target="_blank" rel="noreferrer">
        {badge}
      </a>
    );
  }
  return badge;
}
