'use client';
import { useMemo, useState } from 'react';
import type { Merchant } from '@at-directory/core';
import { ListingCard } from './ListingCard';
import { TaskCard } from './TaskCard';
import { PostTaskModal } from './PostTaskModal';

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

function sortOpenCalls(calls: Merchant[]): Merchant[] {
  return [...calls].sort((a, b) => {
    // Challenges with open status first, sorted by deadline ascending
    const aOpen = (a.challenge_status ?? 'open') === 'open';
    const bOpen = (b.challenge_status ?? 'open') === 'open';
    if (aOpen !== bOpen) return aOpen ? -1 : 1;
    const aD = a.challenge_deadline ? new Date(a.challenge_deadline).getTime() : Infinity;
    const bD = b.challenge_deadline ? new Date(b.challenge_deadline).getTime() : Infinity;
    if (aD !== bD) return aD - bD;
    // Ties: newer posted_at first
    const aP = a.posted_at ? new Date(a.posted_at).getTime() : 0;
    const bP = b.posted_at ? new Date(b.posted_at).getTime() : 0;
    return bP - aP;
  });
}

export function MarketplaceBrowser({ initialListings }: { initialListings: Merchant[] }) {
  const [tab, setTab] = useState<Tab>('open-calls');
  const [query, setQuery] = useState('');
  const [showPostModal, setShowPostModal] = useState(false);

  const filtered = useMemo(() => {
    const base = initialListings.filter((m) => {
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
    if (tab === 'open-calls') return sortOpenCalls(base);
    return base;
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
            {id !== 'all' && <span className="tab-count">{tabCount(initialListings, id)}</span>}
          </button>
        ))}
        <button className="tab-post-btn" onClick={() => setShowPostModal(true)}>
          + Post a Task
        </button>
      </div>

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

      {tab === 'open-calls' ? (
        <div className="open-calls-board">
          <div className="open-calls-board-header">
            <span className="open-calls-count">
              {openCallCount} open task{openCallCount !== 1 ? 's' : ''}
            </span>
            <span className="open-calls-hint muted">Trust verified by Observer Protocol</span>
          </div>
          {filtered.length > 0 ? (
            <div className="task-grid">
              {filtered.map((m) => (
                <TaskCard key={m.id} m={m} />
              ))}
            </div>
          ) : (
            <div className="open-calls-empty">
              <p>No tasks match the filter.</p>
            </div>
          )}
        </div>
      ) : (
        <>
          <p className="lede">
            {query
              ? `${filtered.length} of ${initialListings.length} listings`
              : tab === 'all'
                ? 'All listings in the marketplace'
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
        </>
      )}

      {showPostModal && <PostTaskModal onClose={() => setShowPostModal(false)} />}
    </div>
  );
}
