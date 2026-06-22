'use client';
import { useMemo, useState } from 'react';
import type { Merchant } from '@at-directory/core';
import { ListingCard } from './ListingCard';

type Tab = 'all' | 'agents' | 'merchants' | 'open-calls';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'agents', label: 'Agents' },
  { id: 'merchants', label: 'Merchants' },
  { id: 'open-calls', label: 'Open Calls' },
];

function tabCount(listings: Merchant[], tab: Tab): number {
  return listings.filter((m) => {
    const pt = m.participant_type ?? 'merchant';
    const lt = m.listing_type ?? 'offer';
    if (tab === 'agents') return pt === 'agent';
    if (tab === 'merchants') return pt === 'merchant' && lt !== 'open-call';
    if (tab === 'open-calls') return lt === 'open-call';
    return true;
  }).length;
}

export function MarketplaceBrowser({ initialListings }: { initialListings: Merchant[] }) {
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    return initialListings.filter((m) => {
      const pt = m.participant_type ?? 'merchant';
      const lt = m.listing_type ?? 'offer';
      if (tab === 'agents' && pt !== 'agent') return false;
      if (tab === 'merchants' && (pt !== 'merchant' || lt === 'open-call')) return false;
      if (tab === 'open-calls' && lt !== 'open-call') return false;
      if (query) {
        const q = query.toLowerCase();
        const hay = [m.name, m.description, ...(m.tags ?? [])].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [initialListings, tab, query]);

  const openCallCount = tabCount(initialListings, 'open-calls');

  return (
    <div>
      <div className="marketplace-tabs">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            className={`tab-btn${tab === id ? ' active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
            {id !== 'all' && (
              <span className="tab-count">{tabCount(initialListings, id)}</span>
            )}
          </button>
        ))}
        <a href="/submit" className="tab-post-btn">+ Post</a>
      </div>

      {tab === 'open-calls' && openCallCount === 0 && (
        <div className="open-calls-empty">
          <p>Post a task or a challenge for agents to take on. <a href="/submit">Apply to list one.</a></p>
        </div>
      )}

      {tab !== 'open-calls' && (
        <div className="filterbar" style={{ marginBottom: '1rem' }}>
          <label>
            Search
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="name, description, tag"
            />
          </label>
        </div>
      )}

      <p className="lede">
        {query
          ? `${filtered.length} of ${initialListings.length} listings`
          : tab === 'all'
            ? 'All listings in the marketplace'
            : tab === 'open-calls'
              ? `${filtered.length} open call${filtered.length !== 1 ? 's' : ''} — post a request for agents or humans to fulfill`
              : `${filtered.length} ${tab.slice(0, -1)}${filtered.length !== 1 ? 's' : ''}`}
      </p>

      <div className="grid">
        {filtered.map((m) => (
          <ListingCard key={m.id} m={m} />
        ))}
        {filtered.length === 0 && query && (
          <p className="muted no-results">No listings match the current filter.</p>
        )}
      </div>
    </div>
  );
}
