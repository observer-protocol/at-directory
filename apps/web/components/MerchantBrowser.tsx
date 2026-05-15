'use client';

import { useMemo, useState } from 'react';
import type { Merchant } from '@at-directory/core';
import { MerchantCard } from './MerchantCard';

interface Props {
  merchants: Merchant[];
  categories: Array<{ id: string; label: string }>;
  rails: Array<{ id: string; label: string }>;
}

export function MerchantBrowser({ merchants, categories, rails }: Props) {
  const [q, setQ] = useState('');
  const [rail, setRail] = useState('');
  const [category, setCategory] = useState('');
  const [callable, setCallable] = useState('');
  const [trustMin, setTrustMin] = useState('');
  const [usdc, setUsdc] = useState(false);

  const filtered = useMemo(() => {
    return merchants.filter((m) => {
      if (rail && !m.rails.some((r) => r.rail === rail)) return false;
      if (category && m.category !== category) return false;
      if (callable && m.agent_callable_tier !== callable) return false;
      if (trustMin && m.op_trust_tier < Number(trustMin)) return false;
      if (usdc && !m.accepts_usdc) return false;
      if (q) {
        const hay = `${m.name} ${m.description} ${(m.tags ?? []).join(' ')}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [merchants, q, rail, category, callable, trustMin, usdc]);

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
        {filtered.length} of {merchants.length} merchants
      </p>
      <div className="grid">
        {filtered.map((m) => (
          <MerchantCard key={m.id} m={m} />
        ))}
      </div>
    </div>
  );
}
