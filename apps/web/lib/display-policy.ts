import type { Merchant } from '@at-directory/core';

// What the directory currently declines to show, and the condition for
// showing it again. These live in code rather than a doc because the
// surface that hides something should carry the test for un-hiding it.

// ─────────────────────────────────────────────────────────────────────
// Observer Protocol trust tiers — OFF since 2026-07-29.
//
// Two independent reasons, either sufficient:
//
//   1. Tier 1 means "no attestation record exists". It is the absence of
//      data, not a judgement, and it rendered as "Self-attested" — which
//      asserts a claim on the merchant's behalf that no merchant made.
//      Nearly every entry in the directory read that way.
//
//   2. Tier 2 means "at least one distinct attestor filed an attestation
//      within 90 days". On 2026-07-29 every attestation in the system was
//      authored by a single agent — did:web:observerprotocol.org:agents:
//      maxi-0001, which is ours. So the two Tier 2 badges told a visitor
//      that our own agent vouched for merchants we listed, and linked to
//      our own org attestation as the evidence. A closed loop reads worse
//      than showing nothing.
//
// Agent-callability replaced it: full API / structured handoff / human
// checkout is populated on all 78 merchants, spreads 22/10/46, is checkable
// against the merchant's own docs, and is the field nobody else publishes.
//
// LIFT WHEN the attestation set has more than one distinct author and at
// least one of them is an attestor we do not operate. The check, against
// the OP database on op-vps:
//
//   select count(distinct attestor_agent_id) from merchant_attestations;
//
// That returned 1 on 2026-07-29. Flipping this to true restores the badge
// on every card and the merchant detail page — see TrustTier.tsx, which
// still holds the full implementation and is the only consumer.
export const SHOW_TRUST_TIERS = false;

// ─────────────────────────────────────────────────────────────────────
// The open-call board.
//
// A task board is a liquidity signal: a visitor reads the number of open
// tasks as how busy the market is. Two live calls, dropping to one when
// agent-commerce-content expires on 2026-07-31, signals an empty market
// on the same page we are paying to promote the merchant directory.
//
// So the board is suppressed wholesale until it can carry its own weight,
// rather than shown thin. Posting stays open — a new task takes the count
// to three and the board reappears on the next build with no code change.
export const MIN_OPEN_CALLS_TO_SHOW = 3;

// An open call is past its deadline, or its poster closed it. Expired
// calls are hidden from every default view: a stale listing on a live page
// reads as abandonment, and "Deadline passed — Closed" is worse than absent.
export function isLiveOpenCall(m: Merchant, now: number = Date.now()): boolean {
  const status = m.challenge_status ?? 'open';
  if (status === 'closed' || status === 'winner') return false;
  if (m.challenge_deadline && new Date(m.challenge_deadline).getTime() < now) return false;
  return true;
}

export function isOpenCall(m: Merchant): boolean {
  return (m.listing_type ?? 'offer') === 'open-call';
}

// Computed on the server so the prerender and the browser agree on it —
// deriving liveness independently on both sides would drift across the
// deadline boundary and desync hydration.
export function liveOpenCalls(listings: Merchant[], now?: number): Merchant[] {
  return listings.filter((m) => isOpenCall(m) && isLiveOpenCall(m, now));
}
