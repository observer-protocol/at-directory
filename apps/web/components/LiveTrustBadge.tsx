'use client';
import { useEffect, useState } from 'react';
import type { OpTrustTier } from '@at-directory/core';

// §0.2-C: the static tier is an instant fallback/cache; the directory
// API derives the real tier from on-chain/Lightning attestations. We
// render the static value immediately (SSR/export) then reconcile to
// the derived one — you literally watch a merchant resolve to its
// real tier. Fail-soft: if the API is unreachable, the fallback stays.
const DIRECTORY_API =
  process.env.NEXT_PUBLIC_DIRECTORY_API ?? 'https://mcp.agenticterminal.ai';

function label(tier: number, count: number | null): string {
  if (tier >= 3) return 'OP-native · counterparty-verified';
  if (tier >= 2) {
    if (count == null) return 'Verified by 1+ counterparties';
    return `Verified by ${count} counterpart${count === 1 ? 'y' : 'ies'}`;
  }
  return 'Self-attested';
}

export function LiveTrustBadge({
  merchantId,
  fallbackTier,
  attestationUrl,
}: {
  merchantId: string;
  fallbackTier: OpTrustTier;
  attestationUrl?: string | null;
}) {
  const [tier, setTier] = useState<number>(fallbackTier);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 4000);
    fetch(`${DIRECTORY_API}/v1/merchants/${encodeURIComponent(merchantId)}`, {
      signal: ac.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const m = d?.merchant;
        if (m && typeof m.op_trust_tier === 'number') {
          setTier(m.op_trust_tier);
          const n = m.op_trust?.distinct_attestors;
          if (typeof n === 'number') setCount(n);
        }
      })
      .catch(() => {
        /* fail-soft: keep the static fallback */
      })
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [merchantId]);

  const icon = tier >= 2 ? '✓' : '◈';
  const badge = (
    <span className={`badge tier${tier}`} title="Observer Protocol trust tier (derived from attestations)">
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
