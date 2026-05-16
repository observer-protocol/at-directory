export interface RailCheckResult {
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  detail: string;
  evidence: Record<string, unknown>;
}

const TIMEOUT_MS = 8000;

// Identify the probe honestly. A missing/library default User-Agent gets
// blocked by common WAFs (Cloudflare etc.), which made live merchants
// look "down". This both reduces false blocks and is the polite thing.
const PROBE_UA = 'AT-Directory-Verifier/1.0 (+https://agenticterminal.ai)';

async function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      headers: {
        'User-Agent': PROBE_UA,
        Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// v1: passive only. No probe invoices. Check URL reachability and resolve
// LNURL / lightning-address if the merchant declared one.
export async function verifyLightning(
  merchantUrl: string,
  paymentEndpoint: string | null | undefined,
): Promise<RailCheckResult> {
  const start = Date.now();
  let httpStatus: number | undefined;
  try {
    const res = await timedFetch(merchantUrl, { method: 'GET', redirect: 'follow' });
    httpStatus = res.status;
  } catch {
    return {
      status: 'down',
      detail: `Merchant URL ${merchantUrl} unreachable.`,
      evidence: { http_status: null, response_ms: Date.now() - start },
    };
  }

  // 401/403/429 from a merchant edge almost always means bot/WAF
  // protection or rate-limiting blocked the probe — NOT that the
  // merchant is down. Asserting "down" off a WAF block is a false
  // negative that defames a live merchant on a trust directory. Report
  // "unknown" and say so plainly.
  if (httpStatus === 401 || httpStatus === 403 || httpStatus === 429) {
    return {
      status: 'unknown',
      detail: `Merchant edge returned ${httpStatus} to the verification probe (likely bot/WAF protection or rate-limiting). The merchant is not necessarily down — server-side reachability could not be verified.`,
      evidence: { http_status: httpStatus, probe_blocked: true, response_ms: Date.now() - start },
    };
  }

  const reachable = httpStatus < 400;
  if (!paymentEndpoint) {
    return {
      status: reachable ? 'unknown' : 'down',
      detail: reachable
        ? 'Merchant reachable; no LNURL/lightning-address declared so no probe attempted.'
        : `Merchant URL returned ${httpStatus}.`,
      evidence: { http_status: httpStatus, response_ms: Date.now() - start },
    };
  }

  const lnurl = await resolveLnurl(paymentEndpoint);
  const status = !reachable ? 'down' : lnurl.resolved ? 'healthy' : 'degraded';
  return {
    status,
    detail: lnurl.resolved
      ? 'Merchant reachable and LNURL/lightning-address resolves.'
      : `Merchant reachable but LNURL/lightning-address failed to resolve: ${lnurl.detail}`,
    evidence: {
      http_status: httpStatus,
      lnurl_resolved: lnurl.resolved,
      response_ms: Date.now() - start,
    },
  };
}

async function resolveLnurl(endpoint: string): Promise<{ resolved: boolean; detail: string }> {
  try {
    let url: string;
    if (endpoint.includes('@')) {
      const [name, domain] = endpoint.split('@');
      url = `https://${domain}/.well-known/lnurlp/${name}`;
    } else if (endpoint.toLowerCase().startsWith('lnurl')) {
      const decoded = decodeBech32Lnurl(endpoint);
      if (!decoded) return { resolved: false, detail: 'LNURL bech32 decode failed' };
      url = decoded;
    } else if (endpoint.startsWith('http')) {
      url = endpoint;
    } else {
      return { resolved: false, detail: 'Unrecognized lightning endpoint format' };
    }
    const res = await timedFetch(url, { method: 'GET' });
    if (!res.ok) return { resolved: false, detail: `LNURL endpoint returned ${res.status}` };
    const body = (await res.json()) as { callback?: string; tag?: string };
    const ok = typeof body.callback === 'string' || body.tag === 'payRequest';
    return { resolved: ok, detail: ok ? 'payRequest resolved' : 'no payRequest in response' };
  } catch (e) {
    return { resolved: false, detail: (e as Error).message };
  }
}

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function decodeBech32Lnurl(input: string): string | null {
  const lower = input.toLowerCase();
  const pos = lower.lastIndexOf('1');
  if (pos < 1) return null;
  const data = lower.slice(pos + 1);
  const bytes: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const ch of data.slice(0, -6)) {
    const v = BECH32_CHARSET.indexOf(ch);
    if (v === -1) return null;
    acc = (acc << 5) | v;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  try {
    return Buffer.from(bytes).toString('utf8');
  } catch {
    return null;
  }
}
