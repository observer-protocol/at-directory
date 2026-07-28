import type { RailCheckResult } from './lightning.ts';
import { guardedRequest, BlockedDestinationError } from './guarded-request.ts';

const TIMEOUT_MS = 8000;

export async function verifyL402(endpoint: string): Promise<RailCheckResult> {
  let res: Awaited<ReturnType<typeof guardedRequest>>;
  try {
    res = await guardedRequest(endpoint, { timeoutMs: TIMEOUT_MS });
  } catch (e) {
    // Our refusal, not their downtime. See the same branch in lightning.ts.
    if (e instanceof BlockedDestinationError) {
      return {
        status: 'unknown',
        detail: `Verification refused: ${e.message}. This is our destination policy, not merchant availability.`,
        evidence: { http_status: null, blocked: true },
      };
    }
    return {
      status: 'down',
      detail: `L402 endpoint ${endpoint} unreachable.`,
      evidence: { http_status: null },
    };
  }

  const rawAuth = res.headers['www-authenticate'];
  const authHeader = Array.isArray(rawAuth) ? rawAuth.join(', ') : (rawAuth ?? '');
  const challengePresent = /l402|lsat/i.test(authHeader);

  if (res.status === 402 && challengePresent) {
    return {
      status: 'healthy',
      detail: 'Endpoint returned HTTP 402 with a valid L402 challenge.',
      evidence: { http_status: 402, challenge_present: true },
    };
  }
  if (res.status === 402 || res.status === 200) {
    return {
      status: 'degraded',
      detail:
        res.status === 402
          ? 'HTTP 402 but no recognizable L402 challenge header.'
          : 'Endpoint returned 200 (not payment-gated).',
      evidence: { http_status: res.status, challenge_present: challengePresent },
    };
  }
  return {
    status: 'down',
    detail: `Endpoint returned unexpected status ${res.status}.`,
    evidence: { http_status: res.status, challenge_present: challengePresent },
  };
}
