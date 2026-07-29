'use client';
import { useEffect, useState } from 'react';
import type { OpTrustTier } from '@at-directory/core';
import { SHOW_TRUST_TIERS } from '@/lib/display-policy';

// The whole trust-tier display, in one place: the policy switch, the
// derived-tier fetch, and the badge. It renders nothing while
// SHOW_TRUST_TIERS is false, and issues no request — the early return is
// above every hook, and the flag is a module constant, so the hook order
// is stable and this is not a conditional-hook violation.
//
// Kept intact rather than deleted so that restoring the display is one
// constant, not an archaeology exercise. See display-policy.ts for why it
// is off and the condition for turning it back on.

const DIRECTORY_API = process.env.NEXT_PUBLIC_DIRECTORY_API ?? 'https://mcp.agenticterminal.ai';

function label(tier: number, count: number | null): string {
  const n = count ?? 1;
  const cp = `${n} counterpart${n === 1 ? 'y' : 'ies'}`;
  if (tier >= 3) return `Tier 3 — OP-native, verified by ${cp}`;
  if (tier >= 2) return `Tier 2 — Verified by ${cp}`;
  return 'Tier 1 — Self-attested';
}

export function TrustTier({
  merchantId,
  fallbackTier,
  attestationUrl,
}: {
  merchantId: string;
  fallbackTier: OpTrustTier;
  attestationUrl?: string | null;
}) {
  if (!SHOW_TRUST_TIERS) return null;
  return (
    <ResolvedTrustTier
      merchantId={merchantId}
      fallbackTier={fallbackTier}
      attestationUrl={attestationUrl}
    />
  );
}

// §0.2-C: the static tier is an instant fallback; the directory API derives
// the real tier from on-chain/Lightning attestations. Fail-soft: if the API
// is unreachable, the fallback stays.
function ResolvedTrustTier({
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
    fetch(`${DIRECTORY_API}/v1/merchants/${encodeURIComponent(merchantId)}`, { signal: ac.signal })
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

  const badge = (
    <span
      className={`badge tier${tier}`}
      title="Observer Protocol trust tier (derived from attestations)"
    >
      {tier >= 2 ? '✓' : '◈'} {label(tier, count)}
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
