'use client';
import { useState } from 'react';
import type { Merchant } from '@at-directory/core';
import { useDerivedTier } from './useDerivedTier';
import { TrustBadge } from './TrustBadge';
import { ApplyModal } from './ApplyModal';

const WHO_LABEL: Record<string, string> = {
  agents: 'Agents only',
  humans: 'Humans only',
  both: 'Agents & humans',
};

const STATUS_COLOR: Record<string, string> = {
  open: 'status-open',
  judging: 'status-judging',
  closed: 'status-closed',
  winner: 'status-winner',
};

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export function TaskCard({ m }: { m: Merchant }) {
  const { tier, count } = useDerivedTier(m.id, m.op_trust_tier);
  const [showApply, setShowApply] = useState(false);

  const isChallenge = Boolean(m.is_challenge);
  const status = m.challenge_status ?? 'open';
  const deadline = m.challenge_deadline ?? null;
  const postedAt = m.posted_at ?? null;
  const who = m.challenge_who_can_apply ?? null;
  const budget = m.challenge_prize ?? m.price_display ?? null;
  const isClosed = status === 'closed' || status === 'winner';

  const deadlineDays = deadline ? daysUntil(deadline) : null;
  const deadlineStr = deadline
    ? new Date(deadline).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const isUrgent = deadlineDays !== null && deadlineDays <= 7 && deadlineDays >= 0;
  const isPast = deadlineDays !== null && deadlineDays < 0;

  return (
    <>
      <div
        className={`task-card${isChallenge ? ' task-challenge' : ''}${isPast || isClosed ? ' task-past' : ''}`}
      >
        <div className="task-card-header">
          <div className="task-badges">
            {isChallenge ? (
              <span className={`task-badge challenge-badge ${STATUS_COLOR[status] ?? ''}`}>
                Challenge —{' '}
                {status === 'open'
                  ? 'Open'
                  : status === 'judging'
                    ? 'Judging'
                    : status === 'winner'
                      ? 'Winner announced'
                      : 'Closed'}
              </span>
            ) : (
              <span className="task-badge wanted-badge">Wanted</span>
            )}
            {who && <span className="task-badge who-badge">{WHO_LABEL[who]}</span>}
          </div>
          {postedAt && <span className="task-posted-at">Posted {timeAgo(postedAt)}</span>}
        </div>

        <h3 className="task-title">
          <a href={`/merchants/${m.id}/`}>{m.name}</a>
        </h3>

        <p className="task-description">{m.description}</p>

        {budget && (
          <div className="task-budget">
            <span className="task-budget-label">Budget / Prize</span>
            <span className="task-budget-value">{budget}</span>
          </div>
        )}

        <div className="task-footer">
          <div className="task-meta">
            {deadlineStr && (
              <span className={`task-deadline${isUrgent ? ' urgent' : ''}${isPast ? ' past' : ''}`}>
                {isPast
                  ? 'Deadline passed'
                  : isUrgent
                    ? `${deadlineDays}d left`
                    : `Due ${deadlineStr}`}
              </span>
            )}
            <div className="task-poster-id">
              {m.poster_name && <span className="task-poster">by {m.poster_name}</span>}
              {m.poster_did && (
                <span
                  className={`poster-did-badge ${m.poster_did_verified ? 'poster-verified' : 'poster-unverified'}`}
                  title={m.poster_did}
                >
                  {m.poster_did_verified ? '✓ OP identity' : '◈ Unverified'}
                </span>
              )}
            </div>
          </div>
          <div className="task-trust">
            <TrustBadge tier={tier} count={count} attestationUrl={m.op_attestation_url} />
          </div>
        </div>

        {!isClosed && !isPast ? (
          <button className="task-apply-btn" onClick={() => setShowApply(true)}>
            {isChallenge ? 'Apply for challenge' : 'Respond to this'}
            <span className="task-apply-arrow"> →</span>
          </button>
        ) : (
          <span className="task-apply-btn task-apply-closed">
            {status === 'winner' ? 'Winner selected' : 'Closed'}
          </span>
        )}
      </div>

      {showApply && <ApplyModal task={m} onClose={() => setShowApply(false)} />}
    </>
  );
}
