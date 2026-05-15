import type { RailCheckResult } from './lightning.ts';

const TIMEOUT_MS = 8000;

export async function verifyL402(endpoint: string): Promise<RailCheckResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(endpoint, { method: 'GET', signal: controller.signal });
  } catch {
    return {
      status: 'down',
      detail: `L402 endpoint ${endpoint} unreachable.`,
      evidence: { http_status: null },
    };
  } finally {
    clearTimeout(timer);
  }

  const authHeader =
    res.headers.get('www-authenticate') ?? res.headers.get('WWW-Authenticate') ?? '';
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
