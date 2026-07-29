// Destination-guarded HTTP for the verifier probes.
//
// WHY THIS EXISTS. `verify_payment_endpoint` is bounded for the CALLER — closed
// rail enum, merchant_id must resolve, no caller-supplied URL. It was not bounded
// for the DESTINATION. Merchant records are schema-validated at load, but
// `format: "uri"` is syntax: it admits http://, localhost, RFC1918 and
// 169.254.169.254. The records come from an aggregation pass over third-party
// directories, and the fetches followed redirects, so the party choosing where
// our IP went was the merchant.
//
// WHY A LOOKUP HOOK RATHER THAN RESOLVE-THEN-FETCH. Resolving first and then
// connecting leaves a window: the address you approved is not necessarily the
// address the socket uses. DNS rebinding exploits exactly that window, and a
// split-horizon record hits it by accident. Node's `lookup` option is the same
// function `net.connect` uses, so validating inside it is race-free BY
// CONSTRUCTION — the address the guard approves IS the address connected to.
// This closes the class rather than narrowing the window.
//
// WHY node:https RATHER THAN fetch + undici Agent. A dependency added to a
// service with no deploy path is maintenance we have no mechanism to perform:
// if it ever needed patching we could not ship the patch. node:https also does
// not follow redirects at all, so `redirect: 'manual'` semantics come for free
// rather than being a flag someone can flip back.
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { lookup as dnsLookup, type LookupAddress } from 'node:dns';

export const PROBE_UA = 'AT-Directory-Verifier/1.0 (+https://agenticterminal.ai)';
const DEFAULT_TIMEOUT_MS = 8000;
const MAX_BODY_BYTES = 512 * 1024;

export class BlockedDestinationError extends Error {
  readonly code = 'EBLOCKED';
  constructor(message: string) {
    super(message);
    this.name = 'BlockedDestinationError';
  }
}

/**
 * Classify a resolved IP. Returns a reason string if the address must not be
 * connected to, or null if it is allowed.
 *
 * IPv6 IS DELIBERATELY IN HERE AND MUST STAY. The first prototype of this guard
 * was checked against `localhost`, which resolved to `::1` — an IPv4-only
 * denylist would have passed it straight through and the guard would have looked
 * complete while being trivially bypassable. IPv4-mapped IPv6 (::ffff:127.0.0.1)
 * is the same trap one level down, which is why it is unwrapped before
 * classification rather than matched as a string.
 */
export function classifyAddress(ip: string): string | null {
  const addr = ip.trim().toLowerCase();

  // Unwrap IPv4-mapped IPv6 (::ffff:127.0.0.1) and reclassify as IPv4, or the
  // v4 rules below never see it.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(addr);
  if (mapped?.[1]) return classifyAddress(mapped[1]);

  if (addr.includes(':')) return classifyIpv6(addr);
  return classifyIpv4(addr);
}

function classifyIpv4(addr: string): string | null {
  const parts = addr.split('.');
  if (parts.length !== 4) return `unparseable IPv4 address ${addr}`;
  const o = parts.map((p) => Number(p));
  if (o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return `unparseable IPv4 address ${addr}`;
  }
  const a = o[0] as number;
  const b = o[1] as number;
  if (a === 0) return `unspecified/this-network address ${addr}`;
  if (a === 127) return `loopback address ${addr}`;
  if (a === 10) return `RFC1918 private address ${addr}`;
  if (a === 172 && b >= 16 && b <= 31) return `RFC1918 private address ${addr}`;
  if (a === 192 && b === 168) return `RFC1918 private address ${addr}`;
  if (a === 169 && b === 254) return `link-local address ${addr} (cloud metadata range)`;
  if (a === 100 && b >= 64 && b <= 127) return `CGNAT shared address ${addr}`;
  if (a === 192 && b === 0) return `IETF protocol assignment address ${addr}`;
  if (a === 198 && (b === 18 || b === 19)) return `benchmarking address ${addr}`;
  if (a >= 224) return `multicast or reserved address ${addr}`;
  return null;
}

function classifyIpv6(addr: string): string | null {
  const a = addr.replace(/^\[|\]$/g, '');
  if (a === '::') return `unspecified address ${addr}`;
  if (a === '::1') return `IPv6 loopback address ${addr}`;
  // fc00::/7 — unique local. Covers fc.. and fd.. .
  if (/^f[cd]/.test(a)) return `IPv6 unique-local (fc00::/7) address ${addr}`;
  // fe80::/10 — link-local.
  if (/^fe[89ab]/.test(a)) return `IPv6 link-local address ${addr}`;
  if (/^ff/.test(a)) return `IPv6 multicast address ${addr}`;
  return null;
}

