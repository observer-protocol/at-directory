'use client';
import type { OpTrustTier } from '@at-directory/core';
import { useDerivedTier } from './useDerivedTier';
import { TrustBadge } from './TrustBadge';

// Thin self-fetching wrapper for single-badge contexts (merchant detail
// page). Card grids use useDerivedTier directly so the whole card reacts.
export function LiveTrustBadge({
  merchantId,
  fallbackTier,
  attestationUrl,
}: {
  merchantId: string;
  fallbackTier: OpTrustTier;
  attestationUrl?: string | null;
}) {
  const { tier, count } = useDerivedTier(merchantId, fallbackTier);
  return <TrustBadge tier={tier} count={count} attestationUrl={attestationUrl} />;
}
