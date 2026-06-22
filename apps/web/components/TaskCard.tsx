'use client';
import type { Merchant } from '@at-directory/core';
import { useDerivedTier } from './useDerivedTier';
import { TrustBadge } from './TrustBadge';

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
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export function TaskCard({ m }: { m: Merchant }) {
  const { tier, count } = useDerivedTier(m.id, m.op_trust_tier);
  const isChallenge = Boolean(m.is_challenge);
  const status = m.challenge_status ?? 'open';
  const deadline = m.challenge_deadline ?? null;
  const postedAt = m.posted_at ?? null;
  const who = m.challenge_who_can_apply ?? null;
  const budget = m.challenge_prize ?? m.price_display ?? null;

  const deadlineDays = deadline ? daysUntil(deadline) : null;
  const deadlineStr = deadline
    ? new Date(deadline).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const isUrgent = deadlineDays !== null && deadlineDays <= 7;
  const isPast = deadlineDays !== null && deadlineDays < 0;

  return (
    <div
      className={`task-card${isChallenge ? ' task-challenge' : ''}${isPast ? ' task-past' : ''}`}
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
          {m.poster_name && <span className="task-poster">by {m.poster_name}</span>}
        </div>

        <div className="task-trust">
          <TrustBadge tier={tier} count={count} attestationUrl={m.op_attestation_url} />
        </div>
      </div>

      {m.contact_url && (
        <a className="task-apply-btn" href={m.contact_url} target="_blank" rel="noreferrer">
          {isChallenge ? 'Apply for challenge' : 'Respond to this'}
          <span className="task-apply-arrow"> →</span>
        </a>
      )}
    </div>
  );
}