// Matches node's LookupFunction callback: the address may be a string or, with
// { all: true }, an array of LookupAddress.
type LookupCb = (
  err: NodeJS.ErrnoException | null,
  address?: string | LookupAddress[],
  family?: number,
) => void;

/**
 * dns.lookup with classification applied to every returned address, refusing
 * before the socket is created. Exported for testing.
 */
export function makeGuardedLookup(
  classify: (ip: string) => string | null = classifyAddress,
): (hostname: string, options: unknown, callback: LookupCb) => void {
  return (hostname, options, callback) => guardedLookupWith(classify, hostname, options, callback);
}

export function guardedLookup(hostname: string, options: unknown, callback: LookupCb): void {
  guardedLookupWith(classifyAddress, hostname, options, callback);
}

function guardedLookupWith(
  classify: (ip: string) => string | null,
  hostname: string,
  options: unknown,
  callback: LookupCb,
): void {
  dnsLookup(hostname, options as never, (err, address, family) => {
    if (err) return callback(err);
    const list: LookupAddress[] = Array.isArray(address)
      ? (address as LookupAddress[])
      : [{ address: address as string, family: family as number }];
    for (const entry of list) {
      const reason = classify(entry.address);
      if (reason) {
        return callback(new BlockedDestinationError(`refusing ${hostname}: ${reason}`));
      }
    }
    callback(null, address as string, family as number);
  });
}

export interface GuardedResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  finalUrl: string;
}

export interface GuardedRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** Allow http:// — only for tests against loopback fixtures. Never in production paths. */
  allowInsecure?: boolean;
  /**
   * Address classifier. Defaults to `classifyAddress`.
   *
   * THIS IS A TEST SEAM, NOT AN ESCAPE HATCH, and the distinction is load-bearing:
   * there is no environment variable and no default relaxation, so nothing can
   * turn the guard off in a deployed unit file. Overriding it requires editing a
   * call site, and the three production call sites pass nothing. It exists so the
   * end-to-end behaviour (notably: a 3xx is returned, never followed) can be
   * tested against a loopback fixture, which the real classifier must refuse.
   */
  classify?: (ip: string) => string | null;
}

/**
 * Perform one request with destination guarding. Does NOT follow redirects:
 * node:https does not follow by default, which is the behaviour we want. A 3xx
 * is returned to the caller as-is.
 *
 * A redirect chain that must be followed needs followGuarded (designed, not
 * built — see op-at-specs/2026-07-28-at-directory-mcp-redirect-guard-scoping.md),
 * which revalidates every hop. Following redirects without per-hop revalidation
 * is the hole this module closes; do not add a `redirect: follow` shortcut here.
 */
export function guardedRequest(
  url: string,
  opts: GuardedRequestOptions = {},
): Promise<GuardedResponse> {
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return reject(new BlockedDestinationError(`unparseable URL ${url}`));
    }

    const insecureOk = opts.allowInsecure === true;
    if (parsed.protocol !== 'https:' && !(insecureOk && parsed.protocol === 'http:')) {
      return reject(
        new BlockedDestinationError(`refusing ${parsed.protocol}// — https is required`),
      );
    }

    // A literal IP in the URL never reaches the lookup hook, so classify it here
    // too. Without this, https://127.0.0.1/ would bypass the whole guard.
    const classify = opts.classify ?? classifyAddress;
    const literal = parsed.hostname.replace(/^\[|\]$/g, '');
    if (/^[\d.]+$/.test(literal) || literal.includes(':')) {
      const reason = classify(literal);
      if (reason) return reject(new BlockedDestinationError(`refusing ${url}: ${reason}`));
    }

    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const send = parsed.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = send(
      {
        protocol: parsed.protocol,
        hostname: literal,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: opts.method ?? 'GET',
        headers: {
          'User-Agent': PROBE_UA,
          Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
          ...(opts.headers ?? {}),
        },
        lookup: makeGuardedLookup(classify) as never,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', (c: Buffer) => {
          total += c.length;
          if (total <= MAX_BODY_BYTES) chunks.push(c);
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
            finalUrl: url,
          });
        });
      },
    );

    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout after ${timeoutMs}ms`)));
    req.on('error', reject);
    req.end();
  });
}
