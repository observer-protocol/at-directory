// Plain HTTP/REST read surface, same data layer and process as the MCP
// server. For agent runtimes that don't speak MCP (OpenClaw, custom
// Lightning-native agents). Reads only, anonymous, ungated — matches the
// directory's read posture (spec §4.3). Credentialed writes are not in
// the REST scope. Mounted under /v1 on the hosted server.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DirectoryData } from './bootstrap.ts';
import { ANONYMOUS_IDENTITY } from './auth.ts';
import type { ToolContext } from './context.ts';
import { SearchMerchantsArgs, searchMerchantsTool } from './tools/search_merchants.ts';
import { getMerchantTool } from './tools/get_merchant.ts';
import { listCategoriesTool } from './tools/list_categories.ts';
import { listRailsTool } from './tools/list_rails.ts';
import {
  VerifyPaymentEndpointArgs,
  verifyPaymentEndpointTool,
} from './tools/verify_payment_endpoint.ts';

const REST_PREFIX = '/v1';

// §0.2-C: the OP trust tier is DERIVED at request time from the OP API;
// the static merchant JSON value is a cache/fallback only. Loopback
// origin only — the box calling its own public Cloudflare hostname
// loops back / times out (op-vps gotcha). Fail-soft: any error keeps
// the static value (never break the directory if the OP API is slow).
const OP_API_BASE = process.env.OP_API_BASE ?? 'http://127.0.0.1:8000';
const TIER_TTL_MS = 60_000;

interface DerivedTier {
  op_trust_tier: number;
  distinct_attestors: number;
  attestation_count: number;
  as_of: string;
}
const _tierCache = new Map<string, { v: DerivedTier | null; exp: number }>();

async function fetchDerivedTier(id: string): Promise<DerivedTier | null> {
  const hit = _tierCache.get(id);
  if (hit && hit.exp > Date.now()) return hit.v;
  let v: DerivedTier | null = null;
  try {
    const r = await fetch(`${OP_API_BASE}/v1/merchants/${encodeURIComponent(id)}/tier`, {
      signal: AbortSignal.timeout(2000),
    });
    if (r.ok) {
      const d = (await r.json()) as Partial<DerivedTier>;
      if (typeof d.op_trust_tier === 'number') {
        v = {
          op_trust_tier: d.op_trust_tier,
          distinct_attestors: d.distinct_attestors ?? 0,
          attestation_count: d.attestation_count ?? 0,
          as_of: d.as_of ?? '',
        };
      }
    }
  } catch {
    v = null; // fail-soft
  }
  _tierCache.set(id, { v, exp: Date.now() + TIER_TTL_MS });
  return v;
}

function overlayTier(m: object, dv: DerivedTier | null): object {
  if (!dv) return m;
  return {
    ...m,
    op_trust_tier: dv.op_trust_tier,
    op_trust: {
      tier: dv.op_trust_tier,
      distinct_attestors: dv.distinct_attestors,
      attestation_count: dv.attestation_count,
      as_of: dv.as_of,
    },
  };
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    // Public read API for arbitrary agent clients.
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(json);
}

function coerceSearch(qs: URLSearchParams): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const str = (k: string) => {
    const v = qs.get(k);
    if (v !== null && v !== '') out[k] = v;
  };
  str('query');
  str('rail');
  str('chain');
  str('category');
  str('agent_callable_tier');
  const tier = qs.get('trust_tier_min');
  if (tier !== null && tier !== '') out.trust_tier_min = Number(tier);
  const usdc = qs.get('accepts_usdc');
  if (usdc !== null && usdc !== '') out.accepts_usdc = usdc === 'true' || usdc === '1';
  const limit = qs.get('limit');
  if (limit !== null && limit !== '') out.limit = Number(limit);
  return out;
}

// Returns true if the request was a /v1 path (handled or errored here),
// false if the caller should keep routing (e.g. /mcp, /healthz, 404).
export async function tryHandleRest(
  req: IncomingMessage,
  res: ServerResponse,
  data: DirectoryData,
): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (path !== REST_PREFIX && !path.startsWith(`${REST_PREFIX}/`)) return false;

  if (req.method === 'OPTIONS') {
    send(res, 204, {});
    return true;
  }

  const ctx: ToolContext = { merchants: data.merchants, identity: ANONYMOUS_IDENTITY };
  const method = req.method ?? 'GET';

  try {
    // GET /v1/merchants
    if (path === `${REST_PREFIX}/merchants` && method === 'GET') {
      const parsed = SearchMerchantsArgs.safeParse(coerceSearch(url.searchParams));
      if (!parsed.success) {
        send(res, 400, { error: 'invalid_query', detail: parsed.error.flatten() });
        return true;
      }
      const listed = searchMerchantsTool(parsed.data, ctx);
      // Overlay derived tier on each result (TTL-cached). Ranking still
      // uses the static value — derived-tier ranking is deferred (#2).
      await Promise.all(
        listed.results.map(async (r, i) => {
          const dv = await fetchDerivedTier(String((r as { id: string }).id));
          if (dv) listed.results[i] = overlayTier(r as object, dv) as typeof r;
        }),
      );
      send(res, 200, listed);
      return true;
    }

    // GET /v1/categories
    if (path === `${REST_PREFIX}/categories` && method === 'GET') {
      send(res, 200, listCategoriesTool({}, ctx, data.categoryLabels));
      return true;
    }

    // GET /v1/rails
    if (path === `${REST_PREFIX}/rails` && method === 'GET') {
      send(res, 200, listRailsTool({}, ctx, data.railsManifest));
      return true;
    }

    // POST /v1/merchants/{id}/verify?rail=lightning
    const verifyMatch = path.match(/^\/v1\/merchants\/([^/]+)\/verify$/);
    if (verifyMatch) {
      if (method !== 'POST') {
        send(res, 405, { error: 'method_not_allowed', detail: 'use POST' });
        return true;
      }
      const args = VerifyPaymentEndpointArgs.safeParse({
        merchant_id: decodeURIComponent(verifyMatch[1]!),
        rail: url.searchParams.get('rail') ?? undefined,
      });
      if (!args.success) {
        send(res, 400, { error: 'invalid_request', detail: args.error.flatten() });
        return true;
      }
      const result = await verifyPaymentEndpointTool(args.data, ctx);
      send(res, 'error' in result ? 400 : 200, result);
      return true;
    }

    // GET /v1/merchants/{id} — overlay the DERIVED tier (§0.2-C: static
    // value is the cache/fallback; the OP API is the source of truth).
    const getMatch = path.match(/^\/v1\/merchants\/([^/]+)$/);
    if (getMatch && method === 'GET') {
      const mid = decodeURIComponent(getMatch[1]!);
      const result = getMerchantTool({ id: mid }, ctx);
      if ('error' in result) {
        send(res, 404, result);
        return true;
      }
      const dv = await fetchDerivedTier(mid);
      send(res, 200, dv ? { ...result, merchant: overlayTier(result.merchant, dv) } : result);
      return true;
    }

    send(res, 404, { error: 'not_found', detail: `no REST route for ${method} ${path}` });
    return true;
  } catch (e) {
    send(res, 500, { error: 'internal_error', detail: (e as Error).message });
    return true;
  }
}
