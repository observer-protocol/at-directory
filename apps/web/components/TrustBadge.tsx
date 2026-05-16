import type { OpTrustTier } from '@at-directory/core';

const LABEL: Record<OpTrustTier, string> = {
  1: 'Tier 1 · Self-attested',
  2: 'Tier 2 · Operator-verified',
  3: 'Tier 3 · Chain-anchored',
};

export function TrustBadge({
  tier,
  attestationUrl,
}: {
  tier: OpTrustTier;
  attestationUrl?: string | null;
}) {
  const badge = (
    <span className={`badge tier${tier}`} title="Observer Protocol trust tier">
      ◈ {LABEL[tier]}
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
