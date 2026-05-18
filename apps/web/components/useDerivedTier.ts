'use client';
import { useEffect, useState } from 'react';
import type { OpTrustTier } from '@at-directory/core';

// §0.2-C: the static tier is an instant fallback; the directory API
// derives the real tier from on-chain/Lightning attestations. One fetch
// per merchant, hoisted here so the whole card (not just the badge) can
// react. Fail-soft: if the API is unreachable, the fallback stays.
const DIRECTORY_API = process.env.NEXT_PUBLIC_DIRECTORY_API ?? 'https://mcp.agenticterminal.ai';

export function useDerivedTier(
  merchantId: string,
  fallbackTier: OpTrustTier,
): { tier: number; count: number | null } {
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

  return { tier, count };
}
