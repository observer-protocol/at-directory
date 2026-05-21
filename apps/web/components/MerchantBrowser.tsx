'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Merchant } from '@at-directory/core';
import { MerchantCard } from './MerchantCard';

interface Props {
  merchants: Merchant[];
  categories: Array<{ id: string; label: string }>;
  rails: Array<{ id: string; label: string }>;
}

// Live AT Directory API. The build-time snapshot baked into this Next.js
// export carries static `op_trust_tier: 1` for every merchant (those
// values are seeds, not the derived tier). The live API overlays the
// WI-2-derived tier per request — that's the surface the "OP trust min"
// filter needs to consult. Logged 2026-05-20 in /FOLLOWUPS.md.
const LIVE_DIRECTORY_URL = 'https://mcp.agenticterminal.ai/v1/merchants';

export function MerchantBrowser({ merchants, categories, rails }: Props) {
  const [q, setQ] = useState('');
  const [rail, setRail] = useState('');
  const [category, setCategory] = useState('');
  const [callable, setCallable] = useState('');
  const [trustMin, setTrustMin] = useState('');
  const [usdc, setUsdc] = useState(false);

  // Live tier overlay: fetch the API list on mount and build a map of
  // merchant_id → derived tier. Filter consults the map; falls back to
  // the build-time static `op_trust_tier` when the live fetch hasn't
  // resolved (first render) or the merchant isn't in the live response.
  const [liveTiers, setLiveTiers] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    let aborted = false;
    fetch(LIVE_DIRECTORY_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (aborted || !d || !Array.isArray(d.results)) return;
        const map: Record<string, number> = {};
        for (const m of d.results as Array<{
          id: string;
          op_trust_tier?: number;
          op_trust?: { tier?: number };
        }>) {
          const t =
            m.op_trust && typeof m.op_trust.tier === 'number' ? m.op_trust.tier : m.op_trust_tier;
          if (typeof t === 'number') map[m.id] = t;
        }
        setLiveTiers(map);
      })
      .catch(() => {
        /* swallow — filter falls back to static */
      });
    return () => {
      aborted = true;
    };
  }, []);

  const tierOf = (m: Merchant): number => {
    if (liveTiers && typeof liveTiers[m.id] === 'number') return liveTiers[m.id];
    return m.op_trust_tier;
  };

  const filtered = useMemo(() => {
    return merchants.filter((m) => {
      if (rail && !m.rails.some((r) => r.rail === rail)) return false;
      if (category && m.category !== category) return false;
      if (callable && m.agent_callable_tier !== callable) return false;
      if (trustMin && tierOf(m) < Number(trustMin)) return false;
      if (usdc && !m.accepts_usdc) return false;
      if (q) {
        const hay = `${m.name} ${m.description} ${(m.tags ?? []).join(' ')}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [merchants, liveTiers, q, rail, category, callable, trustMin, usdc]);

  const filterActive = Boolean(q || rail || category || callable || trustMin || usdc);

  return (
    <div>
      <div className="filterbar">
        <label>
          Search
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="name, description, tag"
          />
        </label>
        <label>
          Rail
          <select value={rail} onChange={(e) => setRail(e.target.value)}>
            <option value="">any</option>
            {rails.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">any</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Agent-callable
          <select value={callable} onChange={(e) => setCallable(e.target.value)}>
            <option value="">any</option>
            <option value="full-api">full API</option>
            <option value="structured-handoff">structured handoff</option>
            <option value="human-checkout">human checkout</option>
          </select>
        </label>
        <label>
          OP trust min
          <select value={trustMin} onChange={(e) => setTrustMin(e.target.value)}>
            <option value="">any</option>
            <option value="1">Tier 1+</option>
            <option value="2">Tier 2+</option>
          </select>
        </label>
        <label>
          USDC
          <span style={{ paddingTop: 6 }}>
            <input type="checkbox" checked={usdc} onChange={(e) => setUsdc(e.target.checked)} />{' '}
            accepted
          </span>
        </label>
      </div>
      <p className="lede">
        {filterActive
          ? `${filtered.length} of ${merchants.length} merchants`
          : 'Browse the full directory'}
      </p>
      <div className="grid">
        {filtered.map((m) => (
          <MerchantCard key={m.id} m={m} />
        ))}
      </div>
    </div>
  );
}
